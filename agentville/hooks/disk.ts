// Pure helpers for the disk screen: parse the app worktree registry, df and du output, pick colours and rank worktrees. No I/O here.

export type Worktree = { name: string; path: string; createdAt: number; leasedBy: string | null }
export type DuRow = { path: string; kb: number }
export type Session = { cliSessionId: string; title: string; isArchived: boolean; lastActivityAt: number }
export type BeatState = { name: string; ended: boolean; pending: boolean }
export type WtStatus = 'active' | 'paused' | 'ended' | 'reserva'
export type WtItem = { name: string; path: string; kb: number; status: WtStatus }

const MIN = 60_000
export const DF_EVERY = 5 * MIN
export const DU_EVERY = 30 * MIN
export const LOCK_MS = 10 * MIN
export const STALE_MS = 30 * 24 * 60 * MIN
const LEASE = /^local_[\w-]+$/

// The app's private file can change shape, so anything but schema 2 is "unknown", never a guess. A path counts only as
// the app makes one, `<a folder under home>/.claude/worktrees/<name>`, with no `.` or `..` part: du never reads elsewhere.
const wtPath = (p: string, home: string) => p.startsWith(`${home}/`) && /\/\.claude\/worktrees\/[^/]+\/?$/.test(p) && !p.split('/').some(x => x === '.' || x === '..')
export function parseRegistry(json: unknown, home: string): Worktree[] | null {
  const j = json as { schemaVersion?: unknown; worktrees?: unknown } | null
  if (!j || typeof j !== 'object' || j.schemaVersion !== 2 || !j.worktrees || typeof j.worktrees !== 'object') return null
  const out: Worktree[] = []
  for (const w of Object.values(j.worktrees as Record<string, unknown>)) {
    const o = w as Record<string, unknown> | null
    if (!o || typeof o.path !== 'string' || !wtPath(o.path, home)) continue
    const lease = typeof o.leasedBy === 'string' && LEASE.test(o.leasedBy) ? o.leasedBy : null
    out.push({ name: typeof o.name === 'string' ? o.name : '', path: o.path, createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0, leasedBy: lease })
  }
  return out
}

export const diskColor = (gb: number): 'bad' | 'mid' | 'good' => (gb < 5 ? 'bad' : gb < 10 ? 'mid' : 'good')

// `df -k <dir>`: the Available column sits right before the Capacity "NN%" column (the device name may hold spaces).
export function parseDf(stdout: string): number | null {
  const last = stdout.trim().split('\n').pop() ?? ''
  const cols = last.trim().split(/\s+/)
  const cap = cols.findIndex((c, i) => i > 0 && /^\d+%$/.test(c))
  const kb = cap > 0 ? Number(cols[cap - 1]) : NaN
  return Number.isFinite(kb) ? kb : null
}

// `du -sk a b`: one "<kb>\t<path>" line per path.
export function parseDu(stdout: string): DuRow[] {
  const rows: DuRow[] = []
  for (const line of stdout.split('\n')) {
    const m = /^(\d+)\t(.+)$/.exec(line)
    if (m) rows.push({ kb: Number(m[1]), path: m[2]! })
  }
  return rows
}

export const dueToMeasure = (cache: { at?: number; duAt?: number } | null | undefined, now: number) => ({
  df: !cache?.at || now - cache.at >= DF_EVERY,
  du: !cache?.duAt || now - cache.duAt >= DU_EVERY,
})

export const lockFree = (lock: number | null | undefined, now: number) => !lock || now - lock >= LOCK_MS

// Top 6 worktrees by size with their session state, plus how many sat idle 30+ days.
export function rankWorktrees(entries: Worktree[], sizes: DuRow[], sessions: Record<string, Session>, beats: Record<string, BeatState>, now: number): { top: WtItem[]; stale: number } {
  const kb = new Map(sizes.map((s) => [s.path, s.kb]))
  let stale = 0
  const items = entries.map((w): WtItem => {
    const s = w.leasedBy ? sessions[w.leasedBy] : undefined
    const b = s ? beats[s.cliSessionId] : undefined
    const status: WtStatus = !w.leasedBy ? 'reserva' : b?.ended || s?.isArchived ? 'ended' : b?.pending ? 'active' : 'paused'
    if (status !== 'active' && now - (s?.lastActivityAt ?? w.createdAt) >= STALE_MS) stale++
    return { name: b?.name || s?.title || w.name, path: w.path, kb: kb.get(w.path) ?? 0, status }
  })
  return { top: items.sort((a, b) => b.kb - a.kb).slice(0, 6), stale }
}

// The app's session files of the leased worktrees, as measureDisk joins them: "\x1e<leasedBy>\n<json>" per file.
// Only four fields are kept; a chunk that does not parse, or a field of the wrong type, is left out.
const CLI = /^[\w-]+$/
export const SEP = '\x1e'
export function parseSessions(stdout: string): Record<string, Session> {
  const out: Record<string, Session> = {}
  for (const chunk of stdout.split(SEP)) {
    const nl = chunk.indexOf('\n'), id = chunk.slice(0, nl).trim()
    if (nl < 0 || !LEASE.test(id)) continue
    let j: Record<string, unknown>
    try { j = JSON.parse(chunk.slice(nl + 1)) as Record<string, unknown> } catch { continue }
    if (!j || typeof j !== 'object' || typeof j.cliSessionId !== 'string' || !CLI.test(j.cliSessionId)) continue
    out[id] = {
      cliSessionId: j.cliSessionId, title: typeof j.title === 'string' ? j.title.slice(0, 80) : '',
      isArchived: j.isArchived === true, lastActivityAt: typeof j.lastActivityAt === 'number' ? j.lastActivityAt : 0,
    }
  }
  return out
}
// The find that lists each leased worktree's session file (the leasedBy ids, already checked by parseRegistry, so
// only word characters and dashes reach -name): regular files only, three folders down. Argv only.
export const sessionsFind = (app: string, ids: string[]) => ['/usr/bin/find', `${app}/claude-code-sessions`, '-mindepth', '3', '-maxdepth', '3', '-type', 'f', '(',
  ...ids.flatMap((id, i) => [...(i ? ['-o'] : []), '-name', `${id}.json`]), ')']

