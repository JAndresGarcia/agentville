import { expect, test } from 'claude-code/testing'

import Field, { wordLeft, wordRight } from '../hooks/field'

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } }
type Cmd = [string, string, string]
const PROPS = { placeholder: 'Escribe', bg: '#000', ink: '#fff', dim: '#888', line: '#333', focus: '#9cf', sel: '#345', clear: 0, cmds: [['review', 'Revisa', 'builtin']] as Cmd[] }

// The field drawn outside the engine, on one surface object kept across calls as the engine does: it counts every
// setState, post, timer and listener, and runs the frame clock by hand.
// lag: a setState is stored only when the frame settles, as an engine may do, so a read in the same key sees the old state.
function mount(props: typeof PROPS & { insert?: { n: number; text: string } } = PROPS, lag = false) {
  let p = props, state: unknown, pending: unknown, columns = 60, now = 0, dirty = false
  const posts: Record<string, unknown>[] = [], timers: { ms: number; due: number; fn: () => void; on: boolean }[] = []
  const count = { sets: 0, pointer: 0, key: 0 }
  let onPointer: ((e: unknown) => void) | undefined, onKey: ((e: unknown) => void) | undefined, tree: unknown
  const el = (type: string) => (q: Record<string, unknown>) => ({ type, props: q })
  const s = {
    elements: { Box: el('Box'), Text: el('Text') },
    get state() { return state },
    setState(n: unknown) { count.sets++; if (lag) pending = n; else state = n; dirty = true },
    get columns() { return columns },
    rows: 3,
    every(ms: number, fn: () => void) { const t = { ms, due: now + ms, fn, on: true }; timers.push(t); return () => { t.on = false } },
    onPointer(fn: (e: unknown) => void) { count.pointer++; onPointer = fn; return () => {} },
    onKey(fn: (e: unknown) => void) { count.key++; onKey = fn; return () => {} },
    post(d: Record<string, unknown>) { posts.push(d) },
  }
  const draw = () => { dirty = false; tree = Field(p as never, s as never) }
  const settle = () => { if (pending !== undefined) { state = pending; pending = undefined } if (dirty) draw() }
  draw()
  const text = (n: unknown = tree): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' && 'props' in n ? text((n as Node).props.children) : '')
  return {
    posts, count, timers, text, tree: () => tree,
    state: () => state as { text: string; at: number; from: number; blink: boolean },
    live: () => timers.filter(t => t.on).length,
    key(key: string, mods: Record<string, true> = {}) { onKey?.({ key, ...mods }); settle() },
    pointer(e: Record<string, unknown>) { onPointer?.(e); settle() },
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const t = timers.filter(x => x.on && x.due <= end).sort((a, b) => a.due - b.due)[0]
        if (!t) break
        now = t.due; t.due += t.ms; t.fn(); settle()
      }
      now = end
    },
    resize(c: number) { columns = c; draw() },
    redraw(next: typeof props = p) { p = next; draw() },
  }
}
const drafts = (posts: Record<string, unknown>[]) => posts.filter(x => 'draft' in x)

test('T2: the draft, caret and selection survive a redraw with new commands; a new clear empties it without a setState', () => {
  const f = mount()
  for (const k of 'hola') f.key(k)
  f.key('left', { shift: true })
  f.redraw({ ...PROPS, cmds: [['other', '', 'user']] })
  expect(f.state()).toMatchObject({ text: 'hola', at: 3, from: 4 })
  expect(f.text()).toBe('hola')
  expect(f.count.pointer).toBe(1) // listeners set once per instance
  expect(f.count.key).toBe(1)
  const sets = f.count.sets
  f.redraw({ ...PROPS, clear: 1 })
  expect(f.count.sets).toBe(sets) // no setState while drawing
  expect(f.text()).toBe('Escribe')
  f.key('x') // the next key stores the empty text
  expect(f.state()).toMatchObject({ text: 'x', at: 1 })
})

