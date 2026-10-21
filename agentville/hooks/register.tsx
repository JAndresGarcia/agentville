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
let ticker: { cancel: () => void } | null = null
// What you are typing to each session, kept out of state so a keystroke never redraws the pane.
const drafts = new Map<string, string>()
let sentCount = 0
// Images you copied and attached to the next message, per session (files the pane saved from the clipboard), each with
// its thumbnail for the composer (null when sips could not make one).
const attached = new Map<string, { path: string; pic: Awaited<ReturnType<typeof thumb>> }[]>()
const picCache = new Map<string, string>() // thumbnail file -> its base64 jpeg, the 40 last drawn
let hitsKeep = { n: 0, rows: new Map<number, number>() }
let drawTimes: number[] = [], msgTimes: number[] = []
let shedAt = noSteps(), latchAt = '', zonesCost = Infinity
// The last measure of a latched map's or people's layers, kept while the floor's offices and people stay the same count:
// a latched pane does not build those layers again on every render.
let undoCost = { key: '', chars: Infinity }
let renders: unknown[] = []
let calib: { start: number; fromKb: number; els: boolean } | null = null, calibTimer: { cancel: () => void } | null = null
// `/agentville calibrar clics` (calibrate clicks): every Client tinted (a background, never a border: a border adds cells
// and would move the very rows it shows) and every press toasted, keys only. Off again on the next run or a reload.
let clickDiag = false
const TINT = { hits: 'rgba(255,60,60,0.30)', btns: 'rgba(60,140,255,0.30)', field: 'rgba(60,200,90,0.25)' } as const
const tinted = (k: keyof typeof TINT) => (clickDiag ? { tint: TINT[k] } : {})
const chatBack = new Map<string, number>()
const opened = new Set<string>()
// Opened replies the weight guard closed again: their bubble says there is more than fits, so the press is never silent.
const noRoom = new Set<string>()
let pinnedUse: string | null = null // the office whose usage card stays open over the map
// The desk notes the notes card has shown ("q:<ask id>", "o:<offer id>"): one not in here opens the card by itself.
const seenNotes = new Set<string>()
// The notes card's items as last drawn and since when: a pill pressed within NOTE_CALM ms of the card opening or its
// items changing is a click meant for what was under it, and does nothing.
let notesSig = '', notesSince = 0
let menuOpen = false // the field shows its command suggestions: the frame then aligns to the top
let idleAll = false // "Sin actividad o listas" shows every session, not the first IDLE_MAX
let listPage = 0 // the list's page past LIST_MAX rows
let waitSeen = new Set<string>() // the sessions in "Te esperan" at the last drawing: a new one sends the list to its first page
/** A group's sessions as a tree, depth first: each parent, then its children in their order, then theirs. A session
 * whose parent is not in the group stays where it is; one seen already (a parent cycle) is not visited again. */
export function famTree<D extends Fam>(list: D[]): D[] {
  const ids = new Set(list.map(d => d.id)), seen = new Set<string>(), out: D[] = []
  const visit = (d: D) => {
    if (seen.has(d.id)) return
    seen.add(d.id); out.push(d)
    for (const c of list) if (upIn(c, ids) === d.id) visit(c)
  }
  for (const d of list) { const up = upIn(d, ids); if (!up || !ids.has(up)) visit(d) }
  for (const d of list) visit(d) // a cycle has no root: its first session starts it
  return out
}
/** Each shown row with its depth among the rows shown (0: its parent is not shown above it), in tree order. */
export function famDepths<D extends Fam>(shown: D[]): [D, number][] {
  const depth = new Map<string, number>()
  return shown.map(d => { const up = upIn(d, depth), k = up && depth.has(up) ? depth.get(up)! + 1 : 0; depth.set(d.id, k); return [d, k] })
}
/** The list's three groups as trees (AJ). A session sits in its own state's group, except a child that does not wait for
 * you: it goes where the session it hangs from goes (its tree link among every session), so a family stays together. */
export function famGroups<D extends Fam>(all: D[], own: (d: D) => Grp): [Grp, D[]][] {
  const byId = new Map(all.map(d => [d.id, d])), home = new Map<string, Grp>()
  const homeOf = (d: D, path: Set<string>): Grp => {
    const known = home.get(d.id)
    if (known) return known
    const mine = own(d), up = byId.get(upIn(d, byId) ?? '')
    path.add(d.id)
    const g = mine === 'waiting' || !up || path.has(up.id) ? mine : homeOf(up, path) // a parent cycle stops at its own state
    home.set(d.id, g)
    return g
  }
  return (['waiting', 'working', 'idle'] as const).map(g => [g, famTree(all.filter(d => homeOf(d, new Set()) === g))])
}
/** A group's rows before the idle cut: the families whose first row is among the first `max` rows, whole (a family is
 * never split), plus the `keep` rows (the selected one) past it. */
export function famCut<D extends Fam>(tree: D[], max: number, keep: (d: D) => boolean): D[] {
  let start = 0
  return famDepths(tree).filter(([d, k], i) => { if (k === 0) start = i; return start < max || keep(d) }).map(([d]) => d)
}
let skillsOpen = false, skillPage = 0 // the tour's skill list (the flow step), opened by "Una de mis skills"
// The open tour's target for its step, kept while the step stays: walking agents move the fresh one, and the spotlight,
// bubble and click zones must not move while the person reaches for them. Taken again when the step changes, when the
// target is gone, and on every opening.
let keptTarget: { at: string; rect: TourRect } | null = null // at: the step, the floor's rows and the focus office
let tourShown: TourStep | null = null // the step the last tour drawing showed: entering a step is noticed once
// The pane's language, read from the store before drawing or writing a heartbeat (another session may have changed it).
async function useLang($: EngineInterface) { return setLang(langOf(await $.store.get(LANG_KEY).catch(() => getLang()))) } // a failed read keeps the language
async function current($: EngineInterface): Promise<{ w: AgentvilleWorld; now: number }> {
  const now = await $.clock.now()
  return { w: shownWorld ?? usable(await read($, world)) ?? emptyWorld(now), now }
}
let shownWorld: AgentvilleWorld | null = null
let drewAt = -Infinity, drewKb = 0, askedAt: number | null = null, bgTimer: { cancel: () => void } | null = null
const dropBg = () => { bgTimer?.cancel(); bgTimer = null; askedAt = null }
async function redrawBg($: EngineInterface) {
  const now = await $.clock.now()
  if (bgTimer || (askedAt !== null && now - askedAt < RENDER_GAP)) return // a redraw already comes: it draws this change too
  askedAt = now
  const wait = drewKb > HEAVY_KB ? drewAt + RENDER_GAP - now : 0
  if (wait <= 0) return $.ui.invalidate('ui.render')
  bgTimer = $.clock.after(wait, async () => {
    bgTimer = null
    askedAt = await $.clock.now()
    $.ui.invalidate('ui.render')
  })
}
// Reads every session's heartbeat and redraws only when something changed (each write sends the whole pane again).
// A beat's id goes into paths (its mailbox, its commands): one that is not a plain id, or not its own file's name, is
// dropped.
async function readBeats($: EngineInterface) {
  const dir = beatsDir(await home($))
  const files = await $.fs.list(dir).catch(() => [])
  const beats: Beat[] = []
  for (const f of files) {
    if (!f.name.endsWith('.json')) continue
    try {
      const b = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Beat
      if (typeof b?.id !== 'string' || !/^[\w-]+$/.test(b.id) || f.name !== `${b.id}.json`) continue
      // A beat of the wrong shape would throw in the drawing on every pass and freeze the pane: skipped.
      if (!b.agents || typeof b.agents !== 'object' || !Array.isArray(b.notes) || typeof b.name !== 'string' || !Number.isFinite(b.at)) continue
      if (b.chat !== undefined) b.chat = Array.isArray(b.chat) ? b.chat.filter(c => !!c && typeof c === 'object' && typeof c.text === 'string') : undefined
      // Only the pane's look at the app's records says a chat is archived (lookArchived), never a heartbeat.
      if (typeof b.local === 'string' && archivedIds.has(b.local)) b.archived = true; else delete b.archived
      // A picture's file name goes into paths too (its thumbnail, the zoom's temp files).
      if (Array.isArray(b.chat)) for (const c of b.chat) if (c?.pics) c.pics = (Array.isArray(c.pics) ? c.pics : []).filter(p => typeof p?.file === 'string' && /^[\w-]+$/.test(p.file) && dim(p.w) && dim(picHt(p)) && (p.orig === undefined || typeof p.orig === 'string'))
      beats.push(b)
    } catch { /* a file being written: next pass */ }
  }
  return beats
}
// `reads`: only the ticker's passes (one at a time) read transcripts and records; any other sync uses what they last read.
async function sync($: EngineInterface, reads = false) {
  const beats = await readBeats($)
  const now = await $.clock.now()
  syncedAt = now
  if (reads) await lookArchived($, beats, now).catch(() => {})
  for (const b of beats) if (b.local && archivedIds.has(b.local)) b.archived = true; else delete b.archived // the look may have changed them
  for (const id of transcripts.keys()) if (!beats.some(b => b.id === id)) transcripts.delete(id)
  // Only live sessions, side by side: one at a time over every file ever written held the first drawing back.
  await Promise.all(beats.filter(b => isLive(b, now)).map(async b => {
    const s = reads ? await transcriptOf($, b, now) : transcripts.get(b.id)
    b.name = s?.name ?? b.name
    // A session on an older mod parses no questions itself: the transcript's stand in, and its Jefe waits on them.
    if (!s?.asks || b.ended || isMod(b.mod)) return
    if (s.asks.ask) b.ask = s.asks.ask; else delete b.ask
    if (s.asks.offers) b.offers = s.asks.offers; else delete b.offers
    const m = b.agents[MAIN]
    if (m && (m.state === 'terminado' || m.state === 'inactivo') && hasItem(b, now)) b.agents[MAIN] = { ...m, ...waitPatch(b) } // keeps its since
  }))
  const prev = usable(await read($, world))
  const next = worldFromBeats(prev, beats, now, await hiddenOf($))
  const arrived = next.agents.find(a => a.state === 'esperando' && prev?.agents.find(o => o.id === a.id)?.state !== 'esperando')
  // Nothing drawn changed (drawnSig): no update, so no redraw; the world on hand keeps its walks and places.
  // The ticker's passes (`reads`) redraw through the gate; a sync you caused (opening, refresh, sync), someone who starts
  // waiting for you (toasted below) and a new permission request (Rechazar shows now) at once.
  const urgent = !!prev && (!!arrived || next.agents.some(a => a.req && prev.agents.find(o => o.id === a.id)?.req !== a.req))
  if (!prev || drawnSig(next, now) !== drawnSig(prev, now)) {
    await update($, world, () => next)
    shownWorld = next
    if (reads && !urgent) await redrawBg($); else $.ui.invalidate('ui.render')
  }
  // New permission requests the pane can answer get a toast, once per request: one says who and the seconds left, more
  // say how many. One already past its hold end gets none, but whoever starts waiting with it still gets "Te espera";
  // whoever starts waiting with a live one gets no second toast.
  for (const r of permToasted) if (!next.agents.some(a => a.req === r)) permToasted.delete(r)
  const asked = prev ? next.agents.filter(a => a.req && !permToasted.has(a.req) && prev.agents.find(o => o.id === a.id)?.req !== a.req) : []
  for (const a of asked) permToasted.add(a.req!)
  const live = asked.filter(a => (a.held ?? Infinity) > now), asker = live[0]
  if (live.length > 1) { await useLang($); await $.ui.toast(t('toast.perms', { n: live.length })) }
  else if (asker) { await useLang($); const ad = next.depts.find(d => d.id === asker.dept); await $.ui.toast(t('toast.perm', { role: roleName(asker.role, ad), office: ad?.name ?? '', s: Math.max(1, Math.ceil(((asker.held ?? now + HOLD_SAY) - now) / 1000)) })) }
  if (prev && arrived && !live.includes(arrived)) { await useLang($); const ad = next.depts.find(d => d.id === arrived.dept); await $.ui.toast(t('toast.waits', { role: roleName(arrived.role, ad), office: ad?.name ?? '' })) }
}
const permToasted = new Set<string>() // the requests toasted as they arrived (sync)
async function viewing($: EngineInterface) { await ensureRoot($); await $.fs.write(viewerFile(await home($)), JSON.stringify({ at: await $.clock.now() })).catch(() => {}) }
// Every second while the pane is open here: say a placed pane is open, and read the heartbeats every 3 s, every
// second while someone waits for an answer from the pane. With the pane gone it stops.
let syncedAt = 0
let ticking = false // one pass at a time: a slow read must not let two passes toast the same arrival
async function tick($: EngineInterface) {
  if (ticking) return
  ticking = true
  try {
    const pane = (await $.ui.panes()).find(p => p.id === PANE)
    if (!pane) return stopTicking()
    if (pane.isPlaced) await viewing($)
    await readAcks($).catch(() => {})
    const asking = usable(await read($, world))?.agents.some(a => a.req), reqAt = await $.store.get(REQ_AT).catch(() => null), now = await $.clock.now()
    // A stored time counts only between the last sync and now: one from the future (a skewed or bad write) would sync forever.
    if (asking || now - syncedAt >= 3000 || (typeof reqAt === 'number' && syncedAt <= reqAt && reqAt <= now)) await sync($, true)
    // Aprobar and Rechazar count their seconds down while a hold runs: a redraw asked every second, which the gate
    // (redrawBg, RENDER_GAP) lets through about every 2 s on a heavy pane. Only their labels change; keys and Clients stay.
    if (shownWorld?.agents.some(a => a.req && a.held !== undefined && a.held + 1000 > now)) await redrawBg($)
  } finally { ticking = false }
}
function startTicking($: EngineInterface) {
  if (ticker) return
  ticker = $.clock.every(1000, () => void tick($).catch(() => {}))
}
function stopTicking() {
  ticker?.cancel()
  ticker = null
  dropBg()
}

