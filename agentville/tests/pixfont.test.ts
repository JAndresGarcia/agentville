import { expect, test } from 'claude-code/testing'

import { NO_LIGATURES, PIXELIFY_WOFF2, PLEX_WOFF2, fontFaceCss } from '../hooks/pixfont'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
// The first 4 bytes from the first 8 base64 chars, without atob/Buffer (the plugin lib has neither).
const magic = (s: string) => {
  const n = [...s.slice(0, 8)].reduce((acc, c) => acc * 64 + B64.indexOf(c), 0)
  return String.fromCharCode(...[40, 32, 24, 16].map(sh => Math.floor(n / 2 ** sh) % 256))
}

test('each embedded font is valid base64 of a woff2 file', () => {
  for (const [name, s] of Object.entries({ PIXELIFY_WOFF2, PLEX_WOFF2 })) {
    expect([name, /^[A-Za-z0-9+/]+={0,2}$/.test(s), s.length % 4]).toEqual([name, true, 0])
    expect([name, magic(s)]).toEqual([name, 'wOF2'])
  }
})

// FNV-1a (32 bit) of each string as it was on one line before 1.1.2 wrote it in chunks: the chunks join to the same text.
const fnv = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5).toString(16).padStart(8, '0')
test('the embedded fonts, written in chunks, join to the exact strings they were on one line', () => {
  expect([PIXELIFY_WOFF2.length, fnv(PIXELIFY_WOFF2), PLEX_WOFF2.length, fnv(PLEX_WOFF2)]).toEqual([16012, 'd32a687a', 53656, 'e0a40714'])
})

test('fontFaceCss: one rule per family, with the weights asked for', () => {
  const count = (css: string) => css.split('@font-face').length - 1
  const one = fontFaceCss(['pix400'])
  expect([count(one), one.includes('"Pixelify Sans"'), one.includes('font-weight:400;'), one.includes(PIXELIFY_WOFF2)]).toEqual([1, true, true, true])
  expect(fontFaceCss(['pix700', 'pix600']).includes('font-weight:600 700;')).toBe(true)
  const both = fontFaceCss(['pix400', 'pix700', 'plex'])
  expect([count(both), both.includes('font-weight:400 700;'), both.includes('"IBM Plex Sans"'), both.includes(PLEX_WOFF2)]).toEqual([2, true, true, true])
  expect(fontFaceCss([])).toBe('')
})

// Pixelify's "fi" ligature points at the wrong glyph: "first" drew as "Arst" in the tour.
test('fontFaceCss turns ligatures off wherever Pixelify is embedded, past a later font shorthand', () => {
  for (const css of [fontFaceCss(['pix400']), fontFaceCss(['pix700', 'plex'])]) {
    expect(css.includes('*{font-variant-ligatures:none!important;font-feature-settings:"liga" 0,"clig" 0!important;}')).toBe(true)
  }
  expect(fontFaceCss(['plex']).includes('ligatures')).toBe(false)
  expect(NO_LIGATURES).toBe('font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0')
})
