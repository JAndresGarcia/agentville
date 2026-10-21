import type { AgentvilleAgent, AgentvilleAsk, AgentvilleDept, AgentvilleFacing, AgentvilleOffer, AgentvillePosture, AgentvilleRole, AgentvilleStaff, AgentvilleStateName, AgentvilleVisit, AgentvilleWorld } from '../types'
import { APP_ACTIONS, HIDDEN, MAIN, OFFER_TTL, SLEEP_MS, canSend, isIdle } from './beat'
import type { Beat, BeatAgent } from './beat'
import { chatUrl, diskColor } from './disk'
import { isMod } from './sync'
import { live, t } from './i18n'
import { esc, textW } from './chrome' // esc drops control characters too: session titles and notes are untrusted
import { spritePng } from './png'
import { NO_LIGATURES } from './pixfont'

// The Agentville scene: a pure model (the sessions' heartbeats as a world) and three SVG layers, each under the 131072-char Svg limit.

export const ROLE_ORDER: AgentvilleRole[] = ['jefe', 'impl', 'rev', 'qa']
// Read in the language set at the time (see i18n.ts).
export const ROLES = live(ROLE_ORDER, (r) => t(`role.${r}`))
const STATE_NAMES: AgentvilleStateName[] = ['esperando', 'error', 'trabajando', 'leyendo', 'inactivo', 'terminado']
export const STATES = live(STATE_NAMES, (k) => ({ label: t(`state.${k}`), short: t(`state.${k}.short`) }))
export const SVG_LIMIT = 131072

/* ---------- palette: Hotel clásico ---------- */
const PAL = {
  outline: '#1d2433', wallL: '#a9bdd6', wallR: '#8ea6c4', wallTop: '#d7e2ef', part: '#b8c6d8', partSide: '#9fb0c6', partTop: '#e3eaf3', slab: '#5d7896',
  floors: { tienda: ['#8fb7de', '#82abd3'], recetas: ['#9ed39b', '#91c78e'], blog: ['#efb196', '#e4a589'], portafolio: ['#c9cbd2', '#bdbfc7'], lobby: ['#f3ecd8', '#2f3440'], hall: ['#d9cfb3', '#cfc4a6'], office: ['#c48a54', '#b97f4a'] } as Record<string, string[]>,
  desk: '#d9d2c3', deskSide: '#b4ab98', screenOff: '#2b3442', sofa: '#d84f4f', sofaSide: '#a93b3b', wood: '#9c6b3d', woodSide: '#7a5230',
  leaf: '#3f9a4a', leaf2: '#2f7d39', pot: '#c26a3c', window: '#cfe9fb', frame: '#ffffff', plaque: '#1b5f96', plaqueInk: '#ffffff', rug: '#e7c86a', chair: '#3b6fa8',
}
const SCREEN: Record<AgentvilleStateName, string | null> = { trabajando: '#79c2ff', leyendo: '#c4d3e6', esperando: '#f2a93b', error: '#ef5b5b', terminado: '#7fd6a6', inactivo: null }
const FONT = '-apple-system, system-ui, Helvetica, sans-serif'

/* ---------- projection and primitives ---------- */
const T = 16
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * T, ((x + y) * T) / 2 - z * T]
// Numbers to 0.1 with no leading zero (.5, -.5): a full floor's layers are mostly numbers, and the desktop page counts
// every character of a pane's tree against its limit (mod-clicks 4c).
const r1 = (v: number) => Math.round(v * 10) / 10
const n = (v: number) => String(r1(v)).replace(/^(-?)0\./, '$1.')
const nums = (vs: number[]) => vs.map(n).join(' ').replace(/ -/g, '-') // a minus sign separates path numbers itself
const pts = (arr: number[][]) => arr.map(([x, y, z]) => { const [X, Y] = P(x!, y!, z ?? 0); return n(X) + ',' + n(Y) }).join(' ')
/** Path data for closed outlines of projected points: each outline's first point a move (the first absolute, the next
 * relative to the last outline's start, where a close leaves the pen), its sides relative (h, v or l). Every delta is
 * taken between rounded points, so each corner lands exactly where an absolute one would: the same shapes, fewer
 * characters. */
function outlines(qs: [number, number][][]): string {
  let d = '', at: number[] | null = null
  for (const q of qs) {
    const r = q.map(([X, Y]) => [r1(X), r1(Y)] as [number, number])
    d += at ? 'm' + nums([r1(r[0]![0] - at[0]!), r1(r[0]![1] - at[1]!)]) : 'M' + nums(r[0]!)
    let l = false
    for (let i = 1; i < r.length; i++) {
      const dx = r1(r[i]![0] - r[i - 1]![0]), dy = r1(r[i]![1] - r[i - 1]![1])
      if (!dx && !dy) continue
      const v = !dx ? 'v' + n(dy) : !dy ? 'h' + n(dx) : (l ? (dx < 0 ? '' : ' ') : 'l') + nums([dx, dy])
      d += v; l = !!dx && !!dy
    }
    d += 'z'; at = r[0]!
  }
  return d
}
export const poly = (arr: number[][], fill: string) => `<path fill="${fill}" d="${outlines([arr.map(([x, y, z]) => P(x!, y!, z ?? 0))])}"/>`
export const shade = (hex: string, f: number) => {
  const v = parseInt(hex.slice(1), 16)
  return '#' + [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.max(0, Math.min(255, Math.round(c * f))).toString(16).padStart(2, '0')).join('')
}
function box(x: number, y: number, z: number, w: number, d: number, ht: number, top: string, left: string, right: string) {
  return poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + ht], [x, y + d, z + ht]], left)
    + poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + ht], [x + w, y, z + ht]], right)
    + poly([[x, y, z + ht], [x + w, y, z + ht], [x + w, y + d, z + ht], [x, y + d, z + ht]], top)
}
const outlined = (inner: string) => `<g stroke="${shade(PAL.outline, 1.4)}" stroke-width=".8" stroke-linejoin="round">${inner}</g>`

/* ---------- the floor plan: a coworking floor that grows ---------- */
// The back strip (11 tiles deep) holds the lobby (x 0-14), Producto's room (x 14-20) and your office (x 20-32); a corridor runs in front of it
// (y 11-12); then the islands of the sessions at work, up to four per row on an even grid (7x6 tiles, the same gap
// between them and at the walls, one tile between rows), up to 16 per floor. A floor is as deep as its rows; the 17th
// session opens the next floor.
const W = 32, STRIP = 11, ISLES_Y = 12, STEP_Y = 7, ISLE_W = 7, ISLE_D = 6, PER_ROW = 4
export const PER_FLOOR = 16
export const depthOf = (rows: number) => ISLES_Y + Math.max(1, rows) * STEP_Y
/** The picture's frame for a floor of `rows` rows: every layer of that floor uses it, so they stack exactly. */
export function viewOf(rows: number) {
  const H = depthOf(rows), [x0] = P(0, H), [x1] = P(W, 0), [, y0] = P(0, 0, 5.2), [, y1] = P(W, H, -0.6)
  return { x: x0 - 16, y: y0 - 8, w: x1 - x0 + 32, ht: y1 - y0 + 16 }
}
/** Whether an office is on the map: awake and not idle (an office from another floor comes along `away`). */
export const present = (d: AgentvilleDept) => !d.asleep && !d.idle
/** Rows of islands a world's floor uses (its view carries them; a whole world counts floor 0): the rows its rooms take. */
export const rowsOf = (w: AgentvilleWorld, floor = 0) => w.rows ?? Math.max(1, ...w.depts.filter((d) => !d.away && (d.floor ?? 0) === floor && d.room.length).map((d) => Math.round((d.room[3]! - ISLE_D - ISLES_Y) / STEP_Y) + 1))
const svg = (body: string, rows: number) => { const v = viewOf(rows); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(v.x)} ${n(v.y)} ${n(v.w)} ${n(v.ht)}" width="${n(v.w)}" height="${n(v.ht)}" image-rendering="pixelated" style="image-rendering:pixelated">${body}</svg>` } // inherited: the people's pictures stay sharp
// The store's 'svg-use' switch (on unless stored false; `/agentville dibujo simple` turns it off): a shape the floor
// repeats (a chair, a desk, a plant, an island's floor, a bubble's frame) is drawn once in its picture's <defs> and
// placed with <use>; off, every copy is drawn inline as before. The page counts every character (mod-clicks 4c).
let reuse = true
export const svgUse = (on: boolean) => { reuse = on }
const shapes = new Map<string, string>() // id -> the shape drawn at the origin (its id names everything it depends on)
/** A shape placed at screen offset (X, Y): its <use>, the shape kept for pack's <defs>. */
const placeAt = (id: string, X: number, Y: number, origin: () => string) => {
  if (!shapes.has(id)) shapes.set(id, origin())
  return `<use href="#${id}"${n(X) === '0' ? '' : ` x="${n(X)}"`}${n(Y) === '0' ? '' : ` y="${n(Y)}"`}/>`
}
/** `at(x, y)` draws a shape at world (x, y): inline there, or once at the origin and moved by P(x, y) (P is linear, so
 * each corner lands within the 0.1 px rounding of where the inline one does). */
const rep = (id: string, x: number, y: number, at: (x: number, y: number) => string) => (reuse ? placeAt(id, ...P(x, y), () => at(0, 0)) : at(x, y))
const USED = /href="#([^"]+)"/g
/** Packs drawing parts, in order, into as many pictures as it takes to keep each under the Svg limit: a full floor's
 * furniture and agents need two or three. Stacked in order they draw as one picture. Each picture carries the <defs> of
 * the shapes it places, their ids prefixed by `prefix` and its index (stacked pictures never share an id). */
function pack(parts: string[], rows: number, prefix: string, wrap: (s: string) => string = (x) => x): string[] {
  const out: string[] = []
  let cur = '', ids = new Set<string>(), defs = 0
  const flush = () => {
    const p = `${prefix}${out.length}`, d = [...ids].map((id) => `<g id="${p}${id}">${shapes.get(id)}</g>`).join('')
    out.push(svg((d ? `<defs>${d}</defs>` : '') + wrap(ids.size ? cur.replace(/href="#/g, `href="#${p}`) : cur), rows))
  }
  // `defs`: what the <defs> and the prefixes add to `cur`, so a picture with its defs stays under the limit too
  const extra = (used: string[]) => [...new Set(used)].reduce((a, id) => a + (ids.has(id) ? 0 : shapes.get(id)!.length + 20), 0) + used.length * (prefix.length + 2)
  for (const s of parts) {
    const used = [...s.matchAll(USED)].map((m) => m[1]!)
    if (cur && cur.length + defs + s.length + extra(used) > SVG_LIMIT - 8192) { flush(); cur = ''; ids = new Set(); defs = 0 }
    defs += extra(used); used.forEach((id) => ids.add(id))
    cur += s
  }
  flush()
  return out
}

/* ---------- Pixel sprites (3/4 view, two tones, outline) ---------- */
const FRONT = [
  '.......oooooo.......', '.....oohhhhhhoo.....', '....ohhhhhhhhhhho...', '...ohhhhhhhhhhhhho..',
  '...ohhhhhhhhhhhHHo..', '...ohhhhhhhhhhhHHo..', '...ohssshhhhhhhHHo..', '..ossssssshhhhhHHo..',
  '..ossessssshhHHHo...', '.osssesssssSShHHo...', '..ossssssssSSShHo...', '..ossmmsssSSSSo.....',
  '...osssssSSSSo......', '....ooosssSSo.......', '.....oossSSoo.......',
  '....occcttttcCCo....', '...occccttttcCCCo...', '..occcccttttcCCCCo..', '..occccctttbcCCCCo..',
  '..occocctttbcCCoCo..', '..occocctttcCCCoCo..', '..occocctttcCCCoCo..', '..occocctttcCCCoCo..',
  '..occocctttcCCCoCo..', '..occocctttcCCCoCo..', '..occocctttcCCCoCo..', '..occoccttttcCCoCo..',
  '..okkocccccCCCCoko..', '..okkoccccCCCCCoko..', '...oooppppPPPPooo...',
]
const BACK_HEAD = ['...ohhhhhhhhhhhHHo..', '..ohhhhhhhhhhhhHHo..', '..ohhhhhhhhhhhHHHo..', '..ohhhhhhhhhhhhHHo..', '..ohhhhhhhhhhhHHo...', '..oSSssssssSSSSo....']
const BACK = FRONT.map((r, i) => (i >= 6 && i <= 11 ? BACK_HEAD[i - 6]! : i >= 15 ? r.replace(/[tb]/g, 'c') : r))
const LEGS_A = [...Array(10).fill('.....oppppoPPPPo....'), '.....offffoFFFFo....', '....offfffoFFFFFo...', '....owwwwwowwwwwo...', '....ooooooooooooo...']
const LEGS_B = [...Array(10).fill('....oppppo.oPPPPo...'), '....offffo.oFFFFo...', '...offfffo.oFFFFFo..', '...owwwwwo.owwwwwo..', '...ooooooo.ooooooo..']
const SIT = ['.oppppppppPPPPo.....', '.oppppppppPPPPo.....', '.offffooooooooo.....', '.owwwwo.............', '.oooooo.............']
const SIT_BACK = ['....oppppPPPPPo.....', '....ooooooooooo.....']
export const SPRITE_ROWS = [...FRONT, ...BACK, ...LEGS_A, ...LEGS_B, ...SIT, ...SIT_BACK]
const setCells = (rows: string[], cells: [number, number, string][]) => {
  const g = rows.map((r) => [...r])
  cells.forEach(([r, c, ch]) => { if (g[r]) g[r]![c] = ch })
  return g.map((r) => r.join(''))
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
// Role accessories: Jefe tie, Implementador headphones, Revisor visor, QA cap.
function torsoRows(role: AgentvilleRole | 'me', back: boolean): string[] {
  const rows = back ? BACK : FRONT
  if (role === 'jefe' && !back) return setCells(rows, [...range(15, 25).map((r): [number, number, string] => [r, 9, 'b']), [18, 11, 't'], [19, 11, 't']])
  if (role === 'impl') return setCells(rows, [[0, 10, 'n'], [1, 10, 'n'], [2, 11, 'n'], [3, 12, 'n'], ...range(8, 11).flatMap((r): [number, number, string][] => [[r, 12, 'n'], [r, 13, 'n'], [r, 14, 'N']])])
  if (role === 'rev' && !back) return setCells(rows, [...range(3, 10).map((c): [number, number, string] => [8, c, 'v']), ...range(2, 10).map((c): [number, number, string] => [9, c, 'V']), [8, 2, 'o'], [9, 1, 'o']])
  if (role === 'qa') {
    const cap = rows.map((r, i) => (i >= 1 && i <= 5 ? r.replace(/[hH]/g, (m) => (m === 'h' ? 'q' : 'Q')) : r))
    return back ? cap : setCells(cap, [[6, 0, 'o'], ...range(1, 6).map((c): [number, number, string] => [6, c, 'Q']), [5, 1, 'o'], [5, 2, 'o']])
  }
  return rows
}
const OUTFITS: Record<AgentvilleRole | 'me', Record<string, string>> = {
  jefe: { c: '#2f3a52', t: '#f4f4f0', p: '#262d3d', f: '#4a3324', w: '#2a1d14' },
  impl: { c: '#6a4fc4', t: '#2b2b30', p: '#2f3346', f: '#3d3a7a', w: '#eeeeee', n: '#1d1d22' },
  rev: { c: '#3f8f8a', t: '#f0ece4', p: '#3b3350', f: '#2b2b2b', w: '#e8e8e8', v: '#c6f432' },
  qa: { c: '#d94f70', t: '#ffffff', p: '#3a4a6b', f: '#f2f2f2', w: '#cfcfcf', q: '#2d6fcb' },
  me: { c: '#22252c', t: '#ffffff', p: '#2c3e50', f: '#1f1f24', w: '#f2f2f2' },
}
function colors(role: AgentvilleRole | 'me', hair: string, skin: string, badge: string): Record<string, string> {
  const c: Record<string, string> = { ...OUTFITS[role], h: hair, s: skin, b: badge }
  return {
    ...c, o: PAL.outline, e: PAL.outline, H: shade(hair, 0.7), S: shade(skin, 0.84), k: skin, m: shade(skin, 0.68),
    C: shade(c.c!, 0.72), P: shade(c.p!, 0.72), F: shade(c.f!, 0.72), Q: shade(c.q ?? '#2d6fcb', 0.72), N: shade(c.n ?? '#1d1d22', 0.7), V: shade(c.v ?? '#c6f432', 0.72),
  }
}
// One <path> per colour; coordinates are integer sprite pixels, scaled 1.25 by the caller. Each run of a colour in a row
// is its own 1-pixel-tall rectangle, as it always was (merging rows changes the anti-aliasing: seams show where colours
// meet), but each moves from where the last one ended and none closes: a fill closes it anyway.
export function rowsToPaths(rows: string[], top: number, col: Record<string, string>): string {
  const d: Record<string, string> = {}, pen: Record<string, [number, number]> = {}
  rows.forEach((row, i) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      let k = 1
      while (row[x + k] === ch) k++
      if (ch !== '.') {
        const at = pen[ch], y = top + i
        d[ch] = (d[ch] ?? '') + (at ? 'm' + nums([x - 10 - at[0], y - at[1]]) : 'M' + nums([x - 10, y])) + `h${k}v1h${-k}`
        pen[ch] = [x - 10, y + 1]
      }
      x += k
    }
  })
  return Object.entries(d).map(([ch, p]) => `<path fill="${col[ch] ?? '#ff00ff'}" d="${p}"/>`).join('')
}
// The store's 'vector-people' switch (set by the pane on each render): the people as the vector paths above, to compare.
let vector = false
export const vectorPeople = (on: boolean) => { vector = on }
const sprites = new Map<string, string>() // rows and colours -> PNG data URI, each encoded once (the 1000 last used)
/**
 * A person's body (its parts' rows, top to bottom) as one pixel-art picture (sharp: see `svg`); under the switch the
 * vector paths as before, a set per part. `flip` 0: inside a group already scaled by PX; 1 or -1 (mirrored): scaled
 * here, the picture at its drawn size (fewer characters).
 */
export function body(parts: string[][], top: number, col: Record<string, string>, flip = 0): string {
  if (vector) {
    let y = top
    const paths = parts.map((p) => { const s = rowsToPaths(p, y, col); y += p.length; return s }).join('')
    return flip ? `<g transform="scale(${flip * PX} ${PX})">${paths}</g>` : paths
  }
  const rows = parts.flat(), key = rows.join('/') + JSON.stringify(col), k = flip ? PX : 1 // PX is 5/4: these products of whole numbers are exact
  const uri = sprites.get(key) ?? spritePng(rows, col)
  sprites.delete(key); sprites.set(key, uri) // most recent last: the oldest goes first
  if (sprites.size > 1000) sprites.delete(sprites.keys().next().value!)
  return `<image${flip < 0 ? ' transform="scale(-1 1)"' : ''} x="${-10 * k}" y="${top * k}" width="${rows[0]!.length * k}" height="${rows.length * k}" href="${uri}"/>`
}
const totalRows = (posture: AgentvillePosture, back: boolean) => (posture === 'sit' ? (back ? 32 : 35) : 44)
const PX = 1.25

/* ---------- house plan ---------- */
/** The even grid for n islands: r rows of up to c, with the same gap g between islands and at the walls. */
// `g` is the even gap; islands sit on whole tiles so their tiles line up with the house's: the gap between islands is
// g rounded (`gi`), and what is left goes to the two outer margins, the left one rounded down (they differ by 1 at most).
export function gridOf(n: number) {
  const r = Math.max(1, Math.ceil(n / PER_ROW)), c = Math.max(1, Math.ceil(Math.max(1, n) / r)), g = (W - ISLE_W * c) / (c + 1)
  return { r, c, g, gi: Math.max(1, Math.round(g)) }
}
/**
 * The rectangles [x0, y0, x1, y1] of n islands, in order: rows fill left to right, only the last row may be short and
 * it is centred with the same inner gap. Slots give the order only, never the place.
 */
export function isleRooms(n: number): number[][] {
  const { c, gi } = gridOf(n)
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / c), inRow = Math.min(c, n - row * c), left = Math.floor((W - inRow * ISLE_W - (inRow - 1) * gi) / 2)
    const x = left + (i % c) * (ISLE_W + gi), y = ISLES_Y + row * STEP_Y
    return [x, y, x + ISLE_W, y + ISLE_D]
  })
}
// A family's cells from its parent's: the parent, then its child rooms in the right column, then under the parent.
const FAM_CELLS = [[0, 0], [1, 0], [1, 1], [0, 1]]
/** Most child rooms a family draws; the rest show as "+N" on its sign. */
export const FAM_MAX = 3
/**
 * The rooms of a floor's units, in slot order: `ks[i]` is a unit's child rooms (0, a single island). Without families
 * this is isleRooms. With one, a family of k = 1 takes 2x1 cells and of k = 2-3 2x2; units go first-fit row-major on a
 * c-column grid (the even gap of rule 2), rows left-aligned. Each unit's rooms: its parent's first, then its children.
 */
