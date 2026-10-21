import { fontFaceCss } from './pixfont'
import { CHROME_LAYOUT } from './chromelayout'

// The pane's chrome drawn as the approved mock draws it (scratchpad buro2/asks-template.html, owner 2026-10-18): its CSS
// goes verbatim into a foreignObject, so the desktop (Chromium) lays it out as the mock does, 1 CSS px to 1 Svg unit at
// the size the Svg is given. A pane Box has no corner radius, so a button is a picture with a click layer on top
// (register.tsx, mod-clicks recipe). The only layout worked out here is what chromelayout.ts measured in Chrome: label
// widths, to size each Svg, and the notes card's line heights, so its pills' click zones come from the same numbers.

const BODY = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
const CSS = `.r{--line:#43392e;--fg:#ece6dc;--dim:#a99f90;--accent:#2d4f8f;--wait:#e2a94a;font:14px/1.5 ${BODY};color:var(--fg);display:flex;align-items:flex-start;gap:8px}
.btn{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:5px;border:1px solid var(--line);background:transparent;color:var(--fg);font:700 13px ${BODY};white-space:nowrap}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.r.mid{align-items:center}
.wait{display:flex;flex:1;min-width:0;align-items:center;gap:8px 12px;background:rgba(226,169,74,0.12);border:1px solid var(--wait);border-radius:8px;padding:8px 10px}
.wait .dot{width:8px;height:8px;border-radius:50%;background:var(--wait);flex:none}
.wait b{font-weight:700;flex:none}
.wait .t{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wait .btn{flex:none}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:12.5px;white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;background:currentColor}
.chip.on{color:#7fd6a6;border-color:#2f6b45;background:rgba(127,214,166,0.12)}
.chip.off{color:var(--dim)}
.overlay{width:300px;background:#232220;border:1.5px solid var(--wait);border-radius:8px;padding:10px 12px;color:var(--fg);font-size:12.5px;display:flex;flex-direction:column;gap:8px;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.overlay .k{color:var(--wait);font:700 13px "Pixelify Sans", ui-monospace, Menlo, monospace}
.overlay .it{border-top:1px solid #3a3834;padding-top:6px;display:flex;flex-direction:column;gap:5px}
.overlay .it:first-of-type{border-top:0;padding-top:0}
.overlay .o,.overlay b,.overlay .s{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.overlay .o{color:var(--dim);font-size:11px}
.overlay .s{color:#a99f90}
.overlay .sw{color:#a99f90;white-space:normal;overflow-wrap:anywhere}
.overlay .acts{display:flex;gap:8px;align-items:center}
.overlay .qq{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-weight:600}
.overlay .acts.wrap{flex-wrap:wrap}
.overlay .acts .chat{margin-left:auto;justify-content:center;color:var(--dim)}
.strip{display:flex;align-items:center}
.strip>div{flex:none}`
// Control characters go (XML 1.0 refuses most of them, and none draws anything), then the markup ones are escaped.
export const esc = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const L = CHROME_LAYOUT

// A character the table lacks counts wide, so a label is never clipped by its picture: emoji and other characters past
// the basic plane 1.3 em, anything else (Cyrillic, Greek, CJK and other full-width characters) an em, wider than any
// letter the table holds.
const unknownW = (ch: string) => (ch.codePointAt(0)! > 0xffff ? 1300 : 1000)
/** A label's width in px at the button's font (SF, 700, 13px) or the chip's (400, 12.5px), from Chrome's advances. */
export function textW(s: string, table: 'w700' | 'w400' = 'w700', size = 13) {
  let u = 0
  for (const ch of s) { const i = L.chars.indexOf(ch); u += i >= 0 ? L[table][i]! : unknownW(ch) }
  return (u * size) / 1000
}
// One px of room below what Chrome measured: a box can lay out half a px taller at another scale, and its bottom border
// must never be cut.
const ROOM = 1
const svg = (w: number, ht: number, html: string, cls = 'r') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}"><style>${CSS}</style><foreignObject x="0" y="0" width="${w}" height="${ht}"><div xmlns="http://www.w3.org/1999/xhtml" class="${cls}">${html}</div></foreignObject></svg>`
/** A picture: its Svg, its size in px, and its markup, so a strip (stripSvg) draws it exactly as it draws alone. */
export type Pic = { svg: string; w: number; h: number; html: string; cls: string }
const pic = (w: number, ht: number, html: string, cls = 'r'): Pic => ({ svg: svg(w, ht, html, cls), w, h: ht, html, cls })
/** Pictures side by side in one Svg, top-aligned, each in a box of its own width and `gap` px after it: their click runs
 * come from the same numbers (register.tsx). */
