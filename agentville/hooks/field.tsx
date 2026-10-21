import type { ClientModule } from 'claude-code'

// The message field, drawn by the mod: the app's own Input keeps a width and a colour of its own, so this one is a
// surface module that takes the keys itself. A click gives it the focus (Escape gives it back); it shows a blinking
// block caret over the character it stands on (so nothing moves), selects with shift and the arrows, cmd/ctrl+A or a
// drag, jumps or deletes a word with meta or ctrl and the arrows or backspace, posts `{ draft }` 150 ms after the last change (at once when the menu opens or closes, and with every copy or
// paste), `{ copy }` on cmd/ctrl+C or X and only `{ send }` on Enter, and draws itself empty when its props bring a new
// `clear` (the pane's Enviar button sent the draft). Cmd+V posts `{ pasteImage }`: the pane attaches the clipboard's
// image or, with none, hands its text back as a new `insert`, which goes in at the caret like typed text, once per `n`.
// Unfocused it does nothing: no timer, no state, no posts (a busy field flooded the desktop's Client frame live, 2026-10-19); the caret blinks only until 10 s after the last key or click. A draft that is a bare `/name` opens
// the session's commands under it, grouped by where they come from: the arrows pick, → at the end fills (Tab too where
// a surface hands it over: the desktop keeps Tab for its focus, live probe 2026-10-20), Enter or a click runs.

// `mine` and `more` are the pane's words (i18n.ts 'field.mine', 'field.more'): a surface module runs without the
// hooks module's imports, so the pane hands them over; Spanish when absent. `tint`: /agentville calibrar clics paints it
// (its own dark fills step aside so the tint shows) and turns on the key probe: each key's post carries `probe`.
type Props = { placeholder: string; mine?: string; more?: string; bg: string; ink: string; dim: string; line: string; focus: string; sel: string; clear: number; insert?: { n: number; text: string }; cmds: [name: string, description: string, source: string][]; tint?: string }
// `from` is the selection's other end: equal to `at` when nothing is selected.
// view: the first character in sight; it moves only when the caret would leave the field, as an input scrolls.
type State = { text: string; at: number; from: number; on: boolean; blink: boolean; clear: number; pick: number; view?: number }

// Named keys the surface reports; anything else is text typed (or pasted).
const NAMED = new Set(['up', 'down', 'left', 'right', 'return', 'tab', 'backspace', 'delete', 'pageup', 'pagedown', 'home', 'end', 'escape', 'insert',
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)])
const LEFT = 2 // the round border and paddingX 1 before the first character
const MENU_TOP = 4 // the field's three rows and the menu's top border above its first row

const GROUPS: [string, string][] = [['user', ''], ['plugin', 'Plugins'], ['mcp', 'MCP'], ['builtin', 'Claude Code']] // user: `yours` in menuOf
const PER_GROUP = 3 // typing narrows the rest
type Row = { head: string; more: number } | { cmd: Props['cmds'][number]; i: number }

/** The menu's rows for a draft: names that start with it, then names that contain it, then descriptions that mention it
 * (`/kowals` finds emil-design-eng), accents ignored, at most PER_GROUP per source. */
// The Spanish words used when the pane passes none (they match i18n.ts; a test checks it).
export const MINE_EN = 'Your skills and commands', MORE_EN = 'more' // the default language's words, when the panel passes none
export function menuOf(text: string, cmds: Props['cmds'], yours = MINE_EN): Row[] {
  if (!/^\/\S*$/.test(text)) return []
  const flat = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const q = flat(text.slice(1))
  const rank = (c: Props['cmds'][number]) => (flat(c[0]).startsWith(q) ? 0 : flat(c[0]).includes(q) ? 1 : flat(c[1]).includes(q) ? 2 : 3)
  const hits = [0, 1, 2].flatMap(r => cmds.filter(c => rank(c) === r))
  const rows: Row[] = []
  let i = 0
  const of = (k: string) => hits.filter(c => c[2] === k || (k === 'user' && !GROUPS.some(([g]) => g === c[2])))
  // The group holding the best match goes first, so Enter runs the closest command.
  const order = GROUPS.filter(([k]) => of(k).length).sort(([x], [y]) => rank(of(x)[0]!) - rank(of(y)[0]!))
  for (const [k, head] of order) {
    const mine = of(k)
    rows.push({ head: k === 'user' ? yours : head, more: Math.max(0, mine.length - PER_GROUP) })
    for (const cmd of mine.slice(0, PER_GROUP)) rows.push({ cmd, i: i++ })
  }
  return rows
}
const picks = (rows: Row[]) => rows.flatMap(r => ('cmd' in r ? [r.cmd] : []))

