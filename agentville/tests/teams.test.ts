import { expect, test } from 'claude-code/testing'

import { MAIN, newBeat, roleOf, setAgent } from '../hooks/beat'
import type { Beat } from '../hooks/beat'
import { getLang, setLang } from '../hooks/i18n'
import { DESK_GLASS, ROW_PITCH, route, LOBBY_SPOTS, MAX_CELLS, PROD_DOOR, PROD_GLASS, PROD_KIND, PROD_ROOM, PROD_SEAT, SEC_ID, SEC_KIND, SEC_SEAT, SEC_STOP_MS, SEC_VISIT, STAFF_MS, TEAM_KEEP, VISIT_MS, agentsLayer, kindOf, blockOf, floorView, floorsOf, furnitureLayer, hotspots, isleRooms, labelsOf, posAt, roleTag, selectionLayer, settle, teamOf, unitRooms, worldFromBeats } from '../hooks/scene'
import type { AgentvilleWorld } from '../types'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// The office bureaucracy, the map side: team offices (subagents named "<Letter>: <team>"), the secretaria and Producto.
const NOW = Date.UTC(2026, 9, 18, 12)
const A = 'A: Función para medir bien', B = 'B: Error al editar'
const CREW: [string, string][] = [[A, 'agentville:builder'], [A, 'agentville:security-reviewer'], [A, 'agentville:approver'], [B, 'agentville:builder'], [B, 'agentville:code-reviewer'], [B, 'agentville:approver']]
/** A session at work whose subagents (keys `<id>a<i>`) were sent with these descriptions and types. */
function office(id: string, at: number, crew: [string, string][] = CREW): Beat {
  const b = newBeat(id, `Oficina ${id}`, at)
  setAgent(b, MAIN, at, { state: 'trabajando', activity: 'Coordina' })
  crew.forEach(([goal, kind], i) => setAgent(b, `${id}a${i}`, at + i, { role: roleOf(kind), kind, goal, state: 'trabajando', activity: 'Edit x.ts' }))
  return b
}
const teams = (k: number) => [...'ABCD'.slice(0, k)].flatMap((l): [string, string][] => [0, 1, 2].map(() => [`${l}: Tarea ${l}`, 'agentville:builder']))
const clone = (w: AgentvilleWorld): AgentvilleWorld => JSON.parse(JSON.stringify(w))
const xy = (p: number[]) => ({ x: p[0]!, y: p[1]! })
/** Where someone is at `t`, the world settled on a copy (as every layer draws it). */
function look(w: AgentvilleWorld, id: string, t: number) {
  const c = clone(w)
  settle(c, t)
  const a = [...c.agents, c.staff!.sec].find((x) => x.id === id)!
  return { ...posAt(a, t), posture: a.walk ? 'walk' : a.posture, facing: a.facing }
}
const at = (p: { x: number; y: number }, q: number[]) => Math.hypot(p.x - q[0]!, p.y - q[1]!) < 0.01
const inRect = (x: number, y: number, r: number[]) => x > r[0]! + 1e-6 && x < r[2]! - 1e-6 && y > r[1]! + 1e-6 && y < r[3]! - 1e-6
/** Whether a walk's path (sampled every 0.05 tiles) enters any of these desks. */
function crossesDesk(pts: number[][], desks: { x: number; y: number }[]) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1] as [number, number], [x1, y1] = pts[i] as [number, number], k = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.05)
    for (let j = 0; j <= k; j++) { const x = x0 + ((x1 - x0) * j) / k, y = y0 + ((y1 - y0) * j) / k; if (desks.some((d) => inRect(x, y, [d.x, d.y, d.x + 2, d.y + 1]))) return true }
  }
  return false
}
const inLang = (lang: string, run: () => void) => { const was = getLang(); setLang(lang); try { run() } finally { setLang(was) } }

test('AC1: a team is "<Letter>: <name>", the name 1 to 60 characters', () => {
  expect(teamOf('A: Función para medir bien')).toEqual({ letter: 'A', name: 'Función para medir bien' })
  expect(teamOf('B:Error')).toEqual({ letter: 'B', name: 'Error' })
  expect(teamOf(`C: ${'x'.repeat(60)}`)).toEqual({ letter: 'C', name: 'x'.repeat(60) })
  for (const g of ['Fix bug', 'a: x', 'AB: x', 'A:', 'A:  ', `A: ${'x'.repeat(61)}`, 42, null, undefined, ['A: x']]) expect([g, teamOf(g)]).toEqual([g, null])
})

test('AC2: 0 to 4 teams give a 7x6 island, then a room 2 cells wide and a cell row deep per row of desks (+N on the last tapete); integer corners, no desk overlaps, no seat on a desk or the left lane', () => {
  for (let k = 0; k <= 4; k++) {
    const crew = k ? teams(k) : ([0, 1, 2].map(() => ['Arregla el login', 'agentville:builder']) as [string, string][])
    const w = worldFromBeats(null, [office('o', NOW, crew)], NOW), d = w.depts[0]!, r = d.room
    expect([k, r]).toEqual([k, k === 0 ? isleRooms(1)[0] : blockOf(unitRooms([[2, Math.min(k, 3)]])[0]!)])
    expect([k, r[3]! - r[1]!]).toEqual([k, [6, 6, 13, 20, 20][k]])
    // every tapete inside the room, a whole ROW_PITCH from the next row's desks
    for (const t of d.teams ?? []) expect([k, t.letter, r[1]! + 1 + ROW_PITCH * t.row + 2.95 <= r[3]!]).toEqual([k, t.letter, true])
    if (k) expect([k, r[2]! - r[0]! > 14]).toEqual([k, true]) // 14 + the even gap
    expect([k, d.teams?.map((t) => [t.letter, t.row, t.more]) ?? null]).toEqual([k, k === 0 ? null : [['A', 0, 0], ['B', 1, 0], ['C', 2, k === 4 ? 3 : 0]].slice(0, Math.min(k, 3))])
    const desks = d.desks ?? []
    expect([k, desks.length]).toEqual([k, k ? 1 + 3 * Math.min(k, 3) : 0])
    for (const q of [...r, ...desks.flatMap((x) => [x.x, x.y])]) expect([k, Number.isInteger(q)]).toEqual([k, true])
    desks.forEach((p, i) => desks.slice(i + 1).forEach((q) => expect([k, p.id, q.id, Math.abs(p.x - q.x) < 2 && Math.abs(p.y - q.y) < 1]).toEqual([k, p.id, q.id, false])))
    for (const s of desks) {
      const sx = s.x + 1, sy = s.y + 1 // the seat's tile
      expect([k, s.id, desks.some((q) => sx >= q.x && sx < q.x + 2 && sy >= q.y && sy < q.y + 1), sx === r[0]]).toEqual([k, s.id, false, false])
    }
  }
})

