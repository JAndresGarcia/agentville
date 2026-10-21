import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { IDLE_MS, MAIN, newBeat, setAgent } from '../hooks/beat'
import type { Beat } from '../hooks/beat'
import { ROLES, SVG_LIMIT, agentsLayer, blockOf, demoBeats, depthOf, floorView, floorsOf, furnitureLayer, hotspots, houseLayer, isleRooms, labelsOf, membersOf, poly, roleName, rowsOf, selectionLayer, tourTargets, unitRooms, viewOf, worldFromBeats, zoneGrid } from '../hooks/scene'
import type { AgentvilleDept, AgentvilleWorld } from '../types'
import { setLang } from '../hooks/i18n'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// Sub-offices, option B, the geometry and drawing side (layout-b B3 to B6, B8): a session started from another is a
// glass room in its parent's office block.
const NOW = Date.UTC(2026, 9, 18, 12)
// A session with a full team at work (or resting, idle), started from `parent` when given.
function office(id: string, at: number, parent?: string, idle = false): Beat {
  const when = idle ? at - IDLE_MS : at, state = idle ? 'inactivo' as const : 'trabajando' as const
  const b = newBeat(id, `Oficina ${id} con un nombre largo`, when)
  setAgent(b, MAIN, when, { state, activity: 'Edit x.ts' })
  ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `${id}-${r}`, when, { role: r, state, activity: 'Read y.ts' }))
  if (parent) b.parent = parent
  return b
}
// `fams` families of k children each, then `singles` islands; parents come first so they keep the first slots.
function house(fams: number, k: number, singles: number): Beat[] {
  const out: Beat[] = []
  for (let f = 0; f < fams; f++) out.push(office(`p${f}`, NOW - f))
  for (let s = 0; s < singles; s++) out.push(office(`s${s}`, NOW - 100 - s))
  for (let f = 0; f < fams; f++) for (let c = 0; c < k; c++) out.push(office(`p${f}c${c}`, NOW - 200 - c, `p${f}`))
  return out
}
const views = (beats: Beat[]) => { const w = worldFromBeats(null, beats, NOW); return Array.from({ length: floorsOf(w) }, (_, f) => floorView(w, f)) }
const hit = (a: number[], b: number[]) => a[0]! < b[2]! && b[0]! < a[2]! && a[1]! < b[3]! && b[1]! < a[3]!
const P = (x: number, y: number, z = 0) => [(x - y) * 16, ((x + y) * 16) / 2 - z * 16] as const
/** A drawn office's unit: its family's members, or itself alone. */
const unitOf = (v: AgentvilleWorld, d: AgentvilleDept) => { const root = v.depts.find(x => x.id === (d.parent ?? d.id) && x.fam); return root ? membersOf(v, root) : [d] }
const drawn = (v: AgentvilleWorld) => v.depts.filter(d => !d.away && d.room.length)

test('B3: without families the units are the even grid of 1 to 16 islands, unchanged', () => {
  for (let n = 1; n <= 16; n++) expect([n, unitRooms(Array(n).fill(0)).flat()]).toEqual([n, isleRooms(n)])
})

test('B3: families of 1, 2, 3 and 5 (capped) children with 0 to 12 singles, 1 and 3 families: no overlaps, rooms in their blocks, blocks on the floor, at most 6 rows', () => {
  for (const fams of [1, 3]) for (const k of [1, 2, 3, 5]) for (let singles = 0; singles <= 12; singles++) {
    const tag = `${fams}x${k}+${singles}`
    for (const v of views(house(fams, k, singles))) {
      const rows = rowsOf(v), units = [...new Set(drawn(v).map(d => unitOf(v, d)[0]!))].map(r => unitOf(v, r))
      expect([tag, rows <= 6]).toEqual([tag, true])
      for (const u of units) {
        const block = blockOf(u.map(d => d.room))
        expect([tag, u[0]!.id, block[0]! >= 0 && block[2]! <= 32 && block[1]! >= 12 && block[3]! <= depthOf(rows)]).toEqual([tag, u[0]!.id, true])
        if (u.length > 1) expect([tag, u[0]!.fam]).toEqual([tag, { rooms: Math.min(k, 3), more: Math.max(0, k - 3) }])
        u.forEach((d, i) => u.slice(i + 1).forEach(o => expect([tag, d.id, o.id, hit(d.room, o.room)]).toEqual([tag, d.id, o.id, false])))
        for (const o of units) if (o !== u) expect([tag, u[0]!.id, o[0]!.id, hit(block, blockOf(o.map(d => d.room)))]).toEqual([tag, u[0]!.id, o[0]!.id, false])
      }
    }
  }
})

