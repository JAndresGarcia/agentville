import type { AgentvilleBgTask, AgentvilleChat, AgentvilleUsage, AgentvilleNote, AgentvilleRole, AgentvilleStateName, AgentvilleStep } from '../types'
import { t } from './i18n'

// Each session writes its own heartbeat file and every open pane reads them all: one writer per file, so sessions
// never overwrite each other. It also keeps the last answers, steps and plan, so the pane can show a session's work
// without opening it; it never leaves the machine.

/** One agent of a session: its main loop (`MAIN`) or a subagent, by its agentId. `req` names a permission request
 * the session holds for the pane to answer; null when the session's own prompt asks. */
export type BeatAgent = { role: AgentvilleRole; kind: string; state: AgentvilleStateName; activity: string; cmd: string | null; tool?: string; since: number; req?: string | null; held?: number; answer?: string; said?: string[]; notes?: AgentvilleNote[]; goal?: string; tokens?: number; model?: string }
// openSteps: how many steps of the main plan were still open when its last turn (or the session) ended.
// parent: the CLI session id of the session that started this one (its office sits in the parent's block).
// local: this session's own record id in the Claude app (`local_<uuid>`), from its record: its chat's link.
// archived: set only by the pane, from the app's record (`isArchived`), never written to a heartbeat: the chat leaves.
export type Beat = { id: string; name: string; at: number; ended: boolean; agents: Record<string, BeatAgent>; notes: AgentvilleNote[]; steps?: AgentvilleStep[]; bg?: AgentvilleBgTask[]; chat?: AgentvilleChat[]; slot?: number; endReason?: string; usage?: AgentvilleUsage; tools?: Record<string, number>; openSteps?: number; parent?: string; local?: string; ask?: BeatAsk; offers?: BeatOffer[]; mod?: string; syncStuck?: string; metas?: string[]; archived?: true }
/** A reply Claude offered with its question: `text` is sent byte for byte as your prompt; `app` ones are only shown,
 * and `action` names the app action one stands for (only from APP_ACTIONS). */
export type AskReply = { label: string; text: string; app?: true; action?: AppAction }
/** The question the main turn ended with (wrap_up's `ask`), keyed by that tool_use `id`. */
export type BeatAsk = { id: string; q: string; replies: AskReply[]; blocked?: true }
/** A suggested session (start_session own_initiative/offer) by its tool_use `tu`; a card only once the app gave it its
 * task `id` (from the app's tool_result only, `^task_[A-Za-z0-9]{4,40}$`: start_session's proposal_id, dismiss_task's task_id). `at` dates it (the app drops it after OFFER_TTL); `end` is the start/dismiss call waiting for its result. */
export type BeatOffer = { tu: string; title: string; brief: string; at: number; id?: string; end?: string }

export const MAIN = 'main'
export const beatsDir = (home: string) => `${home}/.claude/agentville/sessions`

// The other way: the pane writes orders to a session's mailbox (only the pane writes it; the session reads it), and
// a viewer file says a pane is open, so a session only holds a permission request while someone can answer it.
// Every order is signed with the mailbox key (a secret only the plugin's store holds) and carries its time in `n`
// (ms * 1000 + a random part): a session acts only on orders whose signature checks, less than two minutes old and
// not from the future, so a file dropped there is ignored and the key never sits in a mailbox. The signature covers
// the session the order is for, so an order copied into another session's mailbox fails there. `dismiss` and `fill`
// carry a suggested session's task id in `req` (offerOrderOk): the offering session acts itself. A dismiss calls the
// app's tool; a fill (Arrancar) writes a fixed line into that session's own empty prompt box and never sends it. A
// fillText carries a `/command` the pane held back (fillTextOf): written the same way, never sent, never run.
export type Cmd = { n: number; kind: 'msg' | 'stop' | 'allow' | 'deny' | 'dismiss' | 'fill' | 'fillText'; text?: string; req?: string; sig?: string }
export const FILL_MAX = 2000
/** A fillText order's text, untrusted, as a session may type it in its own prompt box: one line (the pane's field has
 * no other; line and paragraph separators fold too), control, lone surrogate and HIDDEN characters dropped, a
 * `/command`, at most FILL_MAX; null otherwise. */
