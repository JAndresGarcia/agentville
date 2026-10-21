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
const ARCHIVED_EVERY = 60000, ARCHIVED_MAX = 60
export let archivedAt = -Infinity, archivedIds = new Set<string>()
export async function readKey($: EngineInterface) {
  const had = await $.store.get(MAILBOX_KEY)
  return typeof had === 'string' && had ? had : null
}

// Puts an order in a session's mailbox. Only the pane writes mailboxes, so a read-modify-write is safe.
export function register(on, options) {
  on('ui.render', { component: 'Pane', requestId: 'agentville' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box><ui.Client key="hits" module="./btns.tsx" props={{}} /></ui.Box>
  })
}
