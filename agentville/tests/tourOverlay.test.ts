import { expect, test } from 'claude-code/testing'

import type { Lang } from '../hooks/i18n'
import { TOUR_STEP_IDS, floorView, initialWorld, rowsOf, tourTargets, viewOf } from '../hooks/scene'
import type { AgentvilleWorld } from '../types'
import type { TourStep } from '../hooks/scene'
import { copyHash, tourCopy, tourOverlay, wrapLines } from '../hooks/tour'
import type { TourOverlayOpts } from '../hooks/tour'
import { TOUR_LAYOUT } from '../hooks/tourlayout'

// <generated> by the judge harness (gen-tourlayout.mjs) from layout.json
const MOCK: { T: Record<string, unknown>; rects: { step: number; lang: string; c: Record<string, number[]> }[]; lines: { step: number; lang: string; n: number }[]; samples: { lang: string; n: [string, number][] }[] } = {"T":{"es":{"skip":"Saltar","next":"Siguiente","back":"Atrás","start":"Empezar","step":"Paso {n} de {t}","guide":"Gem","tour":"Recorrido","s":[{"title":"Idioma / Language","say":"¡Hola! Soy Gem, la secretaria. ¿En qué idioma te muestro la oficina?","body":"Elige el idioma del panel. Puedes cambiarlo luego."},{"title":"Cada sesión es una oficina","say":"Cada sesión de Claude Code que abres tiene su oficina aquí. Esta es \"Tienda online\"."},{"title":"El Jefe","say":"Este es el Jefe: el agente principal de esa sesión. Al terminar el recorrido, haz clic en cualquiera para ver su chat y su plan."},{"title":"El equipo","say":"Cuando el Jefe necesita ayuda llama a su equipo: Implementador, Revisor y QA. Aparecen en sus escritorios."},{"title":"La pizarra","say":"La pizarra muestra el plan de la oficina. Lo tachado ya está hecho."},{"title":"La pantalla de uso","say":"Esta pantalla dice cuánto contexto lleva y cuánto cuesta. Al terminar el recorrido, haz clic en ella para abrir la tarjeta; un clic en otro sitio la cierra."},{"title":"La zona pública","say":"Quien termina o espera viene a descansar aquí: café, charla, PlayStation."},{"title":"Tu despacho","say":"Si alguien necesita tu OK, pasa primero por mi escritorio y luego camina a tu despacho; arriba sale este aviso. Pulsa Ver: R rechaza y A abre el chat para aprobar."},{"title":"¿Cómo trabajan tus equipos?","say":"Antes de cambiar archivos, ¿qué proceso sigue el Jefe?","body":"Sin elegir, no hay flujo de equipo; puedes cambiarlo cuando quieras."},{"title":"Dónde se abre","say":"Último detalle: ¿te abro en todas tus sesiones?"},{"title":"¡Listo!","say":"Ya conoces la oficina. Vuelve a este recorrido cuando quieras con el botón Recorrido."}],"flow":[["Flujo de equipo de Agentville","Spec, implementación y revisiones según el riesgo del cambio.","Recomendado"],["Una de mis skills","El Jefe pasa cada cambio por la skill que elijas."],["Sin flujo de equipo","El Jefe trabaja como Claude Code normal."]],"langs":[["Español","Todo el panel en español.","ES"],["English","The whole panel in English.","EN"]],"always":"Abrir siempre","alwaysOn":"Se abre en todas tus sesiones.","alwaysOff":"Solo se abre donde escribes /agentville.","color":"Color del panel","pals":["Lobby cálido","Noche","Hotel"],"privacy":"Todo queda en tu computador, en una carpeta solo tuya. Lo que no se toca en 7 días se borra solo.","head":"Recorrido","waits":"Te espera 1","text":"Lía (App de recetas): npm run test -- recipes","ver":"Ver"},"en":{"skip":"Skip","next":"Next","back":"Back","start":"Start","step":"Step {n} of {t}","guide":"Gem","tour":"Tour","s":[{"title":"Idioma / Language","say":"Hi! I am Gem, the secretary. Which language should I show you the office in?","body":"Pick the panel language. You can change it later."},{"title":"Each session is an office","say":"Every Claude Code session you open gets its office here. This one is \"Tienda online\"."},{"title":"The Lead","say":"This is the Lead: the main agent of that session. After the tour, click anyone to see their chat and plan."},{"title":"The team","say":"When the Lead needs help it calls its team: Builder, Reviewer and QA. They show up at their desks."},{"title":"The board","say":"The board shows the office plan. Crossed out means done."},{"title":"The usage screen","say":"This screen shows how much context is used and what it costs. After the tour, click it to open the card; a click anywhere else closes it."},{"title":"The common area","say":"Whoever is done or waiting comes here to rest: coffee, chat, PlayStation."},{"title":"Your desk","say":"When someone needs your OK they stop at my desk first, then walk to your desk and this banner shows up. Press Open: R rejects, A opens the chat to approve."},{"title":"How do your teams work?","say":"Before changing files, which process should the Lead follow?","body":"Until you pick, no team flow is on; you can change it any time."},{"title":"Where it opens","say":"Last thing: should I open in all your sessions?"},{"title":"All set!","say":"You know the office now. Replay this tour any time with the Tour button."}],"flow":[["Agentville team flow","Spec, build and reviews sized to each change's risk.","Recommended"],["One of my skills","The Lead runs every change through the skill you pick."],["No team flow","The Lead works like plain Claude Code."]],"langs":[["Español","Todo el panel en español.","ES"],["English","The whole panel in English.","EN"]],"always":"Always open","alwaysOn":"Opens in all your sessions.","alwaysOff":"Opens only where you type /agentville.","color":"Panel colour","pals":["Warm lobby","Night","Hotel"],"privacy":"Everything stays on your computer, in a folder only you can read. Anything untouched for 7 days is deleted on its own.","head":"Tour","waits":"1 waiting","text":"Lía (Recipes app): npm run test -- recipes","ver":"Open"}},"rects":[{"step":1,"lang":"es","c":{"lang-es":[180,283.2,240,62.55],"lang-en":[428,283.2,240,62.55],"tour-skip":[180,375.74,39.44,25],"tour-next":[576.03,372.74,91.97,31]}},{"step":2,"lang":"es","c":{"tour-back":[307.19,206.48,64.91,25],"tour-next":[378.09,206.48,94.5,25]}},{"step":3,"lang":"es","c":{"tour-back":[211.19,208.39,64.91,25],"tour-next":[282.09,208.39,94.5,25]}},{"step":4,"lang":"es","c":{"tour-back":[387.19,296.39,64.91,25],"tour-next":[458.09,296.39,94.5,25]}},{"step":5,"lang":"es","c":{"tour-back":[303.52,222.03,64.91,25],"tour-next":[374.42,222.03,94.5,25]}},{"step":6,"lang":"es","c":{"tour-back":[243.52,211.81,64.91,25],"tour-next":[314.42,211.81,94.5,25]}},{"step":7,"lang":"es","c":{"tour-back":[214.75,279.89,64.91,25],"tour-next":[285.66,279.89,94.5,25]}},{"step":8,"lang":"es","c":{"tour-back":[110.8,371.3,64.91,25],"tour-next":[181.7,371.3,94.5,25]}},{"step":9,"lang":"es","c":{"flow-agentville":[180,212.65,488,62.55],"flow-skill":[180,283.2,488,62.55],"flow-none":[180,353.74,488,62.55],"tour-skip":[180,446.29,39.44,25],"tour-back":[509.91,443.29,58.13,31],"tour-next":[576.03,443.29,91.97,31]}},{"step":10,"lang":"es","c":{"tour-everywhere":[180,220.52,38,22],"tour-pal-lobby":[180,288.58,126.02,34],"tour-pal-noche":[314.02,288.58,65.17,34],"tour-pal-hotel":[387.19,288.58,59,34],"tour-skip":[180,402.86,39.44,25],"tour-back":[509.91,399.86,58.13,31],"tour-next":[576.03,399.86,91.97,31]}},{"step":11,"lang":"es","c":{"tour-skip":[180,328.63,39.44,25],"tour-back":[513.41,325.63,58.13,31],"tour-done":[579.53,325.63,88.47,31]}},{"step":1,"lang":"en","c":{"lang-es":[180,283.2,240,62.55],"lang-en":[428,283.2,240,62.55],"tour-skip":[180,375.74,30.08,25],"tour-next":[604.42,372.74,63.58,31]}},{"step":2,"lang":"en","c":{"tour-back":[307.19,206.48,55.06,25],"tour-next":[368.25,206.48,66.02,25]}},{"step":3,"lang":"en","c":{"tour-back":[211.19,208.39,55.06,25],"tour-next":[272.25,208.39,66.02,25]}},{"step":4,"lang":"en","c":{"tour-back":[387.19,296.39,55.06,25],"tour-next":[448.25,296.39,66.02,25]}},{"step":5,"lang":"en","c":{"tour-back":[303.52,222.03,55.06,25],"tour-next":[364.58,222.03,66.02,25]}},{"step":6,"lang":"en","c":{"tour-back":[243.52,211.81,55.06,25],"tour-next":[304.58,211.81,66.02,25]}},{"step":7,"lang":"en","c":{"tour-back":[214.75,279.89,55.06,25],"tour-next":[275.81,279.89,66.02,25]}},{"step":8,"lang":"en","c":{"tour-back":[110.8,371.3,55.06,25],"tour-next":[171.86,371.3,66.02,25]}},{"step":9,"lang":"en","c":{"flow-agentville":[180,212.65,488,62.55],"flow-skill":[180,283.2,488,62.55],"flow-none":[180,353.74,488,62.55],"tour-skip":[180,446.29,30.08,25],"tour-back":[540.56,443.29,55.86,31],"tour-next":[604.42,443.29,63.58,31]}},{"step":10,"lang":"en","c":{"tour-everywhere":[180,220.52,38,22],"tour-pal-lobby":[180,288.58,122.42,34],"tour-pal-noche":[310.42,288.58,59.02,34],"tour-pal-hotel":[377.44,288.58,59,34],"tour-skip":[180,402.86,30.08,25],"tour-back":[540.56,399.86,55.86,31],"tour-next":[604.42,399.86,63.58,31]}},{"step":11,"lang":"en","c":{"tour-skip":[180,328.63,30.08,25],"tour-back":[538.86,325.63,55.86,31],"tour-done":[602.72,325.63,65.28,31]}}],"lines":[{"step":2,"lang":"es","n":2},{"step":3,"lang":"es","n":3},{"step":4,"lang":"es","n":3},{"step":5,"lang":"es","n":2},{"step":6,"lang":"es","n":4},{"step":7,"lang":"es","n":2},{"step":8,"lang":"es","n":4},{"step":2,"lang":"en","n":2},{"step":3,"lang":"en","n":3},{"step":4,"lang":"en","n":3},{"step":5,"lang":"en","n":2},{"step":6,"lang":"en","n":4},{"step":7,"lang":"en","n":2},{"step":8,"lang":"en","n":4}],"samples":[{"lang":"es","n":[["A",2],["Blog personal",2],["App de recetas",2],["Portafolio 2026",2],["Facturación electrónica",3],["Mi proyecto con un nombre bastante largo",3],["Ñandú & Compañía <beta>",3],["supercalifragilisticoespialidoso-sin-espacios-en-ningun-lado",4],["Un nombre de oficina muy largo para probar el ajuste de lineas en la burbuja, ok.",4],["Tienda online de ropa y accesorios para mascotas",3]]},{"lang":"en","n":[["A",2],["Blog personal",2],["App de recetas",2],["Portafolio 2026",2],["Facturación electrónica",3],["Mi proyecto con un nombre bastante largo",3],["Ñandú & Compañía <beta>",3],["supercalifragilisticoespialidoso-sin-espacios-en-ningun-lado",4],["Un nombre de oficina muy largo para probar el ajuste de lineas en la burbuja, ok.",4],["Tienda online de ropa y accesorios para mascotas",3]]}]}
// </generated>
// The English copy above reads Lead where the mock said Jefe (English is the primary language); same length, same layout.
// The guide above is named Gem in both languages, a shorter name than the mock's; the mock's line counts still hold.
// Step 8 above says R rejects and A opens the chat to approve (1.1.0: the pane never approves); still 4 lines in each language.