export function fillTextOf(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const s = text.replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/[\p{Cc}\p{Cs}]/gu, '').replace(new RegExp(HIDDEN.source, 'gu'), '').trim()
  return s.startsWith('/') && s.length <= FILL_MAX ? s : null
}
export const ORDER_TTL = 120000
const utf8 = new TextEncoder()
export const sha256 = async (...parts: Uint8Array[]) => {
  const all = new Uint8Array(parts.reduce((n, x) => n + x.length, 0))
  parts.reduce((at, x) => (all.set(x, at), at + x.length), 0)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', all))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
/** HMAC-SHA256 (RFC 2104) as hex, built on `crypto.subtle.digest`: the hooks runtime has no `subtle.sign`. */
export async function hmac(key: string, msg: string) {
  const raw = utf8.encode(key), k = new Uint8Array(64)
  k.set(raw.length > 64 ? await sha256(raw) : raw)
  const inner = await sha256(k.map((x) => x ^ 0x36), utf8.encode(msg))
  return hex(await sha256(k.map((x) => x ^ 0x5c), inner))
}
/** SHA-256 of a permission request's command as the card showed it, hex: an `allow` order carries it as its signed text,
 * and the session approves only when it matches the command it holds. */
export const cmdHash = async (cmd: string) => hex(await sha256(utf8.encode(cmd)))
export const signOf = (key: string, c: Omit<Cmd, 'sig'>, to: string) => hmac(key, `${to}|${c.n}|${c.kind}|${c.req ?? ''}|${c.text ?? ''}`)
/** The orders session `to` may act on: well formed, signed with `key` for it, at most two minutes old, at most 5 s ahead
 * and newer than `after` (the last `n` it accepted), so an order copied back into the mailbox never acts twice. */
export async function trusted(cmds: unknown[], key: string | null, now: number, to: string, after = -Infinity): Promise<Cmd[]> {
  const ok: Cmd[] = []
  if (!key) return ok // no key yet: no pane ever sent an order
  for (const c of cmds) {
    if (!c || typeof c !== 'object') continue
    const x = c as Cmd, at = x.n / 1000
    if (typeof x.n !== 'number' || typeof x.kind !== 'string' || typeof x.sig !== 'string' || now - at > ORDER_TTL || at > now + 5000 || x.n <= after) continue
    if ((x.text !== undefined && typeof x.text !== 'string') || (x.req !== undefined && typeof x.req !== 'string')) continue
    if (x.sig === (await signOf(key, x, to))) ok.push(x)
  }
  return ok
}
/** How long a permission request waits for the pane: about 8 s, less when the hook's budget leaves less (a 2 s margin). */
export const holdMs = (remainingMs: number) => Math.max(0, Math.min(8000, remainingMs - 2000))
/** Why a file tool may not touch `path` (absolute): the mod's folder is written by the pane and the sessions alone,
 * and the plugin's store holds the mailbox key: no tool reads or writes it, and no search runs over a folder of
 * `~/.claude` that holds it. null when it may. */
const READERS = new Set(['Read', 'Grep', 'Glob']), WRITERS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
export const GUARDED_TOOLS = new Set([...READERS, ...WRITERS])
export function guardedPath(tool: string, path: string, home: string): string | null {
  if (!GUARDED_TOOLS.has(tool)) return null
  const parts: string[] = []
  for (const s of path.replace(/^~(?=\/|$)/, home).split('/')) if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s)
  const p = `/${parts.join('/')}/`.toLowerCase(), hm = home.toLowerCase() // macOS paths ignore case
  const store = `${hm}/.claude/plugins/store/`
  const search = tool === 'Grep' || tool === 'Glob'
  if (p.startsWith(`${store}agentville_`) || (search && p.startsWith(`${hm}/.claude/`) && (store.startsWith(p) || p.startsWith(store)))) return 'The Agentville store holds the key of its mailboxes; it is not for tools.'
  if (WRITERS.has(tool) && p.startsWith(`${hm}/.claude/agentville/`)) return 'Only the Agentville panel and its sessions write ~/.claude/agentville.'
  return null
}
/** Why a command (Bash's, or any tool's `command`) may not run: it names the plugin's store, `.claude/plugins/store`
 * (where the mailbox key lives), or the key's name. Quotes and backslashes are dropped and `//` and `/./` folded first,
 * so `plugins/"st"ore` counts too. Partial by nature: a command can still reach the store without spelling it (a glob, a
 * variable, `cd` then a relative path); the docs say so. null when it may run. */
