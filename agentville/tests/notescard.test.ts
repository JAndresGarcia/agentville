import { expect, test } from 'claude-code/testing'

import { pressTitle } from '../hooks/beat'
import { ageSvg, notesCard, textW } from '../hooks/chrome'
import type { NoteItem, NoteReply } from '../hooks/chrome'

// The notes card's question items (chrome.ts): the first reply's pill is the recommended one, and a question may carry
// "Ir al chat", its last pill, pushed to the row's right end.
const x0 = 20 + 1.5 + 12, BTN = 23
const ask = (replies: NoteReply[], chat?: string): NoteItem => ({ office: null, asks: 'Nico te pregunta:', q: '¿Sigo?', replies, ...(chat ? { chat } : {}) })
const card = (items: NoteItem[], maxH = 1000) => notesCard({ title: 'Notas', items, more: n => `+${n}`, start: '▸ Arrancar', dismiss: 'Descartar', maxH })
const reply = (label: string, line: string | null = null) => ({ label, line, detail: `«${label}»: respóndela en el detalle` })

test('C: the first reply\'s pill is primary, says ▸ and is measured on those words; the others stay outlined', () => {
  const c = card([ask([reply('Sí, arréglalo', 'Sí, arréglalo: «Sí, arregla el redondeo final.»'), reply('Solo mira'), reply('No')])])
  expect(c.body).toContain('<span class="acts wrap"><span class="btn primary">▸ Sí, arréglalo</span><span class="btn">Solo mira</span><span class="btn">No</span></span>')
  expect(c.body).not.toContain('<span class="btn">Sí, arréglalo</span>')
  expect(c.pills.map(p => [p.act, Math.round(p.w * 100) / 100])).toEqual([[0, Math.round((textW('▸ Sí, arréglalo') + 20) * 100) / 100], [1, Math.round((textW('Solo mira') + 20) * 100) / 100], [2, Math.round((textW('No') + 20) * 100) / 100]])
  expect(Math.abs(c.pills[1]!.x - (x0 + c.pills[0]!.w + 8)) < 1e-9).toBe(true)
  // the line under the pills still says what it sends, without the ▸
  expect(c.body).toContain('<span class="s">Sí, arréglalo: «Sí, arregla el redondeo final.»</span>')
})

test('C: when the first reply shows no pill (in the app, or too long to show whole) no pill is primary', () => {
  const inApp = card([ask([{ inApp: 'Verificar (en la app)' }, reply('Sí'), reply('No')])])
  expect([inApp.body.includes('btn primary'), inApp.pills.map(p => p.act)]).toEqual([false, [1, 2]])
  const long = card([ask([reply('Largo', `Largo: «${'x'.repeat(400)}»`), reply('Sí')])])
  expect([long.body.includes('btn primary'), long.body.includes('«Largo»: respóndela en el detalle'), long.pills.map(p => p.act)]).toEqual([false, true, [1]])
  // a label that fits outlined but not with its ▸ goes to the detail too, so the pill never runs past the card
  const w = (s: string) => textW(s) + 20
  let label = 'i'
  while (w(`▸ ${label}`) <= 300) label += 'i'
  const edge = card([ask([reply(label), reply('Sí')])])
  expect([w(label) <= 300, edge.pills.map(p => p.act), edge.body.includes(`«${label}»: respóndela en el detalle`)]).toEqual([true, [1], true])
})