const BLINK = 530, IDLE = 10000, DEBOUNCE = 150
// Per instance (the engine calls the module again with the same surface): the latest props, the timers and the menu
// flag last posted. Listeners and timers read it, so they are set once and never close over an old render.
// ins: the last insert `n` taken; queued: its text, applied from a one-shot timer (never while drawing).
type Live = { p: Props; blink?: () => void; idle: number; draft?: () => void; menu: boolean; ins?: number; queued?: string; apply?: () => void }
const lives = new WeakMap<object, Live>()
// A draft longer than the field scrolls inside it, the caret always in view, so the field never widens the row.
const roomOf = (columns: number) => Math.max(8, columns - 2 * LEFT)
// It starts on a whole character (moved past one it would cut), so its left edge never draws half an emoji.
const viewOf = (c: State, room: number) => { const v = Math.max(c.at + 1 - room, Math.min(c.view ?? 0, c.at), 0); return snap(c.text, v) < v ? charRight(c.text, v) : v }
// No local takes the name `h`: JSX compiles against it.
const range = (c: State) => [Math.min(c.at, c.from), Math.max(c.at, c.from)] as const
// The caret stops only between whole characters (an emoji, a flag, a letter and its accent), never inside one, so a
// key never leaves half an emoji (a lone surrogate) behind.
const CHARS = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const chars = (text: string) => [...CHARS.segment(text)].map(x => x.segment)
/** The start of the character holding `at` (`at` itself between two); the end of the text past it. */
export const snap = (text: string, at: number) => (at <= 0 ? 0 : at >= text.length ? text.length : CHARS.segment(text).containing(at)!.index)
export const charLeft = (text: string, at: number) => (at > 0 ? snap(text, at - 1) : 0)
export function charRight(text: string, at: number) {
  const c = CHARS.segment(text).containing(at)
  return c ? c.index + c.segment.length : text.length
}
// Word jumps as macOS fields make them: left skips the gap, then the word; right the same forward. A character is in a
// word when any of its parts is a letter, mark or digit (an accented letter, a CJK letter beyond the BMP).
const WORD = /[\p{L}\p{M}\p{N}_]/u
export function wordLeft(text: string, at: number) {
  const cs = chars(text.slice(0, at))
  while (cs.length && !WORD.test(cs.at(-1)!)) at -= cs.pop()!.length
  while (cs.length && WORD.test(cs.at(-1)!)) at -= cs.pop()!.length
  return at
}
export function wordRight(text: string, at: number) {
  const cs = chars(text.slice(at))
  while (cs.length && !WORD.test(cs[0]!)) at += cs.shift()!.length
  while (cs.length && WORD.test(cs[0]!)) at += cs.shift()!.length
  return at
}
// The state drawn: a new `clear` empties the text without a setState; the next key or click stores it.
const derive = (c: State | undefined, p: Props): State =>
  !c || c.clear !== p.clear ? { text: '', at: 0, from: 0, on: c?.on ?? false, blink: true, clear: p.clear, pick: 0 } : c