export function guardedCommand(command: unknown): string | null {
  const c = String(command ?? '').replace(/["'\\`]/g, '').replace(/\/(?:\.?\/)+/g, '/').toLowerCase()
  return /\.claude\/plugins\/store|mailbox-key/.test(c) ? 'The Agentville store holds the key of its mailboxes; commands may not name it.' : null
}
export const controlFile = (home: string, id: string) => `${home}/.claude/agentville/control/${id}.json`
export const viewerFile = (home: string) => `${home}/.claude/agentville/viewer.json`
// The slash commands a session can run (name, one line, source), so the pane's field can suggest them; only the session writes it.
export type CmdRow = [name: string, description: string, source: string]
export const commandsFile = (home: string, id: string) => `${home}/.claude/agentville/commands/${id}.json`
/** A message's text as a prompt: one that starts with `/` (after spaces) would run as a command, which the host refuses
 * from a plugin, so its first word goes in backticks, as the chat draws a command you ran; the model reads it as text. */
export const asPrompt = (text: string) => (text.trimStart().startsWith('/') ? text.replace(/^\s*(\S+)/, '`$1`') : text)
/** A message that names one of the session's commands, as `$.command.run` takes it; null when it is a prompt. */
export function asCommand(text: string, names: string[]): { command: string; args: string } | null {
  const m = /^\/(\S+)\s*([\s\S]*)$/.exec(text)
  return m && names.includes(m[1]!) ? { command: m[1]!, args: m[2]! } : null
}

/** The session's title as the app last saved it in the transcript's tail, or null: no control or format characters
 * (bidi, zero-width; a joiner stays), at most 120 characters. */
export function titleFrom(tail: string): string | null {
  const m = [...tail.matchAll(/"customTitle":"((?:[^"\\]|\\.)*)"/g)].at(-1)?.[1]
  if (!m) return null
  // As pasteText: a zero-width joiner stays (emoji sequences), and the cut never splits a character. Joiners alone
  // show nothing: no title.
  try {
    const s = Array.from((JSON.parse(`"${m}"`) as string).replace(/\p{Cc}|(?!\u200d)\p{Cf}/gu, '')).slice(0, 120).join('').trim()
    return s.replace(/\u200d/g, '').trim() ? s : null
  } catch { return null }
}

export const newBeat = (id: string, name: string, now: number): Beat => ({
  id, name, at: now, ended: false, notes: [],
  agents: { [MAIN]: { role: 'jefe', kind: 'principal', state: 'inactivo', activity: t('act.idle'), cmd: null, since: now } },
})

/** A subagent's desk, from its type: reviewers and testers have their own; everyone else implements. */
// Desks by agent type. The team flow's: builder and spec-writer build (impl), the ux, ui and code reviewers review
// (rev), the security reviewer and the approver guard the gate (qa).
export const roleOf = (type: string): AgentvilleRole => (/security|approv|qa|test|verif/i.test(type) ? 'qa' : /review/i.test(type) ? 'rev' : 'impl')

const READS = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'NotebookRead', 'ToolSearch', 'TaskOutput'])
const cut = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
// Known secret shapes, masked before anything is cut or written: a labeled one keeps its label. Best effort, a
// secret of any other shape stays as it is. A masked value is token characters only, so shell syntax (; | & $ ( ) < >
// { } spaces, backticks) always stays visible.
export const MASK = '•••'
const VALUE = String.raw`[\w.~+/=:@!#%^*?,-]+`
const SECRETS: [RegExp, string][] = [
  [new RegExp(String.raw`\b(Bearer\s+)${VALUE}`, 'gi'), `$1${MASK}`],
  [new RegExp(String.raw`(--password[= ])${VALUE}`, 'gi'), `$1${MASK}`],
  [new RegExp(String.raw`\b(\w*(?:password|token|api_?key|secret)=)${VALUE}`, 'gi'), `$1${MASK}`],
  [/\b(?:sk-[\w-]{20,}|gh[po]_\w{10,}|github_pat_\w{10,}|xox[bpa]-[\w-]{10,}|AKIA[0-9A-Z]{16})\b/g, MASK],
  // 40+ hex or base64 after = or :, with a digit and not a path (no leading /, nothing path-like right after it)
  [/([=:]\s*)(?!\/)(?=[A-Za-z0-9+/]*\d)[A-Za-z0-9+/]{40,}={0,2}(?![\w.+/-])/g, `$1${MASK}`],
]
/** `text` with the secrets it shows masked (••• in their place); masking twice changes nothing more. */
export const redact = (text: string) => SECRETS.reduce((t, [re, to]) => t.replace(re, to), text)
// The goals file (.agentville/metas.md) is the repository's, so untrusted: only its first 3 `## ` headings reach the
// beat, without invisible or control characters, masked, then cut to 60.
export const METAS_MAX = 16384
export const metasOf = (text: string) => [...text.matchAll(/^##[ \t]+(.+)$/gm)]
  .map((m) => cut(redact(m[1]!.replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\u2028\u2029]/gu, '').trim()), 60)).filter(Boolean).slice(0, 3)
/** A command shown with a part hidden is never answered from the pane: what it runs is read in the session. */
export const isMaskedCmd = (cmd: string | null | undefined) => !!cmd && cmd.includes(MASK)

/** What an agent does while a tool runs, in the pane's words; `cmd` is what a permission request shows (masked) and
 * `size` the length of the command before masking. For any tool but Bash, `cmd` is the tool's full name and every
 * argument it gets, one per line, each value as JSON (so a newline in a value never draws as another argument): what
 * an Aprobar allows, whole. */
export function doing(tool: string, input: unknown): { state: AgentvilleStateName; activity: string; cmd: string; size: number } {
  const i = (input ?? {}) as Record<string, unknown>
  // Only the first CMD_MAX * 2 characters of a value are masked and shown (the card shows CMD_MAX at most); `size`
  // counts them all, so a longer one is answered in the session.
  const LIM = CMD_MAX * 2
  if (tool === 'Bash') { const raw = String(i.command ?? ''), c = redact(raw.slice(0, LIM)) + (raw.length > LIM ? '…' : ''); return { state: 'trabajando', activity: cut('Bash ' + c), cmd: c, size: raw.length } }
  const name = tool.startsWith('mcp__') ? tool.split('__').pop()! : tool
  const raw = i.file_path ?? i.notebook_path ?? i.path ?? i.pattern ?? i.url ?? i.query ?? i.description
  const shown = typeof raw === 'string' ? redact(raw) : ''
  const target = shown.includes('/') ? shown.split('/').pop()! : shown
  const activity = cut(target ? `${name} ${target}` : name)
  let extra = 0
  const arg = (v: unknown) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)
    if (s.length > LIM) extra += s.length - LIM
    return typeof v === 'string' ? JSON.stringify(s.slice(0, LIM)) : s.slice(0, LIM)
  }
  const all = Object.entries(i)
  if (all.length > 20) extra += LIM
  // A key that is not a plain name is quoted too, so no key can draw as a line of its own.
  const full = [tool, ...all.slice(0, 20).map(([k, v]) => `${/^[\w-]{1,64}$/.test(k) ? k : JSON.stringify(k)}: ${arg(v)}`)].join('\n')
  return { state: READS.has(tool) ? 'leyendo' : 'trabajando', activity, cmd: redact(full), size: full.length + extra }
}