test('B3: the mockup case, a family of 2 and 2 singles: the children stand right of the parent, stacked', () => {
  const [v] = views([office('padre', NOW), office('hija1', NOW - 1, 'padre'), office('hija2', NOW - 2, 'padre'), office('otra1', NOW - 3), office('otra2', NOW - 4)])
  const r = (id: string) => v!.depts.find(d => d.id === id)!.room
  expect([r('hija1')[0]! > r('padre')[2]!, r('hija2')[0], r('hija1')[1], r('hija2')[1]! > r('hija1')[3]!]).toEqual([true, r('hija1')[0], r('padre')[1], true])
  expect([r('otra1')[0]! > r('hija1')[2]!, r('otra2')[0]! > r('hija2')[2]!]).toEqual([true, true])
  expect(rowsOf(v!)).toBe(2)
  // the block's outline and tint in the parent's colour, glass on the inner edges, the children a lighter shade
  const p = v!.depts.find(d => d.id === 'padre')!, svg = furnitureLayer(v!, NOW).join('')
  expect(svg).toContain(`fill="${p.color}" fill-opacity="0.16" stroke="${p.color}" stroke-width="2.5"`)
  // Producto's and your office's 26 panes, then 39 on the inner edges (parent right and bottom, hija1 left and bottom,
  // hija2 left and top) less a door each for hija1 and hija2
  expect(svg.match(/fill="rgba\(180,220,250,0.42\)"/g)!.length).toBe(26 + 39 - 2)
  expect(v!.depts.find(d => d.id === 'hija1')!.color).not.toBe(p.color)
})

// ---- S: child rooms get Producto's tall glass, one pane per tile, and a door toward the parent ----
// The top face of a pane's box (scene.ts panes), as the furniture layer writes it.
const paneTop = (x: number, y: number, vertical: boolean) => {
  const [a, b] = vertical ? [x - 0.06, y] : [x, y - 0.06], [w, d] = vertical ? [0.12, 1] : [1, 0.12]
  return poly([[a, b, 1.5], [a + w, b, 1.5], [a + w, b + d, 1.5], [a, b + d, 1.5]], 'rgba(180,220,250,0.42)')
}
/** A family's glass tiles by the spec: each room's edges off the block's border, one [x, y, vertical] a tile, without
 * the door: 3 tiles along a child room's top edge when it stands under the parent's row, else along its left. */
