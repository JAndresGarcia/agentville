// The pane's tests: tables in replies, the layout, the disk screen, refresh, the heartbeat, questions and suggested sessions, the notes card, sync, the office bureaucracy, the language switch, clicks, the chat link, redraws, permission requests answered in time and queued messages. Shared fixtures and helpers: ./pane.shared.tsx.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'
import { IDLE_MS, MAIN, OFFER_TTL, SLEEP_MS, addSaid, isIdle, trusted, claimSlot, newBeat, notesFrom, pushChat, roleOf, setAgent } from '../hooks/beat'
import type { Beat, Cmd } from '../hooks/beat'
import { paletteOf } from '../hooks/look'
import { STRINGS, setLang, t } from '../hooks/i18n'
import { btnsElements } from '../hooks/btns'
import { bannerSvg, btnSvg, noteLines, notesCard as notesCardOf, textW, toggleSvg, type NoteReply } from '../hooks/chrome'
import { chipSvg } from '../hooks/scene'
import type { BtnsProps } from '../hooks/btns'
import { SEC_ID, EDGE_EPS, cardRect, diskScreenRect, notesTop, demoBeats, STATES, agentName, floorView, hotspots, selectionLayer, viewOf, worldFromBeats, drawnSig } from '../hooks/scene'
import { CARD_REF_PX, CELL_PX, CLIENT_MAX, HEAVY_KB, RENDER_GAP, PANE_ROWS, aborted, bandCount, MAP_MAX_PX, mapPx, openChat, relayOf } from '../hooks/register'
import { isMod } from '../hooks/sync'
import { HOME, OPEN, PANE, SKILL_RULE, areas, ask, bandClients, bannerAlt, beatOf, beats, btn, btnsAll, btnsKeys, chatPane, clientKeys, crowd, drawn, fileStat, flowSeen, fresh, held, hitKeys, imageAt, keyed, lastEls, lastLog, line, mailbox, mountAt, mountPane, oldList, onMap, ordersIn, relaySetup, serveBeats, signed, sipsRun, startSession, stripEls, textOf, textsAll, textsIn, tnodes, until, walk } from './pane.shared'
import type { BandP, Entry, Logged, Ran, TN, UI } from './pane.shared'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// ---- Tables in replies (tables-spec AC5 to AC7) ----

// The table's outer Box: the one whose rows hold the header cell `head`.
const tableBox = async (ui: Mounted<'desktop', 'Pane'>, head: string) => tnodes(await ui.drawn()).filter(n => n.type === 'Box' && n.props?.overflow === 'hidden' && (n.children ?? []).length > 1 && textOf((n.children as unknown[])[0]) .startsWith(head)).at(-1)
const PHASES = 'Así vamos:\n\n| Fase | Hecho | En progreso | Por hacer |\n|---|---:|:---:|---|\n| F-1 Fundaciones | 130 | 0 | 0 |\n| F-2 `a|b` | **12** | 3 | 1 |'

test('Tables: every cell is drawn in its own column, the header bold on a tint, in the bubble ink; no pipe or dash row shows', async ($, on) => {
  const { ui } = await chatPane($, on, PHASES)
  for (const cell of ['Fase', 'Hecho', 'En progreso', 'Por hacer', 'F-1 Fundaciones', '130', 'a|b', '12']) expect(await ui.find({ type: 'Text', text: cell })).toBeDefined()
  const tree = JSON.stringify(await ui.drawn())
  expect(tree).not.toContain('|---')
  expect(tree).not.toContain('| F-1')
  expect(await ui.find({ type: 'Text', text: 'Así vamos:' })).toBeDefined()
  const head = await ui.find({ type: 'Text', text: 'Fase' })
  expect([head!.props.weight, head!.props.color]).toEqual(['bold', '#1d1d1b'])
  expect((await ui.find({ type: 'Text', text: 'F-1 Fundaciones' }))!.props.weight).toBeUndefined()
  const box = (await tableBox(ui, 'Fase'))!
  const [headRow, ...rows] = box.children as TN[]
  expect(rows.length).toBe(2)
  expect([headRow!.props!.backgroundColor, rows[0]!.props!.backgroundColor]).toEqual(['rgba(29,29,27,0.10)', undefined]) // the header's tint
  // the bubble takes the row's free space, so the columns have a width to share
  const pathTo = (n: TN, goal: TN): TN[] | null => n === goal ? [n] : ((n.children ?? []) as TN[]).reduce<TN[] | null>((f, c) => f ?? (c && typeof c === 'object' ? (p => (p ? [n, ...p] : null))(pathTo(c, goal)) : null), null)
  const root = (await ui.drawn()) as TN, same = tnodes(root).filter(n => n.type === 'Box' && n.props?.overflow === 'hidden' && textOf(((n.children ?? []) as unknown[])[0]).startsWith('Fase')).at(-1)!
  const bubbleBox = pathTo(root, same)!.reverse().find(n => n.props?.borderStyle === 'round')
  expect(bubbleBox?.props?.flexGrow).toBe(1)
  const cols = (headRow!.children ?? []) as TN[]
  expect(cols.map(c => [c.props!.width, c.props!.flexGrow])).toEqual([[0, 15], [0, 5], [0, 11], [0, 9]]) // longest cell, 3 to 24
  expect(cols[1]!.props!.alignItems).toBe('flex-end') // ---: right
  for (const c of cols) expect(((c.children ?? []) as TN[])[0]!.props!.wrap).toBe('wrap')
  await ui.unmount()
})

test('Tables: a reply folds by whole blocks; a 400-character paragraph and a table show the paragraph and Ver más, then the table', async ($, on) => {
  const para = 'Resumen. ' + 'x'.repeat(391)
  const rows = Array.from({ length: 14 }, (_, i) => `| fila ${i} | ${'y'.repeat(12)} |`).join('\n')
  const { ui } = await chatPane($, on, `${para}\n\n| Col A | Col B |\n|---|---|\n${rows}`)
  expect(await ui.find({ type: 'Text', text: para })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Col A' })).toBeUndefined()
  expect(JSON.stringify(await ui.drawn())).not.toContain('xx…') // no cut in the middle of the text
  const more = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!
  expect(more.text).toBe('Ver más')
  await ui.press({ key: more.key! })
  expect(await ui.find({ type: 'Text', text: 'Col A' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'fila 13' })).toBeDefined()
  await ui.unmount()
})

test('Tables: a single 900-character table shows its rows up to the limit and Ver más, then all of it', async ($, on) => {
  const rows = Array.from({ length: 31 }, (_, i) => `| fila ${String(i).padStart(2, '0')} | ${'z'.repeat(14)} |`).join('\n')
  const text = `| Col A | Col B |\n|---|---|\n${rows}`
  expect(text.length).toBeGreaterThan(900)
  const { ui } = await chatPane($, on, text)
  expect(await ui.find({ type: 'Text', text: 'fila 00' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'fila 30' })).toBeUndefined()
  const more = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!
  await ui.press({ key: more.key! })
  expect(await ui.find({ type: 'Text', text: 'fila 30' })).toBeDefined()
  await ui.unmount()
})
test('Tables: a 6 x 10 table adds at most 150 elements', async ($, on) => {
  const t6 = [line(['a', 'b', 'c', 'd', 'e', 'f']), line(Array(6).fill('---')), ...Array.from({ length: 10 }, (_, r) => line(Array.from({ length: 6 }, (_, c) => `${r}${c}`)))].join('\n')
  const { ui, files, say } = await chatPane($, on, 'Hola')
  const base = lastEls(files)
  await say(`Hola\n\n${t6}`)
  await ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  expect(await ui.find({ type: 'Text', text: '95' })).toBeDefined()
  expect(lastEls(files) - base).toBeLessThanOrEqual(150)
  expect(lastEls(files) - base).toBe(146) // the formula above, exactly
  await ui.unmount()
})

test('Tables: a 10-column table still fits the bubble: every column a zero-width share, the table clipped, nothing scrolls sideways', async ($, on) => {
  const ten = Array.from({ length: 10 }, (_, i) => `Columna${i}`)
  const t10 = [line(ten), line(Array(10).fill('---')), line(ten.map(c => `${c} que envuelve bien`))].join('\n')
  const { ui } = await chatPane($, on, `Diez:\n\n${t10}`)
  await ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  const box = (await tableBox(ui, 'Columna0'))!
  expect(box.props!.overflow).toBe('hidden')
  for (const row of [(box.children as TN[])[0]!, (box.children as TN[])[1]!]) {
    expect((row.children ?? []).length).toBe(10)
    for (const c of (row.children ?? []) as TN[]) expect([c.props!.width, c.props!.flexGrow]).toEqual([0, 24]) // 26-character cells: clamped to 24
  }
  for (const c of ten) expect(await ui.find({ type: 'Text', text: c })).toBeDefined()
  await ui.unmount()
})

test('Tables: a huge table (500 rows of 6, a header of 300 empty columns) stays under TREE_LIMIT folded and opened, and says what it left out', async ($, on) => {
  const rows = Array.from({ length: 500 }, (_, i) => line(Array.from({ length: 6 }, (_, c) => `r${i}c${c}`))).join('\n')
  const big = `${line(['a', 'b', 'c', 'd', 'e', 'f'])}\n${line(Array(6).fill('---'))}\n${rows}`
  const wide = `${line(Array(300).fill(' '))}\n${line(Array(300).fill('---'))}\n${line(Array(300).fill('x'))}`
  const { ui, files, say } = await chatPane($, on, big)
  expect(lastEls(files)).toBeLessThan(1500) // folded: the rows up to the limit
  expect(await ui.find({ type: 'Text', text: 'r0c0' })).toBeDefined()
  await ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  expect(lastEls(files)).toBeLessThan(1500) // opened: at most 40 rows
  expect(await ui.find({ type: 'Text', text: 'r39c0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'r40c0' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '+460 filas' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: '+460 filas' }))!.props.color).toBe('#5c5c5a') // faded ink, never dimColor
  await say(wide)
  expect(lastEls(files)).toBeLessThan(1500)
  const shown = (await tableBox(ui, ''))!
  expect(((shown.children as TN[])[0]!.children ?? []).length).toBe(12) // 12 columns drawn
  expect(await ui.find({ type: 'Text', text: '+288 columnas' })).toBeDefined()
  await ui.unmount()
})

test('AK: a table one row and one column past the caps says "+1 fila" and "+1 columna"', async ($, on) => {
  const rows = Array.from({ length: 41 }, (_, i) => line([`r${i}a`, `r${i}b`])).join('\n')
  const { ui, say } = await chatPane($, on, `${line(['a', 'b'])}\n${line(['---', '---'])}\n${rows}`)
  await ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  expect(await ui.find({ type: 'Text', text: '+1 fila' })).toBeDefined()
  const cols = Array.from({ length: 13 }, (_, c) => `k${c}`)
  await say(`${line(cols)}\n${line(cols.map(() => '---'))}\n${line(cols.map(c => `${c}v`))}`)
  expect(await ui.find({ type: 'Text', text: '+1 columna' })).toBeDefined()
  await ui.unmount()
})

test('AK: one agent on the floor and a one-task plan read in the singular', async ($, on) => {
  const now = mock.clock(on, { now: 100000 }).now(), a = newBeat('s1', 'tienda', now)
  setAgent(a, MAIN, now, { state: 'trabajando', activity: 'Bash ls' })
  notesFrom(a, { items: [{ content: 'Leer carrito', status: 'completed' }] })
  serveBeats(on, [a])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const alts = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.alt))
  expect([alts.some(x => x.startsWith('1 agente en este piso; ')), alts.includes('1 de 1 tarea hecha')]).toEqual([true, true])
  await ui.unmount()
})

test('AK: one team past the HQ screen (6) and past the HQ card (13) says "+1 equipo más"', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), now = clock.now()
  const team = (n: number) => Array.from({ length: n }, (_, i) => {
    const b = newBeat(`s${i + 1}`, `ofi${i + 1}`, now)
    setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Bash ls' })
    b.usage = { pct: 1, tokens: 1, window: 1, usd: i + 1, cats: [], limits: [] }
    return b
  })
  const list = team(6)
  serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const sources = async () => (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.source))
  expect((await sources()).some(x => x.includes('+1 equipo más'))).toBe(true) // the wall screen lists 5
  await onMap(ui, 'screen-hq') // opened while the map still takes clicks; it stays open as the office grows
  list.push(...team(13).slice(6))
  for (const b of list) b.at = now + 1
  await clock.advance(3100) // the next read of the heartbeats
  expect(String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Gasto del HQ')?.props.source)).toContain('+1 equipo más') // the card lists 12
  await ui.unmount()
})

test('Fold by weight: 2,000 code spans in one reply add under 80 elements folded; opened, a run-heavy and a block-heavy reply stay under TREE_LIMIT', async ($, on) => {
  const spans = '`a`'.repeat(2000), items = Array.from({ length: 3000 }, () => '- x').join('\n')
  const { ui, files, say } = await chatPane($, on, 'Hola')
  const base = lastEls(files)
  await say(spans)
  expect(lastEls(files) - base).toBeLessThan(80)
  const open = async () => ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  await open()
  expect(lastEls(files)).toBeLessThan(1500)
  expect((await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.text).toBe('Ver menos')
  await say(items)
  expect(lastEls(files) - base).toBeLessThan(80)
  await open()
  expect(lastEls(files)).toBeLessThan(1500)
  const note = await ui.find({ type: 'Text', text: 'Hay más contenido que no cabe aquí' }) // opened and still cut
  expect([note!.props.color, note!.props.dimColor, note!.props.size]).toEqual(['#5c5c5a', undefined, 'footnote'])
  await ui.unmount()
})

test('Fold by weight: when an opened reply makes the pane too heavy, the guard closes that newest one only, and says why', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), list = beats(clock.now())
  list[0]!.chat = Array.from({ length: 4 }, (_, i) => ({ who: 'claude' as const, text: `${'`a`'.repeat(2000)} ${i}` }))
  const { files } = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const mores = async () => (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('more-'))
  const keys = (await mores()).map(b => b.key!)
  let crossed = -1
  for (let i = 0; i < keys.length && crossed < 0; i++) {
    await ui.press({ key: keys[i]! })
    expect(lastEls(files)).toBeLessThan(1500)
    if ((await mores()).find(b => b.key === keys[i])!.text === 'Ver más') crossed = i // this press crossed the limit
  }
  expect(crossed).toBeGreaterThan(0) // some replies opened before the limit was reached
  const text = Object.fromEntries((await mores()).map(b => [b.key, b.text]))
  expect(keys.slice(0, crossed).map(k => text[k])).toEqual(keys.slice(0, crossed).map(() => 'Ver menos')) // the older ones stay open
  // the older ones are open and still cut, each with its note; the closed one says why too
  expect(await ui.findAll({ type: 'Text', text: 'Hay más contenido que no cabe aquí' })).toHaveLength(crossed + 1)
  await ui.unmount()
})

test('Fold by weight: a table header of 2,000 code spans folds to about a few dozen elements, closed and opened', async ($, on) => {
  const heavy = `| ${'`a` '.repeat(2000)}| b |\n|---|---|\n| 1 | 2 |`
  const { ui, files, say } = await chatPane($, on, 'Hola')
  const base = lastEls(files)
  await say(heavy)
  expect(lastEls(files) - base).toBeLessThanOrEqual(100)
  expect((await ui.findAll({ type: 'Button' })).some(b => b.key?.startsWith('more-'))).toBe(true) // it says it was cut
  await ui.press({ key: (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('more-'))!.key! })
  expect(lastEls(files) - base).toBeLessThanOrEqual(100)
  await ui.unmount()
})

// ---- Layout: idle offices leave the map (layout spec AC4) ----

test('AC4: an office quiet for IDLE_MS leaves the map (kept one ms before); pending work keeps it; a returner gets its slot back if free', () => {
  const now = 10_000_000
  const mk = (id: string, slot: number | undefined, at: number, state: Beat['agents'][string]['state'] = 'inactivo') => { const b = newBeat(id, id, at); setAgent(b, MAIN, at, { state }); return { ...b, slot } }
  const a = mk('a', 0, now - IDLE_MS), b = mk('b', 1, now - IDLE_MS + 1)
  const w = worldFromBeats(null, [a, b], now)
  expect(w.depts.map(d => [d.id, d.idle ?? false])).toEqual([['a', true], ['b', false]])
  expect([floorView(w, 0).depts.map(d => d.id), floorView(w, 0).agents.map(x => x.dept)]).toEqual([['b'], ['b']])
  expect(w.depts.find(d => d.id === 'a')!.room).toEqual([]) // no island while idle
  for (const state of ['esperando', 'trabajando', 'leyendo', 'error'] as const) {
    const c = mk('c', 0, now - IDLE_MS)
    setAgent(c, 'ag', now - IDLE_MS, { state })
    expect([state, worldFromBeats(null, [c], now).depts[0]!.idle]).toEqual([state, undefined])
  }
  expect(isIdle({ ...a, ended: true }, now)).toBe(false) // ended: asleep, as before
  expect(claimSlot(mk('z', undefined, now), [a, b], now)).toBe(0) // an idle session holds no island
  expect(claimSlot({ ...a, at: now }, [b], now)).toBe(0) // back: its old slot, free
  expect(claimSlot({ ...a, at: now }, [b, mk('0a', 0, now)], now)).toBe(2) // taken meanwhile: the lowest free
  // an awake session on the idle one's slot keeps it in every pane (the sleeper used to win it by its smaller id)
  expect(worldFromBeats(null, [a, b, mk('y', 0, now, 'trabajando')], now).depts.find(d => d.id === 'y')!.slot).toBe(0)
})

test('AC4: the list keeps an idle office under Sin actividad o listas, said "sin actividad"; the map note counts it; selecting it works with no island', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const quiet = newBeat('q1', 'quieta', now - IDLE_MS)
  setAgent(quiet, MAIN, now - IDLE_MS, { state: 'terminado', activity: 'Te respondió' })
  serveBeats(on, [...beats(now), quiet])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await textsAll(ui, /^\w+ · sin actividad · /)).length).toBe(1)
  expect(await ui.find({ type: 'Text', text: '1 oficina sin actividad, en la lista' })).toBeDefined() // mode 0: the note alone
  await ui.press({ key: 'pick-q1' })
  expect((await ui.findAll({ type: 'Client' })).some(c => c.key === 'field-q1')).toBe(true)
  expect(await hitKeys(ui)).not.toContain('isle-q1')
  await ui.unmount()
})

// ---- The disk screen (addendum AC2 to AC7) ----

const REG = '/home/test/Library/Application Support/Claude/git-worktrees.json'
const WT = (name: string, lease: string | null) => ({ name, path: `/home/test/proj/.claude/worktrees/${name}`, createdAt: 1, leasedBy: lease })
function diskRun(opts: { registry?: unknown; imagesKb?: number } = {}) {
  return (argv: readonly string[]): Ran | undefined => {
    const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
    if (argv[0] === '/bin/df') return ok('Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk3s5 100 50 4718592 52% 1 2 3% /System/Volumes/Data\n')
    if (argv[0] === '/bin/cat' && argv[1] === REG) return opts.registry === undefined ? undefined : ok(JSON.stringify(opts.registry))
    if (argv[0] === '/usr/bin/du' && argv[2]?.endsWith('/images')) return ok(`${opts.imagesKb ?? 0}\t${argv[2]}\n`)
    if (argv[0] === '/usr/bin/du') return ok(argv.slice(2).map((p, i) => `${(i + 1) * 1048576}\t${p}`).join('\n'))
    if (argv[0] === '/usr/bin/find' && argv[1]?.endsWith('/claude-code-sessions')) return ok(argv.filter(x => x.endsWith('.json')).map(n => `${argv[1]}/u/o/${n}`).join('\n') + '\n')
    const id = argv[0] === '/usr/bin/head' ? /\/(local_\w+)\.json$/.exec(argv.at(-1)!)?.[1] : undefined
    if (id) return ok(JSON.stringify({ cliSessionId: id === 'local_a' ? 's2' : 'gone', title: `Título ${id}`, isArchived: id === 'local_b', lastActivityAt: 0 }))
    return undefined
  }
}
const diskCard = async (ui: UI) => {
  const box = await ui.find({ type: 'Box', key: 'usecard-disk' }), svg = (await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Disco')
  return box && svg ? { source: String(svg.props.source) } : undefined
}

test('Disk: a worktree registry that is not a regular file (a FIFO) is never read', async ($, on) => {
  const clock = mock.clock(on, { now: 40 * 24 * 3600000 })
  const { ran, store } = serveBeats(on, beats(clock.now()), { run: diskRun({ registry: { schemaVersion: 2, worktrees: [] } }), stat: p => (p === REG ? { ...fileStat(0), kind: 'other' } : undefined) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => !!store.disk && (store.disk as { duAt: number }).duAt > 0)
  expect((store.disk as { duAt: number } | undefined)?.duAt).toBeGreaterThan(0) // it did measure, and still never read it
  expect(ran.filter(a => a[0] === '/bin/cat')).toEqual([])
  await ui.unmount()
})

test('Disk AC2, AC5, AC6: measured from the drawing (df, then du on the registry paths), a click on its zone opens the card', async ($, on) => {
  const clock = mock.clock(on, { now: 40 * 24 * 3600000 })
  const registry = { schemaVersion: 2, worktrees: [WT('uno', 'local_a'), WT('dos', 'local_b'), WT('tres', null)] }
  const { ran, inits, store } = serveBeats(on, beats(clock.now()), { run: diskRun({ registry }), stat: imageAt(REG) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => !!store.disk && (store.disk as { duAt: number }).duAt > 0)
  const du = ran.filter(a => a[0] === '/usr/bin/du')
  expect(du).toEqual([['/usr/bin/du', '-sk', `${HOME}`, ...registry.worktrees.map(w => w.path)]]) // only the registry's own paths, and Agentville's folder
  expect(ran.filter(a => a[0] === '/bin/df')).toEqual([['/bin/df', '-k', '/home/test']])
  // the slow ones get 5 minutes, under the lock's 10 (C1)
  expect(ran.filter(a => a[0] === '/usr/bin/find')).toEqual([['/usr/bin/find', '/home/test/Library/Application Support/Claude/claude-code-sessions', '-mindepth', '3', '-maxdepth', '3', '-type', 'f', '(', '-name', 'local_a.json', '-o', '-name', 'local_b.json', ')']])
  expect(ran.some(a => a[0] === '/bin/sh')).toBe(false) // argv only, everywhere
  const slow = ran.map((a, i) => [a[0], inits[i]]).filter(([c]) => c === '/usr/bin/du' || c === '/usr/bin/find')
  expect(slow.map(x => x[1])).toEqual([{ timeoutMs: 300000 }, { timeoutMs: 300000 }])
  expect(store['disk-lock']).toBeUndefined() // released
  await ui.press({ key: 'pal-hotel' }) // a redraw with the new numbers
  expect(await hitKeys(ui)).toContain('screen-disk')
  expect(await diskCard(ui)).toBeUndefined() // drawn only once opened, like the HQ's
  await onMap(ui, 'screen-disk')
  const card = await diskCard(ui)
  expect(card?.source).toContain('4.5 GB libres') // 4718592 KB
  expect(card?.source).toContain('Copias de trabajo 9.0 GB · 3') // du said 2, 3 and 4 GB (and 1 GB for Agentville's folder)
  expect(card?.source).toContain('Sin actividad hace 30 días o más: 3') // none is at work, and all are 40 days old
  expect(card?.source).toContain('Carpeta de Agentville: 1024 MB')
  // the biggest first: the session's name (its office, else the app's title), its state and size
  for (const [name, status, size] of [['tres', 'reserva', '4.0 GB'], ['Título local_b', 'dormida', '3.0 GB'], ['blog', 'sin actividad', '2.0 GB']]) {
    expect(card?.source).toMatch(new RegExp(`>${name}</text>.*?>${status}</text>.*?>${size}</text>`))
  }
  expect(card?.source).toContain('Los botones de limpieza están bajo el mapa.')
  // no new measure within 5 min; the ticker never measures
  const before = ran.length
  await clock.advance(4 * 60000)
  expect(ran.slice(before).filter(a => a[0] === '/bin/df' || a[0] === '/usr/bin/du')).toEqual([])
  await ui.unmount()
})

test('Disk AC2: another pane holding the lock measures; the ticker alone never runs df or du', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { ran, store } = serveBeats(on, beats(clock.now()), { run: diskRun() })
  store['disk-lock'] = clock.now() - 60000 // another pane started a minute ago
  await $.command.run(OPEN)
  const ui = await mountPane($)
  for (let i = 0; i < 10; i++) await clock.advance(1000)
  expect(ran.filter(a => a[0] === '/bin/df' || a[0] === '/usr/bin/du')).toEqual([])
  expect(store['disk-lock']).toBe(clock.now() - 10000 - 60000) // never taken over nor released by this pane
  await ui.unmount()
})

test('Disk AC3: with no registry the card shows free disk and Agentville\'s folder only; du reads no guessed path', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { ran, store } = serveBeats(on, beats(clock.now()), { run: diskRun({ registry: { schemaVersion: 3, worktrees: [WT('x', null)] } }), stat: imageAt(REG) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => !!store.disk && (store.disk as { duAt: number }).duAt > 0)
  expect(ran.filter(a => a[0] === '/usr/bin/du')).toEqual([['/usr/bin/du', '-sk', HOME]])
  await onMap(ui, 'screen-disk')
  const src = (await diskCard(ui))!.source
  expect(src).toContain('No se pudo leer qué copias de trabajo hay.')
  expect(src).toContain('Carpeta de Agentville: 1024 MB')
  expect(src).not.toContain(t('disk.wtShort')) // no project copies line without the registry
  expect((await btnsAll(ui)).filter(b => b.key?.startsWith('disk-')).map(b => b.key)).toEqual(['disk-images']) // nothing stale known: no asks
  await ui.unmount()
})

test('Disk AC7: pinned, up to three offices are asked to remove stale worktrees (the first primary), and images are deleted after a confirm', async ($, on) => {
  const clock = mock.clock(on, { now: 40 * 24 * 3600000 })
  const registry = { schemaVersion: 2, worktrees: [WT('uno', null)] }
  const img = (name: string): Entry => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })
  // 5 MB of images, 1 MB of them (the drafted one) still there once the others are deleted
  let deleted = false
  const disk = diskRun({ registry, imagesKb: 5120 }), du = (kb: number, p: string) => ({ exitCode: 0, stdout: `${kb}\t${p}\n`, stderr: '' })
  const run = (argv: readonly string[]) => {
    if (argv[0] === '/bin/rm' && argv.some(x => x.startsWith(`${HOME}/images/`))) deleted = true
    return argv[0] === '/usr/bin/du' && argv[2]?.endsWith('/images') && deleted ? du(1024, argv[2]) : disk(argv)
  }
  const { ran, files, toasts, store } = serveBeats(on, crowd(4, clock.now()), { run, stat: imageAt(REG),
    dir: p => (p === `${HOME}/images` ? [img('a.png'), img('a.txt'), img('drafted.png'), { ...img('sub'), kind: 'dir' }] : undefined) })
  store['mailbox-key'] = 'k-test'
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => !!store.disk && (store.disk as { duAt: number }).duAt > 0)
  await ui.press({ key: 'pick-c1' })
  await ui.post({ draft: `mira ${HOME}/images/drafted.png` }, { in: 'field-c1' }) // an unsent message names it (AU item 3)
  expect(await btn(ui, 'disk-images')).toBeUndefined() // only while its card is pinned
  await onMap(ui, 'screen-disk')
  const words = async () => (await btnsAll(ui)).filter(b => b.key?.startsWith('disk-')).map(b => b.text)
  expect(await words()).toEqual(['▸ Pedir a Sesión 1 que borre copias de trabajo sin uso (30 días o más)', 'Pedir a Sesión 2 que borre copias de trabajo sin uso (30 días o más)', 'Pedir a Sesión 3 que borre copias de trabajo sin uso (30 días o más)', 'Borrar imágenes de los chats en Agentville'])
  // BD item 7: asking an office asks first, as the images button: the first press arms it, 5 s disarm it, a second sends
  await ui.press({ key: 'disk-order-1' })
  expect((await words())[1]).toBe('Confirmar: pedir a Sesión 2 que borre copias de trabajo sin uso (30 días o más)')
  await clock.advance(5000)
  await until(clock, () => false, 5)
  expect([(await words())[1], ordersIn(files, 'c1')]).toEqual(['Pedir a Sesión 2 que borre copias de trabajo sin uso (30 días o más)', []])
  await ui.press({ key: 'disk-order-1' })
  expect(ordersIn(files, 'c1')).toEqual([])
  await ui.press({ key: 'disk-order-1' })
  await until(clock, () => ordersIn(files, 'c1').length > 0)
  expect(ordersIn(files, 'c1').map(c => [c.kind, c.text])).toEqual([['msg', t('disk.order')]])
  expect(t('disk.order', undefined, 'en')).toContain('List them first and skip any with uncommitted or unpushed changes; tell the person what you removed.')
  const rm = () => ran.filter(a => a[0] === '/bin/rm' && a.some(x => x.startsWith(`${HOME}/images`)))
  // the first press arms it and says how much (the card's own buttons keep it open); an unrelated redraw disarms it
  await ui.press({ key: 'disk-images' })
  expect((await words()).at(-1)).toBe('Confirmar: borrar imágenes (5 MB)')
  await ui.press({ key: 'pal-hotel' }) // any other press closes the card, and redraws
  expect(await btn(ui, 'disk-images')).toBeUndefined()
  await onMap(ui, 'screen-disk')
  expect((await words()).at(-1)).toBe('Borrar imágenes de los chats en Agentville')
  // armed again, 5 s pass: disarmed, nothing deleted
  await ui.press({ key: 'disk-images' })
  await clock.advance(5000)
  await until(clock, () => false, 5)
  expect((await words()).at(-1)).toBe('Borrar imágenes de los chats en Agentville')
  expect(rm()).toEqual([])
  // armed, then confirmed: deleted
  await ui.press({ key: 'disk-images' })
  await ui.press({ key: 'disk-images' })
  await until(clock, () => toasts.some(x => x.includes('MB liberados')))
  expect(rm()).toEqual([['/bin/rm', '-f', `${HOME}/images/a.png`, `${HOME}/images/a.txt`]]) // the drafted image stays
  expect(toasts).toContain('Imágenes de Agentville borradas: 4 MB liberados. Se conservan las imágenes de mensajes sin enviar') // measured again
  await ui.unmount()
})

