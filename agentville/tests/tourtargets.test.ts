import { expect, test } from 'claude-code/testing'

import { IDLE_MS, MAIN, newBeat, setAgent } from '../hooks/beat'
import { bandsOf } from '../hooks/bandhits'
import { LOBBY_SPOTS, PROD_DOOR, PROD_ROOM, depthOf, emptyWorld, floorView, furnitureLayer, gridOf, hotspots, initialWorld, isleRooms, rowsOf, selectionLayer, settle, tourSteps, tourTargets, viewOf, worldFromBeats, zoneGrid } from '../hooks/scene'
import type { AgentvilleWorld } from '../types'
import type { TourRect } from '../hooks/scene'

const NOW = Date.UTC(2026, 9, 18, 12)
const demo = () => floorView(initialWorld(NOW), 0)
const ALL = ['lang', 'island', 'jefe', 'team', 'board', 'screen', 'lobby', 'despacho', 'chat', 'flow', 'prefs', 'done']
const SHORT = ['lang', 'lobby', 'despacho', 'chat', 'flow', 'prefs', 'done']
const inside = (outer: TourRect, inner: TourRect) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]

test('the demo house: every target is a real rect inside the map, focus is the first office', () => {
  const tg = tourTargets(demo(), NOW)
  expect(tg.focusId).toBe('tienda')
  for (const k of ['island', 'jefe', 'team', 'board', 'screen', 'lobby', 'despacho'] as const) {
    const r = tg[k]
    expect([k, r !== null]).toEqual([k, true])
    const [x0, y0, x1, y1] = r!
    expect([k, 0 <= x0 && x0 < x1 && x1 <= 1 && 0 <= y0 && y0 < y1 && y1 <= 1]).toEqual([k, true])
  }
  expect(tg.steps).toEqual(ALL)
  expect(tourTargets(demo(), NOW, 'blog').focusId).toBe('blog')
  expect(tourTargets(demo(), NOW, 'nowhere').focusId).toBe('tienda')
})

test('the island holds its Jefe, board and screen', () => {
  const tg = tourTargets(demo(), NOW)
  for (const k of ['jefe', 'board', 'screen'] as const) expect([k, inside(tg.island!, tg[k]!)]).toEqual([k, true])
})

// The mock drew the demo's offices on 8-tile columns; the even grid moves each one right by dx tiles (P(dx, 0) in map
// units), and a target with it (as in tourOverlay.test.ts). Team: Recetas, whose helpers are at their desks.
const movedBy = (v: AgentvilleWorld, step: string): [number, number] => {
  const d = v.depts.find((x) => x.id === (step === 'team' ? 'recetas' : 'tienda'))!, dx = d.room[0]! - 8 * (d.slot ?? 0)
  return [16 * dx, 8 * dx]
}

test('close to the mock: the same zones gen.mjs reads, within 0.06 of its TG table', () => {
  // gen.mjs: bounding box of each hotspot group of the demo house.
  const groups: Record<string, number[]> = {}
  for (const z of hotspots(demo(), NOW)) { const g = (groups[z.group] ??= [1, 1, 0, 0]); g[0] = Math.min(g[0]!, z.x0); g[1] = Math.min(g[1]!, z.y0); g[2] = Math.max(g[2]!, z.x1); g[3] = Math.max(g[3]!, z.y1) }
  const tg = tourTargets(demo(), NOW)
  expect(tg.jefe).toEqual(groups['tienda-jefe'] as TourRect)
  expect(tg.board).toEqual(groups['board-tienda'] as TourRect)
  expect(tg.screen).toEqual(groups['screen-tienda'] as TourRect)
  // Tienda's helpers are away from their desks in the demo, so the team is Recetas' Builder and Reviewer, as the mock.
  const team = ['recetas-impl', 'recetas-rev'].map((k) => groups[k]!)
  expect(tg.team).toEqual([Math.min(team[0]![0]!, team[1]![0]!), Math.min(team[0]![1]!, team[1]![1]!), Math.max(team[0]![2]!, team[1]![2]!), Math.max(team[0]![3]!, team[1]![3]!)])
  const TG: Record<string, TourRect> = { island: [0.095, 0.25, 0.32, 0.56], jefe: [0.125, 0.27, 0.178, 0.46], team: [0.215, 0.39, 0.39, 0.64], board: [0.205, 0.335, 0.285, 0.485], screen: [0.158, 0.30, 0.215, 0.41] }
  const view = viewOf(rowsOf(demo()))
  for (const [k, mock] of Object.entries(TG)) {
    const [mx, my] = movedBy(demo(), k), want = [mock[0] + mx / view.w, mock[1] + my / view.ht, mock[2] + mx / view.w, mock[3] + my / view.ht] // the even grid moved it
    const got = tg[k as 'island']!
    expect([k, Math.max(...want.map((v, i) => Math.abs(v - got[i]!))) <= 0.06]).toEqual([k, true])
  }
})

