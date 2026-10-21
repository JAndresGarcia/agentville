import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

import { MAIN, newBeat, setAgent } from '../hooks/beat'
import type { Beat } from '../hooks/beat'
import { CLIENT_MAX, LIST_MAX, MAP_MAX_PX, PAGE_CHARS, PAGE_DEPTH, PAGE_NODES, pageFits, pageOf } from '../hooks/register'
import { SPRITE_ROWS, agentsLayer, floorView, furnitureLayer, houseLayer, mapStrip, poly, rowsToPaths, selectionLayer, svgUse, worldFromBeats } from '../hooks/scene'
import { getLang, setLang } from '../hooks/i18n'
import { FREEZE2 } from './freeze2.fixture'
import { pageGate, pageMetrics } from './pagerule'

// The desktop page refuses a pane's whole tree past nodes 2000, depth 32 or 262,144 characters, and keeps the old
// picture: the pane freezes (mod-clicks 4c). Every tree these scenarios draw must pass the page's own rule.
const HOME = '/home/test/.claude/agentville'
// `image`: a regular image file on disk, and sips answers as macOS does (every image 10 x 150 px: two zoom strips).
function serve(on: On, list: Beat[], owner = 's-test', image?: string) {
  on('session.cwd', () => ({ value: '/home/test/proj' }))
  on('session.surfaces', () => ({ value: [] }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  const panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  on('ui.open', ($, e) => { if (!panes.some(x => x.id === e.id)) panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [...panes] }))
  on('ui.toast', () => ({ value: undefined }))
  const ran: (readonly string[])[] = []
  on('process.run', ($, e) => {
    ran.push(e.argv)
    const sips = image && e.argv[0] === '/usr/bin/sips' ? { exitCode: 0, stdout: e.argv.includes('-g') ? '  pixelWidth: 10\n  pixelHeight: 150\n' : '' } : null
    return { value: { exitCode: 1, stdout: '', stderr: '', ...sips, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.stat', ($, e) => { if (String(e.path) !== image) throw new Error(`ENOENT: ${e.path}`); return { value: { kind: 'file' as const, size: 1000, mtimeMs: 0, isLink: false } } })
  on('env.get', () => ({ value: '/home/test' }))
  const store: Record<string, unknown> = { 'intro-done': true, 'render-log': true, lang: 'en', palette: 'lobby' }
  on('session.id', () => ({ value: owner }))
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  on('fs.list', () => ({ value: list.map(b => ({ name: `${b.id}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  const files: Record<string, string> = {}
  on('fs.write', ($, e) => { files[String(e.path)] = String(e.text); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  on('fs.read', ($, e) => (e.as === 'bytes' ? { value: { base64: 'QUJD' } } : { value: files[String(e.path)] ?? JSON.stringify(list.find(b => String(e.path).endsWith(`/sessions/${b.id}.json`))) ?? '' }))
  return Object.assign(files, { ran })
}
type Logged = { chars: number; nodes: number; depth: number; noMap?: boolean; noPeople?: boolean; tooHeavy?: boolean; shed?: string[]; mode?: number; elements?: number }
const lastLog = (files: Record<string, string>) => (JSON.parse(files[`${HOME}/render-log.json`]!) as Logged[]).at(-1)!
const office = (id: string, at: number, parent?: string) => {
  const b = newBeat(id, `Office ${id} with a long name`, at)
  setAgent(b, MAIN, at, { state: 'trabajando', activity: 'Edit x.ts' })
  ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `${id}-${r}`, at, { role: r, state: 'trabajando', activity: 'Read y.ts' }))
  if (parent) b.parent = parent
  return b
}
const open = async ($: Engine, columns = 110) => {
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns } })
  return $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: { title: 'Agentville', isFocused: false, bodyColumns: columns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} } })
}
// The drawn tree passes the page's rule, and the pane's own count (pageOf, logged) is under it by at most the margin
// the pane keeps for what only the wire adds.
async function passes(ui: Mounted<'desktop', 'Pane'>, files: Record<string, string>, what: string) {
  const tree = await ui.drawn(), real = pageMetrics(tree), own = lastLog(files)
  expect([what, pageGate(tree), own.chars <= PAGE_CHARS, own.nodes <= PAGE_NODES, own.depth <= PAGE_DEPTH]).toEqual([what, true, true, true, true])
  expect([what, real.chars - own.chars >= 0, real.chars - own.chars < 262144 - PAGE_CHARS]).toEqual([what, true, true])
}

test('pageOf counts what the page counts: Svg source and alt, a Client key, module and props JSON, prop keys and string values, text', () => {
  const tree = {
    type: 'Box', props: { flexDirection: 'row', gap: 1 }, children: [
      { type: 'Text', props: { color: '#fff' }, children: ['hello', ['you', false]] },
      { type: 'Svg', props: { source: '<svg/>', alt: 'a map', width: 300 } },
      { type: 'Client', props: { key: 'hits-1', module: 'hooks/bandhits.tsx', props: { b: 1 } }, client: { plugin: '' } },
    ],
  }
  // Box: flexDirection, row, gap; Text: color, #fff, hello, you; Svg: source and alt; Client: key, module, {"b":1}
  const chars = 13 + 3 + 3 + 5 + 4 + 5 + 3 + 6 + 5 + 6 + 18 + 7
  expect(pageOf(tree)).toEqual({ nodes: 7, depth: 3, chars }) // the false child is a node, as the page's fragment
  // the page's own count of the same tree as the wire carries it (children flat)
  const wire = { ...tree, children: [{ ...tree.children[0]!, children: ['hello', 'you', false] }, tree.children[1], tree.children[2]] }
  expect(pageMetrics(wire)).toEqual(pageOf(tree))
  expect([pageFits({ nodes: 1, depth: 1, chars: PAGE_CHARS }), pageFits({ nodes: 1, depth: 1, chars: PAGE_CHARS + 1 }), pageFits({ nodes: PAGE_NODES + 1, depth: 1, chars: 0 }), pageFits({ nodes: 1, depth: PAGE_DEPTH + 1, chars: 0 })]).toEqual([true, false, false, false])
})

test('every tree passes the page rule: 16 offices, 3 children arriving unlinked then linked, images in chat', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  const files = serve(on, list)
  const ui = await open($)
  await passes(ui, files, '16 offices')
  for (const id of ['c0', 'c7', 'c15']) { await ui.press({ key: `pick-${id}` }); await passes(ui, files, `16 offices, ${id} picked`) }
  // a parent with a light floor; its 3 children arrive one by one, unlinked (their link comes late), then linked
  list.splice(0, list.length, office('p', now), office('s1', now - 1), office('s2', now - 2))
  for (const k of ['k0', 'k1', 'k2']) {
    list.push(office(k, clock.now()))
    await clock.advance(3000)
    await ui.redraw()
    await passes(ui, files, `${k} arrived unlinked`)
  }
  for (const b of list.filter(x => x.id.startsWith('k'))) { b.parent = 'p'; b.at = clock.now() }
  await clock.advance(3000)
  await ui.redraw()
  await passes(ui, files, 'children linked')
  // images in the selected session's chat: each thumbnail a jpeg drawn in its own Svg
  const jpeg = 'A'.repeat(24000)
  list[0]!.chat = [0, 1, 2, 3].map(m => ({ who: 'tú' as const, text: `look ${m}`, pics: [0, 1, 2].map(i => ({ file: `m${m}p${i}`, w: 300, h: 200 })) }))
  list[0]!.at = clock.now()
  for (let m = 0; m < 4; m++) for (let i = 0; i < 3; i++) files[`${HOME}/images/m${m}p${i}.txt`] = jpeg
  await clock.advance(3000)
  await ui.press({ key: 'pick-p' })
  await passes(ui, files, 'images in chat')
  await ui.unmount()
})

// AB2: with the list's click layer on (the default since AH), a full page of LIST_MAX rows over 40 busy offices,
// its next page and a selection draw trees the page accepts.
test('the click-layer list: a full LIST_MAX page, the next page and a selection pass the page rule, every row with its ↗', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const files = serve(on, Array.from({ length: 40 }, (_, i) => ({ ...office(`c${i}`, now - i), local: `local_0a1b2c3d-4e5f-4a6b-8c7d-${String(i).padStart(12, '0')}` })))
  await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 110 } })
  const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: { title: 'Agentville', isFocused: false, bodyColumns: 110, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const rows = async () => ((await ui.find({ type: 'Client', key: 'btns-pick' }))?.props.props as { items: { key: string }[] } | undefined)?.items.filter(it => it.key.startsWith('pick-')).length
  expect(await rows()).toBeGreaterThanOrEqual(LIST_MAX)
  expect(((await ui.find({ type: 'Client', key: 'btns-pick' }))?.props.props as { items: { key: string; chat?: string }[] }).items.filter(it => it.chat).length).toBeGreaterThanOrEqual(LIST_MAX)
  await passes(ui, files, 'a full page')
  await ui.press({ key: 'list-more' })
  await passes(ui, files, 'the next page')
  await ui.press({ key: 'pick-c39' })
  await passes(ui, files, 'c39 picked')
  await ui.unmount()
})

// The freeze2 load (fixture): the pane froze live with these 8 sessions, a parent and its 6 children, at 110 to 180
// columns. Each arrival order and link state the harness replayed draws a tree the page accepts.
const OWNER = FREEZE2.find(b => !b.parent && FREEZE2.some(c => c.parent === b.id))!.id
const KIDS = FREEZE2.filter(b => b.parent === OWNER).map(b => b.id)
const NEWER = [...KIDS].sort((a, b) => FREEZE2.find(x => x.id === b)!.at - FREEZE2.find(x => x.id === a)!.at).slice(0, 3) // the 3 that arrived last
const unlink = (b: Beat[], ids: string[]) => b.map(x => (ids.includes(x.id) ? { ...x, parent: undefined, local: undefined } : x))
const without = (b: Beat[], ids: string[]) => b.filter(x => !ids.includes(x.id))
// The owner's live load (2026-10-19): each child office a team of 6 at work, the team flow's subagents.
const CREW = [['builder', 'impl'], ['code-reviewer', 'rev'], ['security-reviewer', 'qa'], ['ux-reviewer', 'rev'], ['ui-reviewer', 'rev'], ['approver', 'qa']] as const
const crewed = (b: Beat): Beat => {
  if (!KIDS.includes(b.id)) return b
  const c = JSON.parse(JSON.stringify(b)) as Beat
  CREW.forEach(([kind, role], i) => setAgent(c, `w${i}`, c.at, { role, kind: `agentville:${kind}`, goal: 'A: Raster people', state: 'trabajando', activity: 'Read y.ts' }))
  return c
}
// A team member's role tag in either language (tag.* in i18n.ts).
const ROLE_TAGS = /translate\(0 [-\d.]+\)"><rect[^>]*\/><text[^>]*>(Build|Impl|Code|Código|Sec|Seg|UX|UI|Judge|Juez|Spec)</
test('ROLE_TAGS finds the role tags the map draws over its people, in English and Spanish, and none without them', () => {
  const now = 1_000_000, b = newBeat('t', 'Team office', now)
  setAgent(b, MAIN, now, { state: 'trabajando', activity: 'x' })
  CREW.forEach(([kind, role], i) => setAgent(b, `w${i}`, now, { role, kind: `agentville:${kind}`, goal: 'A: Raster people', state: 'trabajando', activity: 'y' }))
  const v = floorView(worldFromBeats(null, [b], now), 0)
  const was = getLang()
  try {
    for (const lang of ['en', 'es']) {
      setLang(lang)
      expect([lang, ROLE_TAGS.test(selectionLayer(v, now, '', 'tag')), ROLE_TAGS.test(selectionLayer(v, now, '', 'tag', false))]).toEqual([lang, true, false])
    }
  } finally { setLang(was) }
})
const SCN: [string, (b: Beat[]) => Beat[]][] = [
  ['linked-all', b => b],
  ['unlinked-all', b => unlink(b, KIDS)],
  ['old3-linked-new3-absent', b => without(b, NEWER)],
  ['old3-linked-new3-unlinked', b => unlink(b, NEWER)],
  ['order-C-B-A-unlinked', b => unlink([...b].reverse(), KIDS)],
  ...[1, 2].flatMap((k): [string, (b: Beat[]) => Beat[]][] => [
    [`arrival-${k}-new-unlinked`, b => unlink(without(b, NEWER.slice(k)), NEWER)],
    [`arrival-${k}-new-linked`, b => without(b, NEWER.slice(k))],
  ]),
]
for (const [name, make] of SCN) for (const columns of [110, 144, 180]) {
  test(`freeze2 replay ${name} @${columns}: the tree passes the page rule`, async ($, on) => {
    mock.clock(on, { now: 1792462700000 })
    const files = serve(on, make(FREEZE2.map(b => ({ ...b }))).map((b, i) => ({ ...b, slot: b.slot ?? i })), OWNER)
    const ui = await open($, columns)
    await passes(ui, files, `${name} @${columns}`)
    await ui.unmount()
  })
}

// ---- the lighter map (V part B): the same shapes in fewer characters ----
// Path data as the scene writes it (M/m, l, h, v, z, implicit repeats), walked to the corners it visits per subpath.
function subpaths(d: string): [number, number][][] {
  const toks = d.match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)/g)!, out: [number, number][][] = []
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0
  const num = () => Number(toks[i++])
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) cmd = toks[i++]!
    if (cmd === 'M' || cmd === 'm') { x = (cmd === 'm' ? x : 0) + num(); y = (cmd === 'm' ? y : 0) + num(); sx = x; sy = y; out.push([[x, y]]); cmd = cmd === 'm' ? 'l' : 'L' }
    else if (cmd === 'l' || cmd === 'L') { x = (cmd === 'l' ? x : 0) + num(); y = (cmd === 'l' ? y : 0) + num(); out.at(-1)!.push([x, y]) }
    else if (cmd === 'h') { x += num(); out.at(-1)!.push([x, y]) }
    else if (cmd === 'v') { y += num(); out.at(-1)!.push([x, y]) }
    else if (cmd === 'z' || cmd === 'Z') { x = sx; y = sy }
  }
  return out.map(q => q.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10] as [number, number]))
}
test('sprites: every run of every colour is one rectangle a pixel tall, at its place, each drawn once', () => {
  const col = Object.fromEntries([...new Set(SPRITE_ROWS.join(''))].filter(c => c !== '.').map((c, i) => [c, `#${(i + 1).toString(16).padStart(6, '0')}`]))
  const svg = rowsToPaths(SPRITE_ROWS, -40, col)
  for (const [ch, fill] of Object.entries(col)) {
    const want: string[] = []
    SPRITE_ROWS.forEach((row, i) => [...row].forEach((c, x) => { if (c === ch) want.push(`${x - 10},${i - 40}`) }))
    const d = new RegExp(`<path fill="${fill}" d="([^"]+)"/>`).exec(svg)![1]!
    const got = subpaths(d).flatMap(q => {
      const xs = q.map(p => p[0]), ys = q.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys)
      expect([ch, q.length, Math.max(...ys) - y0]).toEqual([ch, 4, 1]) // a rectangle (closed by the fill) one pixel tall
      return Array.from({ length: Math.max(...xs) - x0 }, (_, k) => `${x0 + k},${y0}`)
    })
    expect([ch, got.sort()]).toEqual([ch, want.sort()])
  }
})

test('box faces: a path through the same rounded corners a polygon listed', () => {
  const P = (x: number, y: number, z = 0) => [(x - y) * 16, ((x + y) * 16) / 2 - z * 16]
  const corners = [[3.05, 4.4, 0.75], [5.95, 4.4, 0.75], [5.95, 5.1, 1.62], [3.05, 5.1, 1.62]]
  const d = /d="([^"]+)"/.exec(poly(corners, '#123456'))![1]!
  expect(subpaths(d)).toEqual([corners.map(([x, y, z]) => P(x!, y!, z).map(v => Math.round(v * 10) / 10) as [number, number])])
  expect(d).not.toMatch(/(^|[^\d])0\./) // no leading zeros
})

test('the map layers of a full floor weigh about a fifth less than before (493,212 characters on 2026-10-19)', () => {
  const now = 1_000_000, v = floorView(worldFromBeats(null, Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i)), now), 0)
  const total = [houseLayer(v.rows), ...furnitureLayer(v, now), ...agentsLayer(v, now)].join('').length
  expect(total).toBeLessThan(415000)
})

test('the lighter map: 6 linked offices keep their map with its people and every click zone', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const files = serve(on, [office('p', now), ...Array.from({ length: 6 }, (_, i) => office(`k${i}`, now - i - 1, 'p'))])
  const ui = await open($)
  const last = JSON.parse(files[`${HOME}/render-log.json`]!).at(-1)
  expect([last.noMap, last.noPeople, last.viewOnly, last.mode]).toEqual([false, false, false, 0])
  await passes(ui, files, '6 linked')
  await ui.unmount()
})
test('the lighter map: the freeze2 load at 110 columns keeps its map with its people and every click zone', async ($, on) => {
  mock.clock(on, { now: 1792462700000 })
  const files = serve(on, FREEZE2.map((b, i) => ({ ...b, slot: b.slot ?? i })), OWNER)
  const ui = await open($)
  const last = JSON.parse(files[`${HOME}/render-log.json`]!).at(-1)
  expect([last.noMap, last.noPeople, last.viewOnly, last.mode]).toEqual([false, false, false, 0])
  await ui.unmount()
})

// ---- the steps come back when what pushed them off is gone (fix round 1) ----
const logOf = (files: Record<string, string>) => JSON.parse(files[`${HOME}/render-log.json`]!) as (Logged & { viewOnly?: boolean; mode?: number })[]
test('images in a chat push the map\'s detail off; selecting an office without images brings it back in one render', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const list = Array.from({ length: 12 }, (_, i) => office(`c${i}`, now - i)) // 12 offices: all their detail fits without the pictures
  list[0]!.chat = [0, 1].map(m => ({ who: 'tú' as const, text: `look ${m}`, pics: [0, 1].map(i => ({ file: `m${m}p${i}`, w: 300, h: 200 })) }))
  const files = serve(on, list)
  for (let m = 0; m < 2; m++) for (let i = 0; i < 2; i++) files[`${HOME}/images/m${m}p${i}.txt`] = 'A'.repeat(14000)
  const ui = await open($)
  await ui.press({ key: 'pick-c1' })
  expect([logOf(files).at(-1)!.shed, logOf(files).at(-1)!.noMap]).toEqual([[], false]) // no images: the whole map
  await ui.press({ key: 'pick-c0' })
  const heavy = logOf(files).at(-1)!
  expect(heavy.shed!.length > 0 || heavy.noMap).toBe(true) // the pictures push the map's detail off
  await passes(ui, files, 'images')
  const before = logOf(files).length
  await ui.press({ key: 'pick-c1' })
  const after = logOf(files).slice(before), last = after.at(-1)!
  expect([last.shed, last.noMap, last.viewOnly, last.mode! >= 0]).toEqual([[], false, false, true])
  expect((await ui.findAll({ type: 'Svg' })).some(x => /agents on this floor/.test(String(x.props.alt)))).toBe(true)
  await ui.unmount()
})

test('a burst of unlinked children keeps the people (AV: shared shapes); once linked they stay, every tree under the rule', async ($, on) => {
  const clock = mock.clock(on, { now: 1792462700000 })
  const list = FREEZE2.map((b, i) => ({ ...crewed(b), slot: b.slot ?? i, ...(KIDS.includes(b.id) ? { parent: undefined, local: undefined } : {}) }))
  const files = serve(on, list, OWNER)
  const ui = await open($)
  expect(logOf(files).at(-1)!.noPeople).toBe(false) // 6 crewed children arriving unlinked, each its own island: their people fit
  await passes(ui, files, 'unlinked')
  for (const b of list) if (KIDS.includes(b.id)) { b.parent = OWNER; b.at = clock.now() }
  await clock.advance(3000)
  const before = logOf(files).length
  await ui.redraw()
  const last = logOf(files).at(-1)!
  expect([last.noPeople, last.noMap]).toEqual([false, false])
  expect(logOf(files).slice(before).filter(x => x.noPeople).length).toBe(0) // no picture without people on the way
  await passes(ui, files, 'linked again')
  await ui.unmount()
})

// 16 offices and 4 pictures of 24,000 characters in the selected chat: past the bubbles and the decor, the people go.
// The chat draws its pictures within a budget (BC), newest first, and the newest always draws: it carries the weight
// of all four (at most 120,000 characters, under the Svg's own limit), the older ones are placeholders.
const pictured = (list: Beat[], files: Record<string, string>, px: number) => {
  list[0]!.chat = [0, 1].map(m => ({ who: 'tú' as const, text: `look ${m}`, pics: [0, 1].map(i => ({ file: `m${m}p${i}`, w: 300, h: 200 })) }))
  for (let m = 0; m < 2; m++) for (let i = 0; i < 2; i++) files[`${HOME}/images/m${m}p${i}.txt`] = 'A'.repeat(m + i === 2 ? Math.min(4 * px, 120000) : px)
}
test('without its people the map draws no selected tile and no person\'s tag', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  const files = serve(on, list)
  pictured(list, files, 24000)
  const ui = await open($)
  await ui.press({ key: 'pick-c0' })
  expect([logOf(files).at(-1)!.noPeople, logOf(files).at(-1)!.noMap]).toEqual([true, false])
  const alts = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.alt))
  expect(alts.some(a => a.startsWith('Selected:'))).toBe(false) // no tile under a person not drawn
  expect(alts).toContain('Office names') // the tag layer stays (its names gone with the decor), no "Role of Office" tag
  expect((await ui.findAll({ type: 'Svg' })).some(x => ROLE_TAGS.test(String(x.props.source)))).toBe(false) // nor a role over an empty desk
  await ui.unmount()
})