test('S8: members not seated (past 3 a row, past 3 rows, unnamed ones too) count in the last labelled team\'s +N', () => {
  const crew: [string, string][] = [...[0, 1, 2, 3].map((): [string, string] => [A, 'agentville:builder']), ...[0, 1, 2, 3, 4].map((): [string, string] => ['sin equipo', 'agentville:builder'])]
  const d = worldFromBeats(null, [office('o', NOW, crew)], NOW).depts[0]!
  expect(d.teams).toEqual([{ letter: 'A', name: 'Función para medir bien', row: 0, more: 1 + 2 }])
  expect(furnitureLayer(floorView(worldFromBeats(null, [office('o', NOW, crew)], NOW), 0), NOW).join('')).toContain('>EQUIPO A · FUNCIÓN PARA MEDIR … +3</text>') // cut so the count fits in 34
})

test('S7: leaving a single office under a team block skips the aisle that runs through the block', () => {
  const rooms = unitRooms([[2, 1], 0, 0, 0, 0]), block = blockOf(rooms[0]!), under = rooms[3]![0]!
  expect([block, under]).toEqual([[2, 12, 19, 18], [12, 19, 19, 25]]) // the block in the first grid row, a single office beneath it
  const aisles = [1, 10.5, 20.5, 30.5], seat = { x: under[0]! + 1.5, y: under[1]! + 1.5 }, to = { x: 8.5, y: 2.6 }
  expect(route(seat, to, aisles).slice(0, 3)).toEqual([[13.5, 18.5], [10.5, 18.5], [10.5, 11.5]]) // nearest aisle, no block
  const out = route(seat, to, aisles, [block])
  expect(out.slice(0, 3)).toEqual([[13.5, 18.5], [20.5, 18.5], [20.5, 11.5]])
  expect(out.some((p) => p[0] === 10.5)).toBe(false)
})

test('S7 live: in a world the hooks build, an office under a team block in the second row walks to your queue without the aisle through the block', () => {
  const single = (id: string, at: number) => { const b = newBeat(id, `Sola ${id}`, at); setAgent(b, MAIN, at, { state: 'trabajando', activity: 'x' }); return b }
  const beats = [single('s1', NOW), single('s2', NOW - 1), office('o', NOW - 2, [[A, 'agentville:builder']]), ...[3, 4, 5, 6, 7].map((i) => single(`s${i}`, NOW - i))]
  const w0 = worldFromBeats(null, beats, NOW), team = w0.depts.find((d) => d.id === 'o')!.room, under = w0.depts.find((d) => d.room[0] === 12 && d.room[1] === 26)!
  expect(team).toEqual([2, 19, 19, 25]) // the block in the second grid row; the first row's gap at x 10.5 runs down through it
  const b = beats.find((x) => x.id === under.id)!, T1 = NOW + 1000
  setAgent(b, MAIN, T1, { state: 'esperando', activity: 'Bash x', cmd: 'x', req: 'r1' })
  const pts = worldFromBeats(w0, beats, T1).agents.find((a) => a.id === `${under.id}-jefe`)!.walk!.pts
  expect(pts.some((p) => p[0] === 10.5)).toBe(false) // nearest aisle, but through the team block: skipped
  expect(pts.some((p) => p[0] === 20.5)).toBe(true)
})

test('S2: no walk to or between lobby spots, from the islands, your office or the lobby, enters Producto\'s room', () => {
  const r = PROD_ROOM, into = (pts: number[][]) => pts.some((p, i) => i > 0 && [0, 0.25, 0.5, 0.75, 1].some((f) => { const [x0, y0] = pts[i - 1]!, [x1, y1] = p, x = x0! + (x1! - x0!) * f, y = y0! + (y1! - y0!) * f; return x > r[0]! && x < r[2]! && y > r[1]! && y < r[3]! }))
  const fine = (pts: number[][]) => pts.flatMap((p, i) => (i ? Array.from({ length: 40 }, (_, j) => [pts[i - 1]![0]! + ((p[0]! - pts[i - 1]![0]!) * j) / 40, pts[i - 1]![1]! + ((p[1]! - pts[i - 1]![1]!) * j) / 40]) : [p]))
  const froms = [...LOBBY_SPOTS, { x: 3.5, y: 14.5 }, { x: 12.5, y: 15.5 }, { x: 20.5, y: 21.5 }, { x: 28.5, y: 14.5 }, { x: 24.5, y: 6.5 }, { x: 27.5, y: 4.5 }]
  for (const f of froms) for (const s of LOBBY_SPOTS) {
    const pts = [[f.x, f.y], ...route(f, s, [0.5, 8.5, 16.5, 24.5, 31.5])]
    expect([f.x, f.y, s.x, s.y, into(fine(pts))]).toEqual([f.x, f.y, s.x, s.y, false])
  }
})

/** Whether a walk's path crosses one of the glass lines of your office or Producto's (x0, y0, x1, y1, axis-aligned). */
function throughGlass(pts: number[][]) {
  return pts.slice(1).some((q, i) => [...DESK_GLASS, ...PROD_GLASS].some(([a, b, c, d]) => {
    const p = pts[i]!, k = a === c ? 0 : 1, at = k ? b! : a!, [lo, hi] = k ? [a!, c!] : [b!, d!], e0 = p[k]! - at, e1 = q[k]! - at
    if (e0 * e1 > 0 || (e0 === 0 && e1 === 0)) return false
    const u = p[1 - k]! + ((q[1 - k]! - p[1 - k]!) * e0) / (e0 - e1)
    return u >= lo && u <= hi
  }))
}