test('lobby and despacho: the strip floors, with the plaque, the resting agents and the HQ screen', () => {
  const tg = tourTargets(demo(), NOW)
  const z = hotspots(demo(), NOW, false, 'tienda'), rect = (g: string) => { const r = z.filter((x) => x.group === g); expect([g, r.length > 0]).toEqual([g, true]); return [Math.min(...r.map((x) => x.x0)), Math.min(...r.map((x) => x.y0)), Math.max(...r.map((x) => x.x1)), Math.max(...r.map((x) => x.y1))] as TourRect }
  expect(inside(tg.despacho!, rect('screen-hq'))).toBe(true)
  // whoever rests on a chat or game spot is framed; the coffee drinkers are not needed
  const w = demo()
  settle(w, NOW)
  const onSpots = w.agents.filter((a) => LOBBY_SPOTS.some((q) => q.kind !== 'coffee' && Math.hypot(q.x - a.x, q.y - a.y) < 0.05)).map((a) => a.id)
  expect(onSpots.length > 0).toBe(true)
  for (const g of onSpots) expect([g, inside(tg.lobby!, rect(g))]).toEqual([g, true])
  expect(tg.lobby![2] <= tg.despacho![2]).toBe(true)
  // The empty house keeps both, from the floor alone.
  const none = tourTargets(floorView(emptyWorld(NOW), 0), NOW)
  expect([none.lobby !== null, none.despacho !== null]).toEqual([true, true])
})

test('A1: the lobby frames its sofas, coffee table, TV corner, coffee corner and plaque, and none of Producto\'s room', () => {
  const v = viewOf(rowsOf(demo())), tg = tourTargets(demo(), NOW)
  const has = (r: TourRect, x: number, y: number, z = 0) => { const X = ((x - y) * 16 - v.x) / v.w, Y = (((x + y) * 16) / 2 - z * 16 - v.y) / v.ht; return X >= r[0] && X <= r[2] && Y >= r[1] && Y <= r[3] }
  const yes: [string, number, number, number][] = [['sofa back', 4.5, 4.5, 1.2], ['sofa front', 4.5, 8.9, 0], ['coffee table', 5, 6.5, 0.45], ['tv', 9.5, 0.3, 1.8], ['ps5', 10.72, 0.39, 1.28], ['cushion', 8.5, 2.6, 0.3], ['lobby plaque', 7, 0, 4.15],
    ['coffee counter', 1.4, 0.85, 0.9], ['coffee counter', 4.3, 0.15, 0], ['coffee counter', 1.4, 0.15, 0.9], ['coffee counter', 4.3, 0.85, 0], ['coffee machine', 3.3, 0.75, 1.85]]
  const no: [string, number, number, number][] = [['producto plaque', 17.5, 0, 4.15], ['table', 15.1, 5.6, 0], ['table', 18.9, 5.6, 0], ['table', 18.9, 7.4, 0], ['table', 15.1, 7.4, 0], ['room centre', (PROD_ROOM[0]! + PROD_ROOM[2]!) / 2, (PROD_ROOM[1]! + PROD_ROOM[3]!) / 2, 0],
    ['board', 14.9, 2.75, 2.3], ['board', 18.5, 2.75, 2.3], ['board', 14.9, 2.83, 2.3], ['board', 18.5, 2.83, 2.3], ['door', PROD_DOOR[0]!, PROD_DOOR[1]!, 0]]
  // a 1-tile grid over Producto's carpet, tile centres on the floor
  for (let x = PROD_ROOM[0]! + 0.5; x < PROD_ROOM[2]!; x++) for (let y = PROD_ROOM[1]! + 0.5; y < PROD_ROOM[3]!; y++) no.push(['carpet', x, y, 0])
  for (const [k, x, y, z] of yes) expect([k, x, y, has(tg.lobby!, x, y, z)]).toEqual([k, x, y, true])
  for (const [k, x, y, z] of no) expect([k, x, y, has(tg.lobby!, x, y, z)]).toEqual([k, x, y, false])
})

test('fallback: no sessions shows 7 steps, 1/7 to 7/7', () => {
  const tg = tourTargets(floorView(emptyWorld(NOW), 0), NOW)
  expect([tg.focusId, tg.island, tg.jefe, tg.team, tg.board, tg.screen]).toEqual([null, null, null, null, null, null])
  expect(tg.steps).toEqual(SHORT)
})

