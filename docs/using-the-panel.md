# Using the panel

Back to the [README](../README.md). The panel speaks English or Spanish; these pages name each control by its English
label.

## Language

The panel speaks English or Spanish: you pick the language in the first step of the [tour](#tour), and can change it
any time with the ES | EN switch in the panel's header (right of Tour and Always open; the language in use is filled)
or with `/agentville lang es|en` (`/agentville idioma es|en` works too), which answers in one line and opens no panel.
Until you pick, it is English.

## Tour

The first time the panel opens, Gem, the Secretary, shows you around the real map. The map dims, a pulsing amber
ring lights one thing at a time, and her speech bubble explains it. The choices open as a card in the middle of the
dimmed map. Up to 12 steps:

1. Idioma / Language: Español or English.
2. Each session is an office: your first office on the floor.
3. The Lead: that session's main agent.
4. The team: the subagents at their desks.
5. The board: the office plan.
6. The usage screen: context and cost.
7. The common area: where idle agents rest.
8. Your desk: where requests wait for your OK.
9. Go to a chat: the ↗ on a list row, shown on a sample row.
10. How do your teams work?: the team flow (see [Team flow](team-flow.md)).
11. Where it opens: Always open and the panel's colour.
12. All set!

A step whose thing is not on the map is skipped, and the header counts only the steps shown ("Tour · Step 3 of 12"):
with no sessions open the tour has 7 steps, and with the map switched off (`/agentville lite`) steps 2 to 6 are
skipped.

- Next and Back move through it; Start on the last step closes it and shows the panel.
- Skip, in the header or on a card, closes the tour at once and marks it done; the team flow and Always open
  stay as they were.
- The Tour button in the panel's header opens it again at step 1.
- The tour never covers a waiting approval: while someone waits for your OK, the real "N waiting" strip stays above
  the map and its Open leaves the tour for that request. On the tour's Your desk step a sample of that strip (with
  Open; then R rejects and A opens the chat to approve, on the card) shows only while nobody waits.
- With the panel focused, S goes on (Start on the last step), T goes back and X skips. The arrow keys cannot be used,
  as the desktop accepts only a letter or a digit as a button's key. These keys are the same in both languages.

## The map

### Roles

The map roles (Lead, Builder, Reviewer, QA) are what you see on screen: the Lead is the
session itself and the others are its subagents. The 9 plugin agents (see [Team flow](team-flow.md)) are the workers
of the team flow.

### The floor

The house is an open coworking floor: every session at work gets an office (four desks, its board, its name, on a
sign over its back edge), up to four offices per row on an even grid of whole tiles (the same gap between offices,
the rest shared by the two walls; a short last row is centred) and 16 per floor; the 17th session opens floor 2, and
floors keep growing. The lobby, Product's room and your office sit at the back of every floor; like Product's room,
your office has glass on its open sides (toward Product and the corridor), with its door where the queue starts, and
its queue holds whoever waits for you from any floor.

- An office whose session has nobody at work has its lights off.
- A session where nobody waited, worked or read for 15 minutes leaves the map (it stays in the list as "quiet", and
  the line under the map counts it) and comes back with its next activity, in its old place if it is free.
- A chat you archive in the app leaves the map and the list within about a minute, and comes back if you unarchive
  it.

### Sub-offices

A session started from another session is a child: it is drawn as a glass-walled room inside its parent's office, one
block outlined and tinted in the parent's colour, with up to 3 rooms (the sign over the parent says how many,
"+N more" for the rest). The child's main agent is labelled "Deputy" under the family's one
Lead. In the list, children come right after their parent, indented with "↳", and the parent's row says how many
sessions it coordinates. While a child works and its parent rests, the parent's room stays with its lights off; when
the parent is gone, the child is a normal office again. The session finds its parent in the app's own session records
on this machine and keeps only the parent's id.

### Teams

A subagent whose Agent description is a capital letter, a colon and a name (`A: Delivery time tracking`, at most 60
characters) joins team A of its office; every member of a team carries the same text, and the name comes from the
first one. An office with teams becomes one wide room: the Lead's desk in the corner, then a row of desks per team (up
to 3 rows of 3), each row over a floor strip that reads "TEAM A · DELIVERY TIME TRACKING",
squeezed only when it would not fit and cut with "…" past 34 characters; extra members or teams show as "+N" on the
last strip. The room is 2 cells wide and one cell row deep per row of desks (1 row 2x1, 2 rows 2x2, 3 rows 2x3).
Subagents without a letter sit in a last row with no strip. A tag over each member says its role from its subagent
type: Build, Spec, Code, Sec, UX, UI, Judge. Offices grow in order only while the floor
stays within 24 cells; later offices, and sub-offices, keep the four role desks. A member that finishes or fails walks
to its Lead for 6 seconds to report and goes back to its desk; a finished one keeps its desk, lights off, for 10
minutes. Each member is clicked like any other agent.