function wire(s: Parameters<ClientModule<Props, State>>[1], L: Live) {
  const cur = () => derive(s.state, L.p)
  const startOf = (c: State) => viewOf(c, roomOf(s.columns))
  // shown: the text last set, so a post made after it never reads a state the engine may not have stored yet.
  let shown: string | undefined
  const set = (c: State) => { shown = c.text; s.setState({ ...c, view: startOf(c) }) }
  const stop = () => { L.draft?.(); L.draft = undefined }
  // The key probe (/agentville calibrar clics, `tint` set): a post made while a key is handled carries what that key
  // was, so it never replaces the draft or send posted in the same frame.
  let probe: [key: string, mods: string[]] | undefined, posted = false
  const post = (d: Record<string, string | boolean>) => { posted = true; s.post(probe ? { ...d, probe } : d) }
  // An immediate post carries the draft too, so a later post in the same frame (which replaces it) never loses it.
  const flush = (text: string, extra: Record<string, string | boolean> = {}) => { stop(); post({ ...extra, draft: text, menu: L.menu }) }
  const later = () => { stop(); L.draft = s.every(DEBOUNCE, () => { stop(); s.post({ draft: cur().text, menu: L.menu }) }) }
  const put = (c: State, text: string, at: number, extra?: Record<string, string | boolean>) => {
    set({ ...c, text, at, from: at, on: true, blink: true, pick: 0 })
    const menu = menuOf(text, L.p.cmds).length > 0
    if (extra || menu !== L.menu) { L.menu = menu; flush(text, extra) } else later() // the pane's layout waits on the menu flag
  }
  const replace = (c: State, ins: string, extra?: Record<string, string | boolean>) => { const [lo, hi] = range(c); put(c, c.text.slice(0, lo) + ins + c.text.slice(hi), lo + ins.length, extra) }
  const send = (c: State, text: string) => { stop(); L.menu = false; post({ send: text }); s.setState({ ...c, text: '', at: 0, from: 0, on: true, pick: 0 }) }
  const move = (c: State, at: number, keep: boolean) => set({ ...c, at, from: keep ? c.from : at, on: true, blink: true })
  // The caret blinks while the field is in use and stays solid once idle, so an idle field has no timer.
  const wake = () => {
    L.idle = 0
    L.blink ??= s.every(BLINK, () => {
      const c = s.state
      if ((L.idle += BLINK) >= IDLE) { L.blink?.(); L.blink = undefined; if (c && !c.blink) s.setState({ ...c, blink: true }); return }
      if (c?.on) s.setState({ ...c, blink: !c.blink })
    })
  }

  // shortcut: one column per character and one line (the menu's rows count from MENU_TOP), as a long draft scrolls
  // nothing; wide characters (emoji) land off by one.
  // A queued paste goes in at the caret like typed text; only a field in use starts its blink timer.
  L.apply = () => {
    const ins = L.queued
    L.queued = undefined
    if (!ins) return
    const c = cur()
    if (c.on) wake()
    replace(c, ins.replace(/[\r\n\t]+/g, ' '))
  }
  s.onPointer((e) => {
    if (e.type !== 'down' && !(e.type === 'move' && e.button === 'left')) return // a hover does nothing
    if (e.button === 'left') wake() // a right click (the app's menu) starts no blink timer
    const c = cur()
    const row = c.on ? menuOf(c.text, L.p.cmds)[e.y - MENU_TOP] : undefined
    if (row) { if (e.type === 'down' && 'cmd' in row) send(c, `/${row.cmd[0]}`); return }
    if (e.y >= MENU_TOP - 1) return
    const i = snap(c.text, startOf(c) + e.x - LEFT) // never inside an emoji
    if (e.type === 'down' && e.button === 'left') move(c, i, !!e.shift && c.on)
    else if (e.type === 'move') move(c, i, true)
  })
  s.onKey((e) => {
    // Typed text is never named, only that it was text (''): a named key, or one character with meta or ctrl (a
    // shortcut, or what Option types); a space or a paste, never.
    probe = L.p.tint ? [NAMED.has(e.key) || ((e.ctrl || e.meta) && e.key.length === 1) ? e.key : '', (['meta', 'ctrl', 'shift'] as const).filter(m => e[m])] : undefined
    posted = false
    shown = undefined
    onKey(e)
    if (probe && !posted) flush(shown ?? cur().text, {})
    probe = undefined
  })
  const onKey = (e: Parameters<Parameters<typeof s.onKey>[0]>[0]) => {
    wake()
    const c = cur()
    const { text, at } = c, [lo, hi] = range(c), picked = lo < hi, mod = e.ctrl || e.meta
    const menu = picks(menuOf(text, L.p.cmds)), pick = menu[c.pick]
    if (pick && (e.key === 'up' || e.key === 'down')) { s.setState({ ...c, pick: (c.pick + (e.key === 'up' ? menu.length - 1 : 1)) % menu.length }); return }
    if (pick && (e.key === 'tab' || (e.key === 'right' && !e.shift && !mod && !picked && at === text.length))) { put(c, `/${pick[0]} `, pick[0].length + 2); return }
    if (pick && e.key === 'return') { send(c, `/${pick[0]}`); return }
    if (e.key === 'return') {
      const t = text.trim()
      if (t) send(c, t)
      return
    }
    if (mod && e.key === 'a') { set({ ...c, from: 0, at: text.length, on: true }); return }
    if (mod && (e.key === 'c' || e.key === 'x')) {
      if (picked && e.key === 'x') replace(c, '', { copy: text.slice(lo, hi) }) // one post: the copy and the draft left
      else if (picked) flush(text, { copy: text.slice(lo, hi) })
      return
    }
    // Option and Cmd both arrive as meta (live probe 2026-10-20), Ctrl as ctrl: either jumps or deletes a whole word;
    // up and down (with meta too) are the field's start and end.
    if (e.key === 'backspace') { const to = mod ? wordLeft(text, at) : charLeft(text, at); if (picked) replace(c, ''); else if (at > 0) put(c, text.slice(0, to) + text.slice(at), to); return }
    if (e.key === 'delete') { if (picked) replace(c, ''); else if (at < text.length) put(c, text.slice(0, at) + text.slice(charRight(text, at)), at); return }
    const keep = !!e.shift
    if (e.key === 'left') { move(c, mod ? wordLeft(text, picked && !keep ? lo : at) : picked && !keep ? lo : charLeft(text, at), keep); return }
    if (e.key === 'right') { move(c, mod ? wordRight(text, picked && !keep ? hi : at) : picked && !keep ? hi : charRight(text, at), keep); return }
    if (e.key === 'home' || e.key === 'up') { move(c, 0, keep); return }
    if (e.key === 'end' || e.key === 'down') { move(c, text.length, keep); return }
    if (mod && e.key === 'v') { flush(text, { pasteImage: true }); return } // the pane reads the clipboard: an image or `insert`
    if (mod || NAMED.has(e.key)) return // shortcuts stay the app's
    const typed = e.key === 'space' ? ' ' : e.key.replace(/[\r\n\t]+/g, ' ') // a paste may arrive whole, on one line
    replace(c, typed)
  }
}