test('the despacho\'s and Producto\'s glass: no route into your office or out of it, between lobby spots, to Producto\'s door, nor any walk into the queue, to the secretaria and back, crosses their walls', () => {
  expect(DESK_GLASS).toEqual([[20, 8, 20, 11], [20, 11, 24, 11], [29, 11, 32, 11]])
  expect([PROD_ROOM, PROD_DOOR, PROD_GLASS]).toEqual([[14, 0, 20, 11], [16.5, 11.5], [[14, 0, 14, 11], [14, 11, 16, 11], [17, 11, 20, 11]]])
  // the check itself: straight through a pane is caught, through the door is not
  expect([throughGlass([[22, 12], [22, 10]]), throughGlass([[20.5, 9], [19.5, 9]]), throughGlass([[26.5, 11.5], [26.5, 9.5]])]).toEqual([true, true, false])
  expect([throughGlass([[13.5, 5], [14.5, 5]]), throughGlass([[15.5, 11.5], [15.5, 10.5]]), throughGlass([[16.5, 11.5], [16.5, 10.5]])]).toEqual([true, true, false])
  const desk = [[24.5, 4.5], [24.5, 5.5], [24.5, 6.5], [24.5, 7.5], [24.5, 8.5], [24.5, 9.5], [27.5, 4.5], SEC_SEAT, ...SEC_VISIT].map(([x, y]) => ({ x: x!, y: y! }))
  const froms = [...LOBBY_SPOTS, { x: 3.5, y: 14.5 }, { x: 12.5, y: 15.5 }, { x: 20.5, y: 21.5 }, { x: 28.5, y: 14.5 }, { x: 30.5, y: 13.5 }, xy(PROD_DOOR), ...desk]
  for (const f of froms) for (const s of desk) for (const [a, b] of [[f, s], [s, f]]) {
    const pts = [[a!.x, a!.y], ...route(a!, b!, [0.5, 8.5, 16.5, 24.5, 31.5])]
    expect([a!.x, a!.y, b!.x, b!.y, throughGlass(pts)]).toEqual([a!.x, a!.y, b!.x, b!.y, false])
  }
  // between every two lobby spots, and from anywhere above to Producto's door and its visitor chair and back
  for (const f of froms) for (const s of [...LOBBY_SPOTS, xy(PROD_DOOR), xy(PROD_SEAT)]) for (const [a, b] of [[f, s], [s, f]]) {
    const pts = [[a!.x, a!.y], ...route(a!, b!, [0.5, 8.5, 16.5, 24.5, 31.5])]
    expect([a!.x, a!.y, b!.x, b!.y, throughGlass(pts)]).toEqual([a!.x, a!.y, b!.x, b!.y, false])
  }
  // the real walks (the way back from the queue is route() above): a member that asks, to her visitor spot and on into your queue ...
  const walks: [string, number[][]][] = []
  const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW), T1 = NOW + 1000
  setAgent(b, 'oa2', T1, { state: 'esperando', cmd: 'pnpm test' })
  const w1 = worldFromBeats(w0, [b], T1), a = w1.agents.find((x) => x.id === 'o-oa2')!, there = T1 + a.walk!.dur * 1000
  walks.push(['to her', a.walk!.pts])
  const c = clone(w1); settle(c, there + SEC_STOP_MS + 10)
  walks.push(['into the queue', c.agents.find((x) => x.id === a.id)!.walk!.pts])
  // ... a Jefe to her desk while she routes and back, and she to you
  const j = office('j', NOW), j0 = worldFromBeats(null, [j], NOW)
  setAgent(j, 'sec', T1, { role: 'impl', kind: SEC_KIND, state: 'leyendo', activity: 'Read metas.md', goal: '¿Encaja?' })
  const j1 = worldFromBeats(j0, [j], T1)
  walks.push(['jefe to her', j1.agents.find((x) => x.id === 'j-jefe')!.walk!.pts])
  setAgent(j, 'sec', T1 + 20000, { state: 'terminado', answer: 'PERSON' })
  setAgent(j, MAIN, T1 + 20000, { state: 'terminado' })
  const j2 = worldFromBeats(j1, [j], T1 + 20000)
  walks.push(['jefe back', j2.agents.find((x) => x.id === 'j-jefe')!.walk!.pts])
  // ... a Jefe to Producto's chair while it runs and back
  const g = office('g', NOW), g0 = worldFromBeats(null, [g], NOW)
  setAgent(g, 'prod', T1, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'Read metas.md' })
  const g1 = worldFromBeats(g0, [g], T1)
  setAgent(g, 'prod', T1 + 30000, { state: 'terminado', answer: 'DECIDED' })
  const g2 = worldFromBeats(g1, [g], T1 + 30000)
  walks.push(['jefe to producto', g1.agents.find((x) => x.id === 'g-jefe')!.walk!.pts], ['jefe back from producto', g2.agents.find((x) => x.id === 'g-jefe')!.walk!.pts])
  const ends = Object.fromEntries(walks.map(([k, pts]) => [k, pts.at(-1)]))
  expect([ends['to her'], ends['into the queue'], ends['jefe to her']]).toEqual([SEC_VISIT[0], [24.5, 4.5], SEC_VISIT[0]])
  expect(LOBBY_SPOTS.some((p) => at(p, ends['jefe back']!))).toBe(true) // its turn over: to rest in the lobby
  expect([ends['jefe to producto'], ends['jefe back from producto']![1]! > 11]).toEqual([PROD_SEAT, true])
  for (const [k, pts] of walks) expect([k, throughGlass(pts)]).toEqual([k, false])
})

