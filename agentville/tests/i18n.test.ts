import { expect, test } from 'claude-code/testing'

import { DEFAULT_LANG, LANG_KEY, STRINGS, getLang, langOf, setLang, t } from '../hooks/i18n'
import type { Key } from '../hooks/i18n'
import { ROLES, STATES, mapNote, toolsLabel } from '../hooks/scene'
import { PALETTES } from '../hooks/look'
import { newBeat } from '../hooks/beat'
import { menuOf } from '../hooks/field'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// Every test leaves the language as it found it: the setting is module-wide.
const inLang = (lang: unknown, run: () => void) => { const was = getLang(); setLang(lang); try { run() } finally { setLang(was) } }

test('the table: both languages filled, the same placeholders in each, no em dash anywhere', () => {
  for (const [key, [es, en]] of Object.entries(STRINGS)) {
    expect([key, es.length > 0, en.length > 0]).toEqual([key, true, true])
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    expect([key, vars(en)]).toEqual([key, vars(es)])
    expect([key, `${es}${en}`.includes(String.fromCharCode(0x2014))]).toEqual([key, false])
  }
})

test('default is English with no stored language; unknown values fall back to it; a stored Spanish stays', () => {
  expect([DEFAULT_LANG, LANG_KEY]).toEqual(['en', 'lang'])
  expect([langOf(undefined), langOf('fr'), langOf('en'), langOf('es')]).toEqual(['en', 'en', 'en', 'es'])
  inLang('fr', () => expect(getLang()).toBe('en'))
  inLang(undefined, () => expect(getLang()).toBe('en'))
})

test('t fills placeholders, keeps unknown ones, and takes an explicit language', () => {
  expect(t('tour.dots', { n: 3, total: 7 })).toBe('Paso 3 de 7')
  expect(t('tour.dots', { n: 3, total: 7 }, 'en')).toBe('Step 3 of 7')
  expect(t('tour.island.say', {})).toBe('Cada sesión de Claude Code que abres tiene su oficina aquí. Esta es "{name}".')
  inLang('en', () => expect([t('tour.next'), t('tour.start'), t('tour.open')]).toEqual(['Next', 'Start', 'Tour']))
})

test('the pure modules answer in the language set at read time', () => {
  inLang('en', () => {
    expect([ROLES.rev, STATES.esperando.label, STATES.inactivo.short]).toEqual(['Reviewer', 'Waiting for your OK', 'Free'])
    expect([toolsLabel(1), toolsLabel(2), mapNote(1)]).toEqual(['1 tool', '2 tools', 'Click an office to open it; inside, click each person.'])
    expect(PALETTES.lobby!.name).toBe('Warm lobby')
    expect(newBeat('s', 'n', 0).agents.main!.activity).toBe('Waiting for your message')
  })
  expect([ROLES.rev, STATES.esperando.label, PALETTES.lobby!.name, newBeat('s', 'n', 0).agents.main!.activity]).toEqual(['Revisor', 'Espera tu aprobación', 'Lobby cálido', 'Espera tu mensaje'])
  expect(Object.keys(ROLES)).toEqual(['jefe', 'impl', 'rev', 'qa']) // still a plain record to iterate
})

test('the field takes its group heading from the pane', () => {
  const rows = menuOf('/re', [['remember', '', 'user']], t('field.mine', undefined, 'en'))
  expect(rows[0]).toEqual({ head: 'Your skills and commands', more: 0 })
})

test('the spec copy is in the table word for word, and the card tour keys are gone', () => {
  const k = (key: Key) => STRINGS[key]
  expect(k('tour.despacho.say')).toEqual(['Si alguien necesita tu OK, pasa primero por mi escritorio y luego camina a tu despacho; arriba sale este aviso. Pulsa Ver: R rechaza y A abre el chat para aprobar.', 'When someone needs your OK they stop at my desk first, then walk to your desk and this banner shows up. Press Open: R rejects, A opens the chat to approve.'])
  expect([k('tour.screen.say'), k('staff.sec')]).toEqual([['Esta pantalla dice cuánto contexto lleva y cuánto cuesta. Al terminar el recorrido, haz clic en ella para abrir la tarjeta; un clic en otro sitio la cierra.', 'This screen shows how much context is used and what it costs. After the tour, click it to open the card; a click anywhere else closes it.'], ['Gem · Secretaria', 'Gem · Secretary']])
  // the usage card opens on a click: no user-facing string speaks of hovering
  for (const [key, [es, en]] of Object.entries(STRINGS)) expect([key, /hover|pasa el mouse|al pasar/i.test(es + en)]).toEqual([key, false])
  expect(k('tour.done.say')).toEqual(['Ya conoces la oficina. Vuelve a este recorrido cuando quieras con el botón Recorrido.', 'You know the office now. Replay this tour any time with the Tour button.'])
  expect(Object.keys(STRINGS).filter(x => /^tour\.(s\d|icon)/.test(x))).toEqual([])
})

