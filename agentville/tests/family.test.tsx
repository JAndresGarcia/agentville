import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

import { MAIN, carryOver, newBeat, setAgent } from '../hooks/beat'
import type { Beat } from '../hooks/beat'
import { CLIENT_MAX, LIST_MAX, famCut, famDepths, famGroups, famTree } from '../hooks/register'
import { CHAT_W } from '../hooks/btns'
import type { BtnsProps } from '../hooks/btns'

// Sub-offices, the data side (layout-b B2, B7): the parent link read from the app's session records, and the list.
const HOME = '/home/test/.claude/agentville'
const RECORDS = '/home/test/Library/Application Support/Claude/claude-code-sessions'
const PANE = { title: 'Agentville', isFocused: false, bodyColumns: 110, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} }
type Ran = { exitCode: number; stdout: string; stderr: string }

// The engine in memory: heartbeats served from `list`, what the session writes kept in `files`, and the session
// records (path under RECORDS -> text) that `grep` finds by the session id and `head` reads.
function serve(on: On, list: Beat[], records: Record<string, string> = {}) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/home/test/proj' }))
  on('session.surfaces', () => ({ value: [] }))
  on('session.id', () => ({ value: 's-test' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  const panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  on('ui.open', ($, e) => { if (!panes.some(x => x.id === e.id)) panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [...panes] }))
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(String(e.text)); return { value: undefined } })
  on('classic.UserPromptSubmit', () => ({}))
  on('env.get', () => ({ value: '/home/test' }))
  const store: Record<string, unknown> = { 'intro-done': true, lang: 'es' } // these tests read the Spanish copy; English is the default
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  const files: Record<string, string> = {}
  on('fs.list', () => ({ value: list.map(b => ({ name: `${b.id}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  on('fs.write', ($, e) => { files[String(e.path)] = String(e.text); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  on('fs.read', ($, e) => ({ value: files[String(e.path)] ?? JSON.stringify(list.find(b => String(e.path).endsWith(`/sessions/${b.id}.json`))) ?? '' }))
  const greps: (readonly string[])[] = [], finds: (readonly string[])[] = [], heads: string[] = [], opens: (readonly string[])[] = []
  on('process.run', ($, e) => {
    const a = e.argv
    let r: Ran = { exitCode: 1, stdout: '', stderr: '' }
    if (a[0] === '/usr/bin/open') { opens.push(a); r = { exitCode: 0, stdout: '', stderr: '' } }
    else if (a[0] === '/usr/bin/grep') {
      greps.push(a)
      r = { exitCode: 0, stdout: Object.keys(records).filter(p => records[p]!.includes(String(a[4]))).map(p => `${a.at(-1)}/${p}`).join('\n'), stderr: '' }
    } else if (a[0] === '/usr/bin/find') {
      finds.push(a)
      const names = a.filter((x, i) => a[i - 1] === '-name')
      r = { exitCode: 0, stdout: Object.keys(records).filter(p => names.includes(p.slice(p.lastIndexOf('/') + 1))).map(p => `${RECORDS}/${p}\n`).join(''), stderr: '' }
    } else if (a[0] === '/usr/bin/head') {
      const p = String(a.at(-1))
      heads.push(p)
      const text = records[p.slice(RECORDS.length + 1)]
      r = text === undefined ? r : { exitCode: 0, stdout: text.slice(0, Number(a[2])), stderr: '' } // head -c N
    }
    return { value: { ...r, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { files, greps, finds, heads, store, opens, toasts }
}
// The session list's old per-row Clients (list-hit-layer stored false, the /agentville capa de clics fallback), which
// the tests that call this read; the default is the one-Client click layer.
const oldList = (store: Record<string, unknown>) => { store['list-hit-layer'] = false }
const startSession = ($: Engine) => $.session.start({ cwd: '/home/test/proj', surface: 'desktop', isInteractive: true })
const prompt = ($: Engine) => $.classic.UserPromptSubmit({ prompt: 'hola', transcript_path: '/home/test/t.jsonl' } as never)
const beatOf = (files: Record<string, string>) => JSON.parse(files[`${HOME}/sessions/s-test.json`]!) as Beat
const rec = (o: object) => JSON.stringify(o)
const UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', LOCAL = `local_${UUID}` // this session's own record id in the app

test('B2: the link is looked up while unknown: every 5 s for the first 5 minutes at no cost, then once a minute and 10 times', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { greps, heads, files } = serve(on, [])
  await startSession($); await clock.settle()
  expect(greps).toHaveLength(1)
  expect(greps[0]).toEqual(['/usr/bin/grep', '-rlF', '--include=local_*.json', '-e', 's-test', '--', RECORDS]) // argv only
  await prompt($); await clock.settle()
  expect(greps).toHaveLength(1) // under 5 s: no second look
  for (let i = 0; i < 300; i++) await clock.advance(1000)
  const fresh = greps.length
  expect(fresh).toBeGreaterThanOrEqual(50) // about one look every 5 s while the session is fresh, none of them a try
  expect(fresh).toBeLessThanOrEqual(61)
  for (let i = 0; i < 15; i++) { await clock.advance(60000); await prompt($); await clock.settle() }
  expect(greps.length - fresh).toBe(10) // then once a minute, 10 tries
  expect(heads).toEqual([]) // nothing found, nothing read
  expect(beatOf(files).parent).toBeUndefined()
})

test('B2: a found link is kept in the heartbeat; rejected paths and other sessions\' records are never read', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { greps, heads, files } = serve(on, [], {
    '../evil/local_x.json': rec({ cliSessionId: 's-test' }),
    'ab/cd/local_other.json': rec({ sessionId: 'local_other', cliSessionId: 'other', spawnedFrom: { sessionId: 'local_p-1' }, note: 's-test' }),
    [`ab/cd/${LOCAL}.json`]: rec({ sessionId: LOCAL, cliSessionId: 's-test', spawnedFrom: { sessionId: 'local_p-1' } }),
    'ab/cd/local_p-1.json': rec({ sessionId: 'local_p-1', cliSessionId: 'cli-parent' }),
  })
  await startSession($); await clock.settle()
  expect([beatOf(files).parent, beatOf(files).local]).toEqual(['cli-parent', LOCAL])
  // the own record, then its parent beside it; the other session's record is read but its parent never is
  expect(heads).toEqual([`${RECORDS}/ab/cd/local_other.json`, `${RECORDS}/ab/cd/${LOCAL}.json`, `${RECORDS}/ab/cd/local_p-1.json`])
  for (let i = 0; i < 60; i++) await clock.advance(1000)
  expect(greps).toHaveLength(1) // both known: never looked up again
})

test('B2: the link survives a reload (carry-over), so a new module never looks it up', async ($, on) => {
  const old = { ...newBeat('s-test', 'hija', 99000), parent: 'cli-parent', local: LOCAL }
  const b = newBeat('s-test', 'x', 1)
  carryOver(b, old)
  expect([b.parent, b.local]).toEqual(['cli-parent', LOCAL])
  const clock = mock.clock(on, { now: 100000 })
  const { greps, files } = serve(on, [old])
  await startSession($); await clock.settle()
  expect([beatOf(files).parent, greps.length]).toEqual(['cli-parent', 0])
})

test('D: another session\'s record, or its own with an id that is no uuid, gives no record id', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { files } = serve(on, [], {
    [`ab/cd/local_${UUID.replace('0a', '0b')}.json`]: rec({ sessionId: `local_${UUID.replace('0a', '0b')}`, cliSessionId: 'other', note: 's-test' }), // another session's
    'ab/cd/local_c-1.json': rec({ sessionId: 'local_c-1', cliSessionId: 's-test' }), // its own, but no uuid: no link is built
  })
  await startSession($); await clock.settle()
  expect([beatOf(files).local, beatOf(files).parent]).toEqual([undefined, undefined])
})

test('D: a root session keeps its own record id and keeps looking for a parent by reading its own record, no grep', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { greps, heads, files } = serve(on, [], { [`ab/cd/${LOCAL}.json`]: rec({ sessionId: LOCAL, cliSessionId: 's-test' }) })
  await startSession($); await clock.settle()
  expect([beatOf(files).local, beatOf(files).parent, greps.length, heads.length]).toEqual([LOCAL, undefined, 1, 1])
  for (let i = 0; i < 6; i++) await clock.advance(1000)
  expect([beatOf(files).local, greps.length, heads]).toEqual([LOCAL, 1, [`${RECORDS}/ab/cd/${LOCAL}.json`, `${RECORDS}/ab/cd/${LOCAL}.json`]])
})

// B7: the list puts a child right under its parent, indented, "↳ <name>", in its parent's group whatever its own state
// (AJ), its line its own state; the parent row says how many sessions it coordinates (a hidden child counts too).
const rowHas = async (ui: Mounted<'desktop', 'Pane'>, id: string, text: RegExp) => (await ui.findAll({ type: 'Text', text, in: `btns-pick-${id}` })).length > 0
test('B7: child rows follow their parent with ↳, a sleeping one too; the parent row says it coordinates them', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const p = work(newBeat('p1', 'padre', now)), other = work(newBeat('o1', 'otra', now))
  const c1 = { ...work(newBeat('c1', 'hija', now)), parent: 'p1' }
  const c2 = { ...newBeat('c2', 'dormida', now - 1000), parent: 'p1', ended: true, endReason: 'other' } // asleep, still counted
  oldList(serve(on, [other, c1, p, c2].map((b, i) => ({ ...b, slot: i }))).store)
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  // both children sit under their parent, indented with ↳, the sleeping one too; their lines say their own state
  expect([await rowHas(ui, 'c1', /^↳ hija$/), await rowHas(ui, 'c1', / · trabajando · /), await rowHas(ui, 'c2', /^↳ dormida$/), await rowHas(ui, 'c2', / · dormida · /), await rowHas(ui, 'c1', /Encargado/), await rowHas(ui, 'c2', /Encargado/)]).toEqual([true, true, true, true, false, false])
  const pad = async (id: string) => (await ui.findAll({ type: 'Box' })).find(x => x.key === `indent-${id}`)?.props.width
  expect([await pad('c1'), await pad('c2'), await pad('p1')]).toEqual([2, 2, undefined])
  expect([await rowHas(ui, 'p1', /coordina 2 sesiones/), await rowHas(ui, 'p1', /^↳/), await rowHas(ui, 'p1', /Encargado/), await rowHas(ui, 'o1', /coordina|Encargado|↳/)]).toEqual([true, false, false, false])
  const keys = (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick-'))
  expect([keys.indexOf('btns-pick-c1'), keys.indexOf('btns-pick-c2')]).toEqual([keys.indexOf('btns-pick-p1') + 1, keys.indexOf('btns-pick-p1') + 2]) // right after its parent
})

test('B7: a selected child shown past the idle cut, its parent cut: no arrow, no indent, it names its parent', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const done = (b: Beat) => (setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }), b)
  const list = [...[1, 2, 3, 4, 5].map(i => done(newBeat(`i${i}`, `sola${i}`, now))), done(newBeat('p1', 'padre', now)), { ...done(newBeat('c1', 'hija', now)), parent: 'p1' }]
  oldList(serve(on, list.map((b, i) => ({ ...b, slot: i }))).store)
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  const shown = async () => (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick-'))
  expect(await shown()).not.toContain('btns-pick-p1') // the sixth idle office and on are cut
  await ui.press({ key: 'idle-more' })
  await ui.press({ key: 'pick-c1' })
  await ui.press({ key: 'idle-more' }) // back to the first five, plus the selected child
  expect([(await shown()).includes('btns-pick-p1'), (await shown()).includes('btns-pick-c1')]).toEqual([false, true])
  const pad = (await ui.findAll({ type: 'Box' })).find(x => x.key === 'indent-c1')
  expect([await rowHas(ui, 'c1', /^↳/), await rowHas(ui, 'c1', /Encargado de padre · /), pad]).toEqual([false, true, undefined])
})

test('Q-A: a grandchild sits under its child, under its root, each a step deeper; a parent cycle draws each once', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const root = work(newBeat('r1', 'Estrategia', now)), child = { ...work(newBeat('c1', 'Prueba', now)), parent: 'r1' }
  const grand = { ...work(newBeat('g1', 'Sugerencia B', now)), parent: 'c1' }
  const x = { ...work(newBeat('x1', 'equis', now)), parent: 'y1' }, y = { ...work(newBeat('y1', 'ye', now)), parent: 'x1' } // a cycle
  oldList(serve(on, [grand, x, root, y, child].map((b, i) => ({ ...b, slot: i }))).store)
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  const keys = (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick-'))
  expect(keys.filter(k => /-(r1|c1|g1)$/.test(k))).toEqual(['btns-pick-r1', 'btns-pick-c1', 'btns-pick-g1']) // root, child, grandchild
  expect(keys.indexOf('btns-pick-g1')).toBe(keys.indexOf('btns-pick-r1') + 2)
  expect(keys.filter(k => /-(x1|y1)$/.test(k))).toHaveLength(2) // the cycle: each drawn once (no family, two roots)
  const indent = async (id: string) => (await ui.findAll({ type: 'Box' })).find(b => b.key === `indent-${id}`)?.props.width ?? 0
  expect([await indent('r1'), await indent('c1'), await indent('g1'), await indent('x1'), await indent('y1')]).toEqual([0, 2, 4, 0, 0])
  expect([await rowHas(ui, 'c1', /^↳ Prueba$/), await rowHas(ui, 'g1', /^↳ Sugerencia B$/), await rowHas(ui, 'r1', /^↳/)]).toEqual([true, true, false])
})

test('Q-A: famTree is depth first at any depth, keeps an orphan in place and visits a cycle or a self-parent once', () => {
  const ids = (l: { id: string }[]) => l.map(d => d.id)
  const l = [{ id: 'g', parent: 'c' }, { id: 'o', parent: 'gone' }, { id: 'r' }, { id: 'c', parent: 'r' }, { id: 'c2', parent: 'r' }, { id: 'gg', parent: 'g' }]
  const tree = famTree(l)
  expect(ids(tree)).toEqual(['o', 'r', 'c', 'g', 'gg', 'c2'])
  expect(famDepths(tree).map(([d, k]) => `${d.id}${k}`)).toEqual(['o0', 'r0', 'c1', 'g2', 'gg3', 'c21'])
  expect(ids(famTree([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }, { id: 's', parent: 's' }]))).toEqual(['a', 'b', 's'])
  expect(famDepths(famTree([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }])).map(([, k]) => k)).toEqual([0, 1])
  // the starter (`from`) in the group wins; out of it, the root (`parent`) does
  const fam = [{ id: 'g', parent: 'r', from: 'c' }, { id: 'r' }, { id: 'c', parent: 'r', from: 'r' }]
  expect(famDepths(famTree(fam)).map(([d, k]) => `${d.id}${k}`)).toEqual(['r0', 'c1', 'g2'])
  expect(famDepths(famTree([fam[0]!, fam[1]!])).map(([d, k]) => `${d.id}${k}`)).toEqual(['r0', 'g1'])
})

test('AJ: a grandchild under its child under its root, the child idle and the root at work: all three in Trabajando', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const done = (b: Beat) => (setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }), b)
  const root = work(newBeat('r1', 'Estrategia', now)), child = { ...done(newBeat('c1', 'Prueba', now)), parent: 'r1' }
  const grand = { ...work(newBeat('g1', 'Sugerencia B', now)), parent: 'c1' }
  oldList(serve(on, [grand, root, child].map((b, i) => ({ ...b, slot: i }))).store)
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  const keys = (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick-'))
  expect([keys.indexOf('btns-pick-c1'), keys.indexOf('btns-pick-g1')]).toEqual([keys.indexOf('btns-pick-r1') + 1, keys.indexOf('btns-pick-r1') + 2])
  const indent = async (id: string) => (await ui.findAll({ type: 'Box' })).find(b => b.key === `indent-${id}`)?.props.width ?? 0
  expect([await indent('c1'), await indent('g1')]).toEqual([2, 4])
  expect([await rowHas(ui, 'c1', /^↳ Prueba$/), await rowHas(ui, 'g1', /^↳ Sugerencia B$/), await rowHas(ui, 'c1', /Encargado/), await rowHas(ui, 'c1', /coordina 1 sesión/), await rowHas(ui, 'r1', /coordina 1 sesión/)]).toEqual([true, true, false, true, true])
  expect((await ui.findAll({ type: 'Text', text: /^SIN ACTIVIDAD O LISTAS$/ })).length).toBe(0) // the idle child left no group behind
})

// G6: a session started from another one may get no prompt for a while; the listener every session runs (not the pane's
// ticker) looks the link up, so its records written late are still found, a look every 5 s while the session is fresh.
test('G6: records written 30 s after the start are found by the listener: parent and local learned, a glass room with ↗ Ir al chat', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), now = clock.now()
  const parent = newBeat('cli-parent', 'padre', now)
  setAgent(parent, MAIN, now, { state: 'trabajando', activity: 'Bash ls' })
  const child = { ...newBeat('s-test', 'hija', now), ask: { id: 'toolu_g6', q: '¿Sigo?', replies: [{ label: 'Sí', text: 'Sí, sigue' }] } }
  const records: Record<string, string> = {}
  const { greps, files, store } = serve(on, [parent, child].map((b, i) => ({ ...b, slot: i })), records); oldList(store)
  await startSession($); await clock.settle()
  expect([greps.length, beatOf(files).parent, beatOf(files).local]).toEqual([1, undefined, undefined])
  await clock.advance(30000)
  records[`ab/cd/${LOCAL}.json`] = rec({ sessionId: LOCAL, cliSessionId: 's-test', spawnedFrom: { sessionId: 'local_p-1' } })
  records['ab/cd/local_p-1.json'] = rec({ sessionId: 'local_p-1', cliSessionId: 'cli-parent' })
  for (let i = 0; i < 6; i++) await clock.advance(1000) // +36 s, no prompt submitted
  const looks = greps.length
  expect([beatOf(files).parent, beatOf(files).local, looks >= 6 && looks <= 8]).toEqual(['cli-parent', LOCAL, true]) // a look every 5 s while fresh
  for (let i = 0; i < 54; i++) await clock.advance(1000)
  expect(greps).toHaveLength(looks) // both known: no more looks
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  for (let i = 0; i < 4; i++) await clock.advance(1000)
  // in its parent's family (its row, waiting for you in Te esperan, names the parent; the parent's row counts it), so its
  // room is in the parent's block
  expect([await rowHas(ui, 's-test', / · de padre · /), await rowHas(ui, 'cli-parent', /coordina 1 sesión/)]).toEqual([true, true])
  await ui.press({ key: 'pick-s-test' })
  expect((await ui.findAll({ type: 'Client' })).some(c => c.key === 'btns-chatlink-s-test~0')).toBe(true)
  await ui.unmount()
})

// Y-A: an archived chat leaves the map and the list (the app sets isArchived in its record); unarchived, it comes back.
test('Y-A: an archived session leaves the list within a minute, by a find and a read of its record; unarchived it comes back', async ($, on) => {
  const clock = mock.clock(on, { now: 10_000_000 }), now = clock.now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const L2 = `local_${UUID.replace('0a', '0c')}`
  const a = { ...work(newBeat('a1', 'activa', now)), local: LOCAL }
  const z = { ...newBeat('z1', 'archivada', now - 1000), local: L2, ended: true, endReason: 'other' } // archived: the app ended it
  const records: Record<string, string> = {
    [`ab/cd/${LOCAL}.json`]: rec({ sessionId: LOCAL, cliSessionId: 'a1', isArchived: false }),
    [`ab/ef/${L2}.json`]: rec({ sessionId: L2, cliSessionId: 'z1', isArchived: true }),
  }
  const { finds, heads, store } = serve(on, [a, z].map((b, i) => ({ ...b, slot: i })), records); oldList(store)
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  const rows = async () => (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick-'))
  for (let i = 0; i < 4; i++) await clock.advance(1000)
  expect(await rows()).toEqual(['btns-pick-a1'])
  expect(finds).toEqual([['/usr/bin/find', RECORDS, '-mindepth', '3', '-maxdepth', '3', '-type', 'f', '(', '-name', `${LOCAL}.json`, '-o', '-name', `${L2}.json`, ')']])
  expect(heads.filter(ht => ht.endsWith(`${L2}.json`))).toEqual([`${RECORDS}/ab/ef/${L2}.json`])
  for (let i = 0; i < 30; i++) await clock.advance(1000)
  expect(finds).toHaveLength(1) // once a minute at most
  records[`ab/ef/${L2}.json`] = rec({ sessionId: L2, cliSessionId: 'z1', big: 'x'.repeat(250000) }) // cut short, no flag: the last answer stays
  for (let i = 0; i < 35; i++) await clock.advance(1000)
  expect([finds.length, await rows()]).toEqual([2, ['btns-pick-a1']])
  records[`ab/ef/${L2}.json`] = rec({ sessionId: L2, cliSessionId: 'z1', isArchived: false }) // unarchived in the app
  for (let i = 0; i < 60; i++) await clock.advance(1000)
  expect([finds.length, (await rows()).sort()]).toEqual([3, ['btns-pick-a1', 'btns-pick-z1']])
  await ui.unmount()
})

// AB2: with the store flag `list-hit-layer` (on unless stored false since AH) the list is drawn in the pane as today,
// under ONE in-flow Client, `btns-pick`, of invisible hit rows; off (/agentville capa de clics), a Client a row.
type N = { type?: string; props?: Record<string, unknown> & { key?: string }; children?: unknown[] }
const nodesOf = (n: unknown): N[] => (n && typeof n === 'object' ? [n as N, ...((n as N).children ?? []).flatMap(nodesOf)] : [])
const textOf = (n: N): string => (n.type === 'Button' ? String(n.props?.label ?? '') : (n.children ?? []).map(x => (typeof x === 'string' ? x : '')).join(''))
const openList = async ($: Engine) => {
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } })
  return $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
}
const hitItems = async (ui: Mounted<'desktop', 'Pane'>) => ((await ui.find({ type: 'Client', key: 'btns-pick' }))?.props.props as BtnsProps | undefined)?.items ?? []
const hitIds = async (ui: Mounted<'desktop', 'Pane'>) => (await hitItems(ui)).filter(it => it.key.startsWith('pick-')).map(it => it.key.slice('pick-'.length))
const drawnRows = async (ui: Mounted<'desktop', 'Pane'>) => (nodesOf(await ui.drawn()).find(n => n.props?.key === 'list-drawn')?.children ?? []) as N[]
const card = async (ui: Mounted<'desktop', 'Pane'>, id: string) => nodesOf(await ui.drawn()).find(n => n.props?.key === `item-${id}`)
const many = (now: number) => {
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  return [...Array.from({ length: 22 }, (_, i) => work(newBeat(`w${i}`, `sesión ${i}`, now - i))), { ...work(newBeat('k1', 'hija', now)), parent: 'w3' },
    ...[1, 2, 3].map(i => { const b = newBeat(`q${i}`, `quieta ${i}`, now - 100 - i); setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }); return b })]
}
const placed = (list: Beat[]) => list.map((b, i) => ({ ...b, slot: i % 16, floor: Math.floor(i / 16) }))

test('AH: a fresh store draws the hit layer (one btns-pick); capa de clics gives a Client a row, again the layer is back', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const { store } = serve(on, placed(many(now)))
  const pick = async (ui: Mounted<'desktop', 'Pane'>) => (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-pick'))
  const toggle = async () => (await $.command.run({ command: 'agentville', args: 'capa de clics', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 110 } }))?.text
  let ui = await openList($)
  expect(['list-hit-layer' in store, await pick(ui), (await drawnRows(ui)).length > 0]).toEqual([false, ['btns-pick'], true])
  await ui.unmount()
  expect([await toggle(), store['list-hit-layer']]).toEqual(['Clics de la lista: modo de antes, cada fila recibe su propio clic (se recuerda). Repite el comando para volver al normal.', false])
  ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  const rows = await pick(ui)
  expect([rows.includes('btns-pick'), rows.length, await drawnRows(ui)]).toEqual([false, 26, []]) // today's per-row Clients
  await ui.unmount()
  expect([await toggle(), store['list-hit-layer']]).toEqual(['Clics de la lista: de vuelta al modo normal, la lista se ve igual (se recuerda). Repite el comando para volver al de antes.', true])
  ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  expect(await pick(ui)).toEqual(['btns-pick'])
  await ui.unmount()
})

test('AB2: on, 26 sessions draw exactly one list Client within CLIENT_MAX; rows 1, 10 and 20 select on one press; a stray key does nothing', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  serve(on, placed(many(now)))
  const ui = await openList($)
  const clients = (await ui.findAll({ type: 'Client' })).map(c => c.key!)
  expect([clients.filter(k => k.startsWith('btns-pick')), clients.length <= CLIENT_MAX]).toEqual([['btns-pick'], true])
  const ids = await hitIds(ui)
  expect(ids).toHaveLength(26)
  for (const n of [1, 10, 20]) {
    const id = ids[n - 1]!
    await ui.press({ key: `pick-${id}` })
    expect([n, (await card(ui, id))?.props!.borderColor === (await card(ui, ids[n % 26]!))?.props!.borderColor, (await ui.findAll({ type: 'Client' })).some(c => c.key === `field-${id}`)]).toEqual([n, false, true])
  }
  const before = JSON.stringify(await ui.drawn())
  for (const press of ['pick-nobody', 'hits-1', 5]) await ui.post({ press }, { in: 'btns-pick' })
  expect(JSON.stringify(await ui.drawn())).toBe(before)
  await ui.unmount()
})

test('AB2: on, the drawn rows and the hit rows have the same keys, heights and order; a selected child lines up; it looks as today', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  serve(on, placed(many(now)))
  const ui = await openList($)
  await ui.press({ key: 'pick-k1' }) // the child, selected
  const items = await hitItems(ui), drawn = await drawnRows(ui)
  const hitRoot = nodesOf(await ui.drawn({ in: 'btns-pick' }))[0]!, hits = (hitRoot.children ?? []) as N[]
  expect([hitRoot.props!.gap, nodesOf(await ui.drawn()).find(n => n.props?.key === 'list-drawn')!.props!.gap]).toEqual([0, undefined]) // no gap on either side
  expect([drawn.length, hits.length]).toEqual([items.length, items.length])
  for (const [i, it] of items.entries()) {
    expect([it.key, Number.isInteger(it.cells)]).toEqual([it.key, true]) // whole cells only: a Client on the desktop drops a fraction
    expect([drawn[i]!.props!.key, drawn[i]!.props!.height, hits[i]!.props!.key, hits[i]!.props!.height]).toEqual([`li-${it.key}`, it.cells, `i-${it.key}`, it.cells])
    // a pressable row: one invisible cover Button per cell, all posting its key; a header: none
    const covers = nodesOf(hits[i]).filter(n => n.type === 'Button')
    expect([it.key, covers.length, covers.every(b => /^\u3164+$/.test(textOf(b)))]).toEqual([it.key, it.head ? 0 : it.cells, true])
  }
  const top = (k: string, col: N[]) => col.slice(0, col.findIndex(n => String(n.props!.key).endsWith(k))).reduce((y, n) => y + Number(n.props!.height), 0)
  for (const k of ['pick-k1', 'pick-w3', 'pick-w0', 'pick-q3']) expect([k, top(k, drawn)]).toEqual([k, top(k, hits)])
  // today's look: the rounded card on the selected row only, the stripe and the face as Svgs, ↳ and the indent on the child,
  // the name and its line as pane Text that take the rest of the row and end in "…"
  const k1 = (await card(ui, 'k1'))!, w3 = (await card(ui, 'w3'))!
  expect([k1.props!.borderStyle, k1.props!.backgroundColor !== undefined, w3.props!.backgroundColor]).toEqual(['round', true, undefined])
  expect(nodesOf(k1).filter(n => n.type === 'Svg').length).toBe(2) // stripe and face
  expect(nodesOf(k1).find(n => n.props?.key === 'indent-k1')?.props!.width).toBe(2)
  const texts = nodesOf(k1).filter(n => n.type === 'Text')
  expect([textOf(texts[0]!), texts.map(x => x.props!.wrap)]).toEqual(['↳ hija', ['truncate-end', 'truncate-end']])
  const col = nodesOf(k1).find(n => (n.children ?? []).includes(texts[0] as never))!
  expect([col.props!.width, col.props!.flexGrow]).toEqual([0, 1])
  await ui.unmount()
})

test('AB2: on, 7 idle sessions: Ver N más is drawn and hit with the same h; a press grows both sides and says Ver menos', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  serve(on, placed(Array.from({ length: 7 }, (_, i) => { const b = newBeat(`i${i}`, `quieta ${i}`, now - i); setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }); return b })))
  const ui = await openList($)
  const both = async () => {
    const items = await hitItems(ui), drawn = await drawnRows(ui), more = items.find(it => it.key === 'idle-more')
    return [items.length, drawn.length, more?.cells, drawn.find(n => n.props!.key === 'li-idle-more')?.props!.height, textOf(nodesOf(await ui.drawn()).find(n => n.props?.key === 'idle-more-label') ?? {})]
  }
  await ui.press({ key: 'pick-i0' }) // a selection among the first five: no extra row
  expect(await both()).toEqual([7, 7, 1, 1, 'Ver 2 más']) // a header, 5 rows, the item
  await ui.press({ key: 'idle-more' })
  expect(await both()).toEqual([9, 9, 1, 1, 'Ver menos'])
  await ui.unmount()
})

test('AB2: on, 45 sessions page by LIST_MAX rows; the selected last one stays on the first page; a new wait shows the first page', async ($, on) => {
  const clock = mock.clock(on, { now: 10_000_000 }), now = clock.now()
  const served = placed(Array.from({ length: 45 }, (_, i) => { const b = newBeat(`w${i}`, `sesión ${i}`, now - i); setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }); return b }))
  serve(on, served)
  const ui = await openList($)
  const label = async () => textOf(nodesOf(await ui.drawn()).find(n => n.props?.key === 'list-more-label') ?? {})
  const selected = async () => { const all = nodesOf(await ui.drawn()); return (await hitIds(ui)).filter(id => all.find(n => n.props?.key === `item-${id}`)?.props!.backgroundColor !== undefined) }
  const sel0 = await selected(), left = 45 - sel0.length - LIST_MAX // the pane may open with one selected: always drawn, never counted
  const first = await hitIds(ui)
  expect([first.length, (await hitItems(ui)).at(-1)?.key, await label()]).toEqual([LIST_MAX + sel0.length, 'list-more', 'Siguientes sesiones'])
  await ui.press({ key: 'list-more' })
  const second = (await hitIds(ui)).filter(id => !sel0.includes(id))
  expect([second.length, second.some(id => first.includes(id)), await label()]).toEqual([left, false, 'Volver a las primeras sesiones'])
  const last = second.at(-1)!
  await ui.press({ key: `pick-${last}` })
  await ui.press({ key: 'list-more' }) // back to the first page: the selected one drawn too, never counted
  const back = await hitIds(ui)
  expect([back.length, back.includes(last), await selected(), await label()]).toEqual([LIST_MAX + 1, true, [last], 'Siguientes sesiones'])
  await ui.press({ key: 'list-more' })
  const w = served.find(b => b.id === first.find(id => !sel0.includes(id) && id !== last))!
  setAgent(w, MAIN, clock.now(), { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r-ab' })
  w.at = clock.now()
  await clock.advance(3100)
  await ui.redraw()
  expect([await label(), (await hitItems(ui))[0]?.key, (await hitIds(ui)).includes(w.id)]).toEqual(['Siguientes sesiones', 'head-waiting', true])
  await ui.unmount()
})

// Y-B: a new child joins its parent's block quickly and reliably, whatever order and size the app writes its records in.
const CHILD_REC = rec({ sessionId: LOCAL, cliSessionId: 's-test', spawnedFrom: { sessionId: 'local_p-1' } })
const PARENT_REC = rec({ sessionId: 'local_p-1', cliSessionId: 'cli-parent' })
test('Y-B1: a child whose records are written 20 s after its start is linked within 25 s', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const records: Record<string, string> = {}
  const { files } = serve(on, [], records)
  await startSession($); await clock.settle()
  for (let i = 0; i < 20; i++) await clock.advance(1000)
  Object.assign(records, { [`ab/cd/${LOCAL}.json`]: CHILD_REC, 'ab/cd/local_p-1.json': PARENT_REC })
  for (let i = 0; i < 5; i++) await clock.advance(1000)
  expect([beatOf(files).parent, beatOf(files).local]).toEqual(['cli-parent', LOCAL])
})

test('Y-B2: a record that names its parent only after 15 minutes still links: no try is spent while it names none', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const records: Record<string, string> = { [`ab/cd/${LOCAL}.json`]: rec({ sessionId: LOCAL, cliSessionId: 's-test' }), 'ab/cd/local_p-1.json': PARENT_REC }
  const { greps, files } = serve(on, [], records)
  await startSession($); await clock.settle()
  for (let i = 0; i < 15; i++) await clock.advance(60000)
  expect([beatOf(files).local, beatOf(files).parent, greps.length]).toEqual([LOCAL, undefined, 1]) // its own record, read by its path
  records[`ab/cd/${LOCAL}.json`] = CHILD_REC
  await clock.advance(60000)
  expect(beatOf(files).parent).toBe('cli-parent')
})

test('Y-B2: a parent named but its record not ready spends no try while fresh, then a try a look, 10 at most', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { heads, files } = serve(on, [], { [`ab/cd/${LOCAL}.json`]: CHILD_REC, 'ab/cd/local_p-1.json': rec({ sessionId: 'local_p-1' }) })
  const parentReads = () => heads.filter(ht => ht.endsWith('/local_p-1.json')).length
  await startSession($); await clock.settle()
  for (let i = 0; i < 6; i++) await clock.advance(60000)
  const fresh = parentReads()
  for (let i = 0; i < 20; i++) await clock.advance(60000)
  expect([beatOf(files).local, beatOf(files).parent, fresh > 50, parentReads() - fresh]).toEqual([LOCAL, undefined, true, 9]) // the first of the 10 tries fell in the sixth minute
})

test('Y-B3: five other records that name the session, listed first, never crowd its own out', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const others = Object.fromEntries([1, 2, 3, 4, 5].map(i => [`aa/bb/local_o${i}.json`, rec({ sessionId: `local_o${i}`, cliSessionId: `o${i}`, note: 's-test' })]))
  const { files } = serve(on, [], { ...others, [`ab/cd/${LOCAL}.json`]: CHILD_REC, 'ab/cd/local_p-1.json': PARENT_REC })
  await startSession($); await clock.settle()
  expect([beatOf(files).parent, beatOf(files).local]).toEqual(['cli-parent', LOCAL])
})

test('Y-B4: records over RECORD_MAX (cut, so no JSON) still give the link, read by field', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const big = (o: object) => rec({ ...o, toolSurfaceSnapshot: { x: 'y'.repeat(250000) } })
  const { files } = serve(on, [], {
    [`ab/cd/${LOCAL}.json`]: big({ sessionId: LOCAL, cliSessionId: 's-test', spawnedFrom: { sessionId: 'local_p-1', taskId: 't' } }),
    'ab/cd/local_p-1.json': big({ sessionId: 'local_p-1', cliSessionId: 'cli-parent' }),
  })
  await startSession($); await clock.settle()
  expect([beatOf(files).parent, beatOf(files).local]).toEqual(['cli-parent', LOCAL])
})

test('Y-B fix: a parent record that is not readable for 2 minutes spends no try while fresh; the child links once it is', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const records: Record<string, string> = { [`ab/cd/${LOCAL}.json`]: CHILD_REC }
  const { files } = serve(on, [], records)
  await startSession($); await clock.settle()
  for (let i = 0; i < 120; i++) await clock.advance(1000)
  expect([beatOf(files).local, beatOf(files).parent]).toEqual([LOCAL, undefined])
  records['ab/cd/local_p-1.json'] = PARENT_REC
  for (let i = 0; i < 6; i++) await clock.advance(1000)
  expect(beatOf(files).parent).toBe('cli-parent')
})

test('Y-B fix: a root session stops reading its own record 20 minutes after its first look', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { heads, files } = serve(on, [], { [`ab/cd/${LOCAL}.json`]: rec({ sessionId: LOCAL, cliSessionId: 's-test' }) })
  await startSession($); await clock.settle()
  for (let i = 0; i < 21; i++) await clock.advance(60000)
  const n = heads.length
  for (let i = 0; i < 10; i++) await clock.advance(60000)
  expect([beatOf(files).local, heads.length, n < 100]).toEqual([LOCAL, n, true])
})

// AG: the ↗ on a list row opens that session's chat on one press and selects nothing; a session with no chat link has none.
test('AG: on, ↗ sits in the row\'s last CHAT_W cells on both sides; tochat opens the chat and toasts, the selection stays; no link, no ↗', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const { opens, toasts } = serve(on, placed([{ ...work(newBeat('c1', 'con chat', now)), local: LOCAL }, work(newBeat('c2', 'sin chat', now - 1))]))
  const ui = await openList($)
  await ui.press({ key: 'pick-c2' })
  const items = await hitItems(ui), drawn = await drawnRows(ui)
  expect([items.find(it => it.key === 'pick-c1')?.chat, items.find(it => it.key === 'pick-c2')?.chat]).toEqual(['tochat-c1', undefined])
  const li = (k: string) => drawn.find(n => n.props!.key === `li-${k}`)!
  const mark = nodesOf(li('pick-c1')).find(n => n.props?.key === 'chatmark-pick-c1')!
  // the drawn ↗: laid on the row Box itself (no padding, no border: the hit Client's width), its right edge the list's
  expect([li('pick-c1').props!.position, mark.props!.position, mark.props!.right, mark.props!.width, textOf(nodesOf(mark).find(n => n.type === 'Text')!)]).toEqual(['relative', 'absolute', 0, CHAT_W, '↗'])
  expect(nodesOf(await card(ui, 'c1')).find(n => n.props?.key === 'chatgap-c1')?.props!.width).toBe(CHAT_W) // the name ends before it
  expect([nodesOf(li('pick-c2')).some(n => n.props?.key === 'chatmark-pick-c2'), nodesOf(await card(ui, 'c2')).some(n => n.props?.key === 'chatgap-c2')]).toEqual([false, false])
  // the selected row: its name has no ✓, its column the same as an unselected row's, so the names line up
  const nameOf = async (id: string) => { const k = (await card(ui, id))!; const col = nodesOf(k).find(n => n.props?.width === 0 && n.props?.flexGrow === 1)!; return [textOf(nodesOf(col).find(n => n.type === 'Text')!), nodesOf(k).indexOf(col)] }
  expect([await nameOf('c2'), await nameOf('c1')]).toEqual([['sin chat', 5], ['con chat', 5]])
  const sel = (await card(ui, 'c2'))!.props!.backgroundColor
  await ui.press({ key: 'tochat-c1' })
  expect([opens, toasts.at(-1)]).toEqual([[['/usr/bin/open', `claude://claude.ai/epitaxy/${LOCAL}`]], 'Abriendo el chat de con chat'])
  expect([(await card(ui, 'c2'))!.props!.backgroundColor, (await card(ui, 'c1'))!.props!.backgroundColor, sel !== undefined]).toEqual([sel, undefined, true]) // still c2
  await ui.unmount()
})

test('AG: off (the per-row Clients), a row with a chat link gets the ↗ in its own Client, and a press opens the chat', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const { opens, store } = serve(on, placed([{ ...work(newBeat('c1', 'con chat', now)), local: LOCAL }, work(newBeat('c2', 'sin chat', now - 1))])); oldList(store)
  const ui = await openList($)
  const itemOf = async (id: string) => ((await ui.find({ type: 'Client', key: `btns-pick-${id}` }))?.props.props as BtnsProps).items[0]!
  expect([(await itemOf('c1')).chat, (await itemOf('c2')).chat]).toEqual(['tochat-c1', undefined])
  await ui.post({ press: 'tochat-c1' }, { in: 'btns-pick-c1' })
  expect(opens).toEqual([['/usr/bin/open', `claude://claude.ai/epitaxy/${LOCAL}`]])
  await ui.unmount()
})

test('AG: the detail header\'s face opens the chat on one press (one Client, whole cells, apart from the name), the selection stays; no link, no zone', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const { opens } = serve(on, placed([{ ...work(newBeat('c1', 'con chat', now)), local: LOCAL }, work(newBeat('c2', 'sin chat', now - 1))]))
  const ui = await openList($)
  await ui.press({ key: 'pick-c2' })
  expect((await ui.findAll({ type: 'Client' })).some(c => c.key === 'btns-face-c2')).toBe(false)
  await ui.press({ key: 'pick-c1' })
  const zone = nodesOf(await ui.drawn()).find(n => n.props?.key === 'facechat-c1')!
  const items = ((await ui.find({ type: 'Client', key: 'btns-face-c1' }))!.props.props as BtnsProps).items
  expect([items.map(it => [it.key, it.cells]), Number.isInteger(zone.props!.width), nodesOf(zone).some(n => n.type === 'Text')]).toEqual([[['face-chat', 2]], true, false]) // the name is not in it
  const lines = nodesOf(await ui.drawn({ in: 'btns-face-c1' })).filter(n => n.type === 'Box' && n.props?.height === 1)
  expect(lines.map(n => [n.props!.flexShrink, n.props!.overflow])).toEqual([[0, 'hidden'], [0, 'hidden']])
  await ui.post({ press: 'face-chat' }, { in: 'btns-face-c1' })
  expect(opens).toEqual([['/usr/bin/open', `claude://claude.ai/epitaxy/${LOCAL}`]])
  expect([(await card(ui, 'c1'))!.props!.backgroundColor !== undefined, (await ui.findAll({ type: 'Client' })).some(c => c.key === 'field-c1')]).toEqual([true, true]) // still c1
  await ui.unmount()
})

// AJ: the family stays together. A child is drawn under its parent, in the parent's group, whatever its own state; a
// child that waits for you is drawn once, in Te esperan, apart ("de <parent>"); group counts count the rows shown.
test('AJ: famGroups puts a child in its parent\'s group, a waiting one in Te esperan, recursively; a cycle stays in place', () => {
  const st: Record<string, 'waiting' | 'working' | 'idle'> = { r: 'working', c: 'idle', g: 'idle', w: 'waiting', wk: 'idle', s: 'idle', x: 'idle', y: 'working' }
  const all = [{ id: 'g', parent: 'r', from: 'c' }, { id: 'w', parent: 'r' }, { id: 's' }, { id: 'c', parent: 'r' }, { id: 'r' }, { id: 'wk', parent: 'w' },
    { id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }]
  const got = famGroups(all, d => st[d.id]!).map(([g, l]) => [g, famDepths(l).map(([d, k]) => `${d.id}${k}`)])
  // the cycle: x (idle) follows y to Trabajando; y, back at x, stops at its own state; each drawn once
  expect(got).toEqual([['waiting', ['w0', 'wk1']], ['working', ['r0', 'c1', 'g2', 'x0', 'y1']], ['idle', ['s0']]])
})

test('AJ: famCut keeps whole families before the idle cut and the selected row past it', () => {
  const ids = (l: { id: string }[]) => l.map(d => d.id)
  const tree = famTree([{ id: 'a' }, { id: 'b' }, { id: 'p' }, { id: 'c1', parent: 'p' }, { id: 'c2', parent: 'p' }, { id: 'd' }, { id: 'e' }])
  expect(ids(famCut(tree, 3, () => false))).toEqual(['a', 'b', 'p', 'c1', 'c2']) // p is the third row: its family whole
  expect(ids(famCut(tree, 4, () => false))).toEqual(['a', 'b', 'p', 'c1', 'c2']) // the cut falls inside the family: not split
  expect(ids(famCut(tree, 2, d => d.id === 'c2'))).toEqual(['a', 'b', 'c2']) // the selected child past the cut, alone
  expect(ids(famCut([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 5, () => false))).toEqual(['a', 'b', 'c'])
})

const headOf = async (ui: Mounted<'desktop', 'Pane'>, gid: string) => {
  const row = nodesOf(await ui.drawn()).find(n => n.props?.key === `li-head-${gid}`)
  return row ? nodesOf(row).filter(n => n.type === 'Text').map(textOf).join(' ') : undefined
}
const lineOf = async (ui: Mounted<'desktop', 'Pane'>, id: string) => nodesOf(await card(ui, id)).filter(n => n.type === 'Text').map(textOf)
const sameRows = async (ui: Mounted<'desktop', 'Pane'>) => {
  const items = await hitItems(ui), drawn = await drawnRows(ui), hits = (nodesOf(await ui.drawn({ in: 'btns-pick' }))[0]!.children ?? []) as N[]
  return [drawn.map(n => n.props!.key), hits.map(n => n.props!.key)].join('|') === [items.map(it => `li-${it.key}`), items.map(it => `i-${it.key}`)].join('|')
}

test('AJ: a working parent keeps its idle children under it in Trabajando; the idle count leaves them out; hit rows match', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const done = (b: Beat) => (setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }), b)
  const list = [done(newBeat('i1', 'sola', now)), { ...done(newBeat('c1', 'hija', now)), parent: 'p1' }, work(newBeat('p1', 'padre', now)), { ...done(newBeat('c2', 'otra hija', now)), parent: 'p1' }]
  serve(on, placed(list))
  const ui = await openList($)
  expect((await hitItems(ui)).map(it => it.key)).toEqual(['head-working', 'pick-p1', 'pick-c1', 'pick-c2', 'head-idle', 'pick-i1'])
  expect([await headOf(ui, 'working'), await headOf(ui, 'idle')]).toEqual(['TRABAJANDO 3', 'SIN ACTIVIDAD O LISTAS 1'])
  const c1 = await lineOf(ui, 'c1')
  expect([c1[0], /Encargado/.test(c1[1]!), / · terminó/.test(c1[1]!)]).toEqual(['↳ hija', false, true])
  expect(nodesOf(await card(ui, 'c2')).find(n => n.props?.key === 'indent-c2')?.props!.width).toBe(2)
  expect(await sameRows(ui)).toBe(true)
  await ui.unmount()
})

