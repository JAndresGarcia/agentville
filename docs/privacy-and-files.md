# Privacy and files

Back to the [README](../README.md).

Everything stays on this machine: the mod makes no network calls. For the security summary (what it runs, what a panel
can do in another session, known limits, how to report an issue) see [Security](../SECURITY.md).

## How the panel learns about sessions

### Session status files

Every session with the mod writes a small status file (a heartbeat) to `~/.claude/agentville/sessions/<id>.json`, and
an open panel reads them all every 3 seconds. The status file holds the session title, agent names and states, the
commands they run and the permission requests they wait on, recent tool steps and background commands, the task
list, each agent's last answer, spend and token use, tool call counts, and the last 12 conversation messages (1,500
characters each) with the file paths of any images pasted into them. For each subagent it also holds its task, its
last 4 messages and its model, and `mod`: the first 12 hex characters of a SHA-256 over the mod's hooks, agents,
skills and plugin.json as that session loaded them. It stays on this machine; nothing leaves it.

### Older sessions

A session that loaded an older copy of the mod (its status file has no `mod`) may not report its
question or suggested sessions itself, so the panel reads them from that session's transcript in
`~/.claude/projects/*/<id>.jsonl`: it finds the file once, checks its size and time at most every 3 seconds, and reads
its last 400 KB (with `tail`, never a shell) only when it changed. The panel reads every live session's title from the
same tail. Nothing read there is written anywhere or leaves the machine; a reply is sent only from a button you press.

### Secrets

Commands, messages and pasted images can contain secrets (a token in a `curl`, for example). Obvious tokens are masked
in commands, answers, messages and the task list before they are written; the session title is not masked. Masking is
best effort and only catches known patterns. A masked part shows as ••• in the panel. A command with a masked part
cannot be approved from the panel (the card says "Command with hidden values"), so you answer it in the session
itself, where you see the full command. Everything stays in plain JSON under `~/.claude/agentville`, in a folder that
is yours alone (`chmod 700`), for as long as [How long files are kept](#how-long-files-are-kept) says.

## Reads

- The session status files in `~/.claude/agentville/sessions/` (every 3 s) and
  `~/.claude/plugins/installed_plugins.json`.
- Session transcripts, `~/.claude/projects/*/<id>.jsonl` (last 400 KB, see [Older sessions](#older-sessions)).
- The desktop app's own records under `~/Library/Application Support/Claude/`: the worktree registry
  (`git-worktrees.json`) and the app's session records (`claude-code-sessions/*/*/local_*.json`, of which it keeps
  only the session id, the title, whether it is archived and its last activity, and its own record id, which the mod
  then keeps in the session's status file).
- `.agentville/metas.md` at a repository's root (first 3 goal headings; symlinks refused, 16 KB at most).
- An image file a conversation names, only with an image extension and when it is a regular file of at most 20 MB,
  to draw its thumbnail with `sips`.
- The clipboard, only when you press Cmd+V in the panel's message field (`/usr/bin/osascript` saves an image as a
  png, `/usr/bin/pbpaste` reads text).

## Writes

- `~/.claude/agentville` (`chmod 700`, set before anything is written in it): `sessions/` (session status files),
  `control/` (signed orders), `commands/`, `viewer.json`, `images/` (thumbnails and copies of pasted images), and
  `render-log.json` only while `/agentville calibrate` runs or the `render-log` debugging switch in the plugin store
  is on. See [How long files are kept](#how-long-files-are-kept).
- The plugin store, `~/.claude/plugins/store/agentville_*.json`, a file Claude Code keeps (Agentville sets no file mode
  on it): the key that signs the panel's orders (`mailbox-key`; anything running as you can read it: MCP servers and
  other programs on this machine, and Bash through a command that does not name the store, since the Bash guard is
  partial, see [Signing and the folder](remote-control-and-mailbox.md#signing-and-the-folder)), your tour choices (flow,
  language, palette, where it opens), the one-time `team-flow-migrated` marker, the `render-log` switch, the
  `vector-people` switch (true draws the map's people as the old vector sprites, for comparison), offers already
  handled, the answers to dismiss orders (`offer-acks`: ok, settled, gone, declined, unclear or failed, kept 10
  minutes), a worktree and title cache, sync marks.

## How long files are kept

- The files of a session not updated for 7 days, whether or not it ended cleanly. A running session rewrites its
  status file at least every hour, even when idle, so its order and command files stay while it runs.
- Thumbnails untouched for 7 days.
- Full-size copies of pasted images after 1 day (they may show secrets or other apps), unless still attached to an
  unsent message.
- The disk screen's delete-images button deletes the files in `images/` at once, except an image still attached to an
  unsent message or named in a draft.
- `/agentville refresh` also deletes the records of sessions that ended more than 2 hours ago (your chats are not
  touched).
- Uninstalling leaves the folder; [Uninstall](install-and-update.md#uninstall) shows how to remove it.

## Adds to the system prompt

Of every session (session scope): the team flow rule, only when a team flow is chosen (see
[Team flow](team-flow.md)), and the relay rule, always (it acts only on your own prompt starting with the panel's
relay marker). Subagents of the team flow get one line asking for a TodoWrite plan in their spawn prompt.

## Acts only when you press

A button or its key in the panel: it sends your typed text, a reply button's text or a fixed request (clean up
worktrees, after a second press within 5 seconds) as your message, runs the app's commit, PR or merge prompt, approves
or rejects a permission request, calls the app's `dismiss_task` or `archive_session` (this session only), stops a turn,
opens an image in Preview, or opens that session's chat in the Claude app (`/usr/bin/open` with a
`claude://claude.ai/epitaxy/local_<id>` link built from the app's own record). "▸ Start in its chat" opens it too,
starting nothing itself and only leaving its line in that session's empty prompt box, never sent. "How to update" opens
it as well and sends nothing: it only says to type `/reload-plugins` there (see [Update](install-and-update.md#update)).

It writes to your clipboard only when you press a Copy button, copy a selection in the field, or a held-back
`/command` cannot be typed into its session's prompt box (you paste it there yourself).

## Third-party assets

`agentville/hooks/pixfont.ts` embeds the unmodified Google Fonts woff2 files of Pixelify Sans and IBM Plex Sans (OFL,
`agentville/FONTS-OFL.txt`), so the panel draws offline. SHA-256 of the decoded files:

- Pixelify Sans `0f2216c1b7bf13b775e7b825c15e1c8414f3899cbd4120f275cdc96001a053a0`
- IBM Plex Sans `056e4e2459f57a0033c8c9c844ff19d6e42ac8602027803d4345823bcc939818`

The file's header has the source URLs and a one-line check.