test('the sub-office copy is in the table word for word', () => {
  const k = (key: Key) => STRINGS[key]
  expect([k('role.lead'), k('role.leadOf'), k('fam.rooms.one'), k('fam.rooms.many'), k('fam.more'), k('fam.coord.one'), k('fam.coord.many')]).toEqual([
    ['Encargado', 'Deputy'], ['Encargado de {parent}', 'Deputy of {parent}'], ['una oficina y 1 sala', 'one office and 1 room'], ['una oficina y {n} salas', 'one office and {n} rooms'],
    ['+{n} más', '+{n} more'], ['coordina 1 sesión', 'coordinates 1 session'], ['coordina {n} sesiones', 'coordinates {n} sessions'],
  ])
  expect([t('fam.coord.many', { n: 3 }), t('fam.rooms.many', { n: 2 }, 'en'), t('role.leadOf', { parent: 'padre' })]).toEqual(['coordina 3 sesiones', 'one office and 2 rooms', 'Encargado de padre'])
})

test('the notes card copy: its mixed title and the note\'s zone, in both languages', () => {
  const k = (key: Key) => STRINGS[key]
  expect([k('notes.titleMixed'), k('notes.zone')]).toEqual([['Notas', 'Notes'], ['{label} en tu escritorio', '{label} on your desk']])
})

test('M: Arrancar opens its chat; its label and toasts word for word, the start path\'s copy gone', () => {
  const k = (key: Key) => STRINGS[key]
  expect([k('notes.start'), k('toast.startInChat'), k('toast.startNoChat')]).toEqual([
    ['▸ Arrancar en su chat', '▸ Start in its chat'],
    ['Abriendo el chat de {name}: pulsa Start en la tarjeta', 'Opening {name}\'s chat: press Start on the card'],
    ['Abre su chat en la app y pulsa Start en la tarjeta', 'Open its chat in the app and press Start on the card'],
  ])
  expect([t('toast.startInChat', { name: 'proj' }), t('toast.startInChat', { name: 'proj' }, 'en')]).toEqual(['Abriendo el chat de proj: pulsa Start en la tarjeta', 'Opening proj\'s chat: press Start on the card'])
  const gone = ['q.startPress', 'q.startSay', 'toast.askedJefe', 'toast.askingJefe', 'toast.startAsked', 'toast.startNotAsked', 'toast.startDeclined', 'toast.startAskedNoChat', 'toast.startNotAskedNoChat', 'toast.startDeclinedNoChat', 'toast.startFailed', 'toast.offerStarted']
  expect(gone.filter(x => x in STRINGS)).toEqual([])
})

test('N: Arrancar\'s prompt-box line and its toasts, word for word in both languages', () => {
  const k = (key: Key) => STRINGS[key]
  expect([k('q.startFill'), k('toast.startFilled'), k('toast.startReady'), k('toast.startBusy'), k('toast.startCard')]).toEqual([
    ['Arranca la sesión sugerida «{title}» (proposal_id {task_id}).', 'Start the suggested session "{title}" (proposal_id {task_id}).'],
    ['Te dejé escrito «Arranca…» en su chat: dale Enter', 'I left "Start…" written in its chat: press Enter'],
    ['Ya está escrito en su chat: dale Enter', 'It is already written in its chat: press Enter'],
    ['Su campo ya tiene texto: añade «arráncala» al final y Enter', 'Its box already has text: add "start it" at the end and Enter'],
    ['Pulsa Start en la tarjeta de su chat', 'Press Start on the card in its chat'],
  ])
  expect(t('q.startFill', { title: 'Medir', task_id: 'task_abc123' }, 'en')).toBe('Start the suggested session "Medir" (proposal_id task_abc123).')
})