test('the people come back in one render when they fit again, with the same offices on the floor (their layer measured afresh)', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 }), now = clock.now()
  const list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  const files = serve(on, list)
  pictured(list, files, 16000)
  const ui = await open($)
  await ui.press({ key: 'pick-c0' })
  expect(logOf(files).at(-1)!.noPeople).toBe(true) // 16 full offices and the pictures: no room for 64 people
  for (const b of list.slice(1, 7)) { for (const k of Object.keys(b.agents)) if (k !== MAIN) delete b.agents[k]; b.at = clock.now() } // 18 subagents leave
  await clock.advance(3000)
  const before = logOf(files).length
  await ui.redraw()
  expect(logOf(files).at(-1)!.noPeople).toBe(false)
  expect(logOf(files).slice(before).filter(x => x.noPeople).length).toBeLessThanOrEqual(1) // at most the pass that measured
  await passes(ui, files, 'people back')
  await ui.unmount()
})

// ---- AV: shared shapes, the ladder that keeps the map, awake sessions first ----
declare const console: { log: (...a: unknown[]) => void } // the runner prints it: the measured numbers in the run's output
// A layer's leaves in drawing order, each <use> replaced by its shape moved by its x and y: tag, fill and the corners
// (paths) or centre (circles, ellipses) it lands on; any other leaf as written.
type Leaf = { tag: string; fill: string; pts: [number, number][]; raw: string }
function leaves(svgs: string[]): Leaf[] {
  return svgs.flatMap(svg => {
    const defs = new Map([...svg.matchAll(/<g id="([^"]+)">(.*?)<\/g>(?=<g id=|<\/defs>)/g)].map(m => [m[1]!, m[2]!]))
    const body = svg.replace(/<defs>.*?<\/defs>/, '').replace(/<use href="#([^"]+)"(?: x="([^"]+)")?(?: y="([^"]+)")?\/>/g, (_, id: string, x = '0', y = '0') => `<shift ${x} ${y}>${defs.get(id)}</shift>`)
    const out: Leaf[] = [], at: [number, number][] = [[0, 0]]
    for (const m of body.matchAll(/<(path|circle|ellipse|rect|text|image|polygon)\b[^>]*>|<shift (\S+) (\S+)>|<\/shift>/g)) {
      if (m[0] === '</shift>') { at.pop(); continue }
      if (m[2] !== undefined) { const [x, y] = at.at(-1)!; at.push([x + Number(m[2]), y + Number(m[3])]); continue }
      const [dx, dy] = at.at(-1)!, a = (k: string) => new RegExp(`\\b${k}="([^"]*)"`).exec(m[0])?.[1]
      const pts: [number, number][] = m[1] === 'path' ? subpaths(a('d')!).flat().map(([x, y]) => [x + dx, y + dy]) : m[1] === 'circle' || m[1] === 'ellipse' ? [[Number(a('cx') ?? 0) + dx, Number(a('cy') ?? 0) + dy]] : []
      out.push({ tag: m[1]!, fill: a('fill') ?? '', pts, raw: pts.length || (!dx && !dy) ? '' : m[0] })
    }
    return out
  })
}
test('AV: a <use> map draws the same elements as the inline one, each corner within the 0.1 px rounding, and weighs less', () => {
  const now = 1_000_000, v = floorView(worldFromBeats(null, Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i)), now), 0)
  const draw = (on: boolean) => { svgUse(on); try { return [furnitureLayer(v, now), agentsLayer(v, now)] } finally { svgUse(true) } }
  const [inline, used] = [draw(false), draw(true)]
  for (const k of [0, 1]) {
    const a = leaves(inline[k]!), b = leaves(used[k]!)
    expect([k, b.length]).toEqual([k, a.length])
    const off = a.flatMap((x, i) => {
      const y = b[i]!
      if (x.tag !== y.tag || x.fill !== y.fill || x.pts.length !== y.pts.length || x.raw !== y.raw) return [`${i} ${x.tag}`]
      return x.pts.some(([px, py], j) => Math.abs(px - y.pts[j]![0]) > 0.11 || Math.abs(py - y.pts[j]![1]) > 0.11) ? [`${i} ${x.tag} moved`] : []
    })
    expect([k, off.slice(0, 5)]).toEqual([k, []])
    expect(used[k]!.join('').length).toBeLessThan(inline[k]!.join('').length)
    for (const s of used[k]!) expect(s.length).toBeLessThanOrEqual(131072) // the per-Svg cap, defs included
  }
  // ids carry their layer's prefix and picture index, so stacked pictures never share one; href, never xlink
  const ids = [...used.flat().join('').matchAll(/<g id="([^"]+)"/g)].map(m => m[1]!)
  expect(ids.length).toBeGreaterThan(0)
  expect(ids.every(id => /^[fa]\d/.test(id))).toBe(true)
  expect(used.flat().join('')).not.toMatch(/xlink/)
  expect(inline.flat().join('')).not.toMatch(/<use|<defs/)
})