test('Disk AC7: images are deleted 500 paths at a time, so a full folder never passes the argument limit', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const names = Array.from({ length: 1201 }, (_, i) => `up-${i}.png`)
  const { ran, toasts } = serveBeats(on, beats(clock.now()), { run: diskRun({ imagesKb: 5120 }),
    dir: p => (p === `${HOME}/images` ? names.map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) : undefined) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await onMap(ui, 'screen-disk')
  await ui.press({ key: 'disk-images' })
  await ui.press({ key: 'disk-images' })
  await until(clock, () => toasts.some(x => x.includes('MB liberados')))
  const rms = ran.filter(a => a[0] === '/bin/rm' && a.some(x => x.startsWith(`${HOME}/images/`)))
  expect(rms.map(a => a.length - 2)).toEqual([500, 500, 201])
  expect(rms.flatMap(a => a.slice(2))).toEqual(names.map(n => `${HOME}/images/${n}`))
  await ui.unmount()
})

// AZ item 4: a confirm that deletes nothing, or a folder it cannot measure again, never claims MB freed.
test('Disk AC7: with every image held the toast says nothing was deleted; with the second du failing it gives no MB', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const img = (name: string): Entry => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })
  let names = ['drafted.png'], deleted = false
  const disk = diskRun({ imagesKb: 5120 })
  const run = (argv: readonly string[]) => {
    if (argv[0] === '/bin/rm' && argv.some(x => x.startsWith(`${HOME}/images/`))) deleted = true
    return argv[0] === '/usr/bin/du' && argv[2]?.endsWith('/images') && deleted ? undefined : disk(argv) // fails once anything is deleted
  }
  const { ran, toasts } = serveBeats(on, beats(clock.now()), { run, dir: p => (p === `${HOME}/images` ? names.map(img) : undefined) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  await ui.post({ draft: `mira ${HOME}/images/drafted.png` }, { in: 'field-s1' }) // an unsent message names the only image
  await onMap(ui, 'screen-disk')
  await ui.press({ key: 'disk-images' })
  await ui.press({ key: 'disk-images' })
  await until(clock, () => toasts.length > 0)
  expect(toasts).toEqual(['No se borró nada: se conservan las imágenes de mensajes sin enviar'])
  expect(ran.filter(a => a[0] === '/bin/rm' && a.some(x => x.startsWith(`${HOME}/images/`)))).toEqual([])
  expect(t('disk.imagesNone', undefined, 'en')).toBe('Nothing deleted: images of unsent messages are kept')
  names = ['a.png', 'drafted.png']
  if (!(await btn(ui, 'disk-images'))) await onMap(ui, 'screen-disk')
  await ui.press({ key: 'disk-images' })
  await ui.press({ key: 'disk-images' })
  await until(clock, () => toasts.length > 1)
  expect(toasts[1]).toBe('Imágenes de Agentville borradas. Se conservan las imágenes de mensajes sin enviar') // no figure
  await ui.unmount()
})

test('Disk AC7: with no images the button says so and deletes nothing', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { ran, toasts } = serveBeats(on, beats(clock.now()), { run: diskRun({ imagesKb: 0 }) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await onMap(ui, 'screen-disk')
  await ui.press({ key: 'disk-images' })
  await until(clock, () => toasts.length > 0)
  expect(toasts).toContain('No hay imágenes')
  expect(ran.filter(a => a[0] === '/bin/rm' && a[1] === '-rf')).toEqual([])
  await ui.unmount()
})

// ---- /agentville refresh (addendum AC8 to AC11) ----

test('Refresh AC8 to AC11: every office with nobody pending hides until its next beat, old ended sessions go, no pane opens', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000_000 }), now = clock.now()
  const [busy, done] = beats(now)
  const old = { ...newBeat('viejo', 'vieja', now - SLEEP_MS), ended: true }, mine = { ...newBeat('s-test', 'esta', now - SLEEP_MS - 5), ended: true }
  const { store, panes, ran } = serveBeats(on, [busy!, done!, old, mine])
  store.hidden = { gone: 5, s2: 1 } // a session with no file left, and an old mark: pruned
  const r = await $.command.run({ ...OPEN, args: 'limpiar' })
  expect(r).toEqual({ text: 'Oficinas ocultas: 1. Datos de Agentville de sesiones ya terminadas borrados: 1 (tus chats no se tocan). Cada oficina vuelve con su próxima actividad.' })
  expect(panes).toEqual([]) // it opens no pane
  expect(store.hidden).toEqual({ s2: done!.at, 's-test': mine.at }) // s1 waits for you: never hidden; the ended one of this session stays marked
  expect(ran.filter(a => a[0] === '/bin/rm')).toEqual([['/bin/rm', '-f', `${HOME}/sessions/viejo.json`, `${HOME}/commands/viejo.json`, `${HOME}/control/viejo.json`]])
  // the hidden office leaves the map and comes back in its old slot with its next beat
  const w = worldFromBeats(null, [busy!, done!], now, store.hidden as Record<string, number>)
  expect(floorView(w, 0).depts.map(d => d.id)).toEqual(['s1'])
  expect(claimSlot({ ...newBeat('n', 'n', now), slot: undefined }, [{ ...busy!, slot: 0 }, { ...done!, slot: 1 }], now, store.hidden as Record<string, number>)).toBe(1)
  const back = { ...done!, at: now + 1, slot: 1 }
  const again = worldFromBeats(w, [{ ...busy!, slot: 0 }, back], now + 1, store.hidden as Record<string, number>).depts.find(d => d.id === 's2')!
  expect([again.slot, again.idle ?? false]).toEqual([1, false])
  store.lang = 'en'
  expect(await $.command.run({ ...OPEN, args: ' REFRESH now' })).toEqual({ text: 'Offices hidden: 0. Agentville data of ended sessions deleted: 1 (your chats are not touched). Each office comes back with its next activity.' })
})

// ---- The heartbeat without session.start, and the plan left open (layout-b E1, E2, E3) ----

for (const hook of ['turn.start', 'tool.call', 'PermissionRequest'] as const) {
  test(`E-AC1: with no session.start, ${hook} makes the one heartbeat, its slot claimed and the main agent in the hook's state`, async ($, on) => {
    mock.clock(on, { now: 100000 })
    const { files, reads } = serveBeats(on, [newBeat('other', 'otra', 100000 - 1)].map(b => ({ ...b, slot: 0 })))
    on('turn.start', ($2, e) => ({ turnId: e.turnId }))
    on('tool.call', () => ({ result: 'ok' }) as never)
    on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'Asked in the session' } }))
    const fire = () => (hook === 'turn.start' ? $.turn.start({ text: 'hola', turnId: 't1' })
      : hook === 'tool.call' ? $.tool.call({ tool: 'Read', file_path: '/x/a.ts' } as never)
      : $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } }))
    await Promise.all([fire(), fire()]) // two hooks at once: one beat
    const own = `${HOME}/sessions/s-test.json`
    expect(reads.filter(p => p === own)).toHaveLength(1) // the carry-over read: newBeat ran once
    expect(Object.keys(files).filter(p => p.includes('/sessions/'))).toEqual([own])
    expect([beatOf(files).slot, beatOf(files).agents[MAIN]!.state]).toEqual([1, hook === 'turn.start' ? 'trabajando' : hook === 'tool.call' ? 'leyendo' : 'esperando'])
    await startSession($) // a later start keeps the same beat
    expect(reads.filter(p => p === own)).toHaveLength(1)
    expect([beatOf(files).id, beatOf(files).slot]).toEqual(['s-test', 1])
  })
}

test('E-AC2: a main turn that ends with its plan open says how many steps; a new plan, a finished plan or a subagent clears or never sets it', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const { files } = serveBeats(on, [])
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('turn.complete', ($2, e) => ({ text: e.answer }))
  await startSession($)
  const plan = (open: number) => $.tool.call({ tool: 'TodoWrite', todos: ['a', 'b', 'c', 'd'].map((content, i) => ({ content, status: i < 4 - open ? 'completed' : 'pending' })) } as never)
  const end = (agentId?: string) => $.turn.complete({ answer: 'listo', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId ? { agentId } : {}) } as never)
  await plan(2); await end()
  expect(beatOf(files).openSteps).toBe(2)
  await plan(2)
  expect(beatOf(files).openSteps).toBeUndefined() // the plan written again: gone
  await end('ag1')
  expect(beatOf(files).openSteps).toBeUndefined() // a subagent's turn never sets it
  await plan(0); await end()
  expect(beatOf(files).openSteps).toBeUndefined() // all done
  await plan(1)
  await $.session.end({ reason: 'other', sessionId: 's-test', resume: 'none' as never })
  expect(beatOf(files).openSteps).toBe(1)
})

test('E-AC2: the list says the plan was left open, in both languages; an idle office with open steps too; never while its Jefe works', async ($, on) => {
  const now = mock.clock(on, { now: 10_000_000 }).now()
  const left = newBeat('l1', 'dejada', now)
  setAgent(left, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  notesFrom(left, { todos: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'pending' }, { content: 'c', status: 'pending' }] })
  left.openSteps = 2
  const quiet = newBeat('q1', 'quieta', now - IDLE_MS)
  setAgent(quiet, MAIN, now - IDLE_MS, { state: 'inactivo', activity: 'Espera' })
  notesFrom(quiet, { todos: [{ content: 'a', status: 'in_progress' }] })
  const working = newBeat('w1', 'activa', now)
  setAgent(working, MAIN, now, { state: 'trabajando', activity: 'Edit x.ts' })
  notesFrom(working, { todos: [{ content: 'a', status: 'pending' }] })
  working.openSteps = 1
  const kid = { ...newBeat('k1', 'hija', now), parent: 'l1' } // the left one coordinates a session: said before its open steps
  setAgent(kid, MAIN, now, { state: 'trabajando', activity: 'Edit y.ts' })
  const { store } = serveBeats(on, [left, quiet, working, kid])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await textsAll(ui, /terminó sin cerrar 2 pasos/)).length).toBe(1)
  expect((await textsAll(ui, /coordina 1 sesión · terminó sin cerrar 2 pasos/)).length).toBe(1)
  expect((await textsAll(ui, /sin actividad · terminó sin cerrar 1 paso/)).length).toBe(1) // the idle one, from its notes
  expect((await textsAll(ui, /terminó sin cerrar/)).length).toBe(2) // the working one says nothing
  expect((await textsAll(ui, /terminó · terminó/)).length).toBe(0) // the state word once, not before its own note
  store.lang = 'en'
  await ui.press({ key: 'pal-hotel' })
  expect((await textsAll(ui, /finished with 2 steps open/)).length).toBe(1)
  expect((await textsAll(ui, /finished with 1 step open/)).length).toBe(1)
  await ui.unmount()
})

test('layout: a list row clips and truncates inside its column; a chat face sits at the top of its row beside its bubble', async ($, on) => {
  const now = mock.clock(on, { now: 100000 }).now()
  oldList(serveBeats(on, beats(now)).store)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  type N = { type?: string; props?: Record<string, unknown> & { key?: string }; children?: unknown[] }
  const all = (n: unknown): N[] => (n && typeof n === 'object' ? [n as N, ...((n as N).children ?? []).flatMap(all)] : [])
  const nodes = all(await ui.drawn())
  const parentOf = (x: N) => nodes.find(n => (n.children ?? []).includes(x as never))!
  // The list column and each row clip; the Client's wrapper Box grows from no width into the rest of its row and clips,
  // so its lines truncate. The Client itself has no width or grow (unproven on the desktop).
  const pick = nodes.find(n => n.props?.key === 'btns-pick-s1')!
  expect([pick.props!.width, pick.props!.flexGrow]).toEqual([undefined, undefined])
  const wrap = parentOf(pick)
  expect([wrap.type, wrap.props!.key, wrap.props!.width, wrap.props!.flexGrow, wrap.props!.overflow]).toEqual(['Box', 'wrap-btns-pick-s1', 0, 1, 'hidden'])
  // The message field shrinks the same way, so the compose strip after it (never shrunk) stays whole at a narrow pane.
  const field = nodes.find(n => n.props?.key === 'field-s1')!, fwrap = parentOf(field)
  expect([field.props!.width, field.props!.flexGrow]).toEqual(['100%', undefined])
  expect([fwrap.type, fwrap.props!.width, fwrap.props!.flexGrow, fwrap.props!.minWidth, fwrap.props!.overflow]).toEqual(['Box', 0, 1, 0, 'hidden'])
  const after = parentOf(fwrap).children![parentOf(fwrap).children!.indexOf(fwrap as never) + 1] as N
  expect([after.props!.key, after.props!.flexShrink, after.props!.alignSelf]).toEqual(['send-s1', 0, 'center']) // Send centred on the field
  expect([(after.children![0] as N).props!.key, parentOf(fwrap).props!.alignItems]).toEqual(['strip-btns-compose-s1-0', 'center'])
  const row = parentOf(wrap), list = parentOf(parentOf(row))
  expect([row.props!.key, row.props!.overflow]).toEqual(['item-s1', 'hidden'])
  expect([list.props!.width, list.props!.minWidth, list.props!.overflow]).toEqual([0, 0, 'hidden'])
  const lines = await ui.findAll({ type: 'Text', in: 'btns-pick-s1' })
  expect(lines.length).toBe(2)
  for (const l of lines) expect(l.props.wrap).toBe('truncate-end')
  // Each chat row: the face (whole, never shrunk) then the bubble, top-aligned.
  const rows = nodes.filter(n => String(n.props?.key ?? '').startsWith('row-'))
  expect(rows.length).toBe(2)
  for (const r of rows) {
    expect(r.props!.alignItems).toBe('flex-start')
    const [face, bubble] = (r.children ?? []) as N[]
    expect(face!.props!.flexShrink).toBe(0)
    expect(((face!.children ?? []) as N[])[0]!.type).toBe('Svg')
    expect(bubble!.props!.borderStyle).toBe('round')
  }
  // The slash menu open: the row and Send go to the top, so the menu pushes nothing.
  await ui.post({ menu: true }, { in: 'field-s1' })
  const open = all(await ui.drawn()), send = open.find(n => n.props?.key === 'send-s1')!
  expect([send.props!.alignSelf, open.find(n => (n.children ?? []).includes(send as never))!.props!.alignItems]).toEqual(['flex-start', 'flex-start'])
  await ui.unmount()
})

test('E-AC3: the Agentville flow asks the main agent to close its plan before it ends a turn; the skill flow is unchanged', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const a = await flowSeen($, on, undefined)
  expect(a.team[0]).toContain('Before ending a turn, close your plan: each step done or removed.')
  a.store['team-flow'] = { kind: 'skill', name: 'x' } // the skill flow, read from the code
  const skill = (await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })).sections.filter(x => x.id === 'agentville:team-flow').map(x => x.text)
  expect(skill).toEqual([SKILL_RULE('x')])
  expect(skill[0]).not.toContain('close your plan')
})

// skills/team-flow/SKILL.md's description fires only when the session holds this exact head, quoted; the test
// runner cannot read a .md, so this pins the rule's half and `grep -c '"Agentville team flow (the person chose it)"'`
// on the SKILL.md checks the other.
test('The Agentville flow section starts with the head the team-flow skill description waits for', async ($, on) => {
  mock.clock(on, { now: 100000 })
  expect((await flowSeen($, on, undefined)).team[0]!.startsWith('Agentville team flow (the person chose it).')).toBe(true)
})

test('Tiered flow: the Agentville section names the skill, the triage and the three tiers; the four-reviewer rule is no longer for every change', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const r = (await flowSeen($, on, undefined)).team[0]!
  for (const s of ['agentville:team-flow', 'Triage by risk', 'when unsure, go up', 'Small:', 'Medium:', 'Large:', 'Only [blocking] findings open a round.']) expect(r).toContain(s)
  expect(r).not.toMatch(/agentville:team-flow: spec-writer, one or more builders, four reviewers in parallel/)
  expect(r.indexOf('Large:')).toBeLessThan(r.indexOf('4 parallel reviewers')) // four reviewers only inside the Large tier
  expect(r.length).toBeLessThanOrEqual(1440) // room for the team prefix, the impact step, the merge and deploy rule, no flow for questions, and the person's own skill first (AF)
})

// Layout AC6 / addendum AC12: render-log elements, nothing selected. Measured on e0f41a6 before the even grid and the
// disk screen: demo 678, 6 offices 753, 16 offices 802. The owner accepted growth up to demo 691 and 16 offices 820
// and asked for the 6-office case pinned at its measure. On whole tiles (round 1) the grid alone measures 678, 751
// and 802; the disk screen's zone and card add 6 in each case: 684, 757, 808. Each case is pinned at what it measured.
// The list rows' wrapper Box (one per row Client, so the Client gets no width of its own) adds 10 on 16 offices: 818.
// The pane chrome as the mock draws it (each button a picture with its click on top, 8 elements instead of 1 or 2; the
// banner a picture over two click rows) adds 44, 42 and 52: 728, 799, 870. The header's ES | EN switch (two pictures
// with their clicks, 7 elements each, in one row Box) adds 15: 743, 814, 885. Producto's own room moves the coffee
// spots into the lobby: the demo's three coffee drinkers stand at x - y of 0, 1 and 7 instead of 13, 13 and 15 (two
// shared a screen column before), 3 more bands of zones, 35 more elements: demo 778.
for (const [name, list, cap] of [['demo', demoBeats, 778], ['6', (n: number) => crowd(6, n), 814], ['16', (n: number) => crowd(16, n), 885]] as const) {
  test(`AC6: the pane with ${name} offices stays under its measured weight and TREE_LIMIT`, async ($, on) => {
    const now = mock.clock(on, { now: 100_000_000 }).now()
    const { files } = serveBeats(on, list(now))
    await $.command.run(OPEN)
    const ui = await mountPane($)
    const els = lastEls(files)
    expect([name, els <= cap, els < 1500]).toEqual([name, true, true])
    await ui.unmount()
  })
}

test('C3: a session that ended and starts again in the same module (/clear) gets a new heartbeat of its own, not ended', async ($, on) => {
  mock.clock(on, { now: 100000 })
  let id = 's-test'
  const { files } = serveBeats(on, [], { id: () => id })
  await startSession($)
  await $.session.end({ reason: 'clear', sessionId: 's-test', resume: 'none' as never })
  expect(beatOf(files).ended).toBe(true)
  id = 's-new'
  await startSession($)
  const fresh = JSON.parse(files[`${HOME}/sessions/s-new.json`] ?? 'null') as Beat | null
  expect([fresh?.id, fresh?.ended]).toEqual(['s-new', false])
  expect(beatOf(files).ended).toBe(true) // the old one stays as it ended
})

// ---- Questions and suggested sessions in the despacho (wrap_up, start_session) ----

const wrapRow = (input: unknown, id = 'toolu_w1') => ({ type: 'assistant', content: [{ type: 'tool_use', id, name: 'mcp__ccd_turn__wrap_up', input }] })
const startRow = (title: string, id: string) => ({ type: 'assistant', content: [{ type: 'tool_use', id, name: 'mcp__ccd_session__start_session', input: { title, initiation: 'own_initiative', prompt: `Brief de ${title}: qué, dónde y cuándo está listo.` } }] })
const resultRow = (id: string, text: string) => ({ type: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] })
const appendRow = ($: Engine, message: unknown, door = 'repl') => $.session.append({ message: message as never, door: door as never, origin: { kind: 'repl' } as never, uuid: `u${Math.random()}` })
const endTurn = ($: Engine, more: Record<string, unknown> = {}) => $.turn.complete({ answer: 'listo', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...more } as never)
const QUESTION = '¿Arreglo el redondeo final para que el total salga con dos decimales fijos?'
const ACTIONS = [{ label: 'Sí, arréglalo', message: 'Sí, arregla el redondeo final. Con ticket y PR.' }, { label: 'Solo mira' }, { label: 'Commit', action: 'commit' }, { label: 'Verificar', action: 'verify' }]
// The session s-test (its heartbeat is the one the pane reads) ends a turn asking, with two suggested sessions.
async function asking($: Engine, on: On, opts: { actions?: unknown[]; blocked?: boolean; offers?: boolean; ask?: false; setup?: () => void } = {}) {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const served = serveBeats(on, [newBeat('s-test', 'proj', now)])
  on('turn.complete', ($2, e) => ({ text: e.answer }))
  on('turn.start', ($2, e) => ({ turnId: e.turnId }))
  opts.setup?.()
  await startSession($)
  if (opts.offers !== false) {
    await appendRow($, startRow('Limpiar los worktrees', 'toolu_s1'))
    await appendRow($, resultRow('toolu_s1', 'Proposed "Limpiar los worktrees" (task_id: task_abc123).'))
    await appendRow($, startRow('Medir la caché', 'toolu_s2'))
    await appendRow($, resultRow('toolu_s2', 'Proposed "Medir la caché" (task_id: task_def456).'))
  }
  await appendRow($, wrapRow(opts.ask === false ? { recap: 'Encontré la causa.' } : { recap: 'Encontré la causa.', ask: QUESTION, actions: opts.actions ?? ACTIONS, ...(opts.blocked === false ? {} : { blocked: true }) }))
  await endTurn($)
  return { ...served, clock }
}
const jefeName = agentName('s-test-jefe')

test('Asks AC4, AC9, AC10: a turn that ends asking makes the Jefe wait; the card shows each reply and the exact text it sends', async ($, on) => {
  const { files } = await asking($, on)
  const main = beatOf(files).agents.main!
  expect([main.state, main.req, beatOf(files).ask?.q]).toEqual(['esperando', null, QUESTION])
  expect(beatOf(files).chat?.at(-1)).toEqual({ who: 'claude', text: 'Encontré la causa.' }) // the recap is a chat row
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await bannerAlt(ui)).toBe(`Te espera 1. ${jefeName} (proj): ${QUESTION}`) // cut by the strip's width, with an ellipsis
  expect(await ui.find({ type: 'Text', text: `${jefeName} te pregunta:` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: QUESTION })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Bloqueado hasta que respondas' })).toBeDefined()
  // one Client per reply that sends something, its exact text under it; the app-only one is dim text, no button
  expect((await areas(ui)).filter(k => k.startsWith('btns-q-'))).toEqual(['btns-q-s-test-0', 'btns-q-s-test-1', 'btns-q-s-test-2'])
  expect((await btnsAll(ui)).filter(b => b.key?.startsWith('reply-')).map(b => b.text)).toEqual(['▸ Sí, arréglalo', 'Solo mira', 'Commit']) // the first reply is the recommended one
  for (const s of ['Envía: «Sí, arregla el redondeo final. Con ticket y PR.»', 'Envía: «Solo mira»', 'Envía: «Haz el commit.»', 'Verificar (en la app)']) {
    const x = await ui.find({ type: 'Text', text: s })
    expect([s, x?.props.wrap, x?.props.color]).toEqual([s, 'wrap', expect.any(String)])
  }
  // the two suggested sessions are not in the detail: with the question they are notes on your desk, "3 notas"
  expect((await btnsKeys(ui)).filter(k => k.startsWith('btns-o-'))).toEqual([])
  expect(await notesDrawn(ui, '3 notas')).toBe(true)
  expect(await hitKeys(ui)).toContain('card-close') // their card opened by itself, over the note's zone
  // the banner: its whole strip goes to it, nothing else
  expect((await btnsAll(ui)).filter(b => b.key?.startsWith('go-first') || b.key?.startsWith('top-')).map(b => b.key)).toEqual(['go-first', 'go-first~2'])
  expect((await ui.findAll({ type: 'Button' })).filter(b => ['a', 'r'].includes(String(b.props.hotkey)))).toEqual([]) // no hotkeys for Claude's words
  await ui.unmount()
})

