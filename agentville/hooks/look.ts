// The pane's colours. The mod paints its own surfaces (box backgrounds, borders, its text, bubbles); the app's
// buttons and text fields keep the app's style whatever the palette.
import { t } from './i18n'
import type { Key } from './i18n'

export type Palette = { name: string; bg: string; raise: string; card: string; sel: string; line: string; ink: string; dim: string; wait: string; bad: string; ok: string }
/** State colours, the same on every palette (all dark). */
export const STATE_COLORS: Record<string, string> = { esperando: '#e6973c', trabajando: '#6aa8f2', leyendo: '#b9c6d8', error: '#ef6b5b', terminado: '#7fcf98', inactivo: '#9c9a95' }
// A palette's name is read in the language set at the time (see i18n.ts); the object stays the same one.
const named = (key: Key, p: Omit<Palette, 'name'>): Palette => Object.defineProperty(p, 'name', { get: () => t(key), enumerable: true }) as Palette
export const PALETTES: Record<string, Palette> = {
  lobby: named('palette.lobby', { bg: '#2a211b', raise: '#352a21', card: '#30261e', sel: '#403226', line: '#554333', ink: '#f6eee5', dim: '#c4b09c', wait: '#e6973c', bad: '#ef6b5b', ok: '#7fcf98' }),
  noche: named('palette.noche', { bg: '#1f1e1d', raise: '#262524', card: '#232220', sel: '#2e2d2a', line: '#3a3936', ink: '#ecebe8', dim: '#9c9a95', wait: '#e6973c', bad: '#ef6b5b', ok: '#6cc28f' }),
  hotel: named('palette.hotel', { bg: '#1b2a3c', raise: '#223650', card: '#1f3047', sel: '#2a4363', line: '#36506e', ink: '#eef4fb', dim: '#a7bad0', wait: '#f0a63a', bad: '#ff7a6b', ok: '#7fd6a6' }),
}
// No light palette: a plain Button's text takes the app's colour (light on the dark app), unreadable on a light fill.
export const PALETTE_KEY = 'palette'
export const DEFAULT_PALETTE = 'lobby'
export const paletteOf = (key: unknown): Palette => PALETTES[typeof key === 'string' ? key : DEFAULT_PALETTE] ?? PALETTES[DEFAULT_PALETTE]!
/** A colour mixed toward white by `f` (0 = itself, 1 = white): a bubble's fill from its speaker's shirt. */
export function tint(hex: string, f: number): string {
  const v = parseInt(hex.slice(1), 16)
  return '#' + [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.round(c + (255 - c) * f).toString(16).padStart(2, '0')).join('')
}

/** Plan task icons, as Claude's plan card draws them: a check in a circle (done), a dash in a circle (in progress), a
 * dotted circle (pending). */
export const planIcon = (state: 'done' | 'doing' | 'todo', ink: string, dim: string, ok: string) => {
  const c = state === 'done' ? ok : state === 'doing' ? ink : dim
  const inner = state === 'done' ? `<path d="M5 8.2l2 2 4-4.2" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : state === 'doing' ? `<path d="M5 8h6" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6.5" fill="none" stroke="${c}" stroke-width="1.5"${state === 'todo' ? ' stroke-dasharray="2.2 2.4"' : ''}/>${inner}</svg>`
}
/** A thin progress bar, `done` of `total`, drawn wider than any pane so it scales down to the card's full width. */
export const progressBar = (done: number, total: number, track: string, fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 8" width="2000" height="8"><rect width="2000" height="8" rx="4" fill="${track}"/><rect width="${Math.round((2000 * done) / Math.max(1, total))}" height="8" rx="4" fill="${fill}"/></svg>`