test('D: "Ir al chat" is the row\'s last pill, outlined, at its right end; it wraps to a row of its own when it does not fit', () => {
  const c = card([ask([reply('Sí'), reply('No')], 'Ir al chat')])
  const chat = c.pills.find(p => p.act === 'chat')!, wc = textW('Ir al chat') + 20
  expect(c.body).toContain(`<span class="btn">No</span><span class="btn chat" style="width:${wc - 20}px">Ir al chat</span></span>`) // its width set: exactly its zone
  expect(c.body).toContain('.overlay .acts .chat{margin-left:auto;justify-content:center;color:var(--dim)}')
  expect([chat.i, chat.w, chat.x, chat.y, chat.ht]).toEqual([0, wc, x0 + 300 - wc, c.pills[0]!.y, BTN])
  let label = 'i' // a first reply that leaves the chat pill no room beside it
  while (textW(`▸ ${label}`) + 20 + 8 + wc <= 300) label += 'i'
  const full = card([ask([reply(label)], 'Ir al chat')])
  const rows = [...new Set(full.pills.map(p => p.y))], fc = full.pills.at(-1)!
  expect([full.pills.length, fc.act, fc.x, fc.y, rows.length, rows[1]! - rows[0]!]).toEqual([2, 'chat', x0 + 300 - wc, full.pills[0]!.y + BTN + 8, 2, BTN + 8])
  expect(full.CH - card([ask([reply(label)])]).CH).toBe(BTN + 8) // its own row
  // no reply pill at all: the chat pill makes the row
  const alone = card([ask([{ inApp: 'Verificar (en la app)' }], 'Ir al chat')])
  expect([alone.pills.map(p => p.act), alone.body.includes(`<span class="acts wrap"><span class="btn chat" style="width:${wc - 20}px">Ir al chat</span></span>`)]).toEqual([['chat'], true])
})

test('D: the chat pill keeps the room rule of a reply with no line: the first item always shows it, a later one only with room', () => {
  const items = [ask([reply('Sí')], 'Ir al chat'), ask([reply('Uno'), reply('Dos'), reply('Tres')], 'Ir al chat')]
  expect(card(items).pills.filter(p => p.act === 'chat').map(p => p.i)).toEqual([0, 1])
  // the first item, even past its room
  expect(card([ask(['Primera respuesta', 'Segunda respuesta', 'Tercera'].map(l => reply(l)), 'Ir al chat')], 10).pills.at(-1)!.act).toBe('chat')
  // a second item whose replies fill its row: the chat pill needs a row of its own, and the room left holds none
  const second = ask(['Primera respuesta', 'Segunda respuesta', 'Tercera'].map(l => reply(l)), 'Ir al chat')
  const fit = card([ask([reply('Sí')]), second]), tight = card([ask([reply('Sí')]), second], fit.CH - 1) // a px short of its chat row
  expect([fit.pills.filter(p => p.i === 1).map(p => p.act), tight.shown, tight.pills.filter(p => p.i === 1).map(p => p.act)]).toEqual([[0, 1, 2, 'chat'], 2, [0, 1, 2]])
})