test('AV: the house leaves out the tiles under the islands (they draw their own floor), and only those', () => {
  const now = 1_000_000, v = floorView(worldFromBeats(null, Array.from({ length: 8 }, (_, i) => office(`c${i}`, now - i)), now), 0)
  const rooms = v.depts.filter(d => !d.away && d.room.length).map(d => d.room)
  const tiles = (s: string) => [...s.matchAll(/<path fill="[^"]+" stroke="rgba\(0,0,0,\.07\)" stroke-width="\.6" d="([^"]+)"/g)].reduce((n, m) => n + subpaths(m[1]!).length, 0)
  const inIsle = rooms.reduce((n, r) => n + (r[2]! - r[0]!) * (r[3]! - r[1]!), 0)
  expect(tiles(houseLayer(v.rows)) - tiles(houseLayer(v.rows, rooms))).toBe(inIsle)
})

test('AV: awake sessions take the lowest free slots; newer idle heartbeats never push them to floor 2', () => {
  const now = 100_000_000
  const idle = Array.from({ length: 16 }, (_, i) => { const b = newBeat(`i${i}`, `Idle ${i}`, now - 16 * 60000 + i); setAgent(b, MAIN, b.at, { state: 'inactivo', activity: 'x' }); return b })
  const busy = Array.from({ length: 4 }, (_, i) => office(`b${i}`, now - 20 * 60000 - i)) // older beats, but at work
  for (const b of busy) b.at = now - 60000 - Number(b.id.slice(1)) // awake: beat a minute ago, still older than none of the idle ones
  for (const b of idle) b.at = now - 1000 + Number(b.id.slice(1)) * 10 // newest heartbeats
  for (const b of idle) Object.values(b.agents).forEach(a => { a.state = 'inactivo' })
  const w = worldFromBeats(null, [...idle, ...busy], now, Object.fromEntries(idle.map(b => [b.id, b.at]))) // hidden by refresh: idle
  const at = (id: string) => w.depts.find(d => d.id === id)!
  expect(busy.map(b => [b.id, at(b.id).floor ?? 0, at(b.id).slot])).toEqual(busy.map((b, i) => [b.id, 0, i]))
  expect(w.depts.filter(d => d.idle).every(d => (d.floor ?? 0) * 16 + (d.slot ?? 0) >= 4)).toBe(true)
})

// 16 offices and pictures in the selected chat, up to heavy enough to pass even the plain map (the chat's pictures keep
// to their budget since BC, so the heaviest case also draws the map inline, /agentville simple drawing): from the first render
// (each at its own width, so no latch is left from another), every pass sheds a prefix of the ladder, and the map hides
// only after a pass with the plain map did not fit. A step given back that does not fit is taken again.
const LADDER = ['bubbles', 'decor', 'people', 'zones', 'plain', 'map']
for (const [px, cols] of [[16000, 120], [30000, 130], [70000, 140]] as const) test(`AV: the ladder sheds in order and hides the map only past the plain map (pictures of ${px})`, async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  const files = serve(on, list)
  pictured(list, files, px)
  if (px === 70000) await $.command.run({ command: 'agentville', args: 'simple drawing', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: cols } })
  const ui = await open($, cols)
  const opened = logOf(files).at(-1)!
  await ui.press({ key: 'pick-c0' })
  for (const x of [opened, logOf(files).at(-1)!]) expect(x.elements).toBeLessThanOrEqual(1500) // what each render sent
  const run = logOf(files).filter(x => !x.tooHeavy)
  for (const x of run) expect(x.shed).toEqual(LADDER.slice(0, x.shed!.length)) // a prefix of the ladder
  expect(run.every(x => !x.noMap || x.shed!.includes('map'))).toBe(true)
  const hid = run.findIndex(x => x.noMap)
  if (hid >= 0) expect(run.slice(0, hid).some(x => !x.noMap && x.shed!.includes('plain'))).toBe(true)
  for (const x of run.filter(x => !x.noMap && x.shed!.includes('zones'))) expect(x.mode).toBeGreaterThanOrEqual(0) // a zone per office stays
  const ends = { 16000: 'people', 30000: 'plain', 70000: 'map' }[px]
  expect(run.at(-1)!.shed!.at(-1)).toBe(ends)
  console.log(`AV ladder px ${px}: ${run.map(x => `${x.chars}:${x.shed!.at(-1) ?? '-'}${x.noMap ? ':hidden' : ''}`).join(' ')}`)
  await passes(ui, files, `pictures of ${px}`)
  await ui.unmount()
})