// A team office's block comes as its size in cells [w, h]; its rooms are then all its cells, row by row.
export function unitRooms(ks: (number | [number, number])[]): number[][][] {
  if (ks.every((k) => !k)) return isleRooms(ks.length).map((q) => [q])
  const size = ks.map((k) => (Array.isArray(k) ? k : k === 0 ? [1, 1] : k === 1 ? [2, 1] : [2, 2])), n = size.reduce((a, [w, ht]) => a + w! * ht!, 0)
  const r = Math.max(Math.ceil(n / PER_ROW), ...size.map((q) => q[1]!)), c = Math.min(PER_ROW, Math.max(Math.ceil(n / r), 2))
  const gi = Math.max(1, Math.round((W - ISLE_W * c) / (c + 1))), left = Math.floor((W - c * ISLE_W - (c - 1) * gi) / 2)
  const used = new Set<string>(), cell = (col: number, row: number) => { const x = left + col * (ISLE_W + gi), y = ISLES_Y + row * STEP_Y; return [x, y, x + ISLE_W, y + ISLE_D] }
  return ks.map((k, i) => {
    const [w, ht] = size[i] as [number, number], all = Array.from({ length: w * ht }, (_, j) => [j % w, Math.floor(j / w)])
    const fits = (col: number, row: number) => all.every(([dx, dy]) => !used.has(`${col + dx!},${row + dy!}`))
    let at = 0
    while (!fits(at % (c - w + 1), Math.floor(at / (c - w + 1)))) at++
    const col = at % (c - w + 1), row = Math.floor(at / (c - w + 1))
    all.forEach(([dx, dy]) => used.add(`${col + dx!},${row + dy!}`))
    return (Array.isArray(k) ? all : FAM_CELLS.slice(0, k + 1)).map(([dx, dy]) => cell(col + dx!, row + dy!))
  })
}
/** The column aisles of a floor: the middles of its first row's gaps, and of the margins half a tile wide or more. */
const aislesOf = (rooms: number[][]) => {
  const row = (rooms.some((q) => q[1] === ISLES_Y) ? rooms : isleRooms(1)).filter((q) => q[1] === ISLES_Y).sort((a, b) => a[0]! - b[0]!), edges = [0, ...row.flatMap((q) => [q[0]!, q[2]!]), W]
  const out: number[] = []
  for (let k = 0; k + 1 < edges.length; k += 2) if (edges[k + 1]! - edges[k]! >= 0.5) out.push((edges[k]! + edges[k + 1]!) / 2)
  return out
}
const ISLE_FLOORS = ['tienda', 'recetas', 'blog', 'portafolio']
const COLORS = ['#3b82c4', '#2f9e6e', '#e0663d', '#8a8f9c', '#8a63c9', '#c9a227', '#2a9d9a', '#d1497b']
// The grid: an agent always stands on exactly one tile, at its centre (tile + 0.5). Desks are 2x1 tiles at integer
// corners and an agent sits on the tile in front of a desk's right half.
const SEATS: Record<AgentvilleRole, [number, number]> = { jefe: [1, 1], impl: [4, 1], rev: [1, 4], qa: [4, 4] }
// Your office's queue: one file, in order of arrival. The first stands at your desk (the case being attended);
// the rest wait behind, one tile each, and move up as you answer. Shared by every floor.
const QUEUE = [[24.5, 4.5], [24.5, 5.5], [24.5, 6.5], [24.5, 7.5], [24.5, 8.5], [24.5, 9.5]]
const CALL = [27.5, 4.5]
// What an agent at rest does in the lobby: chat on the sofas, drink coffee standing, or play on the PS5 from a floor
// cushion. Each agent prefers one, fixed by its id; when that corner is full it takes any free place and does what
// that place is for.
type LobbyKind = 'chat' | 'coffee' | 'game'
const LOBBY_KINDS: LobbyKind[] = ['chat', 'coffee', 'game']
const sofa = (sx: number, y: number) => [0, 1, 2].map((k) => ({ x: sx + 0.5 + k, y: y + 0.6, sit: true, kind: 'chat' as const, facing: (k ? 'fl' : 'fr') as AgentvilleFacing }))
// Producto's room is its own office between the lobby and yours, the strip's full depth: every lobby spot lies left
// of it (walks reach a spot straight up from the corridor).
export const PROD_ROOM = [14, 0, 20, 11]
export const LOBBY_SPOTS: { x: number; y: number; sit?: boolean; kind: LobbyKind; facing: AgentvilleFacing }[] = [
  ...sofa(3, 8), ...sofa(3, 4),
  ...[8.5, 9.5, 7.5].map((x) => ({ x, y: 2.6, sit: true, kind: 'game' as const, facing: 'br' as const })),
  // coffee in hand: by the machine and around the room, mostly in pairs facing each other (the first ones, taken
  // first, chosen so the resting people of a usual floor add few click bands)
  ...([[2.5, 2.5, 'fr'], [3.5, 2.5, 'fl'], [11.5, 4.5, 'fl'], [11.5, 8.5, 'fl'], [10.5, 6.5, 'fr'], [9.5, 6.5, 'fl'], [8.5, 9.5, 'fr'], [10.5, 4.5, 'fr'], [10.5, 8.5, 'fr'], [1.5, 9.5, 'fl'], [1.5, 6.5, 'fr']] as const)
    .map(([x, y, facing]) => ({ x, y, kind: 'coffee' as const, facing })),
]
const SPEED = 3.2 // tiles per second
const CORRIDOR = STRIP + 0.5
const zoneAt = (x: number, y: number) => (y < STRIP ? (x < 20 ? 'lobby' : 'office') : 'hall')
// Leaving a place on the islands: up to the aisle above its row, along it to the nearest column aisle, up to the
// corridor (from an old desk after a reflow too). The strip is open floor: from there anyone walks straight.
// An aisle that runs through a team office's block on the way up is skipped (none left: any aisle).
function exitPath(p: { x: number; y: number }, aisles: number[], teams: number[][] = []): number[][] {
  if (p.y < STRIP + 1) return []
  const row = Math.max(0, Math.floor((p.y - ISLES_Y) / STEP_Y)), gap = ISLES_Y + row * STEP_Y - 0.5
  const free = aisles.filter((x) => !teams.some((r) => x > r[0]! && x < r[2]! && r[1]! < gap)), pool = free.length ? free : aisles
  const aisle = pool.reduce((best, x) => (Math.abs(x - p.x) < Math.abs(best - p.x) ? x : best), pool[0]!)
  return [[p.x, gap], [aisle, gap], [aisle, CORRIDOR]]
}
const dedupe = (out: number[][]) => out.filter((q, i) => i === 0 || Math.hypot(q[0]! - out[i - 1]![0]!, q[1]! - out[i - 1]![1]!) > 0.01)
type Pt = { x: number; y: number }
const inside = (p: Pt, r: number[]) => p.x > r[0]! && p.x < r[2]! && p.y > r[1]! && p.y < r[3]!
// A team office's free lanes: its left column (x = ox + 0.5) and, under each row of desks, that row's tapete line
// (y = oy + 3.5 + ROW_PITCH k). From a point to its row's line, then along it to the left lane; nothing there is a desk.
function laneLeg(p: Pt, room: number[]): number[][] {
  const lane = room[0]! + 0.5
  if (Math.abs(p.x - lane) < 0.01) return []
  const line = room[1]! + 3.5 + ROW_PITCH * Math.max(0, Math.floor((p.y - room[1]! - 1) / ROW_PITCH))
  return [[p.x, line], [lane, line]]
}
function teamRoute(from: Pt, to: Pt, room: number[]): number[][] {
  const a = laneLeg(from, room), b = laneLeg(to, room)
  if (a.length && b.length && a[0]![1] === b[0]![1]) return dedupe([a[0]!, [to.x, b[0]![1]!], [to.x, to.y]]) // one line: along it
  return dedupe([...a, ...b.reverse(), [to.x, to.y]])
}
/** Whether the segment a-b enters the rect r (x0, y0, x1, y1). */
const cuts = (a: Pt, b: Pt, r: number[]) => {
  let t0 = 0, t1 = 1
  for (const [p, d, lo, hi] of [[a.x, b.x - a.x, r[0]!, r[2]!], [a.y, b.y - a.y, r[1]!, r[3]!]] as const) {
    if (Math.abs(d) < 1e-9) { if (p <= lo || p >= hi) return false; continue }
    const u = (lo - p) / d, v = (hi - p) / d
    t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v))
    if (t0 >= t1) return false
  }
  return true
}
// `doors`: the child rooms entered through the door on their top edge (familyParts), walked to along the place's row.
export function route(from: Pt, to: Pt, aisles: number[], teams: number[][] = [], doors: number[][] = []): number[][] {
  const tf = teams.find((r) => inside(from, r)), tt = teams.find((r) => inside(to, r))
  if (tf && tf === tt) return teamRoute(from, to, tf)
  // Out of a team office: up its left lane to the aisle above it, then as from any island; out of a child room under
  // its parent's row: along the place's row to its door's column, then up.
  const viaDoor = (p: Pt) => { const r = doors.find((room) => inside(p, room)), at = r ? { x: r[0]! + DOOR + 0.5, y: p.y } : p; return [...(r ? [[at.x, at.y]] : []), ...exitPath(at, aisles, teams)] }
  const out1 = (p: Pt, r?: number[]) => (r ? [...laneLeg(p, r), [r[0]! + 0.5, r[1]! - 0.5], ...exitPath({ x: r[0]! + 0.5, y: r[1]! }, aisles, teams).slice(1)] : viaDoor(p))
  // The strip's places are reached along the corridor, straight up from it: no walk cuts through Producto's glass
  // (a straight line within the lobby that would cross it goes round by the corridor too).
  // Out of Producto's room: down below its front chairs, along to its door and out to the corridor.
  const up = (p: Pt) => (inside(p, PROD_ROOM) ? [[p.x, PROD_IN], [PROD_DOOR[0]!, PROD_IN], [PROD_DOOR[0]!, CORRIDOR]] : p.y < STRIP ? [[p.x, CORRIDOR]] : [])
  const strip = from.y < STRIP && to.y < STRIP && zoneAt(from.x, from.y) === zoneAt(to.x, to.y) && !cuts(from, to, PROD_ROOM)
  const out = [...out1(from, tf), ...(strip ? [] : up(from)), ...(strip ? [] : up(to).reverse()), ...out1(to, tt).reverse(), [to.x, to.y]]
  return dedupe(out)
}

const deptOf = (w: AgentvilleWorld, a: AgentvilleAgent) => w.depts.find((d) => d.id === a.dept)!
// A team office seats each agent at its own desk (none: it has no seat); any other office by role.
const deskSpot = (w: AgentvilleWorld, a: AgentvilleAgent) => {
  const d = deptOf(w, a)
  if (d.desks) { const k = d.desks.find((q) => q.id === a.id); return k ? { x: k.x + 1.5, y: k.y + 1.5 } : null }
  const [ox, oy] = d.room as [number, number], [dx, dy] = SEATS[a.role]
  return { x: ox + dx + 1.5, y: oy + dy + 1.5 }
}
type Goal = { x: number; y: number; facing: AgentvilleFacing; posture: AgentvillePosture }

/* ---------- the office bureaucracy: teams, the secretaria, Producto ---------- */
export const SEC_KIND = 'agentville:secretary', PROD_KIND = 'agentville:product'
// The staff's ids before AW: a session still on the old text spawns these, and they keep the same job on the map.
const OLD_KINDS = new Map([['agentville:secretaria', SEC_KIND], ['agentville:producto', PROD_KIND]])
/** A subagent type, its pre-AW staff id read as today's. */
export const kindOf = (k: string) => OLD_KINDS.get(k) ?? k
const STAFF_KINDS = new Set([SEC_KIND, PROD_KIND, ...OLD_KINDS.keys()])
/** A subagent's team from what it was sent to do: "<Letter>: <name>", the name 1 to 60 characters. */
export function teamOf(goal: unknown): { letter: string; name: string } | null {
  const m = typeof goal === 'string' ? /^([A-Z])\s*:\s*(\S.{0,59})$/.exec(goal) : null
  return m ? { letter: m[1]!, name: m[2]!.trim() } : null
}
// The secretaria's desk in your office, beside the queue lane: her seat, her two visitor spots, Producto's door (in
// the corridor, in front of its glass) and the visitor's chair at the head of Producto's table, facing it.
export const SEC_DESK = [26, 7], SEC_SEAT = [27.5, 8.5], SEC_VISIT = [[26.5, 9.5], [27.5, 9.5]], PROD_DOOR = [16.5, 11.5], PROD_SEAT = [19.4, 6.7]
// The row walks inside Producto's room keep to, below its front chairs.
const PROD_IN = 9.5
export const SEC_ID = 'staff-sec'
// Your office's glass on its open edges (x0, y0, x1, y1, as lines): the side toward the lobby below the partition, and
// the front with its door from x 24 to 29, wide enough for every walk in and out (the queue lane at x 24.5, the
// secretaria's visitor spots at 26.5 and 27.5, her lanes at 27.5 and 28.5).
export const DESK_GLASS = [[20, 8, 20, STRIP], [20, STRIP, 24, STRIP], [29, STRIP, W, STRIP]]
// Producto's glass, the same way: its side toward the lobby and its front, the door a gap from x 16 to 17.
export const PROD_GLASS = [[14, 0, 14, STRIP], [14, STRIP, 16, STRIP], [17, STRIP, 20, STRIP]]
// The secretaria is Gem, the tour's guide: her hair and skin are the guide's face colours (tour.ts FACE).
const GEM_HAIR = '#7a3b1e', GEM_SKIN = '#f0c6a0'
/** A team member's visit to its Jefe (to deliver, or with a blocker) lasts this long once there. */
export const VISIT_MS = 6000
/** Whoever starts to ask you something stops this long at the secretaria's visitor spot on its way into your queue. */
export const SEC_STOP_MS = 3000
/** Finished team members keep their desk this long; the secretaria's walks last at most STAFF_MS. */
export const TEAM_KEEP = 10 * 60000, STAFF_MS = 120000
// A visit that lasts while something runs is renewed by every heartbeat read (every 3 s) for this long.
const WHILE_MS = 60000
const visitSpot = (room: number[]) => ({ x: room[0]! + 2.5, y: room[1]! + 3.5 })
const toward = (from: number[], to: number[]): AgentvilleFacing => facingOf(to[0]! - from[0]!, to[1]! - from[1]!)
const isAt = (v: { x: number; y: number }, q: number[]) => Math.abs(q[0]! - v.x) < 0.01 && Math.abs(q[1]! - v.y) < 0.01
// A visitor sits only in Producto's chair.
const visitGoal = (v: { x: number; y: number }, target: number[]): Goal => ({ x: v.x, y: v.y, facing: toward([v.x, v.y], target), posture: isAt(v, PROD_SEAT) ? 'sit' : 'stand' })
// Where whoever stands at a spot looks: a Jefe's visitor at its Jefe, a secretaria's at her, Producto's visitor along
// the table.
function lookAt(v: { x: number; y: number }): number[] {
  if (isAt(v, PROD_SEAT)) return [v.x - 1, v.y]
  if (SEC_VISIT.some((q) => isAt(v, q))) return SEC_SEAT
  return [v.x, v.y - 1]
}
function goalFor(w: AgentvilleWorld, a: AgentvilleAgent, now: number): Goal {
  if (!a.dept) return { x: SEC_SEAT[0]!, y: SEC_SEAT[1]!, facing: 'br', posture: 'sit' } // the secretaria never leaves her desk
  if (a.state === 'esperando') {
    if (a.visit && a.visit.until > now) return visitGoal(a.visit, lookAt(a.visit)) // its stop at the secretaria
    const q = w.agents.filter((x) => x.state === 'esperando').sort((m, k) => m.since - k.since).indexOf(a)
    const [x, y] = QUEUE[Math.min(q, QUEUE.length - 1)]!
    return { x: x!, y: y!, facing: 'br', posture: 'stand' }
  }
  if (a.calledUntil > now) return { x: CALL[0]!, y: CALL[1]!, facing: 'bl', posture: 'stand' }
  if (a.visit && a.visit.until > now) return visitGoal(a.visit, lookAt(a.visit))
  const desk = deptOf(w, a).room.length ? deskSpot(w, a) : null
  // A team office's subagents keep their desk when they finish (lights off); everyone else rests in the lobby.
  const keeps = !!deptOf(w, a).desks && a.role !== 'jefe' && a.state === 'terminado'
  if (((a.state === 'inactivo' || a.state === 'terminado') && !keeps) || !desk) {
    if (a.lobbySpot < 0 || w.agents.some((x) => x !== a && x.lobbySpot === a.lobbySpot)) {
      const taken = new Set(w.agents.filter((x) => x !== a).map((x) => x.lobbySpot))
      const free = LOBBY_SPOTS.map((_, i) => i).filter((i) => !taken.has(i)), want = LOBBY_KINDS[(hash(a.id) >>> 6) % LOBBY_KINDS.length]
      a.lobbySpot = free.find((i) => LOBBY_SPOTS[i]!.kind === want) ?? free[0] ?? w.agents.indexOf(a) % LOBBY_SPOTS.length // shortcut: lobby full, people share a spot
    }
    const s = LOBBY_SPOTS[a.lobbySpot]!
    return { x: s.x, y: s.y, facing: s.facing, posture: s.sit ? 'sit' : 'stand' }
  }
  return { ...desk, facing: 'br', posture: 'sit' }
}
const pathLen = (p: number[][]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0]! - p[i]![0]!, q[1]! - p[i]![1]!), 0)
export function posAt(a: AgentvilleAgent, now: number): { x: number; y: number } {
  const w = a.walk
  if (!w) return { x: a.x, y: a.y }
  let left = Math.min(1, Math.max(0, (now - w.start) / 1000 / w.dur)) * pathLen(w.pts)
  for (let i = 1; i < w.pts.length; i++) {
    const [x0, y0] = w.pts[i - 1] as [number, number], [x1, y1] = w.pts[i] as [number, number], l = Math.hypot(x1 - x0, y1 - y0)
    if (left <= l || i === w.pts.length - 1) { const f = l ? Math.min(1, left / l) : 1; return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f } }
    left -= l
  }
  return { x: a.x, y: a.y }
}
const facingOf = (dx: number, dy: number): AgentvilleFacing => (((dx + dy) > 0.001 ? 'f' : 'b') + ((dx - dy) < 0 ? 'l' : 'r')) as AgentvilleFacing