// This session's heartbeat: a module variable (a reload starts it fresh), written whole after every change, in order.
let beat: Beat | null = null
let saving: Promise<unknown> = Promise.resolve()
// The heartbeat is made by whichever hook comes first (session.start, or any event after a reload cut the session's
// start short), once per module: one promise, so two hooks at once make one beat.
let starting: Promise<void> | null = null
function ensureBeat($: EngineInterface) { return (starting ??= startBeat($).catch((err: unknown) => { starting = null; beat = null; throw err })) }
async function startBeat($: EngineInterface) {
  await ensureRoot($) // before the first heartbeat is written
  loadedVer ??= await versionAt($, PROBE_ROOT) // what this module loaded, before the disk moves on
  await useLang($)
  const cwd = await $.session.cwd(), now = await $.clock.now()
  const b = newBeat(await $.session.id(), cwd.split('/').filter(Boolean).pop() ?? t('act.session'), now)
  if (loadedVer) b.mod = loadedVer
  // Where the app keeps the transcript; the classic events below say it too, but a session started from another
  // session may never get them.
  transcript ||= `${await home($)}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${b.id}.jsonl`
  carryOver(b, await readJson($, `${beatsDir(await home($))}/${b.id}.json`))
  if (hasItem(b, now) && b.agents[MAIN]?.state !== 'trabajando') setAgent(b, MAIN, now, waitPatch(b)) // a reload keeps the question waiting in the despacho
  // The rows written while the module was being swapped (the /reload-plugins row itself) come back from the
  // transcript; the thumbnails already made are kept.
  const rows = chatOfTranscript(await tailOf($, transcript)), had = b.chat ?? []
  if (rows.length) b.chat = rows.map(r => ({ ...r, pics: had.find(o => o.who === r.who && o.text === r.text)?.pics }))
  beat = b // set before claim, so its mark finds it and never comes back here
  await claim($)
  await mark($, () => {})
  seen = now * 1000
  aliveAt = now // just written
  listener ??= $.clock.every(1500, () => void listen($).catch(() => {}))
}
async function mark($: EngineInterface, fn: (b: Beat, now: number) => void) {
  if (!beat) await ensureBeat($).catch(() => {})
  if (!beat) return
  await useLang($) // the activities written below are in the pane's language
  fn(beat, await $.clock.now())
  const text = JSON.stringify(beat), path = `${beatsDir(await home($))}/${beat.id}.json`
  saving = saving.then(() => $.fs.write(path, text)).catch(() => {}) // a lost beat is replaced by the next one
}

// The session's side of the mailbox: messages become prompts as if typed (never a /command, see submitOrder), a stop
// ends the running turn. Orders older than this module's start are ignored, so a reload never replays them.
let seen = 0
let listener: { cancel: () => void } | null = null
let mainTurn: string | null = null
const running = new Map<string, string>() // agent key -> the tool it is running, to place a permission request
let listening = false // one pass at a time: two overlapping ticks would deliver an order twice
async function listen($: EngineInterface) {
  if (listening) return
  if (!beat) await ensureBeat($).catch(() => {})
  if (!beat) return
  listening = true
  try {
    const cmds = await trusted(await ordersAt($, controlFile(await home($), beat.id)), await readKey($), await $.clock.now(), beat.id, seen)
    for (const c of cmds.sort((x, y) => x.n - y.n)) {
      seen = c.n
      if (c.kind === 'msg' && c.text) void submitOrder($, c.text).catch(() => {})
      if (c.kind === 'stop' && mainTurn) await $.turn.abort({ turnId: mainTurn }).catch(() => {})
      // outside the lock: a slow call holds nothing. An older pane's start order goes there too, to ack gone.
      if (c.kind === 'dismiss' || c.kind === 'fill' || (c.kind as string) === 'start') void runOffer($, c).catch(() => {})
      if (c.kind === 'fillText') void runFillText($, c).catch(() => {})
    }
  } finally { listening = false }
  // Suggested sessions a pane started or dismissed through the app's tools leave this session's despacho.
  if (beat?.offers?.some(o => o.id)) {
    const done = await doneOffers($)
    if (beat.offers.some(o => o.id && done[o.id])) await mark($, (b, now) => dropOffers(b, now, id => !!done[id]))
  }
  const at = await $.clock.now()
  if (at - aliveAt >= ALIVE_EVERY) { aliveAt = at; await mark($, () => {}) } // the beat's file touched, its content as it was
  await syncCheck($).catch(() => {}) // before the rest: a failing read there never holds a reload back
  // Every session runs this listener (the pane's ticker runs only where a pane is open): a session started from another
  // one learns its parent and chat link here even when no prompt ever comes. relink keeps its own gates.
  void relink($).catch(() => {})
  await ensurePane($)
  await publishCommands($)
  await measure($)
}
async function runOffer($: EngineInterface, c: Cmd) {
  const id = c.req
  if (!beat || typeof id !== 'string' || !TASK.test(id) || offerCalls.has(id)) return // shortcut: a malformed id gets no ack (the pane never sends one)
  offerCalls.add(id) // before any await: two orders for one id in one pass make one call
  try {
    if (!beat || !offerOrderOk(beat, c, await $.clock.now(), await doneOffers($))) return await ackOffer($, id, { n: c.n, r: 'gone' })
    if (c.kind === 'fill') return await ackOffer($, id, { n: c.n, r: await fillStart($, id) })
    const end = await callTool($, DISMISS, { task_id: id }, CONSENT.dismiss)
    // Any answer from the app settles it: other words mean it is already started or gone there (live 2026-10-20).
    const r: AckR = 'done' in end ? (closedOk('dismiss', id, end.text) ? 'ok' : 'settled') : 'declined' in end ? 'declined' : 'failed'
    if (r === 'ok' || r === 'settled') {
      await offerDone($, id)
      await mark($, (b, now) => dropOffers(b, now, x => x === id))
    }
    await ackOffer($, id, { n: c.n, r, ...('declined' in end ? { why: end.declined } : {}) })
  } finally { offerCalls.delete(id) }
}
async function fillStart($: EngineInterface, id: string): Promise<FillR> {
  try {
    const o = beat?.offers?.find(x => x.id === id)
    if (!o || o.end || (await doneOffers($))[id]) return 'gone'
    await useLang($)
    return await fillBox($, t('q.startFill', { title: pressTitle(o.title, id) ?? id, task_id: id }))
  } catch { return 'failed' }
}
// A pane's fillText order (a /command it held back from this session, holdCommand): its text, checked again
// (fillTextOf), goes in this session's OWN prompt box exactly as fillStart's line does, never sent, so nothing runs
// until you press Enter there. Acked under `text:<this session>` with the order's `n`.
let fillingText = false // one fill at a time: a second order while one runs acks busy
async function runFillText($: EngineInterface, c: Cmd) {
  if (!beat) return
  const key = `text:${beat.id}`
  if (fillingText) return ackOffer($, key, { n: c.n, r: 'busy' })
  fillingText = true // before any await
  try {
    const text = fillTextOf(c.text)
    await ackOffer($, key, { n: c.n, r: text ? await fillBox($, text) : 'failed' })
  } finally { fillingText = false }
}
// Always in sync (sync.ts): every SYNC_EVERY a session behind the mod on disk marks itself stuck (syncStuck), so its card
// says to type /reload-plugins in its chat. The version this module loaded, and (only where the pane is open) the disk's
// counted version for its badges.
let loadedVer: string | null | undefined, syncAt = -Infinity, diskVer: string | null = null
async function syncCheck($: EngineInterface) {
  const now = await $.clock.now()
  if (!beat || !loadedVer || now - syncAt < SYNC_EVERY) return
  syncAt = now
  const r = await syncTick($, { root: PROBE_ROOT, home: await home($), loaded: loadedVer })
  if ((r.stuck ?? undefined) !== beat?.syncStuck) await mark($, b => { if (r.stuck) b.syncStuck = r.stuck; else delete b.syncStuck })
  if (!ticker) return
  const v = r.disk?.clean ? r.disk.ver : null // a checkout mid-edit counts as no version: no badges
  if (v !== diskVer) { diskVer = v; await redrawBg($) }
}