test('fallback: a Jefe-only session shows all 12 steps, the team step aimed at the island', () => {
  const solo = worldFromBeats(null, [{ id: 'solo', name: 'Solo', at: NOW - 1, ended: false, notes: [], agents: { [MAIN]: { role: 'jefe', kind: 'jefe', state: 'trabajando', activity: 'Lee', cmd: null, since: NOW - 60000 } } }], NOW)
  const tg = tourTargets(floorView(solo, 0), NOW)
  expect(tg.focusId).toBe('solo')
  expect(tg.steps).toEqual(ALL)
  expect(tg.team).toEqual(tg.island)
})

test('fallback: noMap skips steps 2 to 6', () => {
  const steps = tourSteps(tourTargets(demo(), NOW), true)
  expect(steps).toEqual(SHORT)
})

// ---- Layout: the even grid (layout spec AC2, AC3, AC5) ----
const team = (count: number, now: number, idle: number[] = []) => Array.from({ length: count }, (_, i) => {
  const quiet = idle.includes(i), at = quiet ? now - IDLE_MS : now - i, state = quiet ? 'inactivo' as const : 'trabajando' as const
  const b = newBeat(`c${i}`, `Una oficina con un nombre muy largo ${i + 1}`, at)
  setAgent(b, MAIN, at, { state, activity: 'Edit x.ts' })
  ;(['impl', 'rev', 'qa'] as const).forEach(r => setAgent(b, `c${i}-${r}`, at, { role: r, state, activity: 'Read y.ts' }))
  return b
})

// Islands sit on whole tiles (their tiles line up with the house's): the gap between islands is g rounded (gi, within
// 0.5 of g and the same everywhere), the outer margins share the rest, within 1 tile of each other and of g.
test('AC2: 1 to 16 islands: no overlap, inside the floor, on whole tiles, the even gap between islands and at the walls (rounded), a short last row centred', () => {
  for (let n = 1; n <= 16; n++) {
    const rooms = isleRooms(n), { r, c, g, gi } = gridOf(n)
    expect([n, r, c, g, Math.abs(gi - g) <= 0.5]).toEqual([n, Math.ceil(n / 4), Math.ceil(n / Math.ceil(n / 4)), (32 - 7 * c) / (c + 1), true])
    for (const q of rooms) expect([n, Number.isInteger(q[0]) && Number.isInteger(q[1])]).toEqual([n, true])
    for (const [i, a] of rooms.entries()) {
      expect([n, i, a[0]! >= 0 && a[2]! <= 32 && a[1]! >= 12 && a[3]! <= depthOf(r)]).toEqual([n, i, true])
      for (const b of rooms.slice(i + 1)) expect([n, a[0]! < b[2]! && b[0]! < a[2]! && a[1]! < b[3]! && b[1]! < a[3]!]).toEqual([n, false])
    }
    for (let row = 0; row < r; row++) {
      const xs = rooms.filter(q => q[1] === 12 + row * 7).map(q => [q[0]!, q[2]!]), last = xs.length < c
      expect([n, row, xs.length === c || row === r - 1]).toEqual([n, row, true]) // only the last row may be short
      const gaps = xs.slice(1).map((q, k) => q[0]! - xs[k]![1]!), left = xs[0]![0]!, right = 32 - xs.at(-1)![1]!
      for (const gap of gaps) expect([n, row, gap]).toEqual([n, row, gi])
      expect([n, row, Math.abs(left - right) <= 1, last || Math.abs(left - g) <= 1]).toEqual([n, row, true, true])
    }
    // every name tag sits over its island's back edge: within the island's width on screen, clear of its own people
    // (sprite and bubble) and of every other tag (layout-b X8; it may cross a person of the island behind it)
    const w = floorView(worldFromBeats(null, team(n, NOW), NOW), 0)
    expect(rowsOf(w)).toBe(r)
    const tags = [...selectionLayer(w, NOW, '', 'tag').matchAll(/<g transform="translate\(([-\d.]+) 0\)"><g transform="translate\(0 ([-\d.]+)\)"><rect x="([-\d.]+)" y="-9" width="([\d.]+)" height="15"/g)]
    expect(tags.length).toBe(n)
    const rects = tags.map(m => { const [X, Y, x0, wd] = [1, 2, 3, 4].map(k => Number(m[k])) as [number, number, number, number]; return [X + x0, Y - 9, X + x0 + wd, Y + 6] })
    rects.forEach((q, i) => {
      const d = w.depts[i]!, [rx0, ry0, rx1, ry1] = d.room as [number, number, number, number]
      expect([n, i, q[2]! - q[0]! <= 140, q[0]! >= (rx0 - ry1) * 16, q[2]! <= (rx1 - ry0) * 16]).toEqual([n, i, true, true, true])
      for (const a of w.agents.filter(x => x.dept === d.id && !x.walk && x.posture === 'sit')) {
        const X = (a.x - a.y) * 16, feet = (a.x + a.y) * 8, body = [X - 12.5, feet - 6 - 35 * 1.25 - 12 - 9, X + 12.5, feet]
        expect([n, a.id, q[0]! < body[2]! && body[0]! < q[2]! && q[1]! < body[3]! && body[1]! < q[3]!]).toEqual([n, a.id, false])
      }
      // and clear of its usage screen's face (a hover target; its words are read there)
      const sx0 = rx0 + 1.08, sx1 = rx0 + 3.17, sy = ry0 + 0.23, face = [(sx0 - sy) * 16, (sx0 + sy) * 8 - 2.22 * 16, (sx1 - sy) * 16, (sx1 + sy) * 8 - 0.63 * 16]
      expect([n, i, 'screen', q[0]! < face[2]! && face[0]! < q[2]! && q[1]! < face[3]! && face[1]! < q[3]!]).toEqual([n, i, 'screen', false])
      for (const o of rects.slice(i + 1)) expect([n, q[0]! < o[2]! && o[0]! < q[2]! && q[1]! < o[3]! && o[1]! < q[3]!]).toEqual([n, false])
    })
  }
})

