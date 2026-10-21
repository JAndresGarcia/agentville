import { atom, read, update } from 'claude-code'
const PROBE_ROOT = "/probe"
import type { EngineInterface, Register, UiCopyArgs, UiCopyResult, UiPressArgument } from 'claude-code'
import type { AgentvilleChat, AgentvilleDept, AgentvilleReply, AgentvilleUsage, AgentvilleWorld } from '../types'
import { CMD_MAX, DISMISS, cmdTitle, isHiddenCmd, isImg, isToolCall, MAIN, METAS_MAX, SLEEP_MS, asksFrom, pressTitle, closedOk, closingsFrom, fillTextOf, isIdle, addSaid, addStep, asCommand, guardedCommand, guardedPath, HOLD_MS, isCutCmd, isMaskedCmd, trusted, TASK, offerOrderOk, beatsDir, carryOver, chatOfTranscript, claimSlot, imagesOf, bgFrom, chatFrom, commandsFile, controlFile, doing, endStep, isTaskList, metasOf, newBeat, notesFrom, openOf, pending, pushChat, roleOf, setAgent, titleFrom, viewerFile, OFFER_TTL, REFUSED, asksOfTranscript, asPrompt, signOf, chatPic, picHt } from './beat'
import type { Beat, ChatPic, Cmd, CmdRow, ImgRef, Closing } from './beat'
import { blocksOf, foldBlocks } from './rich'
import type { Block, Run } from './rich'
import { PALETTES, PALETTE_KEY, STATE_COLORS, paletteOf, planIcon, progressBar, tint } from './look'
import { LANG_KEY, getLang, langOf, setLang, t } from './i18n'
import { TOUR_PALS, SKILLS_PER_PAGE, tourOverlay } from './tour'
import { CHAT_LINES, CHAT_W, COVER, btnsElements } from './btns'
import { ageSvg, bannerSvg, btnSvg, notesCard, stripSvg, textW, toggleSvg, type Pic, type PillRect } from './chrome'
import type { BtnItem, BtnsProps } from './btns'
import { bandEls, bandProps, bandsOf, stripBand } from './bandhits'
import type { Band, BandZone } from './bandhits'
import type { TourRect, TourStep } from './scene'
import { RELINK_EVERY, RELINK_FAST, RELINK_FRESH, RELINK_QUIET, RELINK_TRIES, SEP, chatUrl, ownLocal, parentLink, relinkGrep, relinkHits, sessionsFind, spawnedOf, diskColor, dueToMeasure, lockFree, parseDf, parseDu, parseRegistry, parseSessions, rankWorktrees, RECORD_MAX, recordOf } from './disk'
import type { Worktree } from './disk'
import type { Detail, DiskView, Zone } from './scene'
import { SYNC_EVERY, diskRootOf, isMod, syncKey, versionOf } from './sync'
import type { Disk } from './sync'
import { CLOSE_W, PROD_KIND, kindOf, around, closeGlyphAt, padded, within, cardCloseGlyph, cardPart, cardRect, notesTop, DISK_INK, diskTop, TOUR_STEP_IDS, tourSteps, tourTargets, cardOver, ctxColor, hqTop, isLive, officeTop, mapStrip, toolsLabel, toolsOf, usd, roleName, ROLE_ORDER, SHIRTS, STATES, agentName, chipSvg, faceSvg, tabsSvg, floorView, floorsOf, viewOf, zoneGrid, GRID_MAX, agentsLayer, selectionLayer, vectorPeople, svgUse, emptyWorld, furnitureLayer, hotspots, houseLayer, worldFromBeats, drawnSig, EDGE_EPS } from './scene'
import {
  keyOf, ACK_WAIT, OFFERS_DONE, marksOf, OFFER_ACKS, ACK_KEEP, ACK_RS, ARCHIVE_TOOL, CONSENT, hasItem, waitPatch,
  unwait, dropOffers, INTRO, HIDDEN_KEY, MAILBOX_KEY, isReload, withImages, EVERYWHERE, PERSON_ONLY, FLOW_KEY,
  skillName, flowOf, flowRule, FLOW_MIGRATED, RELAY_RULE, relayOf, saidOf, APP_DIR, deptNameIn, starterIn, aborted,
  FILL_TOASTS, dozing, OUTBOX_TTL, takenOf, tookOut, inClient, PAD,
  CELL_PX, mapPx, MAP_MAX_PX, mapDrawPx, kTok, bandCount, FILL, WIDE_FILL, GLOW, ACCENT, BTN_GLOW, CODE_INK,
  CODE_BG, BUBBLE_INK, TABLE_HEAD, BUBBLE_FADED, CHAT_ROWS, LONG, TREE_LIMIT, CLIENT_MAX, clientsIn, PAGE_CHARS,
  PAGE_NODES, PAGE_DEPTH, pageOf, pageFits, HITS_KEEP, METER_MS, STEPS, noSteps, detailOf, RENDER_LOG,
  VECTOR_PEOPLE, SVG_USE, PLAN_ASK, NOTE_CALM, IDLE_MAX, INDENT, ROW_H, FACE_W, FACE_H, HEAD_H, MORE_H, LIST_HIT,
  LIST_MAX, upIn, TOUR_KEY, TOUR_SKIP, tourOf, TOUR_KEYS, FIELD_ELS, FIELD_MENU_ELS, floorOfAgent, RENDER_GAP,
  HEAVY_KB, usable, dim, HOLD_SAY, VIEWER_FRESH, PANE_ROWS, REQ_AT, PIC_H, PIC_GAP, PIC_HITS, THUMB,
  ATTACHED_THUMB, PIC_CHARS, PASTE_MAX, pasteText, IMAGES, SIPS, IMG_MAX, px, STRIP, ZOOM_BUDGET, STAFF, NO_MAP,
  DAY, WEEK, ALIVE_EVERY, DISK_KEY, DISK_LOCK, SLOW, GB, gbOf, sizeOf, judged,
} from './pure'
import type { AckR, OfferAck, Tour, FillR, SubOut, Act, Elsewhere, Out, Step, Fam, Grp, DiskCache } from './pure'
export {
  keyOf, ACK_WAIT, ARCHIVE_TOOL, CONSENT, hasItem, waitPatch, unwait, dropOffers, INTRO, HIDDEN_KEY, isReload,
  withImages, EVERYWHERE, PERSON_ONLY, FLOW_KEY, skillName, flowRule, RELAY_RULE, relayOf, saidOf, APP_DIR,
  deptNameIn, starterIn, aborted, dozing, OUTBOX_TTL, takenOf, tookOut, inClient, CELL_PX, BAND_PX, mapPx,
  CARD_REF_PX, MAP_MAX_PX, mapDrawPx, kTok, bandCount, CLIENT_MAX, PAGE_CHARS, PAGE_NODES, PAGE_DEPTH, pageOf,
  pageFits, ROW_H, LIST_MAX, RENDER_GAP, HEAVY_KB, PANE_ROWS,
} from './pure'
export type { AckR, Tour, FillR, SubOut, Act, Elsewhere, Out, Page } from './pure'
// The pane's request id, written here where its hooks' filters name it.
const PANE = 'agentville'
// The pane's state: declared here, beside every read and update of it through `$`.
const world = atom({ plugin: 'agentville', key: 'world' } as const, null)
const selected = atom({ plugin: 'agentville', key: 'selected' } as const, '')
const floorAtom = atom({ plugin: 'agentville', key: 'floor' } as const, 0)
const tabAtom = atom({ plugin: 'agentville', key: 'tab' } as const, 'conv')
// Requests answered from this pane: hidden from the banner and the cards until a sync shows the session let them go,
// so a second press never sends a second order. Pruned on every render.
export const answered = new Set<string>()
// Questions answered and suggested sessions started or dismissed from this pane ("q:<wrap_up id>", "o:<task id>"): a
// second press sends nothing. Each keeps its press time: the item hides until its Jefe ends a turn after the press (then
// it shows again: the session or the app did not take it). Pruned on every render.
export const sentItems = new Map<string, number>()
// Descartar and Arrancar (`fill`) presses on another session's suggestion, sent as an order and waiting for its ack (task
// id -> the order's `n`, when it left, its title for the toasts), checked by the pane's ticker; ACK_WAIT without an
// answer falls back. `filling` holds an Arrancar press until its order is in `remote`, so two presses send one order.
// A held command's fill (holdCommand) waits here too, keyed `text:<session>`: `text` the field's whole text, `cmd` its
// `/name`, `surface` where its fallback copy goes.
export type Remote = { n: number; at: number; title: string; dept: string; fill?: true; text?: string; cmd?: string; surface?: UiCopyArgs['surface'] }
export const remote = new Map<string, Remote>()
export const filling = new Set<string>()
// Suggestions whose session did not take a press (no answer, a failure, an unexpected reply, or asleep): their note says
// "↗ Ir al chat". Pruned on every render.
export const elsewhere = new Set<string>()
export async function doneOffers($: EngineInterface): Promise<Record<string, number>> {
  return marksOf(await $.store.get(OFFERS_DONE).catch(() => null))
}
/** Writes `marks` back under `key`, less those past OFFER_TTL, with task id `id` marked now or, `drop`, unmarked. */
async function putMark($: EngineInterface, key: string, marks: Record<string, number>, id: string, drop = false) {
  const now = await $.clock.now()
  await $.store.set(key, Object.fromEntries([...Object.entries(marks).filter(([k, at]) => k !== id && now - at < OFFER_TTL), ...(drop ? [] : [[id, now]])]))
}
/** Marks a suggested session started or dismissed (task id) in the shared store, dropping marks past OFFER_TTL. */
export async function offerDone($: EngineInterface, id: string) { return putMark($, OFFERS_DONE, await doneOffers($), id) }
export async function offerAcks($: EngineInterface): Promise<Record<string, OfferAck>> {
  const v = await $.store.get(OFFER_ACKS).catch(() => null)
  return Object.fromEntries(Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}).filter((e): e is [string, OfferAck] => {
    const x = e[1] as Partial<OfferAck> | null
    return !!x && typeof x === 'object' && typeof x.n === 'number' && typeof x.at === 'number' && ACK_RS.includes(x.r) && (x.why === undefined || typeof x.why === 'string')
  }))
}
/** Writes this session's answer to a dismiss order, dropping acks past ACK_KEEP. */
export async function ackOffer($: EngineInterface, id: string, a: Omit<OfferAck, 'at'>) {
  const now = await $.clock.now(), all = await offerAcks($)
  await $.store.set(OFFER_ACKS, Object.fromEntries([...Object.entries(all).filter(([k, x]) => k !== id && now - x.at < ACK_KEEP), [id, { ...a, at: now }]]))
}
// Start and dismiss calls this session made, by tool_use id, until their results come back (closingsFrom).
export const closing = new Map<string, [id: string, kind: Closing]>()
let toolNames: { at: number; names: string[] } | null = null
export async function toolsNow($: EngineInterface, now: number) {
  if (!toolNames || now - toolNames.at > 60000) toolNames = { at: now, names: (await $.tool.list().catch(() => [])).map(x => x.name) }
  return toolNames.names
}
export async function home($: EngineInterface) { return (await $.env.get('HOME')) ?? '' }
export async function readJson($: EngineInterface, path: string): Promise<T | null> {
  try { return JSON.parse(await $.fs.read(path)) as T } catch { return null }
}
// A mailbox's orders; a missing or malformed file has none.
export async function ordersAt($: EngineInterface, path: string): Promise<unknown[]> {
  const cmds = (await readJson($, path))?.cmds
  return Array.isArray(cmds) ? cmds : []
}
export async function hiddenOf($: EngineInterface): Promise<Record<string, number>> {
  const v = await $.store.get(HIDDEN_KEY).catch(() => null)
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number')) : {}
}
// The pane reads every live session's transcript itself: its title, and for a session on an older copy of the mod (a
// beat with no `mod`) its question and suggested sessions. Found once per id (looked for again every 30 s while
// missing), looked at at most every 3 s (every 30 s when only its title is needed), read (its last 400 KB, argv only) only when its size or time changed.
type Transcript = { path: string | null; at: number; sig: string; name: string | null; asks: Pick<Beat, 'ask' | 'offers'> | null }
export const transcripts = new Map<string, Transcript>()
export async function transcriptOf($: EngineInterface, b: Beat, now: number) {
  if (!/^[0-9a-f-]{36}$/.test(b.id)) return null // only a session id goes into a path
  let s = transcripts.get(b.id)
  if (s && now - s.at < (s.path && !isMod(b.mod) ? 3000 : 30000)) return s
  if (!s?.path) {
    const dir = `${await home($)}/.claude/projects`
    let path: string | null = null
    for (const d of await $.fs.list(dir).catch(() => [])) {
      if (d.kind === 'dir' && (await $.fs.exists(`${dir}/${d.name}/${b.id}.jsonl`).catch(() => false))) { path = `${dir}/${d.name}/${b.id}.jsonl`; break }
    }
    transcripts.set(b.id, (s = { path, at: now, sig: '', name: null, asks: null }))
    if (!path) return s
  }
  s.at = now
  const st = await $.fs.stat(s.path!).catch(() => null), sig = st ? `${st.size}:${st.mtimeMs}` : ''
  if (!st || sig === s.sig) return s
  const tail = await tailOf($, s.path!)
  Object.assign(s, { sig, name: titleFrom(tail), asks: isMod(b.mod) ? null : asksOfTranscript(tail, { ask: b.ask, offers: b.offers }, st.size > 400000) })
  return s
}
// Archived chats leave the map and the list: the app keeps an archived chat's record where it was and sets its
// `isArchived`. The ticker looks at the records of the sessions it knows by record id that would be live but for that
// (one find, then reads 6 at a time, argv only) at most once a minute, so an unarchived one comes back on the next
// look. A failed find or read, or a record cut short with no flag, keeps the last answer; a record a clean find no
// longer lists is not archived. readBeats marks the archived ones, so every reader of this module skips them.
const ARCHIVED_EVERY = 60000, ARCHIVED_MAX = 60
export let archivedAt = -Infinity, archivedIds = new Set<string>()
export async function lookArchived($: EngineInterface, beats: Beat[], now: number) {
  if (now - archivedAt < ARCHIVED_EVERY) return
  archivedAt = now
  const all = [...new Set(beats.flatMap(b => (isLive({ ...b, archived: undefined }, now) && chatUrl(b.local) ? [b.local!] : [])))]
  // shortcut: ARCHIVED_MAX records a look keep the find's argv short; past that many live sessions the rest keep their
  // last answer. Rotate them if that ever happens.
  const ids = all.slice(0, ARCHIVED_MAX)
  const app = APP_DIR(await home($)), r = ids.length ? await $.process.run(sessionsFind(app, ids), { timeoutMs: 5000 }).catch(() => null) : null
  if (ids.length && !r) return
  const found = r?.stdout.split('\n') ?? [], next = new Set(all.slice(ARCHIVED_MAX).filter(id => archivedIds.has(id)))
  for (let i = 0; i < ids.length; i += 6) {
    await Promise.all(ids.slice(i, i + 6).map(async id => {
      const f = found.find(p => p.startsWith(`${app}/claude-code-sessions/`) && p.endsWith(`/${id}.json`)), rec = f ? await record($, f) : null
      if (typeof rec?.isArchived === 'boolean' ? rec.isArchived : (f || r?.exitCode !== 0) && archivedIds.has(id)) next.add(id)
    }))
  }
  archivedIds = next
}
export async function readKey($: EngineInterface) {
  const had = await $.store.get(MAILBOX_KEY)
  return typeof had === 'string' && had ? had : null
}

