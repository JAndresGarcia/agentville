import type { Lang } from './i18n'
import { t } from './i18n'
import { fontFaceCss } from './pixfont'
import type { Face } from './pixfont'
import { TOUR_STEP_IDS } from './scene'
import type { TourRect, TourStep } from './scene'
import { TOUR_LAYOUT } from './tourlayout'

/* ---------- the map tour (style A): dim, spotlight, Gem's bubble or the choice modal, as one Svg ---------- */
// A port of the approved mock (scratchpad tourmock/template.html): its CSS and markup go verbatim into a foreignObject
// the size of the map's viewBox, so 1 CSS px is 1 map unit, and the browser lays it out as the mock does. The Svg has the
// map's size but its own origin (viewBox 0 0 w h, preserveAspectRatio none, like the mock's layer): the map's
// fractional origin (-91.2) moved the foreignObject's text and box edges by a sub-pixel and broke the pixel match. The only
// layout worked out here is what the mock measured with script: the bubble's size (wrapLines over Pixelify's advance
// widths) for place(), and the hit rects, which come from the same numbers (modal controls measured in tourlayout.ts).

export type TourFlow = 'agentville' | 'skill' | 'none'
export type TourPal = 'lobby' | 'noche' | 'hotel'
export const TOUR_PALS: readonly TourPal[] = ['lobby', 'noche', 'hotel']
export const TOUR_FLOWS: readonly TourFlow[] = ['agentville', 'skill', 'none']
export const SKILLS_PER_PAGE = 6
export type TourView = { x: number; y: number; w: number; ht: number }
export type TourOverlayOpts = {
  step: TourStep
  /** Position among the steps shown (1-based) and how many are shown. */
  n: number
  total: number
  lang: Lang
  /** The map's frame, viewOf(rows): the overlay uses it as its viewBox. */
  view: TourView
  /** This step's target as map fractions (spotlight steps). */
  target?: TourRect | null
  /** The focus office's name (the island step). */
  name?: string
  flow?: TourFlow | null
  /** The skill picker under the flow tiles: every name, the page shown, the one picked. */
  skills?: { names: string[]; page: number; picked?: string | null } | null
  everywhere?: boolean
  palette?: TourPal
  /** The despacho step draws the mock's demo banner (only while no real request waits). */
  demoBanner?: boolean
}
/** A click zone as fractions of the map. */
export type TourHit = { key: string; x0: number; y0: number; x1: number; y1: number }

const PIXEL = '"Pixelify Sans", ui-monospace, Menlo, monospace'
const BODY = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif'
// The sample banner is the pane's real one (chrome.ts): the system face, as the pane draws it.
const SF = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
// Control characters go first (XML 1.0 refuses most of them), as chrome.ts does, then the markup ones are escaped.
const esc = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const n1 = (v: number) => String(Math.round(v * 10) / 10)