test('Asks AC10: a surface that is not the desktop lists the question where it lists a command', async ($, on) => {
  await asking($, on)
  await $.command.run(OPEN)
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'terminal', component: 'Pane', requestId: 'agentville', props: PANE })
  expect(await ui.find({ type: 'Text', text: new RegExp(`Jefe · proj: ${QUESTION.replace(/[?¿]/g, '.')}`) })).toBeDefined()
  await ui.unmount()
})

test('Asks AC9: a recap-only wrap_up leaves the Jefe done, no wait; offers alone make it wait', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const { files } = serveBeats(on, [newBeat('s-test', 'proj', now)])
  on('turn.complete', ($2, e) => ({ text: e.answer }))
  await startSession($)
  await appendRow($, wrapRow({ recap: 'Listo, sin preguntas.' }))
  await endTurn($)
  expect([beatOf(files).agents.main!.state, beatOf(files).ask]).toEqual(['terminado', undefined])
  await appendRow($, startRow('Otra cosa', 'toolu_s9'))
  await appendRow($, resultRow('toolu_s9', 'Start sessions only on the user\'s own words to you here.')) // refused: no card
  await endTurn($)
  expect(beatOf(files).agents.main!.state).toBe('terminado')
  await appendRow($, startRow('Otra cosa', 'toolu_s10'))
  await appendRow($, resultRow('toolu_s10', 'Proposed (task_id: task_zzz999).'))
  await endTurn($)
  expect([beatOf(files).agents.main!.state, beatOf(files).agents.main!.activity]).toEqual(['esperando', 'Te sugiere sesiones'])
})

test('Asks AC6: a reply goes once as the Jefe\'s prompt, byte for byte, never relayed to a selected subagent', async ($, on) => {
  const { files, toasts } = await asking($, on)
  await mark2(files, b => setAgent(b, 'ag1', 100_000, { role: 'rev', kind: 'code-reviewer', state: 'leyendo', activity: 'Read a.ts' }))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s-test-rev' }) // a subagent selected: the field would relay to it, a reply never does
  expect(await ui.find({ type: 'Text', text: `${jefeName} te pregunta:` })).toBeDefined()
  const press = ui.press({ key: 'reply-0' }), again = ui.press({ key: 'reply-0' })
  await Promise.all([press, again])
  const cmds = (JSON.parse(files[`${HOME}/control/s-test.json`]!) as { cmds: Cmd[] }).cmds
  expect(cmds.map(c => [c.kind, c.text])).toEqual([['msg', 'Sí, arregla el redondeo final. Con ticket y PR.']])
  expect(toasts.at(-1)).toBe(`Enviado a ${jefeName}`)
  await ui.unmount()
})
// The note on your desk is drawn in the map's furniture; its card is a layer over the map with a zone per pill.
const notesDrawn = async (ui: UI, label = '2 notas') => (await ui.findAll({ type: 'Svg' })).some(x => String(x.props.source).includes(`>${label}</text>`))
const notesCard = async (ui: UI) => String((await ui.findAll({ type: 'Svg' })).find(x => ['Sesiones sugeridas', 'Suggested sessions', 'Notas', 'Notes'].includes(String(x.props.alt)))?.props.source ?? '')
// Edits the session's own heartbeat as written, for the pane to read on its next sync.
const mark2 = async (files: Record<string, string>, fn: (b: Beat) => void) => { const b = beatOf(files); fn(b); files[`${HOME}/sessions/s-test.json`] = JSON.stringify(b) }

test('Asks AC6: an asleep session sends nothing and says so', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const b = { ...newBeat('s1', 'dormida', now), ended: true, endReason: 'other', ask: { id: 'toolu_w1', q: '¿Sigo?', replies: [{ label: 'Sí', text: 'Sí, sigue' }] } }
  setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te pregunta algo' })
  const { files, toasts } = serveBeats(on, [b])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  await ui.press({ key: 'reply-0' })
  expect([files[`${HOME}/control/s1.json`], toasts.at(-1)]).toEqual([undefined, 'No se puede enviar: la sesión está dormida'])
  await ui.unmount()
})

// Descartar calls the app's own tool from the pane; with no tool, an error or the app's refusal the prompt goes to the
// Jefe; a no from the permission check stays a no.
for (const [name, tools, answer, path] of [
  ['the app dismisses it', true, { result: 'ok', text: 'Task task_def456 withdrawn. The chip is no longer shown to the user.' }, 'tool'],
  // the app's real words for a task it no longer holds (started from its own card), transcripts 2026-10-20
  ['the app had it already: the note goes, said so', true, { result: 'ok', text: 'No pending task with id task_def456, possible causes include it never being queued in this session. Do not re-flag it.' }, 'settled'],
  ['no such tool: the Jefe gets the prompt', false, null, 'prompt'],
  ['the app refuses: the Jefe gets the prompt', true, { result: 'x', text: 'Start sessions only on the user\'s own words to you here.' }, 'prompt'],
  ['the call rejects otherwise (the tool gone since the list): the Jefe gets the prompt', true, 'throw', 'prompt'],
  ['you said no: nothing else', true, { deny: 'No, gracias' }, 'none'],
] as const) {
  test(`Asks AC7, plan A: Descartar, ${name}`, async ($, on) => {
    const calls: Record<string, unknown>[] = []
    const { files, toasts, store, clock } = await asking($, on, { ask: false, setup: () => {
      on('tool.list', () => ({ value: tools ? [{ name: 'mcp__ccd_session__start_session', description: '', mcp: true }, { name: 'mcp__ccd_session__dismiss_task', description: '', mcp: true }] : [] }))
      on('tool.call', ($2, e) => { if (e.tool.includes('ccd_session')) { calls.push(e as never); if (answer === 'throw') throw new Error('No tool named mcp__ccd_session__dismiss_task'); return answer as never } return { result: 'ok' } as never })
    } })
    await $.command.run(OPEN)
    const ui = await mountPane($)
    await clock.advance(600) // the card opened by itself: its pills wait out NOTE_CALM
    await onMap(ui, 'note-dismiss-task_def456')
    expect(toasts[0]).toBe('Descartando «Medir la caché»…') // said at once, before the app answers
    await until(clock, () => toasts.length > 1) // an order is signed on real time
    const sent = files[`${HOME}/control/s-test.json`] ? (JSON.parse(files[`${HOME}/control/s-test.json`]!) as { cmds: Cmd[] }).cmds.map(c => c.text) : []
    expect(calls.map(c => [c.tool, c.task_id, c.consent])).toEqual(tools ? [['mcp__ccd_session__dismiss_task', 'task_def456', 'The user pressed "Descartar" (dismiss) on a suggested session in Agentville.']] : [])
    if (path === 'tool' || path === 'settled') {
      expect([sent, toasts.at(-1), Object.keys(store['offers-done'] as object)]).toEqual([[], path === 'tool' ? 'La app descartó «Medir la caché»' : 'Ya estaba resuelta en la app; quité la nota', ['task_def456']])
      expect(await notesCard(ui)).not.toContain('Medir la caché') // gone from the card at once, which stays open
      expect(await notesCard(ui)).toContain('Limpiar los worktrees')
      expect(await notesDrawn(ui, '1 nota')).toBe(true)
    } else if (path === 'prompt') {
      expect([sent, toasts.at(-1)]).toEqual([['Descarta la sesión sugerida task_def456 con dismiss_task.'], `La app no pudo; se lo pedí a ${jefeName}`])
      expect(sent[0]).not.toContain('Medir') // the Claude-written title never goes as your words
    } else expect([sent, toasts.at(-1), store['offers-done']]).toEqual([[], 'No se hizo: No, gracias', undefined])
    await ui.unmount()
  })
}

// Its turn runs and ends without starting the suggestion: the note comes back.
const turnAgain = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown> }, turnId: string) => {
  await clock.advance(1000)
  await $.turn.start({ text: 'hola', turnId })
  await clock.advance(1000)
  await endTurn($, { turnId })
  await clock.advance(4000)
}

test('Asks: a note back after a Descartar by prompt takes a Descartar again (it retries)', async ($, on) => {
  const { files, clock } = await asking($, on, { ask: false, setup: () => {
    on('tool.list', () => ({ value: [] })) // no tool: Descartar goes as a prompt
    on('prompt.submit', ($2, e) => ({ text: e.text }) as never)
  } })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(600)
  const box = () => files[`${HOME}/control/s-test.json`] ? (JSON.parse(files[`${HOME}/control/s-test.json`]!) as { cmds: Cmd[] }).cmds.map(c => c.text) : []
  await onMap(ui, 'note-dismiss-task_abc123')
  await until(clock, () => box().length === 1)
  await turnAgain($, clock, 't2')
  await onMap(ui, 'note-dismiss-task_abc123')
  await until(clock, () => box().length === 2)
  expect(box()).toEqual(['Descarta la sesión sugerida task_abc123 con dismiss_task.', 'Descarta la sesión sugerida task_abc123 con dismiss_task.'])
  await ui.unmount()
})

test('Asks plan A: Descartar through the app\'s tool, the app\'s own session tool before a same-named one', async ($, on) => {
  const calls: Record<string, unknown>[] = []
  const { files, toasts, store, clock } = await asking($, on, { ask: false, setup: () => {
    on('tool.list', () => ({ value: [{ name: 'mcp__otro__dismiss_task', description: '', mcp: true }, { name: 'mcp__ccd_session__dismiss_task', description: '', mcp: true }] }))
    on('tool.call', ($2, e) => { if (e.tool.endsWith('dismiss_task')) { calls.push(e as never); return { result: 'ok', text: 'Task task_def456 withdrawn.' } as never } return { result: 'ok' } as never })
  } })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(600)
  await onMap(ui, 'note-dismiss-task_def456')
  expect(calls.map(c => [c.tool, c.task_id, c.consent])).toEqual([['mcp__ccd_session__dismiss_task', 'task_def456', 'The user pressed "Descartar" (dismiss) on a suggested session in Agentville.']])
  expect([files[`${HOME}/control/s-test.json`], toasts.at(-1), Object.keys(store['offers-done'] as object)]).toEqual([undefined, 'La app descartó «Medir la caché»', ['task_def456']])
  await ui.unmount()
})

for (const listed of [true, false]) {
  test(`Asks: the archive reply in this pane's own session, the tool ${listed ? 'listed' : 'not listed'}`, async ($, on) => {
    const calls: Record<string, unknown>[] = []
    const { toasts } = await asking($, on, { offers: false, actions: [{ label: 'Archivar', action: 'archive' }], setup: () => {
      on('tool.list', () => ({ value: listed ? [{ name: 'mcp__ccd_session_mgmt__archive_session', description: '', mcp: true }] : [] }))
      on('tool.call', ($2, e) => { if (e.tool.endsWith('archive_session')) { calls.push(e as never); return { result: 'ok', text: 'Archived.' } as never } return { result: 'ok' } as never })
    } })
    await $.command.run(OPEN)
    const ui = await mountPane($)
    if (listed) {
      expect(await ui.find({ type: 'Text', text: 'La app archiva esta sesión y te pide confirmarlo.' })).toBeDefined()
      await ui.press({ key: 'reply-0' })
      expect(calls.map(c => [c.tool, c.session_id, c.consent])).toEqual([['mcp__ccd_session_mgmt__archive_session', 'self', 'The user pressed the archive reply on this session\'s question in Agentville.']])
      expect(toasts.at(-1)).toBe('La app archiva proj')
    } else {
      expect(await ui.find({ type: 'Text', text: 'Archivar (en la app)' })).toBeDefined()
      expect(await btn(ui, 'reply-0')).toBeUndefined()
    }
    await ui.unmount()
  })
}
test('Asks: the archive reply of another session is only shown (the tool archives "self")', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const other = { ...newBeat('s9', 'otra', now), ask: { id: 'toolu_a', q: '¿Archivo?', replies: [{ label: 'Archivar', text: 'Archivar', app: true as const, action: 'archive' as const }] } }
  setAgent(other, MAIN, now, { state: 'esperando', activity: 'Te pregunta algo', cmd: null, req: null })
  serveBeats(on, [other])
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session_mgmt__archive_session', description: '', mcp: true }] }))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s9' })
  expect(await ui.find({ type: 'Text', text: 'Archivar (en la app)' })).toBeDefined()
  expect(await btn(ui, 'reply-0')).toBeUndefined()
  await ui.unmount()
})

test('Asks AC7: Descartar with no tool sends the dismiss prompt; in English too', async ($, on) => {
  const { files, store, clock } = await asking($, on, { ask: false, setup: () => on('tool.list', () => ({ value: [] })) })
  store.lang = 'en'
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await notesDrawn(ui, '2 notes')).toBe(true)
  expect(await notesCard(ui)).toContain('▸ Start')
  await clock.advance(600)
  await onMap(ui, 'note-dismiss-task_def456')
  await until(clock, () => !!files[`${HOME}/control/s-test.json`]) // the order is signed on real time: slow under load
  expect((JSON.parse(files[`${HOME}/control/s-test.json`]!) as { cmds: Cmd[] }).cmds.map(c => c.text)).toEqual(['Dismiss the suggested session task_def456 with dismiss_task.'])
  await ui.unmount()
})

test('Asks plan A: a card the pane settled through the app leaves its session\'s despacho, and the Jefe stops waiting once nothing is left', async ($, on) => {
  const { files, store, clock } = await asking($, on, { offers: true })
  await appendRow($, { type: 'user', content: [{ type: 'text', text: 'ya lo vi' }] }) // answers the question; the offers stay
  expect([beatOf(files).ask, beatOf(files).agents.main!.state, beatOf(files).offers?.length]).toEqual([undefined, 'esperando', 2])
  store['offers-done'] = { task_abc123: 100_000, task_def456: 100_000 }
  await until(clock, () => !beatOf(files).offers, 50, 1500)
  expect([beatOf(files).offers, beatOf(files).agents.main!.state]).toEqual([undefined, 'terminado'])
})

test('Asks AC8: the question clears on a typed message, a new turn, a failed or stopped turn, and the session\'s end; not on results or envelopes', async ($, on) => {
  const { files } = await asking($, on, { offers: false })
  await appendRow($, resultRow('toolu_x', 'ok'))
  await appendRow($, { type: 'user', content: [{ type: 'text', text: '<system-reminder>nada</system-reminder>' }] })
  expect(beatOf(files).ask?.q).toBe(QUESTION)
  await appendRow($, { type: 'user', content: [{ type: 'text', text: 'otra cosa' }] }, 'queue') // queued counts
  expect([beatOf(files).ask, beatOf(files).agents.main!.state]).toEqual([undefined, 'terminado']) // back from the despacho
  for (const clear of [() => $.turn.start({ text: 'hola', turnId: 't2' }), () => endTurn($, { isAborted: true }), () => endTurn($, { reason: 'error' }), () => $.session.end({ reason: 'other', sessionId: 's-test', resume: 'none' as never })]) {
    await appendRow($, wrapRow({ ask: '¿Y ahora?' }, 'toolu_w2'))
    expect(beatOf(files).ask?.q).toBe('¿Y ahora?')
    await clear()
    expect(beatOf(files).ask).toBeUndefined()
    expect(beatOf(files).agents.main!.state).not.toBe('esperando')
  }
})

test('Asks: suggested sessions stay through a new turn and wait again when it ends', async ($, on) => {
  const { files } = await asking($, on)
  await $.turn.start({ text: 'sigue', turnId: 't2' })
  expect([beatOf(files).ask, beatOf(files).offers?.length, beatOf(files).agents.main!.state]).toEqual([undefined, 2, 'trabajando'])
  await endTurn($)
  expect([beatOf(files).agents.main!.state, beatOf(files).agents.main!.activity]).toEqual(['esperando', 'Te sugiere sesiones'])
})

test('Asks AC14: a reloaded module keeps the question and the Jefe waiting in the despacho', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const old = { ...newBeat('s-test', 'proj', now), ask: { id: 'toolu_w1', q: '¿Sigo?', replies: [{ label: 'Sí', text: 'Sí' }] } }
  const { files } = serveBeats(on, [old])
  await startSession($)
  expect([beatOf(files).ask?.q, beatOf(files).agents.main!.state, beatOf(files).agents.main!.req]).toEqual(['¿Sigo?', 'esperando', null])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: '¿Sigo?' })).toBeDefined()
  await ui.unmount()
})

test('Asks: a heartbeat\'s question is checked again as read; a bad shape, a slash command or a long text never becomes a button', () => {
  const now = 100_000, b = newBeat('s1', 'x', now)
  const w = (ask: unknown, offers?: unknown) => worldFromBeats(null, [{ ...b, ask, offers } as never], now).depts[0]!
  expect(w({ id: 'bad id', q: '¿?', replies: [] }).ask).toBeUndefined()
  expect(w({ id: 'toolu_1', q: 'x'.repeat(301), replies: [] }).ask).toBeUndefined()
  const a = w({ id: 'toolu_1', q: '¿Sí?', blocked: 'yes', replies: [{ label: 'A\nB', text: '/deploy' }, { label: 'L', text: 'x'.repeat(401) }, { label: 'K', text: 'ok', action: 'commit' }, { label: 'R', text: 'rm', action: 'rm -rf' }, { label: 'E', text: 'extra' }] }).ask!
  expect(a).toEqual({ id: 'toolu_1', q: '¿Sí?', replies: [{ label: 'A B', text: '/deploy', app: true }, { label: 'L', text: '', app: true }, { label: 'K', text: 'ok', app: true, action: 'commit' }, { label: 'R', text: 'rm' }] })
  const offers = w(undefined, [{ tu: 't', title: 'Uno', brief: 'b', at: now, id: 'task_abcd' }, { tu: 't2', title: 'Sin id', brief: '', at: now }, { tu: 't3', title: 'Vieja', brief: '', at: now - OFFER_TTL, id: 'task_efgh' }, { tu: 't4', title: 'Mala', at: now, id: 'task_x; rm' }]).offers
  expect(offers).toEqual([{ id: 'task_abcd', title: 'Uno', brief: 'b' }])
  expect(w(undefined, [{ tu: 't', title: 'Uno\u202Eowt', brief: '', at: now, id: 'task_abcd' }]).offers).toBeUndefined() // a hidden character in the title
  expect(w({ id: 'toolu_1', q: '¿?', replies: [{ label: 'Sí', text: 'Sí\u200Bborra' }] }).ask!.replies).toEqual([{ label: 'Sí', text: 'Sí\u200Bborra', app: true }])
})

test('Asks AC12: one question with 3 replies and 2 suggested sessions (a note on the map) adds at most 50 elements', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const plain = newBeat('s1', 'proj', now)
  setAgent(plain, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const withItem = { ...plain, ask: { id: 'toolu_w1', q: QUESTION, replies: [{ label: 'Sí', text: 'Sí, hazlo' }, { label: 'No', text: 'No, déjalo' }, { label: 'Commit', text: 'Commit', app: true, action: 'commit' }] },
    offers: [{ tu: 'a', title: 'Uno', brief: 'Brief uno', at: now, id: 'task_aaaa1' }, { tu: 'b', title: 'Dos', brief: 'Brief dos', at: now, id: 'task_bbbb2' }] }
  const list = [plain], { files } = serveBeats(on, list)
  const measure = async (b: Beat, waiting: boolean) => {
    const x = JSON.parse(JSON.stringify(b)) as Beat
    if (waiting) setAgent(x, MAIN, now, { state: 'esperando', activity: 'Te pregunta algo', cmd: null, req: null })
    list[0] = x
    await $.command.run(OPEN)
    const ui = await mountPane($)
    await ui.press({ key: 'pick-s1' })
    // the card alone: its own elements and what its button Clients draw
    type N = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
    const all = (n: unknown): N[] => (n && typeof n === 'object' ? [n as N, ...((n as N).children ?? []).flatMap(all)] : [])
    const card = all(await ui.drawn()).find(n => n.props?.key === 'despacho-s1')
    const cardEls = all(card).length + all(card).filter(n => n.type === 'Client').reduce((k, c) => k + ('items' in (c.props!.props as object) ? btnsElements(c.props!.props as BtnsProps) : stripEls(c.props!.props as BandP)), 0)
    const els = lastEls(files)
    await ui.unmount()
    return { els, cardEls }
  }
  const before = await measure(plain, false), after = await measure(withItem as Beat, true)
  // Measured: the pane 219 to 211 (the Jefe's walk to the despacho moves the map's zones too, the suggested sessions are a
  // note on the map), the question card 21; 52 more since AT (each notes pill's zone takes a cell around it, the × 2 rows).
  expect([after.els - before.els <= 55, after.cardEls <= 50, after.els < 1500]).toEqual([true, true, true])
})

test('Asks option B: the note opens its card over the map; its × or another press closes it; no suggestion, no note', async ($, on) => {
  const { files } = await asking($, on)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const open = async () => (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('usecard-')).map(b => b.key)
  expect(await open()).toEqual(['usecard-notes']) // opened by itself
  await onMap(ui, 'card-close')
  const closed = lastEls(files)
  await onMap(ui, 'screen-notes')
  expect(await open()).toEqual(['usecard-notes'])
  const card = await notesCard(ui)
  for (const s of [`Notas · ${jefeName}`, `${jefeName} te pregunta (bloqueado):`, '<span class="btn">Solo mira</span>', 'Commit: «Haz el commit.»', '<span class="btn primary">▸ Sí, arréglalo</span>', '<span class="sw" style="height:37.5px">Sí, arréglalo: «Sí, arregla el redondeo final. Con ticket y PR.»</span>', 'Verificar (en la app)', '+2 más']) expect([s, card.includes(s)]).toEqual([s, true]) // the first reply always gets its pill and whole text
  expect(card).not.toContain('Limpiar los worktrees') // the question took the card's height
  expect((await hitKeys(ui)).filter(k => k.startsWith('note-'))).toEqual(['note-reply-toolu_w1-0', 'note-reply-toolu_w1-1', 'note-reply-toolu_w1-2'])
  // every hit Button shows the invisible filler only
  const hits = (await Promise.all((await bandClients(ui)).map(c => ui.findAll({ type: 'Button', in: c.key! })))).flat().filter(b => b.key?.startsWith('note-'))
  expect([hits.length >= 3, hits.every(b => /^\u3164+$/.test(b.text ?? ''))]).toEqual([true, true])
  expect(lastEls(files) - closed).toBeLessThanOrEqual(60)
  await onMap(ui, 'card-close')
  expect(await open()).toEqual([])
  await onMap(ui, 'screen-notes')
  await ui.press({ key: 'pick-s-test' }) // any other press closes it
  expect(await open()).toEqual([])
  await ui.unmount()
})

test('Asks option B: no question and no suggested session, no note on the desk', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  serveBeats(on, [newBeat('s1', 'proj', now)])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect([await notesDrawn(ui, '1 nota'), await notesDrawn(ui), (await hitKeys(ui)).includes('screen-notes')]).toEqual([false, false, false])
  await ui.unmount()
})

test('Asks option B: with the map hidden the suggested sessions are listed in the detail instead', async ($, on) => {
  const { store } = await asking($, on, { setup: () => on('tool.list', () => ({ value: [] })) })
  store.nomap = true
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await areas(ui)).filter(k => k.startsWith('btns-o-'))).toEqual(['btns-o-s-test-0', 'btns-o-s-test-1'])
  expect((await btnsAll(ui)).filter(b => /^(start|dismiss)-0$/.test(b.key ?? '')).map(b => b.text)).toEqual(['▸ Arrancar en su chat', 'Descartar'])
  await ui.unmount()
})

test('Asks option B budget: the notes card open with 4 suggestions from 2 offices stays under the caps', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const office = (id: string, k: number) => {
    const b = { ...newBeat(id, `oficina ${id}`, now), offers: Array.from({ length: k }, (_, i) => ({ tu: `t${i}`, title: `Sugerencia ${id} ${i}`, brief: 'Un brief de una línea para la nota.', at: now, id: `task_${id}x${i}` })) }
    setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te sugiere sesiones', cmd: null, req: null })
    return b
  }
  const { files } = serveBeats(on, [office('s1', 2), office('s2', 3)])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await notesDrawn(ui, '5 notas')).toBe(true)
  await onMap(ui, 'card-close') // it opened by itself
  const closed = lastEls(files)
  await onMap(ui, 'screen-notes')
  const opened = lastEls(files)
  expect((await hitKeys(ui)).filter(k => k.startsWith('note-')).length).toBe(2) // 1 fits the card's 210 px, the rest "+4 más"
  expect(await notesCard(ui)).toContain('+4 más')
  // Measured: 305 closed, 319 open (the card's body takes the place of the zones under it).
  expect([opened - closed <= 40, opened < 1500]).toEqual([true, true])
  await ui.unmount()
})

const WANT_PILLS = [[33.5, 103.5, 86.45, 23], [127.95, 103.5, 84.02, 23], [33.5, 189, 86.45, 23], [127.95, 189, 84.02, 23]]
// Measured in headless Chrome at 2x (scratchpad chrome/measure.mjs): the mock's pills of a two-item card sit at these
// rects (card corner + its shadow room of 20 by 14); the zones come from the same numbers.
test('chrome: the notes card puts its pills, its × zone and its mock markup where Chrome measured them', () => {
  const c = notesCardOf({ title: 'Sesiones sugeridas · Nico', items: [{ office: null, title: 'a', brief: 'b' }, { office: null, title: 'c', brief: 'd' }], more: n => `+${n}`, start: '▸ Arrancar', dismiss: 'Descartar', maxH: 1000 })
  const near = (got: number[], want: number[]) => got.every((v, i) => Math.abs(v - want[i]!) <= 0.2)
  const want = WANT_PILLS
  expect(c.pills.map((p, i) => near([p.x, p.y, p.w, p.ht], want[i]!))).toEqual([true, true, true, true])
  expect([c.W, c.close]).toEqual([367, { x: 327, y: 24.5, w: 10, ht: 10 }]) // the drawn ×: its zone grows from it
  for (const part of ['<div class="overlay">', '<div class="k">Sesiones sugeridas · Nico</div>', '<span class="btn primary">▸ Arrancar</span>', '<span class="btn">Descartar</span>', 'font-family:"Pixelify Sans"']) expect([part, c.body.includes(part)]).toEqual([part, true])
  expect(btnSvg('▸ Arrancar', true).svg).toContain('<span class="btn primary">▸ Arrancar</span>')
  expect(toggleSvg({ label: '▸ Abrir siempre', on: false, state: 'Apagado' }).svg).toContain('<span class="chip off"><i></i>Apagado</span>')
  expect(bannerSvg({ w: 600, count: 'Te espera 1', text: 'a <b>', ver: 'Ver' }).svg).toContain('<b>Te espera 1</b><span class="t">a &lt;b&gt;</span><span class="btn">Ver</span>') // model text escaped
})