// Puts an order in a session's mailbox. Only the pane writes mailboxes, so a read-modify-write is safe.
export async function order($: EngineInterface, sessionId: string, cmd: Omit<Cmd, 'n' | 'sig'>): Promise<number> {
  let key = await readKey($)
  if (!key) { key = crypto.randomUUID(); await $.store.set(MAILBOX_KEY, key) }
  const path = controlFile(await home($), sessionId)
  await ensureRoot($)
  const signed = { ...cmd, n: (await $.clock.now()) * 1000 + Math.floor(Math.random() * 1000) }
  await $.fs.write(path, JSON.stringify({ cmds: [...(await ordersAt($, path)), { ...signed, sig: await signOf(key, signed, sessionId) }].slice(-30) }))
  return signed.n
}

// A pane's dismiss order on a suggested session this session offered: it calls the app's tool as itself, with the task
// id the order carries and the fixed consent words (never anything a model wrote), and answers in offer-acks. A fill
// order writes Arrancar's line into this session's own empty prompt box (fillStart). A start order (an older pane) calls
// nothing and acks gone. One call per task id at a time.
export const offerCalls = new Set<string>()
export async function fillBox($: EngineInterface, text: string): Promise<FillR> {
  try {
    const box = (await $.prompt.read()).text
    if (box !== '') return box === text ? 'ready' : 'busy'
    return (await $.prompt.fill({ text, mode: 'append' })).isFilled ? 'filled' : 'failed'
  } catch { return 'failed' }
}
export async function deliver($: EngineInterface, text: string) {
  if (isReload(text)) return
  const run = asCommand(text, (await $.command.list()).map(c => c.name))
  if (run) await $.command.run(run)
  else await $.prompt.submit({ text: asPrompt(text), asUser: true }) // a path or an unknown /word: text
}
// A msg order from the mailbox, signed or not, is only ever a prompt: a `/command` in it reaches the model as text
// (asPrompt) and never runs, so even a stolen key cannot run one in this session (SECURITY.md). An older pane's
// /reload-plugins is dropped.
export async function submitOrder($: EngineInterface, text: string) { if (!isReload(text)) await $.prompt.submit({ text: asPrompt(text), asUser: true }) }
// A process's stdout when it exits 0, else null. Argv only.
export function out($: EngineInterface, argv: string[]) { return $.process.run(argv).then(r => (r.exitCode === 0 ? r.stdout : null), () => null) }
export async function record($: EngineInterface, path: string) {
  const r = await $.process.run(['/usr/bin/head', '-c', String(RECORD_MAX), path], { timeoutMs: 5000 }).catch(() => null)
  return r?.exitCode === 0 ? recordOf(r.stdout) : null
}
// Made private before anything is written into it, once per module (a folder made earlier with 755 is fixed too).
let rootReady: Promise<unknown> | null = null
export function ensureRoot($: EngineInterface) { return (rootReady ??= (async () => {
  const root = `${await home($)}/.claude/agentville`
  await $.process.run(['/bin/mkdir', '-p', '-m', '700', root]).catch(() => null)
  await $.process.run(['/bin/chmod', '700', root]).catch(() => null)
})()) }
export async function flowNow($: EngineInterface, option: string | undefined) {
  let stored = await $.store.get(FLOW_KEY).catch(() => undefined)
  if (stored === undefined && !(await $.store.get(FLOW_MIGRATED).catch(() => true))) {
    if (await usedBefore($)) await $.store.set(FLOW_KEY, (stored = { kind: 'agentville' }))
    await $.store.set(FLOW_MIGRATED, true)
  }
  return flowOf(stored, option)
}
async function usedBefore($: EngineInterface) {
  for (const k of [INTRO, MAILBOX_KEY, HIDDEN_KEY]) if ((await $.store.get(k).catch(() => undefined)) !== undefined) return true
  const dir = beatsDir(await home($))
  for (const f of await $.fs.list(dir).catch(() => [])) {
    if (!f.name.endsWith('.json')) continue
    const b = await $.fs.read(`${dir}/${f.name}`).then(t => JSON.parse(t) as Partial<Beat>, () => null)
    if (b && typeof b === 'object' && typeof b.id === 'string' && b.mod === undefined) return true
  }
  return false
}
// Messages relayed to a subagent: drawn in its conversation as "Tú → <name> (en camino)" from the send until it writes
// a newer row (its words differ from those at the send, `base`), its state changes after the send (`since`, so words
// repeated as they were still count) or OUTBOX_TTL passes; the last 5 per subagent.
export const subOutbox = new Map<string, { text: string; base: string; at: number }[]>()
export function queueSub($: EngineInterface, out: SubOut) {
  if (!out) return
  subOutbox.set(out.agent, [...(subOutbox.get(out.agent) ?? []), out.o].slice(-5))
  $.ui.invalidate('ui.render')
}
export const acts = new Map<string, Act>()
export function failed($: EngineInterface, err: unknown) { return $.ui.toast(t('toast.orderFailed', { err: err instanceof Error ? err.message : String(err) }).slice(0, 160)) }
// Orders go to the session's mailbox; the toast says it left, the session acts within a couple of seconds.
export function sendOrder($: EngineInterface, sessionId: string, cmd: Omit<Cmd, 'n' | 'sig'>, toast: string, done?: (ok: boolean) => void) { return order($, sessionId, cmd).then(() => { done?.(true); return $.ui.toast(toast) }, (err: unknown) => { done?.(false); return failed($, err) }) }
// What a tool call from the pane came to: done; declined (a hook or you said no) or stopped (aborted: Esc on the app's
// dialog), after which nothing else is tried; or failed (no such tool, an error, the app's refusal), where the prompt
// may go instead. The app's own session tools (mcp__ccd_session*) win over a same-named one.
type ToolEnd = { done: true; text: string } | { declined: string } | { stopped: true } | { failed: true }
export async function callTool($: EngineInterface, re: RegExp, input: Record<string, string>, consent: string): Promise<ToolEnd> {
  const names = await toolsNow($, await $.clock.now()), tool = names.find(n => n.startsWith('mcp__ccd_session') && re.test(n)) ?? names.find(n => re.test(n))
  if (!tool) return { failed: true }
  let r: Awaited<ReturnType<EngineInterface['tool']['call']>>
  // An aborted call (Esc or a closed dialog) stops; any other rejection (the tool gone since the list was read) may fall back.
  try { r = await $.tool.call({ tool, consent, ...input } as Parameters<EngineInterface['tool']['call']>[0]) } catch (err) {
    return aborted(err) ? { stopped: true } : { failed: true }
  }
  if ('deny' in r && typeof r.deny === 'string') return { declined: r.deny.slice(0, 120) }
  return !r.isError && !REFUSED.test((r.text ?? '').trimStart()) ? { done: true, text: r.text ?? '' } : { failed: true }
}
export function fillToast($: EngineInterface, r: AckR) { return $.ui.toast(t(r in FILL_TOASTS ? FILL_TOASTS[r as keyof typeof FILL_TOASTS] : 'toast.startCard')) }
// Messages sent from the field to a busy session (or one waiting for you): drawn at once as "Tú (en cola)" until the
// session took it (its own row shows): its chat lists a matching row of yours stamped after the send (`at`), or lists that
// text once more than when it was sent (a session on an older mod stamps no rows); or OUTBOX_TTL passes. The session
// itself lists a queued message only once it reaches its queue, which a pending permission holds back.
// `to`: the subagent a relayed message is for (its "Tú → <name> (en cola)"); absent for the Jefe.
export const outbox = new Map<string, { text: string; sent: string; base: number; at: number; to?: string }[]>()
export function queueOut($: EngineInterface, out: Out) {
  if (!out) return
  outbox.set(out.id, [...(outbox.get(out.id) ?? []), out.o].slice(-5))
  $.ui.invalidate('ui.render')
}
export async function toggleEverywhere($: EngineInterface) {
  await $.store.set(EVERYWHERE, !(await $.store.get(EVERYWHERE)))
  $.ui.invalidate('ui.render')
}