test('T3b: unfocused, the clock, hover moves and resizes cause no post, no setState and no timer', () => {
  const f = mount()
  f.advance(5000)
  for (let i = 0; i < 100; i++) f.pointer({ type: 'move', x: i % 40, y: 0 })
  for (let i = 0; i < 20; i++) f.resize(40 + i)
  f.redraw()
  expect(f.posts).toEqual([])
  expect(f.count.sets).toBe(0)
  expect(f.timers).toHaveLength(0)
  expect(f.count.pointer).toBe(1)
})

test('T3c: 50 fast keystrokes give at most 2 draft posts, the last the full text; Enter then posts one send', () => {
  const f = mount()
  const full = 'abcdefghij'.repeat(5)
  for (const k of full) f.key(k)
  f.advance(200)
  const d = drafts(f.posts)
  expect(d.length).toBeLessThanOrEqual(2)
  expect(d.at(-1)).toEqual({ draft: full, menu: false })
  expect(f.live()).toBe(1) // only the blink timer; the draft one ended once it fired
  f.posts.length = 0
  f.key('return')
  expect(f.posts).toEqual([{ send: full }])
})

test('send right after typing carries the full text and no stale draft follows', () => {
  const f = mount()
  for (const k of 'corre las pruebas') f.key(k === ' ' ? 'space' : k)
  f.key('return')
  f.advance(1000)
  expect(f.posts).toEqual([{ send: 'corre las pruebas' }])
})

test('the menu flag posts at once; copy, cut and paste carry the draft in the same post', () => {
  const f = mount()
  f.key('/')
  expect(f.posts).toEqual([{ draft: '/', menu: true }]) // not debounced: the pane lays the menu out
  f.key('r')
  expect(f.posts).toHaveLength(1)
  f.key('backspace'); f.key('backspace')
  expect(f.posts.at(-1)).toEqual({ draft: '', menu: false })
  for (const k of 'hola') f.key(k)
  f.key('a', { meta: true })
  f.key('c', { meta: true })
  expect(f.posts.at(-1)).toEqual({ copy: 'hola', draft: 'hola', menu: false })
  f.key('x', { meta: true })
  expect(f.posts.at(-1)).toEqual({ copy: 'hola', draft: '', menu: false })
  f.key('v', { meta: true })
  expect(f.posts.at(-1)).toEqual({ pasteImage: true, draft: '', menu: false })
  f.advance(1000)
  expect(drafts(f.posts).filter(x => !('copy' in x) && !('pasteImage' in x))).toHaveLength(2) // the two menu flips only
})

test('the caret blinks from the focusing click and goes solid, its timer gone, 10 s after the last key', () => {
  const f = mount()
  expect(f.timers).toHaveLength(0)
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  expect(f.live()).toBe(1)
  f.advance(530)
  expect(f.state().blink).toBe(false)
  f.advance(11000)
  expect(f.live()).toBe(0)
  expect(f.state().blink).toBe(true)
  const sets = f.count.sets
  f.advance(5000)
  expect(f.count.sets).toBe(sets)
  f.key('a') // a key wakes it again
  expect(f.live()).toBe(2) // the blink and the pending draft
})

test('a right click wakes nothing: no blink timer starts; a left click does', () => {
  const f = mount()
  f.pointer({ type: 'down', x: 2, y: 0, button: 'right' })
  expect(f.live()).toBe(0)
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  expect(f.live()).toBe(1)
})

test('a drag selects; a move without the button does nothing', () => {
  const f = mount()
  for (const k of 'hola mundo') f.key(k === ' ' ? 'space' : k)
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  f.pointer({ type: 'move', x: 6, y: 0, button: 'left' })
  expect(f.state()).toMatchObject({ from: 0, at: 4 })
  const sets = f.count.sets
  f.pointer({ type: 'move', x: 9, y: 0 })
  expect(f.count.sets).toBe(sets)
})