function glassOf(rooms: number[][]) {
  const [bx0, by0, bx1, by1] = blockOf(rooms), out: { at: [number, number, boolean]; door: boolean }[] = []
  rooms.forEach(([x0, y0, x1, y1], i) => {
    const top = i > 0 && y0! > rooms[0]![1]!
    for (let x = x0!; x < x1!; x++) for (const y of [y0!, y1!]) if (y !== by0 && y !== by1) out.push({ at: [x, y, false], door: i > 0 && top && y === y0 && x === x0! + 3 })
    for (let y = y0!; y < y1!; y++) for (const x of [x0!, x1!]) if (x !== bx0 && x !== bx1) out.push({ at: [x, y, true], door: i > 0 && !top && x === x0 && y === y0! + 3 })
  })
  return out
}
test('S: a family of 3 child rooms has a tall glass pane on every inner edge tile, none on its border, a door on each child room toward the parent', () => {
  const [v] = views(house(1, 3, 0)), rooms = membersOf(v!, v!.depts.find(d => d.id === 'p0')!).map(d => d.room), svg = furnitureLayer(v!, NOW).join('')
  const tiles = glassOf(rooms), [bx0, by0, bx1] = blockOf(rooms)
  expect([rooms.length, tiles.length, tiles.filter(t => t.door).length]).toEqual([4, 52, 3])
  for (const { at, door } of tiles) expect([at, svg.includes(paneTop(...at))]).toEqual([at, !door])
  // the doors: the right child's left edge at its free middle row, the lower ones' top edges at their free middle column
  expect(tiles.filter(t => t.door).map(t => t.at)).toEqual([[rooms[1]![0]!, rooms[1]![1]! + 3, true], [rooms[2]![0]! + 3, rooms[2]![1]!, false], [rooms[3]![0]! + 3, rooms[3]![1]!, false]])
  for (let x = bx0!; x < bx1!; x++) expect([x, svg.includes(paneTop(x, by0!, false))]).toEqual([x, false])
  expect(svg).not.toContain('#cfe6ff') // the old thin lines are gone
})

// A room's board face and its screen's dark face (scene.ts board, officeScreen), as the furniture layer writes them.
const face = (corners: number[][], fill: string) => poly(corners, fill)
const boardOf = (r: number[]) => { const bx = r[0]! + 3.4, by = r[1]! + 0.15; return face([[bx + 0.1, by + 0.08, 0.65], [bx + 3.5, by + 0.08, 0.65], [bx + 3.5, by + 0.08, 2.2], [bx + 0.1, by + 0.08, 2.2]], '#fbfbf7') }
const screenOf = (r: number[]) => { const bx = r[0]! + 1.0, by = r[1]! + 0.15, top = 0.55 + 1.75 - 0.08; return face([[bx + 0.08, by + 0.08, 0.63], [bx + 2.25 - 0.08, by + 0.08, 0.63], [bx + 2.25 - 0.08, by + 0.08, top], [bx + 0.08, by + 0.08, top]], '#151a22') }
test('S: a back edge\'s panes draw behind its room\'s board and screen; a front edge\'s far tiles behind the next room\'s board', () => {
  const [v] = views(house(1, 3, 0)), rooms = membersOf(v!, v!.depts.find(d => d.id === 'p0')!).map(d => d.room), svg = furnitureLayer(v!, NOW).join('')
  const at = (s: string) => { const i = svg.indexOf(s); expect([s.slice(0, 60), i >= 0]).toEqual([s.slice(0, 60), true]); return i }
  const [, side, under, below] = rooms as number[][] // the room beside the parent, the one under it, the one under the parent
  // back edges: the side room's left, the lower rooms' tops (every tile but the door), before their board and screen
  const backs: [number[], number, number, boolean][] = [[side!, side![0]!, side![1]!, true], [under!, under![0]!, under![1]!, false], [below!, below![0]!, below![1]!, false]]
  for (const [r, x, y, vertical] of backs) for (let k = 0; k < (vertical ? 6 : 7); k++) if (k !== 3) {
    const pane = at(paneTop(vertical ? x : x + k, vertical ? y + k : y, vertical))
    expect([r, k, pane < at(boardOf(r)), pane < at(screenOf(r))]).toEqual([r, k, true, true])
  }
  // front edges: the parent's and the side room's bottom tiles 5 and 6 stay under the board of the room below them
  for (const [r, next] of [[rooms[0]!, below!], [side!, under!]] as [number[], number[]][]) for (const k of [5, 6]) expect([r, k, at(paneTop(r[0]! + k, r[3]!, false)) < at(boardOf(next))]).toEqual([r, k, true])
  // each door has its dark threshold on the floor
  expect(svg.match(/fill="rgba\(20,34,62,0.45\)"/g)!.length).toBe(3)
})