/** A permission request's command is kept up to this; a longer one ends in '…' and is answered in the session. */
export const CMD_MAX = 300
export const isCutCmd = (cmd: string | null | undefined) => !!cmd && cmd.length >= CMD_MAX && cmd.endsWith('…')
/** A request shown as a tool's call (`doing`'s shape: its name, then one `key: value` per line): any tool but Bash. A
 * request with no tool named (a session on an older mod) reads as a command. */
export const isToolCall = (tool: string | null | undefined) => !!tool && tool !== 'Bash'
/** A request in one line for the banner: a tool's call as its short name and its first argument's value (a path as its
 * file name, a URL as its host and last segment); a command as itself, its whitespace flattened. The card and the alt
 * keep the whole request. */
export function cmdTitle(cmd: string, tool?: string | null) {
  const [head, first] = cmd.split('\n')
  if (!isToolCall(tool) || first === undefined) return cmd.replace(/\s+/g, ' ').trim()
  const raw = first.replace(/^(?:[\w-]{1,64}|"(?:[^"\\]|\\.)*"): /, '')
  let v = raw
  try { const p = JSON.parse(raw) as unknown; if (typeof p === 'string') v = p } catch { /* cut or not a string: as shown */ }
  v = v.replace(/\s+/g, ' ').trim()
  const url = /^[a-z]+:\/\/([^/?#]+)([^?#]*)/i.exec(v)
  const last = (p: string) => p.split('/').filter(Boolean).pop()
  const shown = url ? [url[1], last(url[2]!)].filter(Boolean).join('/') : v.includes('/') ? last(v) ?? v : v
  return cut(`${head!.startsWith('mcp__') ? head!.split('__').pop() : head} ${shown}`, 80)
}
/** A command with characters that draw nothing or something else (bidi, zero-width, tag characters) or controls other
 * than a newline or a tab: what it shows may not be what it runs, so it is answered in the session. */
export const isHiddenCmd = (cmd: string | null | undefined) => !!cmd && (HIDDEN.test(cmd) || /[\0-\x08\x0b-\x1f\x7f]/.test(cmd))
/** Updates one agent (a subagent seen for the first time implements) and stamps the beat. */
export function setAgent(b: Beat, key: string, now: number, patch: Partial<BeatAgent>) {
  const a = (b.agents[key] ??= { role: 'impl', kind: 'subagente', state: 'trabajando', activity: '', cmd: null, since: now })
  if (patch.state && patch.state !== a.state) a.since = now
  // Masked, then capped, so a long command or goal never swells the heartbeat (every pane reads it every 3 s).
  const p = { ...patch }
  if (p.cmd) p.cmd = cut(redact(p.cmd), CMD_MAX)
  if (p.activity) p.activity = cut(redact(p.activity), 120)
  if (p.goal) p.goal = cut(redact(p.goal), 120)
  if (p.answer) p.answer = cutAnswer(redact(p.answer))
  Object.assign(a, p)
  b.at = now
}

type Item = { content?: unknown; status?: unknown }
/** The session's task list becomes its board: TodoWrite sends the whole list, the desktop's plan sends it or moves it. */
export function notesFrom(b: Beat, input: unknown) {
  const i = (input ?? {}) as { todos?: Item[]; items?: Item[]; advance?: boolean; done?: number[]; start?: number }
  const list = i.todos ?? i.items
  if (Array.isArray(list)) { b.notes = list.slice(0, 30).map((t) => ({ t: cut(redact(String(t.content ?? '')), 200), done: t.status === 'completed', doing: t.status === 'in_progress' })); return }
  const doing = (k: number) => b.notes.forEach((x, j) => { x.doing = j === k && !x.done })
  if (i.advance) {
    const k = b.notes.findIndex((x) => !x.done)
    if (k >= 0) { b.notes[k]!.done = true; doing(b.notes.findIndex((x) => !x.done)) }
  }
  for (const d of i.done ?? []) if (b.notes[d - 1]) b.notes[d - 1]!.done = true // 1-based, as the plan tool counts
  if (typeof i.start === 'number') doing(i.start - 1)
}

/** Records a tool call as a step (the last 8 are kept); returns its number for `endStep`. */
export function addStep(b: Beat, who: AgentvilleRole, text: string): number {
  const n = (b.steps?.at(-1)?.n ?? 0) + 1
  b.steps = [...(b.steps ?? []), { n, who, text, ok: null }].slice(-24) // enough for each subagent's action plan
  return n
}
export function endStep(b: Beat, n: number, ok: boolean) {
  const s = b.steps?.find((x) => x.n === n)
  if (s) s.ok = ok
}
/** A background command's end, from the notification the session receives (`<task-id>`, `<status>`). */
export function bgFrom(b: Beat, text: string) {
  const id = /<task-id>([^<]+)<\/task-id>/.exec(text)?.[1], status = /<status>([^<]+)<\/status>/.exec(text)?.[1]
  const t = b.bg?.find((x) => x.id === id)
  if (t && status) t.status = status === 'completed' ? 'terminó' : 'falló'
}
/**
 * A conversation row as the pane shows it: Claude's text blocks, or a prompt you sent (typed, not a tool result or a
 * reminder). Anything else is null.
 */
type Msg = { type: string; isMeta?: true; content?: unknown }
type Blk = { type?: string; text?: string; name?: unknown; input?: unknown; source?: { data?: string; media_type?: string } }
const blocksOf = (m: Msg): Blk[] => (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : Array.isArray(m.content) ? (m.content as Blk[]) : [])
// An image named by its file, as the app writes a pasted one ("[Image: source: /path]") and the pane sends one.
const IMG_PATH = /\[Image: (?:source: )?(\/[^\]\n]+)\]/g

// The files Claude sent with SendUserFile (any server's tool of that name), absolute or relative to the cwd: sane strings only.
type Send = { caption?: unknown; files?: unknown }
const sendsOf = (m: Msg): Send[] => (m.type !== 'assistant' ? [] : blocksOf(m).filter((x) => x.type === 'tool_use' && /(^|__)SendUserFile$/.test(String(x.name)) && x.input && typeof x.input === 'object').map((x) => x.input as Send))
// Any server's tool of that name (ccd_turn, ccd_session, or the same server renamed), from Claude's rows only.
export const WRAP = /(^|__)wrap_up$/, START = /(^|__)start_session$/, DISMISS = /(^|__)dismiss_task$/
type Use = Record<string, unknown> & { __id?: unknown }
const usesOf = (m: Msg, re: RegExp): Use[] => (m.type !== 'assistant' ? [] : blocksOf(m).filter((x) => x.type === 'tool_use' && re.test(String(x.name)) && x.input && typeof x.input === 'object' && !Array.isArray(x.input)).map((x) => ({ ...(x.input as Use), __id: (x as { id?: unknown }).id })))
const filesOf = (s: Send) => (Array.isArray(s.files) ? s.files : []).filter((f): f is string => typeof f === 'string' && f.length > 0 && f.length <= 1024 && !/[\n\0]/.test(f))
export const isImg = (f: string) => /\.(png|jpe?g|gif|webp)$/i.test(f)
const baseOf = (f: string) => f.split('/').filter(Boolean).pop() ?? f

/** The images of a conversation row: pasted bytes, files named in the text, or pictures sent with SendUserFile (3 at most). */
export type ImgRef = { data: string; media: string } | { path: string }
export function imagesOf(m: Msg): ImgRef[] {
  if (m.isMeta || (m.type !== 'assistant' && m.type !== 'user')) return []
  const blocks = blocksOf(m)
  return [
    ...blocks.filter((x) => x.type === 'image' && x.source?.data).map((x) => ({ data: x.source!.data!, media: x.source!.media_type ?? 'image/png' })),
    ...blocks.flatMap((x) => (x.type === 'text' ? [...(x.text ?? '').matchAll(IMG_PATH)].map((g) => ({ path: g[1]!.trim() })) : [])),
    ...sendsOf(m).flatMap(filesOf).filter(isImg).map((path) => ({ path })),
  ].slice(0, 3)
}

export function chatFrom(m: Msg): AgentvilleChat | null {
  if (m.isMeta || (m.type !== 'assistant' && m.type !== 'user')) return null
  const blocks = blocksOf(m)
  if (blocks.some((x) => x.type === 'tool_result')) return null
  // A slash command (a skill too) you ran: the app records only its envelope; it reads as the command, drawn as code.
  const all = blocks.map((x) => x.text ?? '').join('\n'), cmd = /<command-name>([^<]+)<\/command-name>/.exec(all)
  if (m.type === 'user' && cmd) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(all)?.[1]?.trim()
    return { who: 'tú', text: `\`${cmd[1]!.trim()}\`${args ? ` ${args}` : ''}` }
  }
  // The app puts its own envelopes (a <system-reminder>, a task notification, a command) in blocks of their own,
  // even beside your words: drop those blocks, keep the rest.
  const said = blocks.filter((x) => x.type === 'text' && x.text && !x.text.trimStart().startsWith('<')).map((x) => x.text).join('\n\n').replace(IMG_PATH, '').trim()
  // A sent file reads as its caption and a line per non-image file; pictures alone read as their names, so two sends never merge.
  const sent = sendsOf(m), files = sent.flatMap(filesOf)
  // wrap_up's recap reads as Claude's words (the question waits in the despacho, not in the chat).
  const recap = usesOf(m, WRAP).map((i) => (typeof i.recap === 'string' ? cut(i.recap.trim(), 600) : '')).filter(Boolean).join('\n\n')
  const note = [recap, ...sent.map((s) => (typeof s.caption === 'string' ? s.caption.trim() : '')), ...files.filter((f) => !isImg(f)).map((f) => t('chat.file', { name: baseOf(f) }))].filter(Boolean).join('\n')
  const text = redact([said, note].filter(Boolean).join('\n\n') || files.filter(isImg).map(baseOf).join(', '))
  if (!text && !imagesOf(m).length) return null
  return { who: m.type === 'assistant' ? 'claude' : 'tú', text: text.length > 1500 ? text.slice(0, 1499) + '…' : text }
}
/** A reload starts the module over: the session keeps what its last heartbeat said (chat, plan, steps, background, island, parent, record id). */
export function carryOver(b: Beat, old: Beat | null) {
  if (old?.id !== b.id) return
  for (const k of ['chat', 'notes', 'steps', 'bg', 'slot', 'usage', 'tools', 'openSteps', 'parent', 'local', 'ask', 'offers', 'metas'] as const) if (old[k]) (b as Record<string, unknown>)[k] = old[k]
}
// A sleeper stays SLEEP_MS after its last word; a message wakes it on its own island. An archived chat leaves at once
// (the pane reads the app's `isArchived`, see lookArchived in register.tsx).
export const SLEEP_MS = 2 * 3600000
// An office nobody worked in for this long leaves the map (it stays in the list) until its next activity. Change here.
export const IDLE_MS = 15 * 60000
const PENDING = new Set<AgentvilleStateName>(['esperando', 'trabajando', 'leyendo', 'error'])
/** Someone in the session waits for you, works, reads or failed: it keeps its office. */
export const pending = (b: Beat) => Object.values(b.agents).some((a) => PENDING.has(a.state))
/** Idle: awake, nobody pending, and quiet for IDLE_MS or hidden by /agentville refresh (`hidden[id]` >= its last beat). */
export const isIdle = (b: Beat, now: number, hidden: Record<string, number> = {}) =>
  !b.ended && !pending(b) && (now - b.at >= IDLE_MS || (hidden[b.id] ?? -Infinity) >= b.at)