test('the meter age Svg is well-formed: every attribute of its root closes, and its style keeps the font list and the fill', () => {
  const { svg } = ageSvg(s => `hace ${s}s`, '#a99f90', 123)
  const root = /^<svg((?:\s+[\w:-]+="[^"<]*")*)>/.exec(svg) // a raw " inside a value (the font's "Segoe UI") fails here
  expect(root).not.toBeNull()
  const attrs = Object.fromEntries([...root![1]!.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
  expect(attrs.style).toContain('fill:#a99f90')
  expect(attrs.style).toContain('&quot;Segoe UI&quot;')
  expect([(svg.match(/<text /g) ?? []).length, (svg.match(/<\/text>/g) ?? []).length]).toEqual([21, 21])
  expect(svg.endsWith('</svg>')).toBe(true)
})

test('I: a suggestion carrying "Ir al chat" (its session did not answer) draws the pill at its row\'s right end, with its rect', () => {
  const offer = (chat?: string): NoteItem => ({ office: null, title: 'Limpiar', brief: 'b', ...(chat ? { chat } : {}) })
  const c = card([offer('↗ Ir al chat')]), wc = textW('↗ Ir al chat') + 20, chat = c.pills.find(p => p.act === 'chat')!
  expect(c.pills.map(p => p.act)).toEqual(['start', 'dismiss', 'chat'])
  expect([chat.i, chat.w, chat.x, chat.y, chat.ht]).toEqual([0, wc, x0 + 300 - wc, c.pills[0]!.y, BTN]) // the same row as its pills
  expect(c.body).toContain(`<span class="btn">Descartar</span><span class="btn chat" style="width:${wc - 20}px">↗ Ir al chat</span></span>`)
  expect(c.CH).toBe(card([offer()]).CH) // no taller
  const plain = card([offer()])
  expect([plain.pills.map(p => p.act), plain.body.includes('btn chat')]).toEqual([['start', 'dismiss'], false])
})

test('I: a suggestion\'s chat pill that does not fit beside its pills takes a row of its own, at its right end', () => {
  let chat = '↗ Ir al chat'
  while (textW('▸ Arrancar') + 20 + 8 + textW('Descartar') + 20 + 8 + textW(chat) + 20 <= 300) chat += 'o'
  const c = card([{ office: null, title: 'Limpiar', brief: 'b', chat }]), wc = textW(chat) + 20, pill = c.pills.find(p => p.act === 'chat')!
  expect([wc <= 300, pill.x, pill.y - c.pills[0]!.y, pill.w, pill.ht]).toEqual([true, x0 + 300 - wc, BTN + 8, wc, BTN])
  expect(c.CH - card([{ office: null, title: 'Limpiar', brief: 'b' }]).CH).toBe(BTN + 8)
  expect(c.body).toContain(`<span class="acts wrap"><span class="btn primary">▸ Arrancar</span><span class="btn">Descartar</span><span class="btn chat" style="width:${wc - 20}px">${chat}</span></span>`)
})

test('M: the longer Arrancar label fits the 300 px card in both languages; with "Ir al chat" the pills wrap, never clip', () => {
  for (const [start, dismiss, chat] of [['▸ Arrancar en su chat', 'Descartar', '↗ Ir al chat'], ['▸ Start in its chat', 'Dismiss', '↗ Open chat']] as const) {
    const of = (it: NoteItem) => notesCard({ title: 'Notas', items: [it], more: n => `+${n}`, start, dismiss, maxH: 1000 })
    const plain = of({ office: null, title: 'Limpiar', brief: 'b' }), linked = of({ office: null, title: 'Limpiar', brief: 'b', chat })
    const ws = textW(start) + 20, wd = textW(dismiss) + 20, wc = textW(chat) + 20
    expect([start, ws + 8 + wd <= 300]).toEqual([start, true]) // Arrancar and Descartar share one row
    expect(plain.pills.map(p => [p.act, p.x, p.w])).toEqual([['start', x0, ws], ['dismiss', x0 + ws + 8, wd]])
    expect(plain.body).toContain(`<span class="btn primary">${start}</span><span class="btn">${dismiss}</span>`)
    for (const p of linked.pills) expect([start, p.act, p.x >= x0 && p.x + p.w <= x0 + 300 + 1e-9]).toEqual([start, p.act, true])
    const c = linked.pills.find(p => p.act === 'chat')!, own = ws + 8 + wd + 8 + wc > 300
    expect([start, c.y - linked.pills[0]!.y]).toEqual([start, own ? BTN + 8 : 0]) // its own row only when the row is full
  }
})

test('N: pressTitle makes a stored title safe for Arrancar\'s line: spaces folded, 80 at most, no quote marks, masked; a control or hidden character is null; empty is the id', () => {
  const id = 'task_abc123'
  expect([pressTitle('  Medir  la   caché ', id), pressTitle('«Di» "hola" “ya”', id), pressTitle('x'.repeat(81), id)!.length, pressTitle('x'.repeat(80), id)]).toEqual(['Medir la caché', 'Di hola ya', 80, 'x'.repeat(80)])
  expect([pressTitle('Medir\nla caché', id), pressTitle('a\u200bb', id), pressTitle('a\u0007b', id), pressTitle('a\u2028b', id), pressTitle(42, id), pressTitle(null, id)]).toEqual([null, null, null, null, null, null])
  expect([pressTitle('', id), pressTitle('  «»  ', id)]).toEqual([id, id])
  // A fake key built from parts, so the shipped file holds no key-shaped literal (the plugin directory scans for them).
  expect(pressTitle(`usa ${['sk', 'ant', 'api03'].join('-')}-abcdefghijklmnopqrstuvwxyz0123456789`, id)).not.toContain('abcdefghijklmnop')
  expect([pressTitle('usa token="s3cr3tvalue99"', id), pressTitle('usa password=«hunter2x»', id)]).toEqual(['usa token=•••', 'usa password=•••']) // a quote never splits a secret
})