test('S: four families of 3 child rooms (a full floor of glass) keep every layer under the Svg limit', () => {
  for (const v of views(house(4, 3, 0))) {
    expect(v.depts.filter(d => d.fam && !d.away).length).toBeGreaterThan(0)
    for (const layer of [houseLayer(v.rows), ...furnitureLayer(v, NOW), ...agentsLayer(v, NOW), selectionLayer(v, NOW, 'p0-jefe', 'tag')]) expect(layer.length).toBeLessThan(SVG_LIMIT)
  }
})

test('S: every walk out of a child room and back in goes through its door, never through a pane', () => {
  const beats = house(1, 3, 0), w0 = worldFromBeats(null, beats, NOW), T1 = NOW + 1000, T2 = T1 + 1000 // the walk back from 3 tiles along the way out (one that already ended by T2 would show none)
  const rooms = membersOf(w0, w0.depts.find(d => d.id === 'p0')!).map(d => d.room), glass = glassOf(rooms).filter(t => !t.door).map(t => t.at)
  const through = (pts: number[][]) => pts.slice(1).some((q, i) => glass.some(([gx, gy, vertical]) => {
    const p = pts[i]!, k = vertical ? 0 : 1, at = vertical ? gx : gy, lo = vertical ? gy : gx, e0 = p[k]! - at, e1 = q[k]! - at
    if (e0 * e1 > 0 || (e0 === 0 && e1 === 0)) return false
    const u = p[1 - k]! + ((q[1 - k]! - p[1 - k]!) * e0) / (e0 - e1)
    return u >= lo && u <= lo + 1
  }))
  // the check itself: straight up through the lower child's top edge is caught, through its door is not
  const low = rooms[3]!
  expect([through([[low[0]! + 5.5, low[1]! + 2.5], [low[0]! + 5.5, low[1]! - 0.5]]), through([[low[0]! + 3.5, low[1]! + 2.5], [low[0]! + 3.5, low[1]! - 0.5]])]).toEqual([true, false])
  const kids = beats.filter(b => b.parent)
  for (const b of kids) for (const k of Object.keys(b.agents)) setAgent(b, k, T1, { state: 'esperando', cmd: 'pnpm test' })
  const w1 = worldFromBeats(w0, beats, T1)
  for (const b of kids) for (const k of Object.keys(b.agents)) setAgent(b, k, T2, { state: 'trabajando', activity: 'Edit x.ts' })
  const w2 = worldFromBeats(w1, beats, T2), mine = (w: AgentvilleWorld) => w.agents.filter(a => kids.some(b => b.id === a.dept))
  expect([mine(w1).filter(a => a.walk).length, mine(w2).filter(a => a.walk).length]).toEqual([12, 12])
  for (const a of [...mine(w1), ...mine(w2)]) expect([a.id, a.walk!.pts.at(-1), through(a.walk!.pts)]).toEqual([a.id, a.walk!.pts.at(-1), false])
})