// `at`: when the walk starts (a visit that ended walks back from its end, whenever the world is next read).
function retarget(w: AgentvilleWorld, a: AgentvilleAgent, now: number, instant = false, at = now) {
  if (!(a.state === 'inactivo' || a.state === 'terminado')) a.lobbySpot = -1
  const g = goalFor(w, a, now), here = posAt(a, at)
  if (instant || Math.hypot(here.x - g.x, here.y - g.y) < 0.05) { a.x = g.x; a.y = g.y; a.walk = null; a.facing = g.facing; a.posture = g.posture; return }
  const end = a.walk?.pts[a.walk.pts.length - 1]
  if (end && Math.hypot(end[0]! - g.x, end[1]! - g.y) < 0.05) return // already heading there
  a.x = here.x; a.y = here.y; a.posture = 'stand'
  const pts = [[here.x, here.y], ...pathFor(w, a, here, g)]
  a.walk = { pts, start: at, dur: Math.max(0.3, pathLen(pts) / SPEED) }
}
function pathFor(w: AgentvilleWorld, a: AgentvilleAgent, here: Pt, g: Pt): number[][] {
  const floor = deptOf(w, a).floor ?? 0, on = w.depts.filter((d) => (d.floor ?? 0) === floor && d.room.length), aisles = aislesOf(on.map((d) => d.room)), teams = on.filter((d) => d.desks).map((d) => d.room)
  const doors = on.filter((d) => { const p = d.parent && on.find((q) => q.id === d.parent); return p && doorOnTop(d.room, p.room) }).map((d) => d.room)
  // Into your queue past the secretaria: from outside your office, or from her visitor spot after its stop there
  // (secStop), by that spot and along its row to the queue lane. The walk to the spot itself is a plain route.
  const spot = (p: Pt) => Math.hypot(p.x - SEC_VISIT[0]![0]!, p.y - SEC_VISIT[0]![1]!) < 0.05
  if (a.state === 'esperando' && !spot(g) && (spot(here) || !(here.y < STRIP && here.x >= 20))) return dedupe([...route(here, { x: SEC_VISIT[0]![0]!, y: SEC_VISIT[0]![1]! }, aisles, teams, doors), [QUEUE[0]![0]!, SEC_VISIT[0]![1]!], [g.x, g.y]])
  return route(here, g, aisles, teams, doors)
}
// An agent that starts to ask from outside your office stops SEC_STOP_MS at the secretaria's visitor spot, facing her,
// before your queue: once per wait (the stop is kept as set until the wait ends), none for one already in your office.
function secStop(w: AgentvilleWorld, a: AgentvilleAgent, old: AgentvilleAgent | undefined, now: number): AgentvilleVisit | undefined {
  const spot = xy(SEC_VISIT[0]!)
  if (old?.state === 'esperando') return old.visit && old.visit.x === spot.x && old.visit.y === spot.y ? old.visit : undefined
  const here = posAt(a, now)
  if (!old || (here.y < STRIP && here.x >= 20)) return undefined
  return { ...spot, until: now + (pathLen([[here.x, here.y], ...pathFor(w, a, here, spot)]) / SPEED) * 1000 + SEC_STOP_MS }
}
const everyone = (w: AgentvilleWorld) => (w.staff ? [...w.agents, w.staff.sec] : w.agents)
// Agents whose walk has ended stand where it ended, then take their resting pose or walk on to a goal that changed
// meanwhile; a call or a visit that ended sends them back.
export function settle(w: AgentvilleWorld, now: number) {
  everyone(w).forEach((a) => {
    for (let i = 0; i < 3; i++) { // a walk back that already ended by now is finished too
      if (a.walk && now - a.walk.start >= a.walk.dur * 1000) {
        const end = a.walk.pts[a.walk.pts.length - 1]!, ended = a.walk.start + a.walk.dur * 1000
        a.walk = null; a.x = end[0]!; a.y = end[1]!
        const g = goalFor(w, a, now)
        if (Math.hypot(g.x - a.x, g.y - a.y) < 0.05) { a.x = g.x; a.y = g.y; a.facing = g.facing; a.posture = g.posture; break }
        retarget(w, a, now, false, Math.max(ended, a.visit && a.visit.until <= now ? a.visit.until : 0))
      } else if (!a.walk && a.calledUntil && a.calledUntil <= now) { a.calledUntil = 0; retarget(w, a, now); break }
      // Back from its end only while it still stands at the visit (one long gone, e.g. a stop before your queue, walks from now).
      else if (!a.walk && a.visit && a.visit.until <= now) { retarget(w, a, now, false, Math.hypot(a.x - a.visit.x, a.y - a.visit.y) < 0.05 ? a.visit.until : now); if (!a.walk) break }
      else break
    }
  })
}

/* ---------- model ---------- */
const HAIRS = ['#3b2a1e', '#e2b04a', '#1f1d1d', '#a5532b', '#6b4a2f', '#c9c2b8', '#2e2a4a']
const SKINS = ['#f1c9a5', '#d8a47f', '#a8714d', '#f5d6c0', '#c48a62']
/** Bumped whenever places or the world's shape change: a stored world of another version is replaced. */
export const WORLD_VERSION = 12
/** A sample house for tests and previews: four sessions with full teams, as heartbeats would describe them. */
export const initialWorld = (now: number): AgentvilleWorld => worldFromBeats(null, demoBeats(now), now)
/** The sample house's heartbeats. */
export function demoBeats(now: number): Beat[] {
  const min = (m: number) => now - m * 60000
  const team = (id: string, name: string, at: number, notes: [string, boolean][], agents: [AgentvilleRole, AgentvilleStateName, string, number, string?][]): Beat => ({
    id, name, at, ended: false, notes: notes.map(([t, done]) => ({ t, done })),
    agents: Object.fromEntries(agents.map(([role, state, activity, ago, cmd], i) => [i === 0 ? MAIN : `${id}-${role}`, { role, kind: role, state, activity, cmd: cmd ?? null, since: min(ago) }])),
  })
  return [
    team('tienda', 'Tienda online', now - 1, [['Filtrar productos por talla', true], ['Migrar tabla de pedidos', false], ['Probar en móvil', false]], [
      ['jefe', 'trabajando', 'Coordina 3 pasos, 1 bloqueado', 6], ['impl', 'esperando', 'Te lleva un permiso', 2, 'pnpm db migrate'], ['rev', 'inactivo', 'Espera cambios', 14], ['qa', 'inactivo', 'Sin tarea', 31]]),
    team('recetas', 'App de recetas', now - 2, [['Calcular porciones', true], ['Revisar diff de porciones.ts', false]], [
      ['jefe', 'leyendo', 'Read docs/recetas.md', 3], ['impl', 'trabajando', 'Edit src/recetas/porciones.ts', 1], ['rev', 'trabajando', 'Revisa el diff', 4], ['qa', 'esperando', 'Te lleva un permiso', 5, 'pnpm test:e2e']]),
    team('blog', 'Blog personal', now - 3, [['Publicar entrada nueva', true], ['Fechas en español', false]], [
      ['jefe', 'trabajando', 'Delega la corrección', 2], ['impl', 'error', '3 pruebas fallan', 7], ['rev', 'leyendo', 'Read post-parser.ts', 3], ['qa', 'inactivo', 'Sin tarea', 44]]),
    team('portafolio', 'Portafolio', now - 4, [['Galería de proyectos lista', true]], [
      ['jefe', 'terminado', 'Entregó la galería', 22], ['impl', 'terminado', 'Cambios guardados', 0.5], ['rev', 'trabajando', 'Revisa la galería', 3], ['qa', 'leyendo', 'Read tests/galeria.spec.ts', 2]]),
  ]
}
const clone = (w: AgentvilleWorld): AgentvilleWorld => JSON.parse(JSON.stringify(w))
/** A role as the pane names it: the main agent of a session in a family is its Encargado (Lead), under the parent's Jefe. */
export const roleName = (role: AgentvilleRole, d?: AgentvilleDept) => (role === 'jefe' && d?.parent ? t('role.lead') : ROLES[role])
const who = (w: AgentvilleWorld, a: AgentvilleAgent) => `${roleName(a.role, deptOf(w, a))} · ${deptOf(w, a).name}`
function log(w: AgentvilleWorld, now: number, text: string) { w.log = [{ at: now, text }, ...w.log].slice(0, 20) }

// Sessions not heard from in this long are gone (a crashed session never says it ended); finished subagents leave
// after a minute.
const LIVE_MS = 12 * 3600000, GONE_MS = 60000
// A session the app put to sleep (its process ended, reason `other`) is still a chat in your sidebar: it keeps its
// island, lights off. One closed for good (/clear, /exit, logout, another resumed in its place), or archived in the
// app, leaves.
const GONE_FOR_GOOD = new Set(['clear', 'resume', 'logout', 'prompt_input_exit'])
export const isLive = (b: Beat, now: number) => !b.archived && (b.ended ? !GONE_FOR_GOOD.has(b.endReason ?? 'other') && now - b.at < SLEEP_MS : now - b.at < LIVE_MS)
const hash = (t: string) => [...t].reduce((ht, c) => (ht * 31 + c.charCodeAt(0)) >>> 0, 7)
/** An empty floor: the lobby and your office, no islands yet. */
export const emptyWorld = (now: number) => worldFromBeats(null, [], now)
// A heartbeat's question and suggested sessions, checked again as read: any program can write a beat file, and a reply's
// text may become your prompt. Anything out of shape is dropped (the whole question when its id or text is); a reply
// that could not be sent exactly as it shows is only shown.
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : '')
const line = (v: unknown, max: number) => str(v, max).replace(/\s+/g, ' ').trim()
export function askOfBeat(x: unknown): AgentvilleAsk | undefined {
  const a = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>, id = str(a.id, 100), q = str(a.q, 300).trim()
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !q) return undefined
  const replies = (Array.isArray(a.replies) ? a.replies.slice(0, 4) : []).flatMap((r) => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>, label = line(o.label, 40), text = str(o.text, 400)
    if (!label) return []
    const action = (APP_ACTIONS as readonly unknown[]).includes(o.action) ? (o.action as string) : undefined
    return o.app === true || action || !canSend(text) ? [{ label, text, app: true as const, ...(action ? { action } : {}) }] : [{ label, text }]
  })
  return { id, q, replies, ...(a.blocked === true ? { blocked: true as const } : {}) }
}
/** The suggested sessions a heartbeat shows: an app task id, a title with nothing hidden in it (it goes into a prompt),
 * under OFFER_TTL old. */
export const offersOfBeat = (x: unknown, now: number): AgentvilleOffer[] => (Array.isArray(x) ? x : []).flatMap((o) => {
  const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>, id = str(r.id, 45), title = line(r.title, 80)
  return /^task_[A-Za-z0-9]{4,40}$/.test(id) && title && !HIDDEN.test(str(r.title, 80)) && !/\p{Cc}/u.test(str(r.title, 80)) && typeof r.at === 'number' && now - r.at < OFFER_TTL ? [{ id, title, brief: line(r.brief, 160) }] : []
})
/**
 * The house as the sessions' heartbeats describe it: every live session has a place (a slot), 16 per floor; a session
 * keeps it while it lives and a newcomer takes the first free one, so floors fill in order and grow. The slot is the
 * order only: the sessions at work (not asleep, not idle) get an island on their floor's even grid, in slot order.
 * Each agent sits at its desk by role. Agents already in `prev` keep their place and walk to their new one; a change of
 * state goes to the log. `hidden`: the marks /agentville refresh left (a session id: its last beat then).
 */
// A hook's whole budget is 10 s: a hold end a session wrote past that from its wait's start, or from now, is a bad or
// hostile write.
const HELD_MAX = 10000
export function worldFromBeats(prev: AgentvilleWorld | null, beats: Beat[], now: number, hidden: Record<string, number> = {}): AgentvilleWorld {
  const live = beats.filter((b) => isLive(b, now)).sort((x, y) => y.at - x.at)
  const place = new Map<string, number>() // floor * 16 + slot
  // The island each session claimed (claimSlot) wins, an awake one over a sleeping or idle one, then the smaller id;
  // older copies of the mod claim none.
  const away = (b: Beat) => (b.ended || isIdle(b, now, hidden) ? 1 : 0)
  for (const b of [...live].sort((x, y) => away(x) - away(y) || (x.id < y.id ? -1 : 1))) if (b.slot !== undefined && ![...place.values()].includes(b.slot)) place.set(b.id, b.slot)
  const claimed = new Set(place.values())
  prev?.depts.forEach((d) => { const g = (d.floor ?? 0) * PER_FLOOR + (d.slot ?? 0); if (!place.has(d.id) && !claimed.has(g) && live.some((b) => b.id === d.id)) place.set(d.id, g) })
  const taken = new Set(place.values())
  let next = 0
  // awake sessions first (a stable sort: newest first within each), so idle ones never push them to the next floor
  ;[...live].sort((x, y) => away(x) - away(y)).forEach((b) => { if (place.has(b.id)) return; while (taken.has(next)) next++; place.set(b.id, next); taken.add(next) })
  const seen = new Map<string, number>()
  const depts: AgentvilleDept[] = [...live].sort((x, y) => place.get(x.id)! - place.get(y.id)!).map((b) => {
    const g = place.get(b.id)!, slot = g % PER_FLOOR, k = (seen.get(b.name) ?? 0) + 1, ask = askOfBeat(b.ask), offers = offersOfBeat(b.offers, now)
    seen.set(b.name, k)
    return {
      id: b.id, name: k > 1 ? `${b.name} ${k}` : b.name, task: b.agents[MAIN]?.activity ?? '', color: COLORS[g % COLORS.length]!, room: [],
      floor: Math.floor(g / PER_FLOOR), slot, notes: b.notes, steps: b.steps ?? [], bg: (b.bg ?? []).slice(-5), chat: b.chat ?? [], usage: b.usage, tools: b.tools,
      ...(b.ended ? { asleep: true as const } : isIdle(b, now, hidden) ? { idle: true as const } : {}), ...(b.openSteps ? { openSteps: b.openSteps } : {}),
      ...(ask ? { ask } : {}), ...(offers.length ? { offers } : {}),
      ...(isMod(b.mod) ? { mod: b.mod } : {}), ...(isMod(b.syncStuck) ? { syncStuck: b.syncStuck } : {}),
      ...(chatUrl(b.local) ? { local: b.local } : {}),
    }
  })
  // Families: a session started from another (beat.parent) belongs to its root's office, through at most 3 links
  // among live sessions (a grandchild joins the root's); a cycle or a parent not live leaves a normal island.
  const byId = new Map(live.map((b) => [b.id, b])), up = (b: Beat) => (b.parent ? byId.get(b.parent) : undefined)
  const rootOf = (b: Beat) => {
    const seen = new Set([b.id])
    for (let cur = up(b), i = 0; cur && i < 3; i++) {
      if (seen.has(cur.id)) return undefined
      const next = up(cur)
      if (!next) return cur.id
      seen.add(cur.id)
      cur = next
    }
    return undefined
  }
  const byDept = new Map(depts.map((d) => [d.id, d]))
  for (const b of live) { const r = rootOf(b), d = byDept.get(b.id)!; if (r) { d.parent = r; d.from = b.parent; d.color = shade(byDept.get(r)!.color, 1.3) } }
  // Each floor's units in slot order (depts are sorted by place): an office at work, or a family block (its parent,
  // lights off when it rests, and FAM_MAX children at work: any that waits for you first, then the newest; drawn in
  // slot order, so a heartbeat never swaps their cells). The rest keep no room.
  const waits = (id: string) => Object.values(byId.get(id)!.agents).some((a) => a.state === 'esperando') ? 0 : 1
  const units = new Map<number, AgentvilleDept[][]>()
  for (const d of depts) {
    if (d.parent) continue
    const kids = depts.filter((c) => c.parent === d.id && present(c)).sort((x, y) => waits(x.id) - waits(y.id) || byId.get(y.id)!.at - byId.get(x.id)!.at || (x.id < y.id ? -1 : 1))
    if (!present(d) && !kids.length) continue
    const shown = kids.slice(0, FAM_MAX).sort((x, y) => depts.indexOf(x) - depts.indexOf(y))
    if (shown.length) { d.fam = { rooms: shown.length, more: kids.length - shown.length }; shown.forEach((c) => { c.floor = d.floor }) }
    const f = d.floor ?? 0
    units.set(f, [...(units.get(f) ?? []), [d, ...shown]])
  }
  // Team offices: a session at work, not in a family, whose subagents name their team grows into one wide room (2 cells
  // wide, a cell row per row of desks), in slot order while its floor stays within MAX_CELLS cells.
  const plans = new Map(live.map((b) => [b.id, teamPlan(b, now)])), famIds = new Set(depts.flatMap((d) => (d.parent ? [d.id, d.parent] : [])))
  for (const us of units.values()) {
    const ks: (number | [number, number])[] = us.map((u) => u.length - 1)
    let total = ks.reduce((a: number, k) => a + CELLS(k as number), 0)
    us.forEach((u, i) => {
      const plan = plans.get(u[0]!.id)
      if (u.length > 1 || !plan || famIds.has(u[0]!.id)) return
      const ht = Math.min(plan.length, TEAM_ROWS) // a cell row per row of desks: 2x1, 2x2 or 2x3 cells
      if (total - 1 + 2 * ht > MAX_CELLS) return // shortcut: a floor this full keeps role desks for later team offices; upgrade with a wider grid
      ks[i] = [2, ht]; total += 2 * ht - 1
    })
    const rooms = unitRooms(ks)
    us.forEach((u, i) => (Array.isArray(ks[i]) ? teamUp(u[0]!, blockOf(rooms[i]!), plans.get(u[0]!.id)!) : u.forEach((d, j) => { d.room = rooms[i]![j]! })))
  }
  // The bureaucracy, from the subagents' own records: who consults the secretaria or Producto now, and their verdicts.
  const secRun = depts.filter((d) => running(byId.get(d.id)!, SEC_KIND)).map((d) => d.id)
  const consulting = live.find((b) => running(b, PROD_KIND)), goals = consulting ? metasOf(consulting.metas) : metasOf(live.find((b) => metasOf(b.metas).length)?.metas)
  live.forEach((b) => { const m = metasOf(b.metas); if (m.length) byDept.get(b.id)!.metas = m })
  const agents: AgentvilleAgent[] = []
  const add = (b: Beat, id: string, role: AgentvilleRole, x: BeatAgent, key: string, visit?: AgentvilleVisit) => {
    const old = prev?.agents.find((a) => a.id === id), ht = hash(id)
    agents.push({
      id, dept: b.id, role, state: x.state, activity: x.activity, cmd: x.cmd, ...(x.cmd && x.tool ? { tool: x.tool } : {}), req: x.req ?? null, ...(x.cmd && Number.isFinite(x.held) && Number.isFinite(x.since) ? { held: Math.min(x.held!, x.since + HELD_MAX, now + HELD_MAX) } : {}), answer: x.answer, said: x.said, notes: x.notes, goal: x.goal, tokens: x.tokens, model: x.model, since: x.since, calledUntil: 0, ...(key !== MAIN ? { aid: key, kind: x.kind } : {}),
      hair: HAIRS[ht % HAIRS.length]!, skin: SKINS[(ht >>> 3) % SKINS.length]!,
      x: old?.x ?? 0, y: old?.y ?? 0, facing: old?.facing ?? 'fl', posture: old?.posture ?? 'stand', lobbySpot: old?.lobbySpot ?? -1, walk: old?.walk ?? null, ...(visit ?? ended(old?.visit, now) ? { visit: visit ?? ended(old?.visit, now) } : {}),
    })
  }
  for (const b of live) {
    const d = byDept.get(b.id)!, main = b.agents[MAIN]
    const jefeVisit = jefeVisitOf(b, prev?.agents.find((a) => a.id === `${b.id}-jefe`)?.visit, secRun.indexOf(b.id), now)
    if (d.desks) {
      if (main) add(b, `${b.id}-jefe`, 'jefe', main, MAIN, jefeVisit)
      for (const [key, x] of plans.get(b.id)!.flatMap((r) => r.keys).map((k) => [k, b.agents[k]!] as const)) {
        const id = `${b.id}-${key}`, desk = d.desks.find((q) => q.id === id)
        if (!desk) { if (x.state === 'esperando') add(b, id, x.role, x, key); continue } // a member past the caps shows only to ask
        // Done or blocked: it walks to its Jefe, stays VISIT_MS, and walks back.
        const seat = { x: desk.x + 1.5, y: desk.y + 1.5 }, spot = visitSpot(d.room), until = x.since + (pathLen([[seat.x, seat.y], ...teamRoute(seat, spot, d.room)]) / SPEED) * 1000 + VISIT_MS
        add(b, id, x.role, x, key, x.state === 'terminado' || x.state === 'error' ? { ...spot, until } : undefined)
      }
      continue
    }
    const desks = new Map<AgentvilleRole, BeatAgent & { key: string }>()
    for (const [key, x] of Object.entries(b.agents)) {
      if (key !== MAIN && ((x.state === 'terminado' && now - x.since > GONE_MS) || STAFF_KINDS.has(x.kind))) continue // the secretaria and Producto take no desk
      const had = desks.get(x.role)
      if (!had || x.since > had.since) desks.set(x.role, { ...x, key }) // shortcut: one desk per role, the latest subagent takes it; add desks if teams grow
    }
    for (const [role, x] of desks) add(b, `${b.id}-${role}`, role, x, x.key, role === 'jefe' ? jefeVisit : undefined)
  }
  const staff: AgentvilleStaff = {
    sec: { id: SEC_ID, dept: '', role: 'qa', state: 'trabajando', activity: '', cmd: null, req: null, since: 0, calledUntil: 0, hair: GEM_HAIR, skin: GEM_SKIN, x: SEC_SEAT[0]!, y: SEC_SEAT[1]!, facing: 'br', posture: 'sit', lobbySpot: -1, walk: null },
    goals,
  }
  const w: AgentvilleWorld = { v: WORLD_VERSION, depts, agents, log: prev?.log ?? [], allow: [], staff }
  settle(w, now)
  for (const a of agents) {
    const old = prev?.agents.find((o) => o.id === a.id)
    if (old && old.state !== a.state) log(w, now, `${who(w, a)}: ${STATES[a.state].label.toLowerCase()}${a.state === 'esperando' && a.cmd ? ' ' + a.cmd : ''}`)
    if (a.state === 'esperando') { const v = secStop(w, a, old, now); if (v) a.visit = v; else delete a.visit } // no other visit while it asks
    retarget(w, a, now, !old) // a newcomer appears at its place; the rest walk there
  }
  return w
}
const xy = (p: number[]) => ({ x: p[0]!, y: p[1]! })
// A visit no longer called for ends now (or when it was to): its walk back starts then, never earlier.
const ended = (v: AgentvilleVisit | undefined, now: number) => (v ? { ...v, until: Math.min(v.until, now) } : undefined)
const CELLS = (k: number) => (k === 0 ? 1 : k === 1 ? 2 : 4)
/** A floor holds at most 24 island cells: team offices grow only while it stays within. */
export const MAX_CELLS = 24
/** At most this many rows of desks in a team office, and of desks per row; the rest show as "+N" on the last label. */
export const TEAM_ROWS = 3, TEAM_SEATS = 3
/** Tiles from one row of desks to the next in a team office: the row's tapete in front of it stays clear of the next
 * row's people, heads, bubbles and role tags included (at 6 the middle one still hid its start; 3 rows fit 2x3 cells). */