### Secretary and Product

The Secretary's desk and Product's room sit on every floor; you
cannot click them and they are not in the list or the queue. The Secretary, Gem, has a desk in your office beside the
queue: whoever waits for you passes her desk first, and she never leaves it: a Lead stands at it while she routes a
request, then carries her answer itself (PRODUCT: into Product's room; PERSON: on into your queue once it asks).
Product is its own glass room between the common area and your desk with the Analyst, Marketing, Business and the
Board around a table, and a goals board: the goals of the office consulting Product now, else of the newest office
that has a goals file, else "No goals". A Lead whose office asks Product sits in the visitor's chair at
the head of its table until the answer, then walks back to its office on `DECIDED`, or on into your queue once it asks
you after `ESCALATE`, `NO FIT` or `NO GOALS` (2 minutes at most). See [Impact and goals](impact-and-goals.md).

### Clicks

Click zones are the invisible areas over the map that catch your clicks; they cover the whole map, so every part of
it takes the first click. Selecting an agent shows its session's plan with what is in progress, background commands
and how they ended, the last tool steps, and the last answer. Selecting a Lead shows the session's conversation as it
goes: Claude's messages as it writes them and your prompts.

With many sessions on a floor, a zone for every person is more than the desktop can draw. Then only the selected
office keeps a zone per person and every other office is clicked whole (a click selects the session); with even more,
every office is clicked whole, and at last the map takes no clicks and you choose in the list. See
[The panel goes light by itself](troubleshooting.md#the-panel-goes-light-by-itself). In a panel wider than about 144
columns the map stops growing and sits centered: a wider map would need more click zones than the desktop draws.

### Usage

Each office has a usage screen beside its plan board: what the session has spent (US dollars, its own ledger,
subagents included), its context fill with a green, amber or red bar, and its tool calls. A click on the screen opens
the office's card over the map (context in tokens, rate limits, tools, each agent's tokens; 2.8M for millions); its
corner × or any other press closes it. Your office has an HQ screen with the total and the teams, the most expensive
first.

### Disk

Your office has a disk screen beside the HQ's: the free space on your disk (amber under 10 GB, red under 5) and how
much the app's worktrees take ("Copies" on the screen, "Project copies" on the card:
the separate copies of a project the app makes for its sessions).

- A click opens its card; its corner × or any other press closes it.
- The card lists the six biggest worktrees with their session and state (active, quiet, asleep or spare), and how many
  sat unused for 30 days or more.
- While the card is open, two buttons show under the map, and pressing them keeps it open.
- The first shows only while some worktree sat unused that long: it asks up to three sessions' Leads to remove the
  unused worktrees (30 days or more) with the app's own tool, listing them first and skipping any with uncommitted or
  unpushed changes. It asks first: the first press on an office's button turns it into "Confirm: ask ...", and a
  second press within 5 seconds sends the request.
- The second deletes the chat images Agentville keeps, and asks first: the first press shows how many MB, a second
  press within 5 seconds deletes them, and its toast says how many MB it freed (no figure when the folder cannot be
  measured again). An image still attached to an unsent message or named in a draft stays, and the toast says so,
  or says nothing was deleted when every image stayed.
- Free space is measured every 5 minutes and the worktrees every 30, by one panel at a time. If the app's list of
  worktrees cannot be read, the card shows only the free space and Agentville's own folder.

## The list and the detail

Under the map are the list and the detail.

- **The list**: the sessions grouped by what they need (waiting for you, working, quiet or done), each with its Lead's
  face and a line in its state's colour. The ↗ at the right end of a row's name line opens that session's chat in
  the app at once, without selecting the row (a session with no chat link has no ↗). A chat archived in the app
  leaves the list within about a minute, and comes back if you unarchive it.