// The session's usage for its office: context fill by category (estimated locally, as /context's summary), spend and
// limits. Every 20 s, and after each answer; written only when it changed.
let measuredAt = 0
async function measure($: EngineInterface, now = false) {
  if (!beat) await ensureBeat($).catch(() => {})
  const t = await $.clock.now()
  if (!beat || (!now && t - measuredAt < 20000)) return
  measuredAt = t
  const u = await $.session.usage({ breakdown: 'summary' }).catch(() => null)
  if (!u) return
  const bd = u.context.breakdown
  const usage: AgentvilleUsage = {
    pct: Math.round(u.context.percent ?? bd?.percentage ?? 0), tokens: bd?.totalTokens ?? u.context.tokens ?? 0, window: bd?.maxTokens ?? u.context.window,
    usd: u.cost?.usd, model: bd?.model,
    cats: (bd?.categories ?? []).filter(c => c.tokens > 0 && !c.isDeferred).sort((x, y) => y.tokens - x.tokens).slice(0, 7).map(c => ({ name: c.name, tokens: c.tokens, color: c.color })),
    limits: u.rateLimits.map(r => ({ kind: r.kind, pct: r.percentUsed })),
  }
  if (JSON.stringify(usage) !== JSON.stringify(beat.usage)) await mark($, b => { b.usage = usage })
}
// A message from the field: the pane's own session takes it at once (deliver, unawaited as the listener ran it: a command
// may run long, and a failure calls `failed`); any other session gets a signed msg order, whose failure rejects. With no
// heartbeat the own session is unknown: an order.
async function sendMsg($: EngineInterface, sessionId: string, text: string, failed: () => unknown) {
  if (beat && sessionId === beat.id) return void deliver($, text).catch(failed)
  await order($, sessionId, { kind: 'msg', text })
}
// The image on the clipboard, saved as a png (osascript); null when the clipboard holds none.
async function clipboardImage($: EngineInterface) {
  if (hasSips === false) return null
  const path = `${IMAGES(await home($))}/up-${await $.clock.now()}.png`
  await $.process.run(['/bin/mkdir', '-p', IMAGES(await home($))]).catch(() => null)
  const r = await $.process.run(['/usr/bin/osascript', '-e', 'on run argv', '-e', 'set f to open for access (POSIX file (item 1 of argv)) with write permission',
    '-e', 'set eof f to 0', '-e', 'write (the clipboard as «class PNGf») to f', '-e', 'close access f', '-e', 'end run', path]).catch(() => null)
  if (r?.exitCode === 0) return path
  await $.process.run(['/bin/rm', '-f', path]).catch(() => null)
  return null
}
async function clipboardText($: EngineInterface) {
  const r = await $.process.run(['/usr/bin/pbpaste'], { env: { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }, timeoutMs: 5000 }).catch(() => null)
  return r?.exitCode === 0 ? pasteText(r.stdout.slice(0, PASTE_MAX * 4)) : ''
}
// Per session: the last clipboard text handed to its field, numbered so the field applies each once; dropped once
// the field posts a draft holding it, or on send, so it does not ride in the props.
const pasted = new Map<string, { n: number; text: string }>()
let pasteN = 0

