# Messages and permission requests

Back to the [README](../README.md).

The panel writes orders to `~/.claude/agentville/control/<id>.json` and each session reads its own file there every
1.5 seconds. From the panel you can send a session a message (it arrives as if you typed it), stop its running turn,
reject a permission request (or open its chat to approve it there), and start or dismiss a session it suggested (see [Questions and suggested
sessions](using-the-panel.md#questions-and-suggested-sessions)).

## Commands

A `/name` typed in the field runs as that command or skill only in the session the panel is open in, which takes it
straight from its own field, without the mailbox. A session submits every message from its mailbox as a plain prompt,
never as a command, even a validly signed one: a first word starting with `/` goes in backticks (as the chat draws a
command you ran), so the model reads it as text. The field
suggests the selected session's commands as you type, grouped by source, from the list each session keeps in
`~/.claude/agentville/commands/<id>.json`; → at the end of the text fills the picked one (Tab too, where the surface
hands Tab to the field: the desktop keeps it to move focus). For any other session the panel does not send a message
whose first word is a command that session lists (or this one does). Instead one signed order asks that session to
type the whole text, command and arguments, into its own prompt box, and that chat opens in the Claude app when its
link is known. The session types it only when its box is empty (or already holds that text), and never presses Enter:
nothing runs until you do. When it is typed, a toast says so ("Done: /review is typed in tienda's chat; press Enter
there") and the field empties. Otherwise (the box holds your text, the session is asleep or on an older mod, or no
answer comes in about 10 seconds) the text stays in the field, the whole text goes to the clipboard and a toast says
to paste it ("Copied: paste /review with Cmd+V in tienda's chat (your text stays in the field)"); if the clipboard
fails too, the toast says to type it there ("Not sent from here: type /review in tienda's chat. Your text stays in the
field"), as it does when that session is gone. When the panel cannot tell which session it runs in (its status file
failed to start, or the gap after /clear), every session counts as another one. Any other text starting with `/`, such
as a file path or an unknown word, goes as a message. Reply buttons and messages to a subagent never send a command
either.

## Messages to a subagent

With a subagent selected, the message field and the toast name it ("Write to Tomás…", "Sent to Tomás"), and the
message goes to the session's Lead marked for that subagent, which relays it and says so in one line. The subagent's
conversation shows it at once as "You → Tomás (on its way)" until Tomás writes again or starts on it, and the Lead's
conversation shows the marked message as "You → Tomás: <your text>" (while the Lead is busy, "You → Tomás (queued)"),
as long as that office still has Tomás; otherwise the message shows as sent. The text sent is unchanged.

## Dismiss orders

A dismiss order counts for 8 seconds, names only the kind and the task id, and the session acts on it only when the id
is one of its own open suggestions; it never reads anything a model wrote to decide.

## Permission requests

While a panel is open, a session holds a request for the panel for about 8 seconds (all the time Claude Code gives the
mod there), then falls back to its own prompt; with no panel open it asks in the session at once; a command or a file
edit too long to show whole is always answered in the session. The card shows exactly what is asked: a Bash command
in full; any other tool, its full name and each argument (the whole file path, the URL, an MCP tool's arguments).

The panel never approves (since 1.1.0). Reject (key R) sends a signed reject order, and the session answers the
request with a fixed deny ("Rejected from Agentville"); that is the only answer the session's permission hook gives.
Approve in chat (key A) sends nothing: it opens the chat where the app asks the request (for a session started from
another one, the chat that started it) and toasts that you approve it there when Claude asks (up to 8 s, when the
hold ends); with no chat link known, the toast names the session instead. When the hold ends unanswered, the hook
passes the request on and Claude's own prompt asks you, where you approve. A request too long to show whole, with a masked part, or with hidden characters
(bidirectional, zero-width, tag or control characters) gets no buttons and no A or R key: the card says to answer it
in the session.

A new request the panel can answer toasts once, naming both ways ("<role> · <office> asks permission: reject it here
within 8 s, or approve it in the chat"; several at once toast once with their count, "2 sessions ask for permission ·
reject here or approve in the chat"; one already past its hold gets no such toast, only
"<role> · <office> is waiting for you" when someone starts waiting with it), opens the
notes card on it (its pill counts the seconds left too and selects who asks, so R rejects it and A opens its chat at
once), and marks
the "N waiting" strip "New". Approve in chat and Reject count the seconds left
("Reject (6 s)"), and once they run out the card offers no answer and says to answer it in that chat of the app,
where the request shows. The panel trusts no hold end more than 10 seconds after the session started waiting, or after
now (all the time Claude Code gives the mod). A request the panel can no longer answer (its hold passed, no panel was
open, or it cannot be shown whole) keeps the whole request on its card and, when the app's chat link is known, offers
"↗ Open chat" to the chat where the app asks it: for a session started from another one, the chat
that started it, else its own. Questions and plan approvals always stay in the session. A message you send while a
session is busy shows at once as "You (queued)", in one of the chat's rows, until the session lists a
row of yours with those words written after the send (or 10 minutes pass); while a permission waits, the message field
says your message goes after it.

## Signing and the folder

Each order is signed (HMAC-SHA256) over its text and its target session with a key that only the plugin's store holds,
so an order for one session never acts in another, and it counts for two minutes. Each order acts once: a session
keeps the number of the last order it accepted and drops any order numbered at or below it, so an order copied back
into the mailbox does nothing. The folder is yours alone
(`chmod 700`). How long its files are kept: [Privacy and files](privacy-and-files.md#how-long-files-are-kept).

Claude's Write, Edit, MultiEdit and NotebookEdit may not write the folder, nor the store's file. Read may not read the
store's file, and Grep and Glob may not search it or a folder from `~/.claude` down that holds it. A relative path
counts from the session's folder. Bash, or any tool that takes a command (an MCP shell), may not run one that names
the store (`.claude/plugins/store`, quotes, backslashes, `//` and `/./` ignored) or the key (`mailbox-key`). This
guard is partial: a command that reaches the store without spelling it (a glob such as `st*`, a variable, `cd` and
then a relative path) still runs. Not guarded at all: a Grep started at `~` or above (Claude Code's Grep passes
`--hidden`, so it reaches the store), MCP servers and other programs running as you. See [Security](../SECURITY.md)
and [Privacy and files](privacy-and-files.md) for everything the mod reads and writes.