- **The detail**: the chosen session with its team (every agent has a name and the face it has on the map; a click
  on the big face next to the session's name opens its chat, when it has a chat link), its permission requests with
  Approve in chat and Reject (keys A and R; the panel never approves: Approve in chat opens the chat where Claude
  asks), and tabs for the conversation (bubbles in the colour of
  each speaker's shirt, plus the plan card), the plan and the steps.

A message's images sit in one row of small thumbnails; a click opens one. With many large images in view, the
newest keep their thumbnail and older ones show as "Image · click to open", which opens the image all the same. Each
bubble has Copy, which copies that message whole.

### The message field

The message field has only "▸ Send". Cmd+V in the message field attaches the image on the clipboard,
shown as a thumbnail above the message field with "1 image · Remove" to drop it, or, with no
image there, pastes the clipboard's text at the caret (on one line, at most 4000 characters). To send a message, a
`/command` (another session's commands are typed into its own prompt box for you to send) or a stop to a session, see
[Messages and permission requests](remote-control-and-mailbox.md). When a message cannot be sent, its text comes back
in the field and its images stay attached.

Keys in the message field:

- Option or Cmd with ← or → jumps a word; add Shift to select as you go. Ctrl does the same.
- Option, Cmd or Ctrl with Backspace deletes the word before the caret.
- ↑ or Home (Fn+←) goes to the start of the field, ↓ or End (Fn+→) to the end, with or without Option or Cmd; add
  Shift to select up to there.
- Cmd+A selects everything; Cmd+C, Cmd+X and Cmd+V copy, cut and paste.
- With the suggestions of a `/name` open, ↑ and ↓ pick one, → at the end of the text fills it in and Enter runs it.
  The desktop keeps Tab for moving focus, so Tab fills only where it reaches the field.
- Backspace, Delete, the arrows and word jumps move over a whole character: an emoji, a flag or an accented letter
  goes at once.

The desktop hands Option and Cmd to the field as the same key, so Cmd+← jumps a word here instead of going to the
start: use ↑ for the start and ↓ for the end.

### Waiting for you

When someone waits for you, an amber strip above the map says so: "N waiting", the first one as
"<name> (<office>): <what it asks>" cut with an ellipsis, and Open, which opens it. The whole strip takes the
click; when the Lead waits only on suggested sessions, Open shows their notes card. The strip answers nothing itself,
since its text may be cut: Approve in chat and Reject, and the keys A and R, are on the request's card, which shows the
command whole. When nobody waits the header says nothing.

### Questions and suggested sessions

When a session's turn ends with a question for you (the app's closing card), or its Lead suggests sessions to start,
the Lead walks to your desk and waits there, and the strip counts it.

**Questions.**

- The session's card shows the question and a button per reply Claude offered, with the exact text it sends under it
  (`Sends: "..."`). Pressing one sends that text as your message to the Lead, once, even
  with a subagent selected.
- The commit, PR and merge replies send "Make the commit." and the like; an action only the app can
  do reads "(in the app)" and has no button. There are no keys for these replies.
- The question goes away with your next message, a new turn, a stopped or failed turn, or the session's end.

**Suggested sessions.**

- Suggested sessions, from every office, are notes on your desk: a yellow "2 notes" on the
  map whose click opens their card over it (like the usage cards: × or any other press closes it), each with its
  office, title and brief, "▸ Start in its chat" and Dismiss.
- The notes card opens by itself when a new note arrives, never over another open card; its × keeps it shut until the
  next new note arrives.
- A suggested session stays until it is started or dismissed or the session ends: up to 7 days, or until the session
  is quiet for 12 h. A note that comes back after its Lead's turn takes Dismiss again.
- A session whose Lead waits only on suggested sessions (no question, no permission) is not blocking you: its pill
  reads "Suggests sessions" in dim grey with a dot, its list row says the same and its stripe
  is dim, and its bubble on the map is a plain dot, not the amber "!". A question or a permission keeps the amber
  "Waiting for your OK". With the map hidden they are listed in the session's detail.

**Start in its chat.** The app starts a suggested session only from its own card in that
session's chat or from words you typed yourself, so this button sends no prompt.

- It opens that session's chat in the Claude app (the same link as "↗ Open chat"; this
  panel's own session too), where the app's card is.
- Just before, it leaves a line ready in that session's own prompt box, "Start the suggested session "{title}"
  (proposal_id {task_id}).", so you only
  press Enter there (or Start on the card).
- Another session gets a signed `fill` order (the task id only); that session checks it like a dismiss order and
  writes the line itself, with its own stored title checked again (one line, 80 at most, no quote marks, masked, the
  task id when it has hidden characters), and only while its box is exactly empty: any text you typed there, a space
  too, is left alone. The mod never sends the line.
- Its toasts, in order:
  - On press: "Opening {name}'s chat: press Start on the card". With no chat link known yet, "Open its chat in the app
    and press Start on the card", and it opens nothing. When the app cannot open the chat,
    "Could not open the chat in the app".
  - Once the line is there: "I left "Start…" written in its chat: press Enter".
  - When the box already held that line: "It is already written in its chat: press Enter".
  - When the box held other text: "Its box already has text: add "start it" at the end and Enter".
  - When the box could not take it, or that session did not answer in about 10 seconds:
    "Press Start on the card in its chat".
- The note stays until the app settles the suggestion.

**Dismiss.**

- It calls the app's own dismiss_task tool with the task id the app gave; when that tool is missing, fails or the app
  refuses, the panel sends the Lead the matching prompt instead, and the toast says which.
- The app's tool acts only for the session that made the suggestion, so Dismiss on another session's note goes to
  that session as a signed dismiss order (and the task id); that session calls the tool as itself, and answers in the
  plugin store (`offer-acks`).
- When it does not answer in about 10 seconds, fails, gets an unexpected reply, or is asleep, the note shows again
  with "↗ Open chat" (also in that office's detail card) and the toast says to do it in its chat; no prompt is sent
  for it.

## Look and where it opens

### Look

The panel's buttons are rounded, the main one in blue with a "▸", the others
outlined, each a picture with its click on top (so the first click lands). The message field sits in a frame with your
face. The panel's colour is a pick at its foot (Warm lobby by default, Night or Hotel); the
app's own text fields keep the app's style.

### Every session

"▸ Always open" in the panel's header, with a green "On" or grey "Off" chip beside it, opens the panel in every
session (closing it in one keeps it closed there), so the house is visible whichever session you are in.

## Make it yours

Palette, team flow on or off, your own skills first, the ship fast line, the goals file and your own agents: see
[Make it yours](../README.md#make-it-yours) in the README.

## Commands

All of these are typed after `/agentville` in a session. Each one also has a Spanish name, given in parentheses.

- No argument: opens the panel.
- `lite` (or `ligero`, `sin mapa`): opens the panel without the map, and keeps it so until you press "Show the map".
  See [Troubleshooting](troubleshooting.md#if-the-panel-is-blank).
- `lang es|en` (or `idioma es|en`): changes the language; see [Language](#language).
- `refresh` (or `limpiar`): see [Tidy up](#tidy-up).
- `sync [name]` (or `sincronizar [name]`): see [Update sessions](#update-sessions).
- `calibrate clicks` (or `calibrar clics`), `calibrate` (or `calibrar`) and `calibrate elements` (or
  `calibrar elementos`): diagnostics, see [Calibration](troubleshooting.md#calibration-for-developers).
- `click layer` (or `capa de clics`): if a row needs two clicks or selects the wrong session, switches the list to its
  old click mode, where each row takes its own click. Type it again to return to the normal mode. See
  [Troubleshooting](troubleshooting.md#click-calibration).
- `simple drawing` (or `dibujo simple`): if the map draws with missing chairs, desks, plants or floors, draws each of
  them on its own, as before. Type it again to return to the normal drawing. See
  [Troubleshooting](troubleshooting.md#click-calibration).

### Tidy up

`/agentville refresh` (or `/agentville limpiar`) hides every office where nobody is at work right now, until its next
activity, and deletes Agentville's records of sessions that ended more than 2 hours ago (your chats are not touched).
A session with an agent waiting for your OK, or in error, is never hidden. It answers in text ("Offices hidden: 1.
Agentville data of ended sessions deleted: 2 (your chats are not touched). Each office comes back with its next
activity.") and opens no panel.

### Update sessions

`/agentville sync` (or `/agentville sincronizar`) checks every session against the version of the mod on disk, and
`/agentville sync <name>` only the sessions with that name: an exact name first, else every name that contains it
(case does not matter). It sends no session anything: the app refuses `/reload-plugins` from a plugin, so you type it
in each session's chat. When just one session needs it, its chat opens. It acts only when you type it; from a model or
another session's message it does nothing.

It answers one line per session it picked, asleep and up-to-date ones included:

- type /reload-plugins in its chat;
- asleep, will ask for /reload-plugins when it wakes;
- already up to date.

Otherwise it answers in one line that no session has that name, that there are no sessions to update, or that the
new Agentville version is not ready (unsaved changes or files that cannot be read), so there is nothing to update.