export const ROW_PITCH = 8
const AGENT_ID = /^[A-Za-z0-9_-]{1,64}$/
type TeamRow = { letter: string | null; name: string; keys: string[] }
/** A session's teams as rows of desks, null when none of its subagents names one: its subagents (the secretaria,
 * Producto and malformed ids aside; finished ones for TEAM_KEEP) by team letter in letter order, each named by its first
 * member, in spawn order; the unnamed ones last, a row without a label. */
export function teamPlan(b: Beat, now: number): TeamRow[] | null {
  const subs = Object.entries(b.agents).filter(([k, x]) => k !== MAIN && AGENT_ID.test(k) && !STAFF_KINDS.has(x.kind) && !(x.state === 'terminado' && now - x.since > TEAM_KEEP))
  const named = new Map<string, TeamRow>(), loose: string[] = []
  for (const [k, x] of subs) {
    const tm = teamOf(x.goal)
    if (!tm) { loose.push(k); continue }
    const row = named.get(tm.letter) ?? { letter: tm.letter, name: tm.name, keys: [] }
    row.keys.push(k); named.set(tm.letter, row)
  }
  if (!named.size) return null
  return [...[...named.values()].sort((p, q) => (p.letter! < q.letter! ? -1 : 1)), ...(loose.length ? [{ letter: null, name: '', keys: loose }] : [])]
}
/** A team office's room, desks and labels: the Jefe's desk at (1, 1), row k's desks at (4, 7, 10; 1 + ROW_PITCH k).
 * Members not seated (past 3 a row, or past 3 rows, unnamed ones too) count in the last labelled team's "+N". */
function teamUp(d: AgentvilleDept, room: number[], plan: TeamRow[]) {
  const [ox, oy] = room as [number, number], rows = plan.slice(0, TEAM_ROWS), extra = (r: TeamRow) => Math.max(0, r.keys.length - TEAM_SEATS)
  const spill = plan.slice(TEAM_ROWS).reduce((a, r) => a + r.keys.length, 0) + rows.filter((r) => !r.letter).reduce((a, r) => a + extra(r), 0)
  const last = rows.map((r) => !!r.letter).lastIndexOf(true)
  d.room = room
  d.desks = [{ id: `${d.id}-jefe`, x: ox + 1, y: oy + 1 }, ...rows.flatMap((r, k) => r.keys.slice(0, TEAM_SEATS).map((key, j) => ({ id: `${d.id}-${key}`, x: ox + 4 + 3 * j, y: oy + 1 + ROW_PITCH * k })))]
  const teams = rows.flatMap((r, k) => (r.letter ? [{ letter: r.letter, name: r.name, row: k, more: extra(r) + (k === last ? spill : 0) }] : []))
  if (teams.length) d.teams = teams
}
const BUSY = new Set<AgentvilleStateName>(['trabajando', 'leyendo', 'esperando'])
const running = (b: Beat, kind: string) => Object.values(b.agents).some((x) => kindOf(x.kind) === kind && BUSY.has(x.state))
/** The goal headings a heartbeat carries (any program can write one): strings only, at most 3, one line of 60. */
const metasOf = (v: unknown) => (Array.isArray(v) ? v : []).filter((m): m is string => typeof m === 'string').map((m) => cut(m.replace(/\s+/g, ' ').trim(), 60)).filter(Boolean).slice(0, 3)
/** A session's newest finished record of a staff kind, and the first line of an answer (its verdict). */
const lastOf = (b: Beat, kind: string) => Object.values(b.agents).filter((x) => kindOf(x.kind) === kind && x.state === 'terminado').sort((p, q) => q.since - p.since)[0]
// The first line's words, markdown and punctuation dropped, in capitals: "**Decided.**" reads DECIDED.
const verdict = (x: BeatAgent) => ` ${(x.answer ?? '').trim().split('\n')[0]!.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toUpperCase()} `
const says = (x: BeatAgent, ...words: string[]) => words.some((v) => verdict(x).startsWith(` ${v} `))
/**
 * Where a session's Jefe goes in the impact step (the secretaria never leaves her desk): to her visitor spot (the
 * s-th, -1 none) while she runs for it; to Producto's chair while Producto runs, or after her PRODUCT until a Producto
 * run ends (STAFF_MS at most); on any other Producto answer it walks home. After a verdict for you (her PERSON, Producto's
 * ESCALATE, NO FIT or NO GOALS, STAFF_MS at most) it stays where it heard it while its turn goes on, so it walks from
 * there into your queue once it asks; `old` is its visit at the last sync.
 */
function jefeVisitOf(b: Beat, old: AgentvilleVisit | undefined, s: number, now: number): AgentvilleVisit | undefined {
  const on = (p: number[]) => ({ ...xy(p), until: now + WHILE_MS })
  if (s >= 0) return on(SEC_VISIT[Math.min(s, SEC_VISIT.length - 1)]!)
  const sec = lastOf(b, SEC_KIND), prod = lastOf(b, PROD_KIND), fresh = (x?: BeatAgent): x is BeatAgent => !!x && now - x.since < STAFF_MS
  const sent = fresh(sec) && says(sec, 'PRODUCT') && !Object.values(b.agents).some((x) => kindOf(x.kind) === PROD_KIND && !BUSY.has(x.state) && x.since > sec.since)
  if (running(b, PROD_KIND) || sent) return on(PROD_SEAT) // shortcut: Jefes at Producto at once share its chair; add chairs if that gets common
  const main = b.agents[MAIN], heard = (p: number[]) => !!old && old.until > now && isAt(old, p)
  if (!main || (main.state !== 'trabajando' && main.state !== 'leyendo')) return undefined
  if (fresh(sec) && !says(sec, 'PRODUCT') && SEC_VISIT.some(heard)) return on([old!.x, old!.y])
  if (fresh(prod) && says(prod, 'ESCALATE', 'NO FIT', 'NO GOALS') && heard(PROD_SEAT)) return on(PROD_SEAT)
  return undefined
}
/** How many floors the house has (at least one). */
export const floorsOf = (w: AgentvilleWorld) => Math.max(1, ...w.depts.map((d) => (d.floor ?? 0) + 1))
/**
 * One floor as the pane draws it: its islands and their agents, plus everyone waiting for you from any floor (your
 * office is shared; their islands come along marked `away`, for their colour). Idle chiefs of other floors stay on
 * their own floor's lobby.
 */
export function floorView(w: AgentvilleWorld, floor: number): AgentvilleWorld {
  // A sleeping or idle session stays in the list but takes no island: the map draws the rooms given (the sessions at
  // work, and a resting family parent lights off, without its people).
  const here = new Set(w.depts.filter((d) => (d.floor ?? 0) === floor && d.room.length).map((d) => d.id))
  const atWork = new Set(w.depts.filter((d) => here.has(d.id) && present(d)).map((d) => d.id))
  const agents = w.agents.filter((a) => atWork.has(a.dept) || a.state === 'esperando')
  const depts = w.depts.filter((d) => here.has(d.id) || agents.some((a) => a.dept === d.id)).map((d) => (here.has(d.id) ? d : { ...d, away: true as const }))
  return { ...w, depts, agents, rows: rowsOf({ ...w, rows: undefined }, floor) }
}

/**
 * What the pane draws of a world at `now`, as one string: the map's zones on every floor (keys and rects rounded to
 * 1/1000), then the world minus the fields no screen draws. A sync whose world draws the same is not stored, so the
 * pane is not drawn again for it. Deny by default: every field not named here counts as drawn. Not drawn: the world's
 * `log` (state changes, never shown), an office's `task` (its Jefe's activity, shown from the agent), and a visit's
 * `until`, which is only ever read as "still on" (a running secretaria or Producto renews it every sync).
 */
export function drawnSig(w: AgentvilleWorld, now: number): string {
  const r = (v: number) => Math.round(v * 1000)
  const zones = Array.from({ length: floorsOf(w) }, (_, f) => hotspots(floorView(w, f), now).map((z) => `${z.key}:${r(z.x0)},${r(z.y0)},${r(z.x1)},${r(z.y1)}`).join(' '))
  const visit = (v?: AgentvilleVisit) => (v ? { ...v, until: v.until > now } : v)
  const agent = (a: AgentvilleAgent) => ({ ...a, visit: visit(a.visit) })
  const { log: _log, ...rest } = w
  return JSON.stringify([zones, { ...rest, depts: w.depts.map(({ task: _task, ...d }) => d), agents: w.agents.map(agent), staff: w.staff && { ...w.staff, sec: agent(w.staff.sec) } }])
}

/* ---------- layer A: the house ---------- */
/** The floor itself, `rows` rows of islands deep: slab, tiles, outer walls, the strip's rugs and the office's queue lane.
 * A tile wholly under one of `rooms` (the islands' own floors, drawn over it) is left out. */
export function houseLayer(rows = 1, rooms: number[][] = []): string {
  const p = PAL, H = depthOf(rows)
  let s = box(0, 0, -0.5, W, H, 0.5, p.slab, shade(p.slab, 0.85), shade(p.slab, 0.7))
  const tiles: Record<string, [number, number][][]> = {}
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (rooms.some((r) => x >= r[0]! && x + 1 <= r[2]! && y >= r[1]! && y + 1 <= r[3]!)) continue
    const c = p.floors[zoneAt(x + 0.5, y + 0.5)]![(x + y) % 2]!
    ;(tiles[c] ??= []).push([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)])
  }
  s += Object.entries(tiles).map(([c, qs]) => `<path fill="${c}" stroke="rgba(0,0,0,.07)" stroke-width=".6" d="${outlines(qs)}"/>`).join('')
  s += poly([[3.5, 5.5, 0], [8, 5.5, 0], [8, 7.6, 0], [3.5, 7.6, 0]], p.rug)
  s += poly([[22.2, 5.1, 0], [26, 5.1, 0], [26, 9.3, 0], [22.2, 9.3, 0]], shade(p.floors.office![0]!, 0.82))
  // queue lane: two lines of floor tape from your desk to the front of the office
  ;[24.08, 24.86].forEach((x) => { s += poly([[x, 4.1, 0], [x + 0.06, 4.1, 0], [x + 0.06, 10, 0], [x, 10, 0]], PAL.rug) })
  s += box(-0.4, -0.4, 0, 0.4, H + 0.4, 4.6, p.wallTop, p.wallL, p.wallL) + box(0, -0.4, 0, W, 0.4, 4.6, p.wallTop, p.wallR, p.wallR)
  const win = (a: number[][], b: number[][]) => poly(a, p.frame) + poly(b, p.window)
  ;[2, 15, 21, 29].forEach((x) => { s += win([[x, 0, 1.6], [x + 2, 0, 1.6], [x + 2, 0, 3.6], [x, 0, 3.6]], [[x + 0.15, 0, 1.75], [x + 1.85, 0, 1.75], [x + 1.85, 0, 3.45], [x + 0.15, 0, 3.45]]) })
  for (let y = 2.5; y + 2 < H; y += 6) s += win([[0, y, 1.6], [0, y + 2, 1.6], [0, y + 2, 3.6], [0, y, 3.6]], [[0, y + 0.15, 1.75], [0, y + 1.85, 1.75], [0, y + 1.85, 3.45], [0, y + 0.15, 3.45]])
  // the office's side wall, open toward the corridor
  s += box(19.9, 0, 0, 0.2, 8, 1.0, p.partTop, p.part, p.partSide)
  s += plaque(...LOBBY_PLAQUE, t('scene.lobby')) + plaque(25.5, 0, 4.15, t('scene.desk'))
  return svg(s, rows)
}
// The lobby's plaque at the centre of its back wall (houseLayer draws it, tourTargets frames it).
const LOBBY_PLAQUE = [7, 0, 4.15] as const
function plaque(x: number, y: number, z: number, text: string, fill = PAL.plaque, k = 1) {
  const [X, Y] = P(x, y, z), w = text.length * 7.4 + 16
  return `<g transform="translate(${n(X)} ${n(Y)})${k === 1 ? '' : ` scale(${k})`}" stroke="none"><rect x="${n(-w / 2)}" y="-11" width="${n(w)}" height="20" rx="3" fill="${fill}"/><text x="0" y="4" text-anchor="middle" font-family="${FONT}" font-size="12.5" font-weight="700" fill="${PAL.plaqueInk}">${esc(text)}</text></g>`
}

/* ---------- layer B: furniture, boards, and you ---------- */
const plant = (x: number, y: number) => rep('p', x, y, plantAt)
function plantAt(x: number, y: number) {
  const p = PAL, [cx, cy] = P(x + 0.35, y + 0.35, 1.25)
  return box(x, y, 0, 0.7, 0.7, 0.55, shade(p.pot, 1.1), p.pot, shade(p.pot, 0.8)) + `<circle cx="${n(cx)}" cy="${n(cy)}" r="9" fill="${p.leaf2}"/><circle cx="${n(cx - 4)}" cy="${n(cy - 5)}" r="7" fill="${p.leaf}"/><circle cx="${n(cx + 5)}" cy="${n(cy - 3)}" r="6" fill="${p.leaf}"/>`
}
const chairSeat = (sx: number, sy: number) => rep('c', sx, sy, chairAt)
const chairAt = (sx: number, sy: number) => box(sx - 0.06, sy - 0.06, 0, 0.12, 0.12, 0.3, PAL.chair, shade(PAL.chair, 0.7), shade(PAL.chair, 0.6)) + box(sx - 0.35, sy - 0.3, 0.3, 0.7, 0.6, 0.15, shade(PAL.chair, 1.15), PAL.chair, shade(PAL.chair, 0.75))
/** Your chair: a high-backed cognac leather executive chair with a headrest, arms and a five-star base. */
function execChair(sx: number, sy: number) {
  const L = '#7a4a2c', metal = '#4a4f58', top = shade(L, 1.18), side = shade(L, 0.78)
  let s = box(sx - 0.5, sy - 0.04, 0, 1, 0.08, 0.06, metal, shade(metal, 0.8), shade(metal, 0.7)) + box(sx - 0.04, sy - 0.5, 0, 0.08, 1, 0.06, metal, shade(metal, 0.8), shade(metal, 0.7))
  s += box(sx - 0.06, sy - 0.06, 0.06, 0.12, 0.12, 0.3, metal, shade(metal, 0.8), shade(metal, 0.7))
  s += box(sx - 0.5, sy - 0.7, 0.45, 1, 0.22, 1.75, top, L, side) // the tall back
  s += box(sx - 0.34, sy - 0.68, 2.2, 0.68, 0.18, 0.32, top, L, side) // headrest
  // tufted stitching on the back's face
  ;[-0.25, 0, 0.25].forEach((dx) => { s += poly([[sx + dx - 0.015, sy - 0.48, 0.75], [sx + dx + 0.015, sy - 0.48, 0.75], [sx + dx + 0.015, sy - 0.48, 2.05], [sx + dx - 0.015, sy - 0.48, 2.05]], shade(L, 0.6)) })
  s += box(sx - 0.5, sy - 0.48, 0.36, 1, 0.88, 0.2, top, L, side) // seat
  s += box(sx - 0.62, sy - 0.46, 0.5, 0.13, 0.78, 0.32, top, L, side) + box(sx + 0.49, sy - 0.46, 0.5, 0.13, 0.78, 0.32, top, L, side) // arms
  return s
}
const chairBack = (sx: number, sy: number) => box(sx - 0.35, sy + 0.3, 0.3, 0.7, 0.12, 0.8, shade(PAL.chair, 1.15), PAL.chair, shade(PAL.chair, 0.75))
function board(notes: { t: string; done: boolean }[], bx: number, by: number, color: string | null) {
  let s = box(bx + 0.2, by, 0, 0.1, 0.08, 0.6, '#5b5f66', '#5b5f66', '#45484e') + box(bx + 3.3, by, 0, 0.1, 0.08, 0.6, '#5b5f66', '#5b5f66', '#45484e')
  s += box(bx, by, 0.55, 3.6, 0.08, 1.75, '#c9ccd2', '#9aa0aa', '#7d838d')
  s += poly([[bx + 0.1, by + 0.08, 0.65], [bx + 3.5, by + 0.08, 0.65], [bx + 3.5, by + 0.08, 2.2], [bx + 0.1, by + 0.08, 2.2]], '#fbfbf7')
  const from = Math.max(0, Math.min(notes.findIndex((x) => !x.done), notes.length - 3)) // the first open notes
  notes.slice(from, from + 3).forEach((note, i) => {
    const [X, Y] = P(bx + 0.22, by + 0.08, 1.8 - i * 0.38)
    const t = note.t.length > 15 ? note.t.slice(0, 14) + '…' : note.t
    s += `<g transform="matrix(1 0.5 0 1 ${n(X)} ${n(Y)})" stroke="none"><rect x="0" y="-4" width="4" height="4" fill="${note.done ? '#2c8a4f' : 'none'}" stroke="#1d2433" stroke-width="0.7"/><text x="6" y="0" font-family="${FONT}" font-size="5.2" fill="${note.done ? '#7a808c' : '#1d2433'}"${note.done ? ' text-decoration="line-through"' : ''}>${esc(t)}</text></g>`
  })
  if (color) { const [X, Y] = P(bx + 3.1, by + 0.08, 2.15); s += `<g transform="matrix(1 0.5 0 1 ${n(X)} ${n(Y)})"><rect x="-3" y="0" width="6" height="6" fill="${color}" stroke="none"/></g>` }
  return s
}
// Usage screens: dark wall screens on the boards' plane (world x), one per office and the HQ's in your office.
const GOOD = '#7fd6a6', MID = '#f2a93b', BAD = '#ef6b5b'
export const ctxColor = (p: number) => (p >= 85 ? BAD : p >= 60 ? MID : GOOD)
export const toolsOf = (d: AgentvilleDept) => Object.values(d.tools ?? {}).reduce((a, b) => a + b, 0)
export const toolsLabel = (n: number) => (n === 1 ? t('tools.one') : t('tools.many', { n }))
// The line under the map: how its clicks work at this weight (mode: see the click grid in the pane's render).
// `quiet`: offices of this floor off the map for lack of activity, said after it.
export const mapNote = (mode: number, quiet = 0) => {
  const note = mode === -1 ? t('map.noClicks') : mode === 0 ? '' : mode === 1 ? t('map.clickAll') : t('map.clickOffices')
  const rest = quiet === 1 ? t('map.quiet.one') : quiet > 1 ? t('map.quiet.many', { n: quiet }) : ''
  return [note, rest].filter(Boolean).join(' · ') || '\u00a0'
}
/** The line under the map: a step the map shed says so first (the plain map, its people, its decor), then mapNote. The
 * plain map says itself that offices take clicks, so with none left (mode -1) it says only "Simple map", then the honest
 * "too many offices". */