test('AJ: a waiting child shows once in Te esperan, "de <parent>"; it goes back under its parent once it stops waiting', async ($, on) => {
  const clock = mock.clock(on, { now: 10_000_000 }), now = clock.now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const kid = { ...work(newBeat('c1', 'hija', now)), parent: 'p1' }
  setAgent(kid, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r-aj' })
  const served = placed([work(newBeat('p1', 'padre', now)), kid])
  serve(on, served)
  const ui = await openList($)
  expect((await hitItems(ui)).map(it => it.key)).toEqual(['head-waiting', 'pick-c1', 'head-working', 'pick-p1'])
  expect([await headOf(ui, 'waiting'), await headOf(ui, 'working')]).toEqual(['TE ESPERAN 1', 'TRABAJANDO 1'])
  const line = await lineOf(ui, 'c1')
  expect([line[0], /^\S+ · de padre · .*pnpm test/.test(line[1]!), nodesOf(await card(ui, 'c1')).some(n => n.props?.key === 'indent-c1')]).toEqual(['hija', true, false])
  expect(await sameRows(ui)).toBe(true)
  const back = served.find(b => b.id === 'c1')!
  setAgent(back, MAIN, clock.now(), { state: 'trabajando', activity: 'Bash ls' })
  back.at = clock.now()
  await clock.advance(3100)
  await ui.redraw()
  expect((await hitItems(ui)).map(it => it.key)).toEqual(['head-working', 'pick-p1', 'pick-c1'])
  expect([(await lineOf(ui, 'c1'))[0], await headOf(ui, 'working'), await sameRows(ui)]).toEqual(['↳ hija', 'TRABAJANDO 2', true])
  await ui.unmount()
})

test('AK: a waiting child says "of <parent>" in English, and names no parent the list does not know', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const work = (b: Beat) => (setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' }), b)
  const wait = (b: Beat, req: string) => (setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req }), b)
  const { store } = serve(on, placed([work(newBeat('p1', 'padre', now)), { ...wait(newBeat('c1', 'hija', now), 'r1'), parent: 'p1' }, { ...wait(newBeat('c2', 'huérfana', now), 'r2'), parent: 'gone' }]))
  store.lang = 'en'
  const ui = await openList($)
  const [kid, orphan] = [(await lineOf(ui, 'c1'))[1]!, (await lineOf(ui, 'c2'))[1]!]
  expect([/ · of padre · /.test(kid), /\bof\b|\bde\b/.test(orphan.split(' · ').slice(0, 2).join(' · '))]).toEqual([true, false])
  await ui.unmount()
})