test('B4: every name tag, sign and Encargado chip sits inside its block on screen, none overlapping', () => {
  for (const fams of [1, 3]) for (const k of [1, 2, 3, 5]) for (const singles of [0, 1, 2, 5, 9, 12]) {
    const tag = `${fams}x${k}+${singles}`
    for (const v of views(house(fams, k, singles))) {
      const labels = labelsOf(v)
      expect([tag, labels.filter(l => l.kind === 'sign').length, labels.filter(l => l.kind === 'chip').length]).toEqual([tag, drawn(v).filter(d => d.fam).length, drawn(v).filter(d => d.parent).length])
      labels.forEach((l, i) => {
        const d = v.depts.find(x => x.id === l.id)!, [bx0, by0, bx1, by1] = blockOf(unitOf(v, d).map(x => x.room)) as [number, number, number, number]
        const box = [P(bx0, by1)[0], P(bx0, by0, 6)[1], P(bx1, by0)[0], P(bx1, by1)[1]]
        expect([tag, l.kind, l.id, l.rect[0] >= box[0]! && l.rect[1] >= box[1]! && l.rect[2] <= box[2]! && l.rect[3] <= box[3]!]).toEqual([tag, l.kind, l.id, true])
        for (const o of labels.slice(i + 1)) expect([tag, l.kind, l.id, o.kind, o.id, hit(l.rect, o.rect)]).toEqual([tag, l.kind, l.id, o.kind, o.id, false])
      })
    }
  }
  // the sign sits clear of its parent's Jefe (body and bubble), as a tag does, centred over it
  for (const v of views(house(3, 5, 4))) for (const l of labelsOf(v).filter(x => x.kind === 'sign')) {
    const a = v.agents.find(x => x.id === `${l.id}-jefe`)!, [X, feet] = P(a.x, a.y), body = [X - 12.5, feet - 6 - 35 * 1.25 - 12 - 9, X + 12.5, feet]
    expect([l.id, hit(l.rect, body), Math.abs((l.rect[0] + l.rect[2]) / 2 - X) < 0.01]).toEqual([l.id, false, true]) // centred over its Jefe, off the lobby sofa
  }
  // each Encargado chip sits over its own Jefe's head, clear of the Jefe's bubble
  for (const v of views(house(3, 3, 4))) for (const l of labelsOf(v).filter(x => x.kind === 'chip')) {
    const a = v.agents.find(x => x.id === `${l.id}-jefe`)!, [X, feet] = P(a.x, a.y), bubble = [X - 11, feet - 6 - 35 * 1.25 - 12 - 9, X + 11, feet - 6 - 35 * 1.25 - 12 + 10]
    expect([l.id, hit(l.rect, bubble), l.rect[0] < X && X - 40 < l.rect[2], l.rect[3] <= bubble[1]! && bubble[1]! - l.rect[3] < 6]).toEqual([l.id, false, true, true])
  }
  // the sign: the parent's name (cut at 20) and its rooms, "+N" past 3; the tag layer draws it
  const [v] = views(house(1, 5, 0)), sign = labelsOf(v!).find(l => l.kind === 'sign')!
  expect(sign.s).toContain('>Oficina p0 con un n…<') // 20 characters with the ellipsis
  expect(sign.s).toContain('>una oficina y 3 salas +2 más<')
  expect(selectionLayer(v!, NOW, '', 'tag')).toContain(sign.s)
  expect(labelsOf(views(house(1, 1, 0))[0]!).find(l => l.kind === 'sign')!.s).toContain('>una oficina y 1 sala<')
  const chips = labelsOf(v!).filter(l => l.kind === 'chip')
  expect([chips.length, chips.every(l => l.s.includes('>Encargado<'))]).toEqual([3, true])
})

test('B5: each seated agent clicks inside its own room, each room opens its own session, a resting parent too, hidden children never', () => {
  for (const beats of [house(1, 2, 2), house(1, 5, 1), house(3, 3, 2), [office('p0', NOW, undefined, true), office('p0c0', NOW - 1, 'p0'), office('s0', NOW - 2)]]) {
    const [v] = views(beats), view = viewOf(rowsOf(v!)), zones = hotspots(v!, NOW)
    for (const a of v!.agents.filter(x => !x.walk && x.posture === 'sit')) {
      const room = v!.depts.find(d => d.id === a.dept)!.room, [X, Y] = P(a.x, a.y), x = (X - view.x) / view.w, y = (Y - view.y) / view.ht
      expect([a.id, a.x > room[0]! && a.x < room[2]! && a.y > room[1]! && a.y < room[3]!]).toEqual([a.id, true])
      expect([a.id, zones.some(z => z.id === a.id && z.priority === 1 && z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1)]).toEqual([a.id, true])
    }
    // islands only: each room's zone spans its own floor's corners (the numbers that draw it), opens its own session
    // and keeps part of the click grid
    const light = hotspots(v!, NOW, true), grid = zoneGrid(light)
    for (const d of drawn(v!)) {
      const z = light.find(x => x.group === `isle-${d.id}`)!, fx = (X: number) => (X - view.x) / view.w
      expect([d.id, z.id, z.x0, z.x1]).toEqual([d.id, `${d.id}-jefe`, fx(P(d.room[0]!, d.room[3]!)[0]), fx(P(d.room[2]!, d.room[1]!)[0])])
      expect([d.id, grid.some(b => b.runs.some(r => r.zone?.group === z.group && r.x1 - r.x0 > 0.01))]).toEqual([d.id, true])
    }
    const shownIds = new Set(drawn(v!).map(d => d.id))
    for (const z of zones) if (z.id !== 'hq' && z.id !== 'disk') expect([z.key, shownIds.has(z.id.replace(/-(jefe|impl|rev|qa)$/, ''))]).toEqual([z.key, true])
  }
  const [rest] = views([office('p0', NOW, undefined, true), office('p0c0', NOW - 1, 'p0')])
  expect(hotspots(rest!, NOW).filter(z => z.group === 'isle-p0').map(z => z.id)).toEqual(['p0-jefe'])
})