// A message's image as a small jpeg (macOS sips), kept as base64 text in a file the pane reads when it draws the
// bubble: the heartbeat stays small; a week unused, `tidy` deletes it.
// Thumbnails, pasted images and the zoom need macOS's sips: without it they are left out (set at session start).
let hasSips: boolean | null = null // unknown until checked: taken as there, so nothing hides while the session starts
let toldNoSips = false
// A path a message names is untrusted: only a regular image file (by its extension) of at most IMG_MAX is read, and
// only by sips, in place; never a FIFO, a device, a folder or any other file.
async function isImageFile($: EngineInterface, path: string) {
  if (!path.startsWith('/') || !isImg(path)) return false
  const st = await $.fs.stat(path).catch(() => null)
  return st?.kind === 'file' && st.size <= IMG_MAX
}
function rmFiles($: EngineInterface, files: string[]) { return $.process.run(['/bin/rm', '-f', ...files]).catch(() => null) }
async function thumb($: EngineInterface, ref: ImgRef) {
  if (hasSips === false) return null
  if ('path' in ref && !(await isImageFile($, ref.path))) return null
  const dir = IMAGES(await home($)), file = `${beat?.id ?? 'x'}-${await $.clock.now()}-${Math.floor(Math.random() * 1e6)}`
  // A pasted image is kept whole beside its thumbnail, for a click to open; a named file is opened where it is.
  const ext = 'data' in ref ? ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[ref.media] ?? 'png' : ''
  const src = 'data' in ref ? `${dir}/${file}.${ext}` : ref.path, b64 = `${dir}/${file}.b64`, jpg = `${dir}/${file}.jpg`
  let made = false
  try {
    await ensureRoot($)
    await $.process.run(['/bin/mkdir', '-p', dir]).catch(() => null)
    if ('data' in ref) { await $.fs.write(b64, ref.data); if ((await out($, ['/usr/bin/base64', '-D', '-i', b64, '-o', src])) === null) return null }
    if ((await out($, [SIPS, '-Z', '240', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', src, '--out', jpg])) === null) return null
    const size = await out($, [SIPS, '-g', 'pixelWidth', '-g', 'pixelHeight', jpg]), w = px(size, 'Width'), ht = px(size, 'Height')
    const { base64 } = await $.fs.read(jpg, { as: 'bytes' })
    if (!w || !ht || !base64) return null
    await $.fs.write(`${dir}/${file}.txt`, base64)
    made = true
    return chatPic(file, w, ht, src)
  } catch { return null } finally {
    await rmFiles($, [b64, jpg, ...(!made && 'data' in ref ? [src] : [])])
  }
}
let zoom: { file: string; orig?: string; w: number; ht: number; cut: boolean; strips: string[] } | 'loading' | null = null
async function openZoom($: EngineInterface, p: ChatPic) {
  zoom = 'loading'
  $.ui.invalidate('ui.render')
  // The original comes from a heartbeat (any session's): checked again here before sips or Vista Previa touch it.
  const orig = p.orig && hasSips !== false && (await isImageFile($, p.orig)) ? p.orig : undefined
  const strips: string[] = []
  let w = 0, ht = 0
  if (orig) {
    const dir = IMAGES(await home($)), big = `${dir}/${p.file}-big.big.jpg`, part = `${dir}/${p.file}-big.s.jpg`
    try {
      const wide = px(await out($, [SIPS, '-g', 'pixelWidth', orig]), 'Width') > 900
      if ((await out($, [SIPS, ...(wide ? ['--resampleWidth', '900'] : []), '-s', 'format', 'jpeg', '-s', 'formatOptions', '40', orig, '--out', big])) !== null) {
        const size = await out($, [SIPS, '-g', 'pixelWidth', '-g', 'pixelHeight', big])
        w = px(size, 'Width'); ht = px(size, 'Height')
      }
      // The desktop stops drawing a pane whose tree grows too heavy (a whole screenshot did), so the viewer keeps ~100 KB
      // of strips; a taller image shows its top and the rest stays a click away in Vista Previa.
      for (let y = 0, used = 0; w && y < ht; y += STRIP) {
        if ((await out($, [SIPS, '-c', String(STRIP), String(w), '--cropOffset', String(y), '0', big, '--out', part])) === null) break
        const { base64 } = await $.fs.read(part, { as: 'bytes' })
        if (!base64 || used + base64.length > ZOOM_BUDGET) break
        strips.push(base64); used += base64.length
      }
    } catch { /* what was cut so far still shows */ } finally { await rmFiles($, [big, part]) }
  }
  // A file gone (or never kept, as for images from before) falls back to the thumbnail, drawn larger.
  zoom = w && ht && strips.length ? { file: p.file, orig, w, ht: Math.min(ht, strips.length * STRIP), cut: strips.length * STRIP < ht, strips } : { file: p.file, orig, w: p.w, ht: picHt(p), cut: false, strips: [] }
  $.ui.invalidate('ui.render')
}

// The island this session keeps; looked at again now and then, as a clash between two sessions starting together
// resolves to the smaller id.
async function claim($: EngineInterface) {
  if (!beat) await ensureBeat($).catch(() => {})
  if (!beat) return
  const now = await $.clock.now(), slot = claimSlot(beat, (await readBeats($)).filter(b => isLive(b, now)), now, await hiddenOf($))
  if (slot !== beat.slot) await mark($, b => { b.slot = slot })
}

// The session's commands for the pane's suggestions, rewritten only when they change (plugins and MCP come and go).
let commandsAt = 0, commandsText = ''
async function publishCommands($: EngineInterface) {
  const now = await $.clock.now()
  if (!beat || now - commandsAt < 30000) return
  commandsAt = now
  await claim($)
  await retitle($) // a title the app sets mid-turn shows without waiting for the turn's end
  const rows: CmdRow[] = (await $.command.list()).map(c => [c.name, c.description.replace(/\s+/g, ' ').slice(0, 200), c.source])
  const text = JSON.stringify(rows)
  const file = commandsFile(await home($), beat.id)
  if (text !== commandsText || !(await $.fs.exists(file))) { commandsText = text; await $.fs.write(file, text) }
}

// The title the app gave the session, read from its transcript's tail (the file can pass the 4 MiB read limit).
let transcript = ''
async function retitle($: EngineInterface) {
  if (!transcript) return
  const t = titleFrom(await tailOf($, transcript))
  if (t && t !== beat?.name) await mark($, b => { b.name = t })
}

// The session that started this one, read from the app's session records while unknown: every RELINK_FAST in the
// module's first RELINK_FRESH (a new child joins its parent's block within seconds), then once a minute. The app writes
// a child's record, its spawnedFrom and its parent's record a while after the start: no look spends a try while fresh,
// nor one whose own record names no parent yet; after the fresh window a miss or a parent's record not ready spends
// one (RELINK_TRIES per module). Once found, the own record is read again by its path, no grep; with nothing left to
// learn from it (a root, or an id that gives no chat link), the looks stop RELINK_QUIET after the module's first.
// Only paths of the records' shape are read, cut at RECORD_MAX; nothing is kept or logged but the ids.
let relinkAt = -Infinity, relinkFrom = Infinity, relinkTries = 0, relinkOwn: string | null = null
async function readMetas($: EngineInterface) {
  const d = `${await $.session.cwd()}/.agentville`, f = `${d}/metas.md`
  const dir = await $.fs.stat(d).catch(() => null), st = dir?.kind === 'dir' && !dir.isLink ? await $.fs.stat(f).catch(() => null) : null
  const r = st?.kind === 'file' && !st.isLink && st.size <= METAS_MAX ? await $.process.run(['/usr/bin/head', '-c', String(METAS_MAX + 1), f], { timeoutMs: 2000 }).catch(() => null) : null
  const text = r?.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : ''
  const metas = new TextEncoder().encode(text).length > METAS_MAX ? [] : metasOf(text)
  await mark($, b => { if (metas.length) b.metas = metas; else delete b.metas })
}
// The same look learns this session's own record id (`local`, its chat's link in the app), so it runs while either is unknown.
async function relink($: EngineInterface) {
  const now = await $.clock.now()
  if (!beat || (beat.parent && beat.local) || !/^[\w-]+$/.test(beat.id) || relinkTries >= RELINK_TRIES) return
  relinkFrom = Math.min(relinkFrom, now)
  const fresh = now - relinkFrom < RELINK_FRESH
  if (now - relinkAt < (fresh ? RELINK_FAST : RELINK_EVERY)) return
  relinkAt = now
  const me = beat.id, dir = `${APP_DIR(await home($))}/claude-code-sessions`
  let hit = relinkOwn, own = hit ? await record($, `${dir}/${hit}`) : null
  if (own?.cliSessionId !== me) {
    own = null; hit = relinkOwn = null
    // Other records may name this id too (a parent's): read in order until the session's own.
    for (const ht of relinkHits((await $.process.run(relinkGrep(me, dir), { timeoutMs: 5000 }).catch(() => null))?.stdout ?? '', dir)) {
      const r = await record($, `${dir}/${ht}`)
      if (r?.cliSessionId === me) { own = r; hit = relinkOwn = ht; break }
    }
  }
  if (!own || !hit) { if (!fresh) relinkTries++; return }
  const sid = spawnedOf(own), local = beat.local ? null : ownLocal(own, me, hit.slice(hit.lastIndexOf('/') + 1))
  const parent = !beat.parent && sid ? parentLink(own, await record($, `${dir}/${hit.replace(/[^/]+$/, `${sid}.json`)}`), me) : null
  if (local || parent) await mark($, b => { if (local) b.local = local; if (parent) b.parent = parent })
  if (sid && !beat.parent) { if (!fresh) relinkTries++ }
  else if (now - relinkFrom >= RELINK_QUIET) relinkTries = RELINK_TRIES // nothing left to learn: no more looks
}
async function flag($: EngineInterface, name: string) { return `${name}:${await $.session.id()}` }
async function wantsPane($: EngineInterface) {
  if (await $.store.get(await flag($, 'open'))) return true
  return Boolean(await $.store.get(EVERYWHERE)) && !(await $.store.get(await flag($, 'closed')))
}
// `redraw`: a pane already open is drawn again (a session start or a window attaching: the desktop may hold the pane
// with nothing drawn in it, "has not drawn in this pane"). The listener's tick passes none: it would redraw every tick.
async function ensurePane($: EngineInterface, redraw = false) {
  if (redraw && (await $.ui.panes()).some(p => p.id === PANE)) return void await drawOpen($)
  if (!(await wantsPane($)) || !(await $.session.surfaces()).length) return
  if ((await $.ui.panes()).some(p => p.id === PANE)) return
  await openPane($)
}
// An open pane drawn by this module: its heartbeat reader running (a module variable), its viewer mark, a fresh drawing.
async function drawOpen($: EngineInterface) {
  startTicking($)
  await viewing($)
  $.ui.invalidate('ui.render')
}
async function openPane($: EngineInterface) {
  await sync($).catch(() => {})
  // A fixed height inline (rows), so the pane opens as tall in every chat; where it sits is the surface's.
  const opened = await $.ui.open({ id: PANE, title: 'Agentville', columns: 110, rows: PANE_ROWS })
  if (opened.isPlaced) {
    startTicking($)
    await viewing($)
    $.ui.invalidate('ui.render') // reopening an existing pane draws it again, never "nothing to show"
  }

  return opened
}

// A permission request waits about 8 s (HOLD_MS) for the pane's Rechazar, then goes to the session's own prompt.
// Someone can answer from a pane: this session shows it placed, or a pane another session shows placed wrote the viewer
// file lately (see `tick`).
async function paneSeen($: EngineInterface, now: number) {
  if ((await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)) return true
  const viewer = await readJson($, viewerFile(await home($)))
  return !!viewer && now - viewer.at < VIEWER_FRESH
}
// Where a path lands with every symlink followed: the file's own, else its folder's plus its name (a file not there
// yet); null when neither resolves.
async function realOf($: EngineInterface, path: string) {
  const own = await $.fs.stat(path, { resolve: true }).catch(() => null)
  if (own?.realPath) return own.realPath
  const cut = path.lastIndexOf('/'), dir = await $.fs.stat(path.slice(0, cut) || '/', { resolve: true }).catch(() => null)
  return dir?.realPath ? `${dir.realPath.replace(/\/$/, '')}/${path.slice(cut + 1)}` : null
}
// What an unsent message still holds (a pasted image, its thumbnail, a path in a draft): tidy and the disk screen's
// delete-images button both leave it, however old.
function heldImage(images: string) {
  const held = new Set([...attached.values()].flat().flatMap(a => [a.path, ...(a.pic ? [`${images}/${a.pic.file}.txt`] : [])]))
  return (f: string) => held.has(f) || [...drafts.values()].some(d => d.includes(f))
}
let aliveAt = 0
async function tidy($: EngineInterface, now: number, mine: string) {
  const root = `${await home($)}/.claude/agentville`
  const old = (sub: string, ttl = (_: string) => WEEK) => $.fs.list(`${root}/${sub}`).catch(() => []).then(fs => fs.filter(f => f.kind === 'file' && now - f.mtimeMs > ttl(f.name)))
  const held = heldImage(`${root}/images`)
  const gone = (await old('images', n => (n.endsWith('.txt') ? WEEK : DAY))).map(f => `${root}/images/${f.name}`).filter(f => !held(f))
  for (const f of await old('sessions')) {
    const id = f.name.replace(/\.json$/, '')
    if (id === mine || !/^[\w-]+$/.test(id)) continue
    gone.push(`${root}/sessions/${id}.json`, commandsFile(await home($), id), controlFile(await home($), id))
  }
  if (gone.length) await $.process.run(['/bin/rm', '-f', ...gone]).catch(() => null)
  // The reload marks (sync:<id>) older versions stored: this session's own (it reloads no more), and those of sessions
  // whose heartbeat is gone (one still running an older version keeps its own).
  const left = await $.fs.list(`${root}/sessions`).catch(() => null)
  if (left) for (const k of await $.store.keys().catch(() => [])) if (k === syncKey(mine) || (k.startsWith(syncKey('')) && !left.some(f => f.name === `${k.slice(syncKey('').length)}.json`))) await $.store.delete(k).catch(() => {})
}
// Who a pane message is for, as the drawing on screen names it in the field (set with the field, emptied by `fresh`):
// the selected subagent of that office (its name, type and id mark the text), or null for the Jefe and the text as
// typed. A command always goes to the session: a subagent cannot run it.
// `agent`: the subagent's id on the map, whose conversation shows the message on its way (subOutbox).
let relayTo: { dept: string; name: string; type: string; id: string; agent: string } | null = null
function relayed(sessionId: string, text: string) {
  const r = relayTo
  if (!r || r.dept !== sessionId || text.startsWith('/')) return null
  return { to: r.name, agent: r.agent, text: t('relay.marker', { name: r.name, type: r.type, id: r.id, text }) }
}
async function subOutOf($: EngineInterface, agent: string | undefined, text: string): Promise<SubOut> {
  if (!agent) return null
  return { agent, o: { text, base: saidOf(usable(await read($, world))?.agents.find(x => x.id === agent)), at: await $.clock.now() } }
}

// Moves the tour: what a press says to change in it (open at 1, a step, done); the skill list closes.
async function setTour($: EngineInterface, set: Partial<Tour>) {
  const cur = tourOf(await $.store.get(TOUR_KEY).catch(() => undefined), Boolean(await $.store.get(INTRO).catch(() => false)))
  skillsOpen = false
  await $.store.set(TOUR_KEY, { ...cur, ...set })
  $.ui.invalidate('ui.render')
}
async function pickLang($: EngineInterface, l: 'es' | 'en') {
  await $.store.set(LANG_KEY, l)
  setLang(l)
  // Registering again replaces the command's line in the menu; refused under a user /agentville (see session.start).
  await $.command.register({ name: 'agentville', description: t('cmd.description') }).catch(() => {})
  $.ui.invalidate('ui.render')
}

// `/agentville refresh` (or limpiar): every office nobody is working in leaves the map until its next activity, and the
// files of sessions ended long ago (not this one) go. Stale marks (a session gone, or back at work) are pruned.
async function refresh($: EngineInterface) {
  const beats = await readBeats($), now = await $.clock.now(), ht = await home($), mine = await $.session.id()
  const had = await hiddenOf($), byId = new Map(beats.map(b => [b.id, b]))
  const old = beats.filter(b => b.ended && now - b.at >= SLEEP_MS && b.id !== mine && /^[\w-]+$/.test(b.id))
  const marks = Object.fromEntries(Object.entries(had).filter(([id, at]) => (byId.get(id)?.at ?? Infinity) <= at && !old.some(b => b.id === id)))
  let hidden = 0
  for (const b of beats) {
    if (pending(b) || old.includes(b)) continue
    if (isLive(b, now) && !b.ended && !isIdle(b, now, had)) hidden++ // it was on the map
    marks[b.id] = b.at
  }
  await $.store.set(HIDDEN_KEY, marks)
  if (old.length) await $.process.run(['/bin/rm', '-f', ...old.flatMap(b => [`${beatsDir(ht)}/${b.id}.json`, commandsFile(ht, b.id), controlFile(ht, b.id)])]).catch(() => null)
  await sync($).catch(() => {})
  return t('cmd.refreshed', { hidden, removed: old.length })
}
// Deleting the images asks first: a press arms the button (its label says how much) for 5 s, or until a redraw that
// press did not cause; a second press deletes.
let imagesArmed: { at: number; kb: number; keep: boolean } | null = null
// Asking an office to remove its worktrees asks first the same way: the first press arms that office's button.
let orderArmed: { id: string; at: number; keep: boolean } | null = null
let diskBusy = false
async function measureDisk($: EngineInterface, now: number) {
  if (diskBusy) return
  diskBusy = true
  let locked = false
  try {
    const cache = (await $.store.get(DISK_KEY).catch(() => null)) as DiskCache | null, due = dueToMeasure(cache, now)
    if ((!due.df && !due.du) || !lockFree((await $.store.get(DISK_LOCK).catch(() => null)) as number | null, now)) return
    await $.store.set(DISK_LOCK, now)
    locked = true
    const ht = await home($), mod = `${ht}/.claude/agentville`
    const next: DiskCache = { at: 0, duAt: 0, freeKb: null, modKb: null, wt: null, sizes: [], sessions: {}, ...cache }
    // Saved after each step, so free space never waits on the slow du; a redraw only when what shows changed.
    const shown = (c: DiskCache | null) => JSON.stringify([c?.freeKb ?? null, c?.modKb ?? null, c?.wt?.length ?? null, c?.sizes?.length ? c.sizes : null])
    let drawn = shown(cache)
    const save = async () => { await $.store.set(DISK_KEY, next); if (shown(next) !== drawn) { drawn = shown(next); await redrawBg($) } }
    if (due.df) { next.freeKb = parseDf((await $.process.run(['/bin/df', '-k', ht]).catch(() => null))?.stdout ?? ''); next.at = now; await save() }
    if (due.du) {
      // The app's private registry ($.fs may not read ~/Library): anything but its known shape is no registry at all.
      let wt: Worktree[] | null = null
      const reg = `${APP_DIR(ht)}/git-worktrees.json`, regular = (await $.fs.stat(reg).catch(() => null))?.kind === 'file' // never a FIFO
      try { wt = regular ? parseRegistry(JSON.parse((await $.process.run(['/bin/cat', reg]).catch(() => null))?.stdout ?? ''), ht) : null } catch { wt = null }
      const sizes = parseDu((await $.process.run(['/usr/bin/du', '-sk', mod, ...(wt ?? []).map(w => w.path)], SLOW).catch(() => null))?.stdout ?? '')
      const leases = [...new Set((wt ?? []).flatMap(w => (w.leasedBy ? [w.leasedBy] : [])))].slice(0, 60)
      const found = leases.length ? (await $.process.run(sessionsFind(APP_DIR(ht), leases), SLOW).catch(() => null))?.stdout ?? '' : ''
      // The first file found per lease, cut at 200 KB, in the shape parseSessions reads.
      let chunks = ''
      for (const id of leases) {
        const f = found.split('\n').find(p => p.endsWith(`/${id}.json`))
        if (f) chunks += `${SEP}${id}\n${(await $.process.run(['/usr/bin/head', '-c', '200000', f]).catch(() => null))?.stdout ?? ''}\n`
      }
      Object.assign(next, { wt, modKb: sizes.find(x => x.path === mod)?.kb ?? null, sizes: sizes.filter(x => x.path !== mod), sessions: parseSessions(chunks), duAt: now })
      await save()
    }
  } finally {
    diskBusy = false
    if (locked) await $.store.delete(DISK_LOCK).catch(() => {})
  }
}
// An answer goes only while the session still holds that request (its hold lasts about 8 s) and still shows its
// command whole and unmasked; else the toast says where. Once sent, the request hides until the session lets it go (see
// `answered`): marked before anything is awaited, so two presses at once send one order.
// A request whose hold end has passed (`held`) is never answered from here, whatever the session's file still says.
async function reply($: EngineInterface, a: Extract<Act, { k: 'reply' }>) {
  if (answered.has(a.req)) return
  answered.add(a.req)
  let name = a.dept
  try {
    const w = usable(await read($, world)), q = w?.agents.find(x => x.dept === a.dept && x.req === a.req)
    name = starterIn(w, a.dept)?.name ?? a.dept
    const whole = !!q && !isCutCmd(q.cmd) && !isMaskedCmd(q.cmd) && !isHiddenCmd(q.cmd) && !(q.held !== undefined && q.held <= await $.clock.now())
    const b = whole ? await readJson($, `${beatsDir(await home($))}/${a.dept}.json`) : null
    if (!Object.values(b?.agents ?? {}).some(x => x.req === a.req)) { answered.delete(a.req); return $.ui.toast(t('ask.expired', { chat: name })) }
  } catch (err) { answered.delete(a.req); return failed($, err) } // nothing sent: the request shows again
  return order($, a.dept, { kind: a.verdict, req: a.req }).then(() => {
    $.ui.invalidate('ui.render')
    return $.ui.toast(t('toast.rejected'))
  }, (err: unknown) => { answered.delete(a.req); $.ui.invalidate('ui.render'); return failed($, err) })
}
// A reply to the Jefe's question goes as its prompt, the very text the card showed, while the session still asks that
// question. Marked before anything is awaited, so two presses at once send one order. It never goes to a selected
// subagent (no relay): the question is the Jefe's.
async function answerAsk($: EngineInterface, a: Extract<Act, { k: 'answer' }>) {
  const key = `q:${a.ask}`
  if (sentItems.has(key)) return
  sentItems.set(key, Infinity)
  const d = usable(await read($, world))?.depts.find(x => x.id === a.dept)
  const back = (text: string) => { sentItems.delete(key); return $.ui.toast(text) }
  if (d?.ask?.id !== a.ask || a.text.startsWith('/')) return back(t('toast.gone')) // a slash command would run as one: never drawn, never sent
  if (d.asleep) return back(t('toast.asleep')) // a sleeping session reads no mailbox
  sentItems.set(key, await $.clock.now())
  return sendOrder($, a.dept, { kind: 'msg', text: a.text }, t('toast.sentTo', { name: agentName(`${a.dept}-jefe`) }), ok => { if (!ok) sentItems.delete(key); $.ui.invalidate('ui.render') })
}
// Descartar: only on your press. It calls the app's own tool with the task id the app gave (never text Claude wrote); if
// the tool is missing, fails or the app refuses, the matching prompt goes to the Jefe instead. The toast says which.
async function pressOffer($: EngineInterface, a: Extract<Act, { k: 'offer' }>) {
  const key = `o:${a.id}`
  // an order already waits for its ack: a second press sends nothing. An Arrancar fill waiting does not hold Descartar
  // (its late ack is then dropped: the dismiss order's `n` replaces it).
  if (sentItems.has(key) || (remote.has(a.id) && !remote.get(a.id)!.fill)) return
  sentItems.set(key, Infinity)
  const redraw = () => $.ui.invalidate('ui.render')
  const back = (text: string) => { sentItems.delete(key); redraw(); return $.ui.toast(text) }
  const d = usable(await read($, world))?.depts.find(x => x.id === a.dept)
  if (!d?.offers?.some(o => o.id === a.id)) return back(t('toast.gone'))
  // Another session's suggestion: only that session's tool call can take it, so it goes as a signed order (kind and task
  // id, nothing else) and the ticker waits for its ack. The pane calls no tool and sends no prompt for it.
  if (a.dept !== await $.session.id()) {
    if (d.asleep || !TASK.test(a.id)) return offerElsewhere($, a.id, a.dept, a.title, d.asleep ? 'toast.offerAsleep' : 'toast.offerElsewhere') // a sleeping session reads no mailbox
    sentItems.set(key, await $.clock.now())
    redraw()
    await $.ui.toast(t('toast.dismissing', { title: a.title }))
    const n = await order($, a.dept, { kind: 'dismiss', req: a.id })
    remote.set(a.id, { n, at: await $.clock.now(), title: a.title, dept: a.dept })
    return
  }
  sentItems.set(key, await $.clock.now())
  await $.ui.toast(t('toast.dismissing', { title: a.title }))
  const end = await callTool($, DISMISS, { task_id: a.id }, CONSENT.dismiss)
  if ('declined' in end) return back(t('toast.declined', { why: end.declined }))
  if ('stopped' in end) return back(t('toast.toolStopped'))
  if ('done' in end) {
    await offerDone($, a.id)
    redraw()
    return $.ui.toast(closedOk('dismiss', a.id, end.text) ? t('toast.offerDismissed', { title: a.title }) : t('toast.offerSettled'))
  }
  if (d.asleep) return back(t('toast.asleep'))
  const text = t('q.dismissSay', { id: a.id })
  return sendOrder($, a.dept, { kind: 'msg', text }, t('toast.viaJefe', { name: agentName(`${a.dept}-jefe`) }), ok => { if (!ok) sentItems.delete(key); redraw() })
}
async function offerElsewhere($: EngineInterface, id: string, dept: string, title: string, why: Elsewhere) {
  remote.delete(id)
  sentItems.delete(`o:${id}`)
  elsewhere.add(id)
  $.ui.invalidate('ui.render')
  const url = chatUrl(usable(await read($, world))?.depts.find(x => x.id === dept)?.local)
  return $.ui.toast(t(url ? why : 'toast.offerNoChat', { title }))
}
// The pane's ticker: each remote press settles on its own ack (the same `n`), else falls back after ACK_WAIT.
async function readAcks($: EngineInterface) {
  if (!remote.size) return
  const acks = await offerAcks($), now = await $.clock.now()
  for (const [id, p] of remote) {
    const x = acks[id]?.n === p.n ? acks[id] : null
    if (p.text !== undefined) { // a held command: its ack, or no answer in time (an older mod, asleep)
      if (!x && now - p.at < ACK_WAIT) continue
      remote.delete(id)
      await textSettled($, p, x?.r ?? null)
      continue
    }
    if (!x) {
      if (now - p.at < ACK_WAIT) continue
      if (p.fill) { remote.delete(id); await fillToast($, 'failed') } // no answer (an older mod there): do it on the card
      else await offerElsewhere($, id, p.dept, p.title, 'toast.offerElsewhere')
      continue
    }
    remote.delete(id)
    if (p.fill) { await fillToast($, x.r); continue }
    if (x.r === 'ok' || x.r === 'settled') { $.ui.invalidate('ui.render'); await $.ui.toast(x.r === 'ok' ? t('toast.offerDismissed', { title: p.title }) : t('toast.offerSettled')); continue }
    if (x.r === 'failed' || x.r === 'unclear') { await offerElsewhere($, id, p.dept, p.title, x.r === 'failed' ? 'toast.offerFailed' : 'toast.offerUnclear'); continue }
    sentItems.delete(`o:${id}`)
    $.ui.invalidate('ui.render')
    await $.ui.toast(x.r === 'gone' ? t('toast.gone') : t('toast.declined', { why: (x.why ?? '').slice(0, 120) }))
  }
}
// Arrancar: another session's suggestion gets one signed fill order (task id only) BEFORE its chat opens, so its box is
// filled before you can type there; the ticker waits for the ack. This pane's own session fills its own box here. The
// note stays drawn: nothing is sent, so a later press may try again (a filled box then answers busy).
async function pressStart($: EngineInterface, dept: string, o: { id: string; title: string }) {
  if (filling.has(o.id) || remote.has(o.id)) return openChat($, dept, true) // an order already waits for its ack: no second one
  filling.add(o.id)
  try {
    const d = usable(await read($, world))?.depts.find(x => x.id === dept)
    if (!d?.offers?.some(x => x.id === o.id) || !TASK.test(o.id)) return await openChat($, dept, true)
    if (dept === await $.session.id()) {
      const r = await fillStart($, o.id)
      await openChat($, dept, true)
      return fillToast($, r)
    }
    if (!d.asleep) { // a sleeping session reads no mailbox
      const n = await order($, dept, { kind: 'fill', req: o.id }).catch(() => null)
      if (n !== null) remote.set(o.id, { n, at: await $.clock.now(), title: o.title, dept, fill: true })
    }
  } finally { filling.delete(o.id) }
  return openChat($, dept, true)
}
// The app action "archive", drawn only for this pane's own session: the app's archive tool on "self" (the app asks you to
// confirm). No prompt instead: a no from you stays a no.
async function archiveSelf($: EngineInterface, a: Extract<Act, { k: 'archive' }>) {
  const key = `q:${a.ask}`
  if (sentItems.has(key) || a.dept !== beat?.id) return
  sentItems.set(key, Infinity)
  const end = await callTool($, ARCHIVE_TOOL, { session_id: 'self', reason: 'Agentville' }, CONSENT.archive)
  if (!('done' in end)) sentItems.delete(key)
  else sentItems.set(key, await $.clock.now())
  $.ui.invalidate('ui.render')
  return $.ui.toast('done' in end ? t('toast.archiving', { name: deptNameIn(usable(await read($, world)), a.dept) }) : 'declined' in end ? t('toast.declined', { why: end.declined }) : 'stopped' in end ? t('toast.toolStopped') : t('toast.archiveFailed'))
}
// Cómo actualizar (the old Actualizar Agentville) and /agentville sync: no order is sent, since the app refuses a mod's /reload-plugins over its
// remote connection (142 of 142 tries refused, 2026-10-20). The session's chat opens (as openChat opens it, its record id
// checked again) and one toast says to type it there, whether or not the chat could open.
async function pressReload($: EngineInterface, dept: string, toast = true) {
  const d = usable(await read($, world))?.depts.find(x => x.id === dept), url = chatUrl(d?.local)
  if (!d) return
  if (url) await $.process.run(['/usr/bin/open', url]).catch(() => null)
  if (toast) await $.ui.toast(t('sync.typeIt', { name: d.name }))
}
// A command held back from another session (commandThere): the app fills no other chat's box from here, so one signed
// fillText order (its whole text, as Arrancar's fill) asks that session to type it in its own empty box, then its chat
// opens; the ticker settles it on the ack (textSettled). A press while one waits only opens the chat again.
async function holdCommand($: EngineInterface, sessionId: string, text: string, cmd: string, surface?: UiCopyArgs['surface']) {
  const key = `text:${sessionId}`
  if (filling.has(key) || remote.has(key)) return pressReload($, sessionId, false) // one order already waits for its ack
  filling.add(key)
  let p: Remote | null = null, sent = false
  try {
    const w = usable(await read($, world)), d = w?.depts.find(x => x.id === sessionId), full = fillTextOf(text)
    if (!d) return void await $.ui.toast(t('toast.cmdThere', { cmd, name: deptNameIn(w, sessionId) })) // the session went
    p = { n: 0, at: await $.clock.now(), title: d.name, dept: sessionId, text, cmd, surface }
    // the order goes BEFORE the chat opens, as Arrancar's, so the box is filled before you can type there
    const n = full ? await order($, sessionId, { kind: 'fillText', text: full }).catch(() => null) : null
    if (n !== null) { remote.set(key, { ...p, n }); sent = true }
  } finally { filling.delete(key) }
  await pressReload($, sessionId, false)
  if (p && !sent) await textSettled($, p, null) // no order went: the clipboard at once
}
// How a held command's fill went: written in that chat's box (or already there), the pane's draft clears when it still
// holds that text; else (busy, failed, no answer, no order) the whole text goes to the clipboard as Copiar copies a
// bubble and the draft stays; a failed copy says the text stays in the field.
async function textSettled($: EngineInterface, p: Remote, r: AckR | null) {
  const text = p.text ?? '', vars = { cmd: p.cmd ?? '', name: usable(await read($, world))?.depts.find(x => x.id === p.dept)?.name ?? p.title }
  if (r === 'filled' || r === 'ready') {
    // the field's draft post lags up to 150 ms behind its text, so the text put back after Enter (pasted) counts too
    if ([drafts.get(p.dept), pasted.get(p.dept)?.text].some(x => x?.trim() === text)) { drafts.delete(p.dept); pasted.delete(p.dept); sentCount++; $.ui.invalidate('ui.render') }
    return $.ui.toast(t('toast.cmdFilled', vars))
  }
  const copied = (await $.ui.copy({ text: fillTextOf(text) ?? text, surface: p.surface }).catch(() => null))?.isCopied === true // what the fill would have typed
  return $.ui.toast(t(copied ? 'toast.cmdCopied' : 'toast.cmdThere', vars))
}
// /reload-plugins (any case, or as /<plugin>:reload-plugins) typed in the pane's field: never sent, its draft cleared.
async function redirectReload($: EngineInterface, sessionId: string) {
  drafts.delete(sessionId)
  pasted.delete(sessionId)
  sentCount++ // the field is drawn anew, empty
  $.ui.invalidate('ui.render')
  await pressReload($, sessionId)
}
// A message for another session that names a command it lists (its commands file, or this session's list, which
// shares your skills and plugins) would run there as typed; the answer and relay paths never send one either. It is
// not sent: a signed fillText order types it in that chat's empty box, unsent (holdCommand), and that chat opens; the
// text stays in the field until it is there. Any other `/text` (a path, an unknown word) is a message. The command as
// `/name`, or null. With no heartbeat (a failed start, the gap after /clear) the pane's own session is unknown, so
// every session counts as another: it fails closed.
async function commandThere($: EngineInterface, sessionId: string, text: string) {
  if ((beat && sessionId === beat.id) || !text.startsWith('/')) return null
  const theirs = await readJson($, commandsFile(await home($), sessionId)).catch(() => null)
  const names = [...(Array.isArray(theirs) ? theirs.map(r => (Array.isArray(r) ? r[0] : null)) : []), ...(await $.command.list().catch(() => [])).map(c => c.name)]
  const run = asCommand(text, names.filter((n): n is string => typeof n === 'string'))
  return run ? `/${run.command}`.slice(0, 60) : null
}
// `/agentville sync [name]` (or sincronizar), typed by you: one line per session (every one, or those with that name)
// saying which are current, asleep, or need /reload-plugins typed in their chat. With one such session, its chat opens.
async function syncCmd($: EngineInterface, name: string) {
  await sync($).catch(() => {})
  const disk = await diskOf($, PROBE_ROOT, await home($), loadedVer ?? undefined).catch(() => null)
  const ver = disk?.clean ? disk.ver : null
  if (!ver) return t('cmd.sync.noDisk')
  const all = usable(await read($, world))?.depts ?? [], want = name.trim().toLowerCase()
  const exact = all.filter(d => d.name.toLowerCase() === want)
  const picked = !want ? all : exact.length ? exact : all.filter(d => d.name.toLowerCase().includes(want))
  if (want && !picked.length) return t('cmd.sync.notFound', { name: name.trim() })
  if (!picked.length) return t('cmd.sync.none')
  const behind = picked.filter(d => d.mod !== ver && !dozing(d))
  if (behind.length === 1) await pressReload($, behind[0]!.id, false)
  return picked.map(d => t(d.mod === ver ? 'cmd.sync.current' : dozing(d) ? 'cmd.sync.asleep' : 'cmd.sync.typeIt', { name: d.name })).join('\n')
}
// Selects an agent; one on another floor takes you there.
async function pickAgent($: EngineInterface, id: string) {
  const w = usable(await read($, world)), floor = w ? floorOfAgent(w, id) : undefined
  await update($, selected, () => id)
  if (floor !== undefined) await update($, floorAtom, () => floor)
}
async function outOf($: EngineInterface, sessionId: string, text: string, sent: string, to?: string): Promise<Out> {
  const w = usable(await read($, world)), d = w?.depts.find(x => x.id === sessionId)
  if (!d || !['trabajando', 'leyendo', 'esperando'].includes(w?.agents.find(x => x.id === `${sessionId}-jefe`)?.state ?? '')) return null
  return { id: sessionId, o: { text: text || sent, sent, base: takenOf(d, sent), at: await $.clock.now(), ...(to ? { to } : {}) } }
}
// A send that failed puts its text back in the field (as a paste goes in) and its images back before any attached since.
function unsend($: EngineInterface, sessionId: string, text: string, files: { path: string; pic: Awaited<ReturnType<typeof thumb>> }[]) {
  if (text) pasted.set(sessionId, { n: ++pasteN, text }) // replaces a paste the field has not taken yet: the failed message wins
  if (files.length) attached.set(sessionId, [...files, ...(attached.get(sessionId) ?? [])])
  $.ui.invalidate('ui.render')
}
// A message: sent from the draft, then the field is drawn anew (a new `clear`) so it comes back empty; a failed send
// brings the draft and its images back.
async function sendDraft($: EngineInterface, sessionId: string, to: string, surface?: UiCopyArgs['surface']) {
  await $.clock.sleep(170) // the field posts its draft 150 ms after the last key: Enviar reads it once that post is in
  const pics = attached.get(sessionId) ?? [], files = pics.map(a => a.path), text = (drafts.get(sessionId) ?? '').trim()
  if (!text && !files.length) return
  if (usable(await read($, world))?.depts.find(d => d.id === sessionId)?.asleep) return void await $.ui.toast(t('toast.asleep')) // a sleeping session reads no mailbox
  if (isReload(text)) return redirectReload($, sessionId) // never sent: only typed in that chat does it work
  const cmd = await commandThere($, sessionId, text)
  if (cmd) return holdCommand($, sessionId, text, cmd, surface) // not sent: the draft stays in the field
  const r = relayed(sessionId, text)
  drafts.delete(sessionId)
  pasted.delete(sessionId)
  attached.delete(sessionId)
  sentCount++
  menuOpen = false
  $.ui.invalidate('ui.render')
  const sent = withImages(r?.text ?? text, files)
  const out = await outOf($, sessionId, text, sent, r?.to).catch(() => null), sub = await subOutOf($, r?.agent, text).catch(() => null)
  const back = () => { unsend($, sessionId, text, pics); return $.ui.toast(t('toast.sendFailed')) }
  await sendMsg($, sessionId, sent, back).then(() => { queueOut($, out); queueSub($, sub); return $.ui.toast(t('toast.sentTo', { name: r?.to ?? to })) }, back).catch(() => {})
}
// Ir al chat: the Claude app's own link to that session's chat, from the record id its heartbeat carries (checked again
// here), opened by /usr/bin/open with argv only. One path for every session, this pane's own too. Arrancar (`start`) takes
// it as well: the app starts a suggestion only from its own card or your own words, so the mod opens that chat, where the
// card is, and you press Start there or Enter on the line pressStart left in its box; the mod sends nothing to start it.
// Aprobar en el chat (`approve`) takes it too: the pane never approves, so it opens the chat where the session asks.
export async function openChat($: EngineInterface, dept: string, start = false, approve = false) {
  const d = usable(await read($, world))?.depts.find(x => x.id === dept), url = chatUrl(d?.local)
  if (!d || !url) return void await $.ui.toast(t(start ? 'toast.startNoChat' : approve ? 'toast.approveNoChat' : 'toast.chatGone', { name: d?.name ?? dept }))
  const r = await $.process.run(['/usr/bin/open', url]).catch(() => null)
  await $.ui.toast(r?.exitCode !== 0 ? t('toast.chatFailed') : t(start ? 'toast.startInChat' : approve ? 'toast.approveInChat' : 'toast.openingChat', { name: d.name }))
}
async function pressed($: EngineInterface, client: string, key: unknown, surface?: UiCopyArgs['surface']) {
  const a = typeof key === 'string' ? acts.get(`${client}:${key}`) : undefined
  if (!a) return
  const redraw = () => $.ui.invalidate('ui.render')
  if (client === 'hits' && String(key).startsWith('note-') && (await $.clock.now()) - notesSince < NOTE_CALM) return
  // An open usage card closes on any press but its own, which then does its job too (the map's zones under the card
  // only close it: see zonesOf). The disk card's buttons belong to it.
  if (pinnedUse && a.k !== 'use' && a.k !== 'diskOrder' && a.k !== 'diskImages' && a.k !== 'offer' && a.k !== 'answer' && a.k !== 'archive') { pinnedUse = null; redraw() }
  if (a.k === 'reply') return reply($, a)
  if (a.k === 'answer') return answerAsk($, a)
  // Descartar never fails silently: a throw on the way (a read, the store) says so and frees the item.
  if (a.k === 'offer') return pressOffer($, a).catch(() => { sentItems.delete(`o:${a.id}`); redraw(); return $.ui.toast(t('toast.dismissFailed', { title: a.title })) })
  if (a.k === 'openChat') return a.start ? pressStart($, a.dept, a.start) : openChat($, a.dept, false, !!a.approve)
  if (a.k === 'archive') return archiveSelf($, a)
  if (a.k === 'reload') return pressReload($, a.dept)
  if (a.k === 'pick') return pickAgent($, a.id)
  if (a.k === 'leave') { // Ir al primero in the tour: leaves it, not finished, for that session
    const cur = tourOf(await $.store.get(TOUR_KEY).catch(() => undefined), Boolean(await $.store.get(INTRO).catch(() => true)))
    await $.store.set(TOUR_KEY, { ...cur, open: false })
    await pickAgent($, a.id)
    return redraw()
  }
  if (a.k === 'tour') return setTour($, a.set)
  if (a.k === 'lang') return pickLang($, a.lang)
  if (a.k === 'flow') { // null: "Una de mis skills" opens the list; the choice is stored when a skill is pressed
    skillsOpen = !a.flow || a.flow.kind === 'skill' // a pick keeps the list open: its tile and "Elegida" show together
    if (!a.flow) skillPage = 0
    if (a.flow) await $.store.set(FLOW_KEY, a.flow)
    return redraw()
  }
  if (a.k === 'skills') { skillPage = a.page; return redraw() }
  if (a.k === 'idleAll') { idleAll = !idleAll; return redraw() }
  if (a.k === 'listPage') { listPage = a.page; return redraw() }
  if (a.k === 'use') { pinnedUse = a.close ? null : pinnedUse === a.id ? null : a.id; return redraw() } // a screen toggles its card; × and zones under it only close
  if (a.k === 'everywhere') return toggleEverywhere($)
  if (a.k === 'zoom') return openZoom($, a.pic) // only a thumbnail the last drawing showed has an act
  if (a.k === 'stop') {
    const d = usable(await read($, world))?.depts.find(x => x.id === a.dept)
    if (d && !d.asleep) await sendOrder($, d.id, { kind: 'stop' }, t('toast.stopping', { name: d.name }))
    return
  }
  if (a.k === 'chat') { if (a.back > 0) chatBack.set(a.dept, a.back); else chatBack.delete(a.dept); return redraw() }
  if (a.k === 'unattach') { attached.delete(a.dept); return redraw() }
  if (a.k === 'send') return sendDraft($, a.dept, a.to, surface)
  if (a.k === 'palette') { if (Object.hasOwn(PALETTES, a.key)) await $.store.set(PALETTE_KEY, a.key); return redraw() }
  if (a.k === 'diskOrder') { // the session's Jefe cleans its own worktrees with the app's tool, nothing else
    const d = usable(await read($, world))?.depts.find(x => x.id === a.id), now = await $.clock.now()
    if (!d || d.asleep) return
    if (orderArmed?.id === d.id && now - orderArmed.at < 5000) {
      orderArmed = null
      redraw()
      return void await sendOrder($, d.id, { kind: 'msg', text: t('disk.order') }, t('toast.sentTo', { name: d.name }))
    }
    const armed = (orderArmed = { id: d.id, at: now, keep: true })
    void $.clock.sleep(5000).then(() => { if (orderArmed === armed) { orderArmed = null; redraw() } }).catch(() => {})
    return redraw()
  }
  if (a.k === 'diskImages') { // the mod's own thumbnails and pasted images; a bubble whose file is gone says so
    const dir = IMAGES(await home($)), now = await $.clock.now()
    if (imagesArmed && now - imagesArmed.at < 5000) {
      const kb = imagesArmed.kb
      imagesArmed = null
      const held = heldImage(dir), all = (await $.fs.list(dir).catch(() => [])).filter(f => f.kind === 'file').map(f => `${dir}/${f.name}`)
      const files = all.filter(f => !held(f))
      for (let i = 0; i < files.length; i += 500) await rmFiles($, files.slice(i, i + 500)) // argv stays far under its limit
      redraw()
      if (!files.length) return void await $.ui.toast(t(all.length ? 'disk.imagesNone' : 'disk.noImages')) // every image held, or none left
      // A failed second measure says no figure, never the whole folder as freed.
      const left = parseDu((await $.process.run(['/usr/bin/du', '-sk', dir]).catch(() => null))?.stdout ?? '')[0]?.kb
      return void await $.ui.toast((left === undefined ? t('disk.imagesGone') : t('disk.imagesDone', { mb: Math.ceil(Math.max(0, kb - left) / 1024) })) + (files.length < all.length ? t('disk.imagesKept') : ''))
    }
    const kb = parseDu((await $.process.run(['/usr/bin/du', '-sk', dir]).catch(() => null))?.stdout ?? '')[0]?.kb ?? 0
    if (!kb) return void await $.ui.toast(t('disk.noImages'))
    const armed = (imagesArmed = { at: now, kb, keep: true })
    void $.clock.sleep(5000).then(() => { if (imagesArmed === armed) { imagesArmed = null; redraw() } }).catch(() => {})
    return redraw()
  }
  await $.store.set(NO_MAP, !a.shown) // 'map'
  redraw()
}
/** What the tool guard answers a call: `command` (it names the store or the key), `store` or `folder` (guardedPath, as
 * spelled or where a symlink or a folder link lands), `failed` (a guarded tool whose path could not be judged), or
 * null (it passes on). Never rejects. */
async function guardOf($: EngineInterface, tool: string, input: unknown): Promise<'command' | 'store' | 'folder' | 'failed' | null> {
  try {
    const command = (input as { command?: unknown } | null)?.command // Bash, or any tool (an MCP shell) that takes one
    if (typeof command === 'string' && guardedCommand(command)) return 'command'
    const path = judged(tool, input)
    if (path === null) return null
    const ht = await home($), spelled = /^[/~]/.test(path) ? path : `${await $.session.cwd()}/${path}`
    const real = await realOf($, spelled.replace(/^~(?=\/|$)/, ht))
    return guardedPath(tool, spelled, ht) ?? (real ? guardedPath(tool, real, ht) : null)
  } catch {
    return judged(tool, input) === null ? null : 'failed'
  }
}
// The only place an agent starts waiting: it fires when the session would really ask you, never for what the mode
// decides alone (tool.check's 'ask' comes before auto mode answers, so it walked agents to you for nothing). While a
// pane is open the request waits there about 8 s (HOLD_MS) for Rechazar; with no answer, or no pane, the session asks
// as usual. The pane never approves: its Aprobar opens the chat where the session asks. True when the pane rejected it.
async function heldDenied($: EngineInterface, tool: string, input: unknown): Promise<boolean> {
  if (!beat) await ensureBeat($).catch(() => {})
  if (!beat) return false
  const key = [...running].find(([, x]) => x === tool)?.[0] ?? MAIN // shortcut: two agents on the same tool share a guess
  const me = beat.id, box = controlFile(await home($), me), now = await $.clock.now()
  // A command (or a tool's arguments) too long to show whole, shown with a part masked, or with characters that draw
  // something else, is answered where you can read it: the session.
  const { cmd, size } = doing(tool, input)
  const req = !PERSON_ONLY.has(tool) && size <= CMD_MAX && !isMaskedCmd(cmd) && !isHiddenCmd(cmd) && (await paneSeen($, now)) ? `${now}-${Math.floor(Math.random() * 1e6)}` : null
  // The hold's end as the pane counts it down (`held`; no answer is offered past it). It stays after the hold runs out
  // unanswered, so the pane says the time is up instead of offering buttons.
  const held = now + HOLD_MS
  await mark($, (b, at) => setAgent(b, key, at, { state: 'esperando', activity: t('act.asks'), cmd, tool, req, held: req ? held : undefined }))
  if (!req) return false
  // Tells an open pane at once (its ticker reads this every second): Rechazar shows now, not on the next 3 s sync.
  await saving
  await $.store.set(REQ_AT, await $.clock.now()).catch(() => {}) // after the save: a sync since `now` must still see it
  let c: Cmd | undefined
  try {
    // No `after` here: an answer names this request's own random id, so a copied-back one matches no other request.
    for (let at = now; at < held; at = await $.clock.now()) {
      c = (await trusted(await ordersAt($, box), await readKey($), at, me)).find(x => x.req === req && x.kind === 'deny')
      if (c) break
      await $.clock.sleep(Math.min(1000, held - at))
    }
  } catch { /* a read failed: the session's own prompt takes over */ } finally {
    await mark($, (b, at) => setAgent(b, key, at, !c ? { req: null } : { state: 'leyendo', activity: t('act.rejected'), req: null, held: undefined }))
  }
  return !!c
}

// shortcut: register's parameters carry no types (the plugin directory reads `export function register(on, options)`
// plainly), so `on` is any and each hook's parameters are untyped (@ts-expect-error per hook); retype them should the
// directory accept annotated parameters. RegisterChecked at the end still checks register against Register.
// @ts-expect-error untyped on purpose, see above
export function register(on, options) {
  const option = (options as { team_flow?: string } | undefined)?.team_flow
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const text = flowRule(await flowNow($, option))
    return { ...r, sections: [...r.sections, ...(text ? [{ id: 'agentville:team-flow', text, scope: 'session' as const }] : []), { id: 'agentville:relay', text: RELAY_RULE, scope: 'session' as const }] }
  })




  // Classic events carry the transcript's path; the title is read from it.

  // What each agent does, from the session's own events. These only observe: they return `next`'s answer.
  // Every row of the main conversation passes here as it is kept: Claude's text as it writes it, and your prompts.
  // A background command's end arrives as a notification prompt; it closes that task on the board.
  // With a team flow on (Agentville's or a skill), every subagent is asked for a plan it keeps current, so its desk shows
  // how far it got (one without the task-list tool still gets an action plan drawn from its steps).
  // The tool guard (guardOf) and the pane's hold of a permission request (heldDenied). Each answers only a fixed deny,
  // written here; everything else passes on. Their parameter names are used nowhere else in this file, so the plugin
  // directory can tell which event each passes on. The pane never approves: it rejects, or opens the session's chat.


  // The pane's buttons (btns.tsx) and the click layers over the map and the tour (bandhits.tsx, `hits-<band>`) post the
  // key pressed: see `pressed`. A key the last drawing did not give does nothing (an agent gone, an office closed).
  // The message field (field.tsx) posts its draft as it changes, a selection to copy, and the text to send on Enter.
  // A pane Button pressed closes an open usage card first, then does its own job (hotkeys go through `pressed`).


}

