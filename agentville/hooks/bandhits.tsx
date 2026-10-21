import type { ClientModule } from 'claude-code'

// Clickable zones over a drawing (the map, the tour's overlay), one Client per band of the pane's band layer: the
// skill mod-clicks' recipe, proven live. A Client never stretches vertically (it gets one text row), so the pane cuts the
// drawing into band Boxes about a row tall and each band that holds a zone draws one of these across it: invisible plain
// Buttons laid out by width fractions, each posting `{ press: key }`. A Client's Buttons keep their handles across the
// pane's redraws, so the first click lands.

/** A zone as fractions of the drawing; `scope` lights every Button of one hover scope together. */
export type BandZone = { key: string; x0: number; y0: number; x1: number; y1: number; scope?: string }
export type BandRun = { x0: number; x1: number; key: string | null; scope?: string }
// row: the band's first row of the n the drawing is cut into, its key in the pane: it stays put when bands above it
// merge or split (a card opening), so its Client and Buttons keep their keys (and their handles) across such redraws.
export type Band = { y0: number; y1: number; row: number; runs: BandRun[] }
// A run: its width's grow (fraction x 10000), the key it posts (null: no Button) and its hover scope. No run carries a
// label: the desktop draws a Button's label as visible text (a card's × read "Cerrar", twice over two bands; live
// 2026-10-18), so every Button shows the invisible filler only. `tint`: /agentville calibrar clics paints each keyed
// run's Box, so a strip row shows where each Button is and its gaps stay clear.
// A strip of button pictures (register.tsx `strip`) names its Buttons itself (`name`: the key, `<key>~<row + 1>` below
// its first row, each once per Client) and says what each picture reads (`words`, by key, for tests; never drawn).
type Run = [grow: number, key: string | null, scope: string | null] | [grow: number, key: string | null, scope: string | null, name: string]
type Props = { b: number; runs: Run[]; glow: string | null; tint?: string; words?: Record<string, string> }

/**
 * Cuts the drawing into `n` bands of equal height and lays each band's zones out as runs across it. A zone belongs to a
 * band it covers for at least half the shorter of the two (so a zone shorter than a band lands in the band that holds
 * most of it, and never vanishes); where zones in one band meet, the one covering more of the band wins (ties: the
 * first). Runs cover [0, 1]; bands with no zone merge, so they cost one Box.
 */
export function bandsOf(zones: BandZone[], n: number): Band[] {
  const out: Band[] = []
  for (let j = 0; j < n; j++) {
    const y0 = j / n, y1 = (j + 1) / n
    const cover = (z: BandZone) => Math.min(z.y1, y1) - Math.max(z.y0, y0)
    const here = zones.filter(z => cover(z) > 0 && cover(z) >= Math.min(z.y1 - z.y0, y1 - y0) / 2 - 1e-9)
    const xs = [...new Set([0, 1, ...here.flatMap(z => [Math.min(1, Math.max(0, z.x0)), Math.min(1, Math.max(0, z.x1))])])].sort((a, b) => a - b)
    const runs: BandRun[] = []
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!, x1 = xs[i + 1]!, xm = (x0 + x1) / 2
      let owner: BandZone | null = null
      for (const z of here) if (z.x0 <= xm && xm < z.x1 && (!owner || cover(z) > cover(owner))) owner = z
      const last = runs[runs.length - 1]
      if (last && last.key === (owner?.key ?? null) && last.scope === owner?.scope) last.x1 = x1
      else runs.push({ x0, x1, key: owner?.key ?? null, ...(owner?.scope ? { scope: owner.scope } : {}) })
    }
    const prev = out[out.length - 1]
    if (!runs.some(r => r.key) && prev && !prev.runs.some(r => r.key)) prev.y1 = y1
    else out.push({ y0, y1, row: j, runs })
  }
  return out
}

/** What the band layer costs the pane: its own Boxes and Clients (`pane`), and what the Clients draw (`clients`). */
export function bandEls(bands: Band[]) {
  const live = bands.filter(b => b.runs.some(r => r.key))
  return { pane: 1 + bands.length + live.length, clients: live.reduce((k, b) => k + 1 + b.runs.length + b.runs.filter(r => r.key).length, 0) }
}

/** One text row of a strip of pictures as a band: each run from its px width, in order (key null: a gap). Its zones
 * come from the very numbers that size the pictures, and each key lights its own hover scope. */
export function stripBand(row: number, parts: [px: number, key: string | null][]): Band {
  const w = parts.reduce((n, [px]) => n + px, 0)
  let x = 0
  return { y0: 0, y1: 1, row, runs: parts.map(([px, key]) => ({ x0: x / w, x1: (x += px) / w, key, ...(key ? { scope: `f-${key}`.slice(0, 64) } : {}) })) }
}

/** A band Client's props: the band's row (keys stay unique across the layer) and its runs as grow fractions. */
export const bandProps = (b: Band, glow: string | null = null): Props =>
  ({ b: b.row, runs: b.runs.map(r => [Math.max(0, Math.round((r.x1 - r.x0) * 10000)), r.key, r.scope ?? null]), glow })

// Hangul filler (U+3164): invisible and not trimmed like a space, two cells each; wider than any run, clipped by its Box.
// Every run Box is one row: its height 1 (with no shrink) keeps the filler from wrapping in a narrow run; the row
// direction and the clip only lay the Button out. Without the height the Client grows rows tall, over what lies below
// it (Ir al chat over EQUIPO; live 2026-10-20). No Box around the Button (btns.tsx's never-shrink hold): one more
// element per zone run breaks the pane's element budgets.
const FILL = '\u3164'.repeat(60)

const BandHits: ClientModule<Props> = (p, s) => {
  const { Box, Button } = s.elements
  // A Button's key: its zone's key and band, and how many runs of that key came before it in the band (not its run's
  // place), so a zone joining or leaving the band renames no other Button.
  const seen = new Map<string, number>()
  const nameOf = (key: string) => { const k = seen.get(key) ?? 0; seen.set(key, k + 1); return k ? `${key}@${p.b}.${k}` : `${key}@${p.b}` }
  return (
    <Box flexDirection="row" flexGrow={1}>
      {p.runs.map(([grow, key, scope, name]) => (key
        ? (
          <Box width={0} height={1} flexShrink={0} flexGrow={grow} flexDirection="row" overflow="hidden" justifyContent="center" backgroundColor={p.tint}>
            <Button key={name ?? nameOf(key)} plain hover={scope && p.glow ? { scope, backgroundColor: p.glow } : undefined} onPress={() => s.post({ press: key })}>{FILL}</Button>
          </Box>
        )
        : <Box width={0} height={1} flexShrink={0} flexGrow={grow} flexDirection="row" overflow="hidden" />))}
    </Box>
  )
}
export default BandHits