test('a pasted text (a new insert) goes in at the caret like typed text, once per n; newlines and tabs become spaces', () => {
  const f = mount()
  for (const k of 'hola') f.key(k)
  f.key('left')
  f.advance(1000)
  f.redraw({ ...PROPS, insert: { n: 1, text: 'X\nY\tZ' } })
  f.advance(1)
  expect(f.state()).toMatchObject({ text: 'holX Y Za', at: 8, from: 8 })
  f.redraw({ ...PROPS, insert: { n: 1, text: 'X\nY\tZ' } }) // the same n again: applied once
  f.advance(1)
  expect(f.state().text).toBe('holX Y Za')
  f.advance(1000)
  expect(f.posts.at(-1)).toEqual({ draft: 'holX Y Za', menu: false }) // then its draft is posted as usual
})

test('a redraw bringing an insert sets no state and posts nothing while drawing; the one-shot tick applies it and ends', () => {
  const f = mount()
  for (const k of 'ab') f.key(k)
  f.advance(1000)
  const sets = f.count.sets, posts = f.posts.length, live = f.live()
  f.redraw({ ...PROPS, insert: { n: 1, text: 'X' } })
  expect([f.count.sets, f.posts.length, f.state().text]).toEqual([sets, posts, 'ab'])
  expect(f.live()).toBe(live + 1) // only the one-shot
  f.advance(1)
  expect(f.state().text).toBe('abX')
  f.advance(20000)
  expect(f.live()).toBe(0) // the one-shot cancelled itself, the caret went idle
})

test('an insert on a field never clicked starts no blink timer beyond its one-shot', () => {
  const f = mount()
  f.redraw({ ...PROPS, insert: { n: 1, text: 'hola' } })
  f.advance(1)
  expect(f.state().text).toBe('hola')
  f.advance(150) // its draft
  expect(f.live()).toBe(0)
  expect(f.posts.at(-1)).toEqual({ draft: 'hola', menu: false })
})

test('an insert during a pending debounced draft joins it: one draft post, with both', () => {
  const f = mount()
  for (const k of 'ab') f.key(k)
  f.redraw({ ...PROPS, insert: { n: 1, text: 'X' } })
  f.advance(1000)
  expect(drafts(f.posts)).toEqual([{ draft: 'abX', menu: false }])
})

test('a redraw with a new clear and a new insert empties the field, then the paste goes in', () => {
  const f = mount()
  for (const k of 'viejo') f.key(k)
  f.redraw({ ...PROPS, clear: 1, insert: { n: 1, text: 'nuevo' } })
  expect(f.text()).not.toContain('viejo')
  f.advance(1)
  expect(f.state()).toMatchObject({ text: 'nuevo', at: 5 })
})

test('a pasted text replaces the selection', () => {
  const f = mount()
  for (const k of 'hola mundo') f.key(k === ' ' ? 'space' : k)
  for (let i = 0; i < 5; i++) f.key('left', { shift: true })
  f.redraw({ ...PROPS, insert: { n: 7, text: 'gente' } })
  f.advance(1)
  expect(f.state()).toMatchObject({ text: 'hola gente', at: 10, from: 10 })
})

test('an insert already in the props when the field mounts is old: it does not go in', () => {
  const f = mount({ ...PROPS, insert: { n: 3, text: 'viejo' } })
  f.advance(1)
  expect(f.text()).toBe('Escribe')
  f.redraw({ ...PROPS, insert: { n: 4, text: 'nuevo' } })
  f.advance(1)
  expect(f.state().text).toBe('nuevo')
})

const typeIn = (f: ReturnType<typeof mount>, text: string) => { for (const k of text) f.key(k === ' ' ? 'space' : k) }

