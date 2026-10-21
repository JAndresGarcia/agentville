import { expect, test } from 'claude-code/testing'

import { MAIN, newBeat, setAgent } from '../hooks/beat'
import type { Lang } from '../hooks/i18n'
import { floorView, initialWorld, rowsOf, tourTargets, viewOf, worldFromBeats } from '../hooks/scene'
import type { TourRect } from '../hooks/scene'
import { place, tourOverlay } from '../hooks/tour'

// The tour's bubble (place()) on a real 1-row map: 1 to 4 offices at work, the first with its team at their desks.
const NOW = Date.UTC(2026, 9, 18, 12)
const oneRow = (n: number) => {
  const list = Array.from({ length: n }, (_, i) => {
    const b = newBeat(`s${i}`, `Oficina ${i}`, NOW)
    setAgent(b, MAIN, NOW, { state: 'trabajando', activity: 'Bash pnpm test', cmd: null })
    if (i === 0) for (const [k, role] of [['ag1', 'impl'], ['ag2', 'rev'], ['ag3', 'qa']] as const) setAgent(b, k, NOW, { role, kind: role, state: 'trabajando', activity: 'Read a.ts' })
    return { ...b, slot: i }
  })
  return floorView(worldFromBeats(null, list, NOW), 0)
}
const cuts = (a: TourRect, b: TourRect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const SPOT = ['island', 'jefe', 'team', 'board', 'screen', 'lobby', 'despacho'] as const
const LANGS: Lang[] = ['es', 'en']

test('blocker 2: on a 1-row map the bubble never covers its target, any step, any focus office of 1 to 4, both languages', () => {
  let seen = 0
  for (let n = 1; n <= 4; n++) {
    const v = oneRow(n), view = viewOf(rowsOf(v))
    expect(rowsOf(v)).toBe(1)
    for (let f = 0; f < n; f++) for (const lang of LANGS) for (const step of SPOT) {
      const tg = tourTargets(v, NOW, `s${f}`)
      const target = tg[step]
      if (!target) continue
      const r = tourOverlay({ step, n: 2, total: 11, lang, view, target, name: 'Oficina 0', demoBanner: true })
      seen++
      expect([n, f, lang, step, cuts(r.card!, target)]).toEqual([n, f, lang, step, false])
    }
  }
  expect(seen).toBeGreaterThan(50)
})

test('blocker 2 by place(): a wide target low on the stage, no room below, puts the bubble above it; with room nowhere it stays inside', () => {
  for (const [tg, bw, bh] of [[[0.55, 0.6, 0.97, 0.9], 0.55, 0.45], [[0.1, 0.55, 0.95, 0.85], 0.4, 0.4]] as [TourRect, number, number][]) {
    const p = place(tg, bw, bh)
    expect([tg, p.side, cuts([p.left, p.top, p.left + bw, p.top + bh], tg), p.top >= 0, p.top + bh <= 0.97]).toEqual([tg, 'above', false, true, true])
  }
  const p = place([0.1, 0.25, 0.95, 0.7], 0.4, 0.45) // neither under nor over fits: the stage's bottom wins
  expect([p.side, p.top + 0.45 <= 0.97, p.top >= 0.1]).toEqual(['top', true, true])
})

test('blocker 3: with the banner a tall bubble stays inside the stage, on its side', () => {
  const p = place([0.05, 0.5, 0.2, 0.7], 0.5, 0.72, 0.3)
  expect([p.side, p.top + 0.72 <= 0.97]).toEqual(['left', true])
  for (let n = 1; n <= 4; n++) {
    const v = oneRow(n), tg = tourTargets(v, NOW)
    for (const lang of LANGS) {
      const r = tourOverlay({ step: 'despacho', n: 8, total: 11, lang, view: viewOf(rowsOf(v)), target: tg.despacho, demoBanner: true })
      expect([n, lang, r.card![3] <= 0.97, r.card![1] >= 87 / viewOf(rowsOf(v)).ht]).toEqual([n, lang, true, true]) // under the banner
    }
  }
})

test('AG: the chat step lights its own sample row at the bottom-left; the bubble never covers it and stays inside the stage', () => {
  const views = [1, 2, 3, 4].map(n => viewOf(rowsOf(oneRow(n)))).concat(viewOf(rowsOf(floorView(initialWorld(NOW), 0))))
  for (const view of views) for (const lang of LANGS) {
    const r = tourOverlay({ step: 'chat', n: 9, total: 12, lang, view, target: null, name: 'Oficina 0' })
    const row = r.svg.match(/<div style="position:absolute;left:(\d+)px;top:([\d.]+)px;width:([\d.]+)px;height:(\d+)px/)!.slice(1).map(Number) as [number, number, number, number]
    const tg: TourRect = [row[0] / view.w, row[1] / view.ht, (row[0] + row[2]) / view.w, (row[1] + row[3]) / view.ht]
    expect([lang, cuts(r.card!, tg), r.card![1] >= 0.1, r.card![3] <= 0.97, tg[0] < 0.1, tg[3] <= 1]).toEqual([lang, false, true, true, true, true])
    expect([r.svg.includes('Oficina 0'), r.svg.includes('↗'), r.alt.includes(lang === 'es' ? 'Ir al chat' : 'Go to a chat')]).toEqual([true, true, true])
    expect(r.svg.length < 131072 && !r.svg.includes(String.fromCharCode(0x2014))).toBe(true)
    expect(tourOverlay({ step: 'chat', n: 9, total: 12, lang, view, name: 'a\x07b\x1f<c>' }).svg.includes('ab&lt;c&gt;')).toBe(true) // control characters dropped
  }
})