// The owner's live case (2026-10-20): 4 offices at work and 7 idle ones only in the list. The idle ones are no offices
// on the map: they never count toward a step, and the map keeps a zone per person.
test('AV: idle offices only in the list do not count toward the ladder; 4 at work and 7 idle keep every click zone', async ($, on) => {
  const now = mock.clock(on, { now: 100_000_000 }).now()
  const idle = Array.from({ length: 7 }, (_, i) => { const b = newBeat(`i${i}`, `Idle ${i}`, now - 20 * 60000 - i); setAgent(b, MAIN, b.at, { state: 'inactivo', activity: 'x' }); return b })
  const files = serve(on, [...Array.from({ length: 4 }, (_, i) => office(`c${i}`, now - i)), ...idle])
  const ui = await open($)
  const last = logOf(files).at(-1)! as Logged & { offices: number; clicks: number }
  expect([last.offices, last.noMap, last.shed, last.mode, last.clicks > 0]).toEqual([4, false, [], 0, true])
  expect(await ui.find({ type: 'Text', text: /demasiadas oficinas|too many offices/ })).toBeUndefined()
  await ui.unmount()
})
test('AV: offices from another floor that come along for a waiting Jefe do not count toward the ladder either', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = Array.from({ length: 18 }, (_, i) => office(`c${i}`, now - i))
  list.forEach((b, i) => { b.slot = i }) // c16 and c17 hold floor 2's first islands
  for (const b of list.slice(16)) setAgent(b, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'ls', req: `r-${b.id}` })
  const files = serve(on, list)
  const ui = await open($)
  expect((await ui.findAll({ type: 'Button' })).length + (await ui.findAll({ type: 'Client' })).length).toBeGreaterThan(0)
  expect((logOf(files).at(-1)! as Logged & { offices: number }).offices).toBe(16) // floor 1 draws 16; the 2 from floor 2 only visit
  await ui.unmount()
})