export const mapStrip = (d: { plain: boolean; people: boolean; decor: boolean }, mode: number, quiet = 0) => {
  const step = d.plain ? (mode >= 0 ? t('map.plain') : t('map.plainNoClicks')) : !d.people ? t('map.noPeople') : !d.decor ? t('map.noDecor') : ''
  return [step, mapNote(d.plain && mode >= 0 ? 0 : mode, quiet)].filter(x => x.trim()).join(' · ') || '\u00a0'
}
const cut = (t: string, k: number) => (t.length > k ? t.slice(0, k - 1) + '…' : t)
const wallText = (x: number, y: number, z: number, t: string, size: number, color: string, weight = '600', anchor = 'start') => {
  const [X, Y] = P(x, y, z)
  return `<g transform="matrix(1 0.5 0 1 ${n(X)} ${n(Y)})" stroke="none"><text font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text></g>`
}
const wallBar = (x: number, y: number, z: number, units: number, pct: number, color: string) => {
  const [X, Y] = P(x, y, z), W = units * T
  return `<g transform="matrix(1 0.5 0 1 ${n(X)} ${n(Y)})" stroke="none"><rect width="${n(W)}" height="3" rx="1.5" fill="#3a4150"/><rect width="${n(Math.max(3, (W * Math.min(100, pct)) / 100))}" height="3" rx="1.5" fill="${color}"/></g>`
}
function darkScreen(bx: number, by: number, wide: number, tall: number, glow: string) {
  let s = box(bx + 0.2, by, 0, 0.1, 0.08, 0.6, '#5b5f66', '#5b5f66', '#45484e') + box(bx + wide - 0.3, by, 0, 0.1, 0.08, 0.6, '#5b5f66', '#5b5f66', '#45484e')
  s += box(bx, by, 0.55, wide, 0.08, tall, '#3a3f48', '#2b2f36', '#23272e')
  const top = 0.55 + tall - 0.08
  s += poly([[bx + 0.08, by + 0.08, 0.63], [bx + wide - 0.08, by + 0.08, 0.63], [bx + wide - 0.08, by + 0.08, top], [bx + 0.08, by + 0.08, top]], '#151a22')
  return s + poly([[bx + 0.08, by + 0.08, top - 0.06], [bx + wide - 0.08, by + 0.08, top - 0.06], [bx + wide - 0.08, by + 0.08, top], [bx + 0.08, by + 0.08, top]], glow)
}
/** An office's screen, beside its plan board: what the session spent, its context fill, its tool calls. */
export const SCREEN_AT = { dx: 1.0, dy: 0.15, wide: 2.25 }

function officeScreen(d: AgentvilleDept) {
  const bx = d.room[0]! + SCREEN_AT.dx, by = d.room[1]! + SCREEN_AT.dy, u = d.usage, pct = u?.pct ?? 0
  let s = darkScreen(bx, by, SCREEN_AT.wide, 1.75, d.color)
  if (!u) return s + wallText(bx + 0.22, by + 0.08, 1.5, t('scene.noUsage'), 4.4, '#b9c0cc', '500')
  s += wallText(bx + 0.22, by + 0.08, 1.85, u.usd !== undefined ? usd(u.usd) : 'US$ ?', 7.5, GOOD, '800')
  s += wallText(bx + 0.22, by + 0.08, 1.42, t('scene.context', { pct }), 4.6, '#c9ccd2')
  s += wallBar(bx + 0.22, by + 0.08, 1.12, 1.8, pct, ctxColor(pct))
  return s + wallText(bx + 0.22, by + 0.08, 0.86, toolsLabel(toolsOf(d)), 4.2, '#b9c0cc', '500')
}
/**
 * A card laid over the map above a point (world units): `body` is the card, cw by ch in the map's own pixels, centred
 * over the point and kept inside the view. A layer the map's size, so it lines up with the map at any pane width.
 */
export function cardOver(w: AgentvilleWorld, at: [number, number, number], body: string, cw: number, ch: number): string {
  const { rows, x, y } = cardAt(w, at, cw, ch)
  return svg(`<g transform="translate(${n(x)} ${n(y)})">${body}</g>`, rows)
}
function cardAt(w: AgentvilleWorld, at: [number, number, number], cw: number, ch: number) {
  const rows = rowsOf(w), v = viewOf(rows), [X, Y] = P(...at)
  if (at === CORNER) return { rows, v, x: v.x + v.w - cw - 4, y: v.y + 4 }
  return { rows, v, x: Math.min(Math.max(X - cw / 2, v.x + 4), v.x + v.w - cw - 4), y: Math.min(Math.max(Y - ch - 6, v.y + 4), v.y + v.ht - ch - 4) }
}
/** A pinned card's ×, in the card's own pixels: drawn 15 px in from its right edge and 15.5 px down (in line with the
 * card's padding), 10 px square. Its click zone grows from this same rect (register.tsx, `around(...)` where the card-close zone is made).
 * CLOSE_W keeps text clear of it. */
export const CLOSE_W = 26
export const closeGlyphAt = (cw: number) => ({ x: cw - 20, y: 10.5, w: 10, ht: 10 })
export const cardCloseGlyph = (cw: number, ink: string) => {
  const g = closeGlyphAt(cw)
  return `<path d="M${g.x} ${g.y}L${g.x + g.w} ${g.y + g.ht}M${g.x + g.w} ${g.y}L${g.x} ${g.y + g.ht}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
}
type Rect01 = { x0: number; x1: number; y0: number; y1: number }
/** A zone (fractions) grown evenly around `r` to at least minW by minH: a small drawn mark, an easy target. */
export const around = (r: Rect01, minW: number, minH: number): Rect01 => {
  const mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2, hw = Math.max(minW, r.x1 - r.x0) / 2, hh = Math.max(minH, r.y1 - r.y0) / 2
  return { x0: mx - hw, x1: mx + hw, y0: my - hh, y1: my + hh }
}
/** A zone (fractions) `dx` and `dy` larger than `r` on every side. */
export const padded = (r: Rect01, dx: number, dy: number): Rect01 => ({ x0: r.x0 - dx, x1: r.x1 + dx, y0: r.y0 - dy, y1: r.y1 + dy })
/** `r` cut to `b` (fractions): a card's zones never reach past the drawn card, where a click only closes it. */
export const within = (r: Rect01, b: Rect01): Rect01 => ({ x0: Math.max(r.x0, b.x0), x1: Math.min(r.x1, b.x1), y0: Math.max(r.y0, b.y0), y1: Math.min(r.y1, b.y1) })
/** The rect of a card that cardOver places, as fractions of the map. */
export function cardRect(w: AgentvilleWorld, at: [number, number, number], cw: number, ch: number) {
  const { v, x, y } = cardAt(w, at, cw, ch)
  return { x0: (x - v.x) / v.w, x1: (x + cw - v.x) / v.w, y0: (y - v.y) / v.ht, y1: (y + ch - v.y) / v.ht }
}
/** A part of a card that cardOver places (`r` in the card's own pixels), as fractions of the map: its buttons' zones come
 * from the same numbers that draw them. */
export function cardPart(w: AgentvilleWorld, at: [number, number, number], cw: number, ch: number, r: { x: number; y: number; w: number; ht: number }) {
  const { v, x, y } = cardAt(w, at, cw, ch)
  return { x0: (x + r.x - v.x) / v.w, x1: (x + r.x + r.w - v.x) / v.w, y0: (y + r.y - v.y) / v.ht, y1: (y + r.y + r.ht - v.y) / v.ht }
}
/** Suggested sessions waiting for you: a yellow note on the right of your desk's top saying how many; a click opens their
 * card over the map. The tag and its click zone share these numbers. */
export const NOTES_AT: [number, number, number] = [25.5, 3.5, 0.8]
const NOTE_H = 16, noteW = (label: string) => label.length * 6.2 + 12
function notesTag(label: string) {
  const [X, Y] = P(...NOTES_AT), w = noteW(label)
  return `<g transform="translate(${n(X)} ${n(Y)})"><rect x="${n(-w / 2)}" y="${-NOTE_H / 2}" width="${n(w)}" height="${NOTE_H}" rx="2" fill="#e2a94a" stroke="#1d1d1b" stroke-opacity="0.35"/><text x="0" y="3.5" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#1d1d1b">${esc(label)}</text></g>`
}
function notesZone(label: string, fx: (X: number) => number, fy: (Y: number) => number): Zone {
  const [X, Y] = P(...NOTES_AT), w = noteW(label)
  return { id: 'notes', key: 'screen-notes-0', group: 'screen-notes', label: t('notes.zone', { label }), depth: 40, priority: 2, x0: fx(X - w / 2), x1: fx(X + w / 2), y0: fy(Y - NOTE_H / 2), y1: fy(Y + NOTE_H / 2) }
}
// The notes card's anchor, by identity: no point on the floor but the view's top-right corner (4 px in), over the blue
// above the despacho's wall, where it hides no office.
const CORNER: [number, number, number] = [0, 0, 0]
export const notesTop = (): [number, number, number] => CORNER
export const officeTop = (d: AgentvilleDept): [number, number, number] => [d.room[0]! + SCREEN_AT.dx + SCREEN_AT.wide / 2, d.room[1]! + SCREEN_AT.dy, 2.5]
/** Your office's HQ screen: every team's spend, the most expensive first. */
export const HQ_AT = { x: 25.4, y: 0.6, wide: 2.65 }
export const hqTop = (): [number, number, number] => [HQ_AT.x + HQ_AT.wide / 2, HQ_AT.y, 3.2]
function hqScreen(all: AgentvilleDept[]) {
  const bx = HQ_AT.x, by = HQ_AT.y, ranked = [...all].sort((a, b) => (b.usage?.usd ?? 0) - (a.usage?.usd ?? 0)), top = ranked.slice(0, 5)
  let s = darkScreen(bx, by, 2.65, 2.55, MID) + wallText(bx + 0.2, by + 0.08, 2.75, `HQ ${usd(all.reduce((t, d) => t + (d.usage?.usd ?? 0), 0))}`, 6.2, MID, '800')
  top.forEach((d, i) => { const z = 2.38 - i * 0.33; s += wallText(bx + 0.2, by + 0.08, z, cut(d.name, 13), 3.9, '#c9ccd2', '500') + wallText(bx + 2.45, by + 0.08, z, d.usage?.usd !== undefined ? usd(d.usage.usd) : '?', 3.9, '#ffffff', '700', 'end') })
  const more = ranked.length - top.length
  if (more > 0) s += wallText(bx + 0.2, by + 0.08, 2.38 - 5 * 0.33, more === 1 ? t('scene.moreTeams.one') : t('scene.moreTeams.many', { n: more }), 3.6, '#b9c0cc', '500')
  return s
}
/** The disk screen, right of the shelf: free disk (its glow and number amber under 10 GB, red under 5) and two lines
 * of what takes room (the worktrees, or Agentville's own folder when the app's registry cannot be read). */
// A screen 1.9 tall (its top at z 2.45): four short lines fit its 1.7 tiles (27 px) at the HQ screen's sizes or larger.
export const DISK_AT = { x: 30.0, y: 0.6, wide: 1.7, tall: 1.9 }
export const diskTop = (): [number, number, number] => [DISK_AT.x + DISK_AT.wide / 2, DISK_AT.y, 0.55 + DISK_AT.tall + 0.1]
export type DiskView = { freeGb: number | null; lines: [string, string] }
/** The disk's colours by diskColor (disk.ts): the screen and its card share them. */
export const DISK_INK = { good: GOOD, mid: MID, bad: BAD }
function diskScreen(d: DiskView | null) {
  const bx = DISK_AT.x + 0.15, by = DISK_AT.y + 0.08, glow = d?.freeGb != null ? DISK_INK[diskColor(d.freeGb)] : '#b9c0cc'
  let s = darkScreen(DISK_AT.x, DISK_AT.y, DISK_AT.wide, DISK_AT.tall, glow)
  if (d?.freeGb == null) return s + wallText(bx, by, 1.9, t('disk.measuring'), 3.8, glow, '700')
  s += wallText(bx, by, 2.0, `${Math.floor(d.freeGb)} GB`, 4.4, glow, '800') + wallText(bx, by, 1.65, t('disk.freeWord'), 3.8, glow, '600')
  return s + wallText(bx, by, 1.25, cut(d.lines[0], 11), 3.8, '#c9ccd2', '500') + wallText(bx, by, 0.88, cut(d.lines[1], 11), 3.8, '#ffffff', '700')
}
/** The disk screen's panel as darkScreen draws it (its front face: x across `wide`, z from 0.55 up `tall`), mapped by fx
 * and fy. */
export function diskScreenRect(fx: (X: number) => number, fy: (Y: number) => number): Rect01 {
  const { x, wide, tall } = DISK_AT, y = DISK_AT.y + 0.08, [X0] = P(x, y), [X1] = P(x + wide, y), [, Y0] = P(x, y, 0.55 + tall), [, Y1] = P(x + wide, y, 0.55)
  return { x0: fx(X0), x1: fx(X1), y0: fy(Y0), y1: fy(Y1) }
}
/** Two wisps of steam rising from (x, y), `u` units a pixel; SMIL only, so a redraw just picks them up again. */
const steam = (x: number, y: number, u: number) => [0, 1].map((i) => {
  const loop = `dur="2.4s" begin="${-i * 1.2}s" repeatCount="indefinite"`
  return `<rect x="${n(x + i * u * 1.5)}" y="${n(y)}" width="${n(u)}" height="${n(u * 2)}" fill="#ffffff" stroke="none" opacity="0"><animate attributeName="opacity" values="0;0.85;0" ${loop}/><animateTransform attributeName="transform" type="translate" values="0 0;${n(i ? -u : u)} ${n(-u * 6)}" ${loop}/></rect>`
}).join('')
/** The lobby's two corners: a coffee counter by the water cooler, and a TV with a PS5 facing three floor cushions. */
function lobbyCorners(): { key: number; s: string }[] {
  const p = PAL, metal = '#4a4f58', white = '#f4f4f0', items: { key: number; s: string }[] = []
  // coffee counter: a desk-coloured cabinet, the machine (with a fresh cup under its spout), a stack of cups
  let c = box(1.4, 0.15, 0, 2.9, 0.7, 0.9, p.desk, p.deskSide, shade(p.deskSide, 0.88))
  c += box(3.3, 0.25, 0.9, 0.7, 0.5, 0.95, shade(metal, 1.25), metal, shade(metal, 0.8))
  c += poly([[3.4, 0.75, 1.0], [3.85, 0.75, 1.0], [3.85, 0.75, 1.45], [3.4, 0.75, 1.45]], '#2b2f36') // the spout's recess
  c += box(3.55, 0.5, 0.9, 0.16, 0.16, 0.18, white, shade(white, 0.85), shade(white, 0.7))
  c += poly([[3.42, 0.75, 1.62], [3.5, 0.75, 1.62], [3.5, 0.75, 1.7], [3.42, 0.75, 1.7]], '#7fd6a6') // ready light
  c += box(1.8, 0.35, 0.9, 0.2, 0.2, 0.32, white, shade(white, 0.85), shade(white, 0.7)) + box(2.15, 0.35, 0.9, 0.2, 0.2, 0.18, white, shade(white, 0.85), shade(white, 0.7))
  const [sx, sy] = P(3.63, 0.58, 1.1)
  items.push({ key: 2.8 + 0.5, s: c + steam(sx - 1.5, sy - 4, 1.6) })
  // TV corner: a low wood console against the wall, the TV on it showing a game (a blinking screen, a ball between
  // two paddles), a PS5 standing at its side, and a red floor cushion per player
  let t = box(8.3, 0.1, 0, 2.6, 0.55, 0.5, p.wood, p.woodSide, shade(p.woodSide, 0.85))
  t += box(9.4, 0.3, 0.5, 0.3, 0.15, 0.1, metal, shade(metal, 0.8), shade(metal, 0.7))
  t += box(8.5, 0.25, 0.6, 2.0, 0.12, 1.2, p.screenOff, p.screenOff, shade(p.screenOff, 0.8))
  t += box(10.62, 0.18, 0.5, 0.2, 0.42, 0.78, white, shade(white, 0.9), shade(white, 0.75)) + poly([[10.62, 0.6, 0.5], [10.82, 0.6, 0.5], [10.82, 0.6, 1.28], [10.62, 0.6, 1.28]], white)
  t += poly([[10.7, 0.6, 0.56], [10.74, 0.6, 0.56], [10.74, 0.6, 1.22], [10.7, 0.6, 1.22]], '#1d2433') + poly([[10.715, 0.6, 1.0], [10.725, 0.6, 1.0], [10.725, 0.6, 1.2], [10.715, 0.6, 1.2]], '#79c2ff')
  const [gx, gy] = P(8.6, 0.37, 1.7), loop = 'repeatCount="indefinite"'
  t += `<g transform="matrix(1 0.5 0 1 ${n(gx)} ${n(gy)})" stroke="none"><rect width="28.8" height="16" fill="#2f6fd1"><animate attributeName="fill" values="#2f6fd1;#3a7fe0;#2f6fd1;#5a4fc4;#2f6fd1" dur="3s" ${loop}/></rect>`
    + `<rect y="13" width="28.8" height="3" fill="#2f9e6e"/><rect x="2" y="3" width="1.6" height="5" fill="#ffffff"><animate attributeName="y" values="3;7;4;3" dur="2s" ${loop}/></rect>`
    + `<rect x="25.2" y="6" width="1.6" height="5" fill="#ffffff"><animate attributeName="y" values="6;3;7;6" dur="2s" ${loop}/></rect>`
    + `<rect width="1.8" height="1.8" fill="#f2a93b"><animate attributeName="x" values="4;23;4" dur="2s" ${loop}/><animate attributeName="y" values="4;9;5;10;4" dur="2s" ${loop}/></rect></g>`
  items.push({ key: 9.6 + 0.4, s: t })
  LOBBY_SPOTS.filter((s) => s.kind === 'game').forEach((s) => items.push({ key: s.x + s.y - 0.5, s: box(s.x - 0.38, s.y - 0.4, 0, 0.76, 0.76, 0.32, shade(p.sofa, 1.15), p.sofa, p.sofaSide) }))
  return items
}
/** A family's drawn rooms, its parent's first, and its block: the rect from its first cell to its last (the gaps
 * inside are the family's floor). */
export const membersOf = (w: AgentvilleWorld, d: AgentvilleDept) => [d, ...w.depts.filter((c) => c.parent === d.id && !c.away && c.room.length)]
export const blockOf = (rooms: number[][]) => [Math.min(...rooms.map((q) => q[0]!)), Math.min(...rooms.map((q) => q[1]!)), Math.max(...rooms.map((q) => q[2]!)), Math.max(...rooms.map((q) => q[3]!))]
// Glass walls, one pane per tile of an edge [x0, y0, x1, y1] (a line) so each keys by its own middle: a long pane keyed
// once would draw over the boards and people in front of it. `door` leaves that tile open (by its index along the edge);
// `keyOf` gives tile k's key when its own place is not the right one (a family room's edges).
const GLASS = 'rgba(180,220,250,0.42)', GLASS_SIDE = 'rgba(150,200,240,0.5)'
const panes = ([a, b, c, d]: number[], door = -1, keyOf = (k: number) => a! + b! + k + 1) => range(0, c! - a! + d! - b! - 1).filter((k) => k !== door).map((k) => a === c
  ? { key: keyOf(k), s: box(a! - 0.06, b! + k, 0, 0.12, 1, 1.5, GLASS, GLASS_SIDE, GLASS_SIDE) }
  : { key: keyOf(k), s: box(a! + k, b! - 0.06, 0, 1, 0.12, 1.5, GLASS, GLASS_SIDE, GLASS_SIDE) })