test('B6: an idle parent with a child at work is drawn lights off; a child that ends leaves and the block shrinks; no live parent or a cycle leaves normal islands', () => {
  const idle = [office('p0', NOW, undefined, true), office('p0c0', NOW - 1, 'p0'), office('p0c1', NOW - 2, 'p0')].map((b, i) => ({ ...b, slot: i }))
  const w = worldFromBeats(null, idle, NOW), [v] = views(idle), p = v!.depts.find(d => d.id === 'p0')!
  expect([p.idle, p.room.length, p.fam, v!.agents.some(a => a.dept === 'p0')]).toEqual([true, 4, { rooms: 2, more: 0 }, false])
  expect(furnitureLayer(v!, NOW).join('')).toContain('rgba(12,18,34,0.38)') // lights off
  expect(tourTargets(v!, NOW).focusId).toBe('p0c0') // only children at work: the first of them, not the resting parent (slot 0)
  expect(tourTargets(views([office('k', NOW, 'p'), office('p', NOW - 1), office('s', NOW - 2)])[0]!, NOW).focusId).toBe('p') // the first that is not a child
  // one child ends for good: next frame the block holds one child; the last one ends: the parent is gone from the map
  const gone = (b: Beat) => ({ ...b, ended: true, endReason: 'clear' })
  const w2 = worldFromBeats(w, [idle[0]!, idle[1]!, gone(idle[2]!)], NOW)
  expect(w2.depts.find(d => d.id === 'p0')!.fam).toEqual({ rooms: 1, more: 0 })
  expect(blockOf(membersOf(w2, w2.depts.find(d => d.id === 'p0')!).map(d => d.room))).toEqual(blockOf([w2.depts.find(d => d.id === 'p0')!.room, w2.depts.find(d => d.id === 'p0c0')!.room]))
  const w3 = worldFromBeats(w2, [idle[0]!, gone(idle[1]!), gone(idle[2]!)], NOW)
  expect([w3.depts.find(d => d.id === 'p0')!.room, w3.depts.find(d => d.id === 'p0')!.fam]).toEqual([[], undefined])
  // a child gone idle leaves the block too (it stays in the list, off the map)
  const w5 = worldFromBeats(null, [office('p0', NOW), office('p0c0', NOW - 1, 'p0'), office('p0c1', NOW - 2, 'p0', true)], NOW)
  expect([w5.depts.find(d => d.id === 'p0')!.fam, w5.depts.find(d => d.id === 'p0c1')!.room]).toEqual([{ rooms: 1, more: 0 }, []])
  // a busy parent whose child ends is a normal island again
  const busy = [office('p0', NOW), office('p0c0', NOW - 1, 'p0')]
  const w4 = worldFromBeats(worldFromBeats(null, busy, NOW), [busy[0]!, gone(busy[1]!)], NOW)
  expect([w4.depts.find(d => d.id === 'p0')!.fam, w4.depts.find(d => d.id === 'p0')!.room]).toEqual([undefined, isleRooms(1)[0]])
  // the parent not live: the child is a normal island, its main agent a plain Jefe
  const orphan = worldFromBeats(null, [office('p0c0', NOW, 'p0')], NOW), c = orphan.depts[0]!
  expect([c.parent, c.room, roleName('jefe', c), labelsOf(orphan).map(l => l.kind)]).toEqual([undefined, isleRooms(1)[0], ROLES.jefe, ['tag']])
  // a child: Encargado; a grandchild joins its root's family
  const fam = worldFromBeats(null, [office('p0', NOW), office('c', NOW - 1, 'p0'), office('g', NOW - 2, 'c')], NOW)
  expect(fam.depts.map(d => [d.id, d.parent ?? null, roleName('jefe', d)])).toEqual([['p0', null, ROLES.jefe], ['c', 'p0', 'Encargado'], ['g', 'p0', 'Encargado']])
  expect(fam.depts.find(d => d.id === 'p0')!.fam).toEqual({ rooms: 2, more: 0 })
  // a chain of 4 links is too long: its last session stays a normal island; 3 links still join the root
  const chain = worldFromBeats(null, [office('r', NOW), office('l1', NOW - 1, 'r'), office('l2', NOW - 2, 'l1'), office('l3', NOW - 3, 'l2'), office('l4', NOW - 4, 'l3')], NOW)
  expect(chain.depts.map(d => [d.id, d.parent ?? null])).toEqual([['r', null], ['l1', 'r'], ['l2', 'r'], ['l3', 'r'], ['l4', null]])
  // a cycle (and a self link): normal islands, no family
  const cyc = worldFromBeats(null, [office('a', NOW, 'b'), office('b', NOW - 1, 'a'), office('s', NOW - 2, 's')], NOW)
  expect(cyc.depts.map(d => [d.id, d.parent ?? null, d.fam ?? null])).toEqual([['a', null, null], ['b', null, null], ['s', null, null]])
  expect(cyc.depts.map(d => d.room)).toEqual(isleRooms(3))
})