// The 16-office crowd of the B8 baseline (familyrooms.test.tsx: every fifth Jefe waiting): people and zones under the rule.
test('AV: the 16-office B8 world keeps its people and its click zones under the page rule', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const list = Array.from({ length: 16 }, (_, i) => {
    const b = newBeat(`c${i}`, `Sesión ${i + 1}`, now - i)
    setAgent(b, MAIN, now - i, { state: i % 5 === 4 ? 'esperando' : 'trabajando', activity: 'Edit x.ts' })
    ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `c${i}-${r}`, now - i, { role: r, state: 'trabajando', activity: 'Read y.ts' }))
    return b
  })
  const files = serve(on, list)
  const ui = await open($)
  const last = logOf(files).at(-1)! as Logged & { clicks: number }
  expect([last.noMap, last.noPeople, (last.mode ?? -1) >= 0, last.clicks > 0]).toEqual([false, false, true, true])
  console.log(`AV B8 16 offices: ${last.chars} chars, shed ${(last.shed ?? []).join('+') || 'nothing'}, mode ${last.mode}`)
  await passes(ui, files, 'B8 16')
  await ui.unmount()
})

// The docs mock's density (AV item 5): 6 busy offices, two of them team rooms (3 and 4 members), 25 people, with
// everything drawn and every click zone, well under the page rule.
test('AV: the docs mock density (6 offices, 2 team rooms, 25 people) draws everything with every zone under 200K', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const team = (id: string, crew: [string, string, string][]) => {
    const b = newBeat(id, `Team ${id}`, now)
    setAgent(b, MAIN, now, { state: 'trabajando', activity: 'Edit x.ts' })
    crew.forEach(([kind, role, goal], i) => setAgent(b, `w${i}`, now, { role: role as 'impl', kind: `agentville:${kind}`, goal, state: 'trabajando', activity: 'Read y.ts' }))
    return b
  }
  const list = [
    ...Array.from({ length: 4 }, (_, i) => office(`c${i}`, now - i)),
    team('t0', [['builder', 'impl', 'A: Raster people'], ['code-reviewer', 'rev', 'A: Raster people'], ['approver', 'qa', 'A: Raster people']]),
    team('t1', [['builder', 'impl', 'A: Map symbols'], ['code-reviewer', 'rev', 'A: Map symbols'], ['builder', 'impl', 'B: Docs'], ['ux-reviewer', 'rev', 'B: Docs']]),
  ]
  const files = serve(on, list)
  const ui = await open($)
  const last = logOf(files).at(-1)! as Logged & { clicks: number }
  const svgs = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.source)).join('')
  expect([last.noMap, last.noPeople, last.shed, last.mode, last.clicks > 0]).toEqual([false, false, [], 0, true])
  expect((svgs.match(/<image /g) ?? []).length).toBeGreaterThanOrEqual(25) // everyone drawn (Producto's table adds more)
  expect(ROLE_TAGS.test(svgs)).toBe(true) // the team rooms' labels
  expect(last.chars).toBeLessThanOrEqual(200000)
  console.log(`AV mock density: ${last.chars} chars`)
  await passes(ui, files, 'mock density')
  await ui.unmount()
})