test('AK: a waiting child under a waiting parent shows once, nested, with no "de <parent>"', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const wait = (b: Beat, req: string) => (setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req }), b)
  serve(on, placed([wait(newBeat('p1', 'padre', now), 'r1'), { ...wait(newBeat('c1', 'hija', now), 'r2'), parent: 'p1' }]))
  const ui = await openList($)
  expect((await hitItems(ui)).map(it => it.key)).toEqual(['head-waiting', 'pick-p1', 'pick-c1'])
  const line = await lineOf(ui, 'c1')
  expect([line[0], / de padre/.test(line[1]!), await headOf(ui, 'waiting')]).toEqual(['↳ hija', false, 'TE ESPERAN 2'])
  await ui.unmount()
})

test('AJ: an idle family before the idle cut is drawn whole; Ver N más counts the rows past it', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const done = (b: Beat) => (setAgent(b, MAIN, now, { state: 'terminado', activity: 'Te respondió' }), b)
  const list = [...[1, 2, 3, 4].map(i => done(newBeat(`i${i}`, `sola${i}`, now - i))), done(newBeat('p1', 'padre', now - 5)),
    { ...done(newBeat('c1', 'hija', now - 6)), parent: 'p1' }, { ...done(newBeat('c2', 'hija 2', now - 7)), parent: 'p1' }, done(newBeat('z1', 'última', now - 8))]
  serve(on, placed(list))
  const ui = await openList($)
  await ui.press({ key: 'pick-i1' })
  const ids = await hitIds(ui)
  expect([ids.includes('c1'), ids.includes('c2'), ids.includes('z1')]).toEqual([true, true, false]) // the fifth family whole, the sixth cut
  expect(textOf(nodesOf(await ui.drawn()).find(n => n.props?.key === 'idle-more-label') ?? {})).toBe('Ver 1 más')
  expect(await headOf(ui, 'idle')).toBe('SIN ACTIVIDAD O LISTAS 8')
  await ui.unmount()
})