// The demo house the judge harness compares with the approved mock (export-mod.mjs builds the same options).
const NOW = Date.UTC(2026, 9, 18, 12)
// The mock's steps (its rects are numbered by them); the chat step came after it and is checked in tourplace.test.ts.
const STEPS: TourStep[] = ['lang', 'island', 'jefe', 'team', 'board', 'screen', 'lobby', 'despacho', 'flow', 'prefs', 'done']
const LANGS: Lang[] = ['es', 'en']
const demo = (lang: Lang): TourOverlayOpts[] => {
  const v = floorView(initialWorld(NOW), 0), tg = tourTargets(v, NOW), view = viewOf(rowsOf(v))
  const name = v.depts.find((d) => d.id === tg.focusId)?.name ?? ''
  return STEPS.map((step, i) => ({ step, n: i + 1, total: STEPS.length, lang, view, target: step in tg ? tg[step as 'island'] : null, name, flow: 'agentville', everywhere: false, palette: 'lobby', demoBanner: true }))
}

test('every step and language stays under the Svg limit with an 80-character office name and a page of 6 skills', () => {
  const name = 'Ñandú & <Compañía> "beta" '.repeat(4).slice(0, 80), skills = { names: ['review', 'deploy', 'lint', 'qa-pass', 'ship-it', 'a'.repeat(64), 'more'], page: 0, picked: 'lint' }
  for (const lang of LANGS) for (const o of [...demo(lang), { ...demo(lang)[7]!, step: 'chat' as const, target: null }]) { // chat: not in the mock
    const r = tourOverlay({ ...o, name, flow: 'skill', skills })
    expect([o.step, lang, r.svg.length < 131072]).toEqual([o.step, lang, true])
    expect(r.svg.includes(String.fromCharCode(0x2014))).toBe(false)
    expect(/<script|\son\w+=/i.test(r.svg)).toBe(false)
    if (o.step === 'island') expect(r.svg.includes('&lt;Compañía&gt; &quot;beta&quot;')).toBe(true)
  }
})