export function stripSvg(parts: { p: Pic; gap: number }[]) {
  const w = parts.reduce((n, x) => n + x.p.w + x.gap, 0), ht = Math.max(...parts.map(x => x.p.h))
  return svg(w, ht, parts.map(({ p, gap }) => `<div class="${p.cls}" style="width:${p.w}px;height:${p.h}px;margin-right:${gap}px">${p.html}</div>`).join(''), 'strip')
}

/** "hace Ns" that counts up by itself (SMIL `set`, no redraw and no timer): how old a drawing's numbers are. `label(s)`
 * says s seconds, shown from each mark to the next; `at` (the draw time) makes every drawing's source new, so the desktop
 * starts its clock again on each draw. BODY's quotes are escaped: a raw " would end the style attribute. */
export function ageSvg(label: (s: number) => string, color: string, at: number) {
  const marks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 45, 60, 120, 300, 600, 1800, 3600]
  const w = Math.ceil(Math.max(...marks.map(s => textW(label(s), 'w400', 12)))) + 4, ht = 16
  const texts = marks.map((s, i) => `<text x="0" y="12" visibility="hidden">${esc(label(s))}<set attributeName="visibility" to="visible" begin="${s}s"${i + 1 < marks.length ? ` end="${marks[i + 1]}s"` : ''}/></text>`)
  return { w, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" style="font:12px ${esc(BODY)};fill:${esc(color)}"><desc>${at}</desc>${texts.join('')}</svg>` }
}

/** A button as the mock's .btn (outlined) or .btn.primary (accent): an Svg just as wide as it draws. `half`: one half of
 * a segmented control, its inner corners square, so two drawn side by side touch as one control. */
export function btnSvg(label: string, primary: boolean, half?: 'left' | 'right') {
  const w = Math.ceil(textW(label) + 20), ht = Math.ceil(L.btnH) + ROOM
  const r = half === 'left' ? ' style="border-radius:5px 0 0 5px"' : half === 'right' ? ' style="border-radius:0 5px 5px 0"' : ''
  return pic(w, ht, `<span class="btn${primary ? ' primary' : ''}"${r}>${esc(label)}</span>`)
}

/** The mock's waiting strip (.wait): amber dot, "Te espera N" bold, the first item cut with an ellipsis, Ver. `w` is the
 * width it is drawn at (the pane's slot). */
export function bannerSvg(o: { w: number; count: string; text: string; ver: string }) {
  const w = Math.max(200, Math.round(o.w)), ht = Math.ceil(L.bannerH) + ROOM
  return pic(w, ht, `<div class="wait"><span class="dot"></span><b>${esc(o.count)}</b><span class="t">${esc(o.text)}</span><span class="btn">${esc(o.ver)}</span></div>`)
}

/** Abrir siempre: the mock's primary button and, beside it, a chip in green (on) or grey (off) that says which. */
export function toggleSvg(o: { label: string; on: boolean; state: string }) {
  // As tall as the taller of the two (the chip, at 12.5px with the body's line height), both centred on one line.
  const chip = textW(o.state, 'w400', 12.5) + 7 + 6 + 22, w = Math.ceil(textW(o.label) + 20 + 8 + chip), ht = Math.ceil(Math.max(L.btnH, L.chipH)) + ROOM
  return pic(w, ht, `<span class="btn primary">${esc(o.label)}</span><span class="chip ${o.on ? 'on' : 'off'}"><i></i>${esc(o.state)}</span>`, 'r mid')
}

// A reply of a Jefe's question: a pill, with `line` under the pills saying what it sends (null when the label is the very
// text it sends) and `detail`, said instead of the pill when the pill or its line would not show whole; or only a line
// when the app alone can do it.
export type NoteReply = { label: string; line: string | null; detail: string } | { inApp: string }
// `chat`: the words of an "open its chat" pill, drawn last in its pills row, outlined, at the row's right end (on a
// suggestion: once its session did not answer a press).
export type NoteItem = { office: string | null; title: string; brief: string; chat?: string } | { office: string | null; asks: string; q: string; replies: NoteReply[]; chat?: string }
export type PillRect = { i: number; act: 'start' | 'dismiss' | 'chat' | number; x: number; y: number; w: number; h: number }
/**
 * How many lines `s` wraps to in a reply's line (.sw: 298 px, white-space normal, overflow-wrap anywhere): greedy by word,
 * each line kept one widest character of its own short of the edge (Chrome may lay it a little wider), a word wider than
 * that broken by character. Whitespace runs count as one space. Stops counting past 3.
 */