/** A child room's door: DOOR tiles along its edge toward its parent, its top edge when it stands under the parent's
 * row, else its left. At 3 the door opens on the room's free middle column (x0 + 3.5) or row (y0 + 3.5). */
const DOOR = 3, THRESHOLD = 'rgba(20,34,62,0.45)'
const doorOnTop = (room: number[], parent: number[]) => room[1]! > parent[1]!
/** Each family block: its outline and tint in the parent's colour, and Producto's tall glass on every room edge inside
 * it, with a door on each child room's edge toward the parent. Nothing here takes a click. */
function familyParts(w: AgentvilleWorld): { key: number; s: string }[] {
  const out: { key: number; s: string }[] = []
  for (const d of w.depts.filter((x) => x.fam && !x.away && x.room.length)) {
    const rooms = membersOf(w, d).map((m) => m.room), [bx0, by0, bx1, by1] = blockOf(rooms) as [number, number, number, number]
    out.push({ key: -2.5, s: `<polygon points="${pts([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]])}" fill="${d.color}" fill-opacity="0.16" stroke="${d.color}" stroke-width="2.5" stroke-linejoin="round"/>` })
    rooms.forEach(([x0, y0, x1, y1], i) => {
      const top = i > 0 && doorOnTop(rooms[i]!, rooms[0]!), left = i > 0 && !top
      const edges = [[x0, y0, x1, y0, top, true], [x1, y0, x1, y1, false, false], [x0, y1, x1, y1, false, false], [x0, y0, x0, y1, left, true]] as [number, number, number, number, boolean, boolean][]
      for (const [a, b, c, e, door, back] of edges) {
        if (b === e ? b === by0 || b === by1 : a === bx0 || a === bx1) continue // on the block's border: open
        // A back edge (top, left) draws behind its whole room (its board, screen, plant); a front edge tile by tile, a
        // tile early so the next room's board, nearer than its far end, stays over it.
        out.push(...panes([a, b, c, e], door ? DOOR : -1, back ? () => x0! + y0! - 0.1 : (k) => a + b + k))
        // the door's threshold: a dark strip across the open tile, on the floor
        if (door) out.push({ key: -2.4, s: b === e ? floorPoly(a + DOOR, b - 0.12, a + DOOR + 1, b + 0.12, THRESHOLD) : floorPoly(a - 0.12, b + DOOR, a + 0.12, b + DOOR + 1, THRESHOLD) })
      }
    })
  }
  return out
}
// A desk, its monitor (`scr` its lit face) and keyboard; `plain`, the desk alone (the plain map).
const desk = (x: number, y: number, scr: string, chief: boolean, plain = false) => ({ key: x + y + 1.5, s: rep(`d${chief ? 1 : 0}${plain ? '' : scr.slice(1)}`, x, y, (x, y) => deskAt(x, y, scr, chief, plain)) })
const deskAt = (x: number, y: number, scr: string, chief: boolean, plain: boolean) => {
  const p = PAL, [top, side] = chief ? [p.wood, p.woodSide] : [p.desk, p.deskSide], s = box(x, y, 0, 2, 1, 0.75, top, side, shade(side, 0.88))
  return plain ? s : s + box(x + 1.05, y + 0.15, 0.75, 0.9, 0.1, 0.62, p.screenOff, scr, p.screenOff) + box(x + 1.1, y + 0.5, 0.75, 0.8, 0.3, 0.04, shade(p.desk, 0.8), shade(p.desk, 0.7), shade(p.desk, 0.7))
}
/** An island's own floor, w by d tiles from (ox, oy), its palette's two tones alternating by the tile's place in it. */
function isleFloorAt(ox: number, oy: number, w: number, d: number, pair: string[]) {
  const floor: [number, number][][][] = [[], []]
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) { const x = ox + i, y = oy + j; floor[(i + j) % 2]!.push([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)]) }
  return floor.map((qs, i) => `<path fill="${pair[i]}" stroke="rgba(0,0,0,.07)" stroke-width=".6" d="${outlines(qs)}"/>`).join('')
}
const floorPoly = (x0: number, y0: number, x1: number, y1: number, fill: string) => `<path fill="${fill}" stroke="none" d="${outlines([[P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]])}"/>`
// Not embedded on purpose (it would add its font to the layer's bytes): where the pane lacks Pixelify Sans, the
// monospace fallback is intended, and the tapete's width estimate (0.6 em a character) is a monospace one.
const PIXEL = '"Pixelify Sans", ui-monospace, Menlo, monospace'
/** A team row's tapete: a light strip on the floor in front of its desks (row desks at `dy`), and its name painted
 * along it in floor perspective, cut past TAPETE_CHARS and squeezed (never stretched) only when it would overflow. */
export const TAPETE = { x0: 4.1, x1: 12.9, dy0: 2.1, dy1: 2.95, size: 8, chars: 34 }
function tapete(ox: number, dy: number, tm: { letter: string; name: string; more: number }) {
  const y = dy + TAPETE.dy0, more = tm.more ? ` +${tm.more}` : '', label = cut(t('team.label', { letter: tm.letter, name: tm.name }).toUpperCase(), TAPETE.chars - more.length) + more
  const room = (TAPETE.x1 - TAPETE.x0 - 0.4) * T, fits = label.length * TAPETE.size * 0.6 <= room, [X, Y] = P(ox + TAPETE.x0 + 0.2, y + 0.68), ink = 'rgba(20,34,62,0.35)'
  return {
    key: -2.45,
    s: floorPoly(ox + TAPETE.x0, y, ox + TAPETE.x1, dy + TAPETE.dy1, 'rgba(255,255,255,0.55)') + floorPoly(ox + TAPETE.x0, y, ox + TAPETE.x1, y + 0.06, ink) + floorPoly(ox + TAPETE.x0, dy + TAPETE.dy1 - 0.06, ox + TAPETE.x1, dy + TAPETE.dy1, ink)
      + `<text transform="matrix(1 0.5 -1 0.5 ${n(X)} ${n(Y)})" font-family='${PIXEL}' style='${NO_LIGATURES}' font-size="${TAPETE.size}" font-weight="700" fill="rgba(20,34,62,0.7)" stroke="none"${fits ? '' : ` textLength="${n(room)}" lengthAdjust="spacingAndGlyphs"`}>${esc(label)}</text>`,
  }
}
// Producto's people round its meeting table (static, no clicks): where each sits, facing which way, its name, its look.
// The last number lifts its name tag: neighbours 13 px apart on screen get tags at least 16 px apart.
const PROD_SEATS: [number, number, AgentvilleFacing, 'staff.analyst' | 'staff.marketing' | 'staff.business' | 'staff.board', AgentvilleRole, number][] = [
  [15.4, 5.0, 'fl', 'staff.analyst', 'rev', -57], [17.0, 5.0, 'fl', 'staff.marketing', 'impl', -53.5], [18.6, 5.0, 'fl', 'staff.business', 'qa', -50], [16.3, 8.0, 'br', 'staff.board', 'jefe', -54], [17.8, 8.0, 'br', 'staff.board', 'jefe', -50],
]
const PROD_INK = '#2f7a4a', SEC_INK = '#a83a68'
/** The secretaria's desk and Producto's room (its glass, table, chairs, goals board and plaque), on every floor. */
function bureau(w: AgentvilleWorld, decor = true): { key: number; s: string }[] {
  const p = PAL, [x0, y0, x1, y1] = PROD_ROOM as [number, number, number, number], goals = w.staff?.goals ?? []
  const [sx, sy] = SEC_DESK as [number, number]
  return [
    desk(sx, sy, '#4fa3e0', true), { key: sx + sy + 2.8, s: chairSeat(sx + 1.5, sy + 1.5) },
    // a sage meeting-room carpet over the strip's tiles, its border a quarter tile wide
    { key: -2.5, s: floorPoly(x0, y0, x1, y1, '#8a9c86') + floorPoly(x0 + 0.25, y0 + 0.25, x1 - 0.25, y1 - 0.25, '#a3b39e') },
    // Producto's glass and your office's; PROD_DOOR stands before Producto's gap
    ...[...PROD_GLASS, ...DESK_GLASS].flatMap((e) => panes(e)),
    { key: 15.1 + 5.6 + 2.6, s: box(15.1, 5.6, 0, 3.8, 1.8, 0.72, p.wood, p.woodSide, shade(p.woodSide, 0.85)) },
    ...PROD_SEATS.map(([x, y, f]) => ({ key: x + y + (f === 'fl' ? -0.2 : 0.4), s: chairSeat(x, y) })),
    { key: PROD_SEAT[0]! + PROD_SEAT[1]! + 0.4, s: chairSeat(PROD_SEAT[0]!, PROD_SEAT[1]!) },
    // Producto's goals board, then its plaques where nobody standing in front hides them: Producto's on the plaque row
    // above its room, like the lobby's and yours, the secretaria's small one behind her desk's right end, clear of her
    // head and right of the queue lane. Both are decor.
    ...(decor ? [
      { key: 14.9 + 2.8 + 0.6, s: board(goals.length ? goals.map((g) => ({ t: g, done: false })) : [{ t: t('staff.noGoals'), done: false }], 14.9, 2.75, PROD_INK) },
      { key: 100, s: plaque(17.5, 0, 4.15, t('staff.prod'), PROD_INK) + plaque(sx + 3.7, sy - 0.8, 2.3, t('staff.sec'), SEC_INK, 0.8) },
    ] : []),
  ]
}
/** What the map draws, shed step by step when the page's rule is near (register.tsx): the working bubbles; the decor
 * (each office's screen and board, the plants, the team tapetes, the names); the people; and at last a plain map, the
 * floors and desks only (and your desk's notes, which take a click). */
// `plain` comes with the rest off (register.tsx's detailOf sets them so): code here reads each flag alone.
export type Detail = { bubbles: boolean; decor: boolean; people: boolean; plain: boolean }
export const FULL: Detail = { bubbles: true, decor: true, people: true, plain: false }
export function furnitureLayer(w: AgentvilleWorld, now?: number, all: AgentvilleDept[] = w.depts, disk: DiskView | null = null, notes: string | null = null, dt: Detail = FULL): string[] {
  const p = PAL, rows = rowsOf(w), decor = dt.decor
  if (now !== undefined) { w = clone(w); settle(w, now) }
  const items: { key: number; s: string }[] = []
  w.depts.filter((d) => !d.away && d.room.length).forEach((d) => {
    const [ox, oy, ex, ey] = d.room as [number, number, number, number]
    // The island's own floor, in one of the house's palettes (an origin may be off the house's grid).
    const k = (d.slot ?? 0) % ISLE_FLOORS.length, pair = p.floors[ISLE_FLOORS[k]!]!
    items.push({ key: -3, s: rep(`i${ex - ox}x${ey - oy}${k}`, ox, oy, (x, y) => isleFloorAt(x, y, ex - ox, ey - oy, pair)) })
    // Lights off on an island whose session has nobody at work: a shade on its floor, its furniture dimmed.
    const dark = !w.agents.some((a) => a.dept === d.id && ['trabajando', 'leyendo', 'esperando', 'error'].includes(a.state))
    if (d.teams && decor) items.push(...d.teams.map((tm) => tapete(ox, oy + 1 + ROW_PITCH * tm.row, tm)))
    const from = items.length
    if (dark) items.push({ key: -2, s: poly([[ox, oy, 0], [ex, oy, 0], [ex, ey, 0], [ox, ey, 0]], 'rgba(12,18,34,0.38)') })
    // A team office's desks, each by who sits there (its finished people keep theirs, lights off); any other's by role.
    const desks = d.desks ?? ROLE_ORDER.map((r) => ({ id: `${d.id}-${r}`, x: ox + SEATS[r][0], y: oy + SEATS[r][1] }))
    desks.forEach(({ id, x, y }, i) => {
      const a = w.agents.find((q) => q.id === id)
      const atDesk = a && !a.walk && a.calledUntil === 0 && a.state !== 'esperando' && !(d.desks && a.state === 'terminado') && !(a.visit && a.visit.until > (now ?? 0)) && SCREEN[a.state]
      items.push(desk(x, y, atDesk ? SCREEN[a!.state]! : p.screenOff, i === 0, dt.plain)) // the chief's desk is dark wood
      if (!dt.plain) items.push({ key: x + y + 2.8, s: chairSeat(x + 1.5, y + 1.5) })
    })
    // a team office keeps its left lane free: its plant stands in the back right corner
    if (decor) {
      items.push(d.desks ? { key: ex - 0.8 + oy + 0.6, s: plant(ex - 0.8, oy + 0.1) } : { key: ox + oy + 0.6, s: plant(ox + 0.1, oy + 0.1) })
      items.push({ key: ox + 3.4 + 1.8 + oy + 0.2, s: board(d.notes, ox + 3.4, oy + 0.15, d.color) })
      items.push({ key: ox + SCREEN_AT.dx + 1.1 + oy + 0.2, s: officeScreen(d) })
    }
    if (dark) items.slice(from + 1).forEach((it) => { it.s = `<g style="filter:brightness(0.6)">${it.s}</g>` })
  })
  // The plain map: the floors and desks (the offices', the secretaria's and yours), and what takes a click in your office
  // (its notes, the HQ and disk screens).
  if (dt.plain) {
    items.push(desk(SEC_DESK[0]!, SEC_DESK[1]!, '', true, true), { key: 23 + 3 + 1.5, s: box(23, 3, 0, 3, 1, 0.8, p.wood, p.woodSide, shade(p.woodSide, 0.85)) })
    if (notes) items.push({ key: 23 + 3 + 1.6, s: notesTag(notes) })
    items.push({ key: 25.4 + 1.3 + 0.6 + 0.2, s: hqScreen(all) }, { key: DISK_AT.x + DISK_AT.wide / 2 + DISK_AT.y + 0.2, s: diskScreen(disk) })
    return pack(items.sort((a, b) => a.key - b.key).map((i) => i.s), rows, 'f', outlined)
  }
  items.push(...familyParts(w), ...bureau(w, decor))
  // your office: your executive chair, you in it, then the desk in front
  const me = colors('me', '#2b2b2b', '#d8a47f', '#f2a93b'), [mx, my] = P(24.5, 2.5)
  items.push({ key: 24.5 + 2.3, s: execChair(24.5, 2.5) })
  items.push({ key: 24.5 + 2.5, s: `<g transform="translate(${n(mx)} ${n(my - 6)})" stroke="none"><ellipse rx="10" ry="4" fill="rgba(0,0,0,.28)"/><g transform="scale(${PX})" stroke="none">${body([torsoRows('me', false), SIT], -35, me)}</g>${nameTag(t('scene.you'), -(35 * PX + 12))}</g>` })
  items.push({ key: 23 + 3 + 1.5, s: box(23, 3, 0, 3, 1, 0.8, p.wood, p.woodSide, shade(p.woodSide, 0.85)) + box(23.4, 3.15, 0.8, 0.9, 0.1, 0.65, p.screenOff, p.screenOff, p.screenOff) + box(24.7, 3.15, 0.8, 0.9, 0.1, 0.65, p.screenOff, p.screenOff, p.screenOff) })
  if (notes) items.push({ key: 23 + 3 + 1.6, s: notesTag(notes) }) // on the desk, drawn after it
  const waiting = w.agents.filter((a) => a.state === 'esperando').sort((m, k) => m.since - k.since)
  items.push({ key: 23.6 + 0.75, s: board(waiting.map((a) => ({ t: `${SHORT[a.role]} · ${deptOf(w, a).name}`, done: false })), 21.6, 0.6, null) })
  items.push({ key: 25.4 + 1.3 + 0.6 + 0.2, s: hqScreen(all) })
  items.push({ key: DISK_AT.x + DISK_AT.wide / 2 + DISK_AT.y + 0.2, s: diskScreen(disk) })
  if (decor) items.push({ key: 21 + 1, s: plant(20.6, 0.6) }, { key: 31.4 + 10.4, s: plant(31, 10) })
  items.push({ key: 28.4 + 1.2, s: box(28.2, 0.3, 0, 1.6, 0.6, 2.4, p.wood, p.woodSide, shade(p.woodSide, 0.85)) + box(28.25, 0.35, 0.8, 1.5, 0.55, 0.06, shade(p.wood, 1.2), p.woodSide, p.woodSide) + box(28.25, 0.35, 1.6, 1.5, 0.55, 0.06, shade(p.wood, 1.2), p.woodSide, p.woodSide) })
  // lobby: a sofa corner, a water cooler by the coffee counter, plants (the one at 19.2, 10.2 is Producto's)
  ;[4, 8].forEach((y) => items.push({ key: 3 + y + 0.4, s: box(3, y, 0, 3, 0.3, 1.25, shade(p.sofa, 1.15), p.sofa, p.sofaSide) + box(3, y + 0.3, 0, 3, 0.7, 0.5, shade(p.sofa, 1.15), p.sofa, p.sofaSide) }))
  items.push({ key: 4 + 6 + 1, s: box(4, 6, 0, 2, 1, 0.45, p.wood, p.woodSide, shade(p.woodSide, 0.85)) })
  items.push({ key: 4.6 + 0.6 + 0.8, s: box(4.5, 0.4, 0, 0.9, 0.7, 1.9, '#d9d9d9', '#8f8f8f', '#6f6f6f') + box(4.65, 1.1, 0.9, 0.6, 0.02, 0.5, '#2b2b2b', '#2b2b2b', '#2b2b2b') })
  if (decor) items.push({ key: 0.6 + 0.6, s: plant(0.4, 0.4) }, { key: 19.6 + 10.6, s: plant(19.2, 10.2) })
  items.push(...lobbyCorners())
  return pack(items.sort((a, b) => a.key - b.key).map((i) => i.s), rows, 'f', outlined)
}

/* ---------- click zones: where the map's Buttons sit over the picture (bandhits.tsx) ---------- */
const SHORT = live(ROLE_ORDER, (r) => t(`role.short.${r}`))
/**
 * Clickable zones: one per occupied tile. An agent at rest owns the prism standing on its tile: the two front faces
 * of a box as wide as the tile, from the tile's front edges (a V) up to its status bubble. A board owns its face,
 * slanted along the wall. Rectangles are all the pane can draw, so each prism is cut into SLICES vertical slices, each
 * covering its strip of the prism. Walkers own no tile until they arrive. Every number is a fraction of the scene.
 */
// priority: 1 for a body or a board, 0 for a status bubble; where zones overlap a body always beats a bubble, so
// the bubble of an agent in front never hides the agent behind it, and between equals the one drawn in front wins.
export type Zone = { id: string; key: string; group: string; label: string; depth: number; priority: number; x0: number; x1: number; y0: number; y1: number }
export const SLICES = 4 // the prism's V
/**
 * The map's click zones. By default every office gets a zone per person, its board and its usage screen. With `focus`
 * (the office selected in the pane) only that office does; every other office is its island zone alone (it selects
 * the office). With `light`, every office is its island zone alone (islands only). Agents off the islands (walking to
 * you, in the lobby) keep their prisms, and the HQ screen is always there.
 */