test('every overlay has an alt that names the step and what Gem says', () => {
  for (const lang of LANGS) for (const o of demo(lang)) {
    const r = tourOverlay(o)
    expect(r.alt.length > 0).toBe(true)
    expect([o.n, new RegExp(`\\b${o.n}\\b\\D+\\b${o.total}\\b`).test(r.alt) && r.alt.includes('Gem')]).toEqual([o.n, true])
  }
  expect(tourOverlay(demo('es')[2]!).alt.startsWith('Recorrido, paso 3 de 11: El Jefe. Gem: Este es el Jefe')).toBe(true)
})

// The mock drew the demo's offices on 8-tile columns; the even grid (layout spec) moves each one right by dx tiles, and
// a step aimed at an office moves its bubble with it, by P(dx, 0) in map units. The office each step aims at (team:
// Recetas, whose helpers are at their desks) and how far it moved.
const movedBy = (v: AgentvilleWorld, step: string): [number, number] => {
  const d = v.depts.find((x) => x.id === (step === 'team' ? 'recetas' : 'tienda'))!, dx = ['island', 'jefe', 'team', 'board', 'screen'].includes(step) ? d.room[0]! - 8 * (d.slot ?? 0) : 0
  return [16 * dx, 8 * dx]
}

test('hit rects match the mock\'s controls within 1 CSS px, same keys, every step and language', () => {
  const v = floorView(initialWorld(NOW), 0)
  for (const lang of LANGS) for (const o of demo(lang)) {
    const [mx, my] = movedBy(v, o.step)
    const want = Object.fromEntries(Object.entries(MOCK.rects.find((r) => r.lang === lang && r.step === o.n)!.c).map(([k, r]) => [k, [r[0]! + mx, r[1]! + my, r[2]!, r[3]!]]))
    const got = Object.fromEntries(tourOverlay(o).hits.map((ht) => [ht.key, [ht.x0 * o.view.w, ht.y0 * o.view.ht, (ht.x1 - ht.x0) * o.view.w, (ht.y1 - ht.y0) * o.view.ht]]))
    expect([o.n, lang, Object.keys(got).sort()]).toEqual([o.n, lang, Object.keys(want).sort()])
    for (const [k, r] of Object.entries(want)) {
      const off = Math.max(...r.map((v, i) => Math.abs(v - got[k]![i]!)))
      expect([o.n, lang, k, off <= 1]).toEqual([o.n, lang, k, true])
    }
  }
})

