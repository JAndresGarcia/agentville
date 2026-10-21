import { expect, test } from 'claude-code/testing'

import { W, blocksOf, cellsOf, foldBlocks } from '../hooks/rich'
import type { Block, Run } from '../hooks/rich'

// A reply shaped as a real one (made-up rows), as the person saw it drawn with pipes and dashes.
const REPLY = `**Resumen:** F-1, F0 y F1 están construidos y mergeados.

| Fase | Hecho | En progreso | Por hacer |
|---|---|---|---|
| F-1 Fundaciones | 130 | 0 | 0 |
| F0 Primera entrega | 44 | 42 | 14 (+1 bloqueada) |
| F1 Edición y vista en vivo | 65 | 41 | 9 |
| F2 Optimización | 41 | 21 | 15 |
| F3 Más allá | 6 | 7 | 13 |

• **Lo que sigue "en progreso"** no es código pendiente.`

const plain = (cells: Run[][]) => cells.map(rs => rs.map(r => r.t).join(''))
const tableOf = (text: string) => blocksOf(text).find(b => b.kind === 'table') as Extract<Block, { kind: 'table' }>

test('the real reply reads as paragraph, table, paragraph', () => {
  const blocks = blocksOf(REPLY)
  expect(blocks.map(b => b.kind)).toEqual(['p', 'table', 'p'])
  const tb = tableOf(REPLY)
  expect(plain(tb.head)).toEqual(['Fase', 'Hecho', 'En progreso', 'Por hacer'])
  expect(plain(tb.rows[0]!)).toEqual(['F-1 Fundaciones', '130', '0', '0'])
  expect(plain(tb.rows[1]!)).toEqual(['F0 Primera entrega', '44', '42', '14 (+1 bloqueada)'])
  expect(tb.rows).toHaveLength(5)
  expect(tb.align).toEqual([undefined, undefined, undefined, undefined])
  // no pipe or separator text leaks into the cells
  const all = [tb.head, ...tb.rows].flatMap(plain).join(' ')
  expect([all.includes('|'), all.includes('---')]).toEqual([false, false])
  // len is the table's source length, lines and newlines
  const src = REPLY.split('\n').slice(2, 9).join('\n')
  expect(tb.len).toBe(src.length)
})

test('the table ends at a blank line or at the first line with no pipe', () => {
  expect(blocksOf('a | b\n--|--\n1 | 2\nfin').map(b => b.kind)).toEqual(['table', 'p'])
  expect(tableOf('a | b\n--|--\n1 | 2\n\n3 | 4').rows).toHaveLength(1)
  // a pipe line without a separator after it stays a paragraph; so does a header followed by a bare rule
  expect(blocksOf('a | b\nc').map(b => b.kind)).toEqual(['p'])
  expect(blocksOf('a | b\n---').map(b => b.kind)).toEqual(['p'])
})

test('alignment, missing outer pipes, short rows padded and extra cells dropped', () => {
  const tb = tableOf('x | y | z\n:--- | :---: | ---:\n1\n1 | 2 | 3 | 4')
  expect(tb.align).toEqual(['l', 'c', 'r'])
  expect(plain(tb.head)).toEqual(['x', 'y', 'z'])
  // '1' alone has no pipe, so it ends the table; the padded row comes from the next case
  expect(tb.rows).toHaveLength(0)
  const t2 = tableOf('x | y | z\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |')
  expect(t2.rows.map(plain)).toEqual([['1', '', ''], ['1', '2', '3']])
  expect(t2.rows[0]![1]).toEqual([])
})

test('cells keep inline runs; a pipe inside code or escaped does not split', () => {
  const tb = tableOf('| cmd | note |\n|---|---|\n| `a|b` | **ok** y \\| literal |')
  expect(tb.rows[0]).toEqual([
    [{ t: 'a|b', code: true }],
    [{ t: 'ok', bold: true }, { t: ' y | literal' }],
  ])
  expect(cellsOf('| `a|b` | c |')).toEqual(['`a|b`', 'c'])
  expect(cellsOf('a\\|b | c')).toEqual(['a|b', 'c'])
  // a lone backtick is not a code span, so the pipe still splits
  expect(cellsOf('it`s | b')).toEqual(['it`s', 'b'])
  expect(cellsOf('``x|`y`` | z')).toEqual(['``x|`y``', 'z'])
  // trailing empty cell before the outer pipe is kept
  expect(cellsOf('| a | |')).toEqual(['a', ''])
})

test('paragraphs, lists and code around a table read as before', () => {
  expect(blocksOf('- uno\n\n| a |\n|---|\n| 1 |\n```\nx | y\n---|---\n```').map(b => b.kind)).toEqual(['li', 'table', 'code'])
})

