import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

import { FILL_MAX, MAIN, OFFER_ORDER_MS, TASK, fillTextOf, newBeat, offerOrderOk, setAgent, signOf } from '../hooks/beat'
import type { Beat, Cmd } from '../hooks/beat'

// Batch I: Arrancar or Descartar on another session's suggestion goes as a signed order to that session's mailbox; the
// session that offered it acts as itself and answers in the store's offer-acks. Batch M: Arrancar sends nothing; it
// opens that session's chat, where the app's card is, and an older pane's start order acks gone. Batch N: before that chat
// opens, a signed fill order (task id only) has the offering session write a fixed line into its own empty prompt box,
// never sent; this pane's own session fills its own box directly. The kit runs one engine
// per test, so the two halves are tested apart: the executor (the kit as the offering session) and the pane (the kit as
// another session).
const HOME = '/home/test/.claude/agentville'
const START_TOOL = 'mcp__ccd_session__start_session', DISMISS_TOOL = 'mcp__ccd_session__dismiss_task'
const LOCAL_ID = 'local_0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const CONSENT_DISMISS = 'The user pressed "Descartar" (dismiss) on a suggested session in Agentville.'

// The heartbeat folder, the store and the panes from memory, as pane.shared.tsx serves them; `tools` answers the
// app's session tools (every call recorded); `submit` answers $.prompt.submit (every prompt recorded in `typed`); every
// process run is recorded in `ran`, and /usr/bin/open exits with `exit.code`.
type Submit = (e: { text: string }) => unknown
function serve(on: On, list: Beat[], answer: (e: Record<string, unknown>) => unknown = () => ({ result: 'ok', text: '' })) {
  const typed: { text: string; asUser: unknown }[] = [], sub: { answer: Submit } = { answer: e => ({ text: e.text }) }
  on('prompt.submit', async ($, e) => { typed.push({ text: e.text, asUser: (e.origin as { asUser?: unknown }).asUser }); return await sub.answer(e) as never })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/home/test/proj' }))
  on('session.surfaces', () => ({ value: [] }))
  on('session.id', () => ({ value: 's-test' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  const panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  on('ui.open', ($, e) => { if (!panes.some(x => x.id === e.id)) panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [...panes] }))
  on('ui.close', ($, e) => { const i = panes.findIndex(x => x.id === e.id); if (i >= 0) panes.splice(i, 1); return { value: undefined } })
  const ran: string[][] = [], exit = { code: 1 }, boxedAtOpen: string[][] = []
  on('process.run', ($, e) => { ran.push([...e.argv]); if (e.argv[0] === '/usr/bin/open') boxedAtOpen.push(Object.keys(files).filter(k => k.includes('/control/'))); return { value: { exitCode: e.argv[0] === '/usr/bin/open' ? exit.code : 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } })
  on('env.get', () => ({ value: '/home/test' }))
  const store: Record<string, unknown> = { 'intro-done': true, lang: 'es' } // these tests read the Spanish copy; English is the default
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  const holds: Record<string, () => Promise<void>> = {} // a key's next read waits on this
  on('store.get', async ($, e) => { const h = holds[e.key]; if (h) { delete holds[e.key]; await h() } return { value: store[e.key] } })
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  on('fs.list', () => ({ value: list.map(b => ({ name: `${b.id}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  const files: Record<string, string> = {}
  on('fs.write', ($, e) => { files[String(e.path)] = String(e.text); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  on('fs.read', ($, e) => ({ value: files[String(e.path)] ?? JSON.stringify(list.find(b => String(e.path).endsWith(`/sessions/${b.id}.json`))) ?? '' }))
  on('fs.stat', ($, e) => { const p = String(e.path); if (!(p in files)) throw new Error(`ENOENT: ${p}`); return { value: { kind: 'file', size: files[p]!.length, mtimeMs: 0, isLink: false } } })
  const calls: Record<string, unknown>[] = []
  on('tool.list', () => ({ value: [{ name: START_TOOL, description: '', mcp: true }, { name: DISMISS_TOOL, description: '', mcp: true }] }))
  on('tool.call', async ($, e) => { calls.push(e as never); return await answer(e as never) as never })
  // This session's own prompt box: `draft.refuse` answers a fill as a hook's refusal, `draft.broken` makes the read throw;
  // every fill recorded in `fills`, and every box (other sessions') written before /usr/bin/open in `boxedAtOpen`.
  const draft = { text: '', refuse: false, broken: false }, fills: { text: string; mode: string }[] = []
  on('prompt.read', () => { if (draft.broken) throw new Error('no box'); return { value: { text: draft.text, cursor: draft.text.length } } })
  on('prompt.fill', ($, e) => {
    fills.push({ text: e.text, mode: e.mode })
    if (draft.refuse) return { isFilled: false }
    draft.text = e.mode === 'append' ? draft.text + e.text : e.text
    return { isFilled: true }
  })
  return { files, store, toasts, calls, typed, sub, holds, ran, exit, draft, fills, boxedAtOpen }
}
// Signatures are checked on real time, outside `$`: each round moves the mocked clock `ms` and also lets real time pass,
// until `cond` holds.
const later = (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout
const real = (ms = 5) => new Promise<void>(r => later(r, ms))
const until = async (clock: { advance: (ms: number) => Promise<unknown> }, cond: () => boolean, cap = 200, ms = 50) => {
  for (let i = 0; i < cap && !cond(); i++) { await clock.advance(ms); await real() }
}
const appendRow = ($: Engine, message: unknown) => $.session.append({ message: message as never, door: 'repl' as never, origin: { kind: 'repl' } as never, uuid: `u${Math.random()}` })
const startRow = (title: string, id: string) => ({ type: 'assistant', content: [{ type: 'tool_use', id, name: START_TOOL, input: { title, initiation: 'own_initiative', prompt: `Brief de ${title}.` } }] })
const resultRow = (id: string, text: string) => ({ type: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] })
const beatOf = (files: Record<string, string>) => JSON.parse(files[`${HOME}/sessions/s-test.json`]!) as Beat
const box = (id: string) => `${HOME}/control/${id}.json`
const KEY = 'k-test'
const signed = async (c: Omit<Cmd, 'sig'>, to = 's-test'): Promise<Cmd> => ({ ...c, sig: await signOf(KEY, c, to) })
const START = 'start' as Cmd['kind'] // an older pane's start order: Cmd no longer names it

// ---- The executor: the kit is s-test, the session that offered two suggestions ----
const OK_TEXT: Record<string, string> = { [START_TOOL]: 'Started session "Limpiar los worktrees" in a new window.', [DISMISS_TOOL]: 'Task task_def456 withdrawn. The chip is no longer shown to the user.' }
async function offering($: Engine, on: On, answer?: (e: Record<string, unknown>) => unknown, seed: Partial<Beat> = {}) {
  const clock = mock.clock(on, { now: 100_000 })
  const served = serve(on, [{ ...newBeat('s-test', 'proj', clock.now()), ...seed }], answer ?? (e => ({ result: 'ok', text: OK_TEXT[String(e.tool)] })))
  on('turn.complete', ($2, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/home/test/proj', surface: 'desktop', isInteractive: true })
  await appendRow($, startRow('Limpiar los worktrees', 'toolu_s1'))
  await appendRow($, resultRow('toolu_s1', 'Proposed "Limpiar los worktrees" (task_id: task_abc123).'))
  await appendRow($, startRow('Medir la caché', 'toolu_s2'))
  await appendRow($, resultRow('toolu_s2', 'Proposed "Medir la caché" (task_id: task_def456).'))
  await $.turn.complete({ answer: 'listo', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  served.store['mailbox-key'] = KEY
  const mail = async (...cmds: Cmd[]) => { served.files[box('s-test')] = JSON.stringify({ cmds }) }
  const acks = () => (served.store['offer-acks'] ?? {}) as Record<string, { n: number; r: string; why?: string; at: number }>
  return { ...served, clock, mail, acks }
}
const ownIds = (files: Record<string, string>) => (beatOf(files).offers ?? []).map(o => o.id)

test('I executor: a signed dismiss order calls the app\'s tool as this session, acks ok, settles offers-done and drops the card', async ($, on) => {
  const { files, store, calls, typed, clock, mail, acks } = await offering($, on)
  expect(beatOf(files).agents[MAIN]!.state).toBe('esperando')
  const id = 'task_def456', c = await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: id })
  await mail(c)
  await until(clock, () => !!acks()[id])
  expect(calls.map(x => [x.tool, x.task_id, x.consent])).toEqual([[DISMISS_TOOL, id, CONSENT_DISMISS]])
  expect([acks()[id]!.n, acks()[id]!.r, Object.keys(store['offers-done'] as object), typed]).toEqual([c.n, 'ok', [id], []])
  expect(ownIds(files)).toEqual(['task_abc123'])
})

test('M executor: a signed start order (from an older pane) calls nothing, submits nothing and acks gone; the card stays', async ($, on) => {
  const { files, store, calls, typed, clock, mail, acks } = await offering($, on)
  const c = await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_abc123' })
  await mail(c)
  await until(clock, () => !!acks().task_abc123)
  await until(clock, () => false, 10) // a wrong call would have started by now
  expect([calls, typed, acks().task_abc123!.n, acks().task_abc123!.r, store['offers-done']]).toEqual([[], [], c.n, 'gone', undefined])
  expect(ownIds(files)).toEqual(['task_abc123', 'task_def456'])
})

test('I executor: the last suggestion settled, the Jefe leaves the despacho', async ($, on) => {
  const { files, clock, mail, acks } = await offering($, on, e => ({ result: 'ok', text: `Task ${String(e.task_id)} withdrawn.` }))
  await mail(await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_abc123' }), await signed({ n: clock.now() * 1000 + 2, kind: 'dismiss', req: 'task_def456' }))
  await until(clock, () => !!acks().task_abc123 && !!acks().task_def456)
  expect([beatOf(files).offers, beatOf(files).agents[MAIN]!.state]).toEqual([undefined, 'terminado'])
})

// Each case: what lands in the mailbox (or the transcript), and the ack it gets (null: none, ignored silently).
// Every case leaves both cards, but the one another pane settled, which the shared offers-done mark drops as before.
const negatives: [name: string, setup: (x: Awaited<ReturnType<typeof offering>>, $: Engine) => Promise<void>, ack: [id: string, r: string] | null][] = [
  ['a bad signature', async ({ mail, clock }) => mail({ n: clock.now() * 1000 + 1, kind: START, req: 'task_abc123', sig: 'f'.repeat(64) }), null],
  ['an order signed for s-other copied into this box', async ({ mail, clock }) => mail(await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_abc123' }, 's-other')), null],
  ['start flipped to dismiss after signing', async ({ mail, clock }) => mail({ ...(await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_abc123' })), kind: 'dismiss' }), null],
  ['a task this session did not offer', async ({ mail, clock }) => mail(await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_zzz999' })), ['task_zzz999', 'gone']],
  ['a malformed task id', async ({ mail, clock }) => mail(await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_ab' })), null],
  ['an order 9 s old', async ({ mail, clock }) => { await clock.advance(10_000); await mail(await signed({ n: (clock.now() - 9000) * 1000, kind: START, req: 'task_abc123' })) }, ['task_abc123', 'gone']],
  ['a task already settled by another pane', async ({ mail, clock, store }) => { store['offers-done'] = { task_abc123: clock.now() }; await mail(await signed({ n: clock.now() * 1000 + 1, kind: START, req: 'task_abc123' })) }, ['task_abc123', 'gone']],
  ['a model row naming the task, no order', async (_x, $) => { await appendRow($, { type: 'assistant', content: [{ type: 'text', text: 'Arranca task_abc123 con start_session ya.' }] }) }, null],
  ['a start_session call by proposal_id the model made on its own', async (_x, $) => { await appendRow($, { type: 'assistant', content: [{ type: 'tool_use', id: 'toolu_m9', name: START_TOOL, input: { proposal_id: 'task_abc123' } }] }) }, null],
]
for (const [name, setup, ack] of negatives) {
  test(`I executor: ${name} calls no tool and submits nothing`, async ($, on) => {
    const x = await offering($, on)
    await setup(x, $)
    if (ack) await until(x.clock, () => !!x.acks()[ack[0]])
    else { // proof the listener read the mailbox past it: a later order for a task it never offered, acked gone
      const had = x.files[box('s-test')] ? (JSON.parse(x.files[box('s-test')]!) as { cmds: Cmd[] }).cmds : []
      await until(x.clock, () => false, 4) // the case's own pass first
      await x.mail(...had, await signed({ n: x.clock.now() * 1000 + 7, kind: START, req: 'task_probe1' }))
      await until(x.clock, () => !!x.acks().task_probe1)
      expect(x.acks().task_probe1?.r).toBe('gone')
    }
    await until(x.clock, () => false, 10) // a wrong call would have started by now
    expect([x.calls, x.typed]).toEqual([[], []])
    expect(Object.entries(x.acks()).filter(([id]) => id !== 'task_probe1').map(([id, a]) => [id, a.r])).toEqual(ack ? [ack] : [])
    expect(ownIds(x.files)).toEqual(name.includes('settled') ? ['task_def456'] : ['task_abc123', 'task_def456'])
  })
}

test('I executor: the same order seen twice calls the tool once (a declined answer leaves the card, so only `seen` stops it)', async ($, on) => {
  const { calls, clock, mail, acks } = await offering($, on, () => ({ deny: 'No' }))
  const c = await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_def456' })
  await mail(c)
  await until(clock, () => !!acks().task_def456)
  expect(acks().task_def456!.r).toBe('declined')
  await mail(c, c) // written again, and twice
  await until(clock, () => false, 40)
  expect(calls.length).toBe(1)
})

test('I executor: two orders for one task in one pass, the tool slow, make one call', async ($, on) => {
  const { calls, clock, mail, acks } = await offering($, on, async e => { await real(300); return { result: 'ok', text: `Task ${String(e.task_id)} withdrawn.` } })
  await mail(await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_def456' }), await signed({ n: clock.now() * 1000 + 2, kind: 'dismiss', req: 'task_def456' }))
  await until(clock, () => !!acks().task_def456)
  await until(clock, () => false, 20)
  expect([calls.length, acks().task_def456!.r]).toEqual([1, 'ok'])
})

test('I executor: the app answering in other words (already started there) acks settled and drops the card; a no acks declined with its reason, a failure failed, both keep it', async ($, on) => {
  // the app's real words for a task it no longer holds (started from its own card), transcripts 2026-10-20
  let answer: unknown = { result: 'ok', text: 'No pending task with id task_def456, possible causes include it never being queued in this session. Do not re-flag it.' }
  const { store, files, clock, mail, acks } = await offering($, on, () => answer)
  await mail(await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_def456' }))
  await until(clock, () => !!acks().task_def456)
  expect([acks().task_def456!.r, Object.keys(store['offers-done'] as object), ownIds(files)]).toEqual(['settled', ['task_def456'], ['task_abc123']])
  answer = { deny: 'No, gracias' }
  await mail(await signed({ n: clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_abc123' }))
  await until(clock, () => !!acks().task_abc123)
  expect([acks().task_abc123!.r, acks().task_abc123!.why, ownIds(files)]).toEqual(['declined', 'No, gracias', ['task_abc123']])
  answer = { result: 'ok', isError: true, text: 'boom' }
  await mail(await signed({ n: clock.now() * 1000 + 2, kind: 'dismiss', req: 'task_abc123' }))
  await until(clock, () => acks().task_abc123!.r !== 'declined')
  expect([acks().task_abc123!.r, Object.keys(store['offers-done'] as object), ownIds(files)]).toEqual(['failed', ['task_def456'], ['task_abc123']])
})

test('M: a start order acks gone and does nothing (offerOrderOk takes dismiss only); it can never answer a permission request', async ($, on) => {
  const now = 100_000, c = await signed({ n: now * 1000 + 1, kind: 'dismiss', req: 'task_abc123' })
  const b = { ...newBeat('s-test', 'x', now), offers: [{ tu: 't', title: 'x', brief: '', at: now, id: 'task_abc123' }] }
  expect([TASK.test('task_abc123'), TASK.test('task_ab'), TASK.test('xtask_abc123')]).toEqual([true, false, false])
  expect([offerOrderOk(b, c, now, {}), offerOrderOk(b, { ...c, kind: START }, now, {}), offerOrderOk(b, c, now + OFFER_ORDER_MS + 1, {}), offerOrderOk(b, { ...c, kind: 'msg' }, now, {}), offerOrderOk(b, c, now, { task_abc123: 1 })]).toEqual([true, false, false, false, false])
  expect(offerOrderOk({ offers: [{ ...b.offers[0]!, end: 'toolu_x' }] }, c, now, {})).toBe(false) // a start or dismiss already under way
  void $; void on
})

// ---- The pane: the kit is s-test, the note belongs to s-other ----
type UI = Mounted<'desktop', 'Pane'>
type BandP = { b: number; runs: [number, string | null, string | null][] }
const bandClients = async (ui: UI) => (await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('hits-'))
const hitKeys = async (ui: UI) => [...new Set((await bandClients(ui)).flatMap(c => (c.props.props as BandP).runs.map(r => r[1]).filter((k): k is string => !!k)))]
async function onMap(ui: UI, key: string) {
  for (const c of await bandClients(ui)) {
    const b = (await ui.findAll({ type: 'Button', in: c.key! })).find(x => x.key?.startsWith(`${key}@`))
    if (b) return void await ui.press({ key: b.key! })
  }
  throw new Error(`no click zone for ${key}`)
}
const notesCard = async (ui: UI) => String((await ui.findAll({ type: 'Svg' })).find(x => ['Sesiones sugeridas', 'Notas'].includes(String(x.props.alt)))?.props.source ?? '')
const OPEN = { command: 'agentville', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 110 } }
const PANE = { title: 'Agentville', isFocused: false, bodyColumns: 110, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} }

async function paneOver($: Engine, on: On, more: Partial<Beat> = {}, noMap = false) {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const other = { ...newBeat('s-other', 'otra', now), local: LOCAL_ID, offers: [{ tu: 't1', title: 'Idea 1', brief: 'b', at: now, id: 'task_idea1' }], ...more } as Beat
  setAgent(other, MAIN, now, { state: 'esperando', activity: 'Te sugiere sesiones', cmd: null, req: null })
  const served = serve(on, [newBeat('s-test', 'yo', now), other])
  if (noMap) served.store.nomap = true
  await $.command.run(OPEN)
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  await clock.advance(600) // the card opened by itself: its pills wait out NOTE_CALM
  return { ...served, clock, ui, other }
}
const sent = (files: Record<string, string>) => (files[box('s-other')] ? (JSON.parse(files[box('s-other')]!) as { cmds: Cmd[] }).cmds : [])

test('I pane: dismiss on another session\'s note writes one signed order to its box, calls no tool, sends no prompt', async ($, on) => {
  const { files, store, calls, toasts, clock, ui } = await paneOver($, on)
  await onMap(ui, 'note-dismiss-task_idea1')
  await until(clock, () => sent(files).length > 0)
  const cmds = sent(files), c = cmds[0]!, key = String(store['mailbox-key'])
  expect([cmds.length, c.kind, c.req, c.text]).toEqual([1, 'dismiss', 'task_idea1', undefined])
  expect([c.sig === await signOf(key, c, 's-other'), c.sig === await signOf(key, c, 's-test')]).toEqual([true, false])
  expect([calls, files[box('s-test')]]).toEqual([[], undefined])
  expect(toasts.at(-1)).toBe('Descartando «Idea 1»…')
  // its session's ack: the success toast, and the note stays hidden (offers-done settles it in every pane)
  store['offer-acks'] = { task_idea1: { n: c.n, r: 'ok', at: clock.now() } }
  store['offers-done'] = { task_idea1: clock.now() }
  await clock.advance(1000)
  expect(toasts.at(-1)).toBe('La app descartó «Idea 1»')
  expect((await hitKeys(ui)).filter(k => k.includes('task_idea1'))).toEqual([])
  await clock.advance(12_000)
  expect(toasts.filter(x => x.includes('no respondió'))).toEqual([]) // no late fallback
  await ui.unmount()
})

test('I pane: a settled ack (the app had it already) says so and the note stays hidden', async ($, on) => {
  const { files, store, toasts, clock, ui } = await paneOver($, on)
  await onMap(ui, 'note-dismiss-task_idea1')
  await until(clock, () => sent(files).length > 0)
  store['offer-acks'] = { task_idea1: { n: sent(files)[0]!.n, r: 'settled', at: clock.now() } }
  store['offers-done'] = { task_idea1: clock.now() } // its session settled it, as for ok
  await clock.advance(1000)
  expect(toasts.at(-1)).toBe('Ya estaba resuelta en la app; quité la nota')
  expect((await hitKeys(ui)).filter(k => k.includes('task_idea1'))).toEqual([])
  await clock.advance(12_000)
  expect(toasts.filter(x => x.includes('no respondió'))).toEqual([]) // no late fallback
  await ui.unmount()
})

test('I pane: an ack for another press (its n) is ignored; no answer in 10 s falls back to a toast and "Ir al chat" on the note', async ($, on) => {
  const { files, store, toasts, clock, ui } = await paneOver($, on)
  await onMap(ui, 'note-dismiss-task_idea1')
  await until(clock, () => sent(files).length > 0)
  store['offer-acks'] = { task_idea1: { n: 1, r: 'ok', at: clock.now() } }
  await clock.advance(9_000)
  expect(toasts.at(-1)).toBe('Descartando «Idea 1»…') // still waiting
  await clock.advance(2_000) // the first 1 s tick past 10 s
  expect(toasts.at(-1)).toBe('La sesión de «Idea 1» no respondió; hazlo en su chat')
  expect(await hitKeys(ui)).toEqual(expect.arrayContaining(['note-start-task_idea1', 'note-dismiss-task_idea1', 'note-chat-task_idea1']))
  expect(await notesCard(ui)).toContain('>↗ Ir al chat</span>')
  // with the map, the note's pill is the link: the detail card lists no suggestion, so it adds none
  await ui.press({ key: 'pick-s-other' })
  expect(await links(ui)).toEqual([])
  await ui.unmount()
})

const links = async (ui: UI) => (await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('btns-chatlink')).map(c => c.key!.replace(/~.*$/, ''))
test('I pane: with no map, the detail card lists the suggestion and, once its session did not answer, its "Ir al chat"', async ($, on) => {
  const { files, toasts, clock, ui } = await paneOver($, on, {}, true)
  await ui.press({ key: 'pick-s-other' })
  expect(await links(ui)).toEqual([])
  const press = () => ui.post({ press: 'dismiss-0' }, { in: 'btns-o-s-other-0~0' }) // a picture button's own Client
  await press()
  await until(clock, () => sent(files).length > 0)
  expect((await ui.findAll({ type: 'Client' })).some(c => c.key?.startsWith('btns-o-s-other'))).toBe(false) // hidden while its order waits: no second press
  await clock.advance(11_000)
  expect([sent(files).length, toasts.at(-1)]).toEqual([1, 'La sesión de «Idea 1» no respondió; hazlo en su chat'])
  expect(await links(ui)).toEqual(['btns-chatlink-s-other'])
  await ui.unmount()
})

for (const [r, toast] of [['failed', 'La app no pudo con «Idea 1»; hazlo en su chat'], ['unclear', 'La app respondió algo inesperado con «Idea 1»; míralo en su chat'], ['gone', 'Ya no está: la sesión siguió'], ['declined', 'No se hizo: No, gracias']] as const) {
  test(`I pane: a dismiss ack ${r} says so${r === 'failed' || r === 'unclear' ? ' and offers its chat' : ''}`, async ($, on) => {
    const { files, store, toasts, clock, ui } = await paneOver($, on)
    await onMap(ui, 'note-dismiss-task_idea1')
    await until(clock, () => sent(files).length > 0)
    store['offer-acks'] = { task_idea1: { n: sent(files)[0]!.n, r, why: 'No, gracias', at: clock.now() } }
    await clock.advance(1000)
    expect(toasts.at(-1)).toBe(toast)
    expect([(await hitKeys(ui)).includes('note-dismiss-task_idea1'), (await hitKeys(ui)).includes('note-chat-task_idea1')]).toEqual([true, r === 'failed' || r === 'unclear'])
    await ui.unmount()
  })
}

test('I pane: an asleep session gets no order; the fallback is at once', async ($, on) => {
  const { files, toasts, clock, ui, calls } = await paneOver($, on, { ended: true, endReason: 'other' })
  await onMap(ui, 'note-dismiss-task_idea1')
  await clock.advance(100)
  expect([files[box('s-other')], calls, toasts.at(-1)]).toEqual([undefined, [], '«Idea 1»: esa sesión está dormida; hazlo en su chat'])
  expect(await hitKeys(ui)).toContain('note-chat-task_idea1')
  await ui.unmount()
})

test('I pane: with no chat link the fallback says the chat is gone and draws no pill', async ($, on) => {
  const { files, toasts, clock, ui } = await paneOver($, on, { local: undefined })
  await onMap(ui, 'note-dismiss-task_idea1')
  await until(clock, () => sent(files).length > 0)
  await clock.advance(11_000)
  expect(toasts.at(-1)).toBe('La sesión de «Idea 1» no respondió y su chat ya no está en la app')
  expect(await hitKeys(ui)).not.toContain('note-chat-task_idea1')
  await ui.unmount()
})

// ---- Batch M: Arrancar opens that session's chat, where the app's card is; the mod sends nothing to start it ----
const CHAT_ARGV = ['/usr/bin/open', `claude://claude.ai/epitaxy/${LOCAL_ID}`]
// The note's session is this pane's own (s-test, "proj") or another (s-other, "otra"); `link` false: no record id yet.
async function arrancarOn($: Engine, on: On, own: boolean, noMap: boolean, link = true) {
  if (!own) {
    const x = await paneOver($, on, link ? {} : { local: undefined }, noMap)
    return { ...x, dept: 's-other', id: 'task_idea1', name: 'otra' }
  }
  const x = await offering($, on, undefined, link ? { local: LOCAL_ID } : {})
  if (noMap) x.store.nomap = true
  await $.command.run(OPEN)
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
  await x.clock.advance(600) // the card opened by itself: its pills wait out NOTE_CALM
  return { ...x, ui, dept: 's-test', id: 'task_abc123', name: 'proj' }
}
type Arr = Awaited<ReturnType<typeof arrancarOn>>
const pressStart = async (x: Arr, noMap: boolean) => {
  if (!noMap) {
    if (!(await hitKeys(x.ui)).includes(`note-start-${x.id}`)) { await onMap(x.ui, 'screen-notes'); await x.clock.advance(600) } // the card closed on the last press
    return onMap(x.ui, `note-start-${x.id}`)
  }
  await x.ui.press({ key: `pick-${x.dept}` })
  return x.ui.post({ press: 'start-0' }, { in: `btns-o-${x.dept}-0~0` })
}
const opens = (x: Arr) => x.ran.filter(a => a[0] === '/usr/bin/open')
const boxes = (x: Arr) => Object.keys(x.files).filter(k => k.startsWith(`${HOME}/control/`))
const fillOrders = (x: Arr) => boxes(x).flatMap(k => (JSON.parse(x.files[k]!) as { cmds: Cmd[] }).cmds)
// The toasts openChat gives, without batch N's fill toasts (this pane's own session adds one after it).
const FILL_TOASTS = ['Te dejé escrito «Arranca…» en su chat: dale Enter', 'Ya está escrito en su chat: dale Enter', 'Su campo ya tiene texto: añade «arráncala» al final y Enter', 'Pulsa Start en la tarjeta de su chat', 'I left "Start…" written in its chat: press Enter', 'It is already written in its chat: press Enter', 'Its box already has text: add "start it" at the end and Enter', 'Press Start on the card in its chat']
const chatToasts = (x: Arr) => x.toasts.filter(t => !FILL_TOASTS.includes(t))
// Still drawn and pressable: no press mark hides it (sentItems), it leaves only when the app settles the suggestion.
const stillThere = async (x: Arr, noMap: boolean) => noMap
  ? (await x.ui.findAll({ type: 'Client' })).some(c => c.key?.startsWith(`btns-o-${x.dept}-0`))
  : (await hitKeys(x.ui)).includes(`note-start-${x.id}`) || (await hitKeys(x.ui)).includes('screen-notes')

for (const own of [false, true]) for (const noMap of [false, true]) {
  const where = `${own ? 'this pane\'s own' : 'another'} session, ${noMap ? 'the detail card (no map)' : 'the notes card'}`
  test(`M AC1: Arrancar on ${where} opens its chat once, calls no tool, submits nothing, writes ${own ? 'no order' : 'one fill order'}`, async ($, on) => {
    const x = await arrancarOn($, on, own, noMap)
    x.exit.code = 0
    await pressStart(x, noMap)
    await until(x.clock, () => opens(x).length > 0, 20)
    await until(x.clock, () => false, 10) // a wrong order or call would have gone by now
    const orders = own ? [] : [['fill', x.id, undefined]]
    expect([opens(x), x.calls, x.typed, fillOrders(x).map(c => [c.kind, c.req, c.text]), chatToasts(x).at(-1)]).toEqual([[CHAT_ARGV], [], [], orders, `Abriendo el chat de ${x.name}: pulsa Start en la tarjeta`])
    expect([await stillThere(x, noMap), x.store['offers-done']]).toEqual([true, undefined])
    await pressStart(x, noMap) // pressable again: each press opens it once more (an order waiting for its ack sends no second)
    await until(x.clock, () => opens(x).length > 1, 20)
    expect([opens(x).length, x.calls, x.typed, fillOrders(x).length]).toEqual([2, [], [], orders.length])
    await x.ui.unmount()
  })
}

for (const [own, noMap] of [[false, false], [true, true]] as const) {
  test(`M AC3: open exiting non-zero says the chat could not open (${own ? 'own' : 'other'} session, ${noMap ? 'no map' : 'map'})`, async ($, on) => {
    const x = await arrancarOn($, on, own, noMap)
    await pressStart(x, noMap)
    await until(x.clock, () => opens(x).length > 0, 20)
    await x.clock.advance(100)
    expect([opens(x), chatToasts(x).at(-1), x.calls, x.typed, fillOrders(x).length]).toEqual([[CHAT_ARGV], 'No se pudo abrir el chat en la app', [], [], own ? 0 : 1])
    await x.ui.unmount()
  })
}

for (const [own, noMap, lang, toast] of [[false, false, 'es', 'Abre su chat en la app y pulsa Start en la tarjeta'], [true, true, 'en', 'Open its chat in the app and press Start on the card'], [true, false, 'es', 'Abre su chat en la app y pulsa Start en la tarjeta']] as const) {
  test(`M AC2: no chat link yet (${own ? 'own' : 'other'} session, ${noMap ? 'no map' : 'map'}, ${lang}): nothing runs, the guide toast, the pill still drawn`, async ($, on) => {
    const x = await arrancarOn($, on, own, noMap, false)
    if (lang === 'en') { x.store.lang = 'en'; await x.clock.advance(1000) }
    x.exit.code = 0
    await pressStart(x, noMap)
    await until(x.clock, () => x.toasts.length > 0, 20)
    await x.clock.advance(100)
    expect([opens(x), chatToasts(x).at(-1), x.calls, x.typed, fillOrders(x).length]).toEqual([[], toast, [], [], own ? 0 : 1])
    expect(await stillThere(x, noMap)).toBe(true)
    await pressStart(x, noMap)
    await x.clock.advance(100)
    expect([opens(x), x.toasts.filter(t => t === toast).length, fillOrders(x).length]).toEqual([[], 2, own ? 0 : 1])
    await x.ui.unmount()
  })
}

// ---- Batch N: Arrancar leaves a line in the offering session's own empty prompt box; nothing is ever sent ----
const LINE_ES = 'Arranca la sesión sugerida «Limpiar los worktrees» (proposal_id task_abc123).'
const LINE_EN = 'Start the suggested session "Limpiar los worktrees" (proposal_id task_abc123).'
const fillOrder = async (x: Awaited<ReturnType<typeof offering>>, req = 'task_abc123', dn = 1) => signed({ n: x.clock.now() * 1000 + dn, kind: 'fill', req })

for (const lang of ['es', 'en'] as const) {
  test(`N executor (${lang}): a signed fill order on an empty box writes the fixed line once, by append, and acks filled`, async ($, on) => {
    const x = await offering($, on)
    if (lang === 'en') x.store.lang = 'en'
    const c = await fillOrder(x)
    await x.mail(c)
    await until(x.clock, () => !!x.acks().task_abc123)
    expect([x.acks().task_abc123!.n, x.acks().task_abc123!.r, x.fills, x.draft.text]).toEqual([c.n, 'filled', [{ text: lang === 'es' ? LINE_ES : LINE_EN, mode: 'append' }], lang === 'es' ? LINE_ES : LINE_EN])
    expect([x.calls, x.typed, x.store['offers-done'], ownIds(x.files)]).toEqual([[], [], undefined, ['task_abc123', 'task_def456']])
  })
}

for (const [name, text] of [['text typed', 'hola'], ['only a space', ' ']] as const) {
  test(`N executor: a box holding ${name} is never written; it acks busy`, async ($, on) => {
    const x = await offering($, on)
    x.draft.text = text
    await x.mail(await fillOrder(x))
    await until(x.clock, () => !!x.acks().task_abc123)
    expect([x.acks().task_abc123!.r, x.fills, x.draft.text, x.calls, x.typed]).toEqual(['busy', [], text, [], []])
  })
}

test('N executor: a second fill order after the first filled the box acks ready; the same order replayed fills once', async ($, on) => {
  const x = await offering($, on)
  const c = await fillOrder(x)
  await x.mail(c)
  await until(x.clock, () => x.acks().task_abc123?.r === 'filled')
  await x.mail(c, c) // the same order written again, and twice
  await until(x.clock, () => false, 20)
  expect([x.fills.length, x.acks().task_abc123!.n]).toEqual([1, c.n])
  const c2 = await fillOrder(x, 'task_abc123', 2)
  await x.mail(c, c2)
  await until(x.clock, () => x.acks().task_abc123?.n === c2.n)
  expect([x.acks().task_abc123!.r, x.fills.length, x.draft.text, x.calls, x.typed]).toEqual(['ready', 1, LINE_ES, [], []])
})

for (const [name, set] of [['a hook refusing the fill', (d: { refuse: boolean }) => { d.refuse = true }], ['a read that throws', (d: { broken: boolean }) => { d.broken = true }]] as const) {
  test(`N executor: ${name} acks failed and sends nothing`, async ($, on) => {
    const x = await offering($, on)
    set(x.draft as never)
    await x.mail(await fillOrder(x))
    await until(x.clock, () => !!x.acks().task_abc123)
    expect([x.acks().task_abc123!.r, x.draft.text, x.calls, x.typed]).toEqual(['failed', '', [], []])
  })
}

// A title carried over from the session file was never checked: its quote marks go, hidden characters give the task id.
for (const [raw, shown] of [['Di «hola» "ya"', 'Di hola ya'], ['Di hola\u200b ya', 'task_ghi789']] as const) {
  test(`N executor: the line's title is this session's own, through pressTitle (${shown})`, async ($, on) => {
    const x = await offering($, on, undefined, { offers: [{ tu: 'toolu_s9', title: raw, brief: '', at: 100_000, id: 'task_ghi789' }] })
    expect(ownIds(x.files)).toContain('task_ghi789')
    await x.mail(await fillOrder(x, 'task_ghi789'))
    await until(x.clock, () => !!x.acks().task_ghi789)
    expect([x.acks().task_ghi789!.r, x.fills.map(f => f.text)]).toEqual(['filled', [`Arranca la sesión sugerida «${shown}» (proposal_id task_ghi789).`]])
  })
}

// Each case acks gone (null: a bad order, no ack at all) and never touches the box.
const fillNegatives: [name: string, setup: (x: Awaited<ReturnType<typeof offering>>, $: Engine) => Promise<void>, ack: string | null][] = [
  ['a bad signature', async x => x.mail({ n: x.clock.now() * 1000 + 1, kind: 'fill', req: 'task_abc123', sig: 'f'.repeat(64) }), null],
  ['an order signed for s-other', async x => x.mail(await signed({ n: x.clock.now() * 1000 + 1, kind: 'fill', req: 'task_abc123' }, 's-other')), null],
  ['dismiss flipped to fill after signing', async x => x.mail({ ...(await signed({ n: x.clock.now() * 1000 + 1, kind: 'dismiss', req: 'task_abc123' })), kind: 'fill' }), null],
  ['a task this session did not offer', async x => x.mail(await fillOrder(x, 'task_zzz999')), 'task_zzz999'],
  ['an order 9 s old', async x => { await x.clock.advance(10_000); await x.mail(await signed({ n: (x.clock.now() - 9000) * 1000, kind: 'fill', req: 'task_abc123' })) }, 'task_abc123'],
  ['a task already settled', async x => { x.store['offers-done'] = { task_abc123: x.clock.now() }; await x.mail(await fillOrder(x)) }, 'task_abc123'],
  ['a task whose start is under way', async (x, $) => { await appendRow($, { type: 'assistant', content: [{ type: 'tool_use', id: 'toolu_m9', name: START_TOOL, input: { proposal_id: 'task_abc123' } }] }); await until(x.clock, () => false, 4); await x.mail(await fillOrder(x)) }, 'task_abc123'],
]
for (const [name, setup, ack] of fillNegatives) {
  test(`N executor: ${name} writes nothing in the box${ack ? ' and acks gone' : ''}`, async ($, on) => {
    const x = await offering($, on)
    await setup(x, $)
    if (ack) await until(x.clock, () => !!x.acks()[ack])
    else { // a bad order acks nothing: a good one queued behind it proves the box was read
      const had = (JSON.parse(x.files[box('s-test')] ?? '{"cmds":[]}') as { cmds: Cmd[] }).cmds
      await x.mail(...had, await fillOrder(x, 'task_probe1', 7))
      await until(x.clock, () => !!x.acks().task_probe1)
      expect(x.acks().task_probe1?.r).toBe('gone')
    }
    await until(x.clock, () => false, 10)
    expect([x.fills, x.draft.text, x.calls, x.typed]).toEqual([[], '', [], []])
    expect(Object.entries(x.acks()).filter(([id]) => id !== 'task_probe1').map(([id, a]) => [id, a.r])).toEqual(ack ? [[ack, 'gone']] : [])
  })
}

test('N: offerOrderOk takes a fill like a dismiss', async ($, on) => {
  const now = 100_000, c = await signed({ n: now * 1000 + 1, kind: 'fill', req: 'task_abc123' })
  const b = { ...newBeat('s-test', 'x', now), offers: [{ tu: 't', title: 'x', brief: '', at: now, id: 'task_abc123' }] }
  expect([offerOrderOk(b, c, now, {}), offerOrderOk(b, c, now + OFFER_ORDER_MS + 1, {}), offerOrderOk(b, c, now, { task_abc123: 1 }), offerOrderOk(b, { ...c, req: 'task_zzz999' }, now, {})]).toEqual([true, false, false, false])
  void $; void on
})

// The pane: another session's suggestion
const openRuns = (ran: string[][]) => ran.filter(a => a[0] === '/usr/bin/open')
const pressOther = async (x: Awaited<ReturnType<typeof paneOver>>) => { x.exit.code = 0; await onMap(x.ui, 'note-start-task_idea1'); await until(x.clock, () => sent(x.files).length > 0 && openRuns(x.ran).length > 0, 40) }
test('N pane: Arrancar writes one signed fill order (task id only) before the chat opens; a second press sends no second order', async ($, on) => {
  const x = await paneOver($, on)
  await pressOther(x)
  const c = sent(x.files)[0]!, key = String(x.store['mailbox-key'])
  expect([sent(x.files).length, c.kind, c.req, c.text, c.sig === await signOf(key, c, 's-other')]).toEqual([1, 'fill', 'task_idea1', undefined, true])
  expect([x.boxedAtOpen[0], openRuns(x.ran), x.fills, x.calls, x.typed]).toEqual([[box('s-other')], [CHAT_ARGV], [], [], []])
  if (!(await hitKeys(x.ui)).includes('note-start-task_idea1')) { await onMap(x.ui, 'screen-notes'); await x.clock.advance(600) }
  await onMap(x.ui, 'note-start-task_idea1')
  await until(x.clock, () => openRuns(x.ran).length > 1, 20)
  expect([sent(x.files).length, openRuns(x.ran).length, x.calls, x.typed]).toEqual([1, 2, [], []])
  await x.ui.unmount()
})

for (const [r, toast] of [['filled', 'Te dejé escrito «Arranca…» en su chat: dale Enter'], ['ready', 'Ya está escrito en su chat: dale Enter'], ['busy', 'Su campo ya tiene texto: añade «arráncala» al final y Enter'], ['failed', 'Pulsa Start en la tarjeta de su chat'], ['unclear', 'Pulsa Start en la tarjeta de su chat'], ['gone', 'Ya no está: la sesión siguió']] as const) {
  test(`N pane: a fill ack ${r} toasts it once`, async ($, on) => {
    const x = await paneOver($, on)
    await pressOther(x)
    await x.clock.advance(100)
    const before = x.toasts.length // openChat's own toast is in
    x.store['offer-acks'] = { task_idea1: { n: sent(x.files)[0]!.n, r, at: x.clock.now() } }
    await x.clock.advance(1000)
    const at = x.toasts.length
    expect([at - before, x.toasts.at(-1)]).toEqual([1, toast])
    await x.clock.advance(12_000)
    expect([x.toasts.length, x.calls, x.typed, x.fills]).toEqual([at, [], [], []]) // no late fallback
    await x.ui.unmount()
  })
}

test('N pane: no ack in 10 s (an older mod there) gives the guide toast, not "did not answer"', async ($, on) => {
  const x = await paneOver($, on)
  await pressOther(x)
  await x.clock.advance(9_000)
  expect(x.toasts.at(-1)).toBe('Abriendo el chat de otra: pulsa Start en la tarjeta') // openChat's own
  const at = x.toasts.length
  await x.clock.advance(2_000)
  expect([x.toasts.length, x.toasts.at(-1), x.toasts.filter(t => t.includes('no respondió'))]).toEqual([at + 1, 'Pulsa Start en la tarjeta de su chat', []])
  await x.ui.unmount()
})

test('N pane: an asleep session gets no order; its chat still opens', async ($, on) => {
  const x = await paneOver($, on, { ended: true, endReason: 'other' })
  x.exit.code = 0
  await onMap(x.ui, 'note-start-task_idea1')
  await until(x.clock, () => openRuns(x.ran).length > 0, 20)
  expect([x.files[box('s-other')], openRuns(x.ran), x.calls, x.typed]).toEqual([undefined, [CHAT_ARGV], [], []])
  await x.ui.unmount()
})

// The pane's own session: no order, the same read-then-fill rule in its own box
for (const [name, set, toast, fills] of [
  ['an empty box takes the line', () => {}, 'Te dejé escrito «Arranca…» en su chat: dale Enter', [{ text: LINE_ES, mode: 'append' }]],
  ['a box with text is left alone', (d: { text: string }) => { d.text = 'mi idea' }, 'Su campo ya tiene texto: añade «arráncala» al final y Enter', []],
  ['a box already holding the line says so', (d: { text: string }) => { d.text = LINE_ES }, 'Ya está escrito en su chat: dale Enter', []],
  ['a refused fill shows the guide', (d: { refuse: boolean }) => { d.refuse = true }, 'Pulsa Start en la tarjeta de su chat', [{ text: LINE_ES, mode: 'append' }]],
] as const) {
  test(`N own session: ${name}, no order, nothing sent`, async ($, on) => {
    const x = await arrancarOn($, on, true, false)
    x.exit.code = 0
    set(x.draft as never)
    await pressStart(x, false)
    await until(x.clock, () => opens(x).length > 0, 20)
    await until(x.clock, () => false, 10)
    expect([x.toasts.at(-1), x.fills, boxes(x), x.calls, x.typed, x.store['offer-acks']]).toEqual([toast, fills, [], [], [], undefined])
    await x.ui.unmount()
  })
}

for (const how of ['under way', 'settled'] as const) test(`N own session: a suggestion whose start is ${how} is never filled`, async ($, on) => {
  const x = await arrancarOn($, on, true, false)
  x.exit.code = 0
  if (how === 'under way') await appendRow($, { type: 'assistant', content: [{ type: 'tool_use', id: 'toolu_m9', name: START_TOOL, input: { proposal_id: 'task_abc123' } }] })
  else x.store['offers-done'] = { task_abc123: x.clock.now() }
  await pressStart(x, false) // the note as last drawn
  await until(x.clock, () => opens(x).length > 0, 20)
  await until(x.clock, () => false, 10)
  expect([x.fills, x.draft.text, boxes(x), x.calls, x.typed]).toEqual([[], '', [], [], []])
  await x.ui.unmount()
})

test('N pane: Descartar during a fill\'s wait is not held: it sends its dismiss order', async ($, on) => {
  const x = await paneOver($, on)
  await pressOther(x)
  if (!(await hitKeys(x.ui)).includes('note-dismiss-task_idea1')) { await onMap(x.ui, 'screen-notes'); await x.clock.advance(600) }
  await onMap(x.ui, 'note-dismiss-task_idea1')
  await until(x.clock, () => sent(x.files).length > 1, 20)
  expect([sent(x.files).map(c => [c.kind, c.req]), x.toasts.at(-1), x.calls, x.typed]).toEqual([[['fill', 'task_idea1'], ['dismiss', 'task_idea1']], 'Descartando «Idea 1»…', [], []])
  await x.ui.unmount()
})

// ---- Batch AZ item 7: a /command held back from another session is typed in its own empty prompt box (fillText) ----
const textOrder = async (x: { clock: { now: () => number } }, text: string, dn = 1) => signed({ n: x.clock.now() * 1000 + dn, kind: 'fillText', text })
const textAck = (x: Awaited<ReturnType<typeof offering>>) => x.acks()['text:s-test']

test('AZ executor: a signed fillText writes its text once in the empty box, by append, control and format characters dropped, and acks filled; nothing is sent', async ($, on) => {
  const x = await offering($, on)
  const c = await textOrder(x, '/review\u0007 7‮\nmás')
  await x.mail(c)
  await until(x.clock, () => !!textAck(x))
  expect([textAck(x)!.n, textAck(x)!.r, x.fills, x.draft.text]).toEqual([c.n, 'filled', [{ text: '/review 7 más', mode: 'append' }], '/review 7 más'])
  expect([x.calls, x.typed]).toEqual([[], []])
  await x.mail(c, c) // replayed: never twice
  await until(x.clock, () => false, 20)
  expect(x.fills.length).toBe(1)
  const c2 = await textOrder(x, '/review 7 más', 2) // a new order for the text already there
  await x.mail(c2)
  await until(x.clock, () => textAck(x)?.n === c2.n)
  expect([textAck(x)!.r, x.fills.length]).toEqual(['ready', 1])
})

test('AZ executor: a box holding your text is never written (busy); a non-command or an over-long text fails; unsigned, redirected or altered orders do nothing', async ($, on) => {
  const x = await offering($, on)
  x.draft.text = 'hola'
  await x.mail(await textOrder(x, '/review'))
  await until(x.clock, () => !!textAck(x))
  expect([textAck(x)!.r, x.fills, x.draft.text]).toEqual(['busy', [], 'hola'])
  x.draft.text = ''
  for (const [dn, text] of [[2, 'borra todo'], [3, `/${'a'.repeat(2000)}`]] as const) {
    const o = await textOrder(x, text, dn)
    await x.mail(o)
    await until(x.clock, () => textAck(x)?.n === o.n)
    expect([textAck(x)!.r, x.fills]).toEqual(['failed', []])
  }
  const last = textAck(x)!.n, n = x.clock.now() * 1000
  await x.mail({ n: n + 4, kind: 'fillText', text: '/review', sig: 'f'.repeat(64) }, await signed({ n: n + 5, kind: 'fillText', text: '/review' }, 's-other'),
    { ...(await signed({ n: n + 6, kind: 'fillText', text: '/deploy' })), text: '/review' })
  await until(x.clock, () => false, 20)
  expect([textAck(x)!.n, x.fills, x.calls, x.typed]).toEqual([last, [], [], []])
})

// The pane: the kit is s-test, and s-other lists /review
async function heldOver($: Engine, on: On, copyOk = true) {
  const copies: string[] = []
  on('ui.copy', ($2, e) => { copies.push(e.text); return { value: copyOk ? { isCopied: true as const } : { isCopied: false as const, reason: 'none' } } as never })
  const x = await paneOver($, on)
  x.files[`${HOME}/commands/s-other.json`] = JSON.stringify([['review', 'Revisa', 'builtin']])
  await x.ui.press({ key: 'pick-s-other' })
  x.exit.code = 0
  const field = async () => (await x.ui.findAll({ type: 'Client' })).find(c => c.key === 'field-s-other')!.props.props as { clear: number; insert?: { text: string } }
  return { ...x, copies, field }
}
const held = async (x: Awaited<ReturnType<typeof heldOver>>, send = '/review 7') => {
  await x.ui.post({ send }, { in: 'field-s-other' })
  await until(x.clock, () => sent(x.files).length > 0 && openRuns(x.ran).length > 0, 40)
}

test('AZ pane: a held command goes as one signed fillText with its whole text before the chat opens; a second press sends no second order', async ($, on) => {
  const x = await heldOver($, on)
  await held(x)
  const c = sent(x.files)[0]!
  expect([sent(x.files).length, c.kind, c.text, c.req, c.sig === await signOf(String(x.store['mailbox-key']), c, 's-other')]).toEqual([1, 'fillText', '/review 7', undefined, true])
  expect([x.boxedAtOpen[0], openRuns(x.ran), x.typed, x.copies]).toEqual([[box('s-other')], [CHAT_ARGV], [], []])
  expect((await x.field()).insert?.text).toBe('/review 7') // Enter emptied the field: the text is back while it waits
  await x.ui.post({ draft: '/review 7' }, { in: 'field-s-other' })
  await x.ui.press({ key: 'send' }) // Enviar while the order waits: the chat opens, no second order
  await until(x.clock, () => openRuns(x.ran).length > 1, 40)
  expect([sent(x.files).length, openRuns(x.ran).length]).toEqual([1, 2])
  await x.ui.unmount()
})

for (const r of ['filled', 'ready'] as const) {
  test(`AZ pane: a fillText ack ${r} says it is typed there and clears the draft; nothing is copied`, async ($, on) => {
    const x = await heldOver($, on)
    await held(x)
    await x.ui.post({ draft: '/review 7' }, { in: 'field-s-other' })
    const was = (await x.field()).clear
    x.store['offer-acks'] = { 'text:s-other': { n: sent(x.files)[0]!.n, r, at: x.clock.now() } }
    await until(x.clock, () => x.toasts.some(t => t.startsWith('Listo')), 40)
    expect(x.toasts.at(-1)).toBe('Listo: /review quedó escrito en el chat de otra; dale Enter allí')
    expect([(await x.field()).clear, x.copies]).toEqual([was + 1, []])
    await x.clock.advance(12_000)
    expect(x.toasts.filter(t => t.startsWith('Copiado'))).toEqual([]) // no late fallback
    await x.ui.unmount()
  })
}

for (const [name, ack] of [['busy', 'busy'], ['failed', 'failed'], ['no answer in 10 s', null]] as const) {
  test(`AZ pane: a fillText ${name} copies the whole text, keeps the draft and says to paste it`, async ($, on) => {
    const x = await heldOver($, on)
    await held(x)
    await x.ui.post({ draft: '/review 7' }, { in: 'field-s-other' })
    const was = (await x.field()).clear
    if (ack) x.store['offer-acks'] = { 'text:s-other': { n: sent(x.files)[0]!.n, r: ack, at: x.clock.now() } }
    await until(x.clock, () => x.copies.length > 0, 300)
    expect([x.copies, x.toasts.at(-1), (await x.field()).clear]).toEqual([['/review 7'], 'Copiado: pega /review con Cmd+V en el chat de otra (el texto sigue en el campo)', was])
    await x.ui.unmount()
  })
}

test('AZ pane: with no ack and a copy that fails, the toast says the text stays in the field', async ($, on) => {
  const x = await heldOver($, on, false)
  await held(x)
  await until(x.clock, () => x.toasts.some(t => t.startsWith('No se envía')), 300)
  expect(x.toasts.at(-1)).toBe('No se envía desde aquí: escribe /review en el chat de otra. El texto sigue en el campo')
  await x.ui.unmount()
})

test('AZ executor: two fillText orders in one pass fill once; the second, while the first runs, acks busy', async ($, on) => {
  const x = await offering($, on)
  const c1 = await textOrder(x, '/review 1'), c2 = await textOrder(x, '/review 2', 2)
  await x.mail(c1, c2)
  await until(x.clock, () => textAck(x)?.n === c1.n)
  await until(x.clock, () => false, 10)
  expect([x.fills.map(f => f.text), x.draft.text, textAck(x)!.r]).toEqual([['/review 1'], '/review 1', 'filled'])
})

test('AZ pane: after Enter the field clears on filled even when its last draft post lagged behind the text', async ($, on) => {
  const x = await heldOver($, on)
  await x.ui.post({ draft: '/review' }, { in: 'field-s-other' }) // the draft post 150 ms behind the last keys
  await held(x)
  const was = (await x.field()).clear
  x.store['offer-acks'] = { 'text:s-other': { n: sent(x.files)[0]!.n, r: 'filled', at: x.clock.now() } }
  await until(x.clock, () => x.toasts.some(t => t.startsWith('Listo')), 40)
  expect((await x.field()).clear).toBe(was + 1)
  await x.ui.unmount()
})

test('AZ pane: the clipboard fallback copies the text as the fill would have typed it, hidden characters dropped', async ($, on) => {
  const x = await heldOver($, on)
  await held(x, '/review 7\u200b\u2028ya')
  x.store['offer-acks'] = { 'text:s-other': { n: sent(x.files)[0]!.n, r: 'busy', at: x.clock.now() } }
  await until(x.clock, () => x.copies.length > 0, 40)
  expect([sent(x.files)[0]!.text, x.copies]).toEqual(['/review 7 ya', ['/review 7 ya']])
  await x.ui.unmount()
})

test('AZ: fillTextOf folds line and paragraph separators, drops control, format, private-use and unassigned characters, and takes only a /command up to FILL_MAX', () => {
  expect(fillTextOf('/a\u2028b\u2029c\r\nd')).toBe('/a b c d')
  expect(fillTextOf('/re\u200bview\ue000 \u0378x\u0007\u202e')).toBe('/review x')
  expect([fillTextOf('hola'), fillTextOf(42), fillTextOf(`/${'a'.repeat(FILL_MAX)}`), fillTextOf(`/${'a'.repeat(FILL_MAX - 1)}`)?.length]).toEqual([null, null, null, FILL_MAX])
})