// An object's built-in key, made from parts: a kind by that name is never looked up on an object's prototype.
const PROTO_KEY = ['constr', 'uctor'].join('')
test('AW: the pre-AW staff ids (secretaria, producto) get the same role and job as secretary and product', () => {
  expect([SEC_KIND, PROD_KIND]).toEqual(['agentville:secretary', 'agentville:product'])
  expect([kindOf('agentville:secretaria'), kindOf('agentville:producto'), kindOf('agentville:builder'), kindOf(PROTO_KEY)]).toEqual([SEC_KIND, PROD_KIND, 'agentville:builder', PROTO_KEY])
  // a staff member running: no desk of its own, and the Jefe walks to the secretary's visitor spot or Product's chair
  const seen = (kind: string) => {
    const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW)
    setAgent(b, 'st', NOW + 1000, { role: roleOf(kind), kind, state: 'leyendo', activity: 'Read metas.md' })
    const w = worldFromBeats(w0, [b], NOW + 1000)
    return { role: roleOf(kind), desk: w.agents.some((a) => a.id === 'o-st'), to: w.agents.find((a) => a.id === 'o-jefe')!.walk?.pts.at(-1) }
  }
  for (const [old, now] of [['agentville:secretaria', SEC_KIND], ['agentville:producto', PROD_KIND]] as const) expect([old, seen(old)]).toEqual([old, seen(now)])
  expect([seen(SEC_KIND), seen(PROD_KIND)].map((x) => [x.desk, x.to])).toEqual([[false, SEC_VISIT[0]], [false, PROD_SEAT]])
})

test('AC3: past MAX_CELLS cells a floor keeps the next team offices at one cell with role desks; family members never grow', () => {
  const six = Array.from({ length: 6 }, (_, i) => office(`t${i}`, NOW - i))
  const w6 = worldFromBeats(null, six, NOW)
  expect(w6.depts.map((d) => d.room[3]! - d.room[1]!)).toEqual([13, 13, 13, 13, 13, 13]) // 24 cells, six grid rows
  expect(MAX_CELLS).toBe(24)
  const w7 = worldFromBeats(null, [...six, office('t6', NOW - 6)], NOW)
  expect(w7.depts.map((d) => [d.id, !!d.desks])).toEqual([['t0', true], ['t1', true], ['t2', true], ['t3', true], ['t4', true], ['t5', false], ['t6', false]])
  for (const d of w7.depts.filter((x) => !x.desks)) {
    expect([d.id, d.room[2]! - d.room[0]!, d.room[3]! - d.room[1]!]).toEqual([d.id, 7, 6])
    expect(w7.agents.filter((a) => a.dept === d.id).map((a) => a.id).sort()).toEqual([`${d.id}-impl`, `${d.id}-jefe`, `${d.id}-qa`, `${d.id}-rev`])
  }
  // three rows take 2x3 cells: four such offices fill the floor; with a fifth (its cell counted) the fourth stays too
  const tall = Array.from({ length: 5 }, (_, i) => office(`r${i}`, NOW - i, teams(3)))
  expect(worldFromBeats(null, tall.slice(0, 4), NOW).depts.map((d) => d.room[3]! - d.room[1]!)).toEqual([20, 20, 20, 20])
  expect(worldFromBeats(null, tall, NOW).depts.map((d) => d.room[3]! - d.room[1]!)).toEqual([20, 20, 20, 6, 6])
  const kid = office('hijo', NOW - 1)
  kid.parent = 'padre'
  const fam = worldFromBeats(null, [office('padre', NOW), kid], NOW)
  expect(fam.depts.map((d) => [d.id, d.desks ?? null, d.teams ?? null])).toEqual([['padre', null, null], ['hijo', null, null]])
})

test('AC4: with 2 teams x 3 each team sits in its row in spawn order, ids are <dept>-<agentId>, a bad agentId is dropped, the secretaria and Producto take no desk', () => {
  const b = office('o', NOW)
  setAgent(b, 'bad id!', NOW + 10, { role: 'impl', kind: 'agentville:builder', goal: A, state: 'trabajando', activity: 'x' })
  setAgent(b, 'sec1', NOW + 11, { role: 'impl', kind: SEC_KIND, goal: 'A: ¿encaja?', state: 'terminado', activity: 'x' })
  setAgent(b, 'prod1', NOW + 12, { role: 'impl', kind: PROD_KIND, goal: 'A: ¿encaja?', state: 'terminado', activity: 'x' })
  const w = worldFromBeats(null, [b], NOW + 20), d = w.depts[0]!, [ox, oy] = d.room as [number, number]
  expect(d.desks).toEqual([
    { id: 'o-jefe', x: ox + 1, y: oy + 1 },
    { id: 'o-oa0', x: ox + 4, y: oy + 1 }, { id: 'o-oa1', x: ox + 7, y: oy + 1 }, { id: 'o-oa2', x: ox + 10, y: oy + 1 },
    { id: 'o-oa3', x: ox + 4, y: oy + 1 + ROW_PITCH }, { id: 'o-oa4', x: ox + 7, y: oy + 1 + ROW_PITCH }, { id: 'o-oa5', x: ox + 10, y: oy + 1 + ROW_PITCH },
  ])
  expect(w.agents.map((a) => a.id)).toEqual(['o-jefe', 'o-oa0', 'o-oa1', 'o-oa2', 'o-oa3', 'o-oa4', 'o-oa5'])
  for (const a of w.agents) { const q = d.desks!.find((x) => x.id === a.id)!; expect([a.id, a.x, a.y, a.posture]).toEqual([a.id, q.x + 1.5, q.y + 1.5, 'sit']) }
  expect(w.agents.find((a) => a.id === 'o-oa1')!.aid).toBe('oa1')
  // a session without teams keeps its role desks and never seats the secretaria or Producto either
  const plain = newBeat('p', 'Plana', NOW)
  setAgent(plain, MAIN, NOW, { state: 'trabajando', activity: 'x' })
  setAgent(plain, 'sec1', NOW, { role: 'impl', kind: SEC_KIND, state: 'trabajando', activity: 'x' })
  expect(worldFromBeats(null, [plain], NOW).agents.map((a) => a.id)).toEqual(['p-jefe'])
})