test('skill tiles, the pager and the other palettes get hit rects inside the modal, apart from each other', () => {
  const o = demo('es'), names = Array.from({ length: 8 }, (_, i) => `skill-${i}`)
  const flow = tourOverlay({ ...o[8]!, flow: 'skill', skills: { names, page: 1 } }).hits.map((ht) => ht.key)
  expect(flow).toEqual(expect.arrayContaining(['skill-skill-6', 'skill-skill-7', 'skills-prev', 'flow-skill', 'tour-next']))
  expect(flow.includes('skills-more')).toBe(false)
  const prefs = tourOverlay({ ...o[9]!, palette: 'hotel' }).hits
  const pal = prefs.filter((ht) => ht.key.startsWith('tour-pal-')).sort((a, b) => a.x0 - b.x0)
  expect(pal.map((ht) => ht.key)).toEqual(['tour-pal-lobby', 'tour-pal-noche', 'tour-pal-hotel'])
  for (let i = 1; i < pal.length; i++) expect(pal[i]!.x0 >= pal[i - 1]!.x1).toBe(true)
  for (const ht of [...prefs, ...tourOverlay({ ...o[8]!, flow: 'skill', skills: { names, page: 0 } }).hits]) expect(0 <= ht.x0 && ht.x0 < ht.x1 && ht.x1 <= 1 && 0 <= ht.y0 && ht.y0 < ht.y1 && ht.y1 <= 1).toBe(true)
})

