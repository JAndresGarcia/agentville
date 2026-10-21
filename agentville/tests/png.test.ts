import { expect, test } from 'claude-code/testing'

import { adler32, crc32, deflate, spritePng } from '../hooks/png'
import { SPRITE_ROWS, body, rowsToPaths, vectorPeople } from '../hooks/scene'

// A minimal inflate (RFC 1951) for the two block kinds a PNG of ours could hold: stored and fixed Huffman.
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
function inflate(src: number[]): number[] {
  let pos = 0
  const bit = () => (src[pos >> 3]! >> (pos++ & 7)) & 1
  const bits = (k: number) => { let v = 0; for (let i = 0; i < k; i++) v |= bit() << i; return v }
  const code = (k: number, v = 0) => { for (let i = 0; i < k; i++) v = (v << 1) | bit(); return v }
  const out: number[] = []
  for (let last = 0; !last;) {
    last = bits(1)
    const type = bits(2)
    if (type === 0) {
      pos = (pos + 7) & ~7
      const len = bits(16), nlen = bits(16)
      expect((len ^ 0xffff) === nlen).toBe(true)
      for (let i = 0; i < len; i++) out.push(bits(8))
      continue
    }
    expect(type).toBe(1)
    for (;;) {
      let c = code(7), sym: number
      if (c <= 23) sym = 256 + c
      else if ((c = code(1, c)) <= 0xbf) sym = c - 0x30
      else if (c <= 0xc7) sym = 280 + c - 0xc0
      else sym = 144 + code(1, c) - 0x190
      if (sym < 256) { out.push(sym); continue }
      if (sym === 256) break
      const l = sym - 257, len = LBASE[l]! + bits(LEXT[l]!), d = code(5), dist = DBASE[d]! + bits(DEXT[d]!)
      for (let i = 0; i < len; i++) out.push(out[out.length - dist]!)
    }
  }
  return out
}
const u32 = (b: number[], i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0
const hex = (c: number[]) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')

test('crc32 and adler32 match their published check values', () => {
  const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0))
  expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  expect(crc32(bytes('IEND'))).toBe(0xae426082)
  expect(adler32(bytes('Wikipedia'))).toBe(0x11e60398)
})

test('deflate round-trips: runs, repeats past 258, all byte values', () => {
  for (const data of [[], [7], Array(1000).fill(0), Array.from({ length: 600 }, (_, i) => (i * 37) % 256), Array.from({ length: 900 }, (_, i) => (i % 21 < 3 ? 0 : i % 7))]) expect(inflate(deflate(data))).toEqual(data)
})

test('a sprite PNG: signature, IHDR/PLTE/tRNS/IDAT/IEND with good CRCs, zlib Adler-32, and the exact pixels back', () => {
  const col = Object.fromEntries([...new Set(SPRITE_ROWS.join(''))].filter((c) => c !== '.').map((c, i) => [c, `#${(i * 0x0b1d07 + 0x102030).toString(16).slice(-6).padStart(6, '0')}`]))
  col.e = col.o! // two letters, one colour: one palette entry
  for (const rows of [SPRITE_ROWS.slice(0, 44), SPRITE_ROWS.slice(30, 60), SPRITE_ROWS]) {
    const uri = spritePng(rows, col)
    expect(uri.startsWith('data:image/png;base64,')).toBe(true)
    const b = [...atob(uri.slice(22))].map((c) => c.charCodeAt(0))
    expect(b.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const chunks: Record<string, number[]> = {}, order: string[] = []
    for (let i = 8; i < b.length;) {
      const len = u32(b, i), type = String.fromCharCode(...b.slice(i + 4, i + 8)), body = b.slice(i + 8, i + 8 + len)
      expect([type, u32(b, i + 8 + len)]).toEqual([type, crc32(b.slice(i + 4, i + 8 + len))])
      chunks[type] = body; order.push(type); i += 12 + len
    }
    expect(order).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])
    const ihdr = chunks.IHDR!
    expect([u32(ihdr, 0), u32(ihdr, 4), ...ihdr.slice(8)]).toEqual([20, rows.length, 8, 3, 0, 0, 0])
    const pal = chunks.PLTE!, alpha = chunks.tRNS!
    expect(alpha).toEqual([0]) // index 0 clear, every other opaque
    const z = chunks.IDAT!
    expect([z[0], z[1], ((z[0]! << 8) | z[1]!) % 31]).toEqual([0x78, 0x01, 0])
    const raw = inflate(z.slice(2, -4))
    expect(u32(z, z.length - 4)).toBe(adler32(raw))
    expect(raw.length).toBe(rows.length * 21)
    const colours = new Set(rows.join('').replace(/\./g, '').split('').map((c) => col[c]))
    expect(pal.length).toBe(3 * (colours.size + 1))
    rows.forEach((row, y) => {
      expect(raw[y * 21]).toBe(0) // filter: none
      ;[...row].forEach((ch, x) => {
        const i = raw[y * 21 + 1 + x]!
        expect([y, x, ch === '.' ? i === 0 : hex(pal.slice(i * 3, i * 3 + 3))]).toEqual([y, x, ch === '.' ? true : col[ch]])
      })
    })
  }
})

test('spritePng refuses rows of unequal length and more than 256 colours', () => {
  expect(() => spritePng(['..', '...'], {})).toThrow()
  const many = Array.from({ length: 300 }, (_, i) => String.fromCharCode(0x100 + i))
  expect(() => spritePng([many.join('')], Object.fromEntries(many.map((c, i) => [c, `#${i.toString(16).padStart(6, '0')}`])))).toThrow()
})

test('a body is one picture the size its rows draw (scaled and mirrored as the paths were), the paths under the switch', () => {
  const col = { o: '#1d2433', h: '#3b2a1e', H: '#2a1e15', s: '#f1c9a5', S: '#cba98b', e: '#1d2433', m: '#a4896f', c: '#2f3a52', C: '#222a3b', t: '#f4f4f0', b: '#3b82c4', k: '#f1c9a5', p: '#262d3d', P: '#1b202c', f: '#4a3324', F: '#35251a', w: '#2a1d14' }
  const rows = SPRITE_ROWS.slice(0, 44)
  expect(body([rows], -44, col).replace(/href="[^"]+"/, '')).toBe('<image x="-10" y="-44" width="20" height="44" />')
  expect(body([rows], -44, col, 1).replace(/href="[^"]+"/, '')).toBe('<image x="-12.5" y="-55" width="25" height="55" />')
  expect(body([rows], -35, col, -1).replace(/href="[^"]+"/, '')).toBe('<image transform="scale(-1 1)" x="-12.5" y="-43.75" width="25" height="55" />')
  expect(body([rows], -44, col)).toBe(body([rows.slice(0, 30), rows.slice(30)], -44, { ...col })) // the same sprite: the same picture (cached)
  vectorPeople(true)
  try {
    expect(body([rows], -44, col, -1)).toMatch(/^<g transform="scale\(-1.25 1.25\)"><path fill=/)
    expect(body([rows], -44, col)).not.toContain('<image')
    expect(body([rows.slice(0, 30), rows.slice(30)], -44, col)).toBe(rowsToPaths(rows.slice(0, 30), -44, col) + rowsToPaths(rows.slice(30), -14, col)) // a set of paths per part, as before
  } finally { vectorPeople(false) }
})