test('Asks plan A: only an aborted call (Esc, a cancelled dialog) stops without the prompt; any other rejection falls back', () => {
  const named = (name: string, message: string) => Object.assign(new Error(message), { name })
  expect([aborted(new Error('The operation was aborted')), aborted(named('AbortError', 'x')), aborted(new Error('Dialog canceled')), aborted('cancelled by the user')]).toEqual([true, true, true, true])
  expect([aborted(new Error('No tool named mcp__ccd_session__start_session')), aborted(named('HooksError', 'tool.call threw')), aborted(undefined), aborted(new Error('tool dismiss_task not found')), aborted(new Error('connection closed'))]).toEqual([false, false, false, false, false])
})

test('Asks N1, N2: Ver on a Jefe that waits only on suggestions opens their notes card; the count caps at 9+; the card goes with the last one', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const b = { ...newBeat('s1', 'proj', now), offers: Array.from({ length: 10 }, (_, i) => ({ tu: `t${i}`, title: `Idea ${i}`, brief: 'b', at: now, id: `task_s1x${i}` })) }
  setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te sugiere sesiones', cmd: null, req: null })
  const { store } = serveBeats(on, [b])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await notesDrawn(ui, '9+ notas')).toBe(true)
  const open = async () => (await ui.findAll({ type: 'Box' })).filter(x => x.key?.startsWith('usecard-')).map(x => x.key)
  await onMap(ui, 'card-close') // it opened by itself
  expect(await open()).toEqual([])
  await ui.press({ key: 'go-first' })
  expect(await open()).toEqual(['usecard-notes'])
  store['offers-done'] = Object.fromEntries(b.offers.map(o => [o.id, now])) // the app settled them all
  await ui.redraw() // no press: the card goes because its last note went
  expect(await open()).toEqual([])
  await ui.unmount()
})

test('Asks N2: the note\'s zone names what it opens', () => {
  const now = 100_000, w = worldFromBeats(null, [newBeat('s1', 'x', now)], now)
  expect(hotspots(w, now, false, undefined, '2 notas').find(z => z.group === 'screen-notes')?.label).toBe('2 notas en tu escritorio')
})

// ---- The notes open by themselves; a Jefe's question is a note too; the card sits at the map's top-right ----

const offerOf = (i: number, now: number) => ({ tu: `t${i}`, title: `Idea ${i}`, brief: 'b', at: now, id: `task_idea${i}` })
const waitingBeat = (id: string, now: number, more: Partial<Beat>) => {
  const b = { ...newBeat(id, 'proj', now), ...more } as Beat
  setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te sugiere sesiones', cmd: null, req: null })
  return b
}
const usecards = async (ui: UI) => (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('usecard-')).map(b => b.key)
const sync = async (clock: { advance: (ms: number) => Promise<unknown> }) => { for (let k = 0; k < 2; k++) await clock.advance(3100) }

test('Notes AC1, AC2: a new note opens its card with no click; × keeps it shut across syncs until a new one; the note reopens it', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const list = [waitingBeat('s1', now, { offers: [offerOf(1, now)] })]
  serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await onMap(ui, 'card-close')
  await sync(clock)
  await ui.redraw()
  expect(await usecards(ui)).toEqual([])
  list[0] = waitingBeat('s1', clock.now(), { offers: [offerOf(1, now), offerOf(2, clock.now())] })
  await sync(clock)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await onMap(ui, 'card-close')
  await onMap(ui, 'screen-notes')
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await ui.unmount()
})

test('Notes AC3: an open disk card is never replaced by a new note; the notes open once it closes', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const list = [waitingBeat('s1', now, {})]
  serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await onMap(ui, 'screen-disk')
  expect(await usecards(ui)).toEqual(['usecard-disk'])
  list[0] = waitingBeat('s1', clock.now(), { offers: [offerOf(1, clock.now())] })
  await sync(clock)
  expect(await usecards(ui)).toEqual(['usecard-disk'])
  await onMap(ui, 'card-close')
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await ui.unmount()
})

test('Notes AC4: another session\'s question is a note: its sendable replies are pills with what they send, the rest only say so', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const ask = { id: 'toolu_w9', q: '¿Sigo con el plan?', replies: [{ label: 'Sí', text: 'Sí, sigue' }, { label: 'No', text: 'No, para' }, { label: 'Archivar', text: 'Archivar', app: true as const, action: 'archive' as const }, { label: 'Verificar', text: '', app: true as const, action: 'verify' as const }] }
  serveBeats(on, [waitingBeat('s9', now, { ask })])
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session_mgmt__archive_session', description: '', mcp: true }] }))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await notesDrawn(ui, '1 nota')).toBe(true)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  const card = await notesCard(ui), jefe = agentName('s9-jefe')
  for (const s of [`Notas · ${jefe}`, `${jefe} te pregunta:`, '¿Sigo con el plan?', '<span class="btn primary">▸ Sí</span><span class="btn">No</span>', 'Sí: «Sí, sigue»', 'No: «No, para»', 'Archivar (en la app)', 'Verificar (en la app)']) expect([s, card.includes(s)]).toEqual([s, true])
  expect(card).not.toContain('<span class="btn">Archivar</span>')
  expect((await hitKeys(ui)).filter(k => k.startsWith('note-'))).toEqual(['note-reply-toolu_w9-0', 'note-reply-toolu_w9-1'])
  await ui.unmount()
})

test('Notes AC5: a reply pill sends what the detail card\'s reply-1 sends, only once the card has settled; the question leaves the card, which stays open', async ($, on) => {
  const { files, clock } = await asking($, on)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await onMap(ui, 'note-reply-toolu_w1-1') // within NOTE_CALM of the card opening by itself: a click meant for the map
  await clock.settle()
  expect(files[`${HOME}/control/s-test.json`]).toBeUndefined()
  await clock.advance(600)
  await onMap(ui, 'note-reply-toolu_w1-1')
  await until(clock, () => !!files[`${HOME}/control/s-test.json`])
  const cmds = (JSON.parse(files[`${HOME}/control/s-test.json`]!) as { cmds: Cmd[] }).cmds
  expect(cmds.map(c => [c.kind, c.text])).toEqual([['msg', 'Solo mira']])
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  const card = await notesCard(ui)
  expect([card.includes('te pregunta:'), card.includes('Limpiar los worktrees'), await notesDrawn(ui, '2 notas')]).toEqual([false, true, true])
  await ui.unmount()
})

for (const lang of ['es', 'en'] as const) {
  test(`Notes AC6: a question and 2 suggestions, the question first, "3" notes, the mixed title (${lang})`, async ($, on) => {
    const { store } = await asking($, on)
    store.lang = lang
    await $.command.run(OPEN)
    const ui = await mountPane($)
    expect(await notesDrawn(ui, lang === 'es' ? '3 notas' : '3 notes')).toBe(true)
    const card = await notesCard(ui)
    expect(card).toContain(`>${lang === 'es' ? 'Notas' : 'Notes'} · ${jefeName}</div>`)
    expect([card.includes(QUESTION), card.includes(lang === 'es' ? '+2 más' : '+2 more'), card.includes('Limpiar los worktrees')]).toEqual([true, true, false]) // the question first
    await ui.unmount()
  })
}

test('Notes AC7: a question of 4 replies and 3 suggestions open adds at most 60 elements, every hit Button shows only filler', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const ask = { id: 'toolu_w9', q: QUESTION, replies: ['Uno', 'Dos', 'Tres', 'Cuatro'].map(l => ({ label: l, text: `Haz ${l}` })) }
  const { files } = serveBeats(on, [waitingBeat('s1', now, { ask, offers: [1, 2, 3].map(i => offerOf(i, now)) })])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  const opened = lastEls(files)
  expect((await hitKeys(ui)).filter(k => k.startsWith('note-'))).toEqual(['note-reply-toolu_w9-0', 'note-reply-toolu_w9-1', 'note-reply-toolu_w9-2', 'note-reply-toolu_w9-3'])
  const hits = (await Promise.all((await bandClients(ui)).map(c => ui.findAll({ type: 'Button', in: c.key! })))).flat().filter(b => b.key?.startsWith('note-'))
  expect([hits.length >= 4, hits.every(b => /^\u3164+$/.test(b.text ?? ''))]).toEqual([true, true])
  await onMap(ui, 'card-close')
  const closed = lastEls(files)
  expect([opened - closed <= 60, opened < 1500]).toEqual([true, true])
  await ui.unmount()
})

test('Notes AC8: the notes card sits at the view\'s top-right corner, 4 px in, at 1 and 3 rows', () => {
  const now = 100000
  const rows = (n: number) => floorView(worldFromBeats(null, crowd(n, now), now), 0)
  const three = Array.from({ length: 16 }, (_, i) => rows(i + 1)).find(w => w.rows === 3)!
  for (const w of [rows(1), three]) {
    const v = viewOf(w.rows ?? 1)
    for (const H of [120, 340]) {
      const r = cardRect(w, notesTop(), 367, H)
      expect([w.rows, Math.abs(r.x1 - (1 - 4 / v.w)) < 1e-9, Math.abs(r.y0 - 4 / v.ht) < 1e-9]).toEqual([w.rows, true, true])
    }
  }
  expect(rows(1).rows).toBe(1)
})

test('Notes: a reply whose 400-character text cannot show whole on the card gets no pill and no zone, only a line to the detail', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const long = 'Haz esto. '.repeat(40)
  const ask = { id: 'toolu_w8', q: '¿Cuál?', replies: [{ label: 'Largo', text: long }, { label: 'Sí', text: 'Sí' }] }
  serveBeats(on, [waitingBeat('s9', now, { ask })])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const card = await notesCard(ui)
  expect([card.includes('«Largo»: respóndela en el detalle'), card.includes('>Largo</span>'), card.includes('Haz esto.')]).toEqual([true, false, false])
  expect((await hitKeys(ui)).filter(k => k.startsWith('note-'))).toEqual(['note-reply-toolu_w8-1'])
  await ui.unmount()
})

test('Notes: no card opens by itself while the tour is open; it opens once the tour closes', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  const { store } = serveBeats(on, [waitingBeat('s1', now, { offers: [offerOf(1, now)] })])
  store.tour = { open: true, step: 1, done: false }
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await usecards(ui)).toEqual([])
  store.tour = { open: false, step: 1, done: false }
  await ui.redraw()
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await ui.unmount()
})

test('Notes: at 600, 848 and 1300 px and 1 or 3 rows the card keeps its height budget and stays inside the view', () => {
  const now = 100000, rowsOfN = (n: number) => floorView(worldFromBeats(null, crowd(n, now), now), 0)
  const three = Array.from({ length: 16 }, (_, i) => rowsOfN(i + 1)).find(w => w.rows === 3)!
  const q = { office: null, asks: 'x te pregunta (bloqueado):', q: 'y', replies: ['Uno', 'Dos', 'Tres', 'Cuatro'].map(label => ({ label, line: `${label}: «Haz ${label}»`, detail: '' })) }
  const offer = { office: null, title: 'a', brief: 'b' }
  for (const w of [rowsOfN(1), three]) for (const px of [600, 848, 1300]) for (const items of [[offer, offer, offer], [q, offer]]) {
    const v = viewOf(w.rows ?? 1), k = px / v.w, maxH = Math.min(0.45 * v.ht * k, 260)
    const c = notesCardOf({ title: 'N', items, more: n => `+${n}`, start: 's', dismiss: 'd', maxH })
    const r = cardRect(w, notesTop(), c.W / k, c.H / k), bottom = r.y0 + (14 + c.CH) / k / v.ht // the card's border, not its shadow
    expect([w.rows, px, c.shown >= 1, c.shown === 1 || c.CH <= maxH, bottom <= 1]).toEqual([w.rows, px, true, true, true])
  }
})

test('chrome: a question item puts its reply pills side by side, wrapping; a reply whose text would not show whole gets no pill', () => {
  const L = { k: 15.5, line: 18.75, btn: 23 }, x0 = 20 + 1.5 + 12
  const replies = [{ label: 'Sí', line: null, detail: 'd0' }, { inApp: 'Verificar (en la app)' }, { label: 'No', line: 'No: «No, para»', detail: 'd2' }, { label: 'Largo', line: `Largo: «${'x'.repeat(400)}»`, detail: '«Largo»: respóndela en el detalle' }]
  const c = notesCardOf({ title: 'Notas', items: [{ office: null, asks: 'Nico te pregunta:', q: '¿Sigo?', replies }, { office: null, title: 'a', brief: 'b' }], more: n => `+${n} más`, start: '▸ Arrancar', dismiss: 'Descartar', maxH: 1000 })
  const y0 = 14 + 1.5 + 10 + L.k + 8 + 7 + L.line + 5 + 2 * L.line + 5 // the pills' row
  const r = (n: number) => Math.round(n * 100) / 100
  expect(c.pills.slice(0, 2).map(p => [p.act, r(p.x), r(p.y)])).toEqual([[0, x0, r(y0)], [2, r(x0 + c.pills[0]!.w + 8), r(y0)]])
  const yOffer = y0 + L.btn + 3 * (5 + L.line) + 8 + 7 + L.line + 5 + L.line + 5 // past its 3 lines: in the app, No's, Largo's
  expect(c.pills.slice(2).map(p => [p.i, p.act, r(p.y)])).toEqual([[1, 'start', r(yOffer)], [1, 'dismiss', r(yOffer)]])
  for (const part of ['<span class="qq" style="height:37.5px">¿Sigo?</span>', '<span class="acts wrap"><span class="btn primary">▸ Sí</span><span class="btn">No</span></span>', '<span class="s">Verificar (en la app)</span><span class="s">No: «No, para»</span><span class="s">«Largo»: respóndela en el detalle</span>']) expect([part, c.body.includes(part)]).toEqual([part, true])
  expect(c.body).not.toContain('>Largo</span>')
  // more pills than a row holds wrap 8 px below, from the left again
  const many = notesCardOf({ title: 'N', items: [{ office: null, asks: 'x', q: 'y', replies: ['Primera', 'Segunda respuesta', 'Tercera respuesta', 'Cuarta'].map(label => ({ label, line: null, detail: '' })) }], more: n => `+${n}`, start: 's', dismiss: 'd', maxH: 1000 })
  const rows = [...new Set(many.pills.map(p => r(p.y)))]
  expect([rows.length, rows[1]! - rows[0]!, many.pills.every(p => p.x + p.w <= x0 + 300 + 1e-9), many.pills.filter(p => p.x === x0).length]).toEqual([2, L.btn + 8, true, 2])
})

test('chrome: the notes card draws items while they fit its height, the first always, the rest as "+N"', () => {
  const offer = (t: string) => ({ office: null, title: t, brief: 'b' })
  const q = { office: null, asks: 'x', q: 'y', replies: ['Uno', 'Dos', 'Tres', 'Cuatro'].map(label => ({ label, line: `${label}: «Haz ${label}»`, detail: '' })) }
  const card = (items: Parameters<typeof notesCardOf>[0]['items'], maxH: number) => notesCardOf({ title: 'N', items, more: n => `+${n} más`, start: '▸ Arrancar', dismiss: 'Descartar', maxH })
  const two = card([offer('a'), offer('b')], 210), three = card([offer('a'), offer('b'), offer('c')], 210), big = card([q, offer('a')], 120)
  expect([two.shown, two.CH <= 210, two.body.includes('más')]).toEqual([2, true, false])
  expect([three.shown, three.CH <= 210, three.body.includes('+2 más')]).toEqual([1, true, true])
  expect([big.shown, big.CH > 120, big.body.includes('+1 más'), big.pills.length]).toEqual([1, true, true, 4]) // the question always, whatever its height
})

test('chrome: a reply whose sent text wraps to 2 or 3 lines keeps its pill while the card has room, reply by reply', () => {
  const L = { line: 18.75, btn: 23 }, text = 'Sí, arregla el redondeo final para que el total salga con dos decimales fijos.'
  const rep = (label: string) => ({ label, line: `${label}: «${text}»`, detail: `«${label}»: respóndela en el detalle` })
  const card = (items: Parameters<typeof notesCardOf>[0]['items'], maxH: number) => notesCardOf({ title: 'Notas', items, more: n => `+${n} más`, start: '▸ Arrancar', dismiss: 'Descartar', maxH })
  // B1, the usual card: a question of 3 or 4 replies, then 2 suggestions, at the 848 and 1300 px budgets. The first reply
  // always gets its pill and its whole text, wrapping; the card goes past its budget by that reply's own extra at most.
  const sent = `<span class="sw" style="height:${2 * L.line}px">Sí, arréglalo: «${text}»</span>`, offer = { office: null, title: 'a', brief: 'b' }
  const usual = (extra: NoteReply[]) => ({ office: null, asks: 'Nico te pregunta:', q: '¿Arreglo el redondeo final?', replies: [rep('Sí, arréglalo'), { label: 'Solo mira', line: null, detail: '«Solo mira»: respóndela en el detalle' }, { inApp: 'Verificar (en la app)' }, ...extra] })
  expect(noteLines(rep('Sí, arréglalo').line)).toBe(2)
  for (const maxH of [232.65, 260]) for (const extra of [[], [rep('Otra')]]) {
    const c = card([usual(extra), offer, offer], maxH)
    expect([maxH, extra.length, c.pills.map(p => p.act).slice(0, 2), c.body.includes(sent), c.CH <= maxH + 5 + L.btn + L.line, c.body.includes('+2 más')]).toEqual([maxH, extra.length, [0, 1], true, true, true])
    if (extra.length) expect(c.body).toContain('<span class="s">«Otra»: respóndela en el detalle</span>') // no room left for its 2 lines
  }
  expect(card([usual([]), offer, offer], 260).CH <= 260).toBe(true) // at 1300 px the usual card fits whole
  // a reply past 3 lines gets no pill even when it is the first
  const long = card([{ ...usual([]), replies: [{ label: 'Largo', line: `Largo: «${'palabra '.repeat(50)}»`, detail: '«Largo»: respóndela en el detalle' }] }], 260)
  expect([long.pills.length, long.body.includes('«Largo»: respóndela en el detalle')]).toEqual([0, true])
  // a later reply follows the budget: at 120 px only the first reply of 2 wrapping ones gets its pill
  const tight = card([{ ...usual([]), replies: [rep('Sí, arréglalo'), rep('Otra')] }], 120)
  expect([tight.pills.map(p => p.act), tight.body.includes('«Otra»: respóndela en el detalle')]).toEqual([[0], true])
  // B3: a 2-line reply moves the next item's pills down by exactly one more line than a 1-line reply does
  const one = { office: null, asks: 'x', q: 'y', replies: [{ label: 'No', line: 'No: «No, para»', detail: 'd' }] }
  const wide = { ...one, replies: [{ label: 'No', line: `No: «${text}»`, detail: 'd' }] }
  const [a, b] = [card([one, offer], 1000), card([wide, offer], 1000)]
  expect(b.pills.map(p => [p.i, p.act])).toEqual([[0, 0], [1, 'start'], [1, 'dismiss']])
  expect([b.pills[0]!.y - a.pills[0]!.y, b.pills[1]!.y - a.pills[1]!.y, b.pills[2]!.y - a.pills[2]!.y, Math.abs(b.CH - a.CH - L.line) <= 1]).toEqual([0, L.line, L.line, true]) // CH is whole px
  expect(a.body).toContain('<span class="s">No: «No, para»</span>') // a 1-line line is drawn as before
})

test('chrome: a reply line counts newlines and whitespace runs as one space, and a long word breaks past 3 lines', () => {
  expect([noteLines('No:\n\n«No,   para»'), noteLines('No: «No, para»'), noteLines('')]).toEqual([1, 1, 1])
  expect(noteLines(`a\n${'palabra '.repeat(40)}`)).toBeGreaterThan(3)
  expect(noteLines('x'.repeat(300))).toBeGreaterThan(3)
  expect(noteLines(`Sí: «${'x'.repeat(60)}»`)).toBe(3) // "Sí:", then the word too wide for a line breaks by character
  // B2: a 400-char reply gets no pill, only its detail line
  const c = notesCardOf({ title: 'N', items: [{ office: null, asks: 'x', q: 'y', replies: [{ label: 'Largo', line: `Largo: «${'palabra '.repeat(50)}»`, detail: '«Largo»: respóndela en el detalle' }] }], more: n => `+${n}`, start: 's', dismiss: 'd', maxH: 1000 })
  expect([c.pills.length, c.body.includes('<span class="s">«Largo»: respóndela en el detalle</span>')]).toEqual([0, true])
})


// ---- Always in sync: the mod's version in the beat, the pane reading older sessions' transcripts, reloads ----

const OLD = 'aaaaaaaa-0000-4000-8000-000000000001' // a session on an older copy of the mod: its beat has no `mod`
const PROJECTS = '/home/test/.claude/projects'
const entry = (name: string, kind: 'file' | 'dir' = 'file') => ({ name, kind, size: 1, mtimeMs: 0, isLink: false })
// The mod's own folder as the fake disk serves it: one hook file whose content is `mod.src`, read through $.fs only;
// git reports the folder clean unless `mod.dirty`. `root` is learnt from the first list of its hooks folder.
function modDisk() {
  const mod = { root: '', src: 'v1', dirty: false }
  const dir = (p: string) => (p.endsWith('/hooks') ? ((mod.root ||= p.slice(0, -'/hooks'.length)), [entry('x.ts')]) : p.endsWith('/agents') || p.endsWith('/skills') ? [] : undefined)
  return { mod, dir, run: (argv: readonly string[]) => (argv[0] === '/usr/bin/git' ? { exitCode: 0, stdout: mod.dirty ? ' M hooks/x.ts\n' : '', stderr: '' } : undefined) }
}

test('Sync AC3: an old session\'s question comes from its transcript; the despacho shows it and a reply goes signed', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const old = newBeat(OLD, 'viejo', now)
  setAgent(old, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const path = `${PROJECTS}/-home-test-viejo/${OLD}.jsonl`
  const tail = ['{"cut', JSON.stringify({ type: 'assistant', timestamp: new Date(now - 1000).toISOString(), message: wrapRow({ recap: 'Listo.', ask: QUESTION, actions: ACTIONS }) })].join('\n')
  let reads = 0
  const served = serveBeats(on, [old], {
    dir: p => (p === PROJECTS ? [entry('-home-test-otro', 'dir'), entry('-home-test-viejo', 'dir')] : undefined),
    run: argv => (argv[0] === '/usr/bin/tail' && argv[3] === path ? (reads++, { exitCode: 0, stdout: tail, stderr: '' }) : undefined),
    stat: () => ({ ...fileStat(10), mtimeMs: 5 }),
  })
  served.files[path] = '' // the transcript is there
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => reads > 0, 20, 1000)
  await until(clock, () => false, 3, 1000)
  expect(await bannerAlt(ui)).toContain(QUESTION)
  await clock.advance(10_000)
  expect(reads).toBe(1) // stat every 3 s, read again only when the file changed
  expect(served.ran.some(a => a[0] === '/bin/sh')).toBe(false) // argv only
  await ui.press({ key: `pick-${OLD}` })
  await ui.press({ key: 'reply-0' })
  await until(clock, () => !!served.files[`${HOME}/control/${OLD}.json`])
  const cmds = (JSON.parse(served.files[`${HOME}/control/${OLD}.json`]!) as { cmds: Cmd[] }).cmds
  expect((await trusted(cmds, String(served.store['mailbox-key']), clock.now(), OLD)).map(c => [c.kind, c.text])).toEqual([['msg', ACTIONS[0]!.message]])
  await ui.unmount()
})

test('Sync AC3: a session on a current mod reports its own questions: its transcript is never overlaid', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const cur = { ...newBeat(OLD, 'actual', now), mod: 'aaaaaaaaaaaa' }
  setAgent(cur, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const path = `${PROJECTS}/-home-test-actual/${OLD}.jsonl`
  const tail = ['{"cut', JSON.stringify({ type: 'assistant', timestamp: new Date(now - 1000).toISOString(), message: wrapRow({ recap: 'Listo.', ask: QUESTION, actions: ACTIONS }) })].join('\n')
  let reads = 0
  const served = serveBeats(on, [cur], {
    dir: p => (p === PROJECTS ? [entry('-home-test-actual', 'dir')] : undefined),
    run: argv => (argv[0] === '/usr/bin/tail' && argv[3] === path ? (reads++, { exitCode: 0, stdout: tail, stderr: '' }) : undefined),
    stat: () => ({ ...fileStat(10), mtimeMs: 5 }),
  })
  served.files[path] = ''
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => reads > 0, 20, 1000)
  await until(clock, () => false, 3, 1000)
  expect(reads).toBe(1) // read for its title
  expect(await bannerAlt(ui)).toBe('')
  expect(await ui.find({ type: 'Text', text: `${agentName(`${OLD}-jefe`)} te pregunta:` })).toBeUndefined()
  await ui.unmount()
})

test('Sync AC5: the beat carries the loaded version; a clean new one on disk marks it stuck at once, and it never runs /reload-plugins', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const disk = modDisk()
  const { files, store } = serveBeats(on, [newBeat('s-test', 'proj', clock.now())], { dir: disk.dir, run: disk.run })
  const runs: string[] = []
  on('command.run', ($2, e, next) => { runs.push(e.command); return next(e) })
  on('turn.start', ($2, e) => ({ turnId: e.turnId }))
  await startSession($)
  const loaded = beatOf(files).mod
  expect(isMod(loaded)).toBe(true)
  disk.mod.dirty = true
  files[`${disk.mod.root}/hooks/x.ts`] = 'v2' // mid-edit: not a version yet
  await until(clock, () => false, 30, 1500)
  expect(beatOf(files).syncStuck).toBeUndefined()
  disk.mod.dirty = false // the merge lands
  await $.turn.start({ turnId: 't1', prompt: 'x' } as never) // busy or not, the same: it says so
  await until(clock, () => !!beatOf(files).syncStuck, 30, 1500)
  const ver = beatOf(files).syncStuck!
  expect([isMod(ver), ver !== loaded, runs, Object.keys(store).filter(k => k.startsWith('sync:'))]).toEqual([true, true, [], []])
  await until(clock, () => false, 60, 1500)
  expect(runs).toEqual([]) // never, however long it waits
})