// With less `dt` than FULL, only what is drawn takes a click: no people, no person's zone (each office is its island);
// no decor, no office screen or board. Your office's notes, HQ and disk screens are drawn, and clicked, at every step.
export function hotspots(w0: AgentvilleWorld, now: number, light = false, focus?: string, notes: string | null = null, dt: Detail = FULL): Zone[] {
  const w = clone(w0)
  settle(w, now)
  const v = viewOf(rowsOf(w)), fx = (X: number) => (X - v.x) / v.w, fy = (Y: number) => (Y - v.y) / v.ht
  const zones: Zone[] = []
  // A crowded floor clicks by island: one zone per island (it selects the session) instead of one prism per agent,
  // which would pass the ~1,800 elements that broke clicks before. Agents off the islands keep their prisms.
  const onIsland = (a: AgentvilleAgent) => { const r = deptOf(w, a)?.room; return !!r && !deptOf(w, a)!.away && a.x > r[0]! && a.x < r[2]! && a.y > r[1]! && a.y < r[3]! }
  const crowded = light || w.agents.filter((a) => !a.walk).length > AGENT_ZONES_MAX
  const fine = (deptId: string) => (focus !== undefined ? !light && deptId === focus : !crowded)
  for (const a of dt.people ? w.agents : []) {
    if (a.walk || (!fine(a.dept) && onIsland(a))) continue
    const [tx, ty] = tileOf(w, a, a)
    const [Xc, Yc] = P(tx + 0.5, ty + 0.5) // tile centre; its left/right corners sit 16 to each side, its front 8 below
    const lift = a.posture === 'sit' ? -6 : 0
    const [, feet] = P(a.x, a.y)
    const height = Yc + 8 - (feet + lift - totalRows(a.posture, a.facing[0] === 'b') * PX - BUBBLE_H)
    const k = fine(a.dept) ? SLICES : 2 // away from the focus (or on a crowded floor) prisms are coarser, to stay in budget
    for (let i = 0; i < k; i++) {
      const xa = Xc - 16 + (32 * i) / k, xb = Xc - 16 + (32 * (i + 1)) / k // the next slice's xa, bit for bit
      // The tile's front edges form a V (y = Yc + 8 - |X - Xc| / 2): a slice reaches down to its lowest point and,
      // shifted up by the prism's height, up to its highest one.
      const near = xa < Xc && xb > Xc ? 0 : Math.min(Math.abs(xa - Xc), Math.abs(xb - Xc)), far = Math.max(Math.abs(xa - Xc), Math.abs(xb - Xc))
      const yBottom = Yc + 8 - near / 2, yTop = Yc + 8 - far / 2 - height
      const base = { id: a.id, group: a.id, label: SHORT[a.role], depth: a.x + a.y, x0: fx(xa), x1: fx(xb) }
      zones.push({ ...base, key: `${a.id}-${i}`, priority: 1, y0: fy(yTop + BUBBLE_H), y1: fy(yBottom) })
      if (!silent(a, now, dt.bubbles)) zones.push({ ...base, key: `${a.id}-${i}-bubble`, priority: 0, y0: fy(yTop), y1: fy(yTop + BUBBLE_H) })
    }
  }
  for (const d of w.depts) {
    if (d.away || !d.room.length) continue
    // A family's parent at rest, lights off: its room opens the parent.
    if (!present(d)) { zones.push(...islandZones(d, `${d.id}-jefe`, fx, fy)); continue }
    if (!w.agents.some((a) => a.id === `${d.id}-jefe`)) continue
    // Its usage screen: a click opens the office's card over the map; it yields to the people
    // in front of it.
    const sx = d.room[0]! + SCREEN_AT.dx, sy = d.room[1]! + SCREEN_AT.dy + 0.08
    const screenZone = (priority: number) => {
      const [Xa, Ya] = P(sx, sy, 2.3), [Xb, Yb] = P(sx + SCREEN_AT.wide, sy, 0.55)
      return { id: `${d.id}-jefe`, key: `screen-${d.id}-0`, group: `screen-${d.id}`, label: t('zone.screen'), depth: sx + sy, priority, x0: fx(Xa), x1: fx(Xb), y0: fy(Ya), y1: fy(Yb) }
    }
    // Away from the focus (or on a crowded floor) an office is a single zone: its screen and card come alive once it is
    // selected.
    if (!fine(d.id) || !dt.people) { zones.push(...islandZones(d, `${d.id}-jefe`, fx, fy)); continue }
    if (!dt.decor) continue // its people only
    // The board's face runs along the island's back edge (world x), from its legs on the floor up to its top edge.
    // shortcut: one rectangle over the slanted screen (its corners spill a little); slices would push the pane past its
    // element budget. Upgrade if a neighbour's click is ever stolen.
    zones.push(screenZone(1))
    const bx = d.room[0]! + 3.4, by = d.room[1]! + 0.23
    for (let i = 0; i < SLICES; i++) {
      const xa = bx + (3.6 * i) / SLICES, xb = bx + (3.6 * (i + 1)) / SLICES
      const [Xa, Ya] = P(xa, by, 2.3), [Xb, Yb] = P(xb, by, 0)
      zones.push({ id: `${d.id}-jefe`, key: `board-${d.id}-${i}`, group: `board-${d.id}`, label: t('zone.board'), depth: bx + by, priority: 1, x0: fx(Xa), x1: fx(Xb), y0: fy(Ya), y1: fy(Yb) })
    }
  }
  // Your office's HQ screen: its card ranks every team by spend.
  const HQ_SLICES = 1 // one screen that never moves: a single zone keeps the click grid (and the pane) light
  for (let i = 0; i < HQ_SLICES; i++) {
    const hy = HQ_AT.y + 0.08, xa = HQ_AT.x + (HQ_AT.wide * i) / HQ_SLICES, xb = xa + HQ_AT.wide / HQ_SLICES
    const [Xa, Ya] = P(xa, hy, 3.1), [Xb, Yb] = P(xb, hy, 0)
    zones.push({ id: 'hq', key: `screen-hq-${i}`, group: 'screen-hq', label: t('zone.hq'), depth: HQ_AT.x + hy, priority: 1, x0: fx(Xa), x1: fx(Xb), y0: fy(Ya), y1: fy(Yb) })
  }
  // The disk screen beside it: its card lists what takes room. Its zone is the drawn screen (darkScreen's panel), no more.
  if (notes) zones.push(notesZone(notes, fx, fy)) // in front of whoever stands by your desk
  zones.push({ id: 'disk', key: 'screen-disk-0', group: 'screen-disk', label: t('zone.disk'), depth: DISK_AT.x + DISK_AT.y + 0.08, priority: 1, ...diskScreenRect(fx, fy) })
  return zones
}
/** The tile an agent at `p` stands on: on its island tiles count from the island's origin (fractional on the even
 * grid), elsewhere from the floor's. */
function tileOf(w: AgentvilleWorld, a: AgentvilleAgent, p: { x: number; y: number }): [number, number] {
  const r = deptOf(w, a)?.room, on = !!r?.length && p.x > r[0]! && p.x < r[2]! && p.y > r[1]! && p.y < r[3]!
  const ox = on ? r![0]! : 0, oy = on ? r![1]! : 0
  return [ox + Math.floor(p.x - ox), oy + Math.floor(p.y - oy)]
}
/** Scene units above the head the status bubble takes: it belongs to the agent's zone. */
const BUBBLE_H = 30
/** Above this many agents at rest on a floor, islands are clicked whole (see hotspots). */
export const AGENT_ZONES_MAX = PER_FLOOR * 4 // a full floor: the click grid's own size picks the focus (see register.tsx)
/** An island as one clickable shape: its floor's diamond raised by an agent's height and bubble, cut into slices.
 * Priority 0.5: a person or board drawn behind a raised island in front of it stays clickable, bubbles do not. */
function islandZones(d: AgentvilleDept, id: string, fx: (X: number) => number, fy: (Y: number) => number, k = 1): Zone[] {
  const [ox, oy, ex, ey] = d.room as [number, number, number, number]
  const [Xl, Yl] = P(ox, ey), [Xt, Yt] = P(ox, oy), [Xr, Yr] = P(ex, oy), [Xb, Yb] = P(ex, ey)
  const along = (a: [number, number], b: [number, number], X: number) => a[1] + ((b[1] - a[1]) * (X - a[0])) / (b[0] - a[0])
  const upper = (X: number) => (X <= Xt ? along([Xl, Yl], [Xt, Yt], X) : along([Xt, Yt], [Xr, Yr], X))
  const lower = (X: number) => (X <= Xb ? along([Xl, Yl], [Xb, Yb], X) : along([Xb, Yb], [Xr, Yr], X))
  const lift = 44 * PX + BUBBLE_H, out: Zone[] = []
  for (let i = 0; i < k; i++) {
    const xa = Xl + ((Xr - Xl) * i) / k, xb = Xl + ((Xr - Xl) * (i + 1)) / k
    const top = Math.min(upper(xa), upper(xb), xa < Xt && Xt < xb ? Yt : Infinity) - lift
    const bottom = Math.max(lower(xa), lower(xb), xa < Xb && Xb < xb ? Yb : -Infinity)
    out.push({ id, key: `isle-${d.id}-${i}`, group: `isle-${d.id}`, label: d.name, depth: ox + oy + (ISLE_W + ISLE_D) / 2, priority: 0.5, x0: fx(xa), x1: fx(xb), y0: fy(top), y1: fy(bottom) })
  }
  return out
}

/* ---------- the tour's targets ---------- */
/** The tour's steps in order: modals (lang, flow, prefs, done), one spotlight per map target, and `chat`, a spotlight
 * on a sample list row the overlay draws itself (no map target: always shown). */
export const TOUR_STEP_IDS = ['lang', 'island', 'jefe', 'team', 'board', 'screen', 'lobby', 'despacho', 'chat', 'flow', 'prefs', 'done'] as const
export type TourStep = (typeof TOUR_STEP_IDS)[number]
export type TourTarget = 'island' | 'jefe' | 'team' | 'board' | 'screen' | 'lobby' | 'despacho'
/** A target as fractions of the map [x0, y0, x1, y1], or null when the house has nothing to show for it. */
export type TourRect = [number, number, number, number]
export type TourTargets = Record<TourTarget, TourRect | null> & { focusId: string | null; steps: TourStep[] }
const OFFICE_STEPS = new Set<TourStep>(['island', 'jefe', 'team', 'board', 'screen'])
const isTarget = (s: TourStep): s is TourTarget => OFFICE_STEPS.has(s) || s === 'lobby' || s === 'despacho'
/** The steps shown: a missing target skips its step; `noMap` (house layer only) skips the office steps. */
export const tourSteps = (tg: Record<TourTarget, TourRect | null>, noMap = false): TourStep[] =>
  TOUR_STEP_IDS.filter((s) => !isTarget(s) || (tg[s] !== null && !(noMap && OFFICE_STEPS.has(s))))
const bbox = (rs: number[][]): TourRect | null => (rs.length
  ? [Math.max(0, Math.min(...rs.map((r) => r[0]!))), Math.max(0, Math.min(...rs.map((r) => r[1]!))), Math.min(1, Math.max(...rs.map((r) => r[2]!))), Math.min(1, Math.max(...rs.map((r) => r[3]!)))]
  : null)
const zoneRects = (zones: Zone[], groups: string[]) => zones.filter((z) => groups.includes(z.group)).map((z) => [z.x0, z.y0, z.x1, z.y1])
/**
 * What each tour step lights, as the bounding box of its click zones (hotspots with the focus office fine). Focus: the
 * given office if it is on this floor, else the first by slot. Team: the focus office's helpers at their desks, else
 * the first office with any, else the focus island. Lobby and despacho always exist.
 */
export function tourTargets(view: AgentvilleWorld, now: number, focus?: string): TourTargets {
  const w = clone(view)
  settle(w, now)
  const v = viewOf(rowsOf(w)), fx = (X: number) => (X - v.x) / v.w, fy = (Y: number) => (Y - v.y) / v.ht
  const pt = ([X, Y]: [number, number]) => [fx(X), fy(Y), fx(X), fy(Y)]
  const floor = (x0: number, x1: number) => bbox([P(x0, 0), P(x1, 0), P(x1, STRIP), P(x0, STRIP)].map(pt))!
  const depts = w.depts.filter((d) => !d.away).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  const d = depts.find((x) => x.id === focus) ?? depts.find((x) => present(x) && !x.parent) ?? depts.find(present) ?? depts[0]
  const zones = hotspots(view, now, false, d?.id)
  const crew = (id: string) => w.agents.filter((a) => {
    const r = depts.find((x) => x.id === id)!.room
    return a.dept === id && a.role !== 'jefe' && !a.walk && a.x > r[0]! && a.x < r[2]! && a.y > r[1]! && a.y < r[3]!
  }).map((a) => a.id)
  const island = d ? bbox(islandZones(d, d.id, fx, fy).map((z) => [z.x0, z.y0, z.x1, z.y1])) : null
  const other = d && !crew(d.id).length ? depts.find((x) => crew(x.id).length) : undefined
  const team = !d ? null : other ? bbox(zoneRects(hotspots(view, now, false, other.id), crew(other.id))) : bbox(zoneRects(zones, crew(d.id))) ?? island
  const label = t('scene.lobby'), [px, py] = P(...LOBBY_PLAQUE), pw = label.length * 7.4 + 16 // the plaque, as houseLayer draws it
  // The lobby's fixed pieces: the TV corner, the game cushions, both sofas with the coffee table, the coffee corner
  // (counter, machine and cooler), and whoever rests on a chat or game spot. None of it reaches Producto's room.
  const block = (x0: number, y0: number, x1: number, y1: number, z: number) => bbox([0, z].flatMap((ht) => [P(x0, y0, ht), P(x1, y0, ht), P(x1, y1, ht), P(x0, y1, ht)].map(pt)))!
  const resting = w.agents.filter((a) => LOBBY_SPOTS.some((q) => q.kind !== 'coffee' && Math.hypot(q.x - a.x, q.y - a.y) < 0.05)).map((a) => a.id)
  const tg = {
    island, team,
    jefe: d ? bbox(zoneRects(zones, [`${d.id}-jefe`])) : null,
    board: d ? bbox(zoneRects(zones, [`board-${d.id}`])) : null,
    screen: d ? bbox(zoneRects(zones, [`screen-${d.id}`])) : null,
    lobby: bbox([block(8.3, 0.1, 10.82, 0.65, 1.8), block(7.12, 2.2, 9.88, 2.96, 0.32), block(3, 4, 6, 9, 1.25), block(1.4, 0.15, 5.4, 1.1, 1.9), [fx(px - pw / 2), fy(py - 11), fx(px + pw / 2), fy(py + 9)], ...zoneRects(zones, resting)]),
    despacho: bbox([floor(20, W), ...zoneRects(zones, ['screen-hq'])]),
  }
  return { ...tg, focusId: d?.id ?? null, steps: tourSteps(tg) }
}

/**
 * Partitions the scene so every point belongs to at most one zone, the one drawn in front (in the pane an element
 * over a Button takes its clicks, so zones may not overlap). Every zone edge cuts the scene into a grid; each cell
 * goes to the covering zone with the highest priority, then the deepest (drawn in front); then each band's cells with the same owner
 * merge into one run. Bands and runs cover [0, 1] exactly, with no gaps or overlaps. Fractions of the scene.
 */
/** Zone edges closer than this (a fraction of the map, a few px) are one edge: fewer bands and runs to draw. Kept
 * under the prism's V steps (4 scene units), so the shape survives. */
export const EDGE_EPS = 1 / 200
/** The most elements the map's click layer (bandhits.tsx: its band Boxes, one Client per band that holds a zone, and
 * what those draw) may take: the first of three zone sets that fits is drawn (a zone per person in every office, then
 * only in the selected office, then every office clicked whole), else none. Each band Client's tree stays far under a
 * Client's 100,000 characters (under 20,000 on a full floor); the bound left is the pane's TREE_LIMIT. Measured
 * 2026-10-18 at 110 columns (~32 bands of 18 px): per person everywhere costs 412 elements for 4 full offices, 641 for
 * 8, 806 for 12, 959 for 16; a full floor then keeps per person in the selected office (~425). */
export const GRID_MAX = 690 // +10 (AT): the disk screen's zone is the screen alone, so its two sides are empty runs now
export type ZoneBand = { y0: number; y1: number; runs: { x0: number; x1: number; zone: Zone | null }[] }
export function zoneGrid(zones: Zone[]): ZoneBand[] {
  const edges = (vals: number[]) => {
    const out: number[] = []
    for (const v of [0, 1, ...vals.map((x) => Math.min(1, Math.max(0, x)))].sort((p, q) => p - q)) if (!out.length || v - out[out.length - 1]! > EDGE_EPS) out.push(v)
    return out
  }
  const xs = edges(zones.flatMap((z) => [z.x0, z.x1])), ys = edges(zones.flatMap((z) => [z.y0, z.y1]))
  const bands: ZoneBand[] = []
  for (let j = 0; j + 1 < ys.length; j++) {
    const y0 = ys[j]!, y1 = ys[j + 1]!, ym = (y0 + y1) / 2
    const here = zones.filter((z) => z.y0 <= ym && ym < z.y1)
    const runs: ZoneBand['runs'] = []
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!, x1 = xs[i + 1]!, xm = (x0 + x1) / 2
      let owner: Zone | null = null
      for (const z of here) if (z.x0 <= xm && xm < z.x1 && (!owner || z.priority > owner.priority || (z.priority === owner.priority && z.depth > owner.depth))) owner = z
      const last = runs[runs.length - 1]
      if (last && last.zone?.group === owner?.group) last.x1 = x1 // one run per agent or board, not per slice
      else runs.push({ x0, x1, zone: owner })
    }
    const prev = bands[bands.length - 1]
    const same = prev && prev.runs.length === runs.length && prev.runs.every((r, k) => r.zone?.group === runs[k]!.zone?.group && Math.abs(r.x0 - runs[k]!.x0) < 1e-9 && Math.abs(r.x1 - runs[k]!.x1) < 1e-9)
    if (same) prev.y1 = y1
    else bands.push({ y0, y1, runs })
  }
  return bands
}

/* ---------- faces and names, for the pane ---------- */
export const NAMES = ['Ana', 'Leo', 'Sofi', 'Tomás', 'Vale', 'Nico', 'Lucía', 'Mateo', 'Caro', 'Juanes', 'Isa', 'Pedro', 'Majo', 'Santi', 'Dani', 'Gabi']
/** An agent's name, fixed by its id: a session's chief and team keep theirs while the session lives. */
export const agentName = (agentId: string) => NAMES[(hash(agentId) >>> 4) % NAMES.length]!
/** The colour of each role's shirt (and yours): an agent's speech bubble wears it. */
export const SHIRTS: Record<AgentvilleRole | 'me', string> = { jefe: OUTFITS.jefe.c!, impl: OUTFITS.impl.c!, rev: OUTFITS.rev.c!, qa: OUTFITS.qa.c!, me: '#4a4a44' }
/**
 * An agent's face as the map draws it (hair and skin from its id; yours fixed), cut at the shoulders, as an Svg. With
 * `box`, the face sits in its own small rounded box (6:5), drawn in the picture so the pane adds no padding around it.
 */
export function faceSvg(role: AgentvilleRole | 'me', agentId: string, width = 34, box?: { fill: string; stroke: string }): string {
  const ht = hash(agentId), col = role === 'me' ? colors('me', '#2b2b2b', '#d8a47f', '#f2a93b') : colors(role, HAIRS[ht % HAIRS.length]!, SKINS[(ht >>> 3) % SKINS.length]!, '#f2a93b')
  const head = rowsToPaths(torsoRows(role, false).slice(0, 15), 0, col)
  if (!box) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 0 20 15" width="${width}" height="${Math.round((width * 15) / 20)}" shape-rendering="crispEdges">${head}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -3 24 20" width="${width}" height="${Math.round((width * 20) / 24)}"><rect x="-11.6" y="-2.6" width="23.2" height="19.2" rx="3.2" fill="${box.fill}" stroke="${box.stroke}" stroke-width="0.7"/><g shape-rendering="crispEdges">${head}</g></svg>`
}
/** A session that waits only on its suggested sessions (no question, no permission): it suggests, it does not block. */
export const onlySuggests = (a: AgentvilleAgent, d?: AgentvilleDept) => a.role === 'jefe' && a.state === 'esperando' && !a.req && !a.cmd && !d?.ask && !!d?.offers?.length
/**
 * A state as a small pill: its icon and its words, in its colour, every state alike: 22 px tall, 10 px in from each side,
 * a 12 px icon, 6 px to the words (12.5 px, weight 600), both centred on the pill's middle. Its width comes from the
 * words' measured advances (chrome.ts, at weight 700, a little wider than 600), so a label never reaches the border.
 * `sugiere`: the chip's dot instead of an icon (a suggestion waits on nobody).
 */
export function chipSvg(state: AgentvilleStateName | 'sugiere', label: string, color: string): string {
  const H = 22, B = 1.2, w = Math.ceil(B + 10 + 12 + 6 + textW(label, 'w700', 12.5) + 10 + B)
  const icon = state === 'sugiere' ? `<circle cx="${10 + B + 6}" cy="11" r="3.5" fill="${color}"/>`
    : `<path transform="translate(${10 + B} 5) scale(0.75)" d="${state === 'trabajando' ? 'M3 8h.01M8 8h.01M13 8h.01' : ICONS[state]}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
  // y 15.4: the baseline that puts 12.5 px SF capitals (0.7 em) on the pill's middle line, as the icon is.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}"><rect x="${B / 2}" y="${B / 2}" width="${w - B}" height="${H - B}" rx="${(H - B) / 2}" fill="none" stroke="${color}" stroke-width="${B}"/>${icon}<text x="${10 + B + 12 + 6}" y="15.4" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-size="12.5" font-weight="600" fill="${color}">${esc(label)}</text></svg>`
}
/** A row of tabs as the design draws them: the words, the active one bold and underlined; each tab's share of the
 * width, for the invisible Buttons laid over them. */