export function noteLines(s: string) {
  const w = (t: string) => textW(t, 'w400', 12.5), fits = (t: string) => w(t) + Math.max(0, ...[...t].map(w)) <= 298
  let n = 1, line = ''
  for (const word of s.replace(/[ \t\n\r\f]+/g, ' ').trim().split(' ')) {
    const t = line ? `${line} ${word}` : word
    if (fits(t)) { line = t; continue }
    if (line) { n++; line = '' }
    for (const ch of word) { if (line && !fits(line + ch)) { n++; line = '' } line += ch }
    if (n > 3) return n
  }
  return n
}
// A reply can be a pill only when everything it sends shows whole: the pill fits the card's 300 px and its line at most
// 3 lines. Its line count (0 when it has none), or -1.
const pillLines = (r: { label: string; line: string | null }) => {
  if (textW(r.label) + 20 > 300) return -1
  const n = r.line === null ? 0 : noteLines(r.line)
  return n <= 3 ? n : -1
}
/**
 * The notes card: the mock's .overlay. A suggestion: office, title, brief cut with an ellipsis, its two pills. A question:
 * office, "<Jefe> te pregunta:", the question in a 2-line box, its reply pills side by side (wrapping), then per reply
 * what its pill sends (up to 3 wrapped lines) or one line saying why it has none. Items are drawn in order while their
 * minimum (every reply a line) fits `maxH` px (the first always), the rest said as `more(n)`. Within an item each reply in
 * turn gets its pill and lines when those, plus a line per later reply, still fit, or when they take no more height than
 * its one line would; the first reply of the first item always gets them, as the first item is always drawn. Sizes in CSS px; `pills` are the pills' rects inside the card, from the same line
 * heights Chrome measured.
 */
