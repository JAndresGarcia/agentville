import { expect, test } from 'claude-code/testing'

import BandHits, { bandEls, bandProps, bandsOf } from '../hooks/bandhits'
import type { Band, BandZone } from '../hooks/bandhits'

type Node = { type: string; props: Record<string, unknown> & { children?: unknown[] } }
// BandHits drawn outside the engine: each element a plain node, so its tree can be read and its Buttons pressed.
function draw(band: Band, _row: number, glow: string | null = null) { // _row: the caller's view of band.row, for reading
  const posted: unknown[] = []
  const el = (type: string) => (p: Record<string, unknown>) => ({ type, props: p })
  const tree = BandHits(bandProps(band, glow), { elements: { Box: el('Box'), Button: el('Button') }, post: (d: unknown) => { posted.push(d) }, columns: 110 } as never) as unknown as Node
  const nodes = (n: unknown): Node[] => (n && typeof n === 'object' && 'type' in n ? [n as Node, ...((n as Node).props.children ?? []).flat().flatMap(nodes)] : [])
  return { posted, all: nodes(tree) }
}
const keys = (b: Band) => b.runs.map(r => r.key)
const covers = (b: Band) => Math.abs(b.runs[0]!.x0) < 1e-9 && Math.abs(b.runs.at(-1)!.x1 - 1) < 1e-9 && b.runs.every((r, i) => i === 0 || Math.abs(r.x0 - b.runs[i - 1]!.x1) < 1e-9)

test('bandsOf: each zone lands in the bands it covers, its runs at its width; empty bands merge into one Box', () => {
  const zones: BandZone[] = [
    { key: 'next', x0: 0.5, x1: 0.7, y0: 0.0, y1: 0.1 }, // exactly band 0
    { key: 'back', x0: 0.1, x1: 0.3, y0: 0.0, y1: 0.1 },
    { key: 'tile', x0: 0.2, x1: 0.8, y0: 0.42, y1: 0.61 }, // bands 4 (most of 0.40-0.50) and 5; 6 holds 0.01 of it: no
  ]
  const bands = bandsOf(zones, 10)
  expect(bands.map(b => [b.y0, b.y1].map(v => Math.round(v * 100)))).toEqual([[0, 10], [10, 40], [40, 50], [50, 60], [60, 100]])
  expect(bands.map(b => b.row)).toEqual([0, 1, 4, 5, 6]) // each band's first row: its key in the pane
  expect(keys(bands[0]!)).toEqual([null, 'back', null, 'next', null])
  expect(bands[0]!.runs.map(r => Math.round((r.x1 - r.x0) * 100))).toEqual([10, 20, 20, 20, 30])
  expect(keys(bands[1]!)).toEqual([null]) // bands 1 to 3: one empty Box
  expect(keys(bands[2]!)).toEqual([null, 'tile', null])
  expect(keys(bands[3]!)).toEqual([null, 'tile', null])
  expect(keys(bands[4]!)).toEqual([null])
  for (const b of bands) expect(covers(b)).toBe(true)
})

test('bandsOf: a zone shorter than a band still lands in one; where zones meet in a band, the one covering more of it wins', () => {
  const small = bandsOf([{ key: 'dot', x0: 0.4, x1: 0.45, y0: 0.47, y1: 0.52 }], 10) // 0.03 in band 4, 0.02 in band 5
  expect(small.filter(b => b.runs.some(r => r.key)).map(b => Math.round(b.y0 * 10))).toEqual([4])
  const meet = bandsOf([{ key: 'above', x0: 0, x1: 0.6, y0: 0, y1: 0.43 }, { key: 'below', x0: 0.4, x1: 1, y0: 0.43, y1: 1 }], 10)
  const b4 = meet.find(b => Math.round(b.y0 * 10) === 4)!
  expect(keys(b4)).toEqual([null, 'below']) // 'above' covers 0.03 of band 4, under half: only 'below' is in it
  const tie = bandsOf([{ key: 'a', x0: 0, x1: 0.625, y0: 0.25, y1: 0.375 }, { key: 'b', x0: 0.375, x1: 1, y0: 0.375, y1: 0.5 }], 4)
  expect(tie.find(b => b.runs.some(r => r.key))!.runs.map(r => [r.key, r.x1])).toEqual([['a', 0.625], ['b', 1]]) // equal cover: the first keeps the overlap
  expect(bandsOf([], 4)).toEqual([{ y0: 0, y1: 1, row: 0, runs: [{ x0: 0, x1: 1, key: null }] }])
})