test('AC5: the furniture draws a tapete per team, its name in caps (ES and EN), squeezed only when it overflows; role tags by subagent type', () => {
  const v = floorView(worldFromBeats(null, [office('o', NOW)], NOW), 0), svg = furnitureLayer(v, NOW).join('')
  expect(svg.split('fill="rgba(255,255,255,0.55)"').length - 1).toBe(2)
  expect(svg).toContain('>EQUIPO A · FUNCIÓN PARA MEDIR BIEN</text>')
  expect(svg).toContain('>EQUIPO B · ERROR AL EDITAR</text>')
  inLang('en', () => expect(furnitureLayer(v, NOW).join('')).toContain('>TEAM A · FUNCIÓN PARA MEDIR BIEN</text>'))
  const textOf = (s: string, label: string) => s.match(new RegExp(`<text[^>]*>${label}</text>`))![0]
  expect(textOf(svg, 'EQUIPO B · ERROR AL EDITAR')).not.toContain('textLength')
  const long = `A: ${'Una tarea con un nombre muy largo que ocupa cincuenta'.slice(0, 50)}`
  const w2 = floorView(worldFromBeats(null, [office('o', NOW, [[long, 'agentville:builder'], [B, 'agentville:builder']])], NOW), 0), svg2 = furnitureLayer(w2, NOW).join('')
  const cutLabel = `${`EQUIPO A · ${long.slice(3).toUpperCase()}`.slice(0, 33)}…`
  expect(textOf(svg2, cutLabel)).toContain('textLength="134.4"')
  // names are text, never markup
  const evil = floorView(worldFromBeats(null, [office('o', NOW, [['A: <b>x</b>', 'agentville:builder']])], NOW), 0)
  expect(furnitureLayer(evil, NOW).join('')).toContain('EQUIPO A · &lt;B&gt;X&lt;/B&gt;')
  const tags = selectionLayer(v, NOW, '', 'tag')
  // the Jefe's role tag keeps a few px of air left of the office's name tag on the same line
  const ls = labelsOf(v), name = ls.find((l) => l.kind === 'tag')!.rect, jefe = ls.find((l) => l.kind === 'role' && l.id === 'o-jefe')!.rect
  expect([jefe[3] > name[1] && jefe[1] < name[3], name[0] - jefe[2] >= 4]).toEqual([true, true])
  for (const tag of ['Impl', 'Seg', 'Juez', 'Código']) expect([tag, tags.includes(`>${tag}</text>`)]).toEqual([tag, true])
  // without the map's people (the page's rule took them) no role tag floats over an empty desk; the office keeps its name
  const bare = selectionLayer(v, NOW, '', 'tag', false)
  for (const tag of ['Impl', 'Seg', 'Juez', 'Código', 'Jefe']) expect([tag, bare.includes(`>${tag}</text>`)]).toEqual([tag, false])
  expect(bare).toContain(labelsOf(v).find((l) => l.kind === 'tag')!.s)
  expect([roleTag({ role: 'qa', kind: 'gp-tester' }), roleTag({ role: 'rev', kind: 'agentville:ux-reviewer' }), roleTag({ role: 'impl', kind: 'agentville:spec-writer' }), roleTag({ role: 'rev', kind: 'agentville:ui-reviewer' })]).toEqual(['QA', 'UX', 'Spec', 'UI'])
  inLang('en', () => expect([roleTag({ role: 'impl', kind: 'agentville:builder' }), roleTag({ role: 'qa', kind: 'agentville:security-reviewer' }), roleTag({ role: 'qa', kind: 'agentville:approver' }), roleTag({ role: 'rev', kind: 'agentville:code-reviewer' })]).toEqual(['Build', 'Sec', 'Judge', 'Code']))
})

test('AC6 a, b: a member that finishes or fails walks to its Jefe, stays VISIT_MS, walks back, crossing no desk; finished ones keep their desk TEAM_KEEP', () => {
  expect(crossesDesk([[0, 0.5], [10, 0.5]], [{ x: 3, y: 0 }])).toBe(true) // the check sees a desk on the way
  for (const [end, key] of [['terminado', 'oa1'], ['error', 'oa4']] as const) {
    const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW), T1 = NOW + 10000
    setAgent(b, key, T1, { state: end })
    const w1 = worldFromBeats(w0, [b], T1), d = w1.depts[0]!, a = w1.agents.find((x) => x.id === `o-${key}`)!
    const spot = [d.room[0]! + 2.5, d.room[1]! + 3.5], desk = d.desks!.find((q) => q.id === a.id)!, seat = [desk.x + 1.5, desk.y + 1.5]
    expect([end, a.walk!.pts[0], a.walk!.pts.at(-1)]).toEqual([end, seat, spot])
    expect(crossesDesk(a.walk!.pts, d.desks!)).toBe(false)
    const arrive = T1 + a.walk!.dur * 1000, until = a.visit!.until
    expect(Math.round(until - arrive)).toBe(VISIT_MS)
    expect([at(look(w1, a.id, arrive + 50), spot), at(look(w1, a.id, until - 50), spot)]).toEqual([true, true])
    const there = look(w1, a.id, until + 50)
    expect([end, there.posture, at(there, seat)]).toEqual([end, 'walk', false]) // on its way back
    const back = look(w1, a.id, until + a.walk!.dur * 1000 + 50)
    expect([end, at(back, seat), back.posture]).toEqual([end, true, 'sit'])
    // the way back crosses no desk either (read again after the visit)
    const w2 = worldFromBeats(w1, [b], until + 100), a2 = w2.agents.find((x) => x.id === a.id)!
    expect([end, a2.walk!.pts.at(-1), crossesDesk(a2.walk!.pts, d.desks!)]).toEqual([end, seat, false])
    if (end === 'terminado') {
      expect(worldFromBeats(w2, [b], T1 + TEAM_KEEP - 1000).agents.find((x) => x.id === a.id)).toMatchObject({ x: seat[0], y: seat[1], posture: 'sit' })
      expect(worldFromBeats(w2, [b], T1 + TEAM_KEEP + 1000).agents.some((x) => x.id === a.id)).toBe(false)
    }
  }
})