export function tabsSvg(tabs: { key: string; label: string }[], active: string, ink: string, dim: string): { svg: string; width: number; shares: number[] } {
  const ws = tabs.map((t) => Math.round(t.label.length * 7.4 + 22)), width = ws.reduce((a, b) => a + b, 0)
  let x = 0, body = ''
  tabs.forEach((t, i) => {
    const on = t.key === active
    body += `<text x="${x + 11}" y="17" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-size="13" font-weight="600" fill="${on ? ink : dim}">${esc(t.label)}</text>`
    if (on) body += `<rect x="${x}" y="27" width="${ws[i]}" height="2" fill="${ink}"/>`
    x += ws[i]!
  })
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 29" width="${width}" height="29">${body}</svg>`, width, shares: ws.map((w) => w / width) }
}
/** A state's small icon (the bubbles' own), as an Svg in the given colour. */
export const stateIcon = (state: AgentvilleStateName, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"><path d="${state === 'trabajando' ? 'M3 8h.01M8 8h.01M13 8h.01' : ICONS[state]}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/* ---------- layer C: the agents ---------- */
const ICONS: Record<string, string> = {
  leyendo: 'M2 4.2c2-.9 4-.9 6 .4 2-1.3 4-1.3 6-.4v8c-2-.9-4-.9-6 .4-2-1.3-4-1.3-6-.4z M8 4.6v8',
  esperando: 'M8 3v6.2 M8 12.4v.8',
  inactivo: 'M3.5 5h4l-4 5h4M9 3.5h3.5L9 8h3.5',
  terminado: 'M3.2 8.4l3 3 6.6-6.8',
  error: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
}
function bubble(a: AgentvilleAgent, top: number, now: number, suggests = false): string {
  // At the frame's place itself, no group to move it: the same numbers (top rounded first, as the group's was).
  // The frame itself a shared shape under the 'svg-use' switch; what it holds stays inline (SMIL in a <use> is unproven).
  const T = r1(top), path = (fill: string, w: number, T: number) => `<path d="M${-w / 2}${n(T - 9)}h${w}v15h${-w / 2 + 4}l-4 4-4-4h${-w / 2 + 4}z" fill="${fill}" stroke="#1d2433" stroke-width="1.4" stroke-linejoin="round"/>`
  const frame = (fill: string, inner: string, w = 22, ink = '') => `${reuse ? placeAt(`b${fill.slice(1)}${w}`, 0, T, () => path(fill, w, 0)) : path(fill, w, T)}<g transform="translate(0 ${n(T - 1.5)})"${ink}>${inner}</g>`
  const icon = (d: string, color: string) => `<path transform="translate(-6 -6) scale(0.75)" d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  if (a.calledUntil > now) return frame('#fff', `<text x="0" y="4" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#1d2433">${t('scene.hello')}</text>`, 30)
  if (a.state === 'trabajando') return frame('#fff', `${[-5, 0, 5].map((x, i) => `<circle${x ? ` cx="${x}"` : ''} r="1.8"><animate attributeName="opacity" values=".25;1;.25" dur="1.2s"${i ? ` begin="${i * 0.2}s"` : ''} repeatCount="indefinite"/></circle>`).join('')}`, 22, ' fill="#1d2433"')
  if (suggests) return frame('#fff', '<circle r="3" fill="#6b7280"/>') // suggests sessions: no amber, no ring (it blocks nobody)
  if (a.state === 'esperando') return `<circle cx="0" cy="${n(top - 2)}" r="10" fill="none" stroke="#f2a93b" stroke-width="2"><animate attributeName="r" values="10;17" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/></circle>` + frame('#f2a93b', icon(ICONS.esperando!, '#1b1404'))
  if (a.state === 'error') return frame('#ef5b5b', icon(ICONS.error!, '#ffffff'))
  if (a.state === 'terminado') return frame('#fff', icon(ICONS.terminado!, '#2c8a4f'))
  if (a.state === 'leyendo') return frame('#fff', icon(ICONS.leyendo!, '#1d2433'))
  return frame('#fff', icon(ICONS.inactivo!, '#6b7280'))
}
function nameTag(text: string, y: number): string {
  const w = text.length * 6.2 + 12
  return `<g transform="translate(0 ${n(y)})"><rect x="${n(-w / 2)}" y="-9" width="${n(w)}" height="15" rx="3" fill="rgba(0,0,0,0.72)"/><text x="0" y="2.5" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="#ffffff">${esc(text)}</text></g>`
}
// Lobby props in sprite pixels, laid over the body from the row given: a mug held in the near hand, and a pad's two
// white grips showing beside the hands of a player seen from behind.
const CUP = ['oooo', 'oDDo', 'oWWo', 'oWWoo', 'oWWk', 'oooo']
const PAD = ['oooo............oooo', 'oWWo............oWWo', 'oWWo............oWWo', 'oooo............oooo']
/** What a lobby agent is doing, drawn inside its (mirrored) sprite so it follows the facing. SMIL only. */
function pastime(kind: LobbyKind, spot: number, total: number, col: Record<string, string>): string {
  const top = -total, c = { ...col, W: '#f4f4f0', D: '#5a3a22' }, loop = 'repeatCount="indefinite"'
  if (kind === 'coffee') return rowsToPaths(CUP, top + 22, c) + steam(-9.5, top + 18, 1)
  if (kind === 'game') return `<g>${rowsToPaths(PAD, top + 25, c)}<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.6;0 0" dur="0.5s" ${loop}/></g>`
  // chat: a small talk bubble beside the head; the three on a sofa take turns
  return `<g opacity="0"><animate attributeName="opacity" values="${[0, 1, 2].map((i) => (i === spot % 3 ? 1 : 0)).join(';')}" calcMode="discrete" dur="7.5s" ${loop}/>`
    + `<path d="M-22 ${top - 6}h11v7h-3l2 2.5l-4.5 -2.5h-5.5z" fill="#ffffff" stroke="#1d2433" stroke-width="0.8" stroke-linejoin="round"/>`
    + `<path d="M-20 ${top - 3.5}h7M-20 ${top - 1.5}h4.5" stroke="#9aa0aa" stroke-width="1"/></g>`
}
/** Whether an agent's bubble is left out: without `bubbles`, anyone at work who is not being called (agentSvg, hotspots). */
const silent = (a: AgentvilleAgent, now: number, bubbles: boolean) => !bubbles && a.state === 'trabajando' && !(a.calledUntil > now)
function agentSvg(w: AgentvilleWorld, a: AgentvilleAgent, now: number, bubbles = true): string {
  // staff (no office) wear no badge colour of a session and show no state bubble; without `bubbles`, nobody at work does
  const quiet = silent(a, now, bubbles)
  const col = colors(a.role, a.hair, a.skin, w.depts.find((d) => d.id === a.dept)?.color ?? SEC_INK), bub = (top: number) => (a.dept && !quiet ? bubble(a, top, now, onlySuggests(a, w.depts.find((d) => d.id === a.dept))) : '')
  if (!a.walk) {
    const back = a.facing[0] === 'b', sit = a.posture === 'sit', total = totalRows(a.posture, back), [X, Y] = P(a.x, a.y), lift = sit ? -6 : 0
    const rows = [torsoRows(a.role, back), sit ? (back ? SIT_BACK : SIT) : LEGS_A], flip = a.facing[1] === 'r' ? -1 : 1
    const top = -(total * PX + (sit ? 12 : 8))
    const spot = LOBBY_SPOTS[a.lobbySpot], kind = spot && (a.state === 'inactivo' || a.state === 'terminado') && !(a.calledUntil > now) && Math.hypot(spot.x - a.x, spot.y - a.y) < 0.05 ? spot.kind : null
    let s = `<g transform="translate(${n(X)} ${n(Y + lift)})"><ellipse rx="10" ry="4" fill="rgba(0,0,0,.28)"/>${kind ? `<g transform="scale(${flip * PX} ${PX})">${body(rows, -total, col)}${pastime(kind, a.lobbySpot, total, col)}</g>` : body(rows, -total, col, flip)}${bub(top)}</g>`
    if (sit && a.facing === 'br' && SCREEN[a.state] && !kind) s += outlined(chairBack(a.x, a.y))
    return s
  }
  // Walking: SMIL moves the group along the route; begin is negative so a redraw resumes mid-walk.
  const wk = a.walk, el = Math.min((now - wk.start) / 1000, wk.dur), beg = `begin="${n(-el)}s"`, dur = `dur="${n(wk.dur)}s"`
  const len = pathLen(wk.pts), facings: AgentvilleFacing[] = [], keys: string[] = []
  let acc = 0
  for (let i = 1; i < wk.pts.length; i++) {
    const [x0, y0] = wk.pts[i - 1] as [number, number], [x1, y1] = wk.pts[i] as [number, number]
    keys.push(String(Math.round((acc / (len || 1)) * 1000) / 1000)); facings.push(facingOf(x1 - x0, y1 - y0)); acc += Math.hypot(x1 - x0, y1 - y0)
  }
  const kt = `keyTimes="${keys.join(';')}"`, disc = `calcMode="discrete" ${dur} ${beg} fill="freeze"`
  const route = 'M' + wk.pts.map(([x, y]) => P(x!, y!).map(n).join(' ')).join('L')
  const steps = `dur="0.32s" calcMode="discrete" repeatDur="${n(wk.dur)}s" ${beg} fill="freeze"`
  const top = -(44 * PX + 8)
  return `<g><animateMotion ${dur} ${beg} fill="freeze" path="${route}"/><ellipse rx="10" ry="4" fill="rgba(0,0,0,.28)"/>`
    + `<g transform="scale(${PX})"><animateTransform attributeName="transform" type="scale" values="${facings.map((f) => (f[1] === 'r' ? `${-PX} ${PX}` : `${PX} ${PX}`)).join(';')}" ${kt} ${disc}/>`
    + `<g><animate attributeName="opacity" values="${facings.map((f) => (f[0] === 'f' ? 1 : 0)).join(';')}" ${kt} ${disc}/>${body([torsoRows(a.role, false)], -44, col)}</g>`
    + `<g><animate attributeName="opacity" values="${facings.map((f) => (f[0] === 'b' ? 1 : 0)).join(';')}" ${kt} ${disc}/>${body([torsoRows(a.role, true)], -44, col)}</g>`
    + `<g>${body([LEGS_A], -14, col)}<animate attributeName="opacity" values="1;0" ${steps}/></g>`
    + `<g opacity="0">${body([LEGS_B], -14, col)}<animate attributeName="opacity" values="0;1" ${steps}/></g></g>`
    + `${bub(top)}</g>`
}
/** Where an office's name tag sits, from its island's origin (world units). */
export const TAG_AT = { dx: 4.05, dy: 0.15, z: 4.1, chars: 14 }
/** A family's sign (on its parent's room, in place of the tag) and a child's Encargado chip, above its Jefe's seat. */
export const SIGN_CHARS = 20, CHIP_AT = { dx: SEATS.jefe[0] + 0.5, dy: SEATS.jefe[1] + 1.9, z: 4.4 } // over the Jefe's head, left of its own tag
// The state bubble's frame tops out at -64.75 (seated) and -72 (standing) from the feet: a tag's box (9 above its
// line) ends just above it.
const ROLE_TAG_SIT = -74.5, ROLE_TAG_STAND = -81.5, ROLE_AIR = 4
export type Label = { kind: 'tag' | 'sign' | 'chip' | 'role'; id: string; rect: [number, number, number, number]; s: string }
/** A team office member's role tag, from its subagent type (the team flow's), else its desk's short role name. */
export function roleTag(a: Pick<AgentvilleAgent, 'role' | 'kind'>): string {
  const k = (a.kind ?? '').split(':').pop()!
  const key = ({ builder: 'tag.builder', 'spec-writer': 'tag.spec', 'code-reviewer': 'tag.code', 'security-reviewer': 'tag.security', 'ux-reviewer': 'tag.ux', 'ui-reviewer': 'tag.ui', approver: 'tag.approver' } as const)[k as 'builder']
  return key ? t(key) : SHORT[a.role]
}
/**
 * The names floating over the map's rooms, in map pixels: each office's tag; a family parent's sign instead (its name,
 * then how many rooms, "+N" past FAM_MAX), above its Jefe; an Encargado chip over each child room's Jefe.
 */
// Each office's name, a sign over its island's back edge, right of its Jefe and above its usage screen and its team's
// bubbles, so it hides nobody of its own office nor the screen's words; at most TAG_AT.chars characters (16 would not
// fit between the Jefe and the island's right corner), so it stays over its island.
export function labelsOf(w: AgentvilleWorld): Label[] {
  const out: Label[] = []
  for (const d of w.depts.filter((x) => !x.away && x.room.length)) {
    const [ox, oy] = d.room as [number, number], [x, y] = P(ox + TAG_AT.dx, oy + TAG_AT.dy, TAG_AT.z)
    if (d.fam) {
      const lines = [cut(d.name, SIGN_CHARS), (d.fam.rooms === 1 ? t('fam.rooms.one') : t('fam.rooms.many', { n: d.fam.rooms })) + (d.fam.more ? ` ${t('fam.more', { n: d.fam.more })}` : '')]
      // At the tag's height, lifted just above its Jefe's bubble (two lines are taller than a tag), centred over the Jefe
      // so it leaves the lobby's sofa beside a top-row office uncovered.
      const wd = Math.max(lines[0]!.length * 6.2, lines[1]!.length * 5.6) + 14, sx = P(ox + SEATS.jefe[0] + 1.5, oy + SEATS.jefe[1] + 1.5)[0]
      out.push({ kind: 'sign', id: d.id, rect: [sx - wd / 2, y - 30, sx + wd / 2, y - 2], s: `<g transform="translate(${n(sx)} ${n(y)})"><rect x="${n(-wd / 2)}" y="-30" width="${n(wd)}" height="28" rx="3" fill="rgba(0,0,0,0.78)" stroke="${d.color}" stroke-width="2"/><text x="0" y="-17.5" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#ffffff">${esc(lines[0]!)}</text><text x="0" y="-5.5" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="600" fill="#dce9f7">${esc(lines[1]!)}</text></g>` })
    } else {
      const text = cut(d.name, TAG_AT.chars), wd = text.length * 6.2 + 12
      out.push({ kind: 'tag', id: d.id, rect: [x - wd / 2, y - 9, x + wd / 2, y + 6], s: `<g transform="translate(${n(x)} 0)">${nameTag(text, y)}</g>` })
    }
    // A team office: a role tag over each of its people at rest, its Jefe's too, just above the state bubble (over the
    // head, as the approved mock puts it, never over the bubble).
    // The Jefe's tag keeps ROLE_AIR px left of the office's name tag when they share a line.
    const name = out.at(-1)!.rect
    if (d.desks) for (const a of w.agents.filter((q) => q.dept === d.id && !q.walk)) {
      const text = a.role === 'jefe' ? SHORT.jefe : roleTag(a), wd = text.length * 6.2 + 12, [X0, Y] = P(a.x, a.y), top = Y + (a.posture === 'sit' ? ROLE_TAG_SIT : ROLE_TAG_STAND)
      const X = a.role === 'jefe' && top + 6 > name[1] && top - 9 < name[3] ? Math.min(X0, name[0] - ROLE_AIR - wd / 2) : X0
      out.push({ kind: 'role', id: a.id, rect: [X - wd / 2, top - 9, X + wd / 2, top + 6], s: `<g transform="translate(${n(X)} 0)">${nameTag(text, top)}</g>` })
    }
    const parent = d.parent ? w.depts.find((x) => x.id === d.parent) : undefined
    if (parent) {
      const text = t('role.lead'), wd = text.length * 6.2 + 12, [X, Y] = P(ox + CHIP_AT.dx, oy + CHIP_AT.dy, CHIP_AT.z)
      out.push({ kind: 'chip', id: d.id, rect: [X - wd / 2, Y - 11, X + wd / 2, Y + 4], s: `<g transform="translate(${n(X)} ${n(Y)})"><rect x="${n(-wd / 2)}" y="-11" width="${n(wd)}" height="15" rx="3" fill="${shade(parent.color, 0.72)}"/><text x="0" y="0" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="700" fill="#ffffff">${esc(text)}</text></g>` })
    }
  }
  return out
}
/** The agents. Independent of the selection, so selecting someone does not change this source and does not restart
 * its animations (a new source reloads the picture from its first frame). */
export function agentsLayer(w0: AgentvilleWorld, now: number, dt: Detail = FULL): string[] {
  const w = clone(w0)
  settle(w, now) // a walk that already ended is drawn at rest, not as a frozen animation
  // Producto's people sit still at their table, each with its name; the secretaria moves like anyone.
  const prod = w.staff ? PROD_SEATS.map(([x, y, facing, name, role, lift], i): [AgentvilleAgent, string, number] => {
    const id = `staff-prod-${i}`, ht = hash(id)
    return [{ ...w.staff!.sec, id, role, x, y, facing, posture: 'sit', walk: null, visit: undefined, state: 'leyendo', hair: HAIRS[ht % HAIRS.length]!, skin: SKINS[(ht >>> 3) % SKINS.length]! }, t(name), lift]
  }) : []
  const all: [AgentvilleAgent, string | null, number][] = [...w.agents.map((a): [AgentvilleAgent, null, number] => [a, null, 0]), ...(w.staff ? [[w.staff.sec, null, 0] as [AgentvilleAgent, null, number]] : []), ...prod]
  const order = all.sort(([a], [b]) => { const p = posAt(a, now), q = posAt(b, now); return p.x + p.y - (q.x + q.y) })
  return pack(order.map(([a, name, lift]) => { if (!name || !dt.decor) return agentSvg(w, a, now, dt.bubbles); const [X, Y] = P(a.x, a.y); return agentSvg(w, a, now, dt.bubbles) + `<g transform="translate(${n(X)} ${n(Y)})">${nameTag(name, lift)}</g>` }), rowsOf(w), 'a')
}
/** The selection, on two layers of its own: `tile` goes under the agents (the tile it stands on), `tag` over them
 * (its name above its head, never hidden by a neighbour's bubble). The `tag` layer also names every island, so the
 * names float over the agents too. */
/** Dollars as an office tag and the Uso tab show them: cents below a hundred, whole dollars above. */
export const usd = (v: number) => `US$${v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')}`
export function selectionLayer(w0: AgentvilleWorld, now: number, selected: string, part: 'tile' | 'tag' = 'tile', people = true, decor = true): string {
  const w = clone(w0)
  settle(w, now)
  const rows = rowsOf(w)
  const a = w.agents.find((x) => x.id === selected && !w.depts.find((d) => d.id === x.dept)?.away)
  const names = part === 'tag' && decor ? labelsOf(w).filter((l) => people || l.kind !== 'role').map((l) => l.s).join('') : '' // no role tags over empty desks
  if (!a) return svg(names, rows)
  const p = posAt(a, now), [tx, ty] = tileOf(w, a, p), [X, Y] = P(p.x, p.y)
  const top = Y + (a.posture === 'sit' && !a.walk ? -6 : 0) - (totalRows(a.walk ? 'stand' : a.posture, a.facing[0] === 'b') * PX + 8)
  const tile = a.walk ? '' : `<polygon points="${pts([[tx, ty, 0], [tx + 1, ty, 0], [tx + 1, ty + 1, 0], [tx, ty + 1, 0]])}" fill="rgba(255,255,255,0.22)" stroke="#ffffff" stroke-width="1.5"/>`
  return svg(part === 'tile' ? tile : `${names}<g transform="translate(${n(X)} 0)">${nameTag(`${roleName(a.role, deptOf(w, a))} · ${deptOf(w, a).name}`, top - 18)}</g>`, rows)
}