test('Sync AC6: an older session says so in the list; Cómo actualizar sends no order, opens its chat and says, in one toast, to type /reload-plugins', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const disk = modDisk()
  const a = { ...newBeat('s1', 'vieja', now), mod: 'aaaaaaaaaaaa', local: LOCAL_ID }, b = newBeat('s2', 'antigua', now), c = { ...newBeat('s3', 'atascada', now), mod: 'bbbbbbbbbbbb', syncStuck: 'cccccccccccc' }
  const d = { ...newBeat('s4', 'ocupada', now), mod: 'dddddddddddd' }
  for (const x of [a, b, c]) setAgent(x, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  setAgent(d, MAIN, now, { state: 'trabajando', activity: 'Pensando' })
  const { files, toasts, ran } = serveBeats(on, [newBeat('s-test', 'proj', now), a, b, c, d], { dir: disk.dir, run: a => (a[0] === '/usr/bin/open' ? { exitCode: 0, stdout: '', stderr: '' } : disk.run(a)) })
  files[`${HOME}/commands/s1.json`] = files[`${HOME}/commands/s4.json`] = JSON.stringify([['reload-plugins', 'Reload', 'builtin']])
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(21_000)
  await until(clock, () => false, 5, 1000)
  const rows = async () => (await textsAll(ui, /versión vieja| · falta \/reload-plugins/)).map(x => String(x.text))
  expect((await rows()).length).toBe(4) // s1, s2 (no version at all), s3 and s4; never this session's own row
  expect((await rows()).filter(x => x.includes('falta /reload-plugins'))).toHaveLength(1)
  for (const x of await rows()) expect(x).toMatch(/^\S+ · [^·]+ · (versión vieja|falta \/reload-plugins)/) // right after the state word: never cut off
  await ui.press({ key: 'pick-s1' })
  expect((await btn(ui, 'reload'))?.text).toBe('Cómo actualizar')
  expect(await ui.find({ type: 'Text', text: /Hay una versión nueva/ })).toBeUndefined()
  const n0 = toasts.length
  await ui.press({ key: 'reload' })
  expect([ran.filter(x => x[0] === '/usr/bin/open'), toasts.slice(n0)]).toEqual([[OPEN_ARGV], ['Escribe /reload-plugins en la sesión vieja']]) // one toast
  await ui.press({ key: 'pick-s2' })
  const n1 = toasts.length
  await ui.press({ key: 'reload' })
  expect([ran.filter(x => x[0] === '/usr/bin/open').length, toasts.slice(n1)]).toEqual([1, ['Escribe /reload-plugins en la sesión antigua']]) // no chat link known: no open, the hint alone says where
  await ui.press({ key: 'pick-s3' })
  expect(await ui.find({ type: 'Text', text: 'Hay una versión nueva: escribe /reload-plugins en su chat' })).toBeDefined()
  await ui.press({ key: 'pick-s4' })
  await ui.press({ key: 'reload' })
  expect(toasts.at(-1)).toBe('Escribe /reload-plugins en la sesión ocupada')
  expect(['s1', 's2', 's3', 's4'].map(id => files[`${HOME}/control/${id}.json`])).toEqual([undefined, undefined, undefined, undefined]) // no order, ever
  await ui.press({ key: 'pick-s-test' })
  expect(await btn(ui, 'reload')).toBeUndefined() // this session runs the mod on disk
  await ui.unmount()
})

test('Sync O1: a stuck session gets no Update Agentville button, says to type it, offers Ir al chat, and sync opens it with no order', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const disk = modDisk()
  const c = { ...newBeat('s3', 'atascada', now), mod: 'bbbbbbbbbbbb', syncStuck: 'cccccccccccc', local: LOCAL_ID }
  setAgent(c, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const { files, toasts, ran } = serveBeats(on, [newBeat('s-test', 'proj', now), c], { dir: disk.dir, run: a => (a[0] === '/usr/bin/open' ? { exitCode: 0, stdout: '', stderr: '' } : disk.run(a)) })
  files[`${HOME}/commands/s3.json`] = JSON.stringify([['reload-plugins', 'Reload', 'builtin']])
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(21_000)
  await until(clock, () => false, 5, 1000)
  await ui.press({ key: 'pick-s3' })
  expect(await btn(ui, 'reload')).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Hay una versión nueva: escribe /reload-plugins en su chat' })).toBeDefined()
  expect((await btn(ui, 'open-chat'))?.text).toBe('↗ Ir al chat')
  expect((await $.command.run({ ...OPEN, args: 'sync atascada' }))?.text).toBe('atascada: escribe /reload-plugins en su chat')
  expect([files[`${HOME}/control/s3.json`], ran.filter(x => x[0] === '/usr/bin/open'), toasts.filter(x => /Abriendo|Escribe/.test(x))]).toEqual([undefined, [OPEN_ARGV], []]) // it answers in text: no toast
  await ui.unmount()
})

const ASLEEP_SYNC = 'dormida · al volver te dirá si falta /reload-plugins'
test('Sync J1: an asleep or long-quiet session on an older version shows a neutral state, no button, no stuck badge, and Ir al chat', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000_000 }), now = clock.now()
  const disk = modDisk()
  // s5: its beat 6.5 h old (idle), the owner's case; s6: put to sleep by the app, with a stuck mark from before.
  const quiet = { ...newBeat('s5', 'callada', now - 6.5 * 3600000), mod: 'aaaaaaaaaaaa', local: LOCAL_ID }
  const asleep = { ...newBeat('s6', 'dormilona', now), ended: true, mod: 'bbbbbbbbbbbb', syncStuck: 'cccccccccccc' }
  for (const x of [quiet, asleep]) setAgent(x, MAIN, x.at, { state: 'terminado', activity: 'Te respondió' })
  const { files, toasts, store } = serveBeats(on, [newBeat('s-test', 'proj', now), quiet, asleep], { dir: disk.dir, run: disk.run }); oldList(store)
  files[`${HOME}/commands/s5.json`] = files[`${HOME}/commands/s6.json`] = JSON.stringify([['reload-plugins', 'Reload', 'builtin']])
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(21_000)
  await until(clock, () => false, 5, 1000)
  const rows = (await textsAll(ui, /dormida|sin actividad/)).map(x => String(x.text))
  expect(rows.filter(x => x.includes(` · ${ASLEEP_SYNC}`))).toHaveLength(2)
  expect((await textsAll(ui, /versión vieja| · falta \/reload-plugins/)).length).toBe(0)
  for (const key of ['pick-s5', 'pick-s6']) {
    await ui.press({ key })
    expect(await btn(ui, 'reload')).toBeUndefined()
    expect((await ui.findAll({ type: 'Text', text: /dormida/ })).map(x => x.text)).toEqual([ASLEEP_SYNC]) // one asleep line on the card
    expect(await ui.find({ type: 'Text', text: /Hay una versión nueva/ })).toBeUndefined()
  }
  expect(await btn(ui, 'open-chat')).toBeUndefined() // s6 has no chat link
  await ui.press({ key: 'pick-s5' })
  expect((await btn(ui, 'open-chat'))?.text).toBe('↗ Ir al chat')
  expect([files[`${HOME}/control/s5.json`], files[`${HOME}/control/s6.json`], toasts.filter(x => /Actualiz/.test(x))]).toEqual([undefined, undefined, []])
  await ui.unmount()
})

// The app refuses every plugin-initiated /reload-plugins ("isn't available over a remote connection": 142 of 142,
// 2026-10-20) and leaves that refusal in the chat. Every path that once ran or sent it: none does now.
test('Sync R: no path runs $.command.run reload-plugins or sends a reload order: the tick, the button, /agentville sync, an old pane\'s order, the field', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const disk = modDisk()
  const a = { ...newBeat('s1', 'vieja', now), mod: 'aaaaaaaaaaaa' }
  setAgent(a, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const { files, store, toasts } = serveBeats(on, [newBeat('s-test', 'proj', now), a], { dir: disk.dir, run: disk.run })
  const runs: string[] = [], typed: string[] = []
  on('command.run', ($2, e, next) => { runs.push(e.command); return next(e) })
  on('command.list', () => ({ value: [{ name: 'reload-plugins', description: 'Reload', source: 'builtin' }, { name: 'review', description: 'Review', source: 'builtin' }] as never }))
  on('prompt.submit', ($2, e) => { typed.push(e.text); return { text: e.text } })
  store['mailbox-key'] = 'k-test'
  await startSession($)
  files[`${disk.mod.root}/hooks/x.ts`] = 'v2' // this session is behind the disk too
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await until(clock, () => !!beatOf(files).syncStuck, 30, 1500) // the tick
  await ui.press({ key: 'pick-s1' })
  await ui.press({ key: 'reload' }) // the button
  await $.command.run({ ...OPEN, args: 'sync' }) // the command
  const n = (clock.now() + 1) * 1000 // an older pane's signed order, then a plain one after it
  await mailbox(files, [await signed('k-test', { n, kind: 'msg', text: '/reload-plugins' }), await signed('k-test', { n: n + 1, kind: 'msg', text: '/RELOAD-PLUGINS' }),
    await signed('k-test', { n: n + 2, kind: 'msg', text: '/agentville:reload-plugins' }), await signed('k-test', { n: n + 3, kind: 'msg', text: '/review 7' })])
  await until(clock, () => typed.includes('`/review` 7'), 30, 1600) // BD item 1: a msg order is only ever a prompt
  const clearOf = async () => (await ui.findAll({ type: 'Client' })).find(c => c.key === 'field-s1')?.props.props as { clear: number }
  const was = (await clearOf()).clear
  await ui.post({ draft: '/Reload-Plugins' }, { in: 'field-s1' }) // typed in the pane's field for vieja
  await ui.press({ key: 'send' })
  await until(clock, () => false, 2, 1000)
  expect((await clearOf()).clear).toBeGreaterThan(was) // its draft cleared: the field is drawn anew, empty
  await ui.post({ send: ' /reload-plugins ' }, { in: 'field-s1' }) // and with Enter
  await until(clock, () => false, 2, 1000)
  expect([runs.filter(x => x !== 'agentville'), typed, files[`${HOME}/control/s1.json`]]).toEqual([[], ['`/review` 7'], undefined])
  expect(toasts.at(-1)).toBe('Escribe /reload-plugins en la sesión vieja')
  await ui.unmount()
})

// AU item 2: the answer and relay paths never send a /command; the field did, so another session ran it as typed.
test('a command another session lists is never sent from the field: it goes to be typed there, else to the clipboard, and the text stays; a path or an unknown /word is a message; to the pane\'s own session it goes', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const a = newBeat('s1', 'vieja', now)
  setAgent(a, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const { files, toasts } = serveBeats(on, [newBeat('s-test', 'proj', now), a])
  const copies: string[] = [], runs: string[] = []
  on('ui.copy', ($2, e) => { copies.push(e.text); return { value: { isCopied: true as const } } })
  on('command.run', ($2, e, next) => { runs.push(`${e.command} ${e.args}`); return next(e) })
  files[`${HOME}/commands/s1.json`] = JSON.stringify([['review', 'Revisa', 'builtin']])
  on('command.list', () => ({ value: [{ name: 'deploy', description: 'Despliega', source: 'user' }] as never })) // this session's: your skills
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const field = async () => (await ui.findAll({ type: 'Client' })).find(c => c.key === 'field-s1')!.props.props as { clear: number; insert?: { text: string } }
  const was = (await field()).clear
  await ui.post({ send: ' /review 7 ' }, { in: 'field-s1' }) // Enter: the field emptied itself
  expect((await field()).insert?.text).toBe('/review 7') // back in the field, arguments and all
  await until(clock, () => toasts.length >= 1, 200, 100) // vieja runs no listener here: no ack, the clipboard
  await ui.post({ draft: '/deploy ya' }, { in: 'field-s1' })
  await ui.press({ key: 'send' }) // Enviar
  await until(clock, () => toasts.length >= 2, 200, 100)
  expect(toasts).toEqual(['Copiado: pega /review con Cmd+V en el chat de vieja (el texto sigue en el campo)', 'Copiado: pega /deploy con Cmd+V en el chat de vieja (el texto sigue en el campo)'])
  expect(copies).toEqual(['/review 7', '/deploy ya'])
  expect((await field()).clear).toBe(was) // the draft stays where it was typed
  expect(ordersIn(files, 's1').map(c => [c.kind, c.text])).toEqual([['fillText', '/review 7'], ['fillText', '/deploy ya']]) // never a message
  // a path, an unknown /word: messages, as typed
  await ui.post({ send: '/Users/x/app/foo.ts falla en el test' }, { in: 'field-s1' })
  await ui.post({ send: '/nope hola' }, { in: 'field-s1' })
  await until(clock, () => ordersIn(files, 's1').length >= 4)
  expect(ordersIn(files, 's1').slice(2).map(c => [c.kind, c.text])).toEqual([['msg', '/Users/x/app/foo.ts falla en el test'], ['msg', '/nope hola']])
  // BD item 1: the pane's own session runs its own command at once, never through its mailbox
  await ui.press({ key: 'pick-s-test' })
  await ui.post({ send: '/deploy ya' }, { in: 'field-s-test' })
  await until(clock, () => runs.includes('deploy ya'))
  expect(ordersIn(files, 's-test')).toEqual([])
  await ui.unmount()
})

// AZ item 3: with no heartbeat (a failed start, the gap after /clear) the pane cannot tell its own session from another.
test('with no heartbeat of its own the pane treats every session as another: a command it lists is not sent', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const a = newBeat('s1', 'vieja', now)
  setAgent(a, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const { files, toasts } = serveBeats(on, [newBeat('s-test', 'proj', now), a])
  files[`${HOME}/commands/s1.json`] = JSON.stringify([['review', 'Revisa', 'builtin']])
  await $.command.run(OPEN) // no session.start: this module has no heartbeat
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  await ui.post({ send: '/review 7' }, { in: 'field-s1' })
  await until(clock, () => toasts.length >= 1, 200, 100) // no ack, no clipboard here: the text stays in the field
  expect(Object.keys(files).some(k => k.startsWith(`${HOME}/sessions/s-test`))).toBe(false) // no heartbeat was written
  expect(toasts).toEqual(['No se envía desde aquí: escribe /review en el chat de vieja. El texto sigue en el campo'])
  expect(t('toast.cmdThere', { cmd: '/review', name: 'vieja' }, 'en')).toBe('Not sent from here: type /review in vieja\'s chat. Your text stays in the field')
  expect(ordersIn(files, 's1').map(c => c.kind)).toEqual(['fillText']) // never a message
  await ui.unmount()
})

// AZ item 1: Enter and Enviar empty the field before the order is written; a failed write gave the message up.
test('a send that fails puts the text back in the field and keeps its image attached, by Enter and by Enviar; the next send carries both', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const a = newBeat('s1', 'vieja', now)
  setAgent(a, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  let full = true // the mailbox write fails, as on a full disk
  const ok = { exitCode: 0, stdout: '', stderr: '' }
  const { files, toasts } = serveBeats(on, [newBeat('s-test', 'proj', now), a], { sips: true, run: argv => (argv[0] === '/usr/bin/osascript' ? ok : sipsRun(argv)),
    waitWrite: p => (full && p.endsWith('/control/s1.json') ? Promise.reject(new Error('disco lleno')) : undefined) })
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const field = async () => (await ui.findAll({ type: 'Client' })).find(c => c.key === 'field-s1')!.props.props as { clear: number; insert?: { n: number; text: string } }
  await ui.post({ pasteImage: true }, { in: 'field-s1' })
  expect((await btn(ui, 'unattach'))?.text).toBe('1 imagen · Quitar')
  toasts.length = 0
  await ui.post({ send: ' hola ' }, { in: 'field-s1' }) // Enter: the field emptied itself
  await until(clock, () => toasts.length >= 1, 200, 50)
  expect(toasts).toEqual(['No se pudo enviar el mensaje (sigue en el campo)'])
  const back = (await field()).insert
  expect(back?.text).toBe('hola')
  expect((await btn(ui, 'unattach'))?.text).toBe('1 imagen · Quitar')
  await ui.post({ draft: 'hola' }, { in: 'field-s1' })
  await ui.press({ key: 'send' }) // Enviar: the field is drawn anew, empty, then the text comes back
  await until(clock, () => toasts.length >= 2, 200, 50)
  expect(toasts[1]).toBe('No se pudo enviar el mensaje (sigue en el campo)')
  expect((await field()).insert).toEqual({ n: back!.n + 1, text: 'hola' })
  expect((await btn(ui, 'unattach'))?.text).toBe('1 imagen · Quitar')
  expect(files[`${HOME}/control/s1.json`]).toBeUndefined()
  full = false
  await ui.post({ draft: 'hola' }, { in: 'field-s1' }) // the field took the insert back and posts it
  await ui.press({ key: 'send' })
  await until(clock, () => ordersIn(files, 's1').length > 0, 200, 50)
  expect(ordersIn(files, 's1')[0]!.text).toMatch(/^hola[\s\S]*\/images\/up-/) // the text and its image
  expect(await btn(ui, 'unattach')).toBeUndefined()
  await ui.unmount()
})

test('Sync J3: /agentville sync says who is current, asleep, needs /reload-plugins typed, or not found, and sends no order', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const disk = modDisk()
  const a = { ...newBeat('s1', 'vieja', now), mod: 'aaaaaaaaaaaa' }, b = { ...newBeat('s2', 'dormida', now), ended: true, mod: 'aaaaaaaaaaaa' }
  const c = newBeat('s3', 'aldia', now), d = { ...newBeat('s4', 'otra', now), mod: 'aaaaaaaaaaaa', local: LOCAL_ID }
  for (const x of [a, b, c, d]) setAgent(x, MAIN, now, { state: 'terminado', activity: 'Te respondió' })
  const { files, ran } = serveBeats(on, [newBeat('s-test', 'proj', now), a, b, c, d], { dir: disk.dir, run: a => (a[0] === '/usr/bin/open' ? { exitCode: 0, stdout: '', stderr: '' } : disk.run(a)) })
  await startSession($)
  files[`${HOME}/sessions/s3.json`] = JSON.stringify({ ...c, mod: beatOf(files).mod })
  const opens = () => ran.filter(x => x[0] === '/usr/bin/open')
  // Not typed by you (another session's message, a model, a plugin even as the user, an unattested channel): nothing happens.
  for (const origin of [{ kind: 'peer-send-message' }, { kind: 'plugin', name: 'x', asUser: true }, { kind: 'unclassified' }]) expect((await $.command.run({ ...OPEN, args: 'sync', origin: origin as never }))?.text).toBe('/agentville sync solo funciona cuando lo escribes tú')
  expect(opens()).toEqual([])
  expect((await $.command.run({ ...OPEN, args: 'sincronizar otra' }))?.text).toBe('otra: escribe /reload-plugins en su chat')
  expect(opens()).toEqual([OPEN_ARGV]) // one session to update: its chat opens
  const all = String((await $.command.run({ ...OPEN, args: 'sync' }))?.text).split('\n').sort()
  expect(all).toEqual(['aldia: ya al día', 'dormida: dormida, al volver te dirá si falta /reload-plugins', 'otra: escribe /reload-plugins en su chat', 'proj: ya al día', 'vieja: escribe /reload-plugins en su chat'])
  expect(opens()).toEqual([OPEN_ARGV]) // two to update: no chat opens, the lines name them
  expect(['s1', 's2', 's4'].map(id => files[`${HOME}/control/${id}.json`])).toEqual([undefined, undefined, undefined])
  expect((await $.command.run({ ...OPEN, args: 'sync nadie' }))?.text).toBe('Ninguna sesión se llama «nadie»')
  expect((await $.command.run({ ...OPEN, args: 'sync ALDIA' }))?.text).toBe('aldia: ya al día')
})

// ---- The office bureaucracy in the pane: a team office (2 teams x 3 and its Jefe), a plain office, the secretaria
// and Producto ----

const TEAM_CREW: [string, string][] = [['A: Función para medir bien', 'agentville:builder'], ['A: Función para medir bien', 'agentville:security-reviewer'], ['A: Función para medir bien', 'agentville:approver'],
  ['B: Error al editar', 'agentville:builder'], ['B: Error al editar', 'agentville:code-reviewer'], ['B: Error al editar', 'agentville:approver']]
/** The team office `t1` (its crew's descriptions named, or plain words), and a plain office `p1`. */
function bureauBeats(now: number, named = true): Beat[] {
  const a = newBeat('t1', 'Conversión de unidades', now), b = newBeat('p1', 'Lista de tareas', now - 1000)
  setAgent(a, MAIN, now, { state: 'trabajando', activity: 'Coordina dos equipos' })
  TEAM_CREW.forEach(([goal, kind], i) => setAgent(a, `ag${i}`, now, { role: roleOf(kind), kind, goal: named ? goal : goal.slice(3), state: 'trabajando', activity: 'Edit x.ts' }))
  a.metas = ['Tienda: F2 optimización']
  setAgent(b, MAIN, now - 1000, { state: 'trabajando', activity: 'Lista compartida' })
  setAgent(b, 'pb1', now - 1000, { role: 'impl', kind: 'agentville:builder', goal: 'Lista compartida', state: 'trabajando', activity: 'Edit y.ts' })
  return [a, b]
}
// Measured with this harness (110 columns, nothing selected), 2026-10-18: 441 elements with the teams, 421 without
// (the same subagents on role desks, one per role): 3 more people's map zones over rows of desks 8 tiles apart.
const BUREAU = { named: 456, plain: 436 } // + 15 for the header's ES | EN switch
for (const named of [true, false]) test(`Bureaucracy AC9: a plain office, the secretaria, Producto and a team office ${named ? 'of 2 x 3' : 'without team names'} stay under TREE_LIMIT, at the measured count`, async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const { files } = serveBeats(on, bureauBeats(now, named))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(lastEls(files)).toBeLessThan(1500)
  expect(lastEls(files)).toBeLessThanOrEqual(BUREAU[named ? 'named' : 'plain'])
  await ui.unmount()
})

test('Bureaucracy AC10: every team member is selected by a press on its own map zone; the staff have none', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = bureauBeats(now)
  serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const keys = await hitKeys(ui), v = floorView(worldFromBeats(null, list, now), 0)
  expect(keys.some(k => k.startsWith('staff') || k === SEC_ID)).toBe(false)
  for (let i = 0; i < TEAM_CREW.length; i++) {
    const id = `t1-ag${i}`
    expect([id, keys.includes(id)]).toEqual([id, true])
    await onMap(ui, id)
    const sel = (await ui.findAll({ type: 'Svg' })).find(x => String(x.props.alt).startsWith('Seleccionado: '))
    expect([id, sel?.props.source]).toEqual([id, selectionLayer(v, now, id)]) // the tile under that member, nobody else's
  }
  expect((await ui.findAll({ type: 'Button' })).some(b => b.key?.includes('@'))).toBe(false) // no plain Button on the map
  await ui.unmount()
})

// ---- The header's language switch, the state pills, the "suggests" state ----

test('the header ES | EN switch: the language in use filled; a press switches the pane, the tour untouched', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const { store } = serveBeats(on, beats(100000))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  // one strip with the header's other buttons: one picture, one Client; ES and EN touch (no gap run between them)
  const head = async () => (await ui.findAll({ type: 'Svg' })).find(x => /Idioma: Español|Language: English/.test(String(x.props.alt)))!
  const runs = async () => ((await ui.findAll({ type: 'Client' })).find(c => c.key === 'btns-head~0')!.props.props as BandP).runs.map(r => r[1])
  expect((await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('btns-head')).map(c => c.key)).toEqual(['btns-head~0'])
  expect((await runs()).filter(Boolean)).toEqual(['tour-open', 'everywhere', 'lang-es', 'lang-en'])
  expect((await runs()).indexOf('lang-en')).toBe((await runs()).indexOf('lang-es') + 1)
  expect(String((await head()).props.alt)).toContain('Idioma: Español (en uso) · Language: English')
  expect(String((await head()).props.source)).toContain('class="btn primary" style="border-radius:5px 0 0 5px"')
  expect(String((await head()).props.source)).toContain('class="btn" style="border-radius:0 5px 5px 0"')
  const tour = JSON.stringify(store.tour)
  await ui.post({ press: 'lang-en' }, { in: 'btns-head~0' })
  expect(store.lang).toBe('en')
  expect((await btn(ui, 'tour-open'))?.text).toBe('Tour')
  expect((await btn(ui, 'everywhere'))?.text).toBe('▸ Always open: Off')
  expect(String((await head()).props.alt)).toContain('Language: English (in use)')
  expect(JSON.stringify(store.tour)).toBe(tour) // no tour opens
  await ui.post({ press: 'lang-en' }, { in: 'btns-head~0' }) // the one in use: a redraw, nothing else
  expect(store.lang).toBe('en')
  await ui.post({ press: 'lang-es' }, { in: 'btns-head~0' })
  expect([store.lang, (await btn(ui, 'tour-open'))?.text]).toEqual(['es', 'Recorrido'])
  await ui.unmount()
})

test('/agentville idioma en and /agentville lang es switch the language and open no pane; no args still opens it', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const { store, panes } = serveBeats(on, beats(100000))
  expect((await $.command.run({ ...OPEN, args: 'idioma en' }))?.text).toBe('Panel language: English.')
  expect(store.lang).toBe('en')
  expect((await $.command.run({ ...OPEN, args: 'lang ES' }))?.text).toBe('Idioma del panel: español.')
  expect(store.lang).toBe('es')
  expect(panes.length).toBe(0)
  expect((await $.command.run(OPEN))?.text).toBe('Agentville abierto. Si el panel sale en negro o no responde: /agentville lite (versión simple, sin mapa). Para ocultar las oficinas sin trabajo: /agentville refresh. Para ver qué sesiones necesitan /reload-plugins: /agentville sync. Si faltan sillas o escritorios: /agentville simple drawing.')
})

// AW: English subcommand names are the primary form; the Spanish ones keep working as aliases.
test('AW: every /agentville subcommand runs by its English name and by its Spanish alias', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const { store } = serveBeats(on, beats(100000))
  const run = async (args: string, kind = 'composer') => (await $.command.run({ ...OPEN, args, origin: { kind } as never }))?.text
  for (const args of ['lite', 'ligero', 'sin mapa']) { delete store.nomap; await run(args); expect([args, store.nomap]).toEqual([args, true]) }
  const refreshed = /^Oficinas ocultas: \d+\./
  expect([await run('refresh'), await run('limpiar')].map(x => refreshed.test(String(x)))).toEqual([true, true])
  expect([await run('sync', 'peer-send-message'), await run('sincronizar', 'peer-send-message')]).toEqual([t('cmd.sync.typed'), t('cmd.sync.typed')])
  expect(await run('sync')).toBe(await run('sincronizar')) // typed by you: the same report
  expect([await run('lang en'), await run('idioma es'), await run('idioma en'), await run('lang es')]).toEqual(['Panel language: English.', 'Idioma del panel: español.', 'Panel language: English.', 'Idioma del panel: español.'])
  // the toggles: each English name flips, its Spanish alias flips back (a fresh store starts on)
  const flips = [['click layer', 'capa de clics', 'cmd.listHitsOff', 'cmd.listHitsOn'], ['list click layer', 'capa de clics', 'cmd.listHitsOff', 'cmd.listHitsOn'], ['simple drawing', 'dibujo simple', 'cmd.svgUseOff', 'cmd.svgUseOn'], ['calibrate clicks', 'calibrar clics', 'cmd.clicksOn', 'cmd.clicksOff']] as const
  for (const [en, es, first, back] of flips) expect([await run(en), await run(es)]).toEqual([t(first), t(back)])
  for (const args of ['calibrate', 'calibrar']) {
    await run(args)
    const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
    expect([args, !!(await ui.find({ type: 'Text', text: /^Calibrando: \d+ KB$/ }))]).toEqual([args, true])
    await ui.press({ key: 'calib-stop' })
    await ui.unmount()
  }
})