test('AC6 c, h: a member asking for permission stops SEC_STOP_MS at the secretaria\'s visitor spot facing her, then walks on to your queue', () => {
  const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW), T1 = NOW + 1000
  setAgent(b, 'oa2', T1, { state: 'esperando', cmd: 'pnpm test' })
  const w1 = worldFromBeats(w0, [b], T1), a = w1.agents.find((x) => x.id === 'o-oa2')!
  expect(a.walk!.pts.at(-1)).toEqual(SEC_VISIT[0])
  expect(crossesDesk(a.walk!.pts, w1.depts[0]!.desks!)).toBe(false)
  const there = T1 + a.walk!.dur * 1000
  expect(Math.abs(a.visit!.until - (there + SEC_STOP_MS)) < 1).toBe(true)
  // during the pause: at her visitor spot, facing her (read again by a heartbeat meanwhile: the stop is kept)
  const w2 = worldFromBeats(w1, [b], there + 1000)
  for (const t of [there + 50, there + SEC_STOP_MS - 50]) {
    const c = clone(w2); settle(c, t)
    const s = c.agents.find((x) => x.id === a.id)!
    expect([t - there, at(posAt(s, t), SEC_VISIT[0]!), s.walk, s.facing]).toEqual([t - there, true, null, 'br'])
  }
  // after the pause plus the walk: in your queue, by the spot's row (no cut through her desk)
  const c = clone(w2); settle(c, there + SEC_STOP_MS + 10)
  const on = c.agents.find((x) => x.id === a.id)!
  expect([on.walk!.pts[0], on.walk!.pts.at(-1)]).toEqual([SEC_VISIT[0], [24.5, 4.5]])
  expect(at(look(w2, a.id, there + SEC_STOP_MS + on.walk!.dur * 1000 + 50), [24.5, 4.5])).toBe(true)
  // once per wait: later heartbeats leave it in the queue
  const w3 = worldFromBeats(w2, [b], there + SEC_STOP_MS + 20000)
  expect(at(look(w3, a.id, there + SEC_STOP_MS + 20000), [24.5, 4.5])).toBe(true)
  expect(w3.agents.find((x) => x.id === a.id)!.walk).toBe(null)
})

test('AC6 c: an agent answered after a long wait walks back from its queue spot to its desk (no teleport)', () => {
  const b = office('o', NOW), T1 = NOW + 1000
  let w = worldFromBeats(null, [b], NOW)
  const desk = (({ x, y }) => [x, y])(w.agents.find((x) => x.id === 'o-oa2')!)
  setAgent(b, 'oa2', T1, { state: 'esperando', cmd: 'pnpm test' })
  for (let t = T1; t <= T1 + 60000; t += 3000) w = worldFromBeats(w, [b], t) // waits 60 s, a heartbeat every 3 s
  const ans = T1 + 60000 + 1000
  expect(at(look(w, 'o-oa2', ans - 10), [24.5, 4.5])).toBe(true)
  setAgent(b, 'oa2', ans, { state: 'trabajando', activity: 'Edit x.ts' })
  w = worldFromBeats(w, [b], ans)
  const c = clone(w); settle(c, ans + 100)
  const a = c.agents.find((x) => x.id === 'o-oa2')!
  expect(a.walk === null).toBe(false)
  expect([a.walk!.pts[0], a.walk!.pts.at(-1), a.walk!.start]).toEqual([[24.5, 4.5], desk, ans])
  expect(at(look(w, 'o-oa2', ans + 100), desk)).toBe(false)
  expect(at(look(w, 'o-oa2', ans + a.walk!.dur * 1000 + 50), desk)).toBe(true)
})

test('AC6 c: an agent already in your office (queue strip) when it starts to ask goes to the queue without stopping at the secretaria', () => {
  const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW)
  const j = w0.agents.find((x) => x.id === 'o-jefe')!
  j.x = 24.5; j.y = 6.5; j.walk = null // standing in your office
  setAgent(b, MAIN, NOW + 1000, { state: 'esperando', cmd: 'pnpm test' })
  const w1 = worldFromBeats(w0, [b], NOW + 1000), a = w1.agents.find((x) => x.id === 'o-jefe')!
  expect([a.visit, a.walk!.pts.at(-1), a.walk!.pts.some((p) => at({ x: p[0]!, y: p[1]! }, SEC_VISIT[0]!))]).toEqual([undefined, [24.5, 4.5], false])
})

// The impact step (Z): Gem stays seated; the session's Jefe walks to her visitor spot, into Producto, then home or on
// to your queue. Each walk is checked against the glass, and Gem at her seat at every moment looked at.
const jefe = (w: AgentvilleWorld) => w.agents.find((x) => x.id === 'o-jefe')!
const home = (w: AgentvilleWorld) => [w.depts[0]!.room[0]! + 2.5, w.depts[0]!.room[1]! + 2.5]
const gemSits = (w: AgentvilleWorld, t: number) => expect([t, look(w, SEC_ID, t)]).toEqual([t, { x: SEC_SEAT[0], y: SEC_SEAT[1], posture: 'sit', facing: 'br' }])
/** The Jefe's walk in `w` from `from` to `to`: through no glass, Gem seated while it walks; the time it arrives. */
function walked(w: AgentvilleWorld, from: number[], to: number[]) {
  const j = jefe(w), end = j.walk!.start + j.walk!.dur * 1000
  expect([j.walk!.pts[0], j.walk!.pts.at(-1), throughGlass(j.walk!.pts)]).toEqual([from, to, false])
  for (const t of [j.walk!.start + 10, (j.walk!.start + end) / 2, end + 50]) gemSits(w, t)
  return end
}
/** The secretaria runs for office `o` at T1, then answers `answer` at T2: the world at each. */
function toHer(answer: string, T1: number, T2: number) {
  const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW)
  setAgent(b, 'sec', T1, { role: 'impl', kind: SEC_KIND, state: 'leyendo', activity: 'Read metas.md', goal: '¿Encaja?' })
  const w1 = worldFromBeats(w0, [b], T1)
  const there = walked(w1, home(w0), SEC_VISIT[0]!)
  expect(look(w1, 'o-jefe', there + 50)).toMatchObject({ x: SEC_VISIT[0]![0], y: SEC_VISIT[0]![1], posture: 'stand', facing: 'br' }) // facing her
  const mid = worldFromBeats(w1, [b], there + 1000) // a heartbeat while she reads
  setAgent(b, 'sec', T2, { state: 'terminado', answer })
  return { b, w1, w2: worldFromBeats(mid, [b], T2) }
}
const sits = (w: AgentvilleWorld, t: number) => expect([t, look(w, 'o-jefe', t)]).toEqual([t, { x: PROD_SEAT[0], y: PROD_SEAT[1], posture: 'sit', facing: 'bl' }])