test('the wrap model breaks lines where Chrome does: 22 bubble texts and 10 office names', () => {
  for (const { step, lang, n } of MOCK.lines) {
    const c = tourCopy(lang as Lang), text = `${c.guide}: ${c.s[step - 1]!.say}`
    expect([step, lang, wrapLines(text, 320, c.guide.length + 1).length]).toEqual([step, lang, n])
  }
  for (const { lang, n } of MOCK.samples) for (const [name, lines] of n) {
    const c = tourCopy(lang as Lang, name as string), text = `${c.guide}: ${c.s[1]!.say}`
    expect([lang, name, wrapLines(text, 320, c.guide.length + 1).length]).toEqual([lang, name, lines])
  }
})

test('the copy is the mock\'s, and the layout was measured with it', () => {
  for (const lang of LANGS) {
    expect(tourCopy(lang)).toEqual(MOCK.T[lang] as unknown as ReturnType<typeof tourCopy>)
    expect(copyHash(JSON.stringify(tourCopy(lang)))).toBe(TOUR_LAYOUT.copyHash[lang])
  }
})


test('every modal variant fits the stage, the ones with a picked skill too; a pick keeps the same controls and names the skill', () => {
  // every variant as the overlay draws it: the steps, each palette, and the skill pages with and without a pick
  for (const lang of LANGS) {
    const o = demo(lang), all = [...o, ...(['noche', 'hotel'] as const).map(palette => ({ ...o[9]!, palette }))]
    for (const n of [0, 3, 6, 8]) for (const page of [0, 1]) for (const picked of [undefined, 'sk1']) all.push({ ...o[8]!, flow: 'skill', skills: { names: Array.from({ length: n }, (_, i) => `sk${i}`), page, picked } })
    for (const x of all) for (const ht of tourOverlay(x).hits) expect([lang, x.step, ht.key, ht.y0 >= 0 && ht.y1 <= 1]).toEqual([lang, x.step, ht.key, true])
  }
  for (const n of [3, 6, 8]) {
    const names = Array.from({ length: n }, (_, i) => `sk${i}`), o = demo('en')[8]!
    const plain = tourOverlay({ ...o, flow: 'skill', skills: { names, page: 0 } }), picked = tourOverlay({ ...o, flow: 'skill', skills: { names, page: 0, picked: 'sk1' } })
    expect(picked.hits.map(x => x.key)).toEqual(plain.hits.map(x => x.key))
    const m = TOUR_LAYOUT.lang.en.modal[n > 6 ? 'flow-s2pk' : n > 3 ? 'flow-s2k' : 'flow-s1k']!, next = picked.hits.find(x => x.key === 'tour-next')!
    expect(Math.abs(next.y0 * o.view.ht - (o.view.ht * 0.52 - m.h / 2 + m.c['tour-next']![1])) < 0.5).toBe(true) // at the measured place
    expect(picked.svg.includes('data-picked="1">Picked: sk1</p>')).toBe(true)
    expect(plain.svg.includes('data-picked')).toBe(false)
  }
})

// A quote left open in an attribute makes the Svg invalid XML and the desktop shows its alt text instead (the chat
// step's row once did). The test kit has no XML parser: take every tag, drop its well-formed ="..." pairs, no quote may remain.
const quotesBalanced = (svg: string) => [...svg.matchAll(/<[a-zA-Z][^<>]*>/g)].every((m) => !m[0].replace(/="[^"]*"/g, '').includes('"'))

test('every step, in both languages and on a 1-row and a 3-row map, stays under the cap and its tags have balanced quotes', () => {
  const name = 'Ñandú & <Compañía> "beta"'
  for (const lang of LANGS) for (const o of demo(lang)) for (const step of TOUR_STEP_IDS) for (const rows of [1, 3]) {
    const r = tourOverlay({ ...o, step, name, view: viewOf(rows), target: step === o.step ? o.target : null })
    expect([step, lang, rows, r.svg.length < 131072, quotesBalanced(r.svg)]).toEqual([step, lang, rows, true, true])
  }
})