test('AM: meta or ctrl with left and right jump a word, as macOS fields do; shift extends the selection', () => {
  expect([wordLeft('hola, mundo  feliz', 18), wordLeft('hola, mundo  feliz', 13), wordLeft('hola, mundo', 4), wordLeft('', 0)]).toEqual([13, 6, 0, 0])
  expect([wordRight('hola, mundo  feliz', 0), wordRight('hola, mundo  feliz', 4), wordRight('ñandú dos', 0)]).toEqual([4, 11, 5])
  const nfd = 'cafe\u0301 ya' // "café" with its accent as a separate mark: one word
  expect([wordRight(nfd, 0), wordLeft(nfd, 5)]).toEqual([5, 0])
  const f = mount()
  typeIn(f, 'corre las pruebas')
  f.key('left', { meta: true })
  expect(f.state()).toMatchObject({ at: 10, from: 10 })
  f.key('left', { ctrl: true })
  expect(f.state()).toMatchObject({ at: 6, from: 6 })
  f.key('right', { meta: true })
  expect(f.state()).toMatchObject({ at: 9, from: 9 })
  f.key('left', { meta: true, shift: true }) // selects "las"
  expect(f.state()).toMatchObject({ at: 6, from: 9 })
  f.key('left', { ctrl: true, shift: true }) // and "corre " too
  expect(f.state()).toMatchObject({ at: 0, from: 9 })
  f.key('right', { meta: true }) // a jump without shift starts from the selection's end
  expect(f.state()).toMatchObject({ at: 17, from: 17 })
  f.key('home')
  expect(f.state()).toMatchObject({ at: 0, from: 0 })
  f.key('end', { shift: true })
  expect(f.state()).toMatchObject({ at: 17, from: 0 })
  f.key('end')
  f.key('left') // plain arrows still move one character
  expect(f.state()).toMatchObject({ at: 16, from: 16 })
  // Option and Cmd both arrive as meta (live probe 2026-10-20): up and down, with it or not, go to the start or end.
  f.key('up', { meta: true })
  expect(f.state()).toMatchObject({ at: 0, from: 0 })
  f.key('down', { meta: true })
  expect(f.state()).toMatchObject({ at: 17, from: 17 })
  f.key('up')
  f.key('down', { meta: true, shift: true })
  expect(f.state()).toMatchObject({ at: 17, from: 0 })
  f.key('up')
  expect(f.state()).toMatchObject({ at: 0, from: 0 })
  // A selection and meta+left without shift: the caret lands a word before the selection's start, nothing selected.
  f.key('right', { meta: true }); f.key('right', { meta: true }); f.key('right', { meta: true, shift: true }) // "pruebas" selected
  expect(f.state()).toMatchObject({ at: 17, from: 9 })
  f.key('left', { meta: true })
  expect(f.state()).toMatchObject({ at: 6, from: 6 })
  f.key('right', { ctrl: true, shift: true }); f.key('left', { ctrl: true }) // "las" selected, then a jump left from its start
  expect(f.state()).toMatchObject({ at: 0, from: 0 })
})

test('AM: backspace with meta or ctrl deletes the word before the caret; a selection goes whole; a, c, x, v still work', () => {
  const f = mount()
  typeIn(f, 'corre las pruebas')
  f.key('backspace', { meta: true })
  expect(f.state()).toMatchObject({ text: 'corre las ', at: 10 })
  f.key('backspace', { ctrl: true })
  expect(f.state()).toMatchObject({ text: 'corre ', at: 6 })
  f.key('backspace')
  expect(f.state()).toMatchObject({ text: 'corre', at: 5 })
  f.key('left', { meta: true, shift: true })
  f.key('right')
  f.key('left', { shift: true }); f.key('left', { shift: true })
  f.key('backspace', { meta: true }) // a selection: only it goes
  expect(f.state()).toMatchObject({ text: 'cor', at: 3 })
  f.key('a', { meta: true })
  f.key('c', { meta: true })
  expect(f.posts.at(-1)).toEqual({ copy: 'cor', draft: 'cor', menu: false })
  f.key('x', { ctrl: true })
  expect(f.posts.at(-1)).toEqual({ copy: 'cor', draft: '', menu: false })
  f.key('v', { meta: true })
  expect(f.posts.at(-1)).toEqual({ pasteImage: true, draft: '', menu: false })
})