// The owner's goal (2026-10-20): clicks on the map at least 90% of the time. Every world from 1 to 16 offices at work,
// with 0 to 10 idle ones only in the list (every other count) and a busy chat selected: zones in at least 90% of them,
// in all up to 12.
const SWEEP: { n: number; idle: number; zones: boolean }[] = []
const busyChat = (b: Beat) => { b.chat = Array.from({ length: 24 }, (_, m) => ({ who: (m % 2 ? 'claude' : 'tú') as 'claude' | 'tú', text: `${m}: ${'Revisa el mapa y los clics de cada oficina, luego corre las pruebas afectadas. '.repeat(6)}` })) }
for (let n = 1; n <= 16; n++) for (let idle = 0; idle <= 10; idle += 2) test(`AV sweep: ${n} offices at work, ${idle} idle, a busy chat`, async ($, on) => {
  const now = mock.clock(on, { now: 100_000_000 }).now()
  const list = [...Array.from({ length: n }, (_, i) => office(`c${i}`, now - i)), ...Array.from({ length: idle }, (_, i) => { const b = newBeat(`i${i}`, `Idle ${i}`, now - 20 * 60000 - i); setAgent(b, MAIN, b.at, { state: 'inactivo', activity: 'x' }); return b })]
  busyChat(list[0]!)
  const files = serve(on, list)
  const ui = await open($)
  await ui.press({ key: 'pick-c0' })
  const last = logOf(files).at(-1)! as Logged & { clicks: number }
  SWEEP.push({ n, idle, zones: !last.noMap && (last.mode ?? -1) >= 0 && last.clicks > 0 })
  await passes(ui, files, `${n}+${idle}`)
  await ui.unmount()
})
test('AV sweep: zones in at least 90% of the worlds, and in every world up to 12 offices at work', () => {
  expect(SWEEP).toHaveLength(16 * 6)
  const pct = (100 * SWEEP.filter(x => x.zones).length) / SWEEP.length
  console.log(`AV sweep: zones in ${pct.toFixed(1)}% of ${SWEEP.length} worlds; without: ${SWEEP.filter(x => !x.zones).map(x => `${x.n}+${x.idle}`).join(' ') || 'none'}`)
  expect(pct).toBeGreaterThanOrEqual(90)
  expect(SWEEP.filter(x => x.n <= 12 && !x.zones)).toEqual([])
})

