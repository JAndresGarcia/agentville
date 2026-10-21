import { atom, read, update } from 'claude-code'
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
export async function homeDir($: EngineInterface) { return (await $.env.get('HOME')) ?? '' }
export async function readJson<T>($: EngineInterface, path: string): Promise<T | null> {
  try { return JSON.parse(await $.fs.read(path)) as T } catch { return null }
}
// A mailbox's orders; a missing or malformed file has none.
export async function ordersAt($: EngineInterface, path: string): Promise<unknown[]> {
  const cmds = (await readJson<{ cmds?: unknown }>($, path))?.cmds
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
    const dir = `${await homeDir($)}/.claude/projects`
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
  const app = APP_DIR(await homeDir($)), r = ids.length ? await $.process.run(sessionsFind(app, ids), { timeoutMs: 5000 }).catch(() => null) : null
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
  const path = controlFile(await homeDir($), sessionId)
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
export function runOut($: EngineInterface, argv: string[]) { return $.process.run(argv).then(r => (r.exitCode === 0 ? r.stdout : null), () => null) }
export async function record($: EngineInterface, path: string) {
  const r = await $.process.run(['/usr/bin/head', '-c', String(RECORD_MAX), path], { timeoutMs: 5000 }).catch(() => null)
  return r?.exitCode === 0 ? recordOf(r.stdout) : null
}
// Made private before anything is written into it, once per module (a folder made earlier with 755 is fixed too).
let rootReady: Promise<unknown> | null = null
export function ensureRoot($: EngineInterface) { return (rootReady ??= (async () => {
  const root = `${await homeDir($)}/.claude/agentville`
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
  const dir = beatsDir(await homeDir($))
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
export function orderFailed($: EngineInterface, err: unknown) { return $.ui.toast(t('toast.orderFailed', { err: err instanceof Error ? err.message : String(err) }).slice(0, 160)) }
// Orders go to the session's mailbox; the toast says it left, the session acts within a couple of seconds.
export function sendOrder($: EngineInterface, sessionId: string, cmd: Omit<Cmd, 'n' | 'sig'>, toast: string, done?: (ok: boolean) => void) { return order($, sessionId, cmd).then(() => { done?.(true); return $.ui.toast(toast) }, (err: unknown) => { done?.(false); return orderFailed($, err) }) }
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
  const dir = beatsDir(await homeDir($))
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
async function viewing($: EngineInterface) { await ensureRoot($); await $.fs.write(viewerFile(await homeDir($)), JSON.stringify({ at: await $.clock.now() })).catch(() => {}) }
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
  loadedVer ??= await versionAt($, $.plugin.root) // what this module loaded, before the disk moves on
  await useLang($)
  const cwd = await $.session.cwd(), now = await $.clock.now()
  const b = newBeat(await $.session.id(), cwd.split('/').filter(Boolean).pop() ?? t('act.session'), now)
  if (loadedVer) b.mod = loadedVer
  // Where the app keeps the transcript; the classic events below say it too, but a session started from another
  // session may never get them.
  transcript ||= `${await homeDir($)}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${b.id}.jsonl`
  carryOver(b, await readJson<Beat>($, `${beatsDir(await homeDir($))}/${b.id}.json`))
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
  const text = JSON.stringify(beat), path = `${beatsDir(await homeDir($))}/${beat.id}.json`
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
    const cmds = await trusted(await ordersAt($, controlFile(await homeDir($), beat.id)), await readKey($), await $.clock.now(), beat.id, seen)
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
  const r = await syncTick($, { root: $.plugin.root, home: await homeDir($), loaded: loadedVer })
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
  const path = `${IMAGES(await homeDir($))}/up-${await $.clock.now()}.png`
  await $.process.run(['/bin/mkdir', '-p', IMAGES(await homeDir($))]).catch(() => null)
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
  const dir = IMAGES(await homeDir($)), file = `${beat?.id ?? 'x'}-${await $.clock.now()}-${Math.floor(Math.random() * 1e6)}`
  // A pasted image is kept whole beside its thumbnail, for a click to open; a named file is opened where it is.
  const ext = 'data' in ref ? ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[ref.media] ?? 'png' : ''
  const src = 'data' in ref ? `${dir}/${file}.${ext}` : ref.path, b64 = `${dir}/${file}.b64`, jpg = `${dir}/${file}.jpg`
  let made = false
  try {
    await ensureRoot($)
    await $.process.run(['/bin/mkdir', '-p', dir]).catch(() => null)
    if ('data' in ref) { await $.fs.write(b64, ref.data); if ((await runOut($, ['/usr/bin/base64', '-D', '-i', b64, '-o', src])) === null) return null }
    if ((await runOut($, [SIPS, '-Z', '240', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', src, '--out', jpg])) === null) return null
    const size = await runOut($, [SIPS, '-g', 'pixelWidth', '-g', 'pixelHeight', jpg]), w = px(size, 'Width'), ht = px(size, 'Height')
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
    const dir = IMAGES(await homeDir($)), big = `${dir}/${p.file}-big.big.jpg`, part = `${dir}/${p.file}-big.s.jpg`
    try {
      const wide = px(await runOut($, [SIPS, '-g', 'pixelWidth', orig]), 'Width') > 900
      if ((await runOut($, [SIPS, ...(wide ? ['--resampleWidth', '900'] : []), '-s', 'format', 'jpeg', '-s', 'formatOptions', '40', orig, '--out', big])) !== null) {
        const size = await runOut($, [SIPS, '-g', 'pixelWidth', '-g', 'pixelHeight', big])
        w = px(size, 'Width'); ht = px(size, 'Height')
      }
      // The desktop stops drawing a pane whose tree grows too heavy (a whole screenshot did), so the viewer keeps ~100 KB
      // of strips; a taller image shows its top and the rest stays a click away in Vista Previa.
      for (let y = 0, used = 0; w && y < ht; y += STRIP) {
        if ((await runOut($, [SIPS, '-c', String(STRIP), String(w), '--cropOffset', String(y), '0', big, '--out', part])) === null) break
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
  const file = commandsFile(await homeDir($), beat.id)
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
  const me = beat.id, dir = `${APP_DIR(await homeDir($))}/claude-code-sessions`
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
  const viewer = await readJson<{ at: number }>($, viewerFile(await homeDir($)))
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
  const root = `${await homeDir($)}/.claude/agentville`
  const old = (sub: string, ttl = (_: string) => WEEK) => $.fs.list(`${root}/${sub}`).catch(() => []).then(fs => fs.filter(f => f.kind === 'file' && now - f.mtimeMs > ttl(f.name)))
  const held = heldImage(`${root}/images`)
  const gone = (await old('images', n => (n.endsWith('.txt') ? WEEK : DAY))).map(f => `${root}/images/${f.name}`).filter(f => !held(f))
  for (const f of await old('sessions')) {
    const id = f.name.replace(/\.json$/, '')
    if (id === mine || !/^[\w-]+$/.test(id)) continue
    gone.push(`${root}/sessions/${id}.json`, commandsFile(await homeDir($), id), controlFile(await homeDir($), id))
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
  const beats = await readBeats($), now = await $.clock.now(), ht = await homeDir($), mine = await $.session.id()
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
    const ht = await homeDir($), mod = `${ht}/.claude/agentville`
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
    const b = whole ? await readJson<Beat>($, `${beatsDir(await homeDir($))}/${a.dept}.json`) : null
    if (!Object.values(b?.agents ?? {}).some(x => x.req === a.req)) { answered.delete(a.req); return $.ui.toast(t('ask.expired', { chat: name })) }
  } catch (err) { answered.delete(a.req); return orderFailed($, err) } // nothing sent: the request shows again
  return order($, a.dept, { kind: a.verdict, req: a.req }).then(() => {
    $.ui.invalidate('ui.render')
    return $.ui.toast(t('toast.rejected'))
  }, (err: unknown) => { answered.delete(a.req); $.ui.invalidate('ui.render'); return orderFailed($, err) })
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
  const theirs = await readJson<unknown[]>($, commandsFile(await homeDir($), sessionId)).catch(() => null)
  const names = [...(Array.isArray(theirs) ? theirs.map(r => (Array.isArray(r) ? r[0] : null)) : []), ...(await $.command.list().catch(() => [])).map(c => c.name)]
  const run = asCommand(text, names.filter((n): n is string => typeof n === 'string'))
  return run ? `/${run.command}`.slice(0, 60) : null
}
// `/agentville sync [name]` (or sincronizar), typed by you: one line per session (every one, or those with that name)
// saying which are current, asleep, or need /reload-plugins typed in their chat. With one such session, its chat opens.
async function syncCmd($: EngineInterface, name: string) {
  await sync($).catch(() => {})
  const disk = await diskOf($, $.plugin.root, await homeDir($), loadedVer ?? undefined).catch(() => null)
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
    const dir = IMAGES(await homeDir($)), now = await $.clock.now()
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
    const ht = await homeDir($), spelled = /^[/~]/.test(path) ? path : `${await $.session.cwd()}/${path}`
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
  const me = beat.id, box = controlFile(await homeDir($), me), now = await $.clock.now()
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

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('session.start', async ($, e, next) => {
    // Refused when the person keeps a user /agentville (the plain name in the menu); this hook still answers it.
    await useLang($)
    await $.command.register({ name: 'agentville', description: t('cmd.description') }).catch(() => {})
    const now = await $.clock.now()
    // A session that ended in this module (/clear, a resume) starts a heartbeat of its own: the old one stays ended.
    if (beat?.ended) { beat = null; starting = null }
    await flowNow($, option).catch(() => {}) // the old-install check runs before any pane order can make a key
    await ensureBeat($)
    hasSips = (await $.fs.stat(SIPS).catch(() => null))?.kind === 'file'
    if (beat) await tidy($, now, beat.id)
    void readMetas($).catch(() => {}) // never holds the session's start
    await retitle($)
    void relink($).catch(() => {})
    // session.start also fires on every hot reload: a pane that stayed open must be drawn again by the new module,
    // and the heartbeat reader (a module variable) must start again.
    await ensurePane($, true)

    return next(e)
  })

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    await ensurePane($, true).catch(() => {})

    return r
  })
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('ui.close', async ($, e, next) => {
    try {
      if (e.id === PANE) { // nobody reads the heartbeats for it, and no session holds a request for it ($.fs has no delete)
        stopTicking()
        await $.process.run(['/bin/rm', '-f', viewerFile(await homeDir($))]).catch(() => null)
      }
      if (e.id === PANE && e.origin.kind === 'person') { // you closed it here: it stays closed here
        await $.store.delete(await flag($, 'open'))
        await $.store.set(await flag($, 'closed'), true)
      }
    } catch { /* a failure here still passes the close on, once */ }

    return next(e)
  })

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('session.end', async ($, e, next) => {
    listener?.cancel()
    listener = null
    // Asleep or gone: everyone's desk goes quiet; the reason says whether the island stays (see isLive).
    await mark($, (b, now) => {
      b.ended = true
      b.endReason = e.reason
      if (openOf(b) > 0) b.openSteps = openOf(b) // the plan it leaves open, said in the list
      for (const key of Object.keys(b.agents)) setAgent(b, key, now, { state: 'inactivo', activity: t('act.asleepMain'), cmd: null, req: null })
      // Its suggested sessions leave with the question; the app's own cards stay.
      delete b.ask
      delete b.offers
    })
    await saving

    return next(e)
  })

  // Classic events carry the transcript's path; the title is read from it.
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('classic.SessionStart', async ($, e, next) => {
    try {
      transcript = e.transcript_path
      void retitle($).catch(() => {})
    } catch { /* a failure here still passes the event on, once */ }

    return next(e)
  })
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      transcript = e.transcript_path
      void retitle($).catch(() => {})
      void relink($).catch(() => {})
    } catch { /* a failure here still passes the prompt on, once */ }

    return next(e)
  })

  // What each agent does, from the session's own events. These only observe: they return `next`'s answer.
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) mainTurn = e.turnId
    await mark($, (b, now) => {
      if (!e.agentId) delete b.ask // a new turn: the question is behind it (the suggested sessions stay)
      setAgent(b, e.agentId ?? MAIN, now, { state: 'trabajando', activity: t('act.thinking'), cmd: null })
    })

    return next(e)
  })
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('turn.complete', async ($, e, next) => {
    const done = () => (e.reason === 'error' ? { state: 'error' as const, activity: t('act.turnFailed') }
      : e.isAborted ? { state: 'inactivo' as const, activity: t('act.stopped') }
      : { state: 'terminado' as const, activity: e.agentId ? t('act.delivered') : t('act.answered') })
    await mark($, (b, now) => {
      setAgent(b, e.agentId ?? MAIN, now, { ...done(), cmd: null, req: null, ...(e.answer ? { answer: e.answer } : {}) })
      // The main turn ended with its plan still open: the list says so until the plan is written again.
      if (!e.agentId) { if (openOf(b) > 0) b.openSteps = openOf(b); else delete b.openSteps }
      // A turn that failed or was stopped leaves no question; one that ended asking (or suggesting sessions) waits for you.
      if (!e.agentId && (e.reason === 'error' || e.isAborted)) delete b.ask
      else if (!e.agentId && hasItem(b, now)) setAgent(b, MAIN, now, waitPatch(b))
    })
    if (!e.agentId) { mainTurn = null; void retitle($).catch(() => {}); void measure($, true).catch(() => {}) }
    // A subagent's tokens add up turn by turn (the session's dollars already include them).
    const u = e.usage, key = e.agentId
    if (key && u) await mark($, b => { const ag = b.agents[key]; if (ag) { ag.tokens = (ag.tokens ?? 0) + u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens; ag.model = u.model } })

    return next(e)
  })
  // Every row of the main conversation passes here as it is kept: Claude's text as it writes it, and your prompts.
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('session.append', async ($, e, next) => {
    try {
      const c = chatFrom(e.message)
      // A subagent's words go to its own desk: selecting it shows them.
      if (e.agentId) {
        const key = e.agentId
        if (c?.who === 'claude' && c.text) await mark($, b => { const ag = b.agents[key]; if (ag) ag.said = addSaid(ag.said, c.text) })
      } else {
        // Its question and suggested sessions (wrap_up, start_session and their results); a message you typed (queued too,
        // never a tool result or an envelope) answers the question.
        if (beat) {
          const b = beat, now = await $.clock.now()
          let changed = asksFrom(b, e.message, now)
          if (c?.who === 'tú' && b.ask) { delete b.ask; changed = true }
          if (changed) await mark($, (x, at) => unwait(x, at))
          // A start or dismiss of any session's suggestion (one withdrawn from here by hand) settles it in every pane.
          const cl = closingsFrom(e.message)
          for (const [tu, id, kind] of cl.uses) { if (closing.size >= 50) closing.clear(); closing.set(tu, [id, kind]) }
          for (const [tu, text] of cl.results) { const c = closing.get(tu); if (c) { closing.delete(tu); if (closedOk(c[1], c[0], text)) await offerDone($, c[0]) } }
        }
        // A prompt sent while the session is busy waits in its queue: it shows as queued until it is delivered.
        if (c && e.door === 'queue') c.queued = true
        if (c?.who === 'tú') c.at = await $.clock.now() // the pane's outbox drops what it sent once a row of yours is newer
        if (c) {
          // A file sent by a relative path is read from the session's folder; thumb takes absolute paths only.
          const refs = imagesOf(e.message), rel = (r: ImgRef) => 'path' in r && !r.path.startsWith('/')
          const cwd = refs.some(rel) ? await $.session.cwd().catch(() => '') : '' // no cwd: the relative ref stays relative and thumb refuses it
          const pics = (await Promise.all(refs.map(r => thumb($, rel(r) && cwd ? { path: `${cwd}/${(r as { path: string }).path}` } : r)))).filter(x => x !== null)
          if (pics.length) c.pics = pics
          await mark($, b => pushChat(b, c))
        }
      }
    } catch { /* a failure here still passes the row on, once */ }

    return next(e)
  })
  // A background command's end arrives as a notification prompt; it closes that task on the board.
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('prompt.submit', async ($, e, next) => {
    try {
      if (e.text.includes('<task-notification>')) await mark($, b => bgFrom(b, e.text))
    } catch { /* it only observes: a failure here never touches the prompt, which passes on once */ }

    return next(e)
  })
  // With a team flow on (Agentville's or a skill), every subagent is asked for a plan it keeps current, so its desk shows
  // how far it got (one without the task-list tool still gets an action plan drawn from its steps).
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('agent.spawn', async ($, e, next) => {
    // Only this plugin's agents and the session's own ones (no plugin prefix) get the plan ask; other plugins' agents are
    // left as their plugin wrote them. The secretaria and Producto answer in a fixed shape: no plan ask for them.
    let sent = e
    try {
      const own = !e.subagentType.includes(':') || e.subagentType.startsWith('agentville:')
      const ask = own && !STAFF.test(e.subagentType) && (await flowNow($, option)).kind !== 'none'
      if (kindOf(e.subagentType) === PROD_KIND) await readMetas($).catch(() => {}) // the board shows the goals it judges by
      sent = !ask || e.prompt.includes(PLAN_ASK) ? e : { ...e, prompt: e.prompt + PLAN_ASK }
    } catch { /* a failure before next passes the spawn on as it came, once */ }
    const r = await next(sent)
    try {
      if (r.agentId) await mark($, (b, now) => setAgent(b, r.agentId!, now, { role: roleOf(e.subagentType), kind: e.subagentType, state: 'leyendo', activity: e.description, cmd: null, goal: e.description }))
    } catch { /* next's answer stands */ }

    return r
  })
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('tool.call', async ($, e, next) => {
    // The helpers read a copy (a built-in call carries its arguments at the top level); `e` goes on to next untouched.
    let key: string, d: ReturnType<typeof doing>, step = 0
    try {
      const seen = { ...e }
      key = e.agentId ?? MAIN
      d = doing(e.tool, seen)
      await mark($, (b, now) => {
        setAgent(b, key, now, { state: d.state, activity: d.activity, cmd: null })
        if (isTaskList(e.tool)) {
          // A subagent's task list is its own; only the main conversation's is the session's plan.
          const ag = e.agentId ? b.agents[key] : undefined
          if (ag) { const own = { notes: ag.notes ?? [] } as Beat; notesFrom(own, seen); ag.notes = own.notes } else { notesFrom(b, seen); delete b.openSteps }
        }
        else step = addStep(b, b.agents[key]!.role, d.activity)
        b.tools = { ...b.tools, [e.tool]: (b.tools?.[e.tool] ?? 0) + 1 }
      })
      running.set(key, e.tool)
    } catch { return next(e) } // a failure before next passes the call on, once; a throw from that next goes up as before
    const r = await next(e).finally(() => running.delete(key)) // runs the permission prompt and the tool
    try {
      const bgId = (r.result as { backgroundTaskId?: string } | undefined)?.backgroundTaskId
      await mark($, b => {
        if (step) endStep(b, step, !r.deny && !r.isError)
        if (bgId) b.bg = [...(b.bg ?? []), { id: bgId, text: d.activity, status: 'corriendo' as const }].slice(-8)
      })
      await mark($, (b, now) => setAgent(b, key, now, 'deny' in r && r.deny !== undefined ? { state: 'leyendo', activity: t('act.denied'), cmd: null, tool: undefined, req: null }
        : r.isError ? { state: 'error', activity: t('act.failed', { what: d.activity }), cmd: null, tool: undefined, req: null } : { state: d.state, activity: d.activity, cmd: null, tool: undefined, req: null }))
    } catch { /* next's answer stands */ }

    return r
  })
  // The tool guard (guardOf) and the pane's hold of a permission request (heldDenied). Each answers only a fixed deny,
  // written here; everything else passes on. Their parameter names are used nowhere else in this file, so the plugin
  // directory can tell which event each passes on. The pane never approves: it rejects, or opens the session's chat.
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('tool.check', async (guardCap, checkEvent, checkNext) => {
    const why = await guardOf(guardCap, checkEvent.tool, checkEvent.input)
    if (why === 'command') return { decision: 'deny', reason: 'The Agentville store holds the key of its mailboxes; commands may not name it.' }
    if (why === 'store') return { decision: 'deny', reason: 'The Agentville store holds the key of its mailboxes; it is not for tools.' }
    if (why === 'folder') return { decision: 'deny', reason: 'Only the Agentville panel and its sessions write ~/.claude/agentville.' }
    if (why === 'failed') return { decision: 'deny', reason: 'Agentville could not check this path; it stays closed.' }
    return checkNext(checkEvent)
  })
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('classic.PermissionRequest', async (holdCap, permEvent, permNext) => {
    if (await heldDenied(holdCap, permEvent.tool_name, permEvent.tool_input).catch(() => false)) return { decision: { behavior: 'deny', message: 'Rejected from Agentville' } }
    return permNext(permEvent)
  })

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('command.run', { command: 'agentville' }, async ($, e) => {
    // English names first, the Spanish ones kept as aliases (AW).
    // `/agentville lang es|en` (or idioma) switches the pane's language and answers in it; it opens no pane.
    const lang = /^\s*(idioma|lang)\s+(es|en)\b/i.exec(e.args ?? '')
    if (lang) { await pickLang($, lang[2]!.toLowerCase() as 'es' | 'en'); return { text: t('cmd.lang') } }
    // `/agentville sync [name]` (or sincronizar): only when you typed it (Enter here, or the Remote Control bridge); never
    // from a model, a plugin or another session's message.
    const syncArgs = /^\s*(?:sync|sincronizar)\b(.*)$/i.exec(e.args ?? '')
    if (syncArgs) { await useLang($); return { text: (['composer', 'bridge'] as string[]).includes(e.origin?.kind ?? '') ? await syncCmd($, syncArgs[1]!) : t('cmd.sync.typed') } }
    // `/agentville refresh` (or limpiar) tidies the map and answers in text; it opens no pane.
    if (/^\s*(refresh|limpiar)\b/i.test(e.args ?? '')) { await useLang($); return { text: await refresh($) } }
    // `/agentville lite` (or ligero, sin mapa) is the way back from a pane that does not draw: it opens without the map.
    if (/\b(ligero|sin mapa|lite)\b/i.test(e.args ?? '')) await $.store.set(NO_MAP, true) // whole words: "elite" is not "lite"
    // `/agentville calibrate clicks` (or calibrar clics) toggles the click diagnostic, never the size calibration.
    // `/agentville click layer` (or capa de clics, list click layer) toggles the session list's one-Client click layer (store flag).
    const listHits = /^\s*(?:capa\s+de\s+clics|(?:list\s+)?click\s+layer)\s*$/i.test(e.args ?? '')
    const hitsNow = listHits && (await $.store.get(LIST_HIT).catch(() => true)) === false // the value stored next, and the reply's
    if (listHits) { await $.store.set(LIST_HIT, hitsNow); $.ui.invalidate('ui.render') }
    // `/agentville simple drawing` (or dibujo simple) toggles the map's shared shapes (store flag `svg-use`): off, every
    // chair, desk and plant is drawn inline as before <use>, should the desktop not draw them.
    const simple = /^\s*(?:dibujo\s+simple|simple\s+drawing)\s*$/i.test(e.args ?? '')
    const useNow = simple && (await $.store.get(SVG_USE).catch(() => true)) === false // the value stored next, and the reply's
    if (simple) { await $.store.set(SVG_USE, useNow); $.ui.invalidate('ui.render') }
    const clicks = /calibr\w*\s+(?:(?:los|mis|my|the)\s+)?cli(c|ck)s?\b/i.test(e.args ?? '')
    if (clicks) { clickDiag = !clickDiag; $.ui.invalidate('ui.render') }
    else if (/calibr/i.test(e.args ?? '')) {
      calib = { start: await $.clock.now(), fromKb: 0, els: /elem/i.test(e.args ?? '') }
      calibTimer?.cancel()
      calibTimer = $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    }
    await $.store.set(await flag($, 'open'), true)
    await $.store.delete(await flag($, 'closed'))
    shownWorld = null // drawn from the world on hand until the opening's sync writes it again
    const opened = await openPane($)
    await useLang($)

    if (clicks) return { text: `${t(clickDiag ? 'cmd.clicksOn' : 'cmd.clicksOff')}${opened.isPlaced ? '' : ` ${t('cmd.pending')}`}` }
    if (listHits) return { text: `${t(hitsNow ? 'cmd.listHitsOn' : 'cmd.listHitsOff')}${opened.isPlaced ? '' : ` ${t('cmd.pending')}`}` }
    if (simple) return { text: `${t(useNow ? 'cmd.svgUseOn' : 'cmd.svgUseOff')}${opened.isPlaced ? '' : ` ${t('cmd.pending')}`}` }
    return { text: opened.isPlaced ? t('cmd.opened') : t('cmd.pending') }
  })

  // The pane's buttons (btns.tsx) and the click layers over the map and the tour (bandhits.tsx, `hits-<band>`) post the
  // key pressed: see `pressed`. A key the last drawing did not give does nothing (an agent gone, an office closed).
  // The message field (field.tsx) posts its draft as it changes, a selection to copy, and the text to send on Enter.
  // A pane Button pressed closes an open usage card first, then does its own job (hotkeys go through `pressed`).
  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('ui.press', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (clickDiag) { await useLang($); await $.ui.toast(t('diag.press', { el: t('diag.pane'), key: e.element.slice(0, 60), ok: t('diag.matched') })) }
    const close = !!pinnedUse && !e.element.startsWith('hot-') && !inClient(e.element, acts.keys())
    if (close) pinnedUse = null // before the Button's own action, which may redraw too
    const done = await next(e)
    if (close) $.ui.invalidate('ui.render')
    return done
  })

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('ui.message', async ($, e, next) => {
    const at = await $.clock.now()
    msgTimes = [...msgTimes.filter(x => at - x < METER_MS), at]
    await useLang($)
    if (e.element.startsWith('btns-') || e.element.startsWith('hits-')) {
      const client = e.element.startsWith('hits-') ? 'hits' : e.element.replace(/~.*$/, ''), key = (e.data as { press?: unknown } | null)?.press
      // The diagnostic says what the press reached, checked as `pressed` checks it: an act for `<client>:<key>`, none,
      // or one dropped in the notes card's calm.
      if (clickDiag) {
        const a = typeof key === 'string' ? acts.get(`${client}:${key}`) : undefined
        const calm = !!a && client === 'hits' && String(key).startsWith('note-') && (await $.clock.now()) - notesSince < NOTE_CALM
        await $.ui.toast(t('diag.press', { el: e.element.slice(0, 60), key: String(key).slice(0, 60), ok: t(!a ? 'diag.none' : calm ? 'diag.calm' : 'diag.matched') }))
      }
      await pressed($, client, key, e.surface)
      return next(e)
    }
    if (!e.element.startsWith('field-')) return next(e)
    const sessionId = e.element.slice('field-'.length), data = (e.data ?? {}) as { draft?: string; send?: string; copy?: string; menu?: boolean; pasteImage?: boolean; probe?: unknown }
    // The diagnostic names what the field posted, never its text; a draft (every keystroke) is not said, nor a menu
    // flag that changes nothing.
    if (clickDiag) {
      const kinds = [typeof data.send === 'string' && 'send', typeof data.menu === 'boolean' && data.menu !== menuOpen && 'menu', typeof data.copy === 'string' && 'copy', data.pasteImage === true && 'pasteImage'].filter(Boolean)
      if (kinds.length) await $.ui.toast(t('diag.press', { el: e.element.slice(0, 60), key: kinds.join(', '), ok: t('diag.matched') }))
    }
    // The key probe: what the key arrived as, so a person can say what Option or Cmd send. A post is untrusted: a
    // short name of letters, digits and dashes or one visible character (Option may type one), and known modifiers only.
    // Said after the draft and the send are handled, and a toast that fails never stops them.
    const [key, mods] = clickDiag && Array.isArray(data.probe) ? data.probe as unknown[] : []
    const probe = typeof key === 'string' && /^(?:[\w-]{0,20}|[^\s\p{C}])$/u.test(key) && Array.isArray(mods) && mods.every(m => ['meta', 'ctrl', 'shift'].includes(m as string))
      ? t('diag.key', { key: [key || t('diag.typed'), ...(mods as string[]).slice(0, 3)].join(' · ') }) : ''
    const done = async () => { if (probe) try { await $.ui.toast(probe) } catch { /* only a diagnostic */ } return next(e) }
    if (typeof data.draft === 'string') {
      drafts.set(sessionId, data.draft)
      const pt = pasted.get(sessionId)
      if (pt && data.draft.includes(pt.text)) { pasted.delete(sessionId); $.ui.invalidate('ui.render') } // the field took it
    }
    if (data.pasteImage) { // Cmd+V in the field: an image on the clipboard joins the next message, else its text goes in the field
      const f = hasSips !== false ? await clipboardImage($) : null
      const pic = f ? await thumb($, { path: f }) : null // awaited before the list is read: two quick pastes keep both
      if (f) { attached.set(sessionId, [...(attached.get(sessionId) ?? []), { path: f, pic }]); $.ui.invalidate('ui.render'); await $.ui.toast(t('toast.attached')) }
      const text = f ? '' : await clipboardText($)
      if (text) { pasted.set(sessionId, { n: ++pasteN, text }); $.ui.invalidate('ui.render') }
      else if (!f && hasSips === false && !toldNoSips) { toldNoSips = true; await $.ui.toast(t('toast.noSips')) }
    }
    if (typeof data.menu === 'boolean' && data.menu !== menuOpen) { menuOpen = data.menu; $.ui.invalidate('ui.render') }
    if (typeof data.copy === 'string') await $.ui.copy({ text: data.copy, surface: e.surface }).catch(() => {})
    if (typeof data.send === 'string' && (data.send.trim() || attached.get(sessionId)?.length)) {
      if (usable(await read($, world))?.depts.find(d => d.id === sessionId)?.asleep) { await $.ui.toast(t('toast.asleep')); return done() }
      if (isReload(data.send)) { await redirectReload($, sessionId); return done() } // never sent: only typed in that chat does it work
      const cmd = await commandThere($, sessionId, data.send.trim())
      if (cmd) { // not sent: Enter emptied the field, so its text goes back in
        pasted.set(sessionId, { n: ++pasteN, text: data.send.trim() })
        $.ui.invalidate('ui.render')
        await holdCommand($, sessionId, data.send.trim(), cmd, e.surface)
        return done()
      }
      const r = relayed(sessionId, data.send.trim())
      drafts.delete(sessionId)
      pasted.delete(sessionId)
      const pics = attached.get(sessionId) ?? [], files = pics.map(a => a.path)
      attached.delete(sessionId)
      if (menuOpen) { menuOpen = false; $.ui.invalidate('ui.render') }
      const to = r?.to ?? agentName(`${sessionId}-jefe`)
      const sent = withImages(r?.text ?? data.send.trim(), files)
      const out = await outOf($, sessionId, data.send.trim(), sent, r?.to).catch(() => null), sub = await subOutOf($, r?.agent, data.send.trim()).catch(() => null)
      // Enter emptied the field: a failed send puts the text and its images back.
      const back = () => { unsend($, sessionId, data.send!.trim(), pics); return $.ui.toast(t('toast.sendFailed')) }
      await sendMsg($, sessionId, sent, back).then(() => { queueOut($, out); queueSub($, sub); return $.ui.toast(t('toast.sentTo', { name: to })) }, back).catch(() => {})
    }

    return done()
  })

  // @ts-expect-error untyped hook parameters: see the shortcut above register
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // A failing drawing shows its error instead of leaving the pane empty.
    try {
    await useLang($)
    const vectorOn = Boolean(await $.store.get(VECTOR_PEOPLE).catch(() => false))
    vectorPeople(vectorOn)
    const useOn = (await $.store.get(SVG_USE).catch(() => true)) !== false
    svgUse(useOn)
    dropBg() // every change asked for so far is drawn by this pass; a later ask waits from this drawing
    const { w, now } = await current($)
    drewAt = now
    const sel = await read($, selected)
    // One floor at a time: its islands, plus whoever waits for you from any floor.
    const floors = floorsOf(w), fl = Math.min(await read($, floorAtom), floors - 1), view = floorView(w, fl)
    // The offices the floor draws: the ladder's latches count these, never an office only in the list or one that comes
    // along `away` for someone who waits for you.
    const drawn = view.depts.filter(d => !d.away && d.room.length).length, shed = (s: Step) => drawn >= shedAt[s]
    const here = (x: AgentvilleWorld['agents'][number]) => !view.depts.find(d => d.id === x.dept)?.away
    // A sleeping session has no island on the map but is still picked in the list.
    const a = view.agents.find(x => x.id === sel && here(x)) ?? w.agents.find(x => x.id === sel && w.depts.some(d => d.id === x.dept && (d.asleep || d.idle))) ?? view.agents.find(here)
    const dept = a && w.depts.find(d => d.id === a.dept)!
    const MAP_W = MAP_MAX_PX
    for (const r of answered) if (!w.agents.some(x => x.req === r)) answered.delete(r)
    // The despacho's items: a Jefe's question and its suggested sessions, less those pressed here (until its Jefe ends a
    // turn after the press) and those the app already started or dismissed for this pane.
    const doneIds = await doneOffers($)
    for (const k of sentItems.keys()) if (!w.depts.some(d => k === `q:${d.ask?.id}` || d.offers?.some(o => k === `o:${o.id}`))) sentItems.delete(k)
    // A note that came back (its Jefe ended a turn after the press, the note still listed) is pressable again: Descartar
    // retries.
    for (const d of w.depts) for (const o of d.offers ?? []) {
      const at = sentItems.get(`o:${o.id}`), j = w.agents.find(x => x.id === `${d.id}-jefe`)
      if (at !== undefined && j?.state === 'esperando' && j.since > at) sentItems.delete(`o:${o.id}`)
    }
    for (const id of elsewhere) if (!w.depts.some(d => d.offers?.some(o => o.id === id))) elsewhere.delete(id)
    const pressedOn = (key: string, deptId: string) => {
      const at = sentItems.get(key), j = w.agents.find(x => x.id === `${deptId}-jefe`)
      return at !== undefined && !(j?.state === 'esperando' && j.since > at)
    }
    const askIn = (d?: AgentvilleDept) => (d?.ask && !pressedOn(`q:${d.ask.id}`, d.id) ? d.ask : undefined)
    const offersIn = (d?: AgentvilleDept) => (d?.offers ?? []).filter(o => !doneIds[o.id] && !pressedOn(`o:${o.id}`, d!.id))
    // A Jefe waiting on the despacho's items (no request, no command, the session holds one): once every one is pressed
    // here or settled by the app, it leaves the queue before its session says so.
    const onItem = (x: AgentvilleWorld['agents'][number]) => { const d = w.depts.find(y => y.id === x.dept); return x.role === 'jefe' && !x.req && !x.cmd && !!(d?.ask || d?.offers?.length) }
    const itemText = (x: AgentvilleWorld['agents'][number]) => {
      const d = w.depts.find(y => y.id === x.dept), n = offersIn(d).length
      return !onItem(x) ? null : askIn(d)?.q ?? (n ? t(n === 1 ? 'q.offers.one' : 'q.offers.many', { n }) : null)
    }
    const queue = w.agents.filter(x => x.state === 'esperando' && !(x.req && answered.has(x.req)) && !(onItem(x) && itemText(x) === null)).sort((m, k) => m.since - k.since)
    // A request's hold (`held`, its end): its whole seconds left while it runs; lapsed once past its end, or once the
    // session let it go unanswered. A lapsed request offers no answer here.
    const lapsed = (x: AgentvilleWorld['agents'][number]) => x.held !== undefined && (!x.req || x.held <= now)
    const left = (x: AgentvilleWorld['agents'][number]) => (x.held === undefined || lapsed(x) ? null : Math.max(1, Math.ceil((x.held - now) / 1000)))
    const P = paletteOf(await $.store.get(PALETTE_KEY).catch(() => undefined)) // no store (a test, a first run): the default
    const hitList = (await $.store.get(LIST_HIT).catch(() => true)) !== false // the session list's one-Client click layer, on unless stored false (off: one Client a row)
    const tab = await read($, tabAtom)
    // The selected session's commands; one that has not published them (an older copy of the mod) borrows this
    // session's, which share your skills and plugins.
    const listOf = async (id?: string) => (id ? await readJson<CmdRow[]>($, commandsFile(await homeDir($), id)) : null)
    const cmds = (await listOf(dept?.id)) ?? (await listOf(beat?.id)) ?? []
    // "archive" is offered only for this pane's own session (the tool archives "self") and only while the app lists the tool.
    // The notes on your desk (the map's marker and its card): every office's question first, then the suggested sessions,
    // the oldest office first.
    // A permission request the pane can answer comes first, while its hold runs: its note opens the card by itself, and its
    // pill selects who asks (the detail card shows the command whole, with Aprobar and Rechazar). The note answers nothing.
    type DeskNote = { d: AgentvilleDept; p: AgentvilleWorld['agents'][number] } | { d: AgentvilleDept; q: NonNullable<AgentvilleDept['ask']> } | { d: AgentvilleDept; o: NonNullable<AgentvilleDept['offers']>[number] }
    const deskNotes: DeskNote[] = [
      ...queue.flatMap(p => { const d = w.depts.find(y => y.id === p.dept); return d && p.req && p.cmd && !lapsed(p) && !isCutCmd(p.cmd) && !isMaskedCmd(p.cmd) && !isHiddenCmd(p.cmd) ? [{ d, p }] : [] }),
      ...w.depts.flatMap(d => { const q = askIn(d); return q ? [{ d, q }] : [] }), ...w.depts.flatMap(d => offersIn(d).map(o => ({ d, o })))]
    // Its pill counts the hold down as Aprobar does (keyed by the request, so only the label moves).
    const answerPill = (p: AgentvilleWorld['agents'][number]) => { const s = left(p); return s === null ? t('notes.answer') : t('notes.answerLeft', { s }) }
    const noteKey = (x: DeskNote) => ('p' in x ? `p:${x.p.req}` : 'q' in x ? `q:${x.q.id}` : `o:${x.o.id}`)
    for (const k of seenNotes) if (!deskNotes.some(x => noteKey(x) === k)) seenNotes.delete(k)
    const notesLabel = deskNotes.length ? t(deskNotes.length === 1 ? 'notes.one' : 'notes.many', { n: deskNotes.length > 9 ? '9+' : deskNotes.length }) : null
    if (pinnedUse === 'notes' && !deskNotes.length) pinnedUse = null // the last one settled: its card goes
    // What a reply to a Jefe's question does, on the detail card and the notes card alike: the exact text it sends (an app
    // action as its prompt), or the app's archive tool (only this pane's own session, while the app lists the tool), or
    // nothing here (null: the app alone does it).
    const PROMPT_OF: Partial<Record<string, string>> = { commit: t('q.commit'), create_pr: t('q.createPr'), merge: t('q.merge') }
    const archiveTool = w.depts.some(d => d.id === beat?.id && !!d.ask?.replies.some(r => r.action === 'archive')) && (await toolsNow($, now)).some(n => ARCHIVE_TOOL.test(n))
    const replyOf = (d: AgentvilleDept, ask: NonNullable<AgentvilleDept['ask']>, r: AgentvilleReply): { act: Act; sub: string } | null => {
      const text = r.app ? PROMPT_OF[r.action ?? ''] : r.text
      if (text) return { act: { k: 'answer', dept: d.id, ask: ask.id, text }, sub: t('q.sends', { text }) }
      return r.action === 'archive' && d.id === beat?.id && archiveTool ? { act: { k: 'archive', dept: d.id, ask: ask.id }, sub: t('q.archive') } : null
    }
    const deptById = (id: string) => w.depts.find(d => d.id === id)
    // A session on another mod than the one on disk (sync.ts): awake, its list row says so and its card offers
    // Cómo actualizar; asleep (dozing), both say it will ask for /reload-plugins when it wakes.
    const older = (d: AgentvilleDept) => !!diskVer && d.mod !== diskVer
    const behind = (d: AgentvilleDept) => older(d) && !dozing(d), waking = (d: AgentvilleDept) => older(d) && dozing(d)
    const deptName = (id: string) => deptById(id)?.name ?? id
    const headline = queue.length === 0 ? t('head.none') : queue.length === 1 ? t('head.one') : t('head.many', { n: queue.length })

    if (e.surface !== 'desktop') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text bold>Agentville · {headline}</Text>
          {queue.map(q => <Text>{roleName(q.role, deptById(q.dept))} · {deptName(q.dept)}: {q.cmd ?? itemText(q)}</Text>)}
          <Text dimColor>{t('pane.desktopOnly')}</Text>
        </Box>
      )
    }

    const ui = $.ui.resolve(e)
    const { Box, Text, Svg, Button, Code, Link } = ui
    if (imagesArmed) { if (imagesArmed.keep) imagesArmed.keep = false; else imagesArmed = null } // an unrelated redraw disarms it
    if (orderArmed) { if (orderArmed.keep) orderArmed.keep = false; else orderArmed = null }
    // The disk screen: what the last measure said; a new one starts in the background when due.
    void measureDisk($, now).catch(() => {})
    const disk = (await $.store.get(DISK_KEY).catch(() => null)) as DiskCache | null
    const wtKb = (disk?.sizes ?? []).reduce((n, x) => n + x.kb, 0)
    const diskView: DiskView | null = !disk ? null : {
      freeGb: disk.freeKb === null ? null : disk.freeKb / GB,
      lines: disk.wt ? [t('disk.wtShort'), `${gbOf(wtKb)} GB · ${disk.wt.length}`] : ['Agentville', disk.modKb === null ? '' : sizeOf(disk.modKb)],
    }
    // The pane's buttons, drawn by btns.tsx: what each press does goes in `acts`, the A, R and D keys in `hot`, and each
    // Client's own elements in `clientEls` (they count toward the limit). `fresh` empties them right before a tree is
    // built, on every path and every pass, with no await between: until then the drawing on screen keeps its keys.
    let hot: [hotkey: string, client: string, key: string][] = [], clientEls = 0, keptDrawn = 0, liveDrawn = 0, keepHits = true
    const fresh = () => { acts.clear(); hot = []; clientEls = 0; keptDrawn = 0; liveDrawn = 0; relayTo = null }
    const act = (client: string, a: Act, item: BtnItem) => { acts.set(`${client}:${item.key}`, a); return item }
    // A list row's ↗ (btns.tsx `chat`): opens the session's chat, only where it has one; it selects nothing.
    const chatOf = (client: string, d: AgentvilleDept) => (chatUrl(d.local) ? { chat: act(client, { k: 'openChat', dept: d.id }, { key: `tochat-${d.id}`, label: '' }).key } : {})
    // `grow`: the Client sits in a Box that takes the rest of its row from a width of none, like the pane's columns, and
    // clips (with no width a Client is as wide as what it draws, so its Texts never truncate and run past the row). The
    // Client itself gets no width or grow: only a Box's are proven on the desktop. The Box counts in the tree's elements.
    // A strip of button pictures (chrome.ts) with their clicks on top (bandhits.tsx): one Svg per line, the parts GAP px
    // apart (or their own `gap`), and ONE band Client per text row of it, keyed `<client>~<row>`, its runs from the same
    // px widths that draw the pictures. A Client never stretches vertically, so a picture two rows tall gets two. Lines
    // break where the next part would pass the map's width (the pane's, estimated): no flex wrap that the runs cannot see.
    type Part = { pic: Pic; key: string; alt: string; words: string; gap?: number }
    const GAP = 8
    // The click layer over one line of pictures `rows` text rows tall, its first row `at` of the area's: one band Client
    // per row, keyed `<client>~<row>`, its runs (px widths, key null for a gap) the very numbers that draw the line. With
    // `only`, one Client on that row alone, keyed and banded by `at` itself (the line's own number: lines of different
    // heights never share a key); `only` names its Buttons.
    const lineHits = (client: string, id: string, at: number, rows: number, runs: [number, string | null][], words: Record<string, string>, only?: number) => {
      const hit = (r: number) => {
        const row = only === undefined ? at + r : at, b = stripBand(row, runs), bp = bandProps(b, BTN_GLOW)
        clientEls += bandEls([b]).clients
        return <Client key={`${client}~${row}`} module="./bandhits.tsx" props={{ ...bp, runs: bp.runs.map(([g, k, sc]) => (k ? [g, k, sc, r ? `${k}~${r + 1}` : k] : [g, k, sc])), words, ...tinted('btns') }} flexGrow={1} />
      }
      return (
        <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="column">
          {rows === 1 ? hit(0) : Array.from({ length: rows }, (_, r) => <Box key={`${id}-${r}`} height={0} flexGrow={1} flexDirection="column" overflow="hidden">{only === undefined || only === r ? hit(r) : null}</Box>)}
        </Box>
      )
    }
    const strip = (client: string, parts: Part[]) => {
      const lines: Part[][] = []
      let wide = Infinity
      for (const [i, p] of parts.entries()) {
        // A part with no gap after it is glued to the next (ES | EN): a line breaks only before a whole glued group.
        let j = i, group = p.pic.w
        while (parts[j]!.gap === 0 && j + 1 < parts.length) group += parts[++j]!.pic.w
        if (!(i > 0 && parts[i - 1]!.gap === 0) && wide + group > mapPx(columns)) { lines.push([]); wide = 0 }
        lines.at(-1)!.push(p); wide += p.pic.w + (p.gap ?? GAP)
      }
      let row = 0
      const drawn = lines.map((line, li) => {
        const gaps = line.map((p, i) => (i < line.length - 1 ? p.gap ?? GAP : 0))
        const runs = line.flatMap((p, i): [number, string | null][] => (gaps[i] ? [[p.pic.w, p.key], [gaps[i]!, null]] : [[p.pic.w, p.key]]))
        const w = runs.reduce((n, [px]) => n + px, 0), rows = Math.max(1, Math.round(Math.max(...line.map(p => p.pic.ht)) / 21)), at = row
        const words = Object.fromEntries(line.map(p => [p.key, p.words]))
        row += rows
        return (
          <Box key={`strip-${client}-${li}`} position="relative" alignSelf="flex-start" flexShrink={0}>
            <Svg source={line.length === 1 ? line[0]!.pic.svg : stripSvg(line.map((p, i) => ({ p: p.pic, gap: gaps[i]! })))} alt={line.map(p => p.alt).join(' · ')} width={w} />
            {lineHits(client, `strip-${client}-${li}`, at, rows, runs, words)}
          </Box>
        )
      })
      return drawn.length === 1 ? drawn[0] : <Box key={`strips-${client}`} flexDirection="column" gap="sm">{drawn}</Box>
    }
    // The pane's buttons, drawn as the mock draws them (chrome.ts): primary (accent) or outlined, one strip of pictures
    // per area. A list row (an item with `desc`) and a hit row (`cells`) stay btns.tsx items.
    const btns = (key: string, items: BtnItem[], dir: BtnsProps['dir'] = 'row', grow = false) => {
      if (items.every(it => it.desc === undefined && it.cells === undefined)) {
        const words = (it: BtnItem) => (it.selected ? `✓ ${it.label}` : it.primary ? `▸ ${it.label}` : it.label)
        return strip(key, items.map(it => ({ pic: btnSvg(words(it), !!it.primary || !!it.selected), key: it.key, alt: words(it), words: words(it) })))
      }
      const props: BtnsProps = { items, dir, colors: { ink: P.ink, dim: P.dim, accent: ACCENT, glow: BTN_GLOW }, ...tinted('btns') }
      clientEls += btnsElements(props)
      return grow
        ? <Box key={`wrap-${key}`} width={0} flexGrow={1} overflow="hidden"><Client key={key} module="./btns.tsx" props={props} /></Box>
        : <Client key={key} module="./btns.tsx" props={props} />
    }
    // paneList: the list's hit rows (every item has `cells`) as pane Buttons, drawn as btns.tsx's hitRow draws them in
    // its Client (same Boxes, keys and covers), each press going through `pressed` as the Client's post would.
    const paneHits = (client: string, items: BtnItem[]) => {
      const press = (key: string) => () => pressed($, client, key)
      return (
        <Box flexDirection="column" gap={0} flexWrap="nowrap" alignItems="stretch" backgroundColor={tinted('btns').tint}>
          {items.map(it => (it.head ? <Box key={`i-${it.key}`} height={it.cells} flexShrink={0} /> : (
            <Box key={`i-${it.key}`} height={it.cells} flexShrink={0} flexDirection="column" alignItems={it.chat ? 'stretch' : 'flex-start'} overflow="hidden">
              {Array.from({ length: it.cells ?? 0 }, (_, r) => (r ? `${it.key}~${r + 1}` : it.key)).map((k, r) => (it.chat ? (
                <Box flexShrink={0} flexDirection="row">
                  <Box width={0} flexGrow={1} height={1} flexShrink={0} flexDirection="row" overflow="hidden"><Button key={k} plain onPress={press(it.key)}>{COVER}</Button></Box>
                  {r < CHAT_LINES && <Box width={CHAT_W} height={1} flexShrink={0} flexDirection="row" overflow="hidden"><Button key={r ? `${it.chat}~${r + 1}` : it.chat} plain onPress={press(it.chat)}>{COVER}</Button></Box>}
                </Box>
              ) : (
                <Box height={1} flexShrink={0} flexDirection="row" overflow="hidden">
                  <Button key={k} plain onPress={press(it.key)}>{COVER}</Button>
                </Box>
              )))}
            </Box>
          )))}
        </Box>
      )
    }
    // A and R (and D) as hidden pane Buttons: plain, invisible, in a Box of no width. Each runs the same action as the
    // button it names, looked up when pressed; one per key, as `keyed` gives them.
    const hotkeys = () => hot.length > 0 && (
      <Box key="hotkeys" position="absolute" top={0} left={0} width={0} overflow="hidden" flexDirection="row">
        {hot.map(([k, client, key]) => <Button key={`hot-${key}`} plain hotkey={k} onPress={() => pressed($, client, key)}>{FILL}</Button>)}
      </Box>
    )
    // Aprobar en el chat and Rechazar for one request, keyed by it; with `keys` they hold A and R and say so. The pane
    // never approves: Aprobar opens the chat where the app asks it (starterIn), and Claude's own prompt approves there.
    const answerItems = (q: AgentvilleWorld['agents'][number], client: string, keys: boolean): BtnItem[] => {
      // The seconds left go in the labels only: the keys (and so the Clients that draw them) stay the same every second.
      const req = q.req!, ok = `q-ok-${req}`, no = `q-no-${req}`, s = left(q)
      if (keys) hot.push(['a', client, ok], ['r', client, no])
      return [
        act(client, { k: 'openChat', dept: starterIn(w, q.dept)?.id ?? q.dept, approve: true }, { key: ok, label: s === null ? t(keys ? 'ask.approveKey' : 'ask.approve') : t(keys ? 'ask.approveKeyLeft' : 'ask.approveLeft', { s }), primary: true }),
        act(client, { k: 'reply', dept: q.dept, req, verdict: 'deny' }, { key: no, label: s === null ? t(keys ? 'ask.rejectKey' : 'ask.reject') : t(keys ? 'ask.rejectKeyLeft' : 'ask.rejectLeft', { s }) }),
      ]
    }
    // Why a card offers no buttons: a command cut or masked, the time to answer here up, or a request the session no
    // longer holds. Either of the last two names the chat where the app asks it (starterIn).
    const unanswerable = (q: AgentvilleWorld['agents'][number]) => isCutCmd(q.cmd) ? <Text color={P.dim}>{t('ask.long')}</Text>
      : isMaskedCmd(q.cmd) ? <Text color={P.dim}>{t('ask.masked')}</Text>
      : isHiddenCmd(q.cmd) ? <Text color={P.dim}>{t('ask.hidden')}</Text>
      : lapsed(q) ? <Text color={P.dim} wrap="wrap">{t('ask.expired', { chat: starterIn(w, q.dept)?.name ?? deptName(q.dept) })}</Text>
      : !q.req ? <Text color={P.dim}>{t('ask.inSession', { session: starterIn(w, q.dept)?.name ?? deptName(q.dept) })}</Text> : null
    // Replies drawn here (the Markdown element takes no style): inline code red and mono, as the chat shows it.
    // `lead` goes before the first paragraph's words (a speaker's name in a bubble).
    const runs = (rs: Run[], ink: string) => rs.map(r => (r.code ? <Text mono color={CODE_INK} backgroundColor={CODE_BG}>{r.t}</Text>
      : r.bold ? <Text color={ink} weight="bold">{r.t}</Text>
      : r.href ? <Link href={r.href}>{r.t}</Link>
      : r.t))
    // A table: one row Box per line, each column a zero-width Box grown by its longest cell (3 to 24), so any number of
    // columns shares the bubble's width and each cell's text wraps inside it; the header bold on a tint of the ink (no
    // element of its own). At most TABLE_ROWS rows and TABLE_COLS columns are drawn, the rest said in one faded line: a
    // reply's table must never make the pane too heavy to draw.
    const TABLE_ROWS = 40, TABLE_COLS = 12
    const table = (b: Extract<Block, { kind: 'table' }>, ink: string) => {
      const rows = b.rows.slice(0, TABLE_ROWS), cols = Math.min(TABLE_COLS, b.head.length)
      const all = [b.head, ...rows], width = (c: Run[]) => c.reduce((n, r) => n + r.t.length, 0)
      const grow = b.head.slice(0, cols).map((_, ci) => Math.min(24, Math.max(3, ...all.map(row => width(row[ci] ?? [])))))
      const hiddenRows = (b.hidden ?? 0) + b.rows.length - rows.length // left out by the fold, then by the cap
      const hiddenCols = b.head.length - cols
      const more = [...(hiddenRows > 0 ? [hiddenRows === 1 ? t('chat.moreRows.one') : t('chat.moreRows.many', { n: hiddenRows })] : []), ...(hiddenCols > 0 ? [hiddenCols === 1 ? t('chat.moreCols.one') : t('chat.moreCols.many', { n: hiddenCols })] : [])]
      const row = (cells: Run[][], head: boolean) => (
        <Box flexDirection="row" gap="sm" backgroundColor={head ? TABLE_HEAD : undefined}>
          {cells.slice(0, cols).map((c, ci) => (
            <Box width={0} flexGrow={grow[ci]} flexDirection="column" alignItems={b.align[ci] === 'r' ? 'flex-end' : b.align[ci] === 'c' ? 'center' : 'flex-start'}>
              <Text color={ink} weight={head ? 'bold' : undefined} wrap="wrap">{runs(c, ink)}</Text>
            </Box>
          ))}
        </Box>
      )
      return (
        <Box flexDirection="column" overflow="hidden">
          {row(b.head, true)}
          {rows.map(r => row(r, false))}
          {more.length > 0 && <Text color={BUBBLE_FADED} size="footnote">{more.join(' · ')}</Text>}
        </Box>
      )
    }
    const rich = (blocks: Block[], ink = P.ink, lead: ReturnType<typeof Text> | null = null) => blocks.map((b, bi) => (b.kind === 'code'
      ? <Code source={b.text} language={b.lang} />
      : b.kind === 'table' ? [bi === 0 && lead ? <Text color={ink}>{lead}</Text> : null, table(b, ink)]
      : (
        <Text color={ink} weight={b.kind === 'h' ? 'bold' : undefined}>
          {bi === 0 ? lead : null}
          {b.kind === 'li' ? `${b.mark} ` : ''}
          {runs(b.runs, ink)}
        </Text>
      )))
    const everywhere = Boolean(await $.store.get(EVERYWHERE))
    const tour = tourOf(await $.store.get(TOUR_KEY).catch(() => undefined), Boolean(await $.store.get(INTRO).catch(() => true)))
    // Spend, context fill and tool calls, appended to a session's existing footnote (no element of its own).
    const fill = (pct: number) => `${t('use.context', { pct })}${pct >= 80 ? ` (${t('use.almostFull')})` : ''}`
    const costOf = (d: AgentvilleDept, withFill = true) => {
      const u = d.usage
      return u ? ` · ${u.usd !== undefined ? `${usd(u.usd)} · ` : ''}${withFill ? `${fill(u.pct)} · ` : ''}${toolsLabel(toolsOf(d))}` : ''
    }
    // A list row's line is cut at its end, so a nearly full context is said right after the state, never cut.
    const nearlyFull = (d: AgentvilleDept) => (d.usage?.pct ?? 0) >= 80
    // A plan left open when the last turn (or the session) ended, or an idle or sleeping office with open steps (a
    // crash before its turn ended); never while its Jefe is at it.
    const planOpen = (d: AgentvilleDept) => {
      const k = d.openSteps || (d.idle || d.asleep ? d.notes.filter(x => !x.done).length : 0)
      return k > 0 && !busy(d.id) ? ` · ${k === 1 ? t('plan.open.one') : t('plan.open.many', { n: k })}` : ''
    }
    const sessions = w.depts.length
    // Sub-offices: a parent's row says how many sessions it started (hidden ones too); the group reads as a tree, each
    // parent then its children (in their order), then theirs, at any depth (a child of a parent from another group stays
    // where it is).
    const coord = (d: AgentvilleDept) => { const k = w.depts.filter(x => (x.from ?? x.parent) === d.id).length; return k ? ` · ${k === 1 ? t('fam.coord.one') : t('fam.coord.many', { n: k })}` : '' }
    const busy = (deptId: string) => ['trabajando', 'leyendo', 'esperando'].includes(w.agents.find(x => x.id === `${deptId}-jefe`)?.state ?? '')
    // Someone in the session waits on a permission (here or in the app): a message sent now goes after it.
    const permWait = (deptId: string) => w.agents.some(x => x.dept === deptId && x.state === 'esperando' && !!x.cmd)
    // ---- the command centre's pieces ----
    type Agent = AgentvilleWorld['agents'][number]
    // `bold` is the design's 600 (names, labels), `heavy` its 700 (the session's title, speakers).
    const tx = (text: string, o: { dim?: boolean; bold?: boolean; heavy?: boolean; size?: 'caption' | 'footnote' | 'body' | 'heading'; color?: string; mono?: boolean } = {}) =>
      <Text color={o.color ?? (o.dim ? P.dim : P.ink)} weight={o.heavy ? 'bold' : o.bold ? 'semibold' : undefined} size={o.size} mono={o.mono}>{text}</Text>
    // One line: a multi-line request (a tool's arguments) never reaches a row's two-row cover.
    const short = (raw: string, k: number) => { const text = raw.replace(/\s+/g, ' ').trim(); return text.length > k ? text.slice(0, k - 1) + '…' : text }
    // Faces and the state pill are drawn whole (box included): the pane's own borders add padding the design has not.
    const face = (role: Agent['role'] | 'me', id: string, wpx: number, name = '') => (
      <Box flexShrink={0}><Svg source={faceSvg(role, id, wpx, { fill: P.raise, stroke: P.line })} alt={name ? t('face.alt', { name }) : t('face.anon')} width={wpx} /></Box>
    )
    // `suggests`: the session waits only on its suggested sessions, in a dim pill with the chip's dot (it blocks nobody).
    const chip = (state: Agent['state'], suggests = false) => {
      const label = suggests ? t('state.sugiere') : STATES[state].label, src = chipSvg(suggests ? 'sugiere' : state, label, suggests ? P.dim : STATE_COLORS[state]!)
      return <Box flexShrink={0}><Svg source={src} alt={label} width={Number(/width="(\d+)"/.exec(src)![1])} /></Box>
    }
    // An invisible click layer over a drawn part (the map's recipe), covering all of it: a plain Button stretched to
    // the part's height (a row with alignItems stretch) and made wider than any part by a long invisible label, inside
    // a Box that never shrinks (so the label is never cut to "..."), clipped to the part by the outer Box.
    const cover = (key: string, onPress: () => void) => (
      <Box flexShrink={0} flexDirection="row" alignItems="stretch">
        <Button key={key} plain hover={{ backgroundColor: 'rgba(255,255,255,0.05)' }} onPress={onPress}>{WIDE_FILL}</Button>
      </Box>
    )
    const hit = (key: string, onPress: () => void) => (
      <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="stretch" overflow="hidden">
        {cover(key, onPress)}
      </Box>
    )
    // A vertical line in the state's colour, beside a session in the list: what is going on at a glance.
    const stripe = (state: Agent['state'], suggests = false) => (
      <Box flexShrink={0}>
        <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 40" width="5" height="40"><rect width="5" height="40" rx="2.5" fill="${suggests ? P.dim : STATE_COLORS[state]}"/></svg>`} alt={suggests ? t('state.sugiere') : STATES[state].label} width={5} />
      </Box>
    )
    const chiefOf = (d: AgentvilleDept) => w.agents.find(x => x.id === `${d.id}-jefe`)
    const waitsIn = (d: AgentvilleDept) => queue.filter(q => q.dept === d.id)
    // Waiting only on its Jefe's suggested sessions (the banner's onlyNotes test): no question, no permission.
    const suggestsIn = (d: AgentvilleDept) => { const ws = waitsIn(d); return ws.length > 0 && ws.every(onItem) && !askIn(d) && offersIn(d).length > 0 }
    const working = (d: AgentvilleDept) => w.agents.some(x => x.dept === d.id && ['trabajando', 'leyendo', 'error'].includes(x.state))
    // The session's leading state: someone waiting wins, then an error, then work.
    const isBusy = (x?: Agent) => !!x && ['trabajando', 'leyendo', 'error'].includes(x.state)
    const teamOf = (d: AgentvilleDept) => w.agents.filter(x => x.dept === d.id)
    // The session's leading state: someone waiting wins, then an error, then work by anyone (a subagent too).
    const stateOf = (d: AgentvilleDept): Agent['state'] => (waitsIn(d).length ? 'esperando' : teamOf(d).some(x => x.state === 'error') ? 'error'
      : isBusy(chiefOf(d)) ? chiefOf(d)!.state : teamOf(d).find(isBusy)?.state ?? chiefOf(d)?.state ?? 'inactivo')
    const groupOf = (d: AgentvilleDept) => (waitsIn(d).length ? 'waiting' as const : working(d) ? 'working' as const : 'idle' as const)
    // Who a session's row speaks for: whoever waits for you, else the one selected, else whoever works, else the Jefe.
    const leadOf = (d: AgentvilleDept) => {
      const team = teamOf(d), chief = chiefOf(d)
      return team.find(x => x.state === 'esperando') ?? team.find(x => x.id === a?.id) ?? (isBusy(chief) ? chief : team.find(isBusy)) ?? chief
    }
    // A list row's words, the same in both lists: the name (↳ under its parent shown in the group, a step per level, its
    // line its own state; else its line names the parent: "de <parent>" when it waits for you in Te esperan, "Encargado
    // de <parent>" when its parent is cut by IDLE_MAX or the page) and its line: the plan left open already says how
    // it ended ("terminó sin cerrar..."), so the state word once; then the sessions it coordinates, before the open steps.
    const rowText = (d: AgentvilleDept, depth: number) => {
      const c = leadOf(d), stt = stateOf(d), sugg = suggestsIn(d), under = depth > 0, parentName = w.depts.find(p => p.id === (d.from ?? d.parent))?.name ?? ''
      const word = waking(d) ? t('sync.asleepRow') : d.asleep ? t('list.asleep') : d.idle ? t('list.quiet') : (sugg ? t('state.sugiere') : STATES[stt].label).toLowerCase(), open = planOpen(d), dup = open.startsWith(` · ${word}`)
      return {
        label: `${under ? '↳ ' : ''}${short(d.name, 30)}`,
        desc: `${c ? agentName(c.id) + ' · ' : ''}${d.parent && !under && parentName ? `${t(waitsIn(d).length ? 'list.of' : 'role.leadOf', { parent: short(parentName, 24) })} · ` : ''}${[dup ? '' : word, behind(d) ? t(d.syncStuck ? 'list.stuck' : 'list.older') : '', coord(d).slice(3), open.slice(3)].filter(Boolean).join(' · ')}${nearlyFull(d) ? ` · ${fill(d.usage!.pct)}` : ''} · ${short(waitsIn(d)[0]?.cmd ?? c?.activity ?? '', 40)}${costOf(d, !nearlyFull(d))}`,
      }
    }
    // Each shown thumbnail is read once; the Svg wraps the jpeg (the desktop draws no Image element).
    // Recovery from a pane too heavy to draw: the desktop freezes past ~1,870 elements. The pane is built, measured
    // and, when too heavy, built again lighter: the map sheds the ladder's steps (STEPS), then hides.
    // ---- the tour: its overlay over the map (tour.ts) and the click layer (bandhits.tsx) ----
    const flow = await flowNow($, option), flowPicked = (await $.store.get(FLOW_KEY).catch(() => undefined)) !== undefined
    // The skills a team flow can name: this session's own and its plugins', never Agentville's or a built-in command.
    const skills = cmds.filter(([n, , src]) => src !== 'builtin' && n !== 'agentville' && !n.startsWith('agentville:') && n === skillName(n)).map(([n]) => n)
    const columns = (e.props as { bodyColumns?: number }).bodyColumns ?? 110
    // The selected chat's pictures weigh on the page too: how far it is paged back and the pictures in its last rows and
    // attached. A latch a chat full of images set is measured again once they are gone (another office, older rows).
    const chat0 = dept?.chat ?? [], back0 = Math.min(chatBack.get(dept?.id ?? '') ?? 0, chat0.length)
    const pics0 = chat0.slice(Math.max(0, chat0.length - CHAT_ROWS - back0), chat0.length - back0).reduce((n, m) => n + (m.pics?.length ?? 0), 0) + (attached.get(dept?.id ?? '')?.length ?? 0)
    const latch = `${bandsAt(view.rows ?? 1, columns)}:${Math.floor(columns / 10)}:${pics0 ? `${dept?.id ?? ''}:${back0}:${pics0}` : ''}${vectorOn ? ':vector' : ''}${useOn ? '' : ':inline'}` // the switches change the map's weight
    if (latch !== latchAt) { latchAt = latch; shedAt = noSteps(); zonesCost = Infinity } // a narrower pane may fit again
    // A click layer over the map: band Boxes about a row tall (see bandCount), a Client in each band that holds a zone,
    // keyed by its band's first row (not its place in the list), so a card opening above it never renames it.
    // What each key does goes in `acts` under the client name `hits`; the Clients' trees count toward the limit.
    const g = (v: number) => Math.max(0, Math.round(v * 10000))
    // A band row that held a zone within HITS_KEEP keeps its Client, with one empty run, so no `hits-<row>` key leaves a
    // drawing for 10 s after its last zone (`keepHits`: only while the drawing stays within CLIENT_MAX). A new band count
    // drops them all at once, so the layer is never kept twice.
    const hitsLayer = (bands: Band[], n: number, actOf: (key: string) => Act | undefined, glow: string | null = null) => {
      for (const b of bands) for (const r of b.runs) { const x = r.key ? actOf(r.key) : undefined; if (r.key && x) acts.set(`hits:${r.key}`, x) }
      if (hitsKeep.n !== n) hitsKeep = { n, rows: new Map() }
      const live = (b: Band) => b.runs.some(r => r.key)
      for (const b of bands) if (live(b)) hitsKeep.rows.set(b.row, now)
      for (const [r, at] of hitsKeep.rows) if (now - at > HITS_KEEP || now < at) hitsKeep.rows.delete(r)
      const kept = new Set(keepHits ? [...hitsKeep.rows.keys()].filter(r => !bands.some(b => b.row === r && live(b))) : [])
      // A merged band without zones splits around each kept row, so the kept Client sits on its own row.
      const drawn = bands.flatMap((b): Band[] => {
        const end = Math.round(b.y1 * n)
        if (live(b) || ![...kept].some(r => r >= b.row && r < end)) return [b]
        const out: Band[] = []
        for (let j = b.row; j < end; j++) {
          const last = out.at(-1), empty = { x0: 0, x1: 1, key: null }
          if (kept.has(j) || !last || kept.has(last.row)) out.push({ y0: j / n, y1: (j + 1) / n, row: j, runs: [empty] })
          else last.y1 = (j + 1) / n
        }
        return out
      })
      keptDrawn = kept.size
      liveDrawn = drawn.filter(live).length
      clientEls += bandEls(drawn).clients + 2 * kept.size // a kept Client draws its row Box and one run Box
      return (
        <Box key="hits" position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="column">
          {drawn.map(b => (
            <Box key={`band-${b.row}`} height={0} flexGrow={g(b.y1 - b.y0)} flexDirection="column" overflow="hidden">
              {live(b) || kept.has(b.row) ? <Client key={`hits-${b.row}`} module="./bandhits.tsx" props={{ ...bandProps(b, glow), ...tinted('hits') }} flexGrow={1} /> : null}
            </Box>
          ))}
        </Box>
      )
    }
    // The header row and the banner of whoever waits longest: drawn in every mode, the tour's too. In the tour the header
    // says the step (n of the steps shown) and holds Saltar (the bubble steps have none of their own).
    const header = (at?: { n: number; total: number; keys: string }) => (
      <Box flexDirection="row" gap="sm" alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Box flexDirection="row" gap="sm" alignItems="center" flexWrap="wrap">
          <Text size="heading" weight="bold" color={P.ink}>Agentville</Text>
          {tx(sessions === 1 ? t('pane.sessions.one') : t('pane.sessions.many', { n: sessions }), { dim: true })}
        </Box>
        {at ? (
          <Box flexDirection="row" gap="xs" alignItems="center" flexWrap="wrap">
            {tx(`${t('tour.open')} · ${t('tour.dots', { n: at.n, total: at.total })}`, { bold: true })}
            {tx(at.keys, { dim: true, size: 'footnote' })}
            {at.n < at.total && btns('btns-head', [act('btns-head', { k: 'tour', set: TOUR_SKIP }, { key: 'tour-skip', label: t('tour.skip') })])}
          </Box>
        ) : (
          <Box flexDirection="row" gap="sm" alignItems="center" flexWrap="wrap">
            {/* Recorrido, Abrir siempre (the mock's primary button and a chip that says whether it is on) and ES | EN (two
                halves touching, the language in use filled; a press switches it, no tour): one strip, one Client. */}
            {(() => {
              const label = `▸ ${t('pane.always')}`, state = everywhere ? t('pane.always.on') : t('pane.always.off')
              act('btns-head', { k: 'tour', set: { open: true, step: 1 } }, { key: 'tour-open', label: t('tour.open') })
              act('btns-head', { k: 'everywhere' }, { key: 'everywhere', label })
              const langs = (['es', 'en'] as const).map((l, i): Part => {
                const inUse = getLang() === l, words = `${t(`pane.lang.${l}`)}${inUse ? ` (${t('pane.lang.on')})` : ''}`
                act('btns-head', { k: 'lang', lang: l }, { key: `lang-${l}`, label: l.toUpperCase() })
                return { pic: btnSvg(l.toUpperCase(), inUse, i ? 'right' : 'left'), key: `lang-${l}`, alt: words, words, gap: 0 }
              })
              return strip('btns-head', [
                { pic: btnSvg(t('tour.open'), false), key: 'tour-open', alt: t('tour.open'), words: t('tour.open') },
                { pic: toggleSvg({ label, on: everywhere, state }), key: 'everywhere', alt: `${label}: ${state}`, words: `${label}: ${state}` },
                ...langs,
              ])
            })()}
          </Box>
        )}
      </Box>
    )
    // Whoever waits longest, answerable right here; the keys A and R are its own when it can be answered. In the tour
    // only a request the banner cannot answer offers Ir al primero: it leaves the tour (not finished) for that session.
    // The mock's strip: "Te espera N", the first one as "<name> (<office>): <what>" cut with an ellipsis, and Ver, which
    // selects it (in the tour it leaves the tour for it). The whole strip takes the click. It answers nothing: its text
    // may be cut at any width, so Aprobar and Rechazar (and the keys A and R) are on the card, which shows the command whole.
    // With the map's clicks on (`notes`), Ver on a Jefe that waits only on suggested sessions opens their notes card.
    const banner = (notes = false) => {
      const first = queue[0]
      if (!first) return null
      const d = w.depts.find(x => x.id === first.dept), onlyNotes = notes && onItem(first) && !askIn(d) && offersIn(d).length > 0
      act('btns-top', tour.open ? { k: 'leave', id: first.id } : onlyNotes ? { k: 'use', id: 'notes' } : { k: 'pick', id: first.id }, { key: 'go-first', label: t('banner.ver') })
      // A permission request whose hold runs (an answer here still counts) marks the strip new until it is answered or lapses.
      const n = queue.length === 1 ? t('banner.one') : t('banner.many', { n: queue.length }), count = queue.some(x => left(x) !== null) ? t('banner.new', { count: n }) : n
      // The banner draws one line (a tool's name and its file); its alt keeps the whole request, as the card shows it.
      const who = `${agentName(first.id)} (${deptName(first.dept)}): `, what = first.cmd ?? itemText(first) ?? first.activity
      return strip('btns-top', [{ pic: bannerSvg({ w: mapPx(columns), count, text: who + cmdTitle(what, first.cmd ? first.tool : null), ver: t('banner.ver') }), key: 'go-first', alt: `${count}. ${who}${what}`, words: t('banner.ver') }])
    }
    // What the pane measured, for diagnosis: the last renders, written to ~/.claude/agentville/render-log.json only while
    // /agentville calibrar runs or the store's RENDER_LOG is on (debugging), never on every render.
    const logRender = async (entry: Record<string, unknown>) => {
      renders = [...renders, entry].slice(-20)
      if (typeof entry.kb === 'number') drewKb = entry.kb // the last pass is the tree that goes out (redrawBg)
      if (!calib && !(await $.store.get(RENDER_LOG).catch(() => false))) return
      void $.fs.write(`${await homeDir($)}/.claude/agentville/render-log.json`, JSON.stringify(renders, (k, v) => (v === Infinity ? null : v), 1)).catch(() => {})
    }
    // The flood meter, with /agentville calibrar clics on: one footer line under the drawing, counted on draws that happen
    // anyway (no timer of its own). Off, the drawing goes out untouched. Its limits are guesses until the live check.
    const metered = (tree: ReturnType<typeof Box>, clients: number) => {
      drawTimes = [...drawTimes.filter(x => now - x < METER_MS), now]
      if (!clickDiag) return tree
      const draws = drawTimes.length / (METER_MS / 1000), msgs = msgTimes.filter(x => now - x < METER_MS).length / (METER_MS / 1000)
      const risk = clients > CLIENT_MAX || draws > 1 || msgs > 20
      const rate = (v: number) => (getLang() === 'es' ? v.toFixed(1).replace('.', ',') : v.toFixed(1)) // ES: decimal comma
      // The numbers hold until the next draw: their age counts up under them, so an idle meter never reads as live.
      const age = ageSvg(s => (s < 60 ? t('diag.age', { n: s }) : t('diag.ageMin', { n: s / 60 })), risk ? P.wait : P.dim, now)
      return (
        <Box flexDirection="column" backgroundColor={P.bg}>
          {tree}
          <Box paddingX={PAD} paddingY="xs" flexDirection="column" gap="xs">
            <Text color={risk ? P.wait : P.dim} size="footnote" wrap="wrap">{`${t('diag.meter', { clients, renders: rate(draws), msgs: rate(msgs) })}${risk ? ` ${t('diag.flood')}` : ''}`}</Text>
            <Svg source={age.svg} alt={t('diag.ageAlt')} width={age.w} />
          </Box>
        </Box>
      )
    }
    // The last resort when even the lightest pass breaks the page's rule (a flood of images, say): one line that says so,
    // never a tree the page refuses, which would freeze the pane on its old picture.
    // The header and whoever waits stay, so a request is still answered here: the first three, each command drawn whole
    // as the card draws it (never cut: an answer is only offered for what is seen), with Aprobar and Rechazar (A and R
    // on the first) or why it has none. A request without a command to show gets no buttons here.
    const tooHeavyTree = () => (
      <Box flexDirection="column" gap="sm" backgroundColor={P.bg} paddingX={PAD} paddingY="sm">
        {header()}
        {banner()}
        {tx(t('pane.tooHeavy'), { dim: true })}
        {queue.slice(0, 3).map((q, i) => (
          <Box key={`last-${q.id}`} flexDirection="column" gap="xs">
            {tx(`${agentName(q.id)} (${deptName(q.dept)})`, { bold: true })}
            {q.cmd && (isToolCall(q.tool) ? <Code source={q.cmd} /> : <Code source={q.cmd} language="bash" />)}
            {unanswerable(q) ?? (q.cmd ? btns(`btns-last-${i}`, answerItems(q, `btns-last-${i}`, i === 0)) : <Text color={P.dim}>{t('ask.long')}</Text>)}
          </Box>
        ))}
        {hotkeys()}
      </Box>
    )
    // The tour: while it is open the pane draws only the header, the banner, the map and the tour's overlay over it with
    // its click layer. Its steps: those whose target this floor has (tourSteps); n of N counts only those. Built again
    // when the page's rule takes the map's people or the map (the pane's latches), so the steps match what is drawn.
    if (tour.open) for (;;) {
      const noMap = Boolean(await $.store.get(NO_MAP).catch(() => false)) || shed('map')
      const tg = tourTargets(view, now, w.agents.find(x => x.id === sel)?.dept), steps = tourSteps(tg, noMap)
      const num = (s: TourStep) => TOUR_STEP_IDS.indexOf(s) + 1
      const i = Math.max(0, steps.findIndex(s => num(s) >= tour.step)), cur = steps[i]!, total = steps.length
      // Entering the flow step with a skill picked opens the list at the pick's page.
      if (cur === 'flow' && tourShown !== 'flow' && flow.kind === 'skill') {
        skillsOpen = true
        skillPage = Math.max(0, Math.floor(skills.indexOf(flow.name) / SKILLS_PER_PAGE))
      }
      tourShown = cur
      const pages = Math.max(1, Math.ceil(skills.length / SKILLS_PER_PAGE)), pg = Math.min(skillPage, pages - 1)
      const pal = TOUR_PALS.find(k => PALETTES[k] === P) ?? 'lobby'
      const target = (tg as Partial<Record<TourStep, TourRect | null>>)[cur] ?? null
      const at = `${cur}:${view.rows ?? 1}:${tg.focusId ?? ''}` // a new step, or a map that changed under it: taken afresh
      if (!target || keptTarget?.at !== at) keptTarget = target ? { at, rect: target } : null
      const last = i === total - 1
      // What the keys say, after the step: S next (Empezar on the last step), T back, X skip.
      const keyHelp = `${t('tour.keys')}: ${[`${TOUR_KEYS.next.toUpperCase()} ${last ? t('tour.start') : t('tour.next')}`, ...(i > 0 ? [`${TOUR_KEYS.back.toUpperCase()} ${t('tour.back')}`] : []), `${TOUR_KEYS.skip.toUpperCase()} ${t('tour.skip')}`].join(' · ')}`
      const ov = tourOverlay({
        step: cur, n: i + 1, total, lang: getLang(), view: viewOf(view.rows ?? 1), target: keptTarget?.rect ?? null,
        // No tile pressed until a flow is picked (or the install option names one).
        name: view.depts.find(d => d.id === tg.focusId)?.name ?? '', flow: flowPicked || flow.kind !== 'none' ? flow.kind : null, everywhere, palette: pal, demoBanner: cur === 'despacho' && !queue.length,
        skills: skillsOpen ? { names: skills, page: pg, picked: flow.kind === 'skill' ? flow.name : null } : null,
      })
      const tourAct = (key: string): Act | undefined => {
        if (key === 'tour-next' && steps[i + 1]) return { k: 'tour', set: { step: num(steps[i + 1]!) } }
        if (key === 'tour-back' && i > 0) return { k: 'tour', set: { step: num(steps[i - 1]!) } }
        if (key === 'tour-done') return { k: 'tour', set: { open: false, step: 1, done: true } }
        if (key === 'tour-skip') return { k: 'tour', set: TOUR_SKIP }
        if (key === 'lang-es' || key === 'lang-en') return { k: 'lang', lang: key === 'lang-es' ? 'es' : 'en' }
        if (key === 'flow-agentville' || key === 'flow-none') return { k: 'flow', flow: { kind: key === 'flow-none' ? 'none' : 'agentville' } }
        if (key === 'flow-skill') return { k: 'flow', flow: null }
        if (key.startsWith('skill-')) return { k: 'flow', flow: { kind: 'skill', name: key.slice(6) } }
        if (key === 'skills-prev' || key === 'skills-more') return { k: 'skills', page: pg + (key === 'skills-more' ? 1 : -1) }
        if (key === 'tour-everywhere') return { k: 'everywhere' }
        if (key.startsWith('tour-pal-')) return { k: 'palette', key: key.slice(9) }
        return undefined
      }
      const noPeople = shed('people'), furn = noMap ? [] : furnitureLayer(view, now, w.depts, diskView)
      const tourTree = (layers: string[]) => {
        fresh()
        // Every control of the step, for its click layer and for the keys (a key works even where no band holds its zone).
        for (const ht of ov.hits) { const x = tourAct(ht.key); if (x) acts.set(`hits:${ht.key}`, x) }
        hot.push([TOUR_KEYS.next, 'hits', last ? 'tour-done' : 'tour-next'])
        if (i > 0) hot.push([TOUR_KEYS.back, 'hits', 'tour-back'])
        hot.push(last ? [TOUR_KEYS.skip, 'hits', 'tour-skip'] : [TOUR_KEYS.skip, 'btns-head', 'tour-skip'])
        return (
          <Box flexDirection="column" gap="sm" backgroundColor={P.bg} paddingX={PAD} paddingY="sm">
            {header({ n: i + 1, total, keys: keyHelp })}
            {banner()}
            {/* Stacked as the visual judge composes it: the house, its furniture and people, then the overlay. */}
            <Box position="relative" alignSelf="center" backgroundColor="#6fa8cf">
              <Svg source={houseOf(noMap ? { ...view, depts: [] } : view)} alt={t('map.alt', { n: fl + 1 })} width={MAP_W} />
              {layers.map((src, k) => (
                <Box key={`layer-${k}`} position="absolute" top={0} left={0}>
                  <Svg source={src} alt={t('svg.mapLayer', { n: k + 2 })} width={MAP_W} />
                </Box>
              ))}
              <Box key="tour-overlay" position="absolute" top={0} left={0}>
                <Svg source={ov.svg} alt={`${ov.alt} ${keyHelp}.`} width={MAP_W} />
              </Box>
              {hitsLayer(bandsOf(ov.hits, bandsAt(view.rows ?? 1, columns)), bandsAt(view.rows ?? 1, columns), tourAct)}
            </Box>
            {hotkeys()}
          </Box>
        )
      }
      // Past the page's rule the tour goes lighter on the pane's latches, but only by its people, then the map (its
      // steps point at the boards and screens), and at worst a line that says so: never a tree the page refuses.
      let tree = tourTree(noMap || noPeople ? furn : [...furn, ...agentsLayer(view, now)]), page = pageOf(tree)
      if (!pageFits(page) && !noMap) {
        const step = noPeople ? 'map' : 'people'
        shedAt[step] = Math.min(shedAt[step], drawn)
        continue
      }
      if (!pageFits(page)) { fresh(); tree = tooHeavyTree(); page = pageOf(tree) }
      const json = JSON.stringify(tree)
      await logRender({ at: now, kb: Math.round(json.length / 1024), elements: (json.match(/"type":/g) ?? []).length + clientEls, clients: clientsIn(json), ...page, tour: cur, n: i + 1, total, lang: getLang() })
      return metered(tree, clientsIn(json))
    }
    keptTarget = null // the tour is closed: its next opening takes its targets afresh
    tourShown = null
    // The band layer's Client budget is CLIENT_MAX less the other Clients: assumed none, then counted on a pass past
    // CLIENT_MAX, so a card closed since the last render never keeps a lighter zone set.
    let othersUsed = 0
    // Thumbnail lines that get a hit Client this render (newest first); past it, or once a pass runs past CLIENT_MAX, a
    // line falls back to pane Buttons (they may lose a first click, but never flood the page).
    let picMax = PIC_HITS
    // The session list's rows as pane Buttons instead of its Client: the ladder's last step past CLIENT_MAX.
    let paneList = false
    // Chat rows past the page's rule with the map already hidden: one fewer a pass, down to one, before the last resort.
    let chatMax = Infinity
    // The zones' step taken this render, to learn what it saved on the next pass; a step given back this render
    // (`retrying`) that did not fit ends the giving back until the next render, so it never loops.
    let taken: { chars: number; byChars: boolean } | null = null, retrying = false, retried = false
    for (;;) {
      const askedNoMap = Boolean(await $.store.get(NO_MAP).catch(() => false)), tooHeavy = shed('map')
      const noMap = askedNoMap || tooHeavy, dt = detailOf(shed)
      const noPeople = !noMap && !dt.people, fewZones = !noMap && shed('zones') // fewZones: each office one zone, the selected one a zone per person
      const houseSvg = noMap ? '' : houseOf(view), furniture = noMap ? [] : furnitureLayer(view, now, w.depts, diskView, notesLabel, dt), people = noMap || noPeople ? [] : agentsLayer(view, now, dt)
      const light = noMap || fewZones // two chat rows
      // The map's click layer (bandhits.tsx): the first of three zone sets whose layer fits GRID_MAX (mode 0, a zone per
      // person in every office; 1, only in the selected office, each other office one zone that selects it, skipped with
      // no office selected as it would be mode 0 again; 2, every office clicked whole), else none (mode -1: the list
      // still picks). Built lazily: the first one usually fits. zoneGrid settles which zone is in front where they
      // overlap; its cells become the band layer's zones.
      // Keys and hover scopes name sessions by a short alias (d0, d1…): a session id is 36 characters, repeated in every
      // Button.
      const rowsShown = Math.min(light ? 2 : CHAT_ROWS, chatMax)
      const all = dept?.chat ?? [], back = Math.min(chatBack.get(dept?.id ?? '') ?? 0, Math.max(0, all.length - rowsShown))
      // What this pane sent that the session has not listed yet (outbox), under the newest rows: each one takes a row.
      const outs = dept ? (outbox.get(dept.id) ?? []).filter(o => now - o.at < OUTBOX_TTL && !tookOut(dept, o, now)) : []
      if (dept) { if (outs.length) outbox.set(dept.id, outs); else outbox.delete(dept.id) }
      const outShown = back === 0 ? outs.slice(-rowsShown) : []
      const from = Math.max(0, all.length - rowsShown + outShown.length - back), visible = all.slice(from, all.length - back)
      // The thumbnails of what is attached to the next message are drawn above its field, read the same way.
      // The last 4 only (the chip counts them all): the tree stays under the desktop's size limit.
      const pending = (attached.get(dept?.id ?? '') ?? []).flatMap(a => (a.pic ? [a.pic] : [])).slice(-4)
      const shown = [...visible.flatMap(m => m.pics ?? []), ...pending]
      // Each shown thumbnail moves to the end; past 40 the ones drawn longest ago go (read again if shown again). One
      // pruned or missing is not kept, and its bubble says so.
      for (const p of shown) {
        // The .txt goes unescaped into an href: base64 only, or it shows as gone.
        const b64 = picCache.get(p.file) ?? await $.fs.read(`${IMAGES(await homeDir($))}/${p.file}.txt`).then((s: string) => (/^[A-Za-z0-9+/=]*$/.test(s) ? s : '')).catch(() => '')
        picCache.delete(p.file)
        if (b64) picCache.set(p.file, b64)
      }
      for (const k of picCache.keys()) if (picCache.size > 40) picCache.delete(k)
      // Within PIC_CHARS, newest first (attached, then the latest message's last); the newest always draws.
      const pictured = new Set<string>()
      let picChars = 0
      for (const p of [...[...pending].reverse(), ...visible.flatMap(m => m.pics ?? []).reverse()]) {
        const n = picCache.get(p.file)?.length ?? 0
        if (!n || pictured.has(p.file)) continue
        if (pictured.size && picChars + n > PIC_CHARS) break
        pictured.add(p.file); picChars += n
      }
      // The placeholder: an outlined box with its words, a few hundred characters (`pad` px of gap drawn right of it), in
      // the row's ink (BUBBLE_INK on a bubble's light tint, P.dim above the field), so it reads on either.
      const hold = { w: Math.ceil(textW(t('img.hold'), 'w400', 12)) + 20, ht: 24 }
      const holdSvg = (pad: number, ink: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${hold.w + pad} ${hold.ht}" width="${hold.w + pad}" height="${hold.ht}"><rect x="0.5" y="0.5" width="${hold.w - 1}" height="${hold.ht - 1}" rx="5" fill="none" stroke="${ink}" stroke-opacity="0.5"/><text x="${hold.w / 2}" y="16" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="12" fill="${ink}">${t('img.hold')}</text></svg>`
      // `pad`: blank px drawn right of the picture (shown `shownW` px wide), the gap to the next one in its line.
      const picSvg = (file: string, w: number, ht: number, pad = 0, shownW = w) => {
        const vw = w + (pad * w) / shownW
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${ht}" width="${vw}" height="${ht}"><image href="data:image/jpeg;base64,${picCache.get(file)}" width="${w}" height="${ht}"/></svg>`
      }
      // Pictures in lines, each at most `most` px wide and PIC_H tall; a click on one opens the zoom. A line's clicks are
      // ONE band Client on its middle text row (bandhits.tsx, the strip's layer), shared by its pictures: a pane Button
      // lost the first click on every redraw. Only `picMax` lines get one (newest first: attached, then the latest
      // message); the rest keep a pane Button per picture, its key scoped by the row (a file may show in two rows). A file
      // shown twice in one row is drawn once (unique keys).
      // Lines break at an estimate of the conversation's width.
      // shortcut: the room is a share of the pane's width, not the bubble's measured one; measure it if lines overflow.
      type RowPic = ChatPic
      const picLines = (list: readonly RowPic[], most: number) => {
        const room = Math.max(most, Math.floor(mapPx(columns) * 0.6) - 60), lines: { p: RowPic; w: number; ht: number }[][] = []
        let wide = Infinity
        for (const [i, p] of list.entries()) {
          if (!picCache.get(p.file) || list.findIndex(q => q.file === p.file) < i) continue
          const w = !pictured.has(p.file) ? hold.w : Math.max(1, Math.round(Math.min(p.w, most, (p.w * PIC_H) / Math.max(1, picHt(p))))), ht = !pictured.has(p.file) ? hold.ht : Math.round((picHt(p) * w) / Math.max(1, p.w))
          if (wide + w > room) { lines.push([]); wide = 0 }
          lines.at(-1)!.push({ p, w, ht }); wide += w + PIC_GAP
        }
        return lines
      }
      // How many of each row's lines get a hit Client: by the row's list, the very array picRow is handed.
      const hitLines = new Map<readonly RowPic[], number>()
      let picLeft = picMax, picDrawn = 0
      for (const [list, most] of [[pending, ATTACHED_THUMB], ...visible.map(m => [m.pics ?? [], THUMB]).reverse()] as [RowPic[], number][]) {
        const n = Math.min(picLeft, picLines(list, most).length)
        hitLines.set(list, n); picLeft -= n
      }
      const picRow = (key: string, list: RowPic[], most: number, ink: string) => {
        const client = `btns-${key.replace(/[^\w-]/g, '_')}`, lines = picLines(list, most), hits = hitLines.get(list) ?? 0
        return (
          <Box key={key} flexDirection="column" gap="xs">
            {lines.map((line, li) => {
              const pad = (i: number) => (i < line.length - 1 ? PIC_GAP : 0), pic = (i: number, p: RowPic, w: number) => <Svg key={`pic-${p.file}`} source={pictured.has(p.file) ? picSvg(p.file, p.w, picHt(p), pad(i), w) : holdSvg(pad(i), ink)} alt={pictured.has(p.file) ? t('img.ofMessage') : t('img.hold')} width={w + pad(i)} />
              if (li < lines.length - hits) { // past the budget (a row's last lines are its newest): a pane Button per picture, as before
                return (
                  <Box key={`${key}-${li}`} flexDirection="row" alignItems="flex-start" alignSelf="flex-start" flexShrink={0}>
                    {line.map(({ p, w }, i) => <Box key={`pb-${p.file}`} position="relative" flexShrink={0}>{pic(i, p, w)}{hit(`pic-open-${p.file}-${client.slice(5)}`, () => void openZoom($, p))}</Box>)}
                  </Box>
                )
              }
              const runs = line.flatMap(({ p, w }, i): [number, string | null][] => (pad(i) ? [[w, `pic-open-${p.file}`], [pad(i), null]] : [[w, `pic-open-${p.file}`]]))
              const rows = Math.max(1, Math.round(Math.max(...line.map(x => x.ht)) / 21))
              for (const { p } of line) act(client, { k: 'zoom', pic: p }, { key: `pic-open-${p.file}`, label: '' })
              picDrawn++
              return (
                <Box key={`${key}-${li}`} position="relative" alignSelf="flex-start" flexShrink={0}>
                  <Box flexDirection="row" alignItems="flex-start">{line.map(({ p, w }, i) => pic(i, p, w))}</Box>
                  {lineHits(client, `${key}-${li}`, li, rows, runs, Object.fromEntries(line.map(({ p }) => [`pic-open-${p.file}`, t('img.ofMessage')])), Math.floor((rows - 1) / 2))}
                </Box>
              )
            })}
            {list.filter((p, i) => !picCache.get(p.file) && list.findIndex(q => q.file === p.file) === i).map(p => <Box key={`pic-${p.file}`}><Text color={ink} size="footnote">{t('img.gone')}</Text></Box>)}
          </Box>
        )
      }
      // The image a click opened, over the conversation of the session it belongs to.
      // A thumbnail zoom whose thumbnail is gone has nothing to draw: closed.
      if (zoom && zoom !== 'loading' && !zoom.strips.length && !picCache.get(zoom.file)) zoom = null
      const z = zoom
      const zoomHere = z === 'loading' || (!!z && shown.some(p => p.file === z.file))
      const zoomStrip = (w: number, rows: number, b64: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows}" width="${w}" height="${rows}"><image href="data:image/jpeg;base64,${b64}" width="${w}" height="${STRIP}"/></svg>`
      const viewer = () => (
        <Box flexDirection="column" gap="xs" backgroundColor={P.card} borderStyle="round" borderColor={P.line} paddingX="sm" paddingY="xs">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap="sm">
            {tx(z === 'loading' ? t('img.opening') : t('img.title'), { bold: true })}
            <Box flexDirection="row" gap="xs">
              {z && z !== 'loading' && z.orig && hasSips !== false && <Button key="zoom-mac" onPress={() => void $.process.run(['/usr/bin/open', '-a', 'Preview', z.orig!]).catch(() => $.ui.toast(t('toast.openFailed')))}>{t('img.preview')}</Button>}
              <Button key="zoom-close" variant="primary" onPress={() => { zoom = null; $.ui.invalidate('ui.render') }}>{t('img.close')}</Button>
            </Box>
          </Box>
          {z && z !== 'loading' && (
            <Box flexDirection="column">
              {z.strips.length
                ? z.strips.map((b64, i) => <Svg key={`strip-${i}`} source={zoomStrip(z.w, Math.min(STRIP, z.ht - i * STRIP), b64)} alt={i ? t('svg.strip', { n: i + 1 }) : t('img.zoomed')} width={z.w} />)
                : <Svg key="strip-thumb" source={picSvg(z.file, z.w, z.ht)} alt={t('img.zoomed')} width={2000} />}
            </Box>
          )}
          {z && z !== 'loading' && !z.strips.length && tx(t('img.small'), { dim: true, size: 'footnote' })}
          {z && z !== 'loading' && z.cut && tx(t('img.below'), { dim: true, size: 'footnote' })}
        </Box>
      )
      // plain: the text drawn as typed, one paragraph a line, never read as Markdown (a relayed message's own words).
      const bubble = (role: Agent['role'] | 'me', id: string, name: string, text: string, you = false, pics: AgentvilleChat['pics'] = [], plain = false) => {
        // A long reply folds by whole blocks (see foldBlocks); Ver más shows only when something was left out.
        // Opened, it folds again at ten times the weight: a reply of thousands of blocks never opens whole.
        const k = `${id}:${keyOf(text)}`, blocks: Block[] = plain ? text.split('\n').map(l => ({ kind: 'p', runs: l ? [{ t: l }] : [] })) : blocksOf(text), fold = foldBlocks(blocks, LONG), open = fold.cut && opened.has(k)
        const shown = open ? foldBlocks(blocks, LONG * 10) : fold
        return (
        // The face at the top of its row, beside the bubble (never under or over it).
        <Box key={`row-${k}`} flexDirection={you ? 'row-reverse' : 'row'} gap="xs" alignItems="flex-start">
          {face(role, id, 36, role === 'me' ? t('chat.you') : name)}{/* the face is yours, whatever the label says */}
          <Box flexDirection="column" gap="xs" flexShrink={1} flexGrow={shown.shown.some(b => b.kind === 'table') ? 1 : undefined} backgroundColor={tint(SHIRTS[role], 0.86)} borderStyle="round" borderColor={SHIRTS[role]} paddingX="sm" paddingY="xs">
            {rich(shown.shown, BUBBLE_INK, <Text color={SHIRTS[role]} weight="bold">{`${name}: `}</Text>)}
            {((open && shown.cut) || noRoom.has(k)) && <Text color={BUBBLE_FADED} size="footnote">{t('chat.noRoom')}</Text>}
            {/* Pane text cannot be selected in the desktop: Copiar copies the whole message, folded part included. Both are
                plain Buttons on a Box of the bubble's dark ink: a plain Button's text keeps the app's light colour, so it reads
                on every bubble tint and palette (the app's own button look vanished on the light bubble). */}
            {(fold.cut || !!text.trim()) && (
              <Box flexDirection="row" gap="xs" alignSelf="flex-start">
                {fold.cut && <Box backgroundColor={BUBBLE_INK} paddingX={1}><Button key={`more-${k}`} plain onPress={() => { noRoom.delete(k); if (open) opened.delete(k); else opened.add(k); $.ui.invalidate('ui.render') }}>{open ? t('chat.less') : t('chat.full')}</Button></Box>}
                {!!text.trim() && <Box backgroundColor={BUBBLE_INK} paddingX={1}><Button key={`copy-${k}`} plain onPress={(press: UiPressArgument) => void $.ui.copy({ text, surface: press.surface }).then((r: UiCopyResult) => (r.isCopied ? $.ui.toast(t('toast.copied')) : undefined)).catch(() => {})}>{t('chat.copy')}</Button></Box>}
              </Box>
            )}
            {pics.length > 0 && picRow(`pics-${k}`, pics, THUMB, BUBBLE_INK)}
          </Box>
        </Box>
        )
      }
      const planCard = (d: AgentvilleDept, full: boolean) => {
        const notes = d.notes
        if (!notes.length) return tx(t('plan.none'), { dim: true, size: 'footnote' })
        const k = notes.filter(x => x.done).length, cur = notes.find(x => x.doing && !x.done)
        const row = (x: (typeof notes)[number], i: number) => (
          <Box key={`task-${i}`} flexDirection="row" gap="xs" alignItems="center">
            <Svg source={planIcon(x.done ? 'done' : x.doing ? 'doing' : 'todo', P.ink, P.dim, P.ok)} alt={x.done ? t('plan.done') : x.doing ? t('plan.doing') : t('plan.todo')} width={14} />
            {tx(x.t, { dim: x.done, bold: !!x.doing && !x.done })}
          </Box>
        )
        // A long plan folds: the finished tasks become one line and only the next four open ones show.
        const open = notes.map((x, i) => [x, i] as const).filter(([x]) => !x.done)
        const fold = !full && notes.length > 5
        return (
          <Box flexDirection="column" gap="xs" backgroundColor={P.card} borderStyle="round" borderColor={P.line} paddingX="sm" paddingY="xs">
            <Box flexDirection="row" justifyContent="space-between" gap="sm">
              {tx(t('plan.head', { status: cur ? t('plan.current', { task: short(cur.t, 48) }) : k === notes.length ? t('plan.complete') : t('plan.notStarted') }), { dim: true, size: 'footnote' })}
              {tx(t('plan.count', { k, n: notes.length }), { dim: true, size: 'footnote', mono: true })}
            </Box>
            <Svg source={progressBar(k, notes.length, P.line, P.ok)} alt={notes.length === 1 ? t('plan.bar.one', { k }) : t('plan.bar.many', { k, n: notes.length })} width={2000} />
            {fold ? (
              <Box flexDirection="column" gap="xs">
                {k > 0 && (
                  <Box flexDirection="row" gap="xs" alignItems="center">
                    <Svg source={planIcon('done', P.ink, P.dim, P.ok)} alt={t('plan.done')} width={14} />
                    {tx(k === 1 ? t('plan.done.one') : t('plan.done.many', { k }), { dim: true })}
                  </Box>
                )}
                {open.slice(0, 4).map(([x, i]) => row(x, i))}
                {open.length > 4 && <Button key="plan-more" plain onPress={() => void update($, tabAtom, () => 'plan')}>{t('plan.more', { n: open.length - 4 })}</Button>}
              </Box>
            ) : notes.map(row)}
          </Box>
        )
      }
      // The office card: what /usage and /context say for the session, and each agent's tokens (no price per agent exists).
      const esc = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)
      // The HQ card: every team on every floor, the most expensive first, with its context fill.
      const hqCardSvg = () => {
        const W = 290, ranked = [...w.depts].sort((x, y) => (y.usage?.usd ?? 0) - (x.usage?.usd ?? 0)), total = ranked.reduce((t, d) => t + (d.usage?.usd ?? 0), 0)
        const rows: string[] = []
        let y = 20
        const text = (x: number, str: string, size: number, color: string, weight = 500, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(str)}</text>`
        rows.push(text(12, t('hq.title'), 12, '#f2a93b', 700) + text(W - CLOSE_W, t(ranked.length === 1 ? 'hq.teams.one' : 'hq.teams.many', { n: ranked.length }), 10, '#b9c0cc', 500, 'end') + cardCloseGlyph(W, '#b9c0cc')); y += 26
        rows.push(text(12, usd(total), 20, '#ffffff', 800)); y += 16
        ranked.slice(0, 12).forEach(d => {
          const pct = d.usage?.pct
          rows.push(`<rect x="12" y="${y - 7}" width="6" height="6" fill="${d.color}"/>` + text(24, short(d.name, 28), 10, '#c9ccd2') + text(W - 70, pct === undefined ? '' : `${pct}%`, 10, pct === undefined ? '#b9c0cc' : ctxColor(pct), 600, 'end') + text(W - 12, d.usage?.usd !== undefined ? usd(d.usage.usd) : t('hq.noData'), 10, '#ffffff', 700, 'end')); y += 16
        })
        if (ranked.length > 12) { rows.push(text(12, ranked.length === 13 ? t('scene.moreTeams.one') : t('scene.moreTeams.many', { n: ranked.length - 12 }), 10, '#b9c0cc')); y += 16 }
        rows.push(text(12, t('hq.pinned'), 10, '#b9c0cc')); y += 6
        return { W, H: y + 6, body: `<g font-family="-apple-system, system-ui, Helvetica, sans-serif"><rect x="0.75" y="0.75" width="${W - 1.5}" height="${y + 4.5}" rx="8" fill="rgba(16,20,28,0.94)" stroke="#f2a93b" stroke-width="1.5"/>${rows.join('')}</g>` }
      }
      // What the disk card lists, and how many worktrees sat unused 30+ days (the cleanup buttons show only then).
      const diskRank = disk?.wt ? rankWorktrees(disk.wt, disk.sizes, disk.sessions, Object.fromEntries(w.depts.map(d => [d.id, { name: d.name, ended: !!d.asleep, pending: w.agents.some(x => x.dept === d.id && ['esperando', 'trabajando', 'leyendo', 'error'].includes(x.state)) }])), now) : null
      // One word per state, as the list says it.
      const STATUS_WORD = { active: t('disk.status.active'), paused: t('list.quiet'), ended: t('list.asleep'), reserva: t('disk.status.reserva') }
      // The disk card: free disk, the biggest worktrees with their session and state, and how many sat unused 30+ days.
      const diskCardSvg = () => {
        const W = 290, rows: string[] = []
        let y = 20
        const text = (x: number, str: string, size: number, color: string, weight = 500, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(str)}</text>`
        const free = disk?.freeKb ?? null, ink = free === null ? '#b9c0cc' : DISK_INK[diskColor(free / GB)]
        rows.push(text(12, t('disk.title'), 12, '#ffffff', 700) + cardCloseGlyph(W, '#b9c0cc')); y += 26
        rows.push(text(12, free === null ? t('disk.measuring') : t('disk.free', { gb: gbOf(free) }), 20, ink, 800)); y += 18
        if (disk?.wt) {
          const { top, stale } = diskRank!
          rows.push(text(12, t('disk.wt', { gb: gbOf(wtKb), n: disk.wt.length }), 10, '#c9ccd2', 600)); y += 16
          for (const x of top) { rows.push(text(12, short(x.name || x.path.split('/').pop()!, 26), 10, '#ffffff', 600) + text(W - 70, STATUS_WORD[x.status], 10, '#b9c0cc', 500, 'end') + text(W - 12, sizeOf(x.kb), 10, '#ffffff', 700, 'end')); y += 16 }
          rows.push(text(12, t('disk.stale', { n: stale }), 10, '#c9ccd2')); y += 16
        } else if (disk) { rows.push(text(12, t('disk.noRegistry'), 10, '#c9ccd2')); y += 16 }
        if (disk?.modKb != null) { rows.push(text(12, t('disk.mod', { mb: Math.round(disk.modKb / 1024) }), 10, '#c9ccd2')); y += 16 }
        rows.push(text(12, t('disk.pinned'), 10, '#b9c0cc')); y += 6
        return { W, H: y + 6, body: `<g font-family="-apple-system, system-ui, Helvetica, sans-serif"><rect x="0.75" y="0.75" width="${W - 1.5}" height="${y + 4.5}" rx="8" fill="rgba(16,20,28,0.94)" stroke="${ink}" stroke-width="1.5"/>${rows.join('')}</g>` }
      }
      const useCardSvg = (d: AgentvilleDept) => {
        const u = d.usage, pct = u?.pct ?? 0, W = 290, team = ROLE_ORDER.flatMap(r => w.agents.filter(x => x.id === `${d.id}-${r}`))
        const tools = Object.entries(d.tools ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t, c2]) => `${t} ${c2}`).join(' · ')
        const lines: string[] = []
        let y = 20
        const text = (x: number, str: string, size: number, color: string, weight = 500, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(str)}</text>`
        lines.push(text(12, short(d.name, 38), 12, '#ffffff', 700) + cardCloseGlyph(W, '#b9c0cc')); y += 26 // 38: clear of the ×
        lines.push(text(12, u?.usd !== undefined ? usd(u.usd) : t('use.none'), 20, '#7fd6a6', 800) + (u ? text(W - 12, t('use.context', { pct }), 10, '#c9ccd2', 600, 'end') : '')); y += 10
        if (u) {
          lines.push(`<rect x="12" y="${y}" width="${W - 24}" height="5" rx="2.5" fill="#3a4150"/><rect x="12" y="${y}" width="${Math.max(5, ((W - 24) * Math.min(100, pct)) / 100)}" height="5" rx="2.5" fill="${ctxColor(pct)}"/>`); y += 19
          lines.push(text(12, `${t('use.tokens', { used: kTok(u.tokens), window: kTok(u.window) })}${u.model ? ` · ${short(u.model, 14)}` : ''}`, 10, '#b9c0cc')); y += 17
          for (const l of u.limits) { lines.push(text(12, l.kind === 'five_hour' ? t('use.fiveHour') : l.kind === 'seven_day' ? t('use.weekly') : l.kind, 10, '#c9ccd2') + text(W - 12, t('use.used', { pct: l.pct }), 10, '#c9ccd2', 600, 'end')); y += 16 }
        }
        if (tools) { lines.push(text(12, t('use.tools', { list: short(tools, 34) }), 10, '#c9ccd2')); y += 17 }
        lines.push(`<line x1="12" x2="${W - 12}" y1="${y - 6}" y2="${y - 6}" stroke="#3a4150"/>`); y += 6
        for (const m of team) {
          lines.push(text(12, `${agentName(m.id)} · ${roleName(m.role, d)}`, 10, '#ffffff', 600) + text(W - 12, m.role === 'jefe' ? t('use.main') : m.tokens ? t('use.agentTokens', { n: kTok(m.tokens) }) : t('use.noDataYet'), 10, '#b9c0cc', 500, 'end')); y += 16
        }
        lines.push(text(12, t('use.pinned'), 10, '#b9c0cc')); y += 6
        return { W, H: y + 6, body: `<g font-family="-apple-system, system-ui, Helvetica, sans-serif"><rect x="0.75" y="0.75" width="${W - 1.5}" height="${y + 4.5}" rx="8" fill="rgba(16,20,28,0.94)" stroke="${d.color}" stroke-width="1.5"/>${lines.join('')}</g>` }
      }
      // The usage cards: each over its own office (the HQ's and the disk's over their screens), opened by a click on its
      // screen; only the open one is drawn. Its × and body are zones of the map's click layer, placed as cardOver places it.
      // The notes card: the mock's .overlay (chrome.ts), drawn in map units divided by the map's drawn scale (mapDrawPx,
      // px per unit) up to the owner's usual width (CARD_REF_PX): below it the card keeps the mock's px size (its 12.5 px text
      // never shrinks), above it one share of the map (~0.29), as at that width. Its height budget (maxH, 260 px at most)
      // is in the card's own px, so above that width it grows with the card too. Its pills' click zones come from the same rects.
      // One office: its Jefe in the title; several: the office on each item. A question whose session's chat the app
      // can open (its record id known and checked) also gets "Ir al chat".
      // A question is an item too: "<Jefe> te pregunta:", the question, a pill per reply whose whole sent text shows on the
      // card in at most 3 lines and still fits the height left (the first question's first reply always does); any other
      // reply says to answer it in the detail card.
      // The card keeps to the corner: about 45% of the map's height, 260 px at most (maxH, spent reply by reply); what does
      // not fit is "+N más".
      type NoteBtn = { i: number; act: PillRect['act']; r: { x: number; y: number; w: number; ht: number } }
      const notesTitle = t(deskNotes.some(x => 'q' in x || 'p' in x) ? 'notes.titleMixed' : 'notes.title')
      const notesCardSvg = () => {
        const one = new Set(deskNotes.map(n => n.d.id)).size === 1, v = viewOf(view.rows ?? 1)
        const k = mapDrawPx(columns) / v.w
        const c = notesCard({
          title: one ? `${notesTitle} · ${agentName(`${deskNotes[0]!.d.id}-jefe`)}` : notesTitle,
          items: deskNotes.map(x => 'p' in x
            ? { office: one ? null : x.d.name, asks: t('ask.asks', { name: agentName(x.p.id), role: roleName(x.p.role, x.d) }), q: cmdTitle(x.p.cmd!, x.p.tool),
                replies: [{ label: answerPill(x.p), line: null, detail: answerPill(x.p) }] }
            : 'q' in x
            ? { office: one ? null : x.d.name, asks: t(x.q.blocked ? 'notes.asksBlocked' : 'q.asks', { name: agentName(`${x.d.id}-jefe`) }), q: x.q.q,
                replies: x.q.replies.map(r => {
                  const y = replyOf(x.d, x.q, r)
                  if (!y) return { inApp: t('q.inApp', { label: r.label }) }
                  const line = y.act.k !== 'answer' ? t('notes.archive', { label: r.label }) : y.act.text === r.label ? null : t('notes.sends', { label: r.label, text: y.act.text })
                  return { label: r.label, line, detail: t('notes.inDetail', { label: r.label }) }
                }), ...(chatUrl(x.d.local) ? { chat: t('notes.openChat') } : {}) }
            : { office: one ? null : x.d.name, title: x.o.title, brief: x.o.brief, ...(elsewhere.has(x.o.id) && chatUrl(x.d.local) ? { chat: t('notes.openChat') } : {}) }),
          more: n => t('fam.more', { n }), start: t('notes.start'), dismiss: t('q.dismiss'), maxH: Math.min(0.45 * v.ht * k, 260),
        })
        const btn: NoteBtn[] = c.pills.map(p => ({ i: p.i, act: p.act, r: { x: p.x / k, y: p.y / k, w: p.w / k, ht: p.ht / k } }))
        const px = (r: NoteBtn['r']) => ({ x: r.x / k, y: r.y / k, w: r.w / k, ht: r.ht / k })
        return { W: c.W / k, H: c.H / k, btn, close: px(c.close), face: px(c.face), body: `<g transform="scale(${1 / k})">${c.body}</g>` }
      }
      const cards: { id: string; alt: string; at: [number, number, number]; card: () => { W: number; H: number; body: string; btn?: NoteBtn[]; close?: NoteBtn['r']; face?: NoteBtn['r'] } }[] = [
        ...view.depts.filter(d => !d.away).map(d => ({ id: d.id, alt: t('map.useOf', { office: d.name }), at: officeTop(d), card: () => useCardSvg(d) })),
        { id: 'hq', alt: t('hq.title'), at: hqTop(), card: () => hqCardSvg() },
        { id: 'disk', alt: t('disk.title'), at: diskTop(), card: () => diskCardSvg() },
        ...(deskNotes.length ? [{ id: 'notes', alt: notesTitle, at: notesTop(), card: () => notesCardSvg() }] : [])]
      // A note not seen yet opens the card by itself, never over another open card (it opens once that one closes); every
      // note the drawn card holds is then seen, so × keeps it shut until a new one arrives.
      if (!noMap && !tour.open && (pinnedUse === null || pinnedUse === 'notes') && deskNotes.some(x => !seenNotes.has(noteKey(x)))) pinnedUse = 'notes'
      const pin = noMap ? null : cards.find(c => c.id === pinnedUse) ?? null, pinCard = pin?.card()
      if (pin?.id === 'notes') for (const x of deskNotes) seenNotes.add(noteKey(x))
      const sig = pin?.id === 'notes' ? deskNotes.map(noteKey).join(' ') : ''
      if (sig !== notesSig) { notesSig = sig; notesSince = await $.clock.now() }
      const pinZones: Zone[] = [], noteActs = new Map<string, Act>()
      // A cell and a band (a text row) as fractions of the map: the click layer's own units, so the zones below come in
      // whole cells and rows (mod-clicks 2).
      const nBands = bandsAt(view.rows ?? 1, columns), cellX = CELL_PX / mapDrawPx(columns), rowY = 1 / nBands
      if (pin && pinCard) {
        // A card with its own close and face rects (the notes card, which leaves room for its shadow) says where its × and
        // its drawn card are. The ×'s zone grows from the drawn ×: about 4 cells wide and 2 rows tall (live: the 24 px
        // corner was too small to hit), cut to the drawn card like the pills' padding, so a click beside the card still
        // only closes it.
        const body = cardRect(view, pin.at, pinCard.W, pinCard.H), face = pinCard.face ? cardPart(view, pin.at, pinCard.W, pinCard.H, pinCard.face) : body
        const x = within(around(cardPart(view, pin.at, pinCard.W, pinCard.H, pinCard.close ?? closeGlyphAt(pinCard.W)), 4 * cellX, 2 * rowY), face)
        pinZones.push({ id: 'card-body', key: 'card-body', group: 'card-body', label: pin.alt, depth: 0, priority: 9, ...body })
        pinZones.push({ id: 'card-close', key: 'card-close', group: 'card-close', label: '', depth: 0, priority: 10, ...x })
        for (const b of pinCard.btn ?? []) { // the notes card's pills: Arrancar and Descartar, a question's replies
          const x = deskNotes[b.i]!
          let g: string, a: Act | null, label: string
          if ('p' in x) { // its one pill: select who asks (keyed by the request, so an older drawing's press finds no act)
            g = `note-perm-${x.p.req}`; a = { k: 'pick', id: x.p.id }; label = answerPill(x.p)
          } else if (b.act === 'chat') {
            g = `note-chat-${'q' in x ? x.q.id : x.o.id}`; a = { k: 'openChat', dept: x.d.id }; label = t('notes.openChat')
          } else if ('q' in x) {
            const r = x.q.replies[b.act as number]!
            g = `note-reply-${x.q.id}-${b.act}`; a = replyOf(x.d, x.q, r)?.act ?? null; label = r.label
          } else { // keyed by the drawn item's own id: a press from an older drawing never reaches another item
            g = `note-${b.act}-${x.o.id}`; label = b.act === 'start' ? t('notes.start') : t('q.dismiss')
            a = b.act === 'start' ? { k: 'openChat', dept: x.d.id, start: { id: x.o.id, title: x.o.title } } : { k: 'offer', dept: x.d.id, id: x.o.id, title: x.o.title }
          }
          if (!a) continue
          noteActs.set(g, a)
          // The whole drawn pill and a cell around it (live: a zone of the pill alone missed its edges). The pill itself
          // ranks above every padding, so a neighbour's padding never takes part of a drawn pill.
          const r = cardPart(view, pin.at, pinCard.W, pinCard.H, b.r)
          pinZones.push({ id: g, key: g, group: g, label, depth: 0, priority: 11, ...r }, { id: g, key: g, group: g, label, depth: 0, priority: 10, ...within(padded(r, cellX, rowY), face) })
        }
      }
      const alias = new Map(view.depts.map((d, i) => [d.id, `d${i}`]))
      const sk = (t: string) => t.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, m => alias.get(m) ?? m)
      const owner = new Map<string, Act>() // a key: what its press does (a usage screen pins its card, else select)
      // An open card: its body takes no click (nothing under it is pressed through it), its × and every other zone but a
      // screen only close it; a screen opens its own card instead.
      const zonesOf = (gr: ReturnType<typeof zoneGrid>): BandZone[] => gr.flatMap(b => b.runs.flatMap(r => {
        if (!r.zone || r.zone.group === 'card-body') return []
        const g = r.zone.group, key = sk(g), screen = g.startsWith('screen-') ? g.slice('screen-'.length) : null
        owner.set(key, noteActs.get(g) ?? (screen ? { k: 'use', id: screen } : pin ? { k: 'use', id: pin.id, close: true } : { k: 'pick', id: r.zone.id }))
        return [{ key, scope: `av-${key}`, x0: r.x0, x1: r.x1, y0: b.y0, y1: b.y1 }]
      }))
      // The desk's notes pin is about a band tall and rarely sits on one: its zone grows to the whole bands it touches, and
      // EDGE_EPS each side (zoneGrid merges edges closer than that, which moved its sides onto the Jefe's), so every point
      // of the drawn pin opens the notes (its priority beats the Jefe's there) and none of it is dead.
      const pinned = (zs: Zone[]) => zs.map(z => (z.group === 'screen-notes' ? { ...z, x0: z.x0 - EDGE_EPS, x1: z.x1 + EDGE_EPS, y0: Math.floor(z.y0 * nBands + 1e-6) / nBands, y1: Math.ceil(z.y1 * nBands - 1e-6) / nBands } : z))
      const onCard = (zs: Zone[]) => pinned(pinZones.length ? [...zs, ...pinZones] : zs)
      let bands: Band[] = [], mode = -1, clicks = 0 // clicks: the layer's whole cost, logged
      // Each zone set also fits the Clients left: one per band that holds a zone, within CLIENT_MAX less the others.
      const budget = CLIENT_MAX - othersUsed
      // Without its people the map's offices are whole zones (mode 2); past the zones step mode 0 is not tried.
      if (!noMap) for (const [i, zs] of [fewZones || noPeople ? null : () => hotspots(view, now, false, undefined, notesLabel, dt), dept && !noPeople ? () => hotspots(view, now, false, dept.id, notesLabel, dt) : null, () => hotspots(view, now, true, undefined, notesLabel, dt)].entries()) {
        if (!zs) continue
        owner.clear()
        const bs = bandsOf(zonesOf(zoneGrid(onCard(zs()))), nBands), cost = bandEls(bs)
        if (cost.pane + cost.clients <= GRID_MAX && bs.filter(b => b.runs.some(r => r.key)).length <= budget) { bands = bs; mode = i; clicks = cost.pane + cost.clients; break }
      }
      if (!bands.length && pinZones.length) { owner.clear(); bands = bandsOf(zonesOf(zoneGrid(pinZones)), nBands); const cost = bandEls(bands); clicks = cost.pane + cost.clients } // a card left open still closes
      fresh() // each pass draws its buttons anew: nothing a lighter pass drops stays pressable
      if (!bands.length) hitsKeep.rows.clear() // the map hid (or lost its zones): no kept band outlives it
      const tree = (
        <Box flexDirection="column" gap="sm" backgroundColor={P.bg} paddingX={PAD} paddingY="sm">
          {header()}

          {floors > 1 && (
            <Box flexDirection="row" gap="xs" alignItems="center" flexWrap="wrap">
              {Array.from({ length: floors }, (_, i) => {
                const waits = queue.filter(q => w.depts.find(d => d.id === q.dept)?.floor === i).length
                return (
                  <Button key={`floor-${i}`} variant={i === fl ? 'primary' : undefined} onPress={() => void update($, floorAtom, () => i)}>
                    {waits ? t(waits > 1 ? 'floor.waits.many' : 'floor.waits.one', { n: i + 1, k: waits }) : t('floor.name', { n: i + 1 })}
                  </Button>
                )
              })}
            </Box>
          )}

          {banner(!noMap && mode >= 0 && deskNotes.length > 0)}

          {/* The scene is stacked Svg pictures; the band click layer over it (bandhits.tsx) makes agents, boards and
              screens clickable, and the list is the backup. The map's Box shrink-wraps the picture (width only, aspect
              kept, alignSelf flex-start), so the bands, spanning it, are the picture's fractions. */}
          {noMap && (
            <Box flexDirection="row" gap="sm" alignItems="center" justifyContent="space-between" flexWrap="wrap" borderStyle="round" borderColor={P.line} paddingX="sm" paddingY="xs">
              {tx(tooHeavy && !askedNoMap ? t('map.tooHeavy') : t('map.lite'), { dim: true })}
              {askedNoMap && btns('btns-map', [act('btns-map', { k: 'map', shown: true }, { key: 'map-on', label: t('map.show') })])}
            </Box>
          )}
          {!noMap && <Box position="relative" alignSelf="center" backgroundColor="#6fa8cf">
            <Svg source={houseSvg} alt={t('map.alt', { n: fl + 1 })} width={MAP_W} />
            {furniture.map((src, i) => (
              <Box key={`furniture-${i}`} position="absolute" top={0} left={0}>
                <Svg source={src} alt={i ? t('svg.mapLayer', { n: i + 1 }) : t('map.furniture')} width={MAP_W} />
              </Box>
            ))}
            {a && !noPeople && (
              <Box position="absolute" top={0} left={0}>
                <Svg source={selectionLayer(view, now, a.id)} alt={t('map.selected', { role: roleName(a.role, dept), office: dept!.name })} width={MAP_W} />
              </Box>
            )}
            {people.map((src, i) => (
              <Box key={`agents-${i}`} position="absolute" top={0} left={0}>
                <Svg source={src} alt={i ? t('svg.mapLayer', { n: i + 1 }) : (view.agents.length === 1 ? t('map.agents.one', { headline }) : t('map.agents.many', { n: view.agents.length, headline }))} width={MAP_W} />
              </Box>
            ))}
            <Box position="absolute" top={0} left={0}>
              <Svg source={selectionLayer(view, now, noPeople ? '' : a?.id ?? '', 'tag', !noPeople, dt.decor)} alt={a && !noPeople ? t('map.roleOf', { role: roleName(a.role, dept), office: dept!.name }) : t('map.names')} width={MAP_W} />
            </Box>
            {/* The open usage card, a layer the map's size so it lines up at any width; under the click layer, whose band
                Buttons hold its × and keep its body from pressing what lies beneath. */}
            {pin && pinCard && (
              <Box key={`usecard-${pin.id}`} position="absolute" top={0} left={0}>
                <Svg source={cardOver(view, pin.at, pinCard.body, pinCard.W, pinCard.H)} alt={pin.alt} width={MAP_W} />
              </Box>
            )}
            {bands.length > 0 && hitsLayer(bands, nBands, key => owner.get(key), GLOW)}
          </Box>}
          {/* The row stays in every mode (blank when every person is clickable), so the map never shifts as modes change.
              As wide as the map (in cells, its estimate) and centered with it, so its note and button line up with it. */}
          {!noMap && (
            <Box flexDirection="row" gap="sm" alignItems="center" justifyContent="space-between" flexWrap="wrap" alignSelf="center" width={Math.floor(mapDrawPx(columns) / CELL_PX)}>
              {(() => {
                const quiet = w.depts.filter(d => d.idle && (d.floor ?? 0) === fl).length
                return tx(mapStrip({ plain: dt.plain, people: !noPeople, decor: dt.decor }, mode, quiet), { dim: true, size: 'footnote' })
              })()}
              {btns('btns-map', [act('btns-map', { k: 'map', shown: false }, { key: 'map-off', label: t('map.hide') })])}
            </Box>
          )}
          {/* The disk card open: ask up to three offices (this one first) to clean their old worktrees, or delete
              Agentville's own images. */}
          {!noMap && pinnedUse === 'disk' && btns('btns-disk', [
            ...(diskRank?.stale ? w.depts.filter(d => !d.asleep).sort((x, y) => Number(y.id === beat?.id) - Number(x.id === beat?.id)).slice(0, 3) : [])
              .map((d, i) => act('btns-disk', { k: 'diskOrder', id: d.id }, { key: `disk-order-${i}`, label: t(orderArmed?.id === d.id ? 'disk.askConfirm' : 'disk.ask', { office: short(d.name, 24) }), primary: i === 0 })),
            act('btns-disk', { k: 'diskImages' }, { key: 'disk-images', label: imagesArmed ? t('disk.imagesConfirm', { mb: Math.max(1, Math.ceil(imagesArmed.kb / 1024)) }) : t('disk.images') }),
          ])}

          {/* Two panels: the sessions grouped by what they need, and the chosen session. */}
          <Box flexDirection="row" gap="md" alignItems="flex-start">
            {!hitList ? (
              <Box flexDirection="column" gap="xs" width={0} minWidth={0} flexGrow={27} overflow="hidden">
                {famGroups(w.depts, groupOf).filter(([, list]) => list.length).map(([gid, list]) => [gid, list, gid === 'idle' ? famCut(list, IDLE_MAX, d => d.id === dept?.id) : list] as const).map(([gid, list, cut]) => (
                  <Box key={`group-${gid}`} flexDirection="column" gap="xs">
                    <Box flexDirection="row" gap="xs">{tx(t(`list.${gid}`).toUpperCase(), { dim: true, size: 'caption', bold: true })}{tx(String(list.length), { size: 'caption', bold: true })}</Box>
                    {famDepths(idleAll ? list : cut).map(([d, depth]) => {
                      const c = leadOf(d), stt = stateOf(d), ck = `btns-pick-${d.id}`, sugg = suggestsIn(d), under = depth > 0, { label, desc } = rowText(d, depth)
                      // The name and its line are the row's button, drawn in the Client; the stripe and the face stay here.
                      // The row clips and the Client grows into the rest of it: its lines truncate inside the list column.
                      return (
                        <Box key={`item-${d.id}`} flexDirection="row" gap="xs" alignItems="center" overflow="hidden" paddingLeft="xs" paddingRight="xs" paddingY="xs" borderStyle="round" borderColor={d.id === dept?.id ? P.line : P.bg} backgroundColor={d.id === dept?.id ? P.sel : undefined}>
                          {under && <Box key={`indent-${d.id}`} width={INDENT * Math.min(depth, 3)} flexShrink={0} />}
                          {stripe(stt, sugg)}
                          {c && face(c.role, c.id, 26, agentName(c.id))}
                          {btns(ck, [act(ck, { k: 'pick', id: chiefOf(d)?.id ?? `${d.id}-jefe` }, { key: `pick-${d.id}`, label, desc, ...chatOf(ck, d) })], 'column', true)}
                        </Box>
                      )
                    })}
                    {cut.length < list.length && (
                      <Button key="idle-more" plain onPress={() => { idleAll = !idleAll; $.ui.invalidate('ui.render') }}>{idleAll ? t('list.less') : t('list.more', { n: list.length - cut.length })}</Button>
                    )}
                  </Box>
                ))}
                {w.depts.length === 0 && tx(t('list.empty'), { dim: true })}
              </Box>
            ) : (
              <Box flexDirection="column" width={0} minWidth={0} flexGrow={27} overflow="hidden">
                {(() => {
                  // The list behind the flag `list-hit-layer`: drawn here as today (stripe, face, the name and its line
                  // as pane Text, the rounded card of the selected row), in a Box laid absolute BEFORE one in-flow
                  // Client, `btns-pick`, of invisible hit rows on top (mod-clicks 3): a click lands on the Client,
                  // whatever the number of sessions. One `rows` array feeds both sides, each row the same `cells` tall,
                  // and no gap between rows on either side (the spacing is inside `cells`). Past CLIENT_MAX on every other
                  // step, the hit rows become pane Buttons (paneList).
                  // Past LIST_MAX rows the list pages: LIST_MAX rows a page (the selected one always drawn too), and a
                  // last item, "Siguientes sesiones", goes to the next page, or "Volver a las primeras sesiones" back.
                  const groups = famGroups(w.depts, groupOf).filter(([, list]) => list.length)
                    .map(([gid, list]) => { const cut = gid === 'idle' ? famCut(list, IDLE_MAX, d => d.id === dept?.id) : list; return [gid, list, idleAll ? list : cut, list.length - cut.length] as const })
                  const paged = groups.reduce((n, [, , open]) => n + open.filter(d => d.id !== dept?.id).length, 0)
                  const waitNow = w.depts.filter(d => waitsIn(d).length).map(d => d.id)
                  if (waitNow.some(id => !waitSeen.has(id))) listPage = 0 // a session that starts waiting is never on a page you are not on
                  waitSeen = new Set(waitNow)
                  const last = Math.max(0, Math.ceil(paged / LIST_MAX) - 1), page = Math.min(listPage, last)
                  let seen = 0
                  // A pressable label drawn as today's plain Button; the hit row over it takes the click, and a press
                  // that reaches it anyway runs the same act.
                  const more = (key: string, a: Act, label: string): { it: BtnItem; el: JSX.Element } => ({
                    it: act('btns-pick', a, { key, label: '', cells: MORE_H }),
                    el: <Button key={`${key}-label`} plain onPress={() => pressed($, 'btns-pick', key)}>{label}</Button>,
                  })
                  const rows = groups.flatMap(([gid, list, open, cutOff]): { it: BtnItem; el: JSX.Element }[] => [
                    { it: { key: `head-${gid}`, label: '', head: true, cells: HEAD_H },
                      el: <Box flexDirection="row" gap="xs">{tx(t(`list.${gid}`).toUpperCase(), { dim: true, size: 'caption', bold: true })}{tx(String(list.length), { size: 'caption', bold: true })}</Box> },
                    ...famDepths(open.filter(d => d.id === dept?.id || Math.floor(seen++ / LIST_MAX) === page)).map(([d, depth]) => {
                      const c = leadOf(d), stt = stateOf(d), sugg = suggestsIn(d), under = depth > 0, { label, desc } = rowText(d, depth), chat = chatOf('btns-pick', d)
                      return {
                        it: act('btns-pick', { k: 'pick', id: chiefOf(d)?.id ?? `${d.id}-jefe` }, { key: `pick-${d.id}`, label: '', cells: ROW_H, ...chat }),
                        el: (
                          <Box key={`item-${d.id}`} flexDirection="row" gap="xs" alignItems="center" overflow="hidden" paddingLeft="xs" paddingRight="xs" paddingY="xs" borderStyle="round" borderColor={d.id === dept?.id ? P.line : P.bg} backgroundColor={d.id === dept?.id ? P.sel : undefined}>
                            {under && <Box key={`indent-${d.id}`} width={INDENT * Math.min(depth, 3)} flexShrink={0} />}
                            {stripe(stt, sugg)}
                            {c && face(c.role, c.id, 26, agentName(c.id))}
                            <Box width={0} flexGrow={1} overflow="hidden" flexDirection="column">
                              <Text color={P.ink} weight="bold" wrap="truncate-end">{label}</Text>
                              <Text color={P.dim} size="footnote" wrap="truncate-end">{short(desc, 300)}</Text>
                            </Box>
                            {chat.chat && <Box key={`chatgap-${d.id}`} width={CHAT_W} flexShrink={0} />}
                          </Box>
                        ),
                      }
                    }),
                    ...(cutOff
                      ? [more('idle-more', { k: 'idleAll' }, idleAll ? t('list.less') : t('list.more', { n: cutOff }))]
                      : []),
                  ]).concat(paged > LIST_MAX ? [more('list-more', { k: 'listPage', page: page < last ? page + 1 : 0 }, t(page < last ? 'list.next' : 'list.backFirst'))] : [])
                  if (!rows.length) return null
                  const items = rows.map(r => r.it)
                  return (
                    <Box key="list" position="relative" flexDirection="column">
                      <Box key="list-drawn" position="absolute" top={0} left={0} right={0} flexDirection="column">
                        {/* A row's ↗ sits in the row's last CHAT_W cells, laid over the card (which keeps those cells free): its
                            right edge is the list's, as the hit row's ↗ Button's is, whatever the card's padding and border.
                            Its column is the card's two lines (a bold line over a footnote one), centred in the row as the
                            card is, so the ↗ sits on the name line. */}
                        {rows.map(r => (
                          <Box key={`li-${r.it.key}`} position="relative" height={r.it.cells} flexShrink={0} flexDirection="column" justifyContent={r.it.head ? 'flex-end' : 'center'} overflow="hidden">
                            {r.el}
                            {r.it.chat && (
                              <Box key={`chatmark-${r.it.key}`} position="absolute" top={0} bottom={0} right={0} width={CHAT_W} flexDirection="column" justifyContent="center" alignItems="center">
                                <Text color={P.ink} weight="bold">↗</Text>
                                <Text size="footnote">{'\u00a0'}</Text>
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Box>
                      {/* In flow, after the drawing: on top of it, and as tall as the hit rows. Nothing is drawn over it.
                          The fallback is a safety net: no world in the tests reaches it. */}
                      {!paneList ? btns('btns-pick', items, 'column') : paneHits('btns-pick', items)}
                    </Box>
                  )
                })()}
                {w.depts.length === 0 && tx(t('list.empty'), { dim: true })}
              </Box>
            )}

            {dept && (() => {
              const c = chiefOf(dept), team = ROLE_ORDER.flatMap(r => w.agents.filter(x => x.id === `${dept.id}-${r}`)), asks = waitsIn(dept)
              const keyed = asks.find(q => q.req && !lapsed(q) && !isCutCmd(q.cmd) && !isMaskedCmd(q.cmd) && !isHiddenCmd(q.cmd)) // the first ask with buttons holds A and R
              const name = c ? agentName(c.id) : t('dept.theTeam'), stt = stateOf(dept)
              const sub = a && a.role !== 'jefe' && a.dept === dept.id ? a : undefined // a subagent selected: its own words
              // The field's addressee and the send target, from one place: a subagent with no usable id gets the Jefe.
              const aid = skillName(sub?.aid)
              relayTo = sub && aid ? { dept: dept.id, name: agentName(sub.id), type: skillName(sub.kind) || 'agent', id: aid, agent: sub.id } : null
              const subOuts = sub ? (subOutbox.get(sub.id) ?? []).filter(o => now - o.at < OUTBOX_TTL && o.base === saidOf(sub) && !(sub.since > o.at && sub.since <= now)) : []
              if (sub) { if (subOuts.length) subOutbox.set(sub.id, subOuts); else subOutbox.delete(sub.id) }
              // Its words, then what you sent it on its way under them: each takes one of the chat's rows.
              const subRows = Math.min(CHAT_ROWS, chatMax), subShown = subOuts.slice(-subRows)
              const subAll = sub ? [...(sub.said ?? []), ...(sub.answer && sub.answer !== sub.said?.at(-1) ? [sub.answer] : [])] : []
              const subSaid = subAll.slice(subAll.length - Math.max(0, subRows - subShown.length))
              const busyNow = ['trabajando', 'leyendo', 'esperando', 'error'].includes(c?.state ?? '')
              // The header and the plan follow whoever is selected: the Jefe, or a subagent with its own list.
              // A subagent without its own list gets an action plan: its steps so far, the running one in progress.
              const acted = sub ? (dept.steps ?? []).filter(st => st.who === sub.role).map(st => ({ t: st.text, done: st.ok !== null, doing: st.ok === null })) : []
              const drawn = !!sub && !sub.notes?.length && acted.length > 0
              const isConv = !['plan', 'steps'].includes(tab)
              const who = sub ?? c, plan = sub ? { ...dept, notes: sub.notes?.length ? sub.notes : acted } : dept
              const syncBtn = `btns-sync-${dept.id}`, stopKey = `btns-stop-${dept.id}`, chatKey = `btns-chat-${dept.id}`, newerKey = `btns-chat-new-${dept.id}`, composeKey = `btns-compose-${dept.id}`
              if (busyNow && !dept.asleep) hot.push(['d', stopKey, 'stop'])
              // Older above the messages, newest under them, each in its own Client: neither moves under the pointer.
              const older = from > 0 ? [act(chatKey, { k: 'chat', dept: dept.id, back: back + Math.max(1, rowsShown - outShown.length) }, { key: 'older', label: t('chat.older') })] : []
              const newer = back > 0 ? [act(newerKey, { k: 'chat', dept: dept.id, back: 0 }, { key: 'newer', label: t('chat.newest') })] : []
              const nAttached = attached.get(dept.id)?.length ?? 0
              // "↗ Ir al chat" once per office (its Client is keyed by the office): on a question, and on a request the pane
              // cannot answer (the 8 s hold past, no pane, cut, masked or hidden), while the app's chat link is known.
              // A request goes to the chat where the app asks it (`to`: a child's in the chat that started it).
              let linked = false
              const chatLink = (to: AgentvilleDept = dept) => {
                if (linked || !chatUrl(to.local)) return null
                linked = true
                const ck = `btns-chatlink-${dept.id}`
                return btns(ck, [act(ck, { k: 'openChat', dept: to.id }, { key: 'open-chat', label: t('notes.openChat') })])
              }
              // The Jefe's question and suggested sessions: each reply a button with the exact text it sends under it (or
              // what the app does), each suggested session Arrancar and Descartar. No hotkeys: the words are Claude's.
              const dim = (text: string) => <Text color={P.dim} size="footnote" wrap="wrap">{text}</Text>
              const replyRow = (ask: NonNullable<AgentvilleDept['ask']>, r: AgentvilleReply, i: number) => {
                const ck = `btns-q-${dept.id}-${i}`, x = replyOf(dept, ask, r)
                if (!x) return <Box key={`reply-${i}`}>{dim(t('q.inApp', { label: r.label }))}</Box>
                return (
                  <Box key={`reply-${i}`} flexDirection="column">
                    {btns(ck, [act(ck, x.act, { key: `reply-${i}`, label: r.label, primary: i === 0 })])}
                    {dim(x.sub)}
                  </Box>
                )
              }
              // Suggested sessions live in the notes on your desk; only with no clickable map (hidden, too heavy, no zones)
              // are they listed here.
              const itemCard = (q: Agent) => {
                const ask = askIn(dept), offers = mode < 0 ? offersIn(dept) : []
                return (
                  <Box key={`despacho-${dept.id}`} flexDirection="column" gap="xs" borderStyle="round" borderColor={P.wait} paddingX="sm" paddingY="xs">
                    <Box flexDirection="row" gap="xs" alignItems="center">
                      {face(q.role, q.id, 36, agentName(q.id))}
                      {tx(t(ask ? 'q.asks' : offers.length ? 'q.offersHere' : 'q.offersOnly', { name: agentName(q.id) }))}
                    </Box>
                    {ask && <Text color={P.ink} weight="semibold" wrap="wrap">{ask.q}</Text>}
                    {ask?.blocked && tx(t('q.blocked'), { bold: true, color: P.wait, size: 'footnote' })}
                    {ask?.replies.map((r, i) => replyRow(ask, r, i))}
                    {ask && chatLink()}
                    {offers.slice(0, 3).map((o, i) => {
                      const ck = `btns-o-${dept.id}-${i}`
                      return (
                        <Box key={`offer-${o.id}`} flexDirection="column" gap="xs" borderStyle="round" borderColor={P.line} paddingX="sm" paddingY="xs">
                          {tx(o.title, { bold: true })}
                          {o.brief && dim(o.brief)}
                          {btns(ck, [act(ck, { k: 'openChat', dept: dept.id, start: { id: o.id, title: o.title } }, { key: `start-${i}`, label: t('notes.start').replace(/^▸ /, ''), primary: true }),
                            act(ck, { k: 'offer', dept: dept.id, id: o.id, title: o.title }, { key: `dismiss-${i}`, label: t('q.dismiss') })])}
                        </Box>
                      )
                    })}
                    {offers.length > 3 && tx(t('fam.more', { n: offers.length - 3 }), { dim: true, size: 'footnote' })}
                    {offers.slice(0, 3).some(o => elsewhere.has(o.id)) && chatLink()}
                  </Box>
                )
              }
              clientEls += FIELD_ELS + (menuOpen ? FIELD_MENU_ELS : 0)
              const compose = [act(composeKey, { k: 'send', dept: dept.id, to: name }, { key: 'send', label: t('send'), primary: true })]
              const attachKey = `btns-attached-${dept.id}`
              return (
                <Box flexDirection="column" gap="sm" width={0} flexGrow={73}>
                  <Box flexDirection="row" gap="sm" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                    <Box flexDirection="row" gap="sm" alignItems="center" flexShrink={1}>
                      {who && !chatUrl(dept.local) && face(who.role, who.id, 46, agentName(who.id))}
                      {/* With a chat link the face opens it: drawn absolute under one in-flow Client of a FACE_H-cell hit row
                          (the list's layering), in a Box FACE_W cells wide, so the zone never reaches the name or the chip. */}
                      {who && chatUrl(dept.local) && (() => {
                        const fk = `btns-face-${dept.id}`
                        return (
                          <Box key={`facechat-${dept.id}`} position="relative" width={FACE_W} flexShrink={0} flexDirection="column">
                            <Box position="absolute" top={0} bottom={0} left={0} flexDirection="column" justifyContent="center">{face(who.role, who.id, 46, agentName(who.id))}</Box>
                            {btns(fk, [act(fk, { k: 'openChat', dept: dept.id }, { key: 'face-chat', label: '', cells: FACE_H })], 'column')}
                          </Box>
                        )
                      })()}
                      <Box flexDirection="column" flexShrink={1}>
                        {tx(dept.name, { heavy: true })}
                        {tx(`${who ? agentName(who.id) : name}, ${roleName(who?.role ?? 'jefe', dept)} · ${short(who?.activity ?? '', 60)}${costOf(dept)}`, { dim: true, size: 'footnote' })}
                      </Box>
                    </Box>
                    <Box flexDirection="row" gap="xs" alignItems="center">
                      {chip(sub ? sub.state : stt, !sub && suggestsIn(dept))}
                      {busyNow && !dept.asleep && btns(stopKey, [act(stopKey, { k: 'stop', dept: dept.id }, { key: 'stop', label: t('dept.stop') })])}
                      {behind(dept) && !dept.syncStuck && btns(syncBtn, [act(syncBtn, { k: 'reload', dept: dept.id }, { key: 'reload', label: t('sync.update') })])}
                    </Box>
                  </Box>
                  {dept.asleep && !waking(dept) && tx(t('dept.asleep'))}
                  {behind(dept) && dept.syncStuck && tx(t('sync.stuck'), { size: 'footnote' })}
                  {waking(dept) && tx(t('sync.asleep'), { dim: true, size: 'footnote' })}
                  {(waking(dept) || (behind(dept) && !!dept.syncStuck)) && chatLink()}
                  <Box flexDirection="row" gap="sm" alignItems="center" flexWrap="wrap">
                    {tx(t('dept.team'), { dim: true, size: 'caption', bold: true })}
                    {team.map(m => (
                      <Box key={`member-${m.id}`} position="relative" flexDirection="row" gap="xs" alignItems="center">
                        {face(m.role, m.id, 26, agentName(m.id))}
                        {tx(agentName(m.id), { dim: true, size: 'footnote', color: m.id === a?.id ? P.ink : undefined })}
                        {hit(`pick-${m.id}`, () => pickAgent($, m.id))}
                      </Box>
                    ))}
                    {team.length === 1 && tx(t('dept.onlyJefe'), { dim: true, size: 'footnote' })}
                  </Box>
                  {asks.map(q => onItem(q) && itemText(q) !== null ? itemCard(q) : (
                    <Box key={`ask-${q.id}`} flexDirection="column" gap="xs" borderStyle="round" borderColor={P.wait} paddingX="sm" paddingY="xs">
                      <Box flexDirection="row" gap="xs" alignItems="center">
                        {face(q.role, q.id, 36, agentName(q.id))}
                        {tx(t('ask.asks', { name: agentName(q.id), role: roleName(q.role, dept) }))}
                      </Box>
                      {isToolCall(q.tool) ? <Code source={q.cmd ?? ''} /> : <Code source={q.cmd ?? ''} language="bash" />}
                      {(() => {
                        const why = unanswerable(q)
                        return why ? <Box key={`why-${q.id}`} flexDirection="column" gap="xs">{why}{chatLink(starterIn(w, dept.id))}</Box> : (
                          <Box flexDirection="column" gap="xs">
                            {btns(`btns-ask-${q.id}`, answerItems(q, `btns-ask-${q.id}`, q === keyed))}
                          </Box>
                        )
                      })()}
                    </Box>
                  ))}
                  {(() => {
                    const cur = isConv ? 'conv' : tab
                    const tabs = tabsSvg([{ key: 'conv', label: t('tab.conv') }, { key: 'plan', label: plan.notes.length ? t('tab.planCount', { k: plan.notes.filter(x => x.done).length, n: plan.notes.length }) : t('tab.plan') }, { key: 'steps', label: t('tab.steps') }], cur, P.ink, P.dim)
                    return (
                      <Box flexDirection="column">
                        <Box position="relative" alignSelf="flex-start">
                          <Svg source={tabs.svg} alt={t('tab.active', { tab: t(cur === 'plan' ? 'tab.plan' : cur === 'steps' ? 'tab.steps' : 'tab.conv') })} width={tabs.width} />
                          <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row">
                            {(['conv', 'plan', 'steps'] as const).map((k, n) => (
                              <Box key={`tabhit-${k}`} width={0} flexGrow={Math.round(tabs.shares[n]! * 10000)} flexDirection="row" alignItems="stretch" overflow="hidden">
                                {cover(`tab-${k}`, () => void update($, tabAtom, () => k))}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 3" width="2000" height="3"><rect width="2000" height="3" fill="${P.line}"/></svg>`} alt={t('svg.divider')} width={2000} />
                      </Box>
                    )
                  })()}
                  {tab === 'plan' && sub && !plan.notes.length && tx(t('sub.notStarted', { name: agentName(sub.id), goal: sub.goal ? t('sub.notStartedGoal', { goal: sub.goal }) : '' }), { dim: true })}
                  {(tab === 'plan' || (isConv && !zoomHere)) && drawn && tx(t('sub.actionPlan', { name: agentName(sub!.id), goal: sub!.goal ? t('sub.actionPlanGoal', { goal: sub!.goal }) : '' }), { dim: true, size: 'footnote' })}
                  {tab === 'plan' && plan.notes.length > 0 && planCard(plan, true)}
                  {tab === 'steps' && (
                    <Box flexDirection="column" gap="xs">
                      {(dept.bg ?? []).map((bt, i) => <Box key={`bg-${i}`}>{tx(`${t(`bg.${bt.status}`)} · ${bt.text}`, { color: bt.status === 'falló' ? P.bad : bt.status === 'terminó' ? P.dim : STATE_COLORS.trabajando })}</Box>)}
                      {[...(dept.steps ?? [])].slice(-10).reverse().map(st2 => (
                        <Box key={`step-${st2.n}`}>{tx(`${agentName(`${dept.id}-${st2.who}`)} (${roleName(st2.who, dept)}): ${st2.text}${st2.ok === false ? ` · ${t('steps.failed')}` : st2.ok === null ? ` · ${t('steps.running')}` : ''}`, { size: 'footnote', color: st2.ok === false ? P.bad : st2.ok === null ? P.ink : P.dim })}</Box>
                      ))}
                      {!(dept.steps ?? []).length && !(dept.bg ?? []).length && tx(t('steps.none'), { dim: true })}
                    </Box>
                  )}
                  {isConv && zoomHere && viewer()}
                  {isConv && !zoomHere && (
                    <Box flexDirection="column" gap="sm">
                      {sub
                        ? [
                            ...subSaid.map(said => bubble(sub.role, sub.id, agentName(sub.id), said)),
                            ...subShown.map(o => <Box key={`subout-${o.at}`} flexDirection="column">{bubble('me', 'me', t('chat.youToSub', { name: agentName(sub.id) }), o.text, true, [], true)}</Box>),
                            ...(!sub.said?.length && !sub.answer ? [<Box key="sub-none">{tx(t('sub.silent', { name: agentName(sub.id), activity: sub.activity }), { dim: true })}</Box>] : []),
                          ]
                        : [
                            ...(older.length ? [<Box key="chat-older" alignSelf="center">{btns(chatKey, older)}</Box>] : []),
                            ...visible.map(m => {
                              // A relayed row reads as who it was for, only while that office has the subagent the marker names (its
                              // id and name); any other row, or one for a subagent gone, stays as written. The text sent stays as is.
                              const r0 = m.who === 'tú' ? relayOf(m.text) : null
                              const rel = r0 && w.agents.some(x => x.dept === dept.id && x.role !== 'jefe' && skillName(x.aid) === r0.id && agentName(x.id) === r0.name) ? r0 : null
                              return rel ? bubble('me', 'me', t(m.queued ? 'chat.youToQueued' : 'chat.youTo', { name: rel.name }), rel.text, true, m.pics, true)
                                : m.who === 'tú' ? bubble('me', 'me', m.queued ? t('chat.youQueued') : t('chat.you'), m.text, true, m.pics) : bubble('jefe', c?.id ?? dept.id, name, m.text, false, m.pics)
                            }),
                            ...outShown.map(o => <Box key={`out-${o.at}`} flexDirection="column">{o.to ? bubble('me', 'me', t('chat.youToQueued', { name: o.to }), o.text, true, [], true) : bubble('me', 'me', t('chat.youQueued'), o.text, true)}</Box>),
                            ...(newer.length ? [<Box key="chat-newer" alignSelf="center">{btns(newerKey, newer)}</Box>] : []),
                            ...(!all.length && !outs.length ? [<Box key="chat-none">{tx(t('chat.none'), { dim: true })}</Box>] : []),
                          ]}
                      {plan.notes.length > 0 && planCard(plan, true)}
                    </Box>
                  )}
                  <Box flexDirection="column" gap="xs" backgroundColor={P.raise} borderStyle="round" borderColor={P.line} paddingX="xs" paddingY="xs">
                    {nAttached > 0 && (
                      <Box key={`attached-${dept.id}`} flexDirection="row" gap="sm" alignItems="center" flexWrap="wrap">
                        {pending.length > 0 && picRow(`pics-attached-${dept.id}`, pending, ATTACHED_THUMB, P.dim)}
                        {btns(attachKey, [act(attachKey, { k: 'unattach', dept: dept.id }, { key: 'unattach', label: t(nAttached > 1 ? 'attach.many' : 'attach.one', { n: nAttached }) })])}
                      </Box>
                    )}
                    <Box flexDirection="row" gap="xs" alignItems={menuOpen ? 'flex-start' : 'center'}>
                      {face('me', 'me', 36, t('chat.you'))}
                      <Box key={`wrap-field-${dept.id}`} width={0} flexGrow={1} minWidth={0} overflow="hidden">
                        <Client
                          key={`field-${dept.id}`}
                          module="./field.tsx"
                          props={{ placeholder: dept.asleep ? t('field.asleep') : relayTo ? t('field.to', { name: relayTo.name, hint: '' }).trimEnd() : t('field.to', { name, hint: permWait(dept.id) ? t('field.afterPerm') : busy(dept.id) ? t('field.busy') : t('field.hint') }), mine: t('field.mine'), more: t('field.more'), bg: '#151514', ink: '#ecebe8', dim: '#8e8b85', line: '#3a3936', focus: '#b9c6d8', sel: '#3d4a5c', clear: sentCount, ...(pasted.has(dept.id) ? { insert: pasted.get(dept.id)! } : {}), cmds, ...tinted('field') }}
                          width="100%"
                        />
                      </Box>
                      {/* Send centred on the field (two lines when its placeholder wraps): the strip's own Box sits at
                          flex-start, so its wrapper takes the row's alignment; flex-start while the slash menu is open. */}
                      <Box key={`send-${dept.id}`} flexShrink={0} alignSelf={menuOpen ? 'flex-start' : 'center'}>{btns(composeKey, compose)}</Box>
                    </Box>
                  </Box>
                </Box>
              )
            })()}
          </Box>

          <Box flexDirection="row" gap="xs" alignItems="center" flexWrap="wrap">
            {tx(t('pane.palette'), { dim: true, size: 'footnote' })}
            {btns('btns-palette', Object.entries(PALETTES).map(([k, pal]) => act('btns-palette', { k: 'palette', key: k }, { key: `pal-${k}`, label: pal.name, primary: pal === P, selected: pal === P })))}
          </Box>
          {hotkeys()}
        </Box>
      )
      // The real recovery: measure what goes to the desktop. Past TREE_LIMIT it would paint nothing at all, so the map
      // steps aside while this floor holds this many offices (it comes back when there are fewer), and a light tree goes
      // out at once instead of a blank pane.
      // Every Client's tree is drawn by the desktop too: the map's grid and each button Client count.
      const json = JSON.stringify(tree), size = json.length, elements = (json.match(/"type":/g) ?? []).length + clientEls // the band Clients' trees are in clientEls
      const clients = clientsIn(json), page = pageOf(tree), over = !pageFits(page)
      if (taken) { zonesCost = taken.byChars ? Math.max(0, taken.chars - page.chars) : Infinity; taken = null }
      if (retrying && (over || elements > TREE_LIMIT || clients > CLIENT_MAX)) { retrying = false; retried = true } // any weight: a step given back that is too heavy by elements alone would loop
      await logRender({ at: now, kb: Math.round(size / 1024), elements, clients, ...page, clicks, mode, offices: drawn, noMap, askedNoMap, viewOnly: !noMap && mode < 0, noPeople, shed: STEPS.filter(shed) })
      if (calib) {
        const at = await $.clock.now()
        if (!calib.fromKb) calib.fromKb = Math.ceil(size / 1024)
        const sec = Math.floor((at - calib.start) / 1000), base = elements
        const kb = calib.els ? Math.ceil(size / 1024) : calib.fromKb + sec, CHUNK = 120 * 1024, pad = calib.els ? 0 : Math.max(0, kb * 1024 - size - 600)
        // `/agentville calibrar elementos`: 20 more invisible click buttons a second (each a Box and a Button), as zones add.
        const extra = calib.els ? sec * 20 : 0
        const stop = () => { calibTimer?.cancel(); calib = null; $.ui.invalidate('ui.render') }
        if (calib.els ? extra > 6000 : kb > calib.fromKb + 400) stop()
        await logRender({ at, calibKb: kb, elements: base + extra * 2 })
        return (
          <Box flexDirection="column" gap="sm" backgroundColor={P.bg}>
            <Box flexDirection="row" gap="sm" alignItems="center" justifyContent="space-between" borderStyle="round" borderColor={P.wait} paddingX="sm" paddingY="xs">
              <Text size="heading" weight="bold" color={P.wait}>{calib.els ? t('calib.elements', { n: base + extra * 2 }) : t('calib.kb', { kb })}</Text>
              <Text color={P.dim}>{calib.els ? t('calib.elementsRate') : t('calib.kbRate')} {t('calib.note')}</Text>
              <Button key="calib-stop" onPress={stop}>{t('calib.stop')}</Button>
            </Box>
            {Array.from({ length: Math.ceil(pad / CHUNK) }, (_, i) => (
              <Box key={`pad-${i}`} position="absolute" top={0} left={0}>
                <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"><desc>${'x'.repeat(Math.max(0, Math.min(CHUNK, pad - i * CHUNK) - 110))}</desc></svg>`} alt={t('calib.pad')} width={1} />
              </Box>
            ))}
            {extra > 0 && (
              <Box key="calib-els" position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="row" flexWrap="wrap">
                {Array.from({ length: extra }, (_, i) => (
                  <Box key={`ce${i}`} width={0} flexGrow={1} flexDirection="row" alignItems="stretch" overflow="hidden">
                    <Button key={`cb${i}`} plain onPress={() => {}}>{FILL}</Button>
                  </Box>
                ))}
              </Box>
            )}
            {tree}
          </Box>
        )
      }
      // Opened replies go first, the newest one at a time (a Set keeps its order): the pane never stays stuck on a reply
      // someone opened, and the others stay open.
      // Too many Clients flood the desktop's page and it tears them all down: the same lighter passes, after the kept bands.
      const heavy = elements > TREE_LIMIT || clients > CLIENT_MAX || over
      if (heavy && keptDrawn) { keepHits = false; continue }
      // Past CLIENT_MAX with zones drawn: the zone loop takes a lighter set within the Clients now counted. Ends: each
      // such pass raises othersUsed, and the set it picked fit the old budget, so the others grew.
      // Next, the thumbnails' hit Clients go (their lines keep pane Buttons), so the map's zones stay.
      if (clients > CLIENT_MAX && picDrawn && picMax) { picMax = 0; continue }
      const others = clients - liveDrawn - keptDrawn
      if (clients > CLIENT_MAX && mode >= 0 && others > othersUsed) { othersUsed = others; continue }
      if (heavy && opened.size) { const last = [...opened].at(-1)!; opened.delete(last); noRoom.add(last); continue }
      // Too heavy with the map drawn: the ladder's next step (STEPS), built again at once, no placeholder left on screen.
      // A tree past only the elements or the Clients sheds the per-person zones first: the one step that lightens those.
      if (!noMap && heavy) {
        const step: Step = !over && !shed('zones') ? 'zones' : STEPS.find(s => !shed(s))!
        shedAt[step] = Math.min(shedAt[step], drawn)
        if (step === 'zones') taken = { chars: page.chars, byChars: elements <= TREE_LIMIT && clients <= CLIENT_MAX && page.nodes <= PAGE_NODES && page.depth <= PAGE_DEPTH }
        continue
      }
      // Still past CLIENT_MAX with the map gone: the list's rows become pane Buttons (a press may need a second click)
      // rather than a tree that floods the page.
      if (hitList && clients > CLIENT_MAX && !paneList) { paneList = true; continue }
      // Past the rule with no map: fewer chat rows, down to one, then the last resort. No path returns a tree the page refuses.
      if (over && rowsShown > 1) { chatMax = rowsShown - 1; continue }
      if (over) { fresh(); const last = tooHeavyTree(); await logRender({ at: now, kb: Math.round(JSON.stringify(last).length / 1024), ...pageOf(last), tooHeavy: true }); return metered(last, 0) }
      // It fits: the last step taken comes back when what it took off fits in the room left, in this same render, so a
      // burst of births that links up gets its people back at once. A step's cost: the map's layers with it less the
      // layers without it, measured afresh; the zones', what they saved when they went.
      // The zones' cost unknown (taken for elements or Clients, not characters): the step before them is tried instead.
      const undo = askedNoMap ? undefined : [...STEPS].reverse().find(s => shed(s) && !(s === 'zones' && zonesCost === Infinity))
      const undoKey = `${latchAt}:${STEPS.filter(shed).join()}:${fl}:${view.rows ?? 1}:${drawn}:${view.agents.length}`
      const layers = (d: Detail) => houseOf(view).length + furnitureLayer(view, now, w.depts, diskView, notesLabel, d).join('').length + (d.people ? agentsLayer(view, now, d).join('').length : 0) + (d.decor ? selectionLayer(view, now, '', 'tag', d.people).length : 0)
      if (undo && undo !== 'zones' && !retried && undoCost.key !== undoKey) undoCost = { key: undoKey, chars: layers(detailOf(s => s !== undo && shed(s))) - (noMap ? 0 : layers(dt)) }
      const cost = !undo || retried ? Infinity : undo === 'zones' ? zonesCost : undoCost.chars
      if (undo && !retried && cost <= PAGE_CHARS - page.chars) {
        shedAt[undo] = Infinity
        retrying = true
        continue
      }
      return metered(tree, clients)
    }
    } catch (err) {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text bold>{t('pane.failed')}</Text>
          <Text dimColor>{String(err instanceof Error ? err.message : err).slice(0, 300)}</Text>
          <Text>{t('pane.failedHint')}</Text>
        </Box>
      )
    }
  })
}

// register's shape against the engine's Register type (a type only: nothing names register at run time).
type RegisterShape<R extends Register> = R
type RegisterChecked = RegisterShape<typeof register>