/** How many steps of the session's plan are still open (pending or under way). */
export const openOf = (b: Beat) => b.notes.filter((x) => !x.done).length
/**
 * The island a session keeps (floor * 16 + slot), chosen by the session itself so every pane draws the house alike:
 * its own while no awake session with a smaller id holds it, else the lowest one free. A sleeping or idle session holds
 * none; its slot stays in its heartbeat, so it gets it back when it returns if it is still free.
 */
export function claimSlot(mine: Beat, live: Beat[], now: number, hidden: Record<string, number> = {}): number {
  const held = new Map<number, string>()
  const awake = live.filter((b) => b.id !== mine.id && !b.ended && !isIdle(b, now, hidden))
  for (const b of awake) if (b.slot !== undefined && !(b.id > (held.get(b.slot) ?? '\uffff'))) held.set(b.slot, b.id)
  let n = 0
  while (held.has(n)) n++
  // The house is as deep as its sessions need: an island past the rows they fill moves up to the first free one.
  const needed = Math.ceil((awake.length + 1) / 4) * 4
  if (mine.slot !== undefined && !(mine.id > (held.get(mine.slot) ?? '\uffff')) && (mine.slot < needed || n > mine.slot)) return mine.slot
  return n
}
/**
 * The conversation as the transcript holds it (the tail of the session's JSONL file): what a reload missed, since a
 * reload swaps the module while the app writes, comes back. Rows only, no thumbnails.
 */