const Field: ClientModule<Props, State> = (p, s) => {
  const { Box, Text } = s.elements
  const L = lives.get(s)
  if (L) L.p = p
  else { const fresh: Live = { p, idle: 0, menu: false, ins: p.insert?.n }; lives.set(s, fresh); wire(s, fresh) } // listeners once per instance; an insert already there is old
  if (L && p.insert && p.insert.n !== L.ins) { // a new paste: noted here, applied once on the next tick
    L.ins = p.insert.n
    L.queued = p.insert.text
    const once = s.every(1, () => { once(); L.apply?.() })
  }
  const st = derive(s.state, p), room = roomOf(s.columns)

  const caret = st.on && st.blink
  // The caret paints the cell it stands on (a space past the end), so blinking never shifts the text.
  const cell = (ch: string) => caret ? <Text color={p.bg} backgroundColor={p.focus}>{ch}</Text> : ch
  const t = st.text, [lo, hi] = range(st), ph = p.placeholder, start = viewOf(st, room), after = charRight(t, st.at) // the whole character under the caret
  const end = snap(t, start + room) // the right edge drops a character it would cut
  const w = (a: number, b: number) => t.slice(Math.max(start, a), Math.min(end, b)) // the part of [a, b) in view
  const rows = st.on ? menuOf(t, p.cmds, p.mine) : []
  return (
    <Box flexDirection="column" flexGrow={1} backgroundColor={p.tint}>
    <Box flexDirection="row" backgroundColor={p.tint ? undefined : p.bg} borderStyle="round" borderColor={st.on ? p.focus : p.line} paddingX={1} overflow="hidden">
      {!t
        ? <Text color={p.dim}>{st.on ? cell(ph.slice(0, 1)) : ph.slice(0, 1)}{ph.slice(1)}</Text>
        : lo < hi
          ? <Text color={p.ink}>{w(0, lo)}<Text color={p.ink} backgroundColor={p.sel}>{w(lo, hi)}</Text>{w(hi, t.length)}</Text>
          : <Text color={p.ink}>{w(0, st.at)}{st.on ? cell(t.slice(st.at, after) || ' ') : (t.slice(st.at, after) || ' ')}{w(after, t.length)}</Text>}
    </Box>
    {rows.length > 0 && (
      <Box flexDirection="column" backgroundColor={p.tint ? undefined : p.bg} borderStyle="round" borderColor={p.line} paddingX={1}>
        {rows.map((r, n) => ('cmd' in r
          ? <Text key={`r${n}`} color={p.ink} backgroundColor={r.i === st.pick ? p.sel : undefined}><Text bold>/{r.cmd[0]}</Text><Text color={p.dim}>{`  ${r.cmd[1]}`.slice(0, Math.max(10, s.columns - r.cmd[0].length - 6))}</Text></Text>
          : <Text key={`r${n}`} color={p.dim} bold>{r.head}{r.more ? ` · ${r.more} ${p.more ?? MORE_EN}` : ''}</Text>))}
      </Box>
    )}
    </Box>
  )
}
export default Field
