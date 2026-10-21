export type AgentvilleRole = 'jefe' | 'impl' | 'rev' | 'qa'
export type AgentvilleStateName = 'esperando' | 'error' | 'trabajando' | 'leyendo' | 'inactivo' | 'terminado'
export type AgentvilleFacing = 'fl' | 'fr' | 'bl' | 'br'
export type AgentvillePosture = 'stand' | 'sit'
export type AgentvilleNote = { t: string; done: boolean; doing?: boolean }
/** One tool call of a session, newest last; `ok` is null while it runs. */
export type AgentvilleStep = { n: number; who: AgentvilleRole; text: string; ok: boolean | null }
/** One message of a session's conversation: Claude's text as it writes it, or what you sent. */
// pics: thumbnails the session made of the message's images (files under ~/.claude/agentville/images, base64 jpeg),
// and the full image a click opens.
// queued: a message you sent while the session was busy, waiting for its turn (the delivered one replaces it).
// at: when a row of yours was kept (ms), so the pane knows a message it sent was taken; absent on older rows.
export type AgentvilleChat = { who: 'claude' | 'tú'; text: string; queued?: true; at?: number; pics?: { file: string; w: number; h: number; orig?: string }[] }
/** A command the session left running in the background. */
export type AgentvilleBgTask = { id: string; text: string; status: 'corriendo' | 'terminó' | 'falló' }
/** A session's island. `floor` and `slot` (0-15) order it on its floor (the even grid places it, `room`; none while
 * asleep or idle); `away` marks one from another floor, shown only because one of its agents waits in your office.
 * `idle`: nobody worked in it for a while (or /agentville refresh hid it), so it is off the map until its next activity.
 * `openSteps`: steps of its plan left open when its last turn ended.
 * `parent`: the dept id of its family's root (a child room in the root's family block; a grandchild joins the root's);
 * `from` (set with `parent`): the session that started this one, the list's tree link; `fam` (on the parent
 * only): child rooms drawn and how many more are not shown. `local`: its record id in the Claude app (`local_<uuid>`,
 * checked), so the pane can open its chat there.
 * A team office (its subagents named "<Letter>: <team>") is one wide room: `desks` are its desks' corners (world tiles,
 * the Jefe's first, each by the agent sitting there), `teams` its rows with a floor label (`row` 0-2, `more` members
 * not shown). `metas`: the goal headings its repository's goals file gave (at most 3). */
// What a session has used, as /usage and /context count it: the context window's fill (by category), the money spent
// (US dollars, the session's own ledger, subagents included), the rate-limit windows, and calls per tool.
export type AgentvilleUsage = { pct: number; tokens: number; window: number; usd?: number; model?: string; cats: { name: string; tokens: number; color: string }[]; limits: { kind: string; pct: number }[] }
/** The question a session's Jefe ended its turn with (wrap_up), as the pane shows it: Claude's replies, each sent as your
 * prompt byte for byte (`text`), or an app action (`app`, with its `action` when the app names one) shown or run apart. */
export type AgentvilleReply = { label: string; text: string; app?: true; action?: string }
export type AgentvilleAsk = { id: string; q: string; replies: AgentvilleReply[]; blocked?: true }
/** A session the Jefe suggested (start_session), by the task id the app gave it: started or dismissed from the pane. */
export type AgentvilleOffer = { id: string; title: string; brief: string }
export type AgentvilleDept = { id: string; name: string; task: string; color: string; room: number[]; floor?: number; slot?: number; away?: true; notes: AgentvilleNote[]; steps?: AgentvilleStep[]; bg?: AgentvilleBgTask[]; chat?: AgentvilleChat[]; asleep?: true; idle?: true; openSteps?: number; parent?: string; from?: string; local?: string; fam?: { rooms: number; more: number }; usage?: AgentvilleUsage; tools?: Record<string, number>; ask?: AgentvilleAsk; offers?: AgentvilleOffer[]; mod?: string; syncStuck?: string; desks?: AgentvilleDesk[]; teams?: AgentvilleTeam[]; metas?: string[] }
export type AgentvilleDesk = { id: string; x: number; y: number }
export type AgentvilleTeam = { letter: string; name: string; row: number; more: number }
/** A timed place to stand (delivering to the Jefe, seeing the secretaria, at Producto's door) until `until`. The
 * secretaria's own visit also names the session it is for (`of`) and the answer it follows (`at`); `rest`: that
 * session's turn was seen ending since. */
export type AgentvilleVisit = { x: number; y: number; until: number; of?: string; at?: number; rest?: true }
export type AgentvilleWalk = { pts: number[][]; start: number; dur: number }
export type AgentvilleAgent = {
  id: string
  dept: string
  role: AgentvilleRole
  state: AgentvilleStateName
  activity: string
  cmd: string | null
  /** The tool a waiting request is for (Bash or any other), when the session named it. */
  tool?: string
  /** A permission request the session holds for the pane to answer; null when the session's own prompt asks. */
  req: string | null
  /** When the session's hold of `req` ends (its clock, ms); kept after the hold ran out with no answer, so the pane
   * says that time is up. Absent from sessions on an older mod. */
  held?: number
  /** The agent's last answer, as it wrote it (cut to a few thousand characters). */
  answer?: string
  /** What a subagent wrote as it worked, its last few messages. */
  said?: string[]
  /** A subagent's own task list; the session's plan is the Jefe's. */
  notes?: AgentvilleNote[]
  /** What a subagent was sent to do (the Agent tool's description). */
  goal?: string
  /** Tokens a subagent's turns used (input, output and cache), and its model; no price per agent exists. */
  tokens?: number
  model?: string
  /** A subagent's Claude agent id (its heartbeat key, the id SendMessage takes) and its subagent type. */
  aid?: string
  kind?: string
  since: number
  calledUntil: number
  hair: string
  skin: string
  x: number
  y: number
  facing: AgentvilleFacing
  posture: AgentvillePosture
  lobbySpot: number
  walk: AgentvilleWalk | null
  visit?: AgentvilleVisit
}
export type AgentvilleLogLine = { at: number; text: string }
export type AgentvilleWorld = { v: number; depts: AgentvilleDept[]; agents: AgentvilleAgent[]; log: AgentvilleLogLine[]; allow: string[]; rows?: number; staff?: AgentvilleStaff }
/** The office's own staff, on every floor: the secretaria (a person at her desk in your office, `dept` empty) and what
 * Producto's goals board shows. */
export type AgentvilleStaff = { sec: AgentvilleAgent; goals: string[] }

declare module 'claude-code' {
  interface PluginState {
    agentville: { world: AgentvilleWorld | null; selected: string; floor: number; tab: string }
  }
}