// Sub-offices: which session started this one, from the app's session records (untrusted: strict patterns only).
// relinkGrep lists the records that name this session's id under the records folder (fixed string, argv only); nothing
// is read here. relinkHits keeps the first RELINK_HITS paths of the records' own shape, relative to it, so no other
// file is read; the caller reads them in order until one is this session's own (other records may name it too).
// A fresh module looks every RELINK_FAST for its first RELINK_FRESH, then every RELINK_EVERY.
export const RELINK_EVERY = MIN
export const RELINK_FAST = 5000
export const RELINK_FRESH = 5 * MIN
export const RELINK_TRIES = 10
export const RELINK_HITS = 20
// A look that finds its own record with nothing left to learn from it (a root, or an id that gives no chat link) stops
// after this long, so a root session does not read its record for ever.
export const RELINK_QUIET = 20 * MIN
export const RECORD_MAX = 200000
export const relinkGrep = (me: string, dir: string) => ['/usr/bin/grep', '-rlF', '--include=local_*.json', '-e', me, '--', dir]
const HIT = /^[0-9a-f-]+\/[0-9a-f-]+\/local_[\w-]+\.json$/
export const relinkHits = (stdout: string, dir: string) => stdout.split('\n').map((p) => (p.startsWith(`${dir}/`) ? p.slice(dir.length + 1) : '')).filter((p) => HIT.test(p)).slice(0, RELINK_HITS)
/** The few fields Agentville reads from an app session record (`text`, maybe cut at RECORD_MAX): the whole record when
 * it parses, else each field from its first `"name":value` in the text (the app writes compact JSON, where a name inside
 * a string reads `\"name\"` and never matches), so a record cut short still gives them; its own ids and flag only
 * before its first nested object or list. null when it is no object. */
export type Rec = { sessionId?: unknown; cliSessionId?: unknown; isArchived?: unknown; spawnedFrom?: { sessionId?: unknown } }
export function recordOf(text: string): Rec | null {
  try { const j: unknown = JSON.parse(text); return j && typeof j === 'object' && !Array.isArray(j) ? (j as Rec) : null } catch { /* cut short: by field */ }
  if (!text.startsWith('{')) return null
  // The record's own fields come before its first nested object or list (a nested one may hold the same names).
  const top = text.slice(0, text.slice(1).search(/[{[]/) + 1 || undefined), str = (re: RegExp, t = top) => re.exec(t)?.[1]
  const arch = str(/"isArchived":(true|false)\b/), sid = str(/"spawnedFrom":\{[^{}]*?"sessionId":"([^"\\]*)"/, text)
  return { sessionId: str(/"sessionId":"([^"\\]*)"/), cliSessionId: str(/"cliSessionId":"([^"\\]*)"/), ...(arch ? { isArchived: arch === 'true' } : {}), ...(sid !== undefined ? { spawnedFrom: { sessionId: sid } } : {}) }
}
/** The record that started `own` (its spawnedFrom.sessionId, a `local_` id), or null. A fork is not a child. */
export function spawnedOf(own: unknown): string | null {
  const s = (own as { spawnedFrom?: { sessionId?: unknown } } | null)?.spawnedFrom?.sessionId
  return typeof s === 'string' && LEASE.test(s) ? s : null
}
/** The parent's CLI session id when `own` is this session's record (`myId`) and `parent` the record it names; else null. */
export function parentLink(own: unknown, parent: unknown, myId: string): string | null {
  const o = own as { cliSessionId?: unknown } | null, p = parent as { sessionId?: unknown; cliSessionId?: unknown } | null
  if (!o || !p || typeof o !== 'object' || typeof p !== 'object' || o.cliSessionId !== myId) return null
  const sid = spawnedOf(own)
  return sid && p.sessionId === sid && typeof p.cliSessionId === 'string' && CLI.test(p.cliSessionId) && p.cliSessionId !== myId ? p.cliSessionId : null
}

// "Ir al chat": this session's own record id in the app (`local_<uuid>`), and the app link that opens it.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const LOCAL = new RegExp(`^local_${UUID}$`)
/** `own.sessionId` when `own` is this session's record (`myId`), a `local_<uuid>` id, and the record's own file name
 * (`file`: `local_<uuid>.json`); else null. */
export function ownLocal(own: unknown, myId: string, file: string): string | null {
  const o = own as { sessionId?: unknown; cliSessionId?: unknown } | null
  if (!o || typeof o !== 'object' || o.cliSessionId !== myId || typeof o.sessionId !== 'string') return null
  return LOCAL.test(o.sessionId) && `${o.sessionId}.json` === file ? o.sessionId : null
}
const CHAT_URL = new RegExp(`^claude://claude\\.ai/epitaxy/local_${UUID}$`)
/** The Claude app's link to a session's chat, or null unless it is exactly the fixed prefix and a `local_<uuid>` id. */
export function chatUrl(local: unknown): string | null {
  const url = `claude://claude.ai/epitaxy/${typeof local === 'string' ? local : ''}`
  return CHAT_URL.test(url) ? url : null
}