export function chatOfTranscript(tail: string): AgentvilleChat[] {
  const b = newBeat('t', 't', 0)
  for (const line of tail.split('\n').slice(1)) { // the first line may be cut in half
    let r: { type?: string; isMeta?: true; isSidechain?: boolean; timestamp?: unknown; message?: { content?: unknown } }
    try { r = JSON.parse(line) } catch { continue }
    if ((r.type !== 'user' && r.type !== 'assistant') || r.isSidechain) continue
    const c = chatFrom({ type: r.type, isMeta: r.isMeta, content: r.message?.content })
    const at = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN
    if (c?.who === 'tú' && Number.isFinite(at)) c.at = at // as the session stamps a row of yours (session.append)
    if (c) pushChat(b, c)
  }
  return b.chat ?? []
}
export const pushChat = (b: Beat, row: AgentvilleChat) => {
  const c = { ...row, text: redact(row.text) }
  const last = b.chat?.at(-1)
  if (last && last.who === c.who && last.text === c.text && !last.queued === !c.queued) return // the same row twice in a row is one message
  // A message delivered after waiting in the queue takes the queued row's place.
  const rows = c.queued ? b.chat ?? [] : (b.chat ?? []).filter((x) => !(x.queued && x.text === c.text))
  b.chat = [...rows, c].slice(-CHAT_KEPT)
}
const CHAT_KEPT = 12
export const cutAnswer = (s: string) => (s.length > 4000 ? s.slice(0, 3999) + '…' : s)
/** A subagent's words on its desk: the last 4, each cut as an answer is (the pane folds and dedupes them alike). */
export const addSaid = (said: string[] | undefined, text: string) => [...(said ?? []), cutAnswer(redact(text))].slice(-4)
export const isTaskList = (tool: string) => tool === 'TodoWrite' || tool.endsWith('__update_plan')