// The card's shadow (0 6px 20px) reaches 20 px to the sides, 14 above and 26 below: the picture leaves it that room.
const SHADOW = { x: 20, top: 14, bottom: 26 }
export function notesCard(o: { title: string; items: NoteItem[]; more: (n: number) => string; start: string; dismiss: string; maxH: number }) {
  const CW = 300 + 24 + 3, pills: PillRect[] = [], ox = SHADOW.x, oy = SHADOW.top, x0 = ox + 1.5 + 12, END = 10 + 1.5
  // One item: its markup, its height from the card's gap above it, its pills' rects from its top. `room`: the height it
  // may take.
  const itemOf = (it: NoteItem, i: number, room: number) => {
    const ps: PillRect[] = []
    let y = 8 + 7 // the card's gap, then the hairline and its padding (the title is a div too, so no item is the first of its type)
    const office = it.office !== null ? `<span class="o">${esc(it.office)}</span>` : ''
    if (it.office !== null) y += L.lineO + 5
    if ('q' in it) {
      y += L.line + 5 + 2 * L.line // the asks line, the question's 2-line box
      const top = y + 5, n = it.replies.length
      let row = '', lines = '', px = 0, rows = -1
      // The first reply is the recommended one: its pill is primary and says so in its words too, "▸ ".
      const words = (r: { label: string }, j: number) => (j === 0 ? `▸ ${r.label}` : r.label)
      it.replies.forEach((r, j) => {
        const k = 'inApp' in r ? -1 : pillLines({ label: words(r, j), line: r.line })
        if (k >= 0 && !('inApp' in r)) {
          const w = textW(words(r, j)) + 20, next = rows >= 0 && px + w > 300 // wraps as the row's flex-wrap does, 8 px apart both ways
          const add = (rows < 0 ? 5 + L.btnH : next ? 8 + L.btnH : 0) + (k ? 5 + k * L.line : 0)
          if ((i === 0 && j === 0) || add <= 5 + L.line || y + add + (n - j - 1) * (5 + L.line) <= room + 1e-9) {
            if (rows < 0 || next) { rows++; px = 0 }
            ps.push({ i, act: j, x: x0 + px, y: top + rows * (L.btnH + 8), w, h: L.btnH })
            px += w + 8; y += add
            row += j === 0 ? `<span class="btn primary">${esc(words(r, j))}</span>` : `<span class="btn">${esc(r.label)}</span>`
            if (k === 1) lines += `<span class="s">${esc(r.line!)}</span>`
            else if (k) lines += `<span class="sw" style="height:${k * L.line}px">${esc(r.line!)}</span>`
            return
          }
        }
        y += 5 + L.line
        lines += `<span class="s">${esc('inApp' in r ? r.inApp : r.detail)}</span>`
      })
      // The chat pill: last in the row, pushed to its right end (on a row of its own when it does not fit), dim so it never
      // reads as a reply, under the room rule of a reply with no line, so the first item always shows it. Its width is
      // set on it (its arrow is not in the measured table), so the picture is exactly its zone.
      const w = it.chat === undefined ? 0 : textW(it.chat) + 20
      if (it.chat !== undefined && w <= 300) {
        const next = rows >= 0 && px + w > 300, add = rows < 0 ? 5 + L.btnH : next ? 8 + L.btnH : 0
        if (i === 0 || add <= 5 + L.line || y + add <= room + 1e-9) {
          if (rows < 0 || next) rows++
          ps.push({ i, act: 'chat', x: x0 + 300 - w, y: top + rows * (L.btnH + 8), w, h: L.btnH })
          y += add
          row += `<span class="btn chat" style="width:${w - 20}px">${esc(it.chat)}</span>`
        }
      }
      return { y, ps, html: `<div class="it">${office}<b>${esc(it.asks)}</b><span class="qq" style="height:${2 * L.line}px">${esc(it.q)}</span>${row ? `<span class="acts wrap">${row}</span>` : ''}${lines}</div>` }
    }
    y += L.line + 5 + L.line + 5
    const ws = textW(o.start) + 20, wd = textW(o.dismiss) + 20
    ps.push({ i, act: 'start', x: x0, y, w: ws, h: L.btnH }, { i, act: 'dismiss', x: x0 + ws + 8, y, w: wd, h: L.btnH })
    // Its chat pill, as a question's: the row's right end, or a row of its own when the row is full.
    const wc = it.chat === undefined ? 0 : textW(it.chat) + 20, own = ws + 8 + wd + 8 + wc > 300
    if (it.chat !== undefined && wc <= 300) ps.push({ i, act: 'chat', x: x0 + 300 - wc, y: y + (own ? L.btnH + 8 : 0), w: wc, h: L.btnH })
    const chat = it.chat !== undefined && wc <= 300 ? `<span class="btn chat" style="width:${wc - 20}px">${esc(it.chat)}</span>` : ''
    y += L.btnH + (chat && own ? 8 + L.btnH : 0)
    return { y, ps, html: `<div class="it">${office}<b>${esc(it.title)}</b><span class="s">${esc(it.brief)}</span><span class="acts${chat && own ? ' wrap' : ''}"><span class="btn primary">${esc(o.start)}</span><span class="btn">${esc(o.dismiss)}</span>${chat}</span></div>` }
  }
  let y = oy + 1.5 + 10 + L.kH, items = '', shown = 0 // border, padding, the title line
  for (const [i, it] of o.items.entries()) {
    const left = o.items.length - i - 1, room = o.maxH - (y - oy) - END - (left ? 8 + L.line : 0)
    const x = itemOf(it, i, room)
    if (i > 0 && x.y > room) break // past its minimum: nothing taller than its lines was taken, and they do not fit
    for (const p of x.ps) pills.push({ ...p, y: y + p.y })
    y += x.y; items += x.html; shown++
  }
  const more = shown < o.items.length ? o.more(o.items.length - shown) : null
  if (more) y += 8 + L.line
  const CH = Math.ceil(y + 10 + 1.5 - oy), W = CW + 2 * ox, H = oy + CH + SHADOW.bottom
  // The ×: the cards' close mark, top right, over the card (the mock's card has none; every card on the map does). `close`
  // is the drawn × itself; its click zone grows from it (register.tsx, `around(...)` where the card-close zone is made).
  const close = { x: ox + CW - 20, y: oy + 10.5, w: 10, h: 10 }
  const x = `<path d="M${close.x} ${close.y}L${close.x + close.w} ${close.y + close.h}M${close.x + close.w} ${close.y}L${close.x} ${close.y + close.h}" stroke="#a99f90" stroke-width="2" stroke-linecap="round"/>`
  const body = `<style>${fontFaceCss(['pix700'])}\n${CSS}</style><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" class="r" style="display:block;padding:${oy}px ${ox}px 0"><div class="overlay"><div class="k">${esc(o.title)}</div>${items}${more ? `<span class="s">${esc(more)}</span>` : ''}</div></div></foreignObject>${x}`
  return { W, H, CH, body, pills, close, shown, face: { x: ox, y: oy, w: CW, h: CH } } // face: the drawn card, without its shadow room
}
