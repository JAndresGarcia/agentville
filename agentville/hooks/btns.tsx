import type { ClientModule } from 'claude-code'

// The pane's buttons, drawn inside a Client: a pane Button gets a new handle on every redraw and the desktop drops a
// press on a stale one ("ui_press not handled"); a Client's Buttons keep theirs in its own frame, by key. Each press
// posts `{ press: key }`; the pane's ui.message hook looks the key up in what its last drawing said it does.
// An item with `desc` is a block: a bold label over a dim line, each one row, covered by an invisible plain Button per
// row (a Button takes clicks on its one text row only; Hangul filler, clipped by its Box). The second row's Button
// posts the same key. The Client itself always sits in flow: one in an absolute Box gets a single row.
// `plain` is set or left out, never false: an explicit `plain={false}` makes the desktop refuse the whole Client.
// `primary` is a plain Button in a Box of the accent (dark and saturated: a plain Button's text keeps the app's light
// colour, so nothing light ever goes behind one) and says so in its words too, "▸ "; a selected item says "✓ " instead.
// `h`: a hit row of the session list's click layer, `h` whole text cells tall (a Client on the desktop drops a fraction)
// and nothing visible: one invisible cover Button per cell, each posting the item's key, no hover (`head`: an empty row, no
// press). The pane draws the list itself under the Client from the same items and heights, so a hit row never drifts
// from its drawn row. Items with `h` sit with no gap.
// `chat`: a list row's "go to chat" key. A block draws "↗" at the right end of its name line, a CHAT_W-cell Box laid
// over the covers (the element on top takes the click); a hit row's first CHAT_LINES cover lines end in a CHAT_W-cell
// Button posting it, where the pane draws its ↗ (register.tsx, the same CHAT_W from the list's right edge).
export type BtnItem = { key: string; label: string; primary?: boolean; selected?: boolean; desc?: string; h?: number; head?: boolean; chat?: string }
// `tint`: /agentville calibrar clics paints the Client's region (a background, no border: a border adds cells).
export type BtnsProps = { items: BtnItem[]; dir: 'row' | 'column'; colors: { ink: string; dim: string; accent: string; glow: string }; tint?: string }

// Wider than any block (two cells each): the cover's label, clipped to the block (its own Box never shrinks, so the
// label is never cut to "...").
const COVER = '\u3164'.repeat(60)
/** The ↗'s width in text cells, the same on the drawn row and its hit row. */
export const CHAT_W = 3
/** The hit row's cover lines that end in the ↗'s Button: the drawn row is centred in its cells, so its name line straddles
 * the first two. */
export const CHAT_LINES = 2
const CHAT_LABEL = '\u00a0↗\u00a0' // CHAT_W cells, the arrow in the middle

/** The elements Btns draws for these props: the pane counts a Client's tree toward its element limit. */
export const btnsElements = (p: BtnsProps) => 1 + p.items.reduce((n, it) => n + (it.h !== undefined ? (it.head ? 1 : 1 + (it.chat ? 3 * it.h + 2 * Math.min(CHAT_LINES, it.h) : 2 * it.h)) : it.desc !== undefined ? (it.chat ? 13 : 8) : it.primary ? 2 : 1), 0)

const Btns: ClientModule<BtnsProps> = (p, s) => {
  const { Box, Text, Button } = s.elements
  const c = p.colors, press = (key: string) => () => s.post({ press: key })
  const words = (it: BtnItem) => (it.selected ? `✓ ${it.label}` : it.primary ? `▸ ${it.label}` : it.label)
  // A hit row: its height in cells (`cells`, never `h`, the JSX factory), a cover Button per cell stacked in flow, so
  // the row is that many text rows tall from its own content even where the desktop ignores a Box's `height`.
  // A row with a chat key: every cover line spans the row (the map's band recipe, mod-clicks 3: a clipped Box per Button),
  // the first CHAT_LINES ending in the ↗'s CHAT_W cells.
  const hitRow = (it: BtnItem, cells: number) => (it.head ? <Box key={`i-${it.key}`} height={cells} flexShrink={0} /> : (
    <Box key={`i-${it.key}`} height={cells} flexShrink={0} flexDirection="column" alignItems={it.chat ? 'stretch' : 'flex-start'} overflow="hidden">
      {Array.from({ length: cells }, (_, r) => (r ? `${it.key}~${r + 1}` : it.key)).map((k, r) => (it.chat ? (
        <Box flexShrink={0} flexDirection="row">
          {/* One row tall and clipped: without a height the filler wraps and the line grows, pushing the cover lines out (batch AI, live). */}
          <Box width={0} flexGrow={1} height={1} flexShrink={0} flexDirection="row" overflow="hidden"><Button key={k} plain onPress={press(it.key)}>{COVER}</Button></Box>
          {r < CHAT_LINES && <Box width={CHAT_W} height={1} flexShrink={0} flexDirection="row" overflow="hidden"><Button key={r ? `${it.chat}~${r + 1}` : it.chat} plain onPress={press(it.chat)}>{COVER}</Button></Box>}
        </Box>
      ) : (
        <Box height={1} flexShrink={0} flexDirection="row" overflow="hidden">
          <Button key={k} plain onPress={press(it.key)}>{COVER}</Button>
        </Box>
      )))}
    </Box>
  ))
  return (
    <Box flexDirection={p.dir} gap={p.items.some(it => it.h !== undefined) ? 0 : 1} flexWrap={p.dir === 'row' ? 'wrap' : 'nowrap'} alignItems={p.dir === 'row' ? 'center' : 'stretch'} backgroundColor={p.tint}>
      {p.items.map(it => (it.h !== undefined ? hitRow(it, it.h) : it.desc !== undefined ? (
        <Box position="relative" flexDirection="column">
          {it.chat ? (
            <Box flexDirection="row">
              <Box width={0} flexGrow={1} overflow="hidden"><Text color={c.ink} weight="bold" wrap="truncate-end">{words(it)}</Text></Box>
              <Box width={CHAT_W} flexShrink={0} />
            </Box>
          ) : <Text color={c.ink} weight="bold" wrap="truncate-end">{words(it)}</Text>}
          <Text color={c.dim} size="footnote" wrap="truncate-end">{it.desc}</Text>
          <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="column" alignItems="flex-start" overflow="hidden">
            {[it.key, `${it.key}~2`].map(k => (
              <Box flexShrink={0} flexDirection="row">
                <Button key={k} plain hover={{ scope: `b-${it.key}`.slice(0, 64), backgroundColor: c.glow }} onPress={press(it.key)}>{COVER}</Button>
              </Box>
            ))}
          </Box>
          {it.chat && (
            <Box position="absolute" top={0} right={0} width={CHAT_W} height={1} flexDirection="row" overflow="hidden">
              {/* the label fills the CHAT_W cells (no-break spaces round the arrow), so the whole slot opens the chat */}
              <Button key={it.chat} plain hover={{ scope: `b-${it.key}`.slice(0, 64), backgroundColor: c.glow }} onPress={press(it.chat)}>{CHAT_LABEL}</Button>
            </Box>
          )}
        </Box>
      ) : it.primary ? (
        <Box backgroundColor={c.accent} paddingX={1}>
          <Button key={it.key} plain variant="primary" onPress={press(it.key)}>{words(it)}</Button>
        </Box>
      ) : <Button key={it.key} onPress={press(it.key)}>{words(it)}</Button>))}
    </Box>
  )
}
export default Btns
