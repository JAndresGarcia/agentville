// Fixtures and helpers shared by the pane-*.test.tsx files (the pane's tests, split by area).
import { mock } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'
import { MAIN, addStep, signOf, endStep, newBeat, notesFrom, pushChat, setAgent } from '../hooks/beat'
import type { Beat, Cmd } from '../hooks/beat'
import { setLang } from '../hooks/i18n'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// The click layers over the map and the tour: one band Client `hits-<band>` (bandhits.tsx) per band that holds a zone,
// its Buttons keyed `<key>@<band>` (`.<n>` for a zone's later runs in the band), each posting its key.
export type BandP = { b: number; runs: [number, string | null, string | null][]; glow: string | null }
export const bandClients = async (ui: Mounted<'desktop', 'Pane'>) => (await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('hits-'))
/** The keys the click layer holds, in band order: the map's zone groups, or the tour's controls. */
export const hitKeys = async (ui: Mounted<'desktop', 'Pane'>) => [...new Set((await bandClients(ui)).flatMap(c => (c.props.props as BandP).runs.map(r => r[1]).filter((k): k is string => !!k)))]
/** Presses the first Button of the click layer that posts `key`, as a click on it does. */
export async function onMap(ui: Mounted<'desktop', 'Pane'>, key: string) {
  for (const c of await bandClients(ui)) {
    const b = (await ui.findAll({ type: 'Button', in: c.key! })).find(x => x.key?.startsWith(`${key}@`))
    if (b) return void await ui.press({ key: b.key! })
  }
  throw new Error(`no click zone for ${key}`)
}
// Settles the mocked clock until `cond` holds (or `cap` rounds pass): signatures are checked on real time, outside `$`,
// so a fixed number of rounds can run short under load. With `ms`, each round also moves the clock (work that sleeps
// on it may only start once a late signature check is done).
export const until = async (clock: { settle: () => Promise<unknown>; advance: (ms: number) => Promise<unknown> }, cond: () => boolean, cap = 200, ms = 0) => {
  for (let i = 0; i < cap && !cond(); i++) await (ms ? clock.advance(ms) : clock.settle())
}
// The pane's buttons are drawn by btns.tsx Clients keyed `btns-<area>`: their Buttons and Texts, found in every one.
export type UI = Mounted<'desktop', 'Pane'>
export const btnsKeys = async (ui: UI) => (await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => k.startsWith('btns-'))
// A button drawn as a picture (a strip's band Client, bandhits.tsx) shows only filler; what each picture says travels in
// its Client's props by key (`<key>~<n>` on a picture's later rows), read here as its text.
export const btnsAll = async (ui: UI) => (await Promise.all((await ui.findAll({ type: 'Client' })).filter(c => c.key?.startsWith('btns-')).map(async c => {
  const words = (c.props.props as { words?: Record<string, string> } | undefined)?.words
  return (await ui.findAll({ type: 'Button', in: c.key! })).map(b => (words ? { ...b, text: words[b.key!.replace(/~\d+$/, '')] ?? b.text } : b))
}))).flat()
/** The elements a strip's band Client draws: its row Box, a Box per run and a Button per keyed run. */
export const stripEls = (p: BandP) => 1 + p.runs.length + p.runs.filter(r => r[1]).length
export const btn = async (ui: UI, key: string) => (await btnsAll(ui)).find(b => b.key === key)
export const textsAll = async (ui: UI, text: string | RegExp) => [...await ui.findAll({ type: 'Text', text }), ...(await Promise.all((await btnsKeys(ui)).map(k => ui.findAll({ type: 'Text', text, in: k })))).flat()]
// How many times the pane was drawn (it logs each pass, the last 20).
export const drawn = (files: Record<string, string>) => (JSON.parse(files['/home/test/.claude/agentville/render-log.json'] ?? '[]') as unknown[]).length