test('AM: with calibrar clics on (a tint), every key posts its name and modifiers, plain text only as text; off, no probe', () => {
  const off = mount()
  typeIn(off, 'ab')
  off.key('left', { meta: true })
  off.advance(1000)
  expect(off.posts.some(x => 'probe' in x)).toBe(false)
  const tinted = { ...PROPS, tint: 'rgba(60,200,90,0.25)' }
  const f = mount(tinted)
  f.key('h')
  expect(f.posts.at(-1)).toEqual({ draft: 'h', menu: false, probe: ['', []] }) // the letter itself is never named
  f.key('left', { meta: true })
  expect(f.posts.at(-1)).toEqual({ draft: 'h', menu: false, probe: ['left', ['meta']] })
  f.key('b', { meta: true, shift: true })
  expect(f.posts.at(-1)).toEqual({ draft: 'h', menu: false, probe: ['b', ['meta', 'shift']] })
  f.key('return')
  expect(f.posts.at(-1)).toEqual({ send: 'h', probe: ['return', []] }) // one post: the send is never replaced
  f.posts.length = 0
  f.advance(1000)
  expect(f.posts).toEqual([]) // no stray debounced post after it
  // Never named: a space, a character without meta or ctrl, a paste that arrives whole even with meta.
  f.key('space')
  expect(f.posts.at(-1)).toEqual({ draft: ' ', menu: false, probe: ['', []] })
  f.key('x', { shift: true })
  expect(f.posts.at(-1)).toEqual({ draft: ' x', menu: false, probe: ['', ['shift']] })
  f.key('secreto', { meta: true })
  expect(f.posts.at(-1)).toEqual({ draft: ' x', menu: false, probe: ['', ['meta']] })
  f.key('space', { meta: true })
  expect(f.posts.at(-1)).toEqual({ draft: ' x', menu: false, probe: ['', ['meta']] })
})

test('AM2: the probe posts the text the key just made, even when the engine stores the state only after the key', () => {
  const tinted = { ...PROPS, tint: 'rgba(60,200,90,0.25)' }
  const f = mount(tinted, true)
  f.key('h'); f.key('o')
  expect(f.posts.map(x => x.draft)).toEqual(['h', 'ho'])
  f.key('left', { meta: true }) // a move: the text it posts is the text there
  expect(f.posts.at(-1)).toEqual({ draft: 'ho', menu: false, probe: ['left', ['meta']] })
  f.key('return')
  expect(f.posts.at(-1)).toEqual({ send: 'ho', probe: ['return', []] })
})

// AZ item 2: keys took one UTF-16 unit, so Backspace after an emoji left half of it (a lone surrogate) in the draft.
const lone = (x: string) => /\p{Cs}/u.test(x)
test('AZ: backspace, delete and the arrows take a whole character: an emoji, a flag, a letter and its accent', () => {
  const f = mount()
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of ['a', '👍', 'b', '🇨🇴', 'e\u0301']) f.key(k)
  expect(f.state().text).toBe('a👍b🇨🇴e\u0301')
  f.key('backspace')
  expect(f.state()).toMatchObject({ text: 'a👍b🇨🇴', at: 8 })
  f.key('backspace')
  expect(f.state()).toMatchObject({ text: 'a👍b', at: 4 })
  f.key('left')
  f.key('left')
  expect(f.state().at).toBe(1) // before the emoji, not inside it
  f.key('left', { shift: true })
  expect(f.state()).toMatchObject({ at: 0, from: 1 })
  f.key('right')
  f.key('right')
  expect(f.state().at).toBe(3)
  f.key('home')
  f.key('right')
  f.key('delete')
  expect(f.state()).toMatchObject({ text: 'ab', at: 1 })
  f.key('backspace')
  expect(f.state()).toMatchObject({ text: 'b', at: 0 })
  expect(drafts(f.posts).some(d => lone(String(d.draft)))).toBe(false)
})