test('AW: the help text names the English subcommands first, in both languages; the ways back name no Spanish alias', () => {
  const pairs = [['/agentville lite', 'ligero'], ['refresh', 'limpiar'], ['sync', 'sincronizar'], ['lang es or en', 'idioma'], ['click layer', 'capa de clics'], ['simple drawing', 'dibujo simple'], ['calibrate clicks', 'calibrar clics']]
  for (const d of STRINGS['cmd.description']) for (const [en, es] of pairs) {
    const at = d.indexOf(en!.replace(' or ', d === STRINGS['cmd.description'][0] ? ' o ' : ' or '))
    expect([en, at >= 0, d.includes(es!) ? at < d.indexOf(es!) : true]).toEqual([en, true, true])
  }
  expect(STRINGS['cmd.description'][1]).not.toMatch(/ligero|limpiar|sincronizar|idioma|capa de clics|dibujo simple|calibrar/) // English UI: English names only
  for (const k of ['cmd.opened', 'pane.failedHint'] as const) for (const s of STRINGS[k]) expect(s).not.toMatch(/\/agentville (ligero|limpiar|sincronizar|idioma|capa de clics|dibujo simple|calibrar)/)
})

test('every state pill is 22 px tall and wide enough for its words, icon, gap, padding and borders', () => {
  const size = (src: string) => [Number(/width="([\d.]+)"/.exec(src)![1]), Number(/height="([\d.]+)"/.exec(src)![1])]
  const labels = [...Object.values(STATES).map(s => s.label), 'Done', 'Listo', 'Terminó', 'Espera tu aprobación', 'Te sugiere sesiones']
  for (const label of labels) {
    const [w, ht] = size(chipSvg('terminado', label, '#7fcf98'))
    expect([label, ht, w! >= textW(label, 'w700', 12.5) + 12 + 6 + 2 * 10 + 2 * 1.2]).toEqual([label, 22, true])
  }
  for (const st of ['esperando', 'error', 'trabajando', 'leyendo', 'inactivo', 'terminado', 'sugiere'] as const) expect(size(chipSvg(st, 'Done', '#fff'))[1]).toBe(22)
  // the suggestion: the chip's dot, no icon path; the words start where every pill's do
  const sug = chipSvg('sugiere', 'Te sugiere sesiones', '#a99f90'), done = chipSvg('terminado', 'Terminó', '#7fcf98')
  expect([sug.includes('<circle'), sug.includes('<path'), /<text x="([\d.]+)"/.exec(sug)![1]]).toEqual([true, false, /<text x="([\d.]+)"/.exec(done)![1]])
})

test('a Jefe with only suggested sessions suggests (pill, row, map), never "Espera tu aprobación"; a question or a permission waits', async ($, on) => {
  const { store } = await asking($, on, { ask: false }); oldList(store)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s-test' })
  const pill = async () => (await ui.findAll({ type: 'Svg' })).filter(x => String(x.props.source).includes('rx="10.4"')).map(x => String(x.props.alt))
  const row = async () => (await ui.findAll({ type: 'Text', in: 'btns-pick-s-test' })).map(x => x.text).join(' ')
  const ring = async () => (await ui.findAll({ type: 'Svg' })).some(x => String(x.props.source).includes('values="10;17"'))
  expect(await pill()).toEqual(['Te sugiere sesiones'])
  expect(await row()).toContain('te sugiere sesiones')
  expect(await row()).not.toContain('espera tu aprobación')
  expect(await ring()).toBe(false) // the map's bubble: no amber ring
  expect(String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Te sugiere sesiones' && x.props.width === 5)?.props.source)).toContain('fill="#')
  await ui.unmount()
  store.lang = 'en'
  const en = await mountPane($)
  await en.press({ key: 'pick-s-test' })
  expect((await en.findAll({ type: 'Svg' })).filter(x => String(x.props.source).includes('rx="10.4"')).map(x => String(x.props.alt))).toEqual(['Suggests sessions'])
  expect((await en.findAll({ type: 'Text', in: 'btns-pick-s-test' })).map(x => x.text).join(' ')).toContain('suggests sessions')
  await en.unmount()
})

test('a Jefe with a question, or anyone with a permission, still shows "Espera tu aprobación" in amber', async ($, on) => {
  await asking($, on)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s-test' })
  const pills = (await ui.findAll({ type: 'Svg' })).filter(x => String(x.props.source).includes('rx="10.4"'))
  expect(pills.map(x => String(x.props.alt))).toEqual(['Espera tu aprobación'])
  expect(String(pills[0]!.props.source)).toContain('stroke="#e6973c"')
  await ui.unmount()
})

test('a permission request waits in amber', async ($, on) => {
  mock.clock(on, { now: 100000 })
  oldList(serveBeats(on, beats(100000)).store)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  expect((await ui.findAll({ type: 'Svg' })).filter(x => String(x.props.source).includes('rx="10.4"')).map(x => String(x.props.alt))).toEqual(['Espera tu aprobación'])
  expect((await ui.findAll({ type: 'Text', in: 'btns-pick-s1' })).map(x => x.text).join(' ')).toContain('espera tu aprobación')
  await ui.unmount()
})

test('a character the width table lacks counts a whole em below U+1100 too', () => {
  expect(noteLines('Ж'.repeat(28))).toBe(2)
  expect(textW('Ж', 'w400', 12.5)).toBe(12.5)
})

// ---- Clicks that keep landing, the click calibration, the card's scale, the primary reply and "Ir al chat" ----

// A floor like the live one that lost its clicks (2026-10-19, 134 columns): this session suggesting one session, its
// note's card open by itself, and four busy offices with two helpers each.
// Your office and three at work: a floor whose map keeps every click zone under the page's rule (PAGE_CHARS).
const liveLike = (now: number) => [waitingBeat('s-test', now, { offers: [offerOf(1, now), offerOf(2, now)] }), ...['w1', 'w2', 'w3'].map((id, i) => {
  const b = newBeat(id, `proj${i}`, now - (i + 1) * 3000)
  setAgent(b, MAIN, now - (i + 1) * 3000, { state: 'trabajando', activity: 'Read x.ts' })
  for (const r of ['rev', 'impl'] as const) setAgent(b, `${id}-${r}`, now - (i + 1) * 3000, { role: r, kind: 'x', state: 'trabajando', activity: 'Read x.ts' })
  return b
})]
const layerOf = async (ui: UI) => Object.fromEntries((await bandClients(ui)).map(c => [c.key!, c.props.props as BandP]))
const holding = (l: Record<string, BandP>, key: string) => Object.entries(l).find(([, p]) => p.runs.some(r => r[1] === key))?.[0]

test('A1: band Clients are keyed by their first row: the one holding the note keeps its key as the card opens and closes', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  serveBeats(on, liveLike(now))
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 134 } })
  const ui = await mountAt($, 134)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  const open = await layerOf(ui)
  await onMap(ui, 'screen-notes') // toggles the card shut
  expect(await usecards(ui)).toEqual([])
  const closed = await layerOf(ui)
  expect(JSON.stringify(open)).not.toEqual(JSON.stringify(closed)) // the layer changed (the card's zones came and went)
  expect(Object.keys(closed)).toEqual(expect.arrayContaining(Object.keys(open))) // and its rows stay mounted a while (G4)
  expect(holding(open, 'screen-notes')).toBeDefined()
  expect([holding(open, 'screen-notes'), holding(open, 'screen-notes') === holding(closed, 'screen-notes')]).toEqual([holding(closed, 'screen-notes'), true])
  for (const l of [open, closed]) for (const [k, p] of Object.entries(l)) expect(k).toBe(`hits-${p.b}`) // a row's key is its row in both
  const rowBtns = (await Promise.all((await bandClients(ui)).map(async c => (await ui.findAll({ type: 'Button', in: c.key! })).map(b => [b.key, (c.props.props as BandP).b] as const)))).flat()
  expect(rowBtns.length).toBeGreaterThan(0)
  for (const [k, b] of rowBtns) expect(k).toMatch(new RegExp(`^.+@${b}(\\.\\d+)?$`))
  await ui.unmount()
})

// The drawn click layer as rects (fractions of the map) per key: each band Client is one row of n (its band Box's grow,
// out of 10000, is 1/n), each run its x span.
async function cellsOf(ui: UI, key: string) {
  const grow = new Map((await ui.findAll({ type: 'Box' })).filter(b => /^band-\d+$/.test(b.key ?? '')).map(b => [Number(b.key!.slice(5)), Number(b.props.flexGrow)]))
  const cells: { row: number; n: number; x0: number; x1: number }[] = []
  for (const c of await bandClients(ui)) {
    const p = c.props.props as BandP, n = Math.round(10000 / grow.get(p.b)!)
    let x = 0
    for (const [g, k] of p.runs) { const x0 = x; x += g / 10000; if (k === key) cells.push({ row: p.b, n, x0, x1: x }) }
  }
  return cells
}
// Every row the rect `r` touches holds a run of the key across all of r: the whole drawn element takes the click.
const EPS = 2e-3 // the runs' grows are rounded to 1/10000 each
function coversAll(cells: Awaited<ReturnType<typeof cellsOf>>, r: { x0: number; x1: number; y0: number; y1: number }) {
  const n = cells[0]?.n ?? 0, rows: number[] = []
  for (let j = Math.floor(r.y0 * n); j < r.y1 * n; j++) rows.push(j)
  return rows.length > 0 && rows.every(j => cells.some(c => c.row === j && c.x0 <= r.x0 + EPS && c.x1 >= r.x1 - EPS))
}
// A card's layer as the map draws it: the card's offset and scale, and the map's viewBox, to place a card pixel.
function cardFrame(source: string) {
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(source)!.slice(1).map(Number), tr = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(source)!.slice(1).map(Number)
  const k = Number(/scale\(([-\d.e]+)\)/.exec(source)?.[1] ?? 1)
  const at = (r: { x: number; y: number; w: number; ht: number }) => ({ x0: (tr[0]! + r.x * k - vb[0]!) / vb[2]!, x1: (tr[0]! + (r.x + r.w) * k - vb[0]!) / vb[2]!, y0: (tr[1]! + r.y * k - vb[1]!) / vb[3]!, y1: (tr[1]! + (r.y + r.ht) * k - vb[1]!) / vb[3]! })
  const m = /<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)M[^"]*" stroke="#[0-9a-f]+" stroke-width="2" stroke-linecap="round"\/>/.exec(source)!.slice(1).map(Number)
  return { at, vb, x: at({ x: m[0]!, y: m[1]!, w: m[2]! - m[0]!, ht: m[3]! - m[1]! }) } // x: the drawn ×
}

test('AT: the × of a card, the notes card\'s pills and the disk screen: each zone in the drawn layer covers what is drawn; the disk\'s no more', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now(), offer = offerOf(1, now)
  serveBeats(on, [waitingBeat('s-test', now, { offers: [offer] }), ...liveLike(now).slice(1)])
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 134 } })
  const ui = await mountAt($, 134)
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  const cellX = CELL_PX / mapPx(134), svgOf = async (alt: string) => String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === alt)?.props.source ?? '')
  const closeOk = async (alt: string) => {
    const f = cardFrame(await svgOf(alt)), cells = await cellsOf(ui, 'card-close')
    expect(coversAll(cells, f.x)).toBe(true) // the whole ×
    expect(new Set(cells.map(c => c.row)).size).toBeGreaterThanOrEqual(2) // 2 rows tall
    expect(Math.max(...cells.map(c => c.x1 - c.x0))).toBeGreaterThanOrEqual(3.5 * cellX) // about 4 cells wide
    expect(Math.max(...cells.map(c => c.x1 - c.x0))).toBeLessThanOrEqual(4 * cellX + EPS)
  }
  await closeOk('Sesiones sugeridas')
  // Nothing of a card's zones reaches past the drawn card (its face, not its shadow room): a click there only closes it.
  const notesC = notesCardOf({ title: 'x', items: [{ office: null, title: offer.title, brief: offer.brief }], more: n => `+${n}`, start: t('notes.start'), dismiss: t('q.dismiss'), maxH: 1000 })
  const inside = (cells: Awaited<ReturnType<typeof cellsOf>>, b: { x0: number; x1: number; y0: number; y1: number }) => cells.length > 0 && cells.every(c => c.x0 >= b.x0 - EPS && c.x1 <= b.x1 + EPS && (c.row + 0.5) / c.n >= b.y0 && (c.row + 0.5) / c.n <= b.y1)
  const face = cardFrame(await svgOf('Sesiones sugeridas')).at(notesC.face)
  for (const k of ['card-close', `note-start-${offer.id}`, `note-dismiss-${offer.id}`]) expect([k, inside(await cellsOf(ui, k), face)]).toEqual([k, true])
  // The notes card's pills: the same rects the card draws (its first item's, whatever its title), plus a cell around.
  const pills = notesC.pills
  const f = cardFrame(await svgOf('Sesiones sugeridas'))
  for (const p of pills) {
    const r = f.at(p), cells = await cellsOf(ui, `note-${p.act}-${offer.id}`)
    const n = cells[0]!.n, own = Math.ceil(r.y1 * n) - Math.floor(r.y0 * n)
    expect([p.act, coversAll(cells, r), new Set(cells.map(c => c.row)).size > own]).toEqual([p.act, true, true]) // the whole drawn pill, and a row more
  }
  // A cell of padding on the outer sides (between the two pills, 8 px apart, each keeps its own drawn pill).
  const [start, dismiss] = [pills[0]!, pills[1]!].map(p => f.at(p))
  expect(Math.min(...(await cellsOf(ui, `note-start-${offer.id}`)).map(c => c.x0))).toBeLessThanOrEqual(start!.x0 - cellX + EPS)
  expect(Math.max(...(await cellsOf(ui, `note-dismiss-${offer.id}`)).map(c => c.x1))).toBeGreaterThanOrEqual(dismiss!.x1 + cellX - EPS)
  // The HQ card's ×.
  await onMap(ui, 'card-close')
  await onMap(ui, 'screen-hq')
  expect(await usecards(ui)).toEqual(['usecard-hq'])
  await closeOk('Gasto del HQ')
  await onMap(ui, 'card-close')
  // The disk screen: its zone covers the middle of the drawn screen and reaches at most a row or the merge margin past it
  // (it once ran from the HQ's screen to the map's edge).
  const fx = (X: number) => (X - f.vb[0]!) / f.vb[2]!, fy = (Y: number) => (Y - f.vb[1]!) / f.vb[3]!, d = diskScreenRect(fx, fy), disk = await cellsOf(ui, 'screen-disk')
  const n = disk[0]!.n, mid = (d.y0 + d.y1) / 2
  expect(coversAll(disk, { ...d, y0: mid - 0.25 / n, y1: mid + 0.25 / n })).toBe(true)
  expect(Math.min(...disk.map(c => c.x0))).toBeGreaterThanOrEqual(d.x0 - EDGE_EPS - EPS)
  expect(Math.max(...disk.map(c => c.x1))).toBeLessThanOrEqual(d.x1 + EDGE_EPS + EPS)
  expect(Math.min(...disk.map(c => c.row)) / n).toBeGreaterThanOrEqual(d.y0 - 1 / n)
  expect((Math.max(...disk.map(c => c.row)) + 1) / n).toBeLessThanOrEqual(d.y1 + 1 / n)
  expect(d.x1 - d.x0).toBeLessThan(0.08) // the screen itself: a small part of the map
  await ui.unmount()
})

test('F: Descartar on the notes card lands after the card closed and opened again; the card stays open, the app\'s tool runs', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now(), calls: Record<string, unknown>[] = []
  const { toasts, store } = serveBeats(on, liveLike(now))
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session__dismiss_task', description: '', mcp: true }] }))
  on('tool.call', ($2, e) => { if (e.tool.endsWith('dismiss_task')) { calls.push(e as never); return { result: 'ok', text: 'Task task_idea1 withdrawn.' } as never } return { result: 'ok' } as never })
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 134 } })
  const ui = await mountAt($, 134)
  for (let i = 0; i < 2; i++) { await onMap(ui, 'screen-notes'); await onMap(ui, 'screen-notes') } // shut and open, twice
  expect(await usecards(ui)).toEqual(['usecard-notes'])
  await clock.advance(600)
  await onMap(ui, 'note-dismiss-task_idea1')
  expect(calls.map(c => [c.tool, c.task_id])).toEqual([['mcp__ccd_session__dismiss_task', 'task_idea1']])
  expect([toasts.at(-1), Object.keys(store['offers-done'] as object), await usecards(ui)]).toEqual(['La app descartó «Idea 1»', ['task_idea1'], ['usecard-notes']])
  await ui.unmount()
})

test('F: Descartar never fails silently: a throw on the way says so, and the suggestion shows again to press', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const { toasts, store } = serveBeats(on, [waitingBeat('s-test', now, { offers: [offerOf(1, now)] })]) // this pane's own session: the app's tool runs here
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session__dismiss_task', description: '', mcp: true }] }))
  on('tool.call', () => ({ result: 'ok', text: 'Dismissed.' }) as never)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(600)
  Object.defineProperty(store, 'offers-done', { get: () => undefined, set: () => { throw new Error('store gone') }, configurable: true }) // the store write fails
  await onMap(ui, 'note-dismiss-task_idea1')
  await clock.settle()
  expect(toasts.slice(-2)).toEqual(['Descartando «Idea 1»…', 'No se pudo descartar «Idea 1»']) // said, never silent, no raw error
  expect((await hitKeys(ui)).includes('note-dismiss-task_idea1')).toBe(true) // free to press again
  await ui.unmount()
})

test('F: a suggestion withdrawn from another session (dismiss_task there) leaves every pane on the next sync; a failed one stays', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  const { store } = serveBeats(on, [newBeat('s-test', 'yo', now), waitingBeat('s9', now, { offers: [offerOf(1, now), offerOf(2, now)] })])
  await startSession($)
  const use = (tu: string, id: string) => ({ type: 'assistant', content: [{ type: 'tool_use', id: tu, name: 'mcp__ccd_session__dismiss_task', input: { task_id: id } }] })
  await appendRow($, use('toolu_d1', 'task_idea1'))
  await appendRow($, resultRow('toolu_d1', 'Task task_idea1 withdrawn. The chip is no longer shown to the user.')) // the app's own words
  await appendRow($, use('toolu_d2', 'task_idea2'))
  await appendRow($, { type: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_d2', is_error: true, content: [{ type: 'text', text: 'No such task' }] }] })
  await appendRow($, use('toolu_d3', 'task_idea2'))
  await appendRow($, resultRow('toolu_d3', 'Done.')) // not an error, but not the app's success wording either
  await appendRow($, use('toolu_d4', 'task_idea2'))
  await appendRow($, resultRow('toolu_d4', 'Task task_other withdrawn.')) // another task's
  expect(Object.keys((store['offers-done'] ?? {}) as object)).toEqual(['task_idea1'])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const card = await notesCard(ui)
  expect([card.includes('Idea 1'), card.includes('Idea 2')]).toEqual([false, true])
  await ui.unmount()
})

const UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', LOCAL_ID = `local_${UUID}`
const tints = async (ui: UI) => (await ui.findAll({ type: 'Client' })).map(c => [c.key!.replace(/-.*$/, ''), (c.props.props as { tint?: string }).tint])

test('A2: /agentville calibrar clics tints every Client, toasts each press by its key and act, and a second run stops it', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { toasts } = serveBeats(on, beats(clock.now()))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const off = await tints(ui)
  expect([off.length > 5, off.every(([, x]) => x === undefined)]).toEqual([true, true]) // off: no tint at all
  await onMap(ui, 's2-jefe')
  await ui.post({ press: 'nada' }, { in: 'btns-map~0' })
  expect(toasts.filter(x => x.startsWith('Clic'))).toEqual([])
  expect((await $.command.run({ ...OPEN, args: 'calibrar clics' }))?.text).toBe(t('cmd.clicksOn'))
  await clock.advance(1500)
  expect(await ui.find({ type: 'Text', text: /^Calibrando/ })).toBeUndefined() // not the size calibration
  const on1 = await tints(ui), want: Record<string, string> = { hits: 'rgba(255,60,60,0.30)', btns: 'rgba(60,140,255,0.30)', field: 'rgba(60,200,90,0.25)' }
  expect(on1.length).toBeGreaterThan(5)
  for (const [k, x] of on1) expect([k, x]).toEqual([k, want[k!]])
  await onMap(ui, 's1-jefe')
  expect(toasts.at(-1)).toMatch(/^Clic: hits-\d+ · s1-jefe · con acción$/)
  await ui.post({ press: 'nada' }, { in: 'btns-map~0' })
  expect(toasts.at(-1)).toBe('Clic: btns-map~0 · nada · sin acción')
  const before = toasts.length
  await ui.post({ draft: 'secreto' }, { in: 'field-s1' })
  expect(toasts.length).toBe(before) // a draft is never said
  await ui.post({ send: 'mi texto secreto' }, { in: 'field-s1' })
  await clock.settle()
  const said = toasts.slice(before)
  expect([said[0], said.some(x => x.includes('secreto'))]).toEqual(['Clic: field-s1 · send · con acción', false])
  await ui.press({ key: 'hot-stop' })
  expect(toasts.some(x => x === 'Clic: botón del panel · hot-stop · con acción')).toBe(true)
  expect((await $.command.run({ ...OPEN, args: 'calibrate clicks' }))?.text).toBe(t('cmd.clicksOff'))
  await ui.redraw()
  const off2 = await tints(ui)
  expect([off2.length > 5, off2.every(([, x]) => x === undefined)]).toEqual([true, true])
  const n = toasts.length
  await onMap(ui, 's2-jefe')
  expect(toasts.length).toBe(n)
  await ui.unmount()
})

test('B: the notes card keeps the mock\'s px size up to the default width and one share of the map above it; its pills keep their zones', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  serveBeats(on, [waitingBeat('s1', now, { offers: [offerOf(1, now)] })])
  await $.command.run(OPEN)
  const scaleAt = async (columns: number) => {
    const ui = await mountAt($, columns)
    const src = String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Sesiones sugeridas')!.props.source)
    const keys = (await hitKeys(ui)).filter(k => k.startsWith('note-') || k === 'card-close')
    await ui.unmount()
    return { k: Number(/<g transform="scale\(([0-9.e-]+)\)">/.exec(src)![1]), keys }
  }
  const [s80, s110, s144, s220] = [await scaleAt(80), await scaleAt(110), await scaleAt(144), await scaleAt(220)]
  // drawn in map units at the scale read here (1/k): up to the owner's usual width (144 columns, ~1270 px) k comes from
  // the map's own px, so the card keeps its px size at 80, 110 and 144; at 220 the same scale as at 144, so the same
  // share of the map
  expect(CARD_REF_PX).toBe(mapPx(144))
  for (const [s, c] of [[s80, 80], [s144, 144]] as const) expect(Math.abs(s.k * mapPx(c) - s110.k * mapPx(110)) < 1e-9).toBe(true)
  expect(s220.k).toBe(s144.k)
  for (const s of [s80, s110, s144, s220]) expect(s.keys).toEqual(['card-close', 'note-start-task_idea1', 'note-dismiss-task_idea1'])
})

test('C: the detail card\'s first reply is primary with its ▸, the others outlined', async ($, on) => {
  await asking($, on, { offers: false })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect([(await btn(ui, 'reply-0'))?.text, (await btn(ui, 'reply-1'))?.text]).toEqual(['▸ Sí, arréglalo', 'Solo mira'])
  const pic = async (client: string) => String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === (client === 'btns-q-s-test-0' ? '▸ Sí, arréglalo' : 'Solo mira'))?.props.source ?? '')
  expect([(await pic('btns-q-s-test-0')).includes('class="btn primary"'), (await pic('btns-q-s-test-1')).includes('class="btn primary"')]).toEqual([true, false])
  await ui.unmount()
})

const chatAsk = { id: 'toolu_w9', q: '¿Sigo?', replies: [{ label: 'Sí', text: 'Sí, sigue' }] }
const OPEN_ARGV = ['/usr/bin/open', `claude://claude.ai/epitaxy/${LOCAL_ID}`]
for (const [name, exit, toast] of [['opens it', 0, 'Abriendo el chat de proj'], ['says so when open fails', 1, 'No se pudo abrir el chat en la app']] as const) {
  test(`D: "Ir al chat" on the notes card and the detail card ${name}; never within NOTE_CALM of the card opening`, async ($, on) => {
    const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
    const { ran, toasts } = serveBeats(on, [waitingBeat('s9', now, { ask: chatAsk, local: LOCAL_ID })], { run: a => (a[0] === '/usr/bin/open' ? { exitCode: exit, stdout: '', stderr: '' } : undefined) })
    await $.command.run(OPEN)
    const ui = await mountPane($)
    expect([(await hitKeys(ui)).includes('note-chat-toolu_w9'), (await areas(ui)).includes('btns-chatlink-s9'), (await notesCard(ui)).includes('>↗ Ir al chat</span>')]).toEqual([true, true, true])
    const opens = () => ran.filter(a => a[0] === '/usr/bin/open')
    await onMap(ui, 'note-chat-toolu_w9') // a click meant for the map under the card that just opened
    expect(opens()).toEqual([])
    await clock.advance(600)
    await onMap(ui, 'note-chat-toolu_w9')
    expect([opens(), toasts.at(-1), await usecards(ui)]).toEqual([[OPEN_ARGV], toast, []]) // the card closes, as on any other press
    await ui.press({ key: 'open-chat' })
    expect([opens().length, toasts.at(-1)]).toEqual([2, toast])
    await ui.unmount()
  })
}

test('D: no record id (an older mod, not found yet, no uuid): no chat pill, no chat button, nothing to open', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  serveBeats(on, [waitingBeat('s9', now, { ask: chatAsk }), waitingBeat('s8', now, { ask: { ...chatAsk, id: 'toolu_w8' }, local: 'local_x' })])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect([(await hitKeys(ui)).filter(k => k.startsWith('note-chat')), (await areas(ui)).filter(k => k.startsWith('btns-chatlink')), (await notesCard(ui)).includes('Ir al chat')]).toEqual([[], [], false])
  await ui.unmount()
})

// The live pane went blank ("has not drawn in this pane") after /reload-plugins: an open pane a window re-attaches to,
// or a module starting over under it, is always asked to draw again; the listener's quiet ticks are not.
test('F: an open pane draws again when the session starts over or a window attaches; a quiet tick does not redraw it', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  const { files } = serveBeats(on, beats(clock.now()))
  on('session.attach', ($2, e) => ({ clientId: e.clientId }))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.find({ type: 'Text', text: /Agentville/ })
  const n0 = drawn(files)
  await clock.advance(3100) // nothing changed: no new drawing
  await ui.find({ type: 'Text', text: /Agentville/ })
  expect(drawn(files)).toBe(n0)
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  await ui.find({ type: 'Text', text: /Agentville/ })
  const n1 = drawn(files)
  expect(n1).toBeGreaterThan(n0)
  await startSession($)
  await ui.find({ type: 'Text', text: /Agentville/ })
  expect(drawn(files)).toBeGreaterThan(n1)
  await ui.unmount()
})

