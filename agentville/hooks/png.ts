// A tiny PNG encoder for the map's pixel-art people: palette colour (type 3, 8 bits), one IDAT whose zlib stream is
// deflate with the fixed Huffman codes and LZ77 matches (stored blocks alone left a person too heavy for the page).

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
export const crc32 = (b: ArrayLike<number>) => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 255]! ^ (c >>> 8); return ~c >>> 0 }
export const adler32 = (b: ArrayLike<number>) => { let a = 1, s = 0; for (let i = 0; i < b.length; i++) { a = (a + b[i]!) % 65521; s = (s + a) % 65521 } return ((s << 16) | a) >>> 0 }

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const slot = (base: number[], v: number) => { let i = base.length - 1; while (base[i]! > v) i--; return i }

/** Raw deflate (RFC 1951): one final block with the fixed codes, its matches picked for the fewest bits (a sprite is
 * under 1 KB, so every earlier byte is tried). */
export function deflate(data: ArrayLike<number>): number[] {
  const n = data.length, cost = new Array<number>(n + 1).fill(0), pick: [number, number][] = new Array(n) // [length, distance]; length 1: a literal
  const litBits = (v: number) => (v < 144 ? 8 : 9)
  const matchBits = (len: number, dist: number) => { const l = slot(LBASE, len), d = slot(DBASE, dist); return (l < 23 ? 7 : 8) + LEXT[l]! + 5 + DEXT[d]! }
  for (let i = n - 1; i >= 0; i--) {
    cost[i] = litBits(data[i]!) + cost[i + 1]!; pick[i] = [1, 0]
    // the nearest earlier start reaching each length is its cheapest distance
    for (let j = i - 1, best = 2; j >= 0 && j >= i - 32768 && best < 258; j--) {
      let k = 0
      while (k < 258 && i + k < n && data[j + k] === data[i + k]) k++
      for (let len = best + 1; len <= k; len++) { const c = matchBits(len, i - j) + cost[i + len]!; if (c < cost[i]!) { cost[i] = c; pick[i] = [len, i - j] } }
      best = Math.max(best, k)
    }
  }
  const out: number[] = []
  let acc = 0, nb = 0
  const bits = (v: number, k: number) => { acc |= v << nb; nb += k; while (nb >= 8) { out.push(acc & 255); acc >>>= 8; nb -= 8 } }
  const code = (c: number, k: number) => { for (let b = k - 1; b >= 0; b--) bits((c >> b) & 1, 1) } // Huffman codes go most significant bit first
  const sym = (v: number) => (v < 144 ? code(0x30 + v, 8) : v < 256 ? code(0x190 + v - 144, 9) : v < 280 ? code(v - 256, 7) : code(0xc0 + v - 280, 8))
  bits(1, 1); bits(1, 2) // BFINAL, BTYPE 01
  for (let i = 0; i < n;) {
    const [len, dist] = pick[i]!
    if (len === 1) { sym(data[i]!); i++; continue }
    const l = slot(LBASE, len), d = slot(DBASE, dist)
    sym(257 + l); bits(len - LBASE[l]!, LEXT[l]!); code(d, 5); bits(dist - DBASE[d]!, DEXT[d]!)
    i += len
  }
  sym(256)
  if (nb) out.push(acc & 255)
  return out
}

const be32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
const chunk = (type: string, body: number[]) => { const t = [...type].map((c) => c.charCodeAt(0)); return [...be32(body.length), ...t, ...body, ...be32(crc32([...t, ...body]))] }

/** A w x h picture of palette indices (row by row) as PNG bytes; `pal` holds [r, g, b, a] per index. */
export function pngBytes(w: number, h: number, idx: ArrayLike<number>, pal: number[][]): number[] {
  const raw: number[] = []
  for (let y = 0; y < h; y++) { raw.push(0); for (let x = 0; x < w; x++) raw.push(idx[y * w + x]!) }
  const alpha = pal.map((c) => c[3]!), last = alpha.reduce((k, a, i) => (a < 255 ? i : k), -1)
  return [137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', [...be32(w), ...be32(h), 8, 3, 0, 0, 0]),
    ...chunk('PLTE', pal.flatMap((c) => c.slice(0, 3))),
    ...(last >= 0 ? chunk('tRNS', alpha.slice(0, last + 1)) : []),
    ...chunk('IDAT', [0x78, 0x01, ...deflate(raw), ...be32(adler32(raw))]),
    ...chunk('IEND', [])]
}

/** Sprite rows (one letter per pixel, '.' clear) in the given colours as a PNG data URI; index 0 is the clear one. */
export function spritePng(rows: string[], col: Record<string, string>): string {
  const keys = ['transparent'], idx: number[] = []
  if (rows.some((r) => r.length !== rows[0]!.length)) throw new Error('spritePng: rows of unequal length')
  for (const row of rows) for (const ch of row) {
    const c = ch === '.' ? 'transparent' : col[ch] ?? '#ff00ff'
    let i = keys.indexOf(c)
    if (i < 0) i = keys.push(c) - 1
    idx.push(i)
  }
  if (keys.length > 256) throw new Error('spritePng: more than 256 colours')
  const pal = keys.map((c) => { if (c === 'transparent') return [0, 0, 0, 0]; const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255] })
  return 'data:image/png;base64,' + btoa(String.fromCharCode(...pngBytes(rows[0]!.length, rows.length, idx, pal)))
}