test('AZ: a click inside an emoji puts the caret before it, and the caret cell draws the whole emoji', () => {
  const f = mount()
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of ['👍', 'b']) f.key(k)
  f.pointer({ type: 'down', x: 3, y: 0, button: 'left' }) // one column in: the emoji's second unit
  expect(f.state().at).toBe(0)
  f.key('x')
  expect(f.state().text).toBe('x👍b')
  const cells: string[] = []
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object' || !('props' in n)) return
    const q = (n as { props: Record<string, unknown> }).props
    if (q.backgroundColor === PROPS.focus) cells.push(f.text(n))
    walk(q.children)
  }
  f.pointer({ type: 'down', x: 3, y: 0, button: 'left' }) // on the emoji: the caret stands on it
  walk(f.tree())
  expect(cells).toEqual(['👍'])
})

test('AZ: word jumps step over whole characters: a letter beyond the BMP is in its word, an emoji is a gap', () => {
  expect(wordLeft('a 𠀀b', 5)).toBe(2)
  expect(wordRight('𠀀b c', 0)).toBe(3)
  expect(wordLeft('hola 👍 ', 8)).toBe(0)
  expect(wordRight(' 👍 mundo', 0)).toBe(9)
})

// AZ item 8: the desktop keeps Tab for its own focus (live probe 2026-10-20), so → at the end of a /draft fills the pick.
test('AZ: → at the end with the menu open fills the pick as Tab does; mid-text or with no menu it only moves', () => {
  const f = mount()
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of '/re') f.key(k)
  f.key('right')
  expect(f.state()).toMatchObject({ text: '/review ', at: 8 })
  const g = mount()
  g.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of '/re') g.key(k)
  g.key('left')
  g.key('right') // mid-text: a move
  expect(g.state()).toMatchObject({ text: '/re', at: 3 })
  g.key('right') // now at the end: fills
  expect(g.state().text).toBe('/review ')
  const ht = mount()
  ht.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of 'hola') ht.key(k)
  ht.key('left')
  ht.key('right')
  ht.key('right') // no menu: at the end it stays
  expect(ht.state()).toMatchObject({ text: 'hola', at: 4 })
  const m = mount() // with shift or meta at the end, → never fills
  m.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of '/re') m.key(k)
  m.key('right', { shift: true })
  m.key('right', { meta: true })
  expect(m.state().text).toBe('/re')
  const t = mount() // a surface that hands Tab over still fills
  t.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of '/re') t.key(k)
  t.key('tab')
  expect(t.state().text).toBe('/review ')
})

// AZ fix round 1: a long draft scrolls inside the field; neither edge of the window may cut an emoji in half.
test('AZ: a scrolled draft with emoji never draws half of one, at the start, in the middle and at the end', () => {
  const f = mount()
  f.resize(12) // room for 8 units
  f.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
  for (const k of ['a', '👍', '👍', '👍', '👍', '👍', '👍', '👍']) f.key(k) // 15 units: both edges land inside an emoji somewhere
  const leaves = (n: unknown): string[] => (typeof n === 'string' ? [n] : Array.isArray(n) ? n.flatMap(leaves) : n && typeof n === 'object' && 'props' in n ? leaves((n as Node).props.children) : [])
  const halves = () => leaves(f.tree()).filter(lone)
  expect([f.state().at, halves()]).toEqual([15, []]) // the end
  for (let i = 0; i < 4; i++) f.key('left')
  expect([f.state().at, halves()]).toEqual([7, []]) // the middle
  f.key('home')
  expect([f.state().at, halves()]).toEqual([0, []]) // the start
  for (let i = 0; i < 7; i++) { f.key('right'); expect(halves()).toEqual([]) }
})