export const PANE = {
  title: 'Agentville',
  isFocused: false,
  bodyColumns: 110,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

// Two sessions: one waiting for a permission with a reviewer at work, one done.
export function beats(now: number): Beat[] {
  const a = newBeat('s1', 'tienda', now), b = newBeat('s2', 'blog', now - 1000)
  setAgent(a, MAIN, now, { state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test' })
  setAgent(a, 'ag1', now, { role: 'rev', kind: 'gp-reviewer', state: 'leyendo', activity: 'Read carrito.ts' })
  notesFrom(a, { items: [{ content: 'Leer carrito', status: 'completed' }, { content: 'Probar en móvil', status: 'in_progress' }] })
  pushChat(a, { who: 'tú', text: 'arregla el carrito' })
  pushChat(a, { who: 'claude', text: 'Listo: **carrito** arreglado.' })
  endStep(a, addStep(a, 'jefe', 'Bash pnpm test'), false)
  addStep(a, 'rev', 'Read carrito.ts') // the reviewer's step under way: its action plan
  a.usage = { pct: 42, tokens: 84000, window: 200000, usd: 3.12, cats: [], limits: [{ kind: 'five_hour', pct: 23 }] }; a.tools = { Bash: 3, Read: 2 }
  a.bg = [{ id: 'b1', text: 'Bash pnpm e2e', status: 'corriendo' }]
  setAgent(b, MAIN, now - 1000, { state: 'terminado', activity: 'Te respondió' })
  return [a, b]
}
// Serves the heartbeat folder from memory (the test kit has no file system) and places the pane; the engine's record
// of open panes and the processes run are kept here too (a process answers `run`, else exit 1).
export type Ran = { exitCode: number; stdout: string; stderr: string }
export const RAN_NOT = { exitCode: 1, stdout: '', stderr: '' }
export type Entry = { name: string; kind: 'file' | 'dir'; size: number; mtimeMs: number; isLink: boolean }
export type Stat = { kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number; isLink: boolean; realPath?: string }
/** A regular file of `size` bytes, as $.fs.stat answers. */
export const fileStat = (size = 1000): Stat => ({ kind: 'file', size, mtimeMs: 0, isLink: false })
/** `stat` for serveBeats: these paths are regular image files. */
export const imageAt = (...paths: string[]) => (p: string) => (paths.includes(p) ? fileStat() : undefined)
/** sips and base64 as macOS answers them: every image 10 x 150 px (two zoom strips). */
export const sipsRun = (argv: readonly string[]): Ran | undefined => (argv[0] === '/usr/bin/sips' ? { exitCode: 0, stdout: argv.includes('-g') ? `${argv.at(-1)}\n  pixelWidth: 10\n  pixelHeight: 150\n` : '', stderr: '' }
  : argv[0] === '/usr/bin/base64' ? { exitCode: 0, stdout: '', stderr: '' } : undefined)
// `wait` holds a read pending (a promise on the mocked clock) to make a pass slow.
// `waitKey` does the same for a store read. `sips`: /usr/bin/sips is there. `stat` answers $.fs.stat (else a file the
// pane wrote, or missing); a read as bytes answers 'QUJD'.
export function serveBeats(on: On, list: Beat[], opts: { run?: (argv: readonly string[]) => Ran | undefined; dir?: (path: string) => Entry[] | undefined; wait?: (path: string) => Promise<void> | undefined; waitKey?: (key: string) => Promise<void> | undefined; id?: () => string; sips?: boolean; stat?: (path: string, resolve: boolean) => Stat | undefined; waitWrite?: (path: string) => Promise<void> | undefined } = {}) {
  const run = opts.run ?? (() => undefined)
  // a session's start and end, for the tests that raise them
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.cwd', () => ({ value: '/home/test/proj' }))
  on('session.surfaces', () => ({ value: [] }))
  const registered: string[] = []
  on('command.register', ($, e) => { registered.push(e.description ?? ''); return { value: { command: e.name } } })
  const panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  const opens: { rows?: number; columns?: number }[] = [] // what each open asked for
  on('ui.open', ($, e) => { opens.push({ rows: e.rows, columns: e.columns }); if (!panes.some(x => x.id === e.id)) panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [...panes] }))
  on('ui.close', ($, e) => { const i = panes.findIndex(x => x.id === e.id); if (i >= 0) panes.splice(i, 1); return { value: undefined } })
  const ran: (readonly string[])[] = [], inits: unknown[] = [], events: string[] = [] // runs and writes, in order
  on('process.run', ($, e) => { ran.push(e.argv); inits.push(e.init); events.push(`run ${e.argv.join(' ')}`); return { value: { ...(run(e.argv) ?? RAN_NOT), isStdoutTruncated: false, isStderrTruncated: false } } })
  const env = { broken: false } // set to make every $.env.get throw
  on('env.get', () => { if (env.broken) throw new Error('sin HOME'); return { value: '/home/test' } })
  // Dismissed in the old first-run card: counts as a finished tour (the tour tests delete it to see a first run).
  // render-log: the pane writes its render log, which the tests read (off by default).
  const store: Record<string, unknown> = { 'intro-done': true, 'render-log': true, lang: 'es' } // these tests read the Spanish copy; English is the default
  on('session.id', () => ({ value: opts.id?.() ?? 's-test' }))
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.get', async ($, e) => { await opts.waitKey?.(e.key); return { value: store[e.key] } })
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  on('fs.list', async ($, e) => {
    await opts.wait?.(String(e.path))
    return { value: opts.dir?.(String(e.path)) ?? list.map(b => ({ name: `${b.id}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }
  })
  const files: Record<string, string> = {} // what the pane writes, read back as a disk would
  on('fs.write', async ($, e) => { await opts.waitWrite?.(String(e.path)); files[String(e.path)] = String(e.text); events.push(`write ${e.path}`); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  const reads: string[] = []
  on('fs.read', async ($, e) => {
    reads.push(String(e.path)); await opts.wait?.(String(e.path))
    if (e.as === 'bytes') return { value: { base64: 'QUJD' } }
    return { value: files[String(e.path)] ?? JSON.stringify(list.find(b => String(e.path).endsWith(`/sessions/${b.id}.json`))) ?? '' }
  })
  const stats: string[] = []
  on('fs.stat', ($, e) => {
    const p = String(e.path)
    stats.push(p)
    const st = opts.stat?.(p, e.resolve) ?? (p === '/usr/bin/sips' && opts.sips ? fileStat() : p in files ? fileStat(files[p]!.length) : undefined)
    if (!st) throw new Error(`ENOENT: ${p}`)
    return { value: st }
  })
  return { events, stats, toasts, files, store, panes, ran, inits, reads, registered, env, opens }
}
// The session list's old per-row Clients (list-hit-layer stored false, the /agentville capa de clics fallback), which
// the tests that call this read; the default is the one-Client click layer.
export const oldList = (store: Record<string, unknown>) => { store['list-hit-layer'] = false }

// n live sessions with full teams, every one at work.
export function crowd(count: number, now: number): Beat[] {
  return Array.from({ length: count }, (_, i) => {
    const b = newBeat(`c${i}`, `Sesión ${i + 1}`, now - i)
    setAgent(b, MAIN, now - i, { state: i % 5 === 4 ? 'esperando' : 'trabajando', activity: 'Edit x.ts' })
    ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `c${i}-${r}`, now - i, { role: r, state: 'trabajando', activity: 'Read y.ts' }))
    return b
  })
}
export const HOME = '/home/test/.claude/agentville'
export const OPEN = { command: 'agentville', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 110 } }
export const startSession = ($: Engine) => $.session.start({ cwd: '/home/test/proj', surface: 'desktop', isInteractive: true })
export const beatOf = (files: Record<string, string>) => JSON.parse(files[`${HOME}/sessions/s-test.json`]!) as Beat
export const ask = ($: Engine) => $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'pnpm test' } })
// What the tests' stand-in for the session's own prompt answers, beneath the mod (the kit has nothing there, so a test
// hook answers): a fixed deny in its own words, the only answer besides ask the plugin directory takes from a permission
// hook. The mod's own deny says 'Rejected from Agentville'.
export const ASKED = { decision: { behavior: 'deny', message: 'Asked in the session' } }

// An order as the pane writes it, signed with `key`.
export const signed = async (key: string, c: Omit<Cmd, 'sig'>, to = 's-test'): Promise<Cmd> => ({ ...c, sig: await signOf(key, c, to) })
export const mailbox = async (files: Record<string, string>, cmds: Cmd[]) => { files[`${HOME}/control/s-test.json`] = JSON.stringify({ cmds }) }
export const mountPane = ($: Engine) => $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: PANE })
export const held = (now: number) => { const list = beats(now); setAgent(list[0]!, MAIN, now, { req: 'r1' }); return list }
export const ordersIn = (files: Record<string, string>, id = 's1') => (JSON.parse(files[`${HOME}/control/${id}.json`] ?? '{"cmds":[]}') as { cmds: Cmd[] }).cmds
export const keyed = async (ui: Mounted<'desktop', 'Pane'>, k: string) => (await ui.findAll({ type: 'Button' })).filter(b => b.props.hotkey === k)
export async function relaySetup($: Engine, on: On, edit: (list: Beat[], now: number) => Beat[] = l => l) {
  const clock = mock.clock(on, { now: 1_000_000 })
  const ok = { exitCode: 0, stdout: '', stderr: '' } // sips is there and the clipboard holds an image
  const s = serveBeats(on, edit(beats(clock.now()), clock.now()), { sips: true, run: argv => (argv[0] === '/usr/bin/osascript' ? ok : undefined) })
  await startSession($)
  await $.command.run(OPEN)
  return { ...s, clock, ui: await mountPane($) }
}
export const textsIn = (files: Record<string, string>, id = 's1') => ordersIn(files, id).map(c => c.text)
export const overlayOf = async (ui: Mounted<'desktop', 'Pane'>) => (await ui.findAll({ type: 'Svg' })).find(x => /^(Recorrido|Tour), (paso|step) \d+ (de|of) \d+: /.test(String(x.props.alt)))
// The step's title, from the overlay's alt ("Recorrido, paso 3 de 12: El Jefe. Gem: ...").
export const titleOf = async (ui: Mounted<'desktop', 'Pane'>) => /: (.*?)\. Gem: /.exec(String((await overlayOf(ui))?.props.alt ?? ''))?.[1] ?? ''
export const lastEls = (files: Record<string, string>) => (JSON.parse(files[`${HOME}/render-log.json`]!) as { elements: number }[]).at(-1)!.elements
 // a stored step number, by its Spanish title
/** Walks the tour with Siguiente to its last step, the titles seen in order (and `each` run on every step). */
export async function walk(ui: Mounted<'desktop', 'Pane'>, each: () => Promise<void> = async () => {}) {
  const seen = [await titleOf(ui)]
  await each()
  while ((await hitKeys(ui)).includes('tour-next')) { await onMap(ui, 'tour-next'); seen.push(await titleOf(ui)); await each() }
  return seen
}

// prompt.compose answers the engine's sections here (the kit has none of its own) and spawn its agent.
export const SKILL_RULE = (name: string) => `Team flow chosen in Agentville. If you are this session's main agent, every change to files in a repository goes through the skill ${name}. If that skill is not available in this session, work as usual. Questions, research and reading need no flow. If you are a subagent, follow your own instructions instead.`
// `list`: other sessions' heartbeats; `intro`: the old first-run card dismissed (both say Agentville ran here before).
export async function flowSeen($: Engine, on: On, stored: unknown, used: { list?: readonly Beat[]; intro?: boolean; key?: string } = { intro: true }) {
  const { store } = serveBeats(on, [...(used.list ?? [])])
  if (!used.intro) delete store['intro-done']
  if (used.key) store[used.key] = used.key === 'hidden' ? {} : 'k'
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }))
  let prompt = ''
  on('agent.spawn', ($2, e) => { prompt = e.prompt; return { model: 'm', agentId: 'a1' } })
  if (stored !== undefined) store['team-flow'] = stored
  const team = (await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })).sections.filter(x => x.id === 'agentville:team-flow').map(x => x.text)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'haz algo', description: 'algo', subagentType: 'builder', provider: { plugin: 'engine', tier: 'core' } as never, parentModel: 'm', background: false, fork: false })
  return { team, plan: prompt.includes('write your plan with TodoWrite'), store }
}
// Before 1.0.0 an unset choice meant the Agentville flow: a machine that ran Agentville keeps it, stored once.
// Only what a fresh install cannot have written before the tour counts: a heartbeat from a version before `mod`, the
// old first-run card dismissed, a mailbox key, a refresh's hidden list.
export const fresh = (id: string): Beat => ({ ...newBeat(id, id, 0), mod: '1.0.0' })
// A reply in tienda's conversation (selected), drawn as the pane draws it.
export async function chatPane($: Engine, on: On, text: string) {
  const clock = mock.clock(on, { now: 100000 }), list = beats(clock.now())
  list[0]!.chat = [{ who: 'claude', text }]
  const served = serveBeats(on, list)
  await $.command.run(OPEN)
  const ui = await mountPane($)
  await ui.press({ key: 'pick-s1' })
  // Replaces the reply: the next read of the heartbeats draws it.
  const say = async (next: string) => { list[0]!.chat = [{ who: 'claude', text: next }]; list[0]!.at = clock.now() + 1; await clock.advance(3100) }
  return { ui, files: served.files, say, toasts: served.toasts }
}
export type TN = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
export const tnodes = (n: unknown): TN[] => (n && typeof n === 'object' ? [n as TN, ...((n as TN).children ?? []).flatMap(tnodes)] : [])
export const textOf = (n: unknown): string => typeof n === 'string' ? n : n && typeof n === 'object' ? ((n as TN).children ?? []).map(textOf).join('') : ''

// Elements a plain table adds: per cell 1 Box + 1 Text (+1 Text per code or bold run), per row 1 Box, per table 1 outer
// Box (the header's tint is a prop, no element), +1 Text when rows or columns are left out. A 6-column table with a
// header and 10 rows: 66 x 2 + 11 + 1 = 144. It weighs more than a folded bubble holds, so it is opened: Ver menos adds
// its Button and the dark Box around it (the footer Box with Copiar is always there), 146 in all.
export const line = (cells: string[]) => `| ${cells.join(' | ')} |`
// The button areas drawn (a button drawn as a picture is a Client `<area>~<id>` per button).
export const areas = async (ui: UI) => [...new Set((await ui.findAll({ type: 'Client' })).map(c => c.key!).filter(k => !k.startsWith('hits-')).map(k => k.replace(/~.*$/, '')))].sort()
// The banner is a picture (chrome.ts): its alt says what it shows.
export const bannerAlt = async (ui: UI) => String((await ui.findAll({ type: 'Svg' })).find(x => /^(Nuevo · |New · )?(Te esper|\d+ waiting)/.test(String(x.props.alt)))?.props.alt ?? '')
export const mountAt = ($: Engine, columns: number) => $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: { ...PANE, bodyColumns: columns } })
export const clientKeys = async (ui: UI) => (await ui.findAll({ type: 'Client' })).map(c => c.key!)

export type Logged = { clients: number; clicks: number; mode: number; viewOnly: boolean; noMap: boolean; noPeople: boolean; shed: string[]; chars: number; nodes: number; depth: number; elements: number; tooHeavy?: boolean }
export const lastLog = (files: Record<string, string>) => (JSON.parse(files[`${HOME}/render-log.json`]!) as Logged[]).at(-1)!