test('AV: /agentville dibujo simple (simple drawing) switches the map to inline shapes and back; only the whole words', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  serve(on, Array.from({ length: 3 }, (_, i) => office(`c${i}`, now - i)))
  const run = async (args: string) => (await $.command.run({ command: 'agentville', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 110 } }))?.text
  const uses = async () => { const ui = await open($); const n = (await ui.findAll({ type: 'Svg' })).filter(x => /<use href="#/.test(String(x.props.source))).length; await ui.unmount(); return n }
  expect(await uses()).toBeGreaterThan(0) // on by default
  expect(await run('dibujo simple')).toBe('Map drawing: simple, every chair, desk and plant drawn on its own, as before (it is remembered). Run the command again to go back to normal.')
  expect(await uses()).toBe(0)
  expect(await run('dibujo simple ya')).not.toMatch(/^Map drawing/) // anchored: only the command itself
  expect(await uses()).toBe(0)
  expect(await run('  Simple Drawing ')).toBe('Map drawing: back to normal, repeated shapes drawn once (it is remembered). Run the command again for the simple drawing.')
  expect(await uses()).toBeGreaterThan(0)
})

// AT's click zones stay through the ladder: on the plain map your office's HQ and disk screens are drawn and clicked,
// and the disk card's × closes it.
type Runs = { runs: [number, string | null, string | null][] }
const hitsOf = async (ui: Mounted<'desktop', 'Pane'>) => (await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('hits-'))
const keysOf = async (ui: Mounted<'desktop', 'Pane'>) => (await hitsOf(ui)).flatMap(c => (c.props.props as Runs).runs.map(r => r[1]).filter((k): k is string => !!k))
async function pressMap(ui: Mounted<'desktop', 'Pane'>, key: string) {
  for (const c of await hitsOf(ui)) {
    const b = (await ui.findAll({ type: 'Button', in: c.key! })).find(x => x.key?.startsWith(`${key}@`))
    if (b) return void await ui.press({ key: b.key! })
  }
  throw new Error(`no click zone for ${key}`)
}
test('AV: the plain map keeps the HQ and disk screens with their zones, and the disk card opens and closes by its ×', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  const files = serve(on, list)
  pictured(list, files, 30000)
  const ui = await open($, 150)
  await ui.press({ key: 'pick-c0' })
  const plain = logOf(files).at(-1)!
  expect([plain.noMap, plain.shed!.at(-1)]).toEqual([false, 'plain'])
  const svgs = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.source)).join('')
  expect(svgs).toContain('HQ US$') // the HQ screen is drawn
  expect(await keysOf(ui)).toEqual(expect.arrayContaining(['screen-hq', 'screen-disk']))
  await pressMap(ui, 'screen-disk')
  expect([logOf(files).at(-1)!.noMap, await keysOf(ui)]).toEqual([false, expect.arrayContaining(['card-close'])])
  await pressMap(ui, 'card-close')
  expect(await keysOf(ui)).not.toContain('card-close')
  await passes(ui, files, 'plain map with the disk card')
  await ui.unmount()
})

// The 40 offices of the click-layer list: the map hidden fits, the plain map given back fits the page's characters but
// passes TREE_LIMIT by its elements alone. That giving back ends there (it looped before AV's fix round): the render
// stops, hidden, within a few passes.
test('AV: a step given back that is too heavy by elements only is not given back again in the same render', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now()
  const files = serve(on, Array.from({ length: 40 }, (_, i) => ({ ...office(`c${i}`, now - i), local: `local_0a1b2c3d-4e5f-4a6b-8c7d-${String(i).padStart(12, '0')}` })))
  const ui = await open($)
  const run = logOf(files)
  console.log(`AV elements retry: ${run.map(x => `${x.chars}/${x.elements}:${x.shed?.at(-1) ?? '-'}${x.noMap ? ':hidden' : ''}`).join(' ')}`)
  const back = run.findIndex((x, i) => i > 0 && !x.noMap && run[i - 1]!.noMap) // the map given back
  expect(back).toBeGreaterThan(0)
  expect([run[back]!.chars <= PAGE_CHARS, run[back]!.elements! > 1500]).toEqual([true, true]) // too heavy by elements alone
  expect(run.slice(back + 1).every(x => x.noMap)).toBe(true) // taken again, and not given back again
  expect(run.length).toBeLessThan(12)
  await passes(ui, files, '40 offices')
  await ui.unmount()
})

test('AV: the plain map keeps the notes pin on your desk with its zone', async ($, on) => {
  const now = mock.clock(on, { now: 1_000_000 }).now(), list = Array.from({ length: 16 }, (_, i) => office(`c${i}`, now - i))
  setAgent(list[5]!, MAIN, now, { state: 'esperando', activity: 'Te sugiere sesiones' })
  list[5]!.offers = [{ tu: 'toolu_1', id: 'task_abcd1234', title: 'Probar el mapa simple', brief: 'x', at: now }]
  const files = serve(on, list)
  pictured(list, files, 30000)
  const ui = await open($, 160)
  await ui.press({ key: 'pick-c0' })
  expect([logOf(files).at(-1)!.noMap, logOf(files).at(-1)!.shed!.at(-1)]).toEqual([false, 'plain'])
  const svgs = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.source)).join('')
  expect(svgs).toContain('fill="#e2a94a"') // the notes pin
  expect(await keysOf(ui)).toContain('screen-notes')
  expect(await ui.find({ type: 'Text', text: /^Simple map: floors and desks; offices still take clicks\./ })).toBeDefined()
  await passes(ui, files, 'plain map with notes')
  await ui.unmount()
})