test('B6: a newer heartbeat never swaps the children\'s cells; a child that waits for you is never the hidden one', () => {
  const kids = (atA: number, atB: number) => [office('p0', NOW), office('a', atA, 'p0'), office('b', atB, 'p0')]
  const w1 = worldFromBeats(null, kids(NOW - 2, NOW - 1), NOW), w2 = worldFromBeats(w1, kids(NOW + 5, NOW - 1), NOW + 10)
  expect(['a', 'b'].map(id => w2.depts.find(d => d.id === id)!.room)).toEqual(['a', 'b'].map(id => w1.depts.find(d => d.id === id)!.room))
  const four = [office('p0', NOW), ...[1, 2, 3, 4].map(age => office(`c${age}`, NOW - age * 1000, 'p0'))]
  setAgent(four[4]!, 'c4-impl', NOW - 4000, { role: 'impl', state: 'esperando', activity: 'Te pide permiso', cmd: 'pnpm test' })
  const w = worldFromBeats(null, four, NOW)
  expect([w.depts.filter(d => d.parent && d.room.length).map(d => d.id).sort(), w.depts.find(d => d.id === 'p0')!.fam]).toEqual([['c1', 'c2', 'c4'], { rooms: 3, more: 1 }])
})

test('B6: past 3 children the newest 3 get rooms and the rest wait off the map, their agents in the lobby', () => {
  const beats = [office('p0', NOW), ...[5, 1, 4, 2, 3].map(age => office(`c${age}`, NOW - age * 1000, 'p0'))]
  const w = worldFromBeats(null, beats, NOW), [v] = views(beats)
  expect(w.depts.filter(d => d.parent && d.room.length).map(d => d.id).sort()).toEqual(['c1', 'c2', 'c3'])
  expect(v!.depts.map(d => d.id).sort()).toEqual(['c1', 'c2', 'c3', 'p0'])
  const hidden = w.agents.filter(x => x.dept === 'c4' || x.dept === 'c5')
  expect(hidden).toHaveLength(8) // two offices of 4
  for (const a of hidden) expect([a.id, Number.isFinite(a.x) && Number.isFinite(a.y) && a.y < 11]).toEqual([a.id, true])
})

