import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { chatFrom, imagesOf, pushChat, newBeat } from '../hooks/beat'
import type { Beat } from '../hooks/beat'
import { getLang, setLang, t } from '../hooks/i18n'

// These tests read the Spanish copy; English is the default, so the file sets Spanish first.
setLang('es')

// Pictures and files a session sends with SendUserFile show in the pane as a Claude bubble.
const send = (input: unknown, name = 'SendUserFile', extra: unknown[] = []) => ({ type: 'assistant', content: [...extra, { type: 'tool_use', name, input }] })

test('AC1-2: a SendUserFile picture is a Claude row with its caption; another tool is not', () => {
  const row = send({ files: ['/a/roadmap.png'], caption: 'Roadmap', status: 'proactive' })
  expect(chatFrom(row)).toEqual({ who: 'claude', text: 'Roadmap' })
  expect(imagesOf(row)).toEqual([{ path: '/a/roadmap.png' }])
  const mcp = send({ files: ['/a/roadmap.png'], caption: 'Roadmap' }, 'mcp__x__SendUserFile')
  expect([chatFrom(mcp), imagesOf(mcp)]).toEqual([{ who: 'claude', text: 'Roadmap' }, [{ path: '/a/roadmap.png' }]])
  for (const name of ['Read', 'SendUserFileX', 'xSendUserFile', 'mcp__x__Other']) {
    const other = send({ files: ['/a/roadmap.png'], caption: 'Roadmap' }, name)
    expect([name, imagesOf(other), chatFrom(other)]).toEqual([name, [], null])
  }
  // a user row never carries a send
  expect(imagesOf({ type: 'user', content: [{ type: 'tool_use', name: 'SendUserFile', input: { files: ['/a/x.png'] } }] })).toEqual([])
})

test('AC3: only sane image paths, case-insensitive, 3 at most; a malformed input never throws', () => {
  const files = ['/a/1.PNG', '/a/2.jpg', '/a/3.JPEG', '/a/4.gif', '/a/5.webp', '/a/6.pdf', 7, null, '', `/${'x'.repeat(1024)}.png`, '/a/b\n.png', '/a/b\0.png']
  expect(imagesOf(send({ files }))).toEqual([{ path: '/a/1.PNG' }, { path: '/a/2.jpg' }, { path: '/a/3.JPEG' }])
  expect(imagesOf(send({ files: ['/a/4.gif', '/a/5.webp'] }))).toEqual([{ path: '/a/4.gif' }, { path: '/a/5.webp' }])
  for (const input of [undefined, null, 'x', 3, {}, { files: 'x.png' }, { files: { 0: 'x.png' } }]) {
    expect(imagesOf(send(input))).toEqual([])
    expect(chatFrom(send(input))).toBe(null)
  }
})

test('AC4: caption plus a line per non-image file; names when empty; redacted and capped; text blocks join', () => {
  expect(chatFrom(send({ files: ['/a/x.png', '/a/informe.pdf', 'docs/tabla.csv'], caption: 'Mira' }))).toEqual({ who: 'claude', text: 'Mira\nArchivo: informe.pdf\nArchivo: tabla.csv' })
  expect(chatFrom(send({ files: ['/a/informe.pdf'] }))).toEqual({ who: 'claude', text: 'Archivo: informe.pdf' })
  expect(chatFrom(send({ files: ['/a/carpeta/'] }))).toEqual({ who: 'claude', text: 'Archivo: carpeta' }) // a trailing slash keeps the name
  const was = getLang()
  try { setLang('en'); expect(chatFrom(send({ files: ['/a/informe.pdf'] }))!.text).toBe('File: informe.pdf') } finally { setLang(was) }
  // two caption-less sends in a row stay two bubbles
  const b: Beat = newBeat('d', 'x', 0)
  pushChat(b, chatFrom(send({ files: ['/a/uno.png', '/a/dos.jpg'] }))!)
  pushChat(b, chatFrom(send({ files: ['/a/tres.png'] }))!)
  expect(b.chat!.map(c => c.text)).toEqual(['uno.png, dos.jpg', 'tres.png'])
  expect(chatFrom(send({ files: ['/a/x.png'], caption: `token=${'abc123'.repeat(2)}` }))!.text).toBe('token=•••')
  const long = chatFrom(send({ files: ['/a/x.png'], caption: 'y'.repeat(3000) }))!.text
  expect([long.length, long.endsWith('…')]).toEqual([1500, true])
  expect(chatFrom(send({ files: ['/a/x.png'], caption: 'El mapa' }, 'SendUserFile', [{ type: 'text', text: 'Te lo envío.' }]))).toEqual({ who: 'claude', text: 'Te lo envío.\n\nEl mapa' })
})