test('Z PRODUCT then DECIDED: the Jefe stands at Gem\'s spot, walks into Producto and sits at its table until the answer, then walks home; Gem stays seated', () => {
  const T1 = NOW + 5000, T2 = T1 + 20000
  const { b, w2 } = toHer('PRODUCT\nEncaja con la meta delegada.', T1, T2)
  const seated = walked(w2, SEC_VISIT[0]!, PROD_SEAT)
  sits(w2, seated + 50)
  // Producto runs: every heartbeat keeps it seated
  const T3 = T2 + 15000
  setAgent(b, 'prod', T3, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'Read metas.md' })
  let w = worldFromBeats(w2, [b], T3)
  for (let t = T3 + 3000; t <= T3 + 30000; t += 3000) { w = worldFromBeats(w, [b], t); sits(w, t + 100); gemSits(w, t + 100) }
  // DECIDED: home at once
  const T4 = T3 + 31000
  setAgent(b, 'prod', T4, { state: 'terminado', answer: 'DECIDED\nOpción: B\nPriority: high' })
  const w4 = worldFromBeats(w, [b], T4), back = walked(w4, PROD_SEAT, home(w4))
  expect(look(w4, 'o-jefe', back + 50)).toMatchObject({ x: home(w4)[0], y: home(w4)[1], posture: 'sit' })
})

for (const [word, answer] of [['NO FIT', 'NO FIT\nPriority: low'], ['ESCALATE', 'ESCALATE\nToca datos personales.\nA) Pedir consentimiento\nB) Anonimizar\nRecomendada: B']]) test(`Z PRODUCT then ${word}: the Jefe keeps its seat at Producto while its turn goes on, then walks past Gem into your queue when it asks`, () => {
  const T1 = NOW + 5000, T2 = T1 + 20000
  const { b, w2 } = toHer('PRODUCT', T1, T2)
  walked(w2, SEC_VISIT[0]!, PROD_SEAT)
  const T3 = T2 + 10000
  setAgent(b, 'prod', T3, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'Read metas.md' })
  const w3 = worldFromBeats(w2, [b], T3), T4 = T3 + 10000
  setAgent(b, 'prod', T4, { state: 'terminado', answer })
  const w4 = worldFromBeats(w3, [b], T4)
  sits(w4, T4 + 100)
  const w5 = worldFromBeats(w4, [b], T4 + 3000) // the next heartbeat, still working: still seated
  sits(w5, T4 + 3100)
  // it asks you: by Gem's spot (the stop anyone asking makes) into your queue
  const T6 = T4 + 5000
  setAgent(b, MAIN, T6, { state: 'esperando', activity: 'Pregunta' })
  const w6 = worldFromBeats(w5, [b], T6), there = walked(w6, PROD_SEAT, SEC_VISIT[0]!)
  const c = clone(w6); settle(c, there + SEC_STOP_MS + 10)
  const on = c.agents.find((x) => x.id === 'o-jefe')!
  expect([on.walk!.pts[0], on.walk!.pts.at(-1), throughGlass(on.walk!.pts)]).toEqual([SEC_VISIT[0], [24.5, 4.5], false])
  for (const t of [there + 1000, there + SEC_STOP_MS + 500]) gemSits(w6, t)
  expect(at(look(w6, 'o-jefe', there + SEC_STOP_MS + on.walk!.dur * 1000 + 50), [24.5, 4.5])).toBe(true)
  // a NO FIT it heard and did not ask about (its turn ended) sends it home
  const d = toHer('PRODUCT', T1, T2), e3 = T2 + 10000
  setAgent(d.b, 'prod', e3, { role: 'impl', kind: PROD_KIND, state: 'terminado', answer: 'NO GOALS' })
  setAgent(d.b, MAIN, e3, { state: 'terminado' })
  const e = worldFromBeats(d.w2, [d.b], e3)
  expect(jefe(e).walk!.pts.at(-1)).not.toEqual(PROD_SEAT)
})

test('Z PERSON: the Jefe stays at Gem\'s spot while its turn goes on and walks from there into your queue when it asks, at most STAFF_MS; Gem never leaves her desk', () => {
  const T1 = NOW + 5000, T2 = T1 + 20000
  const { b, w2 } = toHer('PERSON\nTocar precios es tuyo.', T1, T2)
  for (const t of [T2 + 100, T2 + 2900]) { expect([t, look(w2, 'o-jefe', t)]).toMatchObject([t, { x: SEC_VISIT[0]![0], y: SEC_VISIT[0]![1], posture: 'stand' }]); gemSits(w2, t) }
  const T3 = T2 + 3000
  setAgent(b, MAIN, T3, { state: 'esperando', activity: 'Pregunta' })
  const w3 = worldFromBeats(w2, [b], T3), j = jefe(w3)
  expect(j.visit).toBe(undefined) // no second stop: it is at her desk already
  const there = walked(w3, SEC_VISIT[0]!, [24.5, 4.5])
  expect(at(look(w3, 'o-jefe', there + 50), [24.5, 4.5])).toBe(true)
  // a Jefe that goes on working past STAFF_MS without asking walks home then
  const d = toHer('PERSON', T1, T2)
  let w = d.w2
  for (let t = T2 + 3000; t < T2 + STAFF_MS; t += 30000) { w = worldFromBeats(w, [d.b], t); expect(at(look(w, 'o-jefe', t + 100), SEC_VISIT[0]!)).toBe(true) }
  w = worldFromBeats(w, [d.b], T2 + STAFF_MS + 100)
  walked(w, SEC_VISIT[0]!, home(w))
})

test('Z: verdicts are read by their first words, markdown and punctuation dropped: the Jefe stays at Producto only for ESCALATE, NO FIT or NO GOALS; anything else, an empty answer or a failed run, sends it home', () => {
  const T1 = NOW + 5000, T2 = T1 + 20000
  // a lowercase "product" from the secretaria takes it into Producto
  const { w2: lower } = toHer('product', T1, T2)
  walked(lower, SEC_VISIT[0]!, PROD_SEAT)
  for (const [end, stays] of [[{ answer: '' }, false], [{ answer: 'DECIDED.\nPriority: low' }, false], [{ answer: 'Decided' }, false], [{ answer: '**ESCALATE**\nA) x\nB) y' }, true], [{ answer: 'No fit.' }, true], [{ state: 'error' as const }, false]] as const) {
    const { b, w2 } = toHer('**PRODUCT**', T1, T2), T3 = T2 + 10000
    setAgent(b, 'prod', T3, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'Read metas.md' })
    const w3 = worldFromBeats(w2, [b], T3), T4 = T3 + 10000
    setAgent(b, 'prod', T4, { state: 'terminado', ...end })
    const w4 = worldFromBeats(w3, [b], T4), j = jefe(w4)
    expect([end, j.walk ? j.walk.pts.at(-1) : [j.x, j.y]]).toEqual([end, stays ? PROD_SEAT : home(w4)])
  }
})