// Questions and suggested sessions. All of it is model-authored, so untrusted: strict shapes, capped and masked, and a
// reply that could not be sent exactly as shown (too long, masked, a slash command, an app action) is only shown.
const TU = /^[A-Za-z0-9_-]{1,100}$/
export const TASK = /^task_[A-Za-z0-9]{4,40}$/
/** The app's refusal to start a session (match on the text trimmed at its start). */
export const REFUSED = /^Start sessions only on the user's own words/
/** Characters that draw nothing or something else than they say: format controls (zero-width, bidi overrides, tag
 * characters), private use, unassigned code points, line and paragraph separators. Text with any of them is never sent
 * as your words, and a suggested session whose title has one is dropped (its title goes into a prompt). */
export const HIDDEN = /[\p{Cf}\p{Co}\p{Cn}\u2028\u2029]/u
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const one = (s: string) => s.replace(/\s+/g, ' ').trim()
/** A suggested session's stored title, made safe for Arrancar's prompt-box line (it becomes your words on Enter; a title
 * carried over from the session file was never checked): null for a non-string or one with hidden or control characters,
 * else one line, quote marks stripped (before masking, so a quote never splits a secret), masked, 80 at most, and the
 * task id when nothing is left. */
export const pressTitle = (raw: unknown, id: string) =>
  typeof raw !== 'string' || HIDDEN.test(raw) || /\p{Cc}/u.test(raw) ? null : cut(redact(one(raw).replace(/[«»"“”]/g, '')), 80).trim() || id
/** A suggested session lasts this long in the app unless started or dismissed. */
export const OFFER_TTL = 7 * 86400000
const OFFERS_KEPT = 20
/** The app-only actions wrap_up may offer; any other value is kept as an app-only reply with no `action`. */
export const APP_ACTIONS = ['commit', 'create_pr', 'merge', 'fix_ci', 'address_comments', 'resolve_conflicts', 'verify', 'archive', 'new_session'] as const
export type AppAction = (typeof APP_ACTIONS)[number]
const isAppAction = (v: unknown): v is AppAction => (APP_ACTIONS as readonly unknown[]).includes(v)
/** A reply text the pane may send as your prompt: short, unmasked, printable and visible, never a slash command. */
export const canSend = (text: string) => !!text && text.length <= 400 && !text.startsWith('/') && redact(text) === text && !/[\0-\x08\x0b-\x1f\x7f]/.test(text) && !HIDDEN.test(text)
function replyOf(a: unknown): AskReply | null {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null
  const r = a as Record<string, unknown>, label = cut(redact(one(str(r.label))), 40)
  const text = (str(r.message) || str(r.label)).trim() // a label-only action sends its label
  if (!label) return null
  if (r.action === undefined && canSend(text)) return { label, text }
  return { label, text: cut(redact(text), 400), app: true, ...(isAppAction(r.action) ? { action: r.action } : {}) }
}
/** The question a row's wrap_up asks, with up to 4 replies; null when it asks nothing (its recap is a chat row). */
export function askOf(m: Msg): BeatAsk | null {
  const w = usesOf(m, WRAP).at(-1), q = w ? cut(redact(str(w.ask).trim()), 300) : ''
  if (!w || !q || typeof w.__id !== 'string' || !TU.test(w.__id)) return null
  const replies = (Array.isArray(w.actions) ? w.actions.slice(0, 16) : []).map(replyOf).filter((x): x is AskReply => !!x).slice(0, 4)
  return { id: w.__id, q, replies, ...(w.blocked === true ? { blocked: true as const } : {}) }
}
type Result = { tu: string; text: string; error: boolean }
const resultsOf = (m: Msg): Result[] => (m.type !== 'user' ? [] : blocksOf(m).flatMap((x) => {
  const r = x as Blk & { tool_use_id?: unknown; content?: unknown; is_error?: unknown }
  if (r.type !== 'tool_result' || typeof r.tool_use_id !== 'string') return []
  const text = typeof r.content === 'string' ? r.content : Array.isArray(r.content) ? (r.content as Blk[]).map((c) => (c?.type === 'text' ? str(c.text) : '')).join('\n') : ''
  return [{ tu: r.tool_use_id, text, error: r.is_error === true }]
}))
/**
 * Applies one main-conversation row to the beat's question and suggested sessions; true when either changed. A wrap_up
 * sets the question (or clears it when it asks none); a proposed start_session waits for its result, which gives it its
 * task id (a card) or drops it (refused); a start by proposal_id or a dismiss_task closes its card once it goes through.
 */
export function asksFrom(b: Beat, m: Msg, now: number): boolean {
  const before = JSON.stringify([b.ask, b.offers])
  if (usesOf(m, WRAP).length) { const a = askOf(m); if (a) b.ask = a; else delete b.ask }
  let offers = (b.offers ?? []).filter((o) => now - o.at < OFFER_TTL)
  const closing = (id: unknown, tu: unknown) => { if (typeof id === 'string' && typeof tu === 'string' && TU.test(tu)) offers = offers.map((o) => (o.id === id ? { ...o, end: tu } : o)) }
  for (const i of usesOf(m, START)) {
    if (i.proposal_id !== undefined) { closing(i.proposal_id, i.__id); continue }
    const tu = i.__id, title = cut(redact(one(str(i.title))), 80)
    if ((i.initiation !== 'own_initiative' && i.initiation !== 'offer') || typeof tu !== 'string' || !TU.test(tu) || !title || HIDDEN.test(str(i.title)) || offers.some((o) => o.tu === tu)) continue
    offers.push({ tu, title, brief: cut(redact(one(str(i.prompt))), 160), at: now })
  }
  for (const i of usesOf(m, DISMISS)) closing(i.task_id, i.__id)
  for (const r of resultsOf(m)) {
    offers = offers.flatMap((o) => {
      if (o.tu === r.tu && !o.id) { const id = /\btask_id: (task_[A-Za-z0-9]+)/.exec(r.text)?.[1]; return id && TASK.test(id) && !r.error ? [{ ...o, id }] : [] }
      // shortcut: a start or dismiss that did not fail or get refused counts as done; upgrade if the app names success.
      if (o.end === r.tu) { if (!r.error && !REFUSED.test(r.text.trimStart())) return []; const { end: _, ...rest } = o; return [rest] }
      return [o]
    })
  }
  offers = offers.slice(-OFFERS_KEPT)
  if (offers.length) b.offers = offers
  else delete b.offers
  return JSON.stringify([b.ask, b.offers]) !== before
}
/**
 * Any session's start (by proposal_id) or dismiss_task calls in one row, by their tool_use id (`uses`: [tu, task id,
 * kind]), and the results that came back in it, not failed (`results`: [tu, text]). A suggestion withdrawn from another
 * session than the one that offered it settles through these (the pane's shared store), as a pane press does, but only
 * on the app's own success wording (closedOk).
 */
export type Closing = 'start' | 'dismiss'
export function closingsFrom(m: Msg): { uses: [tu: string, id: string, kind: Closing][]; results: [tu: string, text: string][] } {
  const uses = [...usesOf(m, START).map((i) => [i.__id, i.proposal_id, 'start'] as const), ...usesOf(m, DISMISS).map((i) => [i.__id, i.task_id, 'dismiss'] as const)]
    .filter((x): x is [string, string, Closing] => typeof x[0] === 'string' && TU.test(x[0]) && typeof x[1] === 'string' && TASK.test(x[1]))
  return { uses, results: resultsOf(m).filter((r) => !r.error).map((r) => [r.tu, r.text] as [string, string]) }
}
/** The app's own words for a start or dismiss that went through (as its transcripts read, 2026-10-19). */
export const closedOk = (kind: Closing, id: string, text: string) =>
  (kind === 'dismiss' ? text.trimStart().startsWith(`Task ${id} withdrawn`) : /^Started session "/.test(text.trimStart()))
/**
 * The question and suggested sessions a transcript tail leaves, replayed over `seed` (the beat's own): each main row
 * in order, at its own time (so the offer TTL holds), a message you typed answering the question as it does live.
 * `cut`: the tail is the file's end, not all of it, so its first line may be half a line.
 */
export function asksOfTranscript(tail: string, seed: Pick<Beat, 'ask' | 'offers'> = {}, cut = true): Pick<Beat, 'ask' | 'offers'> {
  const b = newBeat('t', 't', 0)
  if (seed.ask) b.ask = seed.ask
  if (seed.offers) b.offers = seed.offers
  for (const line of tail.split('\n').slice(cut ? 1 : 0)) {
    let r: { type?: string; isMeta?: true; isSidechain?: boolean; timestamp?: unknown; message?: { content?: unknown } }
    try { r = JSON.parse(line) } catch { continue }
    const now = typeof r?.timestamp === 'string' ? Date.parse(r.timestamp) : NaN
    if ((r?.type !== 'user' && r?.type !== 'assistant') || r.isSidechain || !Number.isFinite(now)) continue // no time: its offers could not expire
    const m = { type: r.type, isMeta: r.isMeta, content: r.message?.content }
    asksFrom(b, m, now)
    if (chatFrom(m)?.who === 'tú') delete b.ask
  }
  return { ...(b.ask ? { ask: b.ask } : {}), ...(b.offers ? { offers: b.offers } : {}) }
}
/** The suggested-session cards to draw: those the app accepted (a task id) and not yet expired. */
export const shownOffers = (b: { offers?: BeatOffer[] }, now: number) => (b.offers ?? []).filter((o) => o.id && now - o.at < OFFER_TTL)
/** How old a dismiss or fill order may be when its session acts on it: under the pane's 10 s wait, so a pane that already
 * said "no answer" is never followed by a late action from a slow wake. */
export const OFFER_ORDER_MS = 8000
/** Whether session `b` acts on a signed dismiss or fill order at `now`: fresh, a well-formed task id, one of its own shown
 * suggestions with no start or dismiss under way, and not settled already (`done`, the shared offers-done marks). Any
 * other kind (an older pane's start) is false, so it acks gone. */
export const offerOrderOk = (b: { offers?: BeatOffer[] }, c: Cmd, now: number, done: Record<string, number>) =>
  (c.kind === 'dismiss' || c.kind === 'fill') && typeof c.req === 'string' && TASK.test(c.req) && now - c.n / 1000 <= OFFER_ORDER_MS &&
  !done[c.req] && shownOffers(b, now).some((o) => o.id === c.req && !o.end)
