# Security

This page says what the Agentville mod (the plugin in `agentville/`) can do on your machine, what it cannot do, and
its known limits. The details live in [Privacy and files](docs/privacy-and-files.md) and
[Messages and permission requests](docs/remote-control-and-mailbox.md).

## In short

- The mod itself makes no network calls; text it hands to a session as a prompt goes to Claude like anything you
  type. Its files never leave this machine.
- It reads and writes plain files under `~/.claude`, reads a few records of the Claude desktop app, and runs a short,
  fixed list of system programs, always by argv and never through a shell.
- A panel in one session can steer another session only through signed orders in a local mailbox, and only in the ways
  listed under [What a panel can do in another session](#what-a-panel-can-do-in-another-session). That includes
  rejecting a permission request another session holds, when you press Reject (or the R key) on its card. The panel
  never approves: Approve in chat (or the A key) only opens the chat where Claude's own prompt asks you.
- With the Agentville team flow chosen, the Lead and the approver merge or open pull requests only as the repository's
  rules or you allow, and deploy only when your own instructions or you say so.
- Links in replies open in your browser only when you click them, and a link whose label is not its address shows
  the real host beside it.

## What it reads

- The status files every session with the mod writes: `~/.claude/agentville/sessions/<id>.json`.
- Session transcripts, `~/.claude/projects/*/<id>.jsonl` (the last 400 KB, for titles and older sessions' questions).
- `~/.claude/plugins/installed_plugins.json`, to find the newest copy of the mod.
- The Claude desktop app's worktree registry (`~/Library/Application Support/Claude/git-worktrees.json`) and session
  records (`claude-code-sessions/*/*/local_*.json`: id, title, archived flag, last activity, record id).
- `.agentville/metas.md` at a repository's root (first 3 headings, 16 KB at most, symlinks refused).
- An image file a conversation names, only a regular file with an image extension of at most 20 MB.
- The clipboard, only when you press Cmd+V in the panel's message field.

## What it writes

- `~/.claude/agentville/` (`chmod 700`): `sessions/`, `control/` (signed orders), `commands/`, `viewer.json`,
  `images/` (thumbnails and copies of pasted images), and `render-log.json` only while a diagnostic is on.
- Its plugin store, `~/.claude/plugins/store/agentville_*.json`: the key that signs orders (`mailbox-key`) and your
  panel settings.
- Your clipboard, only when you press a Copy button, copy a selection in the field, or a held-back `/command` cannot be
  typed into its session's prompt box (you paste it there yourself).
- Additions to each session's system prompt: the relay rule, and the team flow rule only when you chose a team flow.
- With a team flow chosen, one fixed line appended to the prompt of the subagents it starts (its own and the session's,
  not other plugins'): "Before you start, write your plan with TodoWrite (if you have that tool) as 3 to 6 short steps,
  and mark each step in_progress and then completed as you go, so the person can follow your progress."

It deletes only its own files: status, order and command files of sessions untouched for 7 days, thumbnails after 7
days, full-size image copies after 1 day, and the images the disk screen's button deletes (a second press within 5
seconds confirms it). A running session keeps its own files fresh, and an image still attached to an unsent message or
named in a draft is never deleted.

## What it runs

Only these programs, by absolute path, with argv (no shell):

| Program | Why |
|---|---|
| `/bin/mkdir`, `/bin/chmod` | Make `~/.claude/agentville` and keep it private |
| `/bin/rm -f` | Delete its own old files listed above |
| `/bin/cat` | Read the app's worktree registry |
| `/bin/df`, `/usr/bin/du` | Free disk space, and the size of worktrees and its own folder |
| `/usr/bin/find`, `/usr/bin/grep` | Find the app's session records (fixed strings) |
| `/usr/bin/git status` | Whether a checkout of the mod has uncommitted changes (no locks, no fsmonitor) |
| `/usr/bin/tail`, `/usr/bin/head` | Read the end of a transcript, the start of an app record or of the goals file |
| `/usr/bin/sips`, `/usr/bin/base64` | Make image thumbnails |
| `/usr/bin/osascript`, `/usr/bin/pbpaste` | Read the clipboard on Cmd+V in the field |
| `/usr/bin/open` | Open a session's chat in the Claude app, or an image in Preview, when you press for it |

Inside Claude Code it uses the engine's own calls. What you type in the panel's field for the panel's own session is
submitted as if you typed it in that session's composer: a `/command` or skill named there runs as if you typed it
(`/reload-plugins` excepted, which it never runs). In any other session it submits a prompt only when a signed order
says so, and a message that arrives from the mailbox is always a prompt, never a command (below). It fills the line of
"▸ Start in its chat" (the button that starts a suggested session) or a `/command` the panel held back into its own
empty prompt box (never sent), and calls the app's `dismiss_task` and `archive_session` (this session only) when you
press for them. Each call carries a fixed consent text, never words a model wrote:
`The user pressed "Descartar" (dismiss) on a suggested session in Agentville.` for `dismiss_task`, and
`The user pressed the archive reply on this session's question in Agentville.` for `archive_session`.

## Signed local orders

The panel writes orders to `~/.claude/agentville/control/<id>.json`; each session reads only its own file. Every order
is signed with HMAC-SHA256 over its target session, number, kind, request id and text, with a key kept in the plugin
store, never in the mailbox. A session acts on an order only when the signature checks for that session, it is less
than two minutes old and not from the future, and its number is above the last order it accepted, so a forged,
stale, redirected or copied-back order does nothing.

## What a panel can do in another session

It can, when you press for it:

- Send a message, which arrives as if you typed it: your text, or the reply you pressed under its Lead's (the
  session's main agent) question
  (the text Claude offered, shown before you press, or the app's fixed commit, PR or merge prompt).
- Stop the running turn.
- Reject a permission request the session holds for the panel (about 8 seconds), and only when the whole request fits
  on the card (300 characters), has no masked part and no hidden characters. Nothing approves from the panel (since
  1.1.0): the session's permission hook answers only a signed reject, with fixed words, and passes every other request
  on to Claude's own prompt; Approve in chat opens that chat. Questions and plan approvals are always answered in the
  session.
- Dismiss a session that session suggested, or leave the "Start in its chat" line in its own empty prompt box (never
  sent).
- Type text into its prompt box, only when that box is empty, and never send it: a `/command` you typed in the field
  for that session (one line, at most 2000 characters, control and hidden characters dropped). It runs only if you
  press Enter in that chat.
- Ask its Lead, in a fixed message, to remove unused worktrees with the app's own tool (a second press within 5
  seconds confirms it), or to dismiss a suggested session when the app's tool is not there.

It cannot:

- Run a `/command` or skill there, even with a validly signed order. A session submits every message from its
  mailbox as a plain prompt, never as a command: a first word starting with `/` goes in backticks, so the model reads
  it as text. When the first word of a message is a command that session lists (or this session does), the field does
  not send it: it is typed into that session's empty prompt box (above), or copied to your clipboard, and the text
  stays in the field until it is typed there. Any other text starting with `/` (a file path, an unknown word) goes as
  a message. The panel's own session runs its commands from its own field, without the mailbox. Reply buttons and
  messages to a subagent never send one.
- Make it run `/reload-plugins`.
- Read its files, or act on an order that is unsigned, older than two minutes, signed for another session or already
  used.

## Tool guard

Claude's file tools may not write `~/.claude/agentville` (no forged orders), and may not read, search or write the
plugin store (the key), whether the path is relative or reached through a symlink. No tool that takes a command
(Bash, or an MCP shell) may run one that names the store (`.claude/plugins/store`) or the key (`mailbox-key`).

## Known limits

- **The Bash guard is partial.** It matches spellings only: a command that reaches the store without naming it (a
  glob such as `st*`, a variable, `cd` and then a relative path) still runs and can read the key. A Grep started at
  `~` or above also reaches the store. With the key, a program can sign orders for any session: reject a permission
  request that session holds for the panel (never approve one), type a prompt there, or leave a
  `/command` in its empty prompt box (never sent: it runs only if you press Enter there).
- Anything running as you (MCP servers, other programs) can read the plugin store and the mod's folder. The folder is
  `chmod 700`, which keeps other users out, not your own programs.
- A permission request rejected from the panel can be any tool's except AskUserQuestion and ExitPlanMode, with the
  checks above. Which agent a request belongs to is guessed by tool name, so when two agents of a session wait on
  the same tool at once, the panel may show the request under the wrong agent; the request and its answer are still
  the right ones.
- The `/command` check in the field uses the command list that session publishes and this session's own list. A
  command missing from both goes as a message; a session on this version gets it as text, and only a session on an
  older mod would still run it.
- Masking of secrets is best effort, for known token shapes only; session titles are not masked.
- The relay rule, the team flow rule and the reviewers' read-only rule are instructions to the model, not enforced by
  code. The goals file is repository text and the prompt says to ignore instructions in it.
- A repository's root CLAUDE.md line `Agentville: ship fast. Deploy: <command>` makes the Lead run that command after
  a merge, only once you confirmed that repository and that command.
- Only `/agentville sync` checks that you typed it. Other `/agentville` commands (refresh, language, map, calibration)
  run from any origin; `refresh` deletes the records of sessions that ended over 2 hours ago.
- Some settings live in the shared store and apply to every session: language, palette, the map toggle, the team flow
  and where the panel opens.

## Reporting an issue

Please report a security issue privately through GitHub's private vulnerability reporting:
<https://github.com/JAndresGarcia/agentville/security/advisories/new>. Do not open a public issue for it. Include the
mod's version (`agentville/.claude-plugin/plugin.json`), what you did and what happened.
