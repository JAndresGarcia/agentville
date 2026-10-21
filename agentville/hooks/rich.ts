// Claude's replies drawn by the pane itself: the app's Markdown element offers no style, and the chat shows inline
// code in red. A small reader for what replies use: paragraphs, headings, lists, fenced code, tables, `code`, **bold**, links.

export type Run = { t: string; code?: true; bold?: true; href?: string }
export type Block =
  | { kind: 'p' | 'h'; runs: Run[] }
  | { kind: 'li'; mark: string; runs: Run[] }
  | { kind: 'code'; text: string; lang: string }
  | { kind: 'table'; head: Run[][]; rows: Run[][][]; align: Align[]; len: number; hidden?: number } // len: source chars; hidden: rows a fold left out
export type Align = 'l' | 'c' | 'r' | undefined

/** The host a link opens, as the browser parses it (`https:///x` and `https://\x` open x); a regex that skips any slashes
 * and backslashes after the scheme and a user part before `@` when URL cannot parse it; '' when there is none. */
export function linkHost(href: string): string {
  try { return new URL(href).host.toLowerCase() } catch { return (/^https?:[/\\]*([^/\\?#]*)/i.exec(href)?.[1] ?? '').split('@').pop()!.toLowerCase() }
}
const bare = (h: string) => h.toLowerCase().replace(/^www\./, '')
/** Splits one line into runs: `code`, **bold** and [label](url); anything else is plain text. A link whose label is not
 * its host (`www.` aside) or its url gets the host beside it as plain text, so `[github.com](https://evil.dev)` shows
 * where it goes; so does a url with a user part (`https://github.com@evil.dev`). With no host to name it is no link. */
export function runsOf(line: string): Run[] {
  const out: Run[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let at = 0
  for (const m of line.matchAll(re)) {
    if (m.index! > at) out.push({ t: line.slice(at, m.index) })
    if (m[1] !== undefined) out.push({ t: m[1], code: true })
    else if (m[2] !== undefined) out.push({ t: m[2], bold: true })
    else {
      const label = m[3]!, href = m[4]!, host = linkHost(href)
      if (!host) out.push({ t: m[0] })
      else {
        out.push({ t: label, href })
        if (bare(label) !== bare(host) && (label !== href || /^https?:[/\\]*[^/\\?#]*@/i.test(href))) out.push({ t: ` (${host})` })
      }
    }
    at = m.index! + m[0].length
  }
  if (at < line.length) out.push({ t: line.slice(at) })
  return out
}

/** Splits a table line on `|`, except inside a code span or as `\|`; outer pipes are optional. */
export function cellsOf(line: string): string[] {
  const s = line.trim(), out: string[] = []
  let cell = '', tick = 0 // tick: length of the open code span's backtick run, 0 outside code
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '\\' && s[i + 1] === '|') { cell += '|'; i++; continue }
    if (c === '`') {
      let n = 1
      while (s[i + n] === '`') n++
      const run = '`'.repeat(n)
      // a run opens code only when the same run closes it later, as in Markdown
      if (!tick && new RegExp(`(^|[^\`])${run}([^\`]|$)`).test(s.slice(i + n))) tick = n
      else if (tick === n) tick = 0
      cell += run; i += n - 1; continue
    }
    if (c === '|' && !tick) { out.push(cell); cell = ''; continue }
    cell += c
  }
  out.push(cell)
  if (s.startsWith('|')) out.shift()
  if (out.length > 1 && /(^|[^\\])\|$/.test(s) && !out[out.length - 1]!.trim()) out.pop()
  return out.map(c => c.trim())
}

const isSep = (line: string | undefined) => !!line && line.includes('|') && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line)
const alignOf = (c: string): Align => c.startsWith(':') ? (c.endsWith(':') ? 'c' : 'l') : c.endsWith(':') ? 'r' : undefined

/** Reads a reply into blocks; lines of one paragraph join with a space, as Markdown does. */
export function blocksOf(text: string): Block[] {
  const out: Block[] = []
  const lines = text.split('\n')
  let para: string[] = []
  const flush = () => { if (para.length) out.push({ kind: 'p', runs: runsOf(para.join(' ')) }); para = [] }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = /^\s*```(\w*)/.exec(line)
    if (fence) {
      flush()
      const body: string[] = []
      while (++i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i]!)
      out.push({ kind: 'code', text: body.join('\n'), lang: fence[1] || 'text' })
      continue
    }
    if (line.includes('|') && isSep(lines[i + 1])) {
      flush()
      const head = cellsOf(line), n = head.length, fit = (cs: string[]) => Array.from({ length: n }, (_, k) => runsOf(cs[k] ?? ''))
      const seps = cellsOf(lines[i + 1]!), align = Array.from({ length: n }, (_, k) => alignOf(seps[k] ?? ''))
      let len = line.length + lines[i + 1]!.length + 1
      const rows: Run[][][] = []
      for (i += 2; i < lines.length && lines[i]!.trim() && lines[i]!.includes('|'); i++) { rows.push(fit(cellsOf(lines[i]!))); len += lines[i]!.length + 1 }
      i--
      out.push({ kind: 'table', head: fit(head), rows, align, len })
      continue
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line), li = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line)
    if (h) { flush(); out.push({ kind: 'h', runs: runsOf(h[1]!) }) }
    else if (li) { flush(); out.push({ kind: 'li', mark: /\d/.test(li[1]!) ? li[1]! : '•', runs: runsOf(li[2]!) }) }
    else if (!line.trim()) flush()
    else para.push(line.trim())
  }
  flush()
  return out
}

// The fold's budget counts what the desktop pays for: characters, plus W for every element a block draws (each block,
// each styled run, each table row, two per cell). A reply of two thousand `code` spans is a few characters each but an
// element each; the pane freezes past ~1,870 elements, not at any length of text.
// shortcut: W is one weight for every kind of element; tune it if live shows folds too eager or too lax.
export const W = 20
// A table header's most weight in a folded part: a header of thousands of styled runs is cut to a few dozen elements.
const HEAD_MAX = 30 * W
const CELL_BASE = 3 + W / 2, ROW_BASE = 1 + W // see cellCost and rowLen
const runCost = (r: Run) => r.t.length + (r.code || r.bold || r.href ? W : 0)
// A table cell: its runs, a pipe and two spaces, and W / 2 for its Box and Text (plain, cheap elements, charged at a
// quarter so a short table after a sentence still shows folded: a folded bubble of empty cells stays near 75 elements);
// a row: its cells and its Box.
const cellCost = (c: Run[]) => c.reduce((n, r) => n + runCost(r), CELL_BASE)
const rowLen = (cells: Run[][]) => cells.reduce((n, c) => n + cellCost(c), ROW_BASE)
const lenOf = (b: Block) => W + (b.kind === 'table' ? rowLen(b.head) + b.rows.reduce((n, r) => n + rowLen(r), 0)
  : b.kind === 'code' ? b.text.length
  : b.runs.reduce((n, r) => n + runCost(r), b.kind === 'li' ? b.mark.length + 1 : 0))

/** What of one block fits `limit` (see lenOf): a table's rows that fit, a paragraph's or list item's runs cut there
 * (with "…"), the first part of code; `cut` when something was left out. */
function partOf(b: Block, limit: number): { block: Block; cut: boolean } {
  if (b.kind === 'table') {
    // The header is always drawn, so a header over its share (at most HEAD_MAX) is cut cell by cell like a paragraph;
    // body rows that do not fit are left out whole (never drawn), so they need no cutting.
    let head = b.head, headCut = false
    if (W + rowLen(head) > Math.min(limit, HEAD_MAX)) {
      let left = Math.min(limit, HEAD_MAX) - W - ROW_BASE
      head = b.head.map(c => { left -= CELL_BASE; const p = cutRuns(c, left); left = p.left; headCut ||= p.cut; return p.runs })
    }
    let total = W + rowLen(head), k = 0
    while (k < b.rows.length && total + rowLen(b.rows[k]!) <= limit) total += rowLen(b.rows[k++]!)
    return { block: { ...b, head, rows: b.rows.slice(0, k), hidden: b.rows.length - k }, cut: headCut || k < b.rows.length }
  }
  if (b.kind === 'code') {
    const room = Math.max(0, limit - W)
    return b.text.length <= room ? { block: b, cut: false } : { block: { ...b, text: `${b.text.slice(0, room)}\n…` }, cut: true }
  }
  const p = cutRuns(b.runs, limit - W - (b.kind === 'li' ? b.mark.length + 1 : 0))
  return { block: { ...b, runs: p.runs }, cut: p.cut }
}
/** The runs that fit `left` (see runCost), the one that crosses it cut with "…"; what is left of the budget. */
function cutRuns(rs: Run[], left: number): { runs: Run[]; cut: boolean; left: number } {
  const runs: Run[] = []
  for (const r of rs) {
    if (runCost(r) <= left) { runs.push(r); left -= runCost(r); continue }
    const room = left - (runCost(r) - r.t.length) // a styled run pays its element first
    runs.push(room > 0 ? { ...r, t: `${r.t.slice(0, room).trimEnd()}…` } : { t: '…' }) // never cut silently
    return { runs, cut: true, left: 0 }
  }
  return { runs, cut: false, left }
}

/** Folds a long reply by whole blocks: keeps them while their weight (see lenOf) stays at or under `limit`. A first
 * block over the limit alone shows its first part (see partOf), so no single block can make the pane too heavy to draw.
 * `cut`: something was left out. */
export function foldBlocks(blocks: Block[], limit: number): { shown: Block[]; cut: boolean } {
  if (blocks[0] && lenOf(blocks[0]) > limit) { const p = partOf(blocks[0], limit); return { shown: [p.block], cut: p.cut || blocks.length > 1 } }
  let total = 0, k = 0
  for (; k < blocks.length; k++) { total += lenOf(blocks[k]!); if (total > limit) break }
  return { shown: blocks.slice(0, k), cut: k < blocks.length }
}