// The mock's rules, var() replaced by the light-theme literals (the stage is a fixed scene in every theme), each scoped
// under .avt so nothing leaks if the Svg is inlined. `.avt` itself is the mock's body plus .stage.
const CSS = (w: number, ht: number) => `.avt{position:relative;width:${w}px;height:${ht}px;overflow:hidden;font:15px/1.55 ${BODY};color:#1f1e1c}
.avt p{margin:0;max-width:68ch}
.avt .banner{position:absolute;left:12px;right:12px;top:40px;z-index:4;display:flex;gap:8px 12px;align-items:center;background:#3d301f;border:1px solid #e2a94a;border-radius:8px;padding:8px 10px;color:#ece6dc;font:14px/1.5 ${SF}}
.avt .banner .dot{width:8px;height:8px;border-radius:50%;background:#e2a94a;flex:none}
.avt .banner b{font-weight:700;flex:none}
.avt .banner .t{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.avt .banner .btn{flex:none;display:inline-flex;align-items:center;padding:3px 9px;border-radius:5px;border:1px solid #43392e;background:transparent;color:#ece6dc;font:700 13px ${SF};white-space:nowrap}
.avt .bubble{position:absolute;z-index:5;max-width:min(320px, 46%);background:#ffffff;color:#141414;border:2px solid #141414;border-radius:7px;box-shadow:0 3px 0 #00000059;padding:8px 10px 9px 44px;font:400 14px/1.35 ${PIXEL};min-height:44px}
.avt .bubble .face{position:absolute;left:6px;top:6px;width:30px;height:30px;image-rendering:pixelated}
.avt .bubble b{font-weight:700}
.avt .bubble .tail{position:absolute;width:12px;height:12px;background:#ffffff;border:2px solid #141414;border-top:0;border-left:0;transform:rotate(45deg)}
.avt .bubble .nav{display:flex;gap:6px;align-items:center;margin-top:8px}
.avt .pbtn{font:600 13px ${PIXEL};color:#fff;background:#2f6db5;border:2px solid #141414;border-radius:5px;padding:2px 10px 3px;box-shadow:0 2px 0 #00000066}
.avt .pbtn.ghost{color:#141414;background:#e9e6df}
.avt .count{margin-left:auto;font:400 12px ${PIXEL};color:#6b665e}
.avt .cbtn{font:600 13px ${BODY};border-radius:7px;padding:6px 12px;border:1px solid #4a4743;background:#2b2a28;color:#ecebe8}
.avt .cbtn.primary{background:#ecebe8;color:#1b1a18;border-color:#ecebe8}
.avt .modal{position:absolute;z-index:6;left:50%;top:52%;transform:translate(-50%, -50%);width:min(520px, 86%);background:#232220;color:#ecebe8;border:2px solid #141414;border-radius:12px;box-shadow:0 4px 0 #000, 0 30px 60px -20px #000;overflow:hidden}
.avt .modal .hero{background:#2e3a4f;padding:12px 16px;display:flex;gap:12px;align-items:center;border-bottom:2px solid #141414}
.avt .modal .hero .face{width:40px;height:40px;image-rendering:pixelated;flex:none}
.avt .modal .hero .say{background:#fff;color:#141414;border:2px solid #141414;border-radius:7px;padding:6px 10px;font:400 14px/1.35 ${PIXEL};position:relative}
.avt .modal .body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px}
.avt .modal h3{margin:0;font:700 20px/1.2 ${PIXEL}}
.avt .modal p{color:#cfcac1;font-size:14px}
.avt .tiles{display:grid;gap:8px;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr))}
.avt .tile{text-align:left;background:#2b2a28;color:#ecebe8;border:2px solid #4a4743;border-radius:9px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;font:14px/1.35 ${BODY};min-width:0}
.avt .tile b{font:600 14px ${BODY};display:flex;gap:8px;align-items:center}
.avt .tile span{color:#a9a49b;font-size:13px}
.avt .tile .badge{font:700 11px ${PIXEL};background:#ecebe8;color:#1b1a18;border-radius:4px;padding:1px 5px}
.avt .tile[aria-pressed="true"]{border-color:#f2a93b;background:#33291b}
.avt .tile[aria-pressed="true"] b::after{content:"✓";margin-left:auto;color:#f2a93b}
.avt .modal .foot{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #3a3834}
.avt .mdots{display:flex;gap:4px}.avt .mdots i{width:6px;height:6px;border-radius:3px;background:#6b665e;display:block}.avt .mdots i.on{width:16px;background:#ecebe8}
.avt .lnk{font:500 13px ${BODY};color:#a9a49b;background:none;border:0;padding:4px 2px}
.avt .toggle{display:flex;gap:10px;align-items:center;font-size:14px}
.avt .sw{width:38px;height:22px;border-radius:11px;background:#4a4743;position:relative;border:0;flex:none}
.avt .sw::after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:8px;background:#ecebe8}
.avt .sw[aria-pressed="true"]{background:#2f8a55}.avt .sw[aria-pressed="true"]::after{left:19px}
.avt .pals{display:flex;gap:8px;flex-wrap:wrap}
.avt .fine{color:#5f5b54;font-size:13px}
.avt .sk{height:30px;padding:5px 10px}.avt .sk b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:16px}.avt .sk[aria-pressed="true"] b::after{content:none}
@media (prefers-reduced-motion: reduce){.avt-pulse{display:none}}`

// Gem's face (16 x 16), the mock's FACE with each colour's runs merged into one path (same pixels, a tenth the size).
const FACE_PX = ['................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhssssshk...', '..khhsssssssk...', '..khsseessessk..', '..khssssssssk...',
  '...ksssmmsssk...', '...kksssssskk...', '....kkssssk.....', '...kppkkkkppk...', '..kpppppppppk...', '..kpppppppppk...', '..kkkkkkkkkkk...', '................']