// ---- BC: the owner's live case (2026-10-20), the map fell to "simple" with 8 sessions ----
// 8 offices on the map (3 of them children, 17 people: the subagents that finished long ago left), 2 idle ones only in the list, a suggestion and two permission
// requests (the notes card opens by itself), and 3 screenshots in your chat as the owner's disk had them: thumbnails
// made at 360 px before BC (~94K characters; the pictures here are generated, the sizes are the owner's).
const SHOTS = [[37416, 360, 222], [37528, 360, 254], [19152, 267, 360]] as const
const ownerCase = (now: number) => {
  const tops = ['o0', 'o1', 'o2'].map((k, i) => office(k, now - i)), kids = ['k0', 'k1', 'k2'].map((k, i) => office(k, now - 3 - i, 'o0'))
  tops[1]!.notes = [{ t: 'one note', done: false, doing: true }]
  for (const b of [tops[2]!, ...kids]) for (const k of Object.keys(b.agents)) if (k !== MAIN && !(b !== tops[2] && k.endsWith('-impl'))) delete b.agents[k]
  const waits = ['w0', 'w1'].map((k, i) => { const b = newBeat(k, `Waiting ${k}`, now - 6 - i); setAgent(b, MAIN, b.at, { state: 'esperando', activity: 'Asks for permission', cmd: 'ls', req: `r-${k}` }); return b })
  waits[0]!.offers = [{ tu: 'toolu_1', id: 'task_abcd1234', title: 'Try the simple map', brief: 'x', at: now }]
  const idle = ['i0', 'i1'].map((k, i) => { const b = newBeat(k, `Idle ${k}`, now - 20 * 60000 - i); setAgent(b, MAIN, b.at, { state: 'inactivo', activity: 'x' }); return b })
  tops[0]!.chat = [
    { who: 'claude', text: 'The map is drawn again.' },
    { who: 'tú', text: 'look at these', pics: SHOTS.map(([, w, ht], i) => ({ file: `shot${i}`, w, h: ht, orig: `/home/test/shot${i}.png` })) },
    { who: 'claude', text: 'I see three screenshots.' },
  ]
  return [...tops, ...kids, ...waits, ...idle]
}
type BcLog = Logged & { clients: number; elements: number }
for (const cols of [110, 160, 190, 240]) test(`BC: the owner's case keeps the full map with people and zones at ${cols} columns, within CLIENT_MAX and the page`, async ($, on) => {
  const now = mock.clock(on, { now: 100_000_000 }).now(), files = serve(on, ownerCase(now), 'o0')
  SHOTS.forEach(([n], i) => { files[`${HOME}/images/shot${i}.txt`] = 'A'.repeat(n) })
  const ui = await open($, cols) // your own office is selected; a press on the list would close the notes card
  await ui.redraw()
  const log = logOf(files) as BcLog[], last = log.at(-1)!
  expect(log.filter(x => x.clients > CLIENT_MAX)).toEqual([]) // no render ever went past CLIENT_MAX
  expect([last.noMap, last.noPeople, last.shed, last.mode]).toEqual([false, false, [], 0]) // a click per person
  const alts = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.alt))
  expect(alts).toContain('Notes') // the notes card is open on the map
  // The newest screenshot draws; the two older ones would pass the pictures' budget: placeholders that open them.
  expect([alts.filter(a => a === 'Message image').length, alts.filter(a => a === 'Image · click to open').length]).toEqual([1, 2])
  expect((await ui.findAll({ type: 'Svg' })).find(x => x.props.alt === 'Agentville, floor 1: offices, the common area and your desk')?.props.width).toBe(MAP_MAX_PX)
  if (cols === 160) expect(PAGE_CHARS - last.chars).toBeGreaterThanOrEqual(15000)
  console.log(`BC owner's case @${cols}: ${last.chars} page chars (${PAGE_CHARS - last.chars} headroom), ${last.elements} elements, ${last.clients} Clients, mode ${last.mode}`)
  await passes(ui, files, `owner's case @${cols}`)
  await ui.unmount()
})

test('BC: thumbnails made at 240 px (sips -Z 240) all draw within the pictures\' budget', async ($, on) => {
  const now = mock.clock(on, { now: 100_000_000 }).now(), files = serve(on, ownerCase(now), 'o0')
  SHOTS.forEach(([n], i) => { files[`${HOME}/images/shot${i}.txt`] = 'A'.repeat(Math.round(n * (240 / 360) ** 2)) }) // jpeg size ~ pixels
  const ui = await open($, 160)
  expect((await ui.findAll({ type: 'Svg' })).filter(x => x.props.alt === 'Message image').length).toBe(3)
  const last = lastLog(files) // here only the working bubbles may go (this world is heavier than the owner's)
  expect([last.noMap, last.noPeople, last.mode, (last.shed ?? []).every(x => x === 'bubbles')]).toEqual([false, false, 0, true])
  await passes(ui, files, '240 px thumbnails')
  await ui.unmount()
})

test('BC: a placeholder past the pictures\' budget opens the original image at full size', async ($, on) => {
  const now = mock.clock(on, { now: 100_000_000 }).now(), files = serve(on, ownerCase(now), 'o0', '/home/test/shot0.png')
  SHOTS.forEach(([n], i) => { files[`${HOME}/images/shot${i}.txt`] = 'A'.repeat(n) })
  const ui = await open($, 160)
  const hold = (await ui.findAll({ type: 'Svg' })).filter(x => x.props.alt === 'Image · click to open')
  expect(hold.length).toBe(2)
  expect(hold.every(x => !String(x.props.source).includes('base64'))).toBe(true) // no picture characters in a placeholder
  // in the row's ink: a bubble's dark ink on its light tint, for its text and its outline
  expect(hold.every(x => /<text [^>]*fill="#1d1d1b"/.test(String(x.props.source)) && /<rect [^>]*stroke="#1d1d1b"/.test(String(x.props.source)))).toBe(true)
  const band = (await ui.findAll({ type: 'Client' })).find(c => c.key!.startsWith('btns-pics-') && (c.props.props as { runs: [number, string | null][] }).runs.some(r => r[1] === 'pic-open-shot0'))!
  await ui.post({ press: 'pic-open-shot0' }, { in: band.key! })
  expect(files.ran.some(a => a[0] === '/usr/bin/sips' && a.includes('/home/test/shot0.png'))).toBe(true) // the original, not the thumbnail
  expect((await ui.findAll({ type: 'Svg' })).map(x => x.props.alt)).toContain('Zoomed image, part 2')
  await ui.unmount()
})

test('BC: the strip under the map never says offices take clicks and that there are too many to click together', () => {
  const plain = { plain: true, people: false, decor: false }
  expect(mapStrip(plain, -1, 2)).toBe('Simple map. · There are too many offices to click on the map. Pick from the list. · 2 offices quiet, in the list')
  expect(mapStrip(plain, 2)).toBe('Simple map: floors and desks; offices still take clicks.') // clicked whole: the plain map says so itself
  expect(mapStrip({ plain: false, people: false, decor: false }, -1)).toBe('The people do not fit on the map right now; they are in the list. · There are too many offices to click on the map. Pick from the list.')
  expect(mapStrip({ plain: false, people: true, decor: true }, 0)).toBe('\u00a0') // every person clickable: the row kept, blank
})