// Criterion 7's last case: the world changed under a drawing that still shows "Ir al chat" (the record id went, or is
// no longer a checked one). The kit serializes a press after the redraw, so the race is staged on openChat itself, the
// press's own path, with an engine that answers the world, a toast and a run: it says the chat is gone, runs nothing.
test('D: a press after the session\'s record id is gone or not a checked one in the world toasts that the chat is gone and runs nothing', async () => {
  const now = 100_000
  for (const gone of [undefined, 'local_x', `local_${'-'.repeat(36)}`]) {
    const w = worldFromBeats(null, [waitingBeat('s9', now, { ask: chatAsk, local: LOCAL_ID })], now), d = w.depts.find(x => x.id === 's9')!
    if (gone) d.local = gone; else delete d.local // as the world reads at the press, whatever the drawing showed
    const toasts: string[] = [], runs: (readonly string[])[] = []
    const fake = { state: { get: async () => ({ value: w, version: 1 }) }, ui: { toast: async (text: string) => { toasts.push(text) } }, process: { run: async (argv: readonly string[]) => { runs.push(argv); return { exitCode: 0, stdout: '', stderr: '' } } } }
    await openChat(fake as never, 's9')
    expect([gone, runs, toasts]).toEqual([gone, [], ['Ese chat ya no está en la app']])
  }
  // the same engine with the id still there opens it: the fake answers as the pane's own path expects
  const w = worldFromBeats(null, [waitingBeat('s9', now, { ask: chatAsk, local: LOCAL_ID })], now), runs: (readonly string[])[] = []
  await openChat({ state: { get: async () => ({ value: w, version: 1 }) }, ui: { toast: async () => {} }, process: { run: async (argv: readonly string[]) => { runs.push(argv); return { exitCode: 0, stdout: '', stderr: '' } } } } as never, 's9')
  expect(runs).toEqual([OPEN_ARGV])
})


// ---- Batch G: fewer Clients, fewer redraws, kept hit bands, approvals past the hold, the flood meter ----


test('G1 T3a: the reference world draws at most 12 Clients besides the map\'s bands, one per strip row', async ($, on) => {
  mock.clock(on, { now: 100000 })
  serveBeats(on, beats(100000))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const keys = (await clientKeys(ui)).filter(k => !k.startsWith('hits-'))
  expect(keys.length).toBeLessThanOrEqual(12)
  expect(keys.filter(k => k.startsWith('btns-head') || k.startsWith('btns-top'))).toEqual(['btns-head~0', 'btns-top~0', 'btns-top~1']) // the header strip, the banner's two rows
  // a strip row's runs come from the pictures' px: the header's add up to its picture's width, gaps carry no key
  const head = (await ui.findAll({ type: 'Client' })).find(c => c.key === 'btns-head~0')!.props.props as BandP
  expect(head.runs.reduce((n, r) => n + r[0], 0)).toBeGreaterThan(9990)
  expect(head.runs.filter(r => r[1] === null).length).toBe(2) // Recorrido | Abrir siempre | ES EN
  await ui.unmount()
})
// Four offices in a pane 186 columns wide took 47 Clients for a click per person (mode 0) and stepped down by Clients.
// BC: the map stops growing at MAP_MAX_PX, so its bands stay as at 144 columns and every person keeps a click within
// CLIENT_MAX. The step down by Clients is H1b's, below (a lighter zone set never saves band Clients).
test('H1: four offices at 186 columns keep a click per person within CLIENT_MAX: the map stops growing at MAP_MAX_PX', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const { files } = serveBeats(on, crowd(4, now))
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 186 } })
  const ui = await mountAt($, 186)
  for (const id of ['c0']) {
    await ui.press({ key: `pick-${id}` })
    const keys = await clientKeys(ui), last = lastLog(files)
    expect(keys.length).toBeLessThanOrEqual(CLIENT_MAX)
    expect([last.clients <= CLIENT_MAX, last.viewOnly, last.mode, last.clicks > 0]).toEqual([true, false, 0, true])
    expect(await hitKeys(ui)).toEqual(expect.arrayContaining(['c1-impl', 'c3-qa'])) // a click per person in every office
    expect((await ui.findAll({ type: 'Svg' })).find(x => String(x.props.alt).startsWith('Agentville, piso 1'))?.props.width).toBe(MAP_MAX_PX)
    expect(keys.includes(`field-${id}`)).toBe(true)
  }
  await ui.unmount()
})

// H1b: the Clients still run out at a wide pane when the rest of the pane takes them: four offices and the old list (a
// Client a row) with every idle session shown. A lighter zone set never takes fewer band Clients (whole offices cover at
// least the rows of the people in them: 4 offices at 43 bands need 28, 28 and 31), so the step by Clients goes from a
// click per person to none on the map, within CLIENT_MAX, and the list still picks.
test('H1b: four offices at 186 columns with a long old list step their zones down by Clients, within CLIENT_MAX', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const idle = Array.from({ length: 12 }, (_, i) => { const b = newBeat(`i${i}`, `Idle ${i}`, now - 3600000 - i); setAgent(b, MAIN, b.at, { state: 'inactivo', activity: 'x' }); return b })
  const { files, store } = serveBeats(on, [...crowd(4, now), ...idle]); oldList(store)
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 186 } })
  const ui = await mountAt($, 186)
  await ui.press({ key: 'pick-c0' })
  const before = (JSON.parse(files[`${HOME}/render-log.json`]!) as Logged[]).length
  await ui.press({ key: 'idle-more' }) // every idle row, a Client each
  const passes = (JSON.parse(files[`${HOME}/render-log.json`]!) as Logged[]).slice(before), last = passes.at(-1)!
  expect(passes.some(x => x.mode === 0 && x.clients > CLIENT_MAX)).toBe(true) // a click per person everywhere did not fit
  expect([last.mode, last.noMap, last.clients <= CLIENT_MAX, (await clientKeys(ui)).length <= CLIENT_MAX]).toEqual([-1, false, true, true])
  expect(await ui.find({ type: 'Text', text: /^Hay demasiadas oficinas para hacer clic en el mapa/ })).toBeDefined()
  await ui.press({ key: 'pick-c2' })
  expect(lastLog(files).mode).toBe(-1) // the list still picks
  await ui.unmount()
})

test('H2: the too-heavy latches hold while the pane keeps its width, and reset when the band count or the column bucket changes', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const { files, store } = serveBeats(on, crowd(40, now)); oldList(store) // a full floor 1 and a long list: every latch set
  const passes = () => (JSON.parse(files[`${HOME}/render-log.json`]!) as Logged[]).map(x => [x.mode, x.noMap, x.shed.join('+')])
  await $.command.run(OPEN)
  let ui = await mountPane($)
  const walk = [[0, false, ''], [-1, false, ''], [-1, false, 'bubbles'], [-1, false, 'bubbles+decor']] // the zone sets by Clients, then the ladder
  expect(passes()).toEqual(walk)
  let had = passes().length
  await ui.redraw() // the same width: latched, straight to the light drawing
  expect(passes().slice(had)).toEqual([[0, false, 'bubbles+decor'], [-1, false, 'bubbles+decor']]) // latched: only the Clients' pass
  await ui.unmount()
  for (const cols of [100, 98]) { // fewer bands, then the same bands (kept by bandsAt) in another 10-column bucket: measured afresh
    had = passes().length
    ui = await mountAt($, cols)
    expect([cols, passes().slice(had)]).toEqual([cols, walk])
    await ui.unmount()
  }
})

test('G4 T1: a band that held a zone keeps its Client, empty, 10 s; no hits key leaves the next drawing before that', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 }), now = clock.now()
  serveBeats(on, liveLike(now))
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 134 } })
  const ui = await mountAt($, 134)
  const open = await layerOf(ui)
  await onMap(ui, 'screen-notes') // the card shuts: its zones leave their bands
  const closed = await layerOf(ui)
  expect(Object.keys(closed)).toEqual(expect.arrayContaining(Object.keys(open)))
  const gone = Object.keys(open).filter(k => !closed[k]!.runs.some(r => r[1]))
  expect(gone.length).toBeGreaterThan(0)
  for (const k of gone) expect([k, await ui.findAll({ type: 'Button', in: k })]).toEqual([k, []]) // kept, with no Button
  await clock.advance(10001)
  await ui.redraw()
  const later = await layerOf(ui)
  for (const k of gone) expect(later[k]).toBeUndefined()
  await ui.unmount()
})

test('G3: drawnSig ignores what no screen draws and sees local, req, activity and the zones', () => {
  const now = 100000, list = beats(now), w = worldFromBeats(null, list, now)
  const sig = drawnSig(w, now)
  expect(drawnSig({ ...w, log: [{ at: 1, text: 'x' }] }, now)).toBe(sig)
  expect(drawnSig({ ...w, depts: w.depts.map(d => ({ ...d, task: 'otra' })) }, now)).toBe(sig)
  const visit = (until: number) => ({ ...w, agents: w.agents.map((a, i) => (i ? a : { ...a, visit: { x: 1, y: 1, until } })) })
  expect(drawnSig(visit(now + 60000), now)).toBe(drawnSig(visit(now + 63000), now)) // a running secretaria renews it every sync
  expect(drawnSig(visit(now - 1), now)).not.toBe(drawnSig(visit(now + 1), now))
  expect(drawnSig({ ...w, depts: w.depts.map(d => ({ ...d, local: LOCAL_ID })) }, now)).not.toBe(sig)
  expect(drawnSig({ ...w, agents: w.agents.map(a => ({ ...a, req: 'r9' })) }, now)).not.toBe(sig)
  expect(drawnSig({ ...w, agents: w.agents.map(a => ({ ...a, activity: 'otra' })) }, now)).not.toBe(sig)
  expect(drawnSig({ ...w, agents: w.agents.map(a => ({ ...a, x: a.x + 3 })) }, now)).not.toBe(sig) // people (and their zones) moved
})

test('G3: a sync that changes nothing drawn stores nothing and draws nothing; an activity change draws once', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), list = beats(clock.now())
  // a running secretaria: the Jefe's visit at her desk is renewed on every sync, a field no screen draws as a time
  setAgent(list[1]!, 'sec1', clock.now(), { role: 'qa', kind: 'agentville:secretaria', state: 'trabajando', activity: 'Lee la meta' })
  const { files } = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await sync(clock)
  const before = drawn(files)
  for (const b of list) b.at = clock.now() + 3000 // heartbeats written again, nothing new in them
  await sync(clock)
  expect(drawn(files)).toBe(before)
  setAgent(list[1]!, MAIN, clock.now() + 3000, { activity: 'Read z.ts' })
  await sync(clock)
  expect(drawn(files)).toBe(before + 1)
  await ui.unmount()
})

test('G5: a request past the hold shows the whole request, where to answer it and ↗ Ir al chat, no Aprobar; with no link, no button', async ($, on) => {
  const now = mock.clock(on, { now: 100000 }).now()
  const list = beats(now).map(b => (b.id === 's1' ? { ...b, local: LOCAL_ID } : b)) // s1's Jefe waits with no req: the hold passed
  setAgent(list[0]!, MAIN, now, { cmd: 'pnpm test', tool: 'Bash', req: null })
  const { ran, toasts } = serveBeats(on, list, { run: a => (a[0] === '/usr/bin/open' ? { exitCode: 0, stdout: '', stderr: '' } : undefined) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  expect((await ui.findAll({ type: 'Code' })).map(c => c.props.source)).toContain('pnpm test')
  expect(await ui.find({ type: 'Text', text: /Respóndelo en la sesión tienda/ })).toBeDefined()
  expect((await areas(ui)).filter(k => k.startsWith('btns-chatlink') || k.startsWith('btns-ask'))).toEqual(['btns-chatlink-s1'])
  expect((await btn(ui, 'open-chat'))?.text).toBe('↗ Ir al chat')
  expect((await ui.findAll({ type: 'Button' })).filter(b => ['a', 'r'].includes(String(b.props.hotkey)))).toEqual([])
  await ui.press({ key: 'open-chat' })
  expect([ran.filter(a => a[0] === '/usr/bin/open'), toasts.at(-1)]).toEqual([[OPEN_ARGV], 'Abriendo el chat de tienda'])
  await ui.unmount()
})

test('G5: a Bash request held in the pane keeps Aprobar and Rechazar and no chat button', async ($, on) => {
  const now = mock.clock(on, { now: 100000 }).now()
  const list = held(now).map(b => (b.id === 's1' ? { ...b, local: LOCAL_ID } : b))
  serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  expect((await areas(ui)).filter(k => k.startsWith('btns-chatlink') || k.startsWith('btns-ask'))).toEqual(['btns-ask-s1-jefe'])
  expect([(await btn(ui, 'q-ok-r1'))?.text, (await btn(ui, 'q-no-r1'))?.text]).toEqual(['▸ Aprobar en el chat (A)', 'Rechazar (R)'])
  await ui.unmount()
})

test('G5: a request for Edit, then the turn ends asking: the heartbeat drops the tool, the banner and card never say Edit', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 })
  const { files } = serveBeats(on, [newBeat('s-test', 'proj', clock.now())])
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'Asked in the session' } }))
  on('turn.complete', ($2, e) => ({ text: e.answer }))
  await startSession($)
  await $.classic.PermissionRequest({ tool_name: 'Edit', tool_input: { file_path: '/home/test/proj/a.ts', old_string: 'a', new_string: 'b' } } as never)
  expect(beatOf(files).agents[MAIN]!.tool).toBe('Edit')
  await appendRow($, wrapRow({ recap: 'Hecho.', ask: QUESTION, actions: ACTIONS }))
  await endTurn($)
  expect([beatOf(files).agents[MAIN]!.tool, beatOf(files).agents[MAIN]!.state]).toEqual([undefined, 'esperando'])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(await bannerAlt(ui)).not.toContain('Edit')
  expect(JSON.stringify(await ui.drawn())).not.toMatch(/"Edit\b/)
  await ui.unmount()
})

test('G7: calibrar clics adds the flood meter under the drawing; off it adds nothing; past a limit it warns', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 })
  serveBeats(on, beats(100000))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  const meter = () => ui.find({ type: 'Text', text: /^Carga del panel: / })
  const top = async () => ((await ui.drawn()) as { props: Record<string, unknown> }).props
  expect([await meter(), (await top()).paddingX]).toEqual([undefined, 1]) // off: the drawing as it is
  await $.command.run({ ...OPEN, args: 'calibrar clics' })
  await ui.redraw()
  const line = String((await meter())?.props.children ?? (await meter())?.text)
  expect(line).toMatch(/^Carga del panel: \d+ conexiones · \d+,\d dibujos por segundo · \d+,\d mensajes por segundo/) // ES: a decimal comma
  expect(Number(/(\d+) conexiones/.exec(line)![1])).toBe((await clientKeys(ui)).length)
  expect((await meter())?.props.wrap).toBe('wrap')
  // its age counts up under it by itself (SMIL), a new source each draw so the clock starts again
  const age = async () => String((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Antigüedad de las cifras de carga')?.props.source)
  const first = await age()
  for (const [txt, at] of [['hace 0s', '0s'], ['hace 15s', '15s'], ['hace 2 min', '120s']]) expect(first).toContain(`>${txt}<set attributeName="visibility" to="visible" begin="${at}"`)
  await clock.advance(1000)
  await ui.redraw()
  expect(await age()).not.toBe(first)
  for (let i = 0; i < 6; i++) await ui.redraw() // more than one draw a second over the last 5 s
  expect(String((await meter())?.props.children ?? (await meter())?.text)).toContain('Riesgo de saturación: el panel podría quedarse en blanco.')
  expect((await meter())?.props.color).toBe(paletteOf(undefined).wait)
  await $.command.run({ ...OPEN, args: 'calibrar clics' }) // off again
  await ui.redraw()
  expect(await meter()).toBeUndefined()
  await ui.unmount()
})

// Simulation bench findings (batch G): the notes pin, a fresh request, and map keys through a newcomer and a resize.
const runAt = (p: BandP, x: number) => { let at = 0; for (const r of p.runs) { at += r[0] / 10000; if (x < at) return r[1] } return null }
test('G: every point of the drawn notes pin opens the notes: its zone takes the whole bands it touches, over the Jefe', async ($, on) => {
  const now = mock.clock(on, { now: 100_000 }).now()
  serveBeats(on, liveLike(now))
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 134 } })
  const ui = await mountAt($, 134)
  const w = worldFromBeats(null, liveLike(now), now), view = floorView(w, 0)
  const pin = hotspots(view, now, false, undefined, '2 notas').find(z => z.group === 'screen-notes')!, n = bandCount(view.rows ?? 1, 134)
  const layer = await layerOf(ui)
  const rows = Array.from({ length: Math.ceil(pin.y1 * n) - Math.floor(pin.y0 * n) }, (_, i) => Math.floor(pin.y0 * n) + i)
  expect(rows.length).toBeGreaterThan(1) // the pin straddles bands: the case that left parts of it dead or the Jefe's
  for (const r of rows) for (const x of [pin.x0 + 0.002, (pin.x0 + pin.x1) / 2, pin.x1 - 0.002]) expect([r, x, runAt(layer[`hits-${r}`]!, x)]).toEqual([r, x, 'screen-notes'])
  await ui.unmount()
})

test('G: a request written while the pane is open shows Aprobar within a second, not on the next 3 s sync', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 })
  serveBeats(on, [newBeat('s-test', 'proj', clock.now())])
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'Asked in the session' } }))
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(3100) // a sync just ran
  void $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'pnpm test' } } as never)
  await clock.advance(0)
  await clock.advance(1000)
  expect((await btnsAll(ui)).some(b => b.key?.startsWith('q-ok-'))).toBe(true)
  await clock.advance(10000)
  await ui.unmount()
})

test('H5: the header strip never breaks a line between ES and EN, whatever the width', async ($, on) => {
  mock.clock(on, { now: 100000 })
  serveBeats(on, beats(100000))
  await $.command.run(OPEN)
  let split = 0
  for (let cols = 30; cols <= 80; cols += 2) {
    const ui = await mountAt($, cols)
    const rows = (await ui.findAll({ type: 'Client' })).filter(c => c.key!.startsWith('btns-head~')).map(c => Object.keys((c.props.props as { words: Record<string, string> }).words))
    for (const r of rows) expect([cols, r.includes('lang-es'), r.includes('lang-en')]).toEqual([cols, r.includes('lang-en'), r.includes('lang-es')])
    if (rows.length > 1) split++
    await ui.unmount()
  }
  expect(split).toBeGreaterThan(0) // some widths do break the strip, just never inside ES | EN
})

test('H3: the ticker syncs early only for a stored request time between the last sync and now', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 })
  const { store, reads } = serveBeats(on, [newBeat('s1', 'tienda', clock.now())])
  await $.command.run(OPEN)
  const ui = await mountPane($)
  // each probe right after a 3 s sync, read 1 s later: only an early sync reads the heartbeats in that second
  const read = (from: number) => reads.slice(from).some(p => p.endsWith('/sessions/s1.json'))
  const synced = async (v: (now: number) => unknown) => {
    for (let had = reads.length, i = 0; i < 40 && !read(had); i++) await clock.advance(100) // up to the next 3 s sync
    store['req-at'] = v(clock.now())
    const had = reads.length
    await clock.advance(1000)
    return read(had)
  }
  expect(await synced(() => undefined)).toBe(false)
  expect(await synced(now => now + 60_000)).toBe(false) // from the future: refused, or it would sync every second
  expect(await synced(now => String(now))).toBe(false) // not a number
  expect(await synced(now => now - 10_000)).toBe(false) // before the last sync: already seen
  expect(await synced(now => now)).toBe(true)
  await ui.unmount()
})

test('H3: a held request stores its time after the heartbeat is saved, and the relink grep has a 5 s timeout', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000 })
  let slow = false // the heartbeat write takes 50 ms of mock time: the stored time must come after it
  const { store, inits, ran } = serveBeats(on, [newBeat('s-test', 'proj', clock.now())], { waitWrite: p => (slow && p.endsWith('/sessions/s-test.json') ? clock.sleep(50) : undefined) })
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'Asked in the session' } }))
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(3100)
  slow = true
  const asked = clock.now()
  void $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'pnpm test' } } as never)
  await until(clock, () => store['req-at'] !== undefined, 20, 10)
  expect(store['req-at']).toBeGreaterThanOrEqual(asked + 50)
  slow = false
  const grep = ran.findIndex(a => a[0] === '/usr/bin/grep')
  expect([grep >= 0, (inits[grep] as { timeoutMs?: number } | undefined)?.timeoutMs]).toEqual([true, 5000])
  await clock.advance(10000)
  await ui.unmount()
})

test('G: map click keys survive a newcomer and a resize from 140 to 134 columns', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), list = beats(clock.now())
  serveBeats(on, list)
  await $.command.run({ ...OPEN, presentation: { isFullscreen: false, columns: 140 } })
  let ui = await mountAt($, 140)
  const pairs = async () => new Set((await Promise.all((await bandClients(ui)).map(async c => (await ui.findAll({ type: 'Button', in: c.key! })).map(b => `${c.key} ${b.key}`)))).flat())
  const before = await pairs()
  expect(before.size).toBeGreaterThan(0)
  setAgent(list[0]!, 'ag2', clock.now() + 3000, { role: 'qa', kind: 'qa', state: 'trabajando', activity: 'Read z.ts' }) // a newcomer
  list[0]!.at = clock.now() + 3000
  await clock.advance(3100)
  const joined = await pairs()
  expect([...before].filter(k => !joined.has(k))).toEqual([])
  await ui.unmount()
  ui = await mountAt($, 134)
  const resized = await pairs()
  expect([...joined].filter(k => !resized.has(k))).toEqual([])
  await ui.unmount()
})

// Batch T (render rate): live, a busy pane drew ~1.7 trees of ~300 KB a second and the desktop froze re-applying them.
// The busy scene: 16 offices, someone waiting (the ticker reads every second), every agent's activity new each 500 ms.
const busyScene = (now: number) => {
  const list = crowd(4, now) // a tree past HEAVY_KB that still keeps its map under the page's rule
  setAgent(list[0]!, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r-busy' })
  let n = 0
  const churn = (at: number) => { n++; for (const b of list) { for (const k of Object.keys(b.agents)) if (k !== MAIN || b !== list[0]) b.agents[k]!.activity = `Read f${n}.ts`; b.at = at } }
  return { list, churn, last: () => `Read f${n}.ts` }
}
const renderLog = (files: Record<string, string>) => JSON.parse(files[`${HOME}/render-log.json`] ?? '[]') as { at: number; kb?: number }[]
const logDraws = (events: string[]) => events.filter(e => e === `write ${HOME}/render-log.json`).length
test('T: a heavy busy pane redraws at most once per RENDER_GAP from background change, and the last change is drawn', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000_000 }), scene = busyScene(clock.now())
  const { events, files } = serveBeats(on, scene.list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect(renderLog(files).at(-1)!.kb!).toBeGreaterThan(HEAVY_KB) // heavy, as live
  const before = logDraws(events)
  for (let i = 0; i < 20; i++) { scene.churn(clock.now() + 1); await clock.advance(500) } // 10 s: before batch T, 10 renders
  const n = logDraws(events) - before
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(Math.ceil(10000 / RENDER_GAP)) // 7: one per gap
  const ats = renderLog(files).map(x => x.at)
  for (let i = 1; i < ats.length; i++) expect(ats[i]! - ats[i - 1]!).toBeGreaterThanOrEqual(RENDER_GAP)
  // the last change, read inside a gap, is drawn when the gap ends: nothing more changes after it
  scene.churn(clock.now() + 1)
  await clock.advance(1000) // the ticker reads it: drawn within RENDER_GAP of the last drawing
  await clock.advance(RENDER_GAP)
  expect(await textsAll(ui, scene.last())).not.toEqual([])
  const settled = logDraws(events)
  await clock.advance(5000)
  expect(logDraws(events)).toBe(settled) // nothing changed: no redraw (drawnSig)
  await ui.unmount()
})

test('T: on a heavy pane a press redraws at once, inside the gap', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000_000 }), scene = busyScene(clock.now())
  const { events } = serveBeats(on, scene.list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  scene.churn(clock.now() + 1)
  await clock.advance(1000) // a background redraw: the gap starts
  const before = logDraws(events)
  await ui.press({ key: 'pick-c3' })
  expect(logDraws(events)).toBeGreaterThan(before)
  expect((await ui.findAll({ type: 'Client' })).some(c => c.key === 'field-c3')).toBe(true)
  await ui.unmount()
})

// Review round 1: a press drawing inside the gap while a background redraw waited; a change read after it still draws.
test('T: on a heavy pane a change read after a press inside the gap is drawn when the gap ends', async ($, on) => {
  const clock = mock.clock(on, { now: 100_000_000 }), scene = busyScene(clock.now())
  serveBeats(on, scene.list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await clock.advance(800)
  await ui.press({ key: 'pick-c3' }) // a drawing 800 ms in
  scene.churn(clock.now() + 1)
  await clock.advance(200) // the ticker reads it: its redraw waits for the gap (to 2300)
  await ui.press({ key: 'pick-c2' }) // a press draws it first
  scene.churn(clock.now() + 1) // another change, read at 2000 while the old wait would still stand
  await clock.advance(1000)
  await clock.advance(RENDER_GAP)
  expect(await textsAll(ui, scene.last())).not.toEqual([])
  await ui.unmount()
})

test('T: a light pane is not throttled: a change every second, a redraw every second', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), list = [newBeat('s1', 'tienda', clock.now()), newBeat('s2', 'blog', clock.now())]
  setAgent(list[0]!, MAIN, clock.now(), { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r1' }) // read every second
  const { events, files } = serveBeats(on, list)
  await $.command.run({ ...OPEN, args: 'ligero' }) // the pane without the map: light
  const ui = await mountPane($)
  expect(renderLog(files).at(-1)!.kb!).toBeLessThanOrEqual(HEAVY_KB)
  const before = logDraws(events)
  for (let i = 0; i < 10; i++) { list[1]!.usage = { pct: 1, tokens: 1, window: 1, usd: i + 1, cats: [], limits: [] }; list[1]!.at = clock.now() + 1; await clock.advance(1000) }
  expect(logDraws(events) - before).toBe(10)
  await ui.unmount()
})

// ---- AE: permission requests you can answer in time, messages that show queued ----

test('AE: a held request carries its hold end; it stays after an unanswered hold and goes with an answer', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const { files, store } = serveBeats(on, beats(clock.now()))
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'Asked in the session' } }))
  store['mailbox-key'] = 'k-test'
  await startSession($)
  await $.command.run(OPEN)
  const t0 = clock.now()
  let done = false
  void ask($).then(() => { done = true })
  await clock.advance(0)
  // The hold is a fixed 8 s (HOLD_MS); the kit's clock may have moved a little before the hook read it.
  const held = beatOf(files).agents[MAIN]!.held!
  expect([typeof beatOf(files).agents[MAIN]!.req, held >= t0 + 7500 && held <= t0 + 8000]).toEqual(['string', true])
  await clock.advance(9000)
  await until(clock, () => done, 50, 100)
  expect(beatOf(files).agents[MAIN]).toMatchObject({ req: null, held, state: 'esperando' }) // lapsed: the pane says so
  done = false
  void ask($).then(() => { done = true })
  await clock.advance(0)
  const req = beatOf(files).agents[MAIN]!.req!
  await mailbox(files, [await signed('k-test', { n: clock.now() * 1000, kind: 'deny', req })])
  await clock.advance(1000)
  await until(clock, () => done, 50, 100)
  expect(beatOf(files).agents[MAIN]!.held).toBeUndefined() // answered
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'x'.repeat(400) } })
  expect(beatOf(files).agents[MAIN]!.held).toBeUndefined() // never held for the pane: no hold end
})