const FACE = (() => {
  const c: Record<string, string> = { k: '#141414', h: '#7a3b1e', s: '#f0c6a0', e: '#141414', m: '#c0504d', p: '#c2477a' }
  const d: Record<string, string> = {}
  FACE_PX.forEach((row, y) => { for (let x = 0; x < row.length;) { const ch = row[x]!, f = c[ch]; let e = x + 1; while (e < row.length && c[row[e]!] === f) e++; if (f) d[f] = (d[f] ?? '') + `M${x} ${y}h${e - x}v1h-${e - x}z`; x = e } })
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${Object.entries(d).map(([f, p]) => `<path d="${p}" fill="${f}"/>`).join('')}</svg>`
})()

/* The text model: Pixelify Sans advance widths and kerning (font units, 1000 per em) from tourlayout.ts. */
const PIX = TOUR_LAYOUT.pix
const kernOf = (k: Record<string, string>) => { const m = new Map<string, number>(); for (const [v, pairs] of Object.entries(k)) for (let i = 0; i < pairs.length; i += 2) m.set(pairs.slice(i, i + 2), Number(v)); return m }
const ADV = { 400: new Map([...PIX.chars].map((c, i) => [c, PIX.w400[i]!])), 700: new Map([...PIX.chars].map((c, i) => [c, PIX.w700[i]!])) }
const KERN = { 400: kernOf(PIX.k400), 700: kernOf(PIX.k700) }
const FALLBACK = PIX.w400[PIX.chars.indexOf('n')]!
/** Width in px of `s` in Pixelify at `size` px; the first `bold` characters at weight 700 (a separate run: no kerning across). */
export function pixWidth(s: string, size = 14, bold = 0): number {
  let u = 0
  for (let i = 0; i < s.length; i++) {
    const w = i < bold ? 700 : 400, c = s[i]!
    u += ADV[w].get(c) ?? FALLBACK
    if (i > 0 && (i < bold) === (i - 1 < bold)) u += KERN[w].get(s[i - 1]! + c) ?? 0
  }
  return (u * size) / 1000
}
/** CSS greedy wrapping (white-space: normal): breaks after spaces and after a hyphen inside a word; a piece wider
 * than the line overflows. `bold` leading characters are drawn at 700. Returns the lines without trailing spaces. */
export function wrapLines(text: string, width = 320, bold = 0, size = 14): string[] {
  const pieces: [number, number][] = []
  let from = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!, next = text[i + 1]
    const brk = c === ' ' ? next !== ' ' : c === '-' && i > from && text[i - 1] !== ' ' && next !== undefined && next !== ' ' && !/\d/.test(next)
    if (brk || i === text.length - 1) { pieces.push([from, i + 1]); from = i + 1 }
  }
  const lines: string[] = []
  let start = -1, end = -1
  const fits = (a: number, b: number) => { const s = text.slice(a, b).replace(/ +$/, ''); return pixWidth(s, size, Math.max(0, bold - a)) <= width }
  for (const [a, b] of pieces) {
    if (start < 0) { start = a; end = b; continue }
    if (fits(start, b)) end = b
    else { lines.push(text.slice(start, end).replace(/ +$/, '')); start = a; end = b }
  }
  if (start >= 0) lines.push(text.slice(start, end).replace(/ +$/, ''))
  return lines
}

// The steps the approved mock had, in its order: their copy is what tourlayout.ts was measured with (copyHash), so the
// chat step (not in the mock) stays out of it.
const MOCK_STEPS = TOUR_STEP_IDS.filter((s) => s !== 'chat')
/** The mock's copy for one language, in the shape of its `T` (step 2 says "{name}" filled with `name`). */
export function tourCopy(lang: Lang, name = 'Tienda online') {
  const x = (k: Parameters<typeof t>[0], v?: Record<string, string>) => t(k, v, lang)
  const say = (s: TourStep) => s === 'island' ? x('tour.island.say', { name }) : x(`tour.${s}.say` as 'tour.jefe.say')
  return {
    skip: x('tour.skip'), next: x('tour.next'), back: x('tour.back'), start: x('tour.start'), step: x('tour.dots', { n: '{n}', total: '{t}' }), guide: x('tour.guide'), tour: x('tour.open'),
    s: MOCK_STEPS.map((s) => ({
      title: x(`tour.${s}.title` as 'tour.jefe.title'), say: say(s), ...(s === 'lang' || s === 'flow' ? { body: x(`tour.${s}.body` as 'tour.lang.body') } : {}) })),
    flow: [[x('tour.flow.agentville'), x('tour.flow.agentville.body'), x('tour.flow.agentville.badge')], [x('tour.flow.skill'), x('tour.flow.skill.body')], [x('tour.flow.none'), x('tour.flow.none.body')]],
    langs: [[x('tour.lang.es'), x('tour.lang.es.body'), x('tour.lang.es.badge')], [x('tour.lang.en'), x('tour.lang.en.body'), x('tour.lang.en.badge')]],
    always: x('tour.always'), alwaysOn: x('tour.alwaysOn'), alwaysOff: x('tour.alwaysOff'), color: x('tour.color'), pals: TOUR_PALS.map((p) => x(`tour.pal.${p}`)),
    privacy: x('tour.privacy'), head: x('tour.open'), waits: x('tour.banner.waits'), text: x('tour.banner.text'), ver: x('banner.ver'),
  }
}
/** FNV-1a 32 of a string, hex: the copy hash tourlayout.ts was measured with. */
export const copyHash = (s: string) => { let ht = 0x811c9dc5; for (let i = 0; i < s.length; i++) ht = Math.imul(ht ^ s.charCodeAt(i), 0x01000193) >>> 0; return ht.toString(16).padStart(8, '0') }

/** The mock's place(): the bubble beside the target where there is room, as fractions of the stage. `bw`/`bh` are the
 * bubble's offsetWidth/offsetHeight over the stage's clientWidth/clientHeight, as the mock reads them. `side` names
 * where its tail points: `top` sits under the target, `above` over it (no room under it, as on a 1-row map). `floor`:
 * the highest its top may go (under the demo banner when it shows). Never past the stage's bottom: that cut comes last,
 * so it wins when nothing fits. */
export function place(tg: TourRect, bw: number, bh: number, floor = 0.1) {
  const [x0, y0, x1, y1] = tg, gap = 0.025
  let left: number, side: 'left' | 'right' | 'top' | 'above'
  if (x1 + gap + bw < 0.98) { left = x1 + gap; side = 'left' } else if (x0 - gap - bw > 0.02) { left = x0 - gap - bw; side = 'right' }
  else { left = Math.min(0.98 - bw, Math.max(0.02, (x0 + x1) / 2 - bw / 2)); side = 'top' }
  let top = Math.max(floor, side === 'top' ? y1 + gap : (y0 + y1) / 2 - bh / 2)
  if (side === 'top' && y1 + gap + bh > 0.97 && y0 - gap - bh >= floor) { side = 'above'; top = y0 - gap - bh }
  return { left, top: Math.min(0.97 - bh, top), side }
}

type ModalKind = 'lang' | 'flow' | 'prefs' | 'done'
const MODAL = new Set<TourStep>(['lang', 'flow', 'prefs', 'done'])
const LH = Math.floor(14 * 1.35 * 64) / 64 // the bubble's line height as Chrome lays it out (1/64 px units)

/** The overlay for one step: the Svg (drawn over the map at the map's width), its alt, its click zones and, on a
 * spotlight step, the bubble's rect as fractions of the stage. */
export function tourOverlay(o: TourOverlayOpts): { svg: string; alt: string; hits: TourHit[]; card?: TourRect } {
  const L = tourCopy(o.lang, o.name ?? ''), lay = TOUR_LAYOUT.lang[o.lang]
  const v = { w: Number(n1(o.view.w)), h: Number(n1(o.view.ht)) }
  const st = o.step === 'chat' ? { title: t('tour.chat.title', undefined, o.lang), say: t('tour.chat.say', undefined, o.lang), body: undefined } : L.s[MOCK_STEPS.indexOf(o.step)]!
  const first = o.n <= 1, last = o.n >= o.total
  const hits: TourHit[] = []
  const hit = (key: string, x: number, y: number, w: number, ht: number) => hits.push({ key, x0: x / v.w, y0: y / v.h, x1: (x + w) / v.w, y1: (y + ht) / v.h })
  const faces: Face[] = ['pix400', 'pix700']
  let shapes = '', pop = '', banner = '', card: TourRect | undefined
  // The chat step's target: a sample session row as the pane's list draws it (stripe, the focus office's name, its ↗,
  // a dim second line), at the stage's bottom-left; the spotlight lights it and the bubble goes beside it.
  let row = ''
  const tgOf = (): TourRect | null => {
    if (o.step !== 'chat') return o.target ?? null
    const rw = Math.min(280, v.w * 0.4), rh = 52, rx = 12, ry = v.h - rh - 16
    row = `<div style="position:absolute;left:${rx}px;top:${n1(ry)}px;width:${n1(rw)}px;height:${rh}px;box-sizing:border-box;display:flex;gap:8px;align-items:center;padding:6px 10px 6px 8px;background:#2b2a28;border:1px solid #4a4743;border-radius:8px;font:14px/1.4 ${esc(SF)}">`
      + '<span style="flex:none;width:5px;height:38px;border-radius:2.5px;background:#6aa8f2"></span>'
      + `<span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="display:flex;gap:6px"><b style="flex:1;min-width:0;color:#ecebe8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.name || 'Tienda online')}</b><b style="flex:none;color:#ecebe8">↗</b></span>`
      + `<span style="color:#a9a49b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t('role.jefe', undefined, o.lang))} · ${esc(t('state.trabajando', undefined, o.lang).toLowerCase())}</span></span></div>`
    return [rx / v.w, ry / v.h, (rx + rw) / v.w, (ry + rh) / v.h]
  }

  if (MODAL.has(o.step)) {
    faces.push('pix600', 'plex')
    shapes = `<rect x="0" y="0" width="${v.w}" height="${v.h}" fill="#0b0a09" opacity="0.62"/>`
    const k = o.step as ModalKind
    const nav = (cls: string) => `${first ? '' : `<button class="${cls} ghost" data-k="tour-back">${esc(L.back)}</button>`}<button class="${cls}${cls === 'cbtn' ? ' primary' : ''}" data-k="${last ? 'tour-done' : 'tour-next'}">${esc(last ? L.start : L.next)} ▸</button>`
    const dots = Array.from({ length: o.total }, (_, i) => `<i class="${i === o.n - 1 ? 'on' : ''}"></i>`).join('')
    let inner = '', variant: string = k
    const sk = o.step === 'flow' && o.skills ? o.skills : null
    if (k === 'lang') inner = `<p>${esc(st.body!)}</p><div class="tiles">${L.langs.map((x, i) => `<button class="tile" data-k="lang-${['es', 'en'][i]}" aria-pressed="${o.lang === ['es', 'en'][i]}"><b><span class="badge">${esc(x[2]!)}</span>${esc(x[0]!)}</b><span>${esc(x[1]!)}</span></button>`).join('')}</div>`
    if (k === 'flow') {
      inner = `<p>${esc(st.body!)}</p><div class="tiles" style="grid-template-columns:1fr">${L.flow.map((x, i) => `<button class="tile" data-k="flow-${TOUR_FLOWS[i]}" aria-pressed="${o.flow === TOUR_FLOWS[i]}"><b>${esc(x[0]!)}${x[2] ? ` <span class="badge">${esc(x[2])}</span>` : ''}</b>${sk ? '' : `<span>${esc(x[1]!)}</span>`}</button>`).join('')}</div>`
      if (sk) {
        // The skill picker (not in the mock): one-line tiles, three a row, six a page; the flow tiles drop their
        // descriptions so the modal still fits the stage.
        const pages = Math.max(1, Math.ceil(sk.names.length / SKILLS_PER_PAGE)), pg = Math.min(pages - 1, Math.max(0, Math.floor(sk.page) || 0))
        const shown = sk.names.slice(pg * SKILLS_PER_PAGE, (pg + 1) * SKILLS_PER_PAGE)
        if (!shown.length) { inner += `<p style="font-size:13px">${esc(t('tour.skills.none', undefined, o.lang))}</p>`; variant = 'flow-s0' }
        else {
          inner += `<div class="tiles" style="grid-template-columns:repeat(3,1fr);gap:6px">${shown.map((s, i) => `<button class="tile sk" data-k="skill-${i}" aria-pressed="${s === sk.picked}"><b>${esc(s)}</b></button>`).join('')}</div>`
          variant = shown.length > 3 ? 'flow-s2' : 'flow-s1'
          if (pages > 1) {
            const hide = (on: boolean) => (on ? '' : ';visibility:hidden')
            inner += `<div style="display:flex"><button class="lnk" data-k="skills-prev" style="flex:1;text-align:left${hide(pg > 0)}">${esc(t('tour.skills.prev', undefined, o.lang))}</button><button class="lnk" data-k="skills-more" style="flex:1;text-align:right${hide(pg < pages - 1)}">${esc(t('tour.skills.more', undefined, o.lang))}</button></div>`
            variant = 'flow-s2p'
          }
          // The skill picked, its whole name under the tiles. Two lines are kept for it whatever the name (80 characters
          // with no spaces wrap anywhere), so the modal's height, and every control measured in it, stays the same; the
          // step's "you can change it" line makes room, so the tallest page still fits the stage.
          // shortcut: a name of mostly wide letters (80 x "W") needs three lines and ends in "…"; real skill names fit.
          if (sk.picked) {
            inner = inner.replace(`<p>${esc(st.body!)}</p>`, '') + `<p style="font-size:12px;line-height:16px;height:32px;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2" data-picked="1">${esc(t('tour.skills.picked', { name: sk.picked }, o.lang))}</p>`
            variant += 'k'
          }
        }
        const m = lay.modal[variant]!, mx = v.w * 0.5 - m.w / 2, my = v.h * 0.52 - m.h / 2
        shown.forEach((s, i) => { const r = m.c[`skill-${i}`]; if (r) hit(`skill-${s}`, mx + r[0], my + r[1], r[2], r[3]) })
        if (pages > 1) for (const [key, on] of [['skills-prev', pg > 0], ['skills-more', pg < pages - 1]] as const) { const r = m.c[key]; if (on && r) hit(key, mx + r[0], my + r[1], r[2], r[3]) }
      }
    }
    const pal = o.palette ?? 'lobby'
    // display:block on the second line: the mock runs in quirks mode, where that line takes only the span's own line
    // height (no strut); a block line in standards mode gets the same 20.15 px.
    if (k === 'prefs') {
      variant = `prefs-${pal}`
      inner = `<div class="toggle"><button class="sw" data-k="tour-everywhere" aria-pressed="${!!o.everywhere}" aria-label="${esc(L.always)}"></button><div><b>${esc(L.always)}</b><br/><span class="fine" style="color:#a9a49b;display:block">${esc(o.everywhere ? L.alwaysOn : L.alwaysOff)}</span></div></div>
    <div><div class="fine" style="color:#a9a49b;margin-bottom:6px">${esc(L.color)}</div><div class="pals">${L.pals.map((x, i) => `<button class="tile" data-k="tour-pal-${TOUR_PALS[i]}" aria-pressed="${pal === TOUR_PALS[i]}" style="padding:6px 10px"><b>${esc(x)}</b></button>`).join('')}</div></div>
    <p style="font-size:13px">${esc(L.privacy)}</p>`
    }
    if (k === 'done') inner = '<p></p>'
    pop = `<div class="modal" role="dialog" aria-label="${esc(st.title)}"><div class="hero"><div class="face">${FACE}</div><div class="say"><b>${esc(L.guide)}:</b> ${esc(st.say)}</div></div>
    <div class="body"><h3>${esc(st.title)}</h3>${inner}</div>
    <div class="foot"><button class="lnk" data-k="tour-skip">${esc(L.skip)}</button><div class="mdots">${dots}</div><div style="display:flex;gap:8px">${nav('cbtn')}</div></div></div>`
    const m = lay.modal[variant]!, mx = v.w * 0.5 - m.w / 2, my = v.h * 0.52 - m.h / 2
    // Measured as the steps always appear: language first (no Back), done last (Empezar/Start), the rest in between.
    for (const [key, r] of Object.entries(m.c)) if (!key.startsWith('skill') && !(key === 'tour-back' && first)) hit(key, mx + r[0], my + r[1], r[2], r[3])
  } else {
    const tg = tgOf() ?? [0.4, 0.4, 0.6, 0.6]
    const r = { x: tg[0] * v.w, y: tg[1] * v.h, w: (tg[2] - tg[0]) * v.w, h: (tg[3] - tg[1]) * v.h }, pad = 6, rx = 14
    shapes = `<defs><filter id="avt-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <mask id="avt-hole"><rect x="0" y="0" width="${v.w}" height="${v.h}" fill="#fff"/>
    <rect x="${r.x - pad}" y="${r.y - pad}" width="${r.w + 2 * pad}" height="${r.h + 2 * pad}" rx="${rx}" fill="#000" filter="url(#avt-soft)"/></mask></defs>
    <rect x="0" y="0" width="${v.w}" height="${v.h}" fill="#0b0a09" opacity="0.66" mask="url(#avt-hole)"/><rect class="avt-pulse" x="${r.x - pad}" y="${r.y - pad}" width="${r.w + 2 * pad}" height="${r.h + 2 * pad}" rx="${rx}" fill="none" stroke="#f2a93b" stroke-width="2.5">
        <animate attributeName="stroke-opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/></rect>`
    faces.push('pix600')
    // The bubble's size as the mock reads it (offsetWidth/Height: whole px) over the stage's clientWidth/Height.
    const text = `${L.guide}: ${st.say}`, lines = wrapLines(text, 320, L.guide.length + 1)
    const b = lay.bubble, count = `${o.n}/${o.total}`
    const navW = (first ? 0 : b.back[0] + 6) + b.next[0] + 6 + pixWidth(count, 12)
    const cw = Math.min(320, Math.max(lines.length > 1 ? 320 : pixWidth(text, 14, L.guide.length + 1), navW))
    const W = cw + 58, H = 4 + 17 + lines.length * LH + 8 + b.next[1]
    const sw = Math.round(v.w), sh = Math.round(v.h), bw = Math.round(W) / sw, bh = Math.round(H) / sh
    // The demo banner's box ends 79 px down the stage (top 40, padding 2 x 8, a 21 px line, borders): the bubble 8 below.
    const p = place(tg, bw, bh, o.step === 'despacho' ? Math.max(0.1, (79 + 8) / sh) : 0.1)
    card = [p.left, p.top, p.left + bw, p.top + bh]
    const ty = Math.min(bh * sh - 18, Math.max(10, ((tg[1] + tg[3]) / 2 - p.top) * sh - 6))
    const tx = Math.min(W - 26, Math.max(14, ((tg[0] + tg[2]) / 2 - p.left) * sw - 6)) // under or over the target's middle
    const tail = p.side === 'left' ? `left: -8px; top: ${ty}px; transform: rotate(135deg);` : p.side === 'right' ? `right: -8px; top: ${ty}px; transform: rotate(-45deg);`
      : p.side === 'above' ? `left: ${tx}px; bottom: -8px; transform: rotate(45deg);` : `left: ${tx}px; top: -8px; transform: rotate(-135deg);`
    const back = first ? '' : `<button class="pbtn ghost" data-k="tour-back">${esc(L.back)}</button>`
    pop = `<div class="bubble" style="left: ${p.left * 100}%; top: ${p.top * 100}%;"><div class="tail" style="${tail}"></div><div class="face">${FACE}</div><b>${esc(L.guide)}:</b> ${esc(st.say)}
    <div class="nav">${back}<button class="pbtn" data-k="${last ? 'tour-done' : 'tour-next'}">${esc(last ? L.start : L.next)} ▸</button><span class="count">${count}</span></div></div>`
    const bx = p.left * v.w + 2 + 44, by = p.top * v.h + 2 + 8 + lines.length * LH + 8
    if (!first) hit('tour-back', bx, by, b.back[0], b.back[1])
    hit(last ? 'tour-done' : 'tour-next', bx + (first ? 0 : b.back[0] + 6), by, b.next[0], b.next[1])
    if (o.step === 'despacho' && o.demoBanner) {
      banner = `<div class="banner"><span class="dot"></span><b>${esc(L.waits)}</b><span class="t">${esc(L.text)}</span><span class="btn">${esc(L.ver)}</span></div>`
    }
  }
  // The drawing's height in Chrome's layout units (1/64 px), as the mock's stage gets it: a 516.8 viewBox over a 516.797
  // px box would scale the modal by 0.999994 and move its edges across pixel boundaries.
  const dh = Math.floor(v.h * 64) / 64
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.w} ${dh}" width="${v.w}" height="${dh}" preserveAspectRatio="none"><style>${fontFaceCss(faces)}
${CSS(v.w, dh)}</style>${shapes}<foreignObject x="0" y="0" width="${v.w}" height="${dh}"><div xmlns="http://www.w3.org/1999/xhtml" class="avt">${banner}${row}${pop}</div></foreignObject></svg>`
  const alt = t('tour.alt', { tour: L.tour, n: o.n, total: o.total, title: st.title, guide: L.guide, say: st.say }, o.lang)
  return { svg, alt, hits, ...(card ? { card } : {}) }
}