test('BandHits: one invisible plain Button per zone run, each posting its key; keys unique across bands; hover only with a scope and a glow', () => {
  const band: Band = { y0: 0.2, y1: 0.25, row: 7, runs: [{ x0: 0, x1: 0.1, key: null }, { x0: 0.1, x1: 0.4, key: 's1-jefe', scope: 'av-s1-jefe' }, { x0: 0.4, x1: 0.6, key: null }, { x0: 0.6, x1: 1, key: 'screen-hq', scope: 'av-screen-hq' }] }
  const { posted, all } = draw(band, 7, 'rgba(255,255,255,0.18)')
  const buttons = all.filter(n => n.type === 'Button')
  expect(buttons.map(b => b.props.key)).toEqual(['s1-jefe@7', 'screen-hq@7']) // key and band, never the run's place
  // a zone split in two runs by another: its second run is its second Button; a zone joining the band renames none
  const split: Band = { ...band, runs: [{ x0: 0, x1: 0.3, key: 'a' }, { x0: 0.3, x1: 0.5, key: 'b' }, { x0: 0.5, x1: 1, key: 'a' }] }
  const names = (b: Band) => draw(b, 7).all.filter(n => n.type === 'Button').map(n => String(n.props.key))
  expect(names(split)).toEqual(['a@7', 'b@7', 'a@7.1'])
  expect(names({ ...band, runs: [{ x0: 0, x1: 0.05, key: 'new' }, ...band.runs.slice(1)] })).toEqual(['new@7', 's1-jefe@7', 'screen-hq@7'])
  for (const b of buttons) (b.props.onPress as () => void)()
  expect(posted).toEqual([{ press: 's1-jefe' }, { press: 'screen-hq' }])
  for (const b of buttons) expect([b.props.plain, /^\u3164+$/.test((b.props.children ?? []).join(''))]).toEqual([true, true])
  expect(buttons.map(b => (b.props.hover as { scope?: string } | undefined)?.scope)).toEqual(['av-s1-jefe', 'av-screen-hq'])
  const runBoxes = all.filter(n => n.type === 'Box').slice(1)
  expect(runBoxes.map(b => b.props.flexGrow)).toEqual([1000, 3000, 2000, 4000]) // laid out by width fraction
  for (const b of runBoxes) expect(b.props.width).toBe(0)
  expect(all.length).toBe(bandEls([band]).clients) // the count the pane adds to its element limit
  expect(bandEls([band, { y0: 0.25, y1: 1, row: 8, runs: [{ x0: 0, x1: 1, key: null }] }])).toEqual({ pane: 4, clients: 7 }) // layer, 2 bands, 1 Client
  const tour = draw({ y0: 0, y1: 0.1, row: 0, runs: [{ x0: 0, x1: 1, key: 'tour-next' }] }, 0) // the tour: no scope, no glow
  expect(tour.all.filter(n => n.type === 'Button').map(b => b.props.hover)).toEqual([undefined])
})

test('BandHits props (not live layout): every run Box is one row tall (the height stops its filler wrapping and growing the Client), laid out as a row and clipped', () => {
  const band: Band = { y0: 0, y1: 1, row: 0, runs: [{ x0: 0, x1: 0.02, key: 'chat' }, { x0: 0.02, x1: 1, key: null }] } // Ir al chat, its run narrow
  const { all } = draw(band, 0)
  const runBoxes = all.filter(n => n.type === 'Box').slice(1)
  expect(runBoxes.map(b => [b.props.height, b.props.flexShrink, b.props.flexDirection, b.props.overflow])).toEqual([[1, 0, 'row', 'hidden'], [1, 0, 'row', 'hidden']])
  // the filler, wider than the run, is held to one row by the Box's height and clipped sideways
  expect((runBoxes[0]!.props.children as Node[]).flat().map(n => n.type)).toEqual(['Button'])
})

test('A1: a band keeps its row when the bands above it merge or split, so its key stays the same', () => {
  const zones: BandZone[] = [{ key: 'a', x0: 0, x1: 0.2, y0: 0.0, y1: 0.1 }, { key: 'pin', x0: 0.5, x1: 0.6, y0: 0.6, y1: 0.7 }]
  const card: BandZone = { key: 'card-close', x0: 0.8, x1: 1, y0: 0.2, y1: 0.3 } // a card opening above the pin adds a band
  const rowOf = (bs: Band[]) => bs.find(b => b.runs.some(r => r.key === 'pin'))!.row
  const closed = bandsOf(zones, 10), open = bandsOf([...zones, card], 10)
  expect(closed.findIndex(b => b.row === 6) !== open.findIndex(b => b.row === 6)).toBe(true) // its place in the list moved
  expect([rowOf(closed), rowOf(open)]).toEqual([6, 6]) // its row did not
  const keys = (bs: Band[]) => bs.filter(b => b.runs.some(r => r.key)).flatMap(b => draw(b, b.row).all.filter(n => n.type === 'Button').map(x => String(x.props.key)))
  expect(keys(closed).filter(k => k.startsWith('pin@'))).toEqual(keys(open).filter(k => k.startsWith('pin@')))
  expect(keys(open)).toContain('pin@6')
})

test('calibrar clics: a tint paints each keyed run\'s Box, not the row or its gaps, and adds no element; none without it', () => {
  const band: Band = { y0: 0, y1: 0.1, row: 3, runs: [{ x0: 0, x1: 0.5, key: 'k' }, { x0: 0.5, x1: 1, key: null }] }
  const el = (type: string) => (p: Record<string, unknown>) => ({ type, props: p })
  const root = (tint?: string) => BandHits({ ...bandProps(band), ...(tint ? { tint } : {}) }, { elements: { Box: el('Box'), Button: el('Button') }, post: () => {}, columns: 110 } as never) as unknown as Node
  const bgs = (n: Node) => [n.props.backgroundColor, ...(n.props.children as Node[]).map(c => c.props.backgroundColor)]
  expect([bgs(root('rgba(255,60,60,0.30)')), bgs(root())]).toEqual([[undefined, 'rgba(255,60,60,0.30)', undefined], [undefined, undefined, undefined]])
  expect(draw(band, 3).all.length).toBe(bandEls([band]).clients)
})