// tienda (s1) was started from blog (s2), whose chat the app knows: the app asks tienda's permissions in blog's chat.
const childHeld = (now: number, held: number) => {
  const list = beats(now)
  list[0]!.parent = 's2'; list[1]!.local = LOCAL_ID
  setAgent(list[0]!, MAIN, now, { req: 'r1', held })
  return list
}
test('AE: Aprobar and Rechazar count the hold down with the same keys; past it no answer, the card names the starting chat', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now()
  const { files, toasts, ran } = serveBeats(on, childHeld(t0, t0 + 6000))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const labels = async () => [(await btn(ui, 'q-ok-r1'))?.text, (await btn(ui, 'q-no-r1'))?.text]
  const clients = async () => (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-ask-s1-jefe'))
  expect(await labels()).toEqual(['▸ Aprobar en el chat (A · 6 s)', 'Rechazar (R · 6 s)'])
  const keys = await clients()
  expect(keys).toEqual(['btns-ask-s1-jefe~0'])
  await clock.advance(2000)
  // the ticker redrew (a heavy pane at most once per RENDER_GAP, so 5 or 4 s): only the labels moved
  const [ok2, no2] = await labels(), s2 = /(\d) s\)$/.exec(ok2 ?? '')?.[1]
  expect([ok2, no2]).toEqual([`▸ Aprobar en el chat (A · ${s2} s)`, `Rechazar (R · ${s2} s)`])
  expect(['4', '5']).toContain(s2)
  expect(await clients()).toEqual(keys)
  expect((await keyed(ui, 'a')).map(b => b.key)).toEqual(['hot-q-ok-r1'])
  await clock.advance(4500) // past the hold, the session's file still holding r1
  expect(await labels()).toEqual([undefined, undefined])
  expect(await keyed(ui, 'a')).toEqual([])
  expect((await textsAll(ui, 'Se acabó el tiempo para responder aquí. Respóndelo en el chat blog de la app, donde aparece la solicitud.')).length).toBe(1)
  expect(await ui.find({ type: 'Client', key: 'btns-ask-s1-jefe~0' })).toBeUndefined() // nothing left to press
  expect(ordersIn(files)).toEqual([])
  await ui.press({ key: 'open-chat' })
  expect(ran.filter(a => a[0] === '/usr/bin/open')).toEqual([['/usr/bin/open', expect.stringContaining(UUID)]]) // blog's chat, not tienda's
  expect(toasts.filter(x => /pide permiso/.test(x))).toEqual([])
  await ui.unmount()
})

// 1.1.0: the app asks a child session's permission in the chat that started it, so Aprobar en el chat opens that one.
test('Aprobar en el chat on a child session\'s request opens the starter session\'s chat and sends no order', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now()
  const { files, toasts, ran } = serveBeats(on, childHeld(t0, t0 + 6000), { run: a => (a[0] === '/usr/bin/open' ? { exitCode: 0, stdout: '', stderr: '' } : undefined) })
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  await ui.press({ key: 'q-ok-r1' })
  await until(clock, () => toasts.some(x => x.startsWith('Abriendo')), 20)
  expect(ran.filter(a => a[0] === '/usr/bin/open')).toEqual([OPEN_ARGV]) // blog's chat (s2), not tienda's
  expect(toasts.at(-1)).toBe('Abriendo el chat de blog: apruébalo allí cuando Claude te lo pregunte (en 8 s como mucho)')
  expect(ordersIn(files)).toEqual([])
  await ui.unmount()
})

test('AE: a press that lands after the hold end sends nothing, even from a drawing that still showed the buttons', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now()
  const { files, toasts } = serveBeats(on, childHeld(t0, t0 + 1200))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await btn(ui, 'q-ok-r1'))?.text).toBe('▸ Aprobar en el chat (A · 2 s)')
  await clock.advance(1300) // past the end, before the gated redraw (heavy pane) or the next tick draws again
  expect((await btn(ui, 'q-ok-r1'))?.text).toBe('▸ Aprobar en el chat (A · 2 s)') // the drawing on screen still shows it
  await ui.press({ key: 'q-no-r1' }) // 1.1.0: Rechazar is the pane's only answer; Aprobar en el chat sends nothing
  await until(clock, () => toasts.length > 0, 20)
  expect(ordersIn(files)).toEqual([])
  expect(toasts).toEqual(['Se acabó el tiempo para responder aquí. Respóndelo en el chat blog de la app, donde aparece la solicitud.']) // the card's own words
  await ui.unmount()
})

test('AE: a new request toasts once, opens the notes card on it and marks the strip new; its pill selects who asks', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now(), list = beats(t0)
  setAgent(list[0]!, MAIN, t0, { state: 'trabajando', activity: 'Bash', cmd: null })
  const { toasts } = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s2' })
  expect(await hitKeys(ui)).not.toContain('note-perm-r1')
  setAgent(list[0]!, MAIN, t0, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r1', held: t0 + 9000 })
  list[0]!.at = t0 + 1
  await clock.advance(3100) // the next sync
  expect(toasts).toEqual([expect.stringMatching(/^\S+ · tienda pide permiso: recházalo aquí en [5-6] s o apruébalo en el chat$/)]) // one toast, not "Te espera" too
  expect(await bannerAlt(ui)).toMatch(/^Nuevo · Te espera 1\. /)
  expect(await hitKeys(ui)).toContain('note-perm-r1') // the notes card opened on it by itself
  const pill = async () => /Ver y responder \((\d) s\)/.exec((await ui.findAll({ type: 'Svg' })).map(x => String(x.props.source)).join(' '))?.[1]
  expect(['5', '6']).toContain(await pill()) // its pill counts the hold down too (AE2)
  await clock.advance(1100)
  expect(toasts).toHaveLength(1) // once per request
  expect(await keyed(ui, 'a')).toEqual([]) // blog selected: A answers nothing yet
  await onMap(ui, 'note-perm-r1')
  expect(await btn(ui, 'q-ok-r1')).toBeDefined() // tienda's card, the command whole, with Aprobar
  expect((await keyed(ui, 'a')).map(b => b.key)).toEqual(['hot-q-ok-r1']) // and A answers it at once (AE2)
  await clock.advance(7000) // lapsed: the note and the mark go
  expect(await hitKeys(ui)).not.toContain('note-perm-r1')
  expect(await bannerAlt(ui)).toMatch(/^Te espera 1\. /)
  await ui.unmount()
})

test('AE: a message sent to a busy session shows queued at once until the session lists it; the field says it goes after a permission', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), now = clock.now(), list = held(now)
  serveBeats(on, list)
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const placeholder = async (id: string) => ((await ui.findAll({ type: 'Client' })).find(c => c.key === `field-${id}`)?.props.props as { placeholder: string }).placeholder
  expect(await placeholder('s1')).toMatch(/^Escríbele a \S+… \(te pide permiso: tu mensaje va después\)$/)
  const queued = async () => (await textsAll(ui, /^Tú \(en cola\): $/)).length
  await ui.post({ send: 'y luego el README' }, { in: 'field-s1' })
  await clock.settle()
  expect(await queued()).toBe(1)
  pushChat(list[0]!, { who: 'tú', text: 'y luego el README', queued: true }) // the session took it into its queue
  list[0]!.at = now + 1
  await clock.advance(3100) // a sync, and the (gated) redraw after it
  expect(await queued()).toBe(1) // its own row now, not two
  pushChat(list[0]!, { who: 'tú', text: 'y luego el README' })
  list[0]!.at = now + 2
  await clock.advance(3100)
  expect(['delivered', await queued()]).toEqual(['delivered', 0])
  setAgent(list[0]!, MAIN, now, { state: 'trabajando', activity: 'Bash', cmd: null, req: null }) // the permission answered, still at work
  list[0]!.at = now + 3
  await clock.advance(3100)
  expect(await placeholder('s1')).toMatch(/^Escríbele a \S+… \(está trabajando: tu mensaje queda en cola\)$/)
  await ui.press({ key: 'pick-s2' }) // done: nothing queued
  await ui.post({ send: 'gracias' }, { in: 'field-s2' })
  await clock.settle()
  expect(['idle', await queued()]).toEqual(['idle', 0])
  await ui.unmount()
})

// BD round 1: a sent `/word` message arrives with that word in backticks (asPrompt); a session on an older mod lists it
// plain. Either row takes the queued one.
test('a queued /review 7 clears against a backticked row and against a plain row', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), now = clock.now(), list = held(now)
  serveBeats(on, list)
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const queued = async () => (await textsAll(ui, /^Tú \(en cola\): $/)).length
  let at = now
  for (const row of ['`/review` 7', '/review 7']) {
    await ui.post({ send: '/review 7' }, { in: 'field-s1' })
    await clock.settle()
    expect([row, await queued()]).toEqual([row, 1])
    pushChat(list[0]!, { who: 'tú', text: row })
    list[0]!.at = ++at
    await clock.advance(3100)
    expect([row, await queued()]).toEqual([row, 0])
  }
  await ui.unmount()
})

test('AE: the pane asks for the same inline height at every open', async ($, on) => {
  mock.clock(on, { now: 100000 })
  const { opens } = serveBeats(on, beats(100000))
  await $.command.run(OPEN)
  await $.command.run(OPEN)
  expect(opens).toEqual([{ rows: PANE_ROWS, columns: 110 }, { rows: PANE_ROWS, columns: 110 }])
})

// ---- AE2: the carry-over of AE ----

test('AE2: a hold end a session wrote past its 10 s budget counts down from 10 s at most, then offers no answer', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now()
  const { files } = serveBeats(on, childHeld(t0, t0 + 600000))
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await btn(ui, 'q-ok-r1'))?.text).toBe('▸ Aprobar en el chat (A · 10 s)')
  await clock.advance(10500)
  expect(await btn(ui, 'q-ok-r1')).toBeUndefined()
  expect((await textsAll(ui, /^Se acabó el tiempo para responder aquí\./)).length).toBe(1)
  expect(ordersIn(files)).toEqual([])
  await ui.unmount()
})

test('AE2: requests that arrive together toast once with their count; one already past its hold end gets no permission toast, only Te espera', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now(), list = beats(t0)
  setAgent(list[0]!, MAIN, t0, { state: 'trabajando', activity: 'Bash', cmd: null })
  const { toasts } = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  setAgent(list[0]!, MAIN, t0, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r1', held: t0 + 9000 })
  setAgent(list[1]!, MAIN, t0, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm lint', req: 'r2', held: t0 + 9000 })
  list[0]!.at = list[1]!.at = t0 + 1
  await clock.advance(3100)
  expect(toasts).toEqual(['2 piden permiso · recházalos aquí o apruébalos en el chat']) // one toast, and no "Te espera" for either
  setAgent(list[0]!, MAIN, t0, { req: 'r3', held: t0 + 3000 }) // a new request, read after its hold ended
  list[0]!.at = t0 + 2
  await clock.advance(2100)
  expect(toasts).toEqual(['2 piden permiso · recházalos aquí o apruébalos en el chat'])
  setAgent(list[1]!, MAIN, t0, { state: 'trabajando', activity: 'Bash', cmd: null, req: null })
  list[1]!.at = t0 + 3
  await clock.advance(3100)
  setAgent(list[1]!, MAIN, t0, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm lint', req: 'r4', held: t0 + 3000 }) // starts waiting, its hold already over
  list[1]!.at = t0 + 4
  await clock.advance(3100)
  expect(toasts.slice(1)).toEqual([expect.stringMatching(/^Te espera \S+ · blog$/)]) // no seconds to offer, but someone waits
  await ui.unmount()
})

test('AE2: a request from an older mod, with no hold end, toasts the usual 8 s (HOLD_SAY)', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now(), list = beats(t0)
  setAgent(list[0]!, MAIN, t0, { state: 'trabajando', activity: 'Bash', cmd: null })
  const { toasts } = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  setAgent(list[0]!, MAIN, t0, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test', req: 'r1' })
  list[0]!.at = t0 + 1
  await clock.advance(3100)
  expect(toasts).toEqual([expect.stringMatching(/^\S+ · tienda pide permiso: recházalo aquí en 8 s o apruébalo en el chat$/)])
  expect((await btn(ui, 'q-ok-r1'))?.text).toBe('▸ Aprobar en el chat (A)') // no hold end: no countdown
  await ui.unmount()
})

test('AE2: past the hold, a session nobody started names its own chat; in English', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), t0 = clock.now(), list = beats(t0)
  list[0]!.local = LOCAL_ID
  setAgent(list[0]!, MAIN, t0, { req: 'r1', held: t0 - 1 })
  const { store, ran, files } = serveBeats(on, list)
  store.lang = 'en'
  await $.command.run(OPEN)
  const ui = await mountPane($)
  expect((await textsAll(ui, "The time to answer here ran out. Answer it in the app's chat tienda, where the request shows.")).length).toBe(1)
  expect(await btn(ui, 'q-ok-r1')).toBeUndefined()
  await ui.press({ key: 'open-chat' })
  expect(ran.filter(a => a[0] === '/usr/bin/open')).toEqual([['/usr/bin/open', expect.stringContaining(UUID)]]) // its own chat
  expect(ordersIn(files)).toEqual([])
  await ui.unmount()
})

test('AE2: queued bubbles take chat rows; one goes once a row of yours newer than its send shows, else after the TTL', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), now = clock.now(), list = held(now)
  list[0]!.chat = ['m1', 'm2', 'm3', 'm4'].map(text => ({ who: 'tú' as const, text }))
  serveBeats(on, list)
  await startSession($)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const count = async () => [(await textsAll(ui, /^Tú: $/)).length, (await textsAll(ui, /^Tú \(en cola\): $/)).length]
  expect(await count()).toEqual([4, 0])
  await ui.post({ send: 'm1' }, { in: 'field-s1' }) // the same words as an older row
  await clock.settle()
  await ui.post({ send: 'otra' }, { in: 'field-s1' })
  await clock.settle()
  expect(await count()).toEqual([2, 2]) // still four rows in all
  // the session took m1 while its older m1 left the kept rows: no more m1 rows than at the send, but a newer one
  list[0]!.chat = [...list[0]!.chat!.slice(1), { who: 'tú', text: 'm1', at: clock.now() + 1 }]
  list[0]!.at = now + 1
  await clock.advance(3100)
  expect(await count()).toEqual([3, 1])
  await clock.advance(10 * 60 * 1000) // "otra" was never taken: it goes after the TTL
  await ui.press({ key: 'pick-s1' })
  expect(await count()).toEqual([4, 0])
  await ui.unmount()
})

test('AE2: with queued bubbles filling every chat row, Anteriores still steps back into the history', async ($, on) => {
  const clock = mock.clock(on, { now: 100000 }), list = held(clock.now())
  list[0]!.chat = ['m1', 'm2', 'm3', 'm4'].map(text => ({ who: 'tú' as const, text }))
  serveBeats(on, list)
  await startSession($)
  await $.command.run({ ...OPEN, args: 'ligero' }) // light: two chat rows
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  const count = async () => [(await textsAll(ui, /^Tú: $/)).length, (await textsAll(ui, /^Tú \(en cola\): $/)).length]
  expect(await count()).toEqual([2, 0])
  await ui.post({ send: 'uno' }, { in: 'field-s1' })
  await clock.settle()
  await ui.post({ send: 'dos' }, { in: 'field-s1' })
  await clock.settle()
  expect(await count()).toEqual([0, 2]) // the two rows are the queued ones
  await ui.press({ key: 'older' })
  expect(await count()).toEqual([2, 0]) // a step back: the history, not the same drawing
  expect(await btn(ui, 'newer')).toBeDefined()
  await ui.unmount()
})

// ---- AM: the field's key probe, and messages for a subagent shown where they go ----

test('AM: calibrar clics toasts each key the field reports, name and modifiers only; a bad probe or the probe off says nothing', async ($, on) => {
  const { ui, toasts, clock } = await relaySetup($, on)
  await ui.press({ key: 'pick-s1' })
  await ui.post({ draft: 'ho', probe: ['left', ['meta']] }, { in: 'field-s1' })
  expect(toasts.filter(x => x.startsWith('Tecla'))).toEqual([]) // off: no probe toast
  await $.command.run({ ...OPEN, args: 'calibrar clics' })
  await clock.advance(1500)
  await ui.post({ draft: 'ho', probe: ['left', ['meta']] }, { in: 'field-s1' })
  await ui.post({ draft: 'hol', probe: ['', []] }, { in: 'field-s1' })
  await ui.post({ draft: 'hol', probe: ['backspace', ['ctrl', 'shift']] }, { in: 'field-s1' })
  await ui.post({ draft: 'hol', probe: ['∫', ['meta']] }, { in: 'field-s1' })
  for (const bad of [['<b>x</b>', []], ['left', ['alt']], ['left', 'meta'], 'left', ['x'.repeat(21), []], ['\n', []], ['\u0007', ['meta']]]) await ui.post({ draft: 'hol', probe: bad }, { in: 'field-s1' })
  expect(toasts.filter(x => x.startsWith('Tecla'))).toEqual(['Tecla: left · meta', 'Tecla: texto', 'Tecla: backspace · ctrl · shift', 'Tecla: ∫ · meta'])
  await $.command.run({ ...OPEN, args: 'calibrar clics' }) // off again
  await ui.post({ draft: 'hol', probe: ['right', []] }, { in: 'field-s1' })
  expect(toasts.filter(x => x.startsWith('Tecla')).length).toBe(4)
  await ui.unmount()
})

test('AM: a message for a subagent shows in its conversation at once as on its way, and goes once it writes a newer row', async ($, on) => {
  let beatList: Beat[] = []
  const { ui, clock, files } = await relaySetup($, on, l => (beatList = l))
  const rev = agentName('s1-rev'), onWay = async () => (await textsAll(ui, new RegExp(`^Tú → ${rev} \\(en camino\\): $`))).length
  await ui.press({ key: 'pick-s1-rev' })
  expect(await onWay()).toBe(0)
  await ui.post({ send: 'revisa **el** carrito' }, { in: 'field-s1' })
  await clock.settle()
  expect(await onWay()).toBe(1)
  expect((await textsAll(ui, /revisa \*\*el\*\* carrito/)).length).toBeGreaterThan(0) // as typed, never Markdown
  expect(textsIn(files)).toEqual([`Para ${rev} (subagente gp-reviewer, id ag1): revisa **el** carrito`]) // the text sent is unchanged
  beatList[0]!.at = clock.now() + 1 // a heartbeat with the same words keeps it
  await clock.advance(3100)
  expect(await onWay()).toBe(1)
  beatList[0]!.agents.ag1!.said = addSaid(undefined, 'Ya lo miro')
  beatList[0]!.at = clock.now() + 2
  await clock.advance(3100)
  expect(await onWay()).toBe(0)
  expect((await textsAll(ui, new RegExp(`^${rev}: $`))).length).toBe(1)
  await ui.press({ key: 'pick-s1' }) // the Jefe's conversation never shows it on its way
  expect(await onWay()).toBe(0)
  // the Jefe is busy: there it is queued, named for whom (AM2)
  expect([(await textsAll(ui, new RegExp(`^Tú → ${rev} \\(en cola\\): $`))).length, (await textsAll(ui, /^Tú \(en cola\): $/)).length]).toEqual([1, 0])
  await ui.unmount()
})

test('AM2: Enviar for a subagent shows it on its way too; it goes when its state changes after the send, words the same, or after 10 minutes', async ($, on) => {
  let beatList: Beat[] = []
  const { ui, clock, toasts } = await relaySetup($, on, l => (beatList = l))
  const rev = agentName('s1-rev'), onWay = async () => (await textsAll(ui, new RegExp(`^Tú → ${rev} \\(en camino\\): $`))).length
  await ui.press({ key: 'pick-s1-rev' })
  await ui.post({ draft: 'mira el total' }, { in: 'field-s1' })
  await ui.press({ key: 'send' }) // the Enviar button
  await until(clock, () => toasts.length > 0, 200, 50)
  expect(await onWay()).toBe(1)
  // the subagent starts working on it: its words are as they were, but its state is newer than the send
  beatList[0]!.agents.ag1!.state = 'trabajando'
  beatList[0]!.agents.ag1!.since = clock.now() + 1
  beatList[0]!.at = clock.now() + 1
  await clock.advance(3100)
  expect(await onWay()).toBe(0)
  await ui.post({ send: 'y el envío' }, { in: 'field-s1' })
  await clock.settle()
  expect(await onWay()).toBe(1)
  for (let i = 0; i < 20; i++) { beatList[0]!.at = clock.now() + 1; await clock.advance(30_000) } // 10 minutes, the session alive, the subagent silent
  await ui.press({ key: 'pick-s1-rev' })
  expect(await onWay()).toBe(0)
  await ui.unmount()
})

test('AM: the marker row reads "Tú → <name>: <text>" in the Jefe\'s chat, as text; a look-alike row stays raw', async ($, on) => {
  const rev = agentName('s1-rev')
  // The office's subagent is s1-rev, id ag1: only a marker naming both reads as "Tú → <name>" (ES or EN).
  const other = ['Ana', 'Leo'].find(n => n !== rev)!
  const rows = [`Para ${rev} (subagente gp-reviewer, id ag1): mira **esto**`, `To ${rev} (subagent x, id ag1): in English`, `Para ${rev} (subagente x, id zz9): otro id`, `Para ${other} (subagente x, id ag1): otro nombre`, `Para Juan (subagente x, id y): hola`, `Para ${rev} (subagente x y, id z): hola`, `Re: Para ${rev} (subagente x, id y): hola`]
  const { ui } = await relaySetup($, on, l => { l[0]!.chat = rows.map(text => ({ who: 'tú' as const, text })).slice(0, 4); return l }) // the chat's 4 rows
  await ui.press({ key: 'pick-s1' })
  expect([(await textsAll(ui, new RegExp(`^Tú → ${rev}: $`))).length, (await textsAll(ui, /^Tú → \S+: $/)).length, (await textsAll(ui, /^Tú: $/)).length]).toEqual([2, 2, 2])
  expect((await textsAll(ui, new RegExp(`^Tú → ${rev}: in English$`))).length).toBe(1) // the EN marker drawn as its text
  expect((await textsAll(ui, /mira \*\*esto\*\*/)).length).toBeGreaterThan(0) // never read as Markdown
  expect((await textsAll(ui, /\(subagente x, id zz9\): otro id/)).length).toBeGreaterThan(0) // another id: raw
  expect((await textsAll(ui, new RegExp(`Para ${other} \\(subagente x, id ag1\\): otro nombre`))).length).toBeGreaterThan(0) // another name: raw
  expect(relayOf(rows[0]!)).toEqual({ name: rev, id: 'ag1', text: 'mira **esto**' })
  expect(relayOf(rows[1]!)).toEqual({ name: rev, id: 'ag1', text: 'in English' })
  expect(relayOf(`Para ${rev} (subagente x, id y): línea\n[Image: source: /a.png]`)).toEqual({ name: rev, id: 'y', text: 'línea\n[Image: source: /a.png]' })
  for (const raw of rows.slice(4).concat([`Para ${rev} (subagente x, id y):hola`, `Para ${rev} (subagente <b>, id y): hola`, `Para ${rev} (subagente x, id ${'a'.repeat(81)}): hola`, `Para ${rev} (subagent x, id y): mezcla`, ` Para ${rev} (subagente x, id y): hola`])) expect([raw, relayOf(raw)]).toEqual([raw, null])
  await ui.unmount()
})

test('AM2: a relayed row draws a blank line as nothing, and every face of yours says "Cara de Tú"', async ($, on) => {
  const rev = agentName('s1-rev')
  const { ui } = await relaySetup($, on, l => { l[0]!.chat = [{ who: 'tú' as const, text: `Para ${rev} (subagente gp-reviewer, id ag1): uno\n\ndos` }]; return l })
  await ui.press({ key: 'pick-s1' })
  expect([(await textsAll(ui, new RegExp(`^Tú → ${rev}: uno$`))).length, (await textsAll(ui, /^dos$/)).length]).toEqual([1, 1])
  // the blank line: one empty paragraph whose only child is its (empty) list mark, no empty run after it
  expect((await ui.findAll({ type: 'Text' })).filter(x => x.text === '').map(x => x.children)).toEqual([['']])
  const alts = async () => (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.alt)).filter(a => a.startsWith('Cara de Tú'))
  const jefe0 = (await alts()).length
  await ui.post({ send: 'otra cosa' }, { in: 'field-s1' }) // the busy Jefe: "Tú (en cola)"
  await ui.press({ key: 'pick-s1-rev' })
  const sub0 = (await alts()).length
  await ui.post({ send: 'para ti' }, { in: 'field-s1' }) // "Tú → <name> (en camino)"
  expect(await alts()).toEqual(Array(sub0 + 1).fill('Cara de Tú'))
  await ui.press({ key: 'pick-s1' }) // "Tú (en cola)" and "Tú → <name> (en cola)" more
  expect(await alts()).toEqual(Array(jefe0 + 2).fill('Cara de Tú'))
  await ui.unmount()
})

test('AM2: the key probe toasts after the send it came with is handled', async ($, on) => {
  const { ui, files, toasts, clock } = await relaySetup($, on)
  await ui.press({ key: 'pick-s1' })
  await $.command.run({ ...OPEN, args: 'calibrar clics' })
  await clock.advance(1500)
  await ui.post({ send: 'hola', probe: ['return', []] }, { in: 'field-s1' })
  await until(clock, () => toasts.some(x => x.startsWith('Tecla')))
  const sent = toasts.findIndex(x => x.startsWith('Enviado a')), key = toasts.indexOf('Tecla: return')
  expect([sent >= 0, key > sent]).toEqual([true, true])
  expect(textsIn(files)).toEqual(['hola'])
  await ui.unmount()
})