// The mod on disk against the one this session loaded (sync.ts keeps the pure parts).
/** The version of the mod at `root`: hooks/*, agents/*, skills/*\/* and .claude-plugin/plugin.json. null when unreadable. */
export async function versionAt($: EngineInterface, root: string): Promise<string | null> {
  try {
    const files: [string, string][] = []
    const add = async (dir: string) => {
      for (const e of await $.fs.list(`${root}/${dir}`).catch(() => [])) if (e.kind === 'file') files.push([`${dir}/${e.name}`, await $.fs.read(`${root}/${dir}/${e.name}`)])
    }
    await add('hooks')
    await add('agents')
    for (const s of await $.fs.list(`${root}/skills`).catch(() => [])) if (s.kind === 'dir') await add(`skills/${s.name}`)
    files.push(['.claude-plugin/plugin.json', await $.fs.read(`${root}/.claude-plugin/plugin.json`)])
    return await versionOf(files)
  } catch {
    return null // a file removed mid-read: no version this round
  }
}
/**
 * True when git reports no uncommitted or untracked change under `root`. Argv only; no index lock taken and no
 * fsmonitor program started (git status runs no repo hooks). Not a repo: false.
 */
export async function isClean($: EngineInterface, root: string): Promise<boolean> {
  const r = await $.process.run(['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '--', '.'], { cwd: root }).catch(() => null)
  return !!r && r.exitCode === 0 && r.stdout.trim() === ''
}
/** The last 400 KB of a file, argv only; '' when unreadable. `path` must be absolute, so it never reads as a flag, and a
 * regular file (a FIFO would hold the read). */
export async function tailOf($: EngineInterface, path: string): Promise<string> {
  if (!path.startsWith('/') || (await $.fs.stat(path).catch(() => null))?.kind !== 'file') return ''
  const r = await $.process.run(['/usr/bin/tail', '-c', '400000', path], { timeoutMs: 5000 }).catch(() => null) // a swap to a FIFO after the stat
  return r?.exitCode === 0 ? r.stdout : ''
}
/** The mod on disk for a session loaded from `loadedRoot`. Git runs only when the version differs from `loaded`: in
 * sync, nothing is spawned (the version is what loaded, whatever else the checkout holds). */
export async function diskOf($: EngineInterface, loadedRoot: string, home: string, loaded?: string): Promise<Disk | null> {
  const cached = loadedRoot.startsWith(`${home}/.claude/plugins/cache/`)
  const installed = cached ? await $.fs.read(`${home}/.claude/plugins/installed_plugins.json`).then(JSON.parse).catch(() => null) : null
  let at = diskRootOf(installed, loadedRoot, home)
  if (at && !at.checkout) { // the path as written can link out of the cache: where it lands must stay inside it
    const real = (p: string) => $.fs.stat(p, { resolve: true }).then(s => s.realPath ?? null, () => null)
    const [r, c] = await Promise.all([real(at.root), real(`${home}/.claude/plugins/cache/${loadedRoot.slice(`${home}/.claude/plugins/cache/`.length).split('/')[0]}/agentville`)])
    at = r && c && r.startsWith(`${c}/`) ? { root: r, checkout: false } : null
  }
  const ver = at && (await versionAt($, at.root))
  if (!at || !ver) return null
  return { ver, clean: !at.checkout || ver === loaded || (await isClean($, at.root)) }
}
/**
 * One check, every SYNC_EVERY inside `listen`. Answers the version on disk this session is behind (put it in the beat as
 * `syncStuck`), or null: in sync, a checkout mid-edit, or no version readable. The mod never reloads itself: the app
 * refuses a plugin's /reload-plugins over its remote connection (142 of 142 tries refused, 2026-10-20), so the pane says
 * to type it in that session's chat.
 */
export async function syncTick($: EngineInterface, s: { root: string; home: string; loaded: string }): Promise<{ stuck: string | null; disk: Disk | null }> {
  const disk = await diskOf($, s.root, s.home, s.loaded)
  return { stuck: disk?.clean && disk.ver !== s.loaded ? disk.ver : null, disk }
}
// The floor picture only changes with its depth (rows of islands), its words' language and the islands over it (their
// tiles are left out): built once for each, the last 20 kept.
const houses = new Map<string, string>()
const houseOf = (v: AgentvilleWorld) => {
  const rooms = v.depts.filter(d => !d.away && d.room.length).map(d => d.room), k = `${v.rows ?? 1}:${getLang()}:${rooms.join(';')}`
  if (!houses.has(k)) { if (houses.size >= 20) houses.delete(houses.keys().next().value!); houses.set(k, houseLayer(v.rows ?? 1, rooms)) }
  return houses.get(k)!
}
// The band count a map of `rows` last used, kept while each band stays BAND_MIN to BAND_MAX px: a pane resized a little
// keeps its bands, so its hit Clients and their Buttons keep their keys (a press on a key the newest drawing dropped
// is lost, mod-clicks 4b). Past those bounds it is counted afresh.
const BAND_MIN = 15, BAND_MAX = 20
const bandKeep = new Map<number, number>()
const bandsAt = (rows: number, columns: number) => {
  const v = viewOf(rows), ht = (mapDrawPx(columns) * v.ht) / v.w, had = bandKeep.get(rows)
  if (had && ht / had >= BAND_MIN && ht / had <= BAND_MAX) return had
  const n = bandCount(rows, columns)
  bandKeep.set(rows, n)
  return n
}
// The map's clicks are drawn inside Clients, one per band (bandhits.tsx): the pane's own Buttons got new handles on
// every redraw and the desktop dropped the first press ("ui_press not handled"); a Client's Buttons keep theirs in its
// frame. Tried and reverted before: Markdown links (a press lands only after the double-click interval), and one
// Client over the whole map (a Client gets one text row, so only the map's top row took clicks).
export function register(on, options) {
  on('ui.render', { component: 'Pane', requestId: 'agentville' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box><ui.Client key="hits" module="./btns.tsx" props={{}} /></ui.Box>
  })
}