test('AC5 and AC7: a relative path stays relative in the row; the chat.file key in both languages', () => {
  expect(imagesOf(send({ files: ['docs/x.png'] }))).toEqual([{ path: 'docs/x.png' }])
  expect([t('chat.file', { name: 'a.pdf' }, 'es'), t('chat.file', { name: 'a.pdf' }, 'en')]).toEqual(['Archivo: a.pdf', 'File: a.pdf'])
})

// ---- AC5-6: the pane, through session.append, with sips there or not ----
const HOME = '/home/test/.claude/agentville', CWD = '/home/test/proj'
function serve(on: On, sips: boolean) {
  const cwd = { broken: false } // set to make $.session.cwd throw
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => { if (cwd.broken) throw new Error('no cwd'); return { value: CWD } })
  on('session.surfaces', () => ({ value: [] }))
  on('session.id', () => ({ value: 's-test' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.toast', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/test' }))
  const store: Record<string, unknown> = { 'intro-done': true, lang: 'es' }
  on('store.set', ($, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.delete', ($, e) => { delete store[e.key]; return { value: undefined } })
  const ran: (readonly string[])[] = []
  on('process.run', ($, e) => {
    ran.push(e.argv)
    const ok = sips && e.argv[0] === '/usr/bin/sips'
    return { value: { exitCode: ok ? 0 : 1, stdout: ok ? '  pixelWidth: 10\n  pixelHeight: 8\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', () => ({ value: [] }))
  const files: Record<string, string> = {}
  on('fs.write', ($, e) => { files[String(e.path)] = String(e.text); return { value: undefined } })
  on('fs.exists', ($, e) => ({ value: String(e.path) in files }))
  on('fs.read', ($, e) => ({ value: e.as === 'bytes' ? { base64: 'QUJD' } : files[String(e.path)] ?? '' }))
  // sips is there when asked; the pictures sent are regular image files
  on('fs.stat', ($, e) => { if ((e.path === '/usr/bin/sips' && sips) || /\.png$/.test(e.path)) return { value: { kind: 'file' as const, size: 1000, mtimeMs: 0, isLink: false } }; throw new Error('ENOENT') })
  return { ran, files, cwd }
}
const append = ($: Engine, message: unknown) => $.session.append({ message: message as never, door: 'response' as never, origin: { kind: 'repl' } as never, uuid: 'a1' })
const lastChat = (files: Record<string, string>) => (JSON.parse(files[`${HOME}/sessions/s-test.json`]!) as Beat).chat?.at(-1)
const thumbs = (ran: (readonly string[])[]) => ran.filter(a => a[0] === '/usr/bin/sips' && a[1] === '-Z')

for (const sips of [true, false]) {
  test(`AC6: a sent picture reaches the chat ${sips ? 'with its thumbnail, the path as an argv element' : 'without a thumbnail when sips is absent'}`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const { ran, files } = serve(on, sips)
    await $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
    await append($, send({ files: ['/a/roadmap.png'], caption: 'Roadmap', status: 'proactive' }))
    const runs = thumbs(ran), row = lastChat(files)
    expect([row?.who, row?.text]).toEqual(['claude', 'Roadmap'])
    if (!sips) {
      expect([runs, row?.pics]).toEqual([[], undefined])
      return
    }
    expect(runs).toHaveLength(1)
    expect(runs[0]![9]).toBe('/a/roadmap.png') // its own argv element, read in place
    expect(row?.pics?.map(p => p.orig)).toEqual(['/a/roadmap.png'])
    // AC5: a relative path is read from the session's folder
    await append($, send({ files: ['docs/x.png'] }))
    expect(thumbs(ran).at(-1)![9]).toBe(`${CWD}/docs/x.png`)
    expect(lastChat(files)?.pics?.map(p => p.orig)).toEqual([`${CWD}/docs/x.png`])
  })
}

test('a plain text row still lands in the chat; a failing cwd never blocks a row, and its relative picture is refused', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const { ran, files, cwd } = serve(on, true)
  await $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
  cwd.broken = true
  await append($, { type: 'assistant', content: [{ type: 'text', text: 'Hecho.' }] })
  expect(lastChat(files)).toEqual({ who: 'claude', text: 'Hecho.' })
  await append($, send({ files: ['docs/x.png'], caption: 'Relativa' }))
  const row = lastChat(files)
  expect([row?.text, row?.pics, thumbs(ran)]).toEqual(['Relativa', undefined, []])
})