test('foldBlocks keeps whole blocks up to the limit; a first block over it shows its first part', () => {
  const para = 'p'.repeat(400)
  const rows = Array.from({ length: 20 }, (_, k) => `| fila ${k} | ${'v'.repeat(8)} |`).join('\n')
  const blocks = blocksOf(`${para}\n\n| a | b |\n|---|---|\n${rows}`)
  expect(blocks.map(b => b.kind)).toEqual(['p', 'table'])
  const folded = foldBlocks(blocks, 600)
  expect([folded.shown.map(b => b.kind), folded.cut]).toEqual([['p'], true])
  expect(foldBlocks(blocks, 10_000)).toEqual({ shown: blocks, cut: false })

  // one long table alone shows its rows up to the limit, and says it was cut
  const big = blocksOf(`| a | b |\n|---|---|\n${Array.from({ length: 40 }, (_, k) => `| fila ${k} | ${'v'.repeat(10)} |`).join('\n')}`)
  expect((big[0] as Extract<Block, { kind: 'table' }>).len > 900).toBe(true)
  const part = foldBlocks(big, 600)
  const kept = (part.shown[0] as Extract<Block, { kind: 'table' }>).rows
  expect([part.cut, kept.length > 3 && kept.length < 40, kept[0]![0]![0]!.t]).toEqual([true, true, 'fila 0'])
  // a long paragraph alone: its first part, ending in "…"
  const long = foldBlocks(blocksOf(`**${'b'.repeat(300)}** ${'w'.repeat(500)} \`code\``), 600)
  const runs = (long.shown[0] as Extract<Block, { kind: 'p' | 'h' }>).runs
  expect([long.cut, runs.length, runs[0]!.bold, runs.reduce((n, r) => n + r.t.length, 0) <= 601, runs.at(-1)!.t.endsWith('…')]).toEqual([true, 2, true, true, true])

  // exactly at the limit is kept; the first over it stops the fold
  const three = blocksOf('aaaa\n\nbbbb\n\ncccc')
  expect(foldBlocks(three, 2 * (4 + W))).toEqual({ shown: three.slice(0, 2), cut: true }) // each block: its text and W
  expect(foldBlocks([], 600)).toEqual({ shown: [], cut: false })
})

test('foldBlocks weighs elements, not only characters: 2,000 code spans fold to a few dozen; a list item that fits is not cut', () => {
  const spans = foldBlocks(blocksOf('`a`'.repeat(2000)), 600)
  const runs = (spans.shown[0] as Extract<Block, { kind: 'p' | 'h' }>).runs
  expect([spans.cut, runs.length <= 600 / (1 + W) + 1]).toEqual([true, true])
  // a long styled run is cut to what fits after its element
  const bold = foldBlocks(blocksOf(`**${'b'.repeat(900)}**`), 600)
  const b0 = (bold.shown[0] as Extract<Block, { kind: 'p' | 'h' }>).runs[0]!
  expect([bold.cut, b0.bold, b0.t.length <= 600 - 2 * W + 1, b0.t.endsWith('…')]).toEqual([true, true, true, true])
  // a list item weighs its mark too, the same in the fold and in the part it shows: at the limit it shows whole and
  // nothing is cut; one character over, it is cut, and says so
  const at = blocksOf(`- ${'i'.repeat(600 - W - 2)}`), over = blocksOf(`- ${'i'.repeat(600 - W - 1)}`)
  expect(foldBlocks(at, 600)).toEqual({ shown: at, cut: false })
  const o = foldBlocks(over, 600)
  expect([o.cut, (o.shown[0] as Extract<Block, { kind: 'li' }>).runs[0]!.t.endsWith('…')]).toEqual([true, true])
  // a code block that fits its room once its element is paid is not cut either
  const code = blocksOf('```\n' + 'c'.repeat(600 - W) + '\n```')
  expect(foldBlocks(code, 600)).toEqual({ shown: code, cut: false })
})

test('foldBlocks cuts a heavy table header cell by cell and leaves out a body row too heavy to fit, whole', () => {
  const head = foldBlocks(blocksOf(`| ${'`a` '.repeat(2000)}| b |\n|---|---|\n| 1 | 2 |`), 6000)
  const t0 = head.shown[0] as Extract<Block, { kind: 'table' }>
  const spans = t0.head[0]!.filter(r => r.code).length // each an element; the spaces between are plain text
  expect([head.cut, spans <= 30, spans > 5]).toEqual([true, true, true])
  const body = foldBlocks(blocksOf(`| a | b |\n|---|---|\n| ${'`x` '.repeat(2000)}| 2 |\n| 3 | 4 |`), 600)
  const t1 = body.shown[0] as Extract<Block, { kind: 'table' }>
  expect([body.cut, t1.rows.length, t1.hidden]).toEqual([true, 0, 2]) // the huge row is not drawn: nothing to cut in it
})

test('foldBlocks never cuts silently: a styled run that cannot pay its element at the boundary leaves a bare "…"', () => {
  const f = foldBlocks(blocksOf(`${'x'.repeat(570)}\`c\``), 600)
  const runs = (f.shown[0] as Extract<Block, { kind: 'p' | 'h' }>).runs
  expect([f.cut, runs.length, runs[0]!.t.length, runs[1]]).toEqual([true, 2, 570, { t: '…' }])
})