// ---- B8: the pane's elements (the render log) with families, against the main baseline ----
function serve(on: On, list: Beat[]) {
  on('session.cwd', () => ({ value: '/home/test/proj' }))
  on('session.surfaces', () => ({ value: [] }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  const panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  on('ui.open', ($, e) => { if (!panes.some(x => x.id === e.id)) panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [...panes] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('env.get', () => ({ value: '/home/test' }))
  const store: Record<string, unknown> = { 'intro-done': true, 'render-log': true, lang: 'es' } // the test reads the render log
  on('session.id', () => ({ value: 's-test' }))
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  on('ui.toast', () => ({ value: undefined }))
  on('fs.list', () => ({ value: list.map(b => ({ name: `${b.id}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  const files: Record<string, string> = {}
  on('fs.write', ($, e) => { files[String(e.path)] = String(e.text); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  on('fs.read', ($, e) => ({ value: files[String(e.path)] ?? JSON.stringify(list.find(b => String(e.path).endsWith(`/sessions/${b.id}.json`))) ?? '' }))
  return files
}
const crowd = (count: number, now: number) => Array.from({ length: count }, (_, i) => {
  const b = newBeat(`c${i}`, `Sesión ${i + 1}`, now - i)
  setAgent(b, MAIN, now - i, { state: i % 5 === 4 ? 'esperando' : 'trabajando', activity: 'Edit x.ts' })
  ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `c${i}-${r}`, now - i, { role: r, state: 'trabajando', activity: 'Read y.ts' }))
  return b
})
// Measured with this harness at 2da6a47 (main before families), 110 columns, nothing selected; the family case against
// main's 12 islands (the same 12 sessions, parents ignored there). 16 raised by 10 for the list rows' wrapper Boxes.
// The pane chrome drawn as the mock (buttons as pictures with a click on top) adds 44, 42, 52 and 23. The header's
// ES | EN switch adds 15 more. Producto's own room moves the demo's three coffee drinkers into the lobby, off a shared
// screen column: 3 more bands, 35 more elements on demo (778). A family of 3 child rooms measured 595 before and after
// its tall glass panes (S): they live inside the furniture Svgs, so they cost bytes, not elements. The list's click
// layer, on by default since AH, adds 5 to it (600). The disk screen's zone, the screen alone since AT, leaves an empty
// run on each side of it in its 3 bands: 6 more (606).
const BASELINE: Record<string, number> = { demo: 778, '6': 814, '16': 885, '3 families of 3': 754, 'a family of 3': 606 }
const fams = (count: number) => (now: number) => { const b = crowd(count, now); b.forEach((x, i) => { if (i % 4) x.parent = `c${i - (i % 4)}` }); return b }
for (const [name, make] of [['demo', demoBeats], ['6', (now: number) => crowd(6, now)], ['16', (now: number) => crowd(16, now)], ['3 families of 3', fams(12)], ['a family of 3', fams(4)]] as const) {
  test(`B8: the pane with ${name} stays at or under main's elements and under 1500`, async ($, on) => {
    const now = mock.clock(on, { now: 1_000_000 }).now()
    const list = make(now), files = serve(on, list)
    await $.command.run({ command: 'agentville', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 110 } })
    const ui = await $.ui.mount({ plugin: 'agentville', surface: 'desktop', component: 'Pane', requestId: 'agentville', props: { title: 'Agentville', isFocused: false, bodyColumns: 110, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} } })
    const log = (JSON.parse(files['/home/test/.claude/agentville/render-log.json']!) as { elements: number; offices: number; noMap: boolean }[]).at(-1)!, els = log.elements
    expect([log.noMap, log.offices]).toEqual([false, list.length]) // it drew the map with every session as an office
    expect(els).toBeLessThanOrEqual(BASELINE[name]!) // every baseline is under 1500
    await ui.unmount()
  })
}