test('AC3: on the even grid every seated agent\'s zone holds its feet, and each island holds its Jefe, board and screen', () => {
  for (const n of [1, 2, 3, 5, 6, 7, 10, 13, 16]) {
    const w = floorView(worldFromBeats(null, team(n, NOW), NOW), 0), v = viewOf(rowsOf(w)), zones = hotspots(w, NOW)
    for (const a of w.agents.filter(x => !x.walk && x.posture === 'sit')) {
      const X = ((a.x - a.y) * 16 - v.x) / v.w, Y = (((a.x + a.y) * 16) / 2 - v.y) / v.ht
      expect([n, a.id, zones.some(z => z.id === a.id && z.priority === 1 && z.x0 <= X && X <= z.x1 && z.y0 <= Y && Y <= z.y1)]).toEqual([n, a.id, true])
    }
    for (const d of [w.depts[0]!, w.depts.at(-1)!]) {
      const tg = tourTargets(w, NOW, d.id)
      for (const k of ['jefe', 'board', 'screen'] as const) expect([n, d.id, k, inside(tg.island!, tg[k]!)]).toEqual([n, d.id, k, true])
    }
  }
})

test('AC5: the tour aims at the first office on the map; an idle one is skipped; all idle shows the short tour; the zone grid still covers the map', () => {
  const w = floorView(worldFromBeats(null, team(3, NOW, [0]), NOW), 0)
  expect(w.depts.map(d => d.id)).toEqual(['c1', 'c2']) // c0 is idle: off the map
  expect([tourTargets(w, NOW).focusId, tourTargets(w, NOW, 'c0').focusId]).toEqual(['c1', 'c1'])
  const none = tourTargets(floorView(worldFromBeats(null, team(2, NOW, [0, 1]), NOW), 0), NOW)
  expect([none.focusId, none.steps]).toEqual([null, SHORT])
  const bands = zoneGrid(hotspots(w, NOW))
  expect([bands[0]!.y0, bands.at(-1)!.y1]).toEqual([0, 1])
  for (const b of bands) expect([b.runs[0]!.x0, b.runs.at(-1)!.x1]).toEqual([0, 1])
  const runs = bandsOf(bands.flatMap(b => b.runs.flatMap(r => (r.zone ? [{ key: r.zone.group, x0: r.x0, x1: r.x1, y0: b.y0, y1: b.y1 }] : []))), 30)
  expect(runs.some(b => b.runs.some(r => r.key))).toBe(true) // the bands carry the zones' keys
})

test('U1: every island draws its palette floor, both tones, on whole tiles', () => {
  const TONES = [['#8fb7de', '#82abd3'], ['#9ed39b', '#91c78e'], ['#efb196', '#e4a589'], ['#c9cbd2', '#bdbfc7']] // tienda, recetas, blog, portafolio
  for (const n of [1, 2, 3, 4, 5, 6, 9, 16]) {
    const w = floorView(worldFromBeats(null, team(n, NOW), NOW), 0), svg = furnitureLayer(w, NOW).join('')
    expect([n, svg.includes('undefined')]).toEqual([n, false])
    for (const d of w.depts) for (const tone of TONES[(d.slot ?? 0) % 4]!) expect([n, d.id, new RegExp(`<path fill="${tone}"[^>]*d="M[-\\d]`).test(svg)]).toEqual([n, d.id, true])
  }
})