test('Z: a Producto run with no secretaria before it (a new office) takes that Jefe from its desk to Producto\'s chair until it ends; Gem stays seated', () => {
  const b = office('o', NOW), w0 = worldFromBeats(null, [b], NOW), T1 = NOW + 5000
  setAgent(b, 'prod', T1, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'Read metas.md' })
  const w1 = worldFromBeats(w0, [b], T1)
  sits(w1, walked(w1, home(w0), PROD_SEAT) + 50)
  setAgent(b, 'prod', T1 + 30000, { state: 'terminado', answer: 'FITS\nPriority: medium' }) // an older agent file's word for DECIDED
  const w2 = worldFromBeats(w1, [b], T1 + 30000)
  walked(w2, PROD_SEAT, home(w2))
  // an old world's secretaria away from her desk is back at it on the next read
  const old = clone(w2); old.staff!.sec.x = PROD_DOOR[0]!; old.staff!.sec.y = PROD_DOOR[1]!; old.staff!.sec.visit = { ...xy(PROD_DOOR), until: T1 + 99999 }
  gemSits(worldFromBeats(old, [b], T1 + 31000), T1 + 31000)
})

test('AC7: Producto\'s room is its own office right of the lobby; every lobby spot left of it and off the furniture, 20 of them; its board shows the goals per the rule, escaped', () => {
  // the lobby's furniture boxes (x0, y0, x1, y1): sofas, coffee table, TV console with the PS5, coffee counter, cooler,
  // plant; only the sofa spots sit on one
  const furniture = [[3, 4, 6, 5], [3, 8, 6, 9], [4, 6, 6, 7], [8.3, 0.1, 10.9, 0.65], [1.4, 0.15, 4.3, 0.85], [4.5, 0.4, 5.4, 1.1], [0.4, 0.4, 1.1, 1.1]]
  for (const s of LOBBY_SPOTS) expect([s.x, s.y, s.x < PROD_ROOM[0]!, !s.sit && furniture.some((r) => s.x > r[0]! && s.x < r[2]! && s.y > r[1]! && s.y < r[3]!)]).toEqual([s.x, s.y, true, false])
  expect(LOBBY_SPOTS.length).toBe(20)
  const plain = worldFromBeats(null, [], NOW), svg = furnitureLayer(plain, NOW).join('')
  expect(svg).toContain('M-20.8 58.4l48 24') // the left sofa's back, box(3, 4, ...)
  expect(svg).not.toContain('M123.2 130.4l48 24') // the right one's, box(12, 4, ...): gone
  expect(svg).toContain('>Sin metas</text>')
  expect(svg).toContain('>Producto</text>')
  // the newest office with goals shows them; the one consulting Producto now wins
  const old = office('viejo', NOW - 5000), mine = office('mio', NOW - 1000), other = office('otro', NOW)
  old.metas = ['Meta vieja']; mine.metas = ['<script>alert(1)</script>', 'Meta: ahorro', 'Lanzar F2', 'cuarta']
  const w1 = worldFromBeats(null, [old, mine, other], NOW)
  expect(w1.staff!.goals).toEqual(['<script>alert(1)</script>', 'Meta: ahorro', 'Lanzar F2'])
  const svg1 = furnitureLayer(w1, NOW).join('')
  expect(svg1).toContain('&lt;script&gt;alert(…')
  expect(svg1).not.toContain('<script')
  expect(w1.depts.find((d) => d.id === 'viejo')!.metas).toEqual(['Meta vieja'])
  setAgent(old, 'prod', NOW, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'x' })
  expect(worldFromBeats(null, [old, mine, other], NOW).staff!.goals).toEqual(['Meta vieja'])
  setAgent(other, 'prod', NOW + 1, { role: 'impl', kind: PROD_KIND, state: 'leyendo', activity: 'x' })
  delete old.agents.prod
  expect(worldFromBeats(null, [old, mine, other], NOW).staff!.goals).toEqual([]) // consulting with no goals file: none
  // a beat file's goals are checked again as read: strings only, one line of 60
  const odd = office('raro', NOW)
  ;(odd as unknown as { metas: unknown }).metas = [7, `una\nmeta ${'x'.repeat(80)}`, { t: 'x' }]
  expect(worldFromBeats(null, [odd], NOW).staff!.goals).toEqual([`una meta ${'x'.repeat(50)}…`])
})

test('AC8: the secretaria and Producto are drawn on every floor, never as office agents, zones or queue', () => {
  const many = Array.from({ length: 17 }, (_, i) => office(`s${i}`, NOW - i, [['Arregla algo', 'agentville:builder']]))
  setAgent(many[0]!, MAIN, NOW, { state: 'esperando', cmd: 'pnpm test' })
  const w = worldFromBeats(null, many, NOW)
  expect(floorsOf(w)).toBe(2)
  for (const f of [0, 1]) {
    const v = floorView(w, f), furn = furnitureLayer(v, NOW).join(''), people = agentsLayer(v, NOW).join('')
    expect([f, furn.includes('>Gem · Secretaria</text>'), furn.includes('>Producto</text>')]).toEqual([f, true, true])
    for (const name of ['Analista', 'Marketing', 'Negocio', 'Junta']) expect([f, name, people.includes(`>${name}</text>`)]).toEqual([f, name, true])
    expect([f, v.agents.some((a) => a.id.startsWith('staff') || !a.dept)]).toEqual([f, false])
    expect([f, hotspots(v, NOW).some((z) => z.id.startsWith('staff') || z.group.startsWith('staff'))]).toEqual([f, false])
  }
  expect(w.staff!.sec.dept).toBe('')
  expect([w.staff!.sec.hair, w.staff!.sec.skin]).toEqual(['#7a3b1e', '#f0c6a0']) // Gem, the tour's guide
  inLang('en', () => expect(furnitureLayer(floorView(w, 0), NOW).join('')).toContain('>Gem · Secretary</text>'))
})
