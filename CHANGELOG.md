# Changelog

All notable changes to Agentville are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/). How a release is made: [docs/releasing.md](docs/releasing.md).

## Unreleased

## 1.0.1 - 2026-10-21

Ready for Anthropic's plugin directory. Nothing changes in how the panel works.

### Added

- `agentville/README.md`: what the plugin runs, reads, writes and deletes, that it makes no network calls, its signed
  orders between sessions, and the exact text it adds to Claude's prompt.
- `plugin.json` names the documentation, support and privacy policy pages.
- `scripts/check-plugin-files.sh`: fails when a tracked file in `agentville/` is a symlink, or, unless it is an image
  or a font, is binary or over 256 KiB, which the plugin directory holds back.

### Changed

- Split files the directory would hold back for size, moving code as is: the pane's tests went from
  `tests/agentville.test.tsx` into `tests/pane-1.test.tsx` and `tests/pane-2.test.tsx`, with their shared fixtures
  in `tests/pane.shared.tsx`; the mailbox, the orders, the despacho's notes and the prompt rules went from
  `hooks/register.tsx` into `hooks/orders.ts`.
- `.gitignore` also leaves out `Thumbs.db`, `desktop.ini` and `__MACOSX/`.

## 1.0.0 - 2026-10-20

First public release.

### Added

- A plugin icon (`agentville/icon.png`, its source `agentville/icon.svg`), named in `plugin.json` for the plugin
  directory's listing.

### Fixed

- Pixel-font text no longer draws "fi" as "A" ("first" read "Arst" in the tour): ligatures are off wherever Pixelify
  Sans is used.

### Docs

- README images (logo, map, tour step), CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue and pull request forms and
  [docs/releasing.md](docs/releasing.md).

### Security

- A session never runs a `/command` from its mailbox, even from a validly signed order: every message there is
  submitted as a plain prompt, its first word in backticks when it starts with `/`. The panel's own session runs its
  commands straight from its own field, without the mailbox. A message whose first word is a path now arrives instead
  of being refused.
- An approval carries the SHA-256 of the command the card showed, signed with the order; the session allows only when
  it matches the request it holds, and otherwise approves nothing and rejects nothing, so you answer it there. The
  panel no longer says "approved" when you press: it says the approval was sent, then "Approved in <session>" once the
  session took it, or "The command changed: answer it in the session" when it did not.
- A message to the panel's own session that fails to go puts its text back in the field, as for other sessions.
- A link in a reply whose label is not its address (or whose address has a user part) shows the real host beside it,
  as the browser parses it; a link with no host is drawn as plain text.
- Asking a session to remove unused worktrees from the disk screen needs a second press within 5 seconds, as deleting
  images does.
- The map's labels drop control characters, as the panel's chrome already did.
- SECURITY.md names approving another session's permission requests, the team flow's merge and deploy rule, the plan
  line added to subagent prompts and the fixed consent texts sent to `dismiss_task` and `archive_session`.

- A panel with no status file of its own (a failed start, the gap after /clear) no longer sends a `/command` it should
  hold back: every session counts as another one, so the command is never sent as a message there.
- A `/command` held back from another session is typed into that session's own prompt box by one signed order of a new
  kind (`fillText`), never sent: the session writes it only into an empty box (or one already holding that text), as
  one line of at most 2000 characters (line and paragraph separators folded) with control, format, private-use and
  unassigned characters dropped, one order at a time, and answers `filled`, `ready`, `busy` or `failed`. An unsigned,
  altered, redirected or replayed order does nothing, and a session on an older mod ignores the kind. SECURITY.md says
  a signed order can also type text into a session's empty prompt box.
- Security fixes before publishing, with a new [SECURITY.md](SECURITY.md) that says what the mod reads, writes and
  runs, that it makes no network calls, what a panel can and cannot do in another session, and its known limits:
  - Bash, or any tool that takes a command, may not run one that names the plugin store (`.claude/plugins/store`) or
    the mailbox key. This guard is partial (a glob, a variable or a relative path still reaches the store), and the
    docs say so.
  - The panel's field does not send another session a message whose first word is a command that session lists: the
    text stays in the field, its chat opens and a toast says to type it there. A file path or an unknown `/word` goes
    as a message, and a `/command` still runs in the panel's own session.
  - The disk screen's delete-images button deletes 500 files at a time and keeps an image still attached to an unsent
    message or named in a draft, as the cleanup does; its toast says the MB actually freed and that those were kept.
  - A running session rewrites its status file at least every hour, so another session's cleanup never deletes its
    order and command files while it runs, however long it sits idle.
  - Task list items are masked like answers and commands before they are written.
  - Each signed order acts once: a session drops an order numbered at or below the last one it accepted.
  - A cache install's `installPath` counts only when the folder it lands in, symlinks followed, is inside that
    marketplace's cache folder.
  - A worktree path from the app's registry counts only as `<a folder under home>/.claude/worktrees/<name>`, with no
    `.` or `..` part.
- A ship fast confirmation names the repository by its absolute path or remote URL and quotes the Deploy command:
  the Jefe asks that way, the `team-flow` skill, the approver and the README count a confirmation (in the session
  or in user-level files) only while that repository and that Deploy command still match, so another repository at
  the same name or a changed Deploy command asks again; when only one of path and remote matched, the Jefe's report
  says which. The README's sample line shows the path and the command (omitted for a merge-only line).
- Only the person allows a merge or a deploy: the team flow rule, the `team-flow` skill, the approver and the
  README now count only the person's user-level instructions (`~/.claude/CLAUDE.md`, `~/.claude/rules`, their memory)
  or a yes in this session as the person allowing. Nothing inside a repository (its CLAUDE.md, CLAUDE.local.md,
  `.claude/` or the ship fast line itself) can confirm ship fast or allow a deploy, and "Never deploy" now needs a
  user-level rule. A ship fast confirmation in user-level files must name the repository, and a memory entry counts
  only when it records something the person said. A repository's own rules can only restrict (require a PR, forbid
  merging) or choose between merge and PR on its own remote, never allow anything more; the skill's description says
  the same. An allowed merge in a repository with no remote is done by the Jefe (in a worktree of the base branch
  when needed), never by checking out a branch in the person's checkout.
- The `team-flow` skill fires only when chosen: its description now says to use it only as the main agent
  and only when the session's instructions hold the section "Agentville team flow (the person chose it)" or the person
  asks for it by name, so a fresh install with no flow chosen never pulls a session into the team flow.
- Thumbnails read from other sessions' heartbeats are checked before they reach the panel's Svg markup: a picture
  whose `w` or `h` is not a finite number in (0, 4096], or whose `orig` is not a string, is dropped, and a thumbnail
  `.txt` that is not plain base64 shows as "Imagen ya no disponible". A session that can write files could otherwise
  inject markup into every open panel.
- A heartbeat of the wrong shape (`agents` not an object, `notes` not a list, `name` not a string, `at` not a finite
  number) is skipped, a `chat` that is not a list is dropped and so are its rows that are not objects with a string
  `text`, so one bad file never freezes the panel. A zoom whose thumbnail is gone closes.
- The transcript tail read (`tailOf`) gives up after 5 seconds, so a FIFO swapped in after its check never holds the
  sync.
- A session title read from a transcript drops control and format characters (bidi, zero-width; a joiner stays, as in
  a pasted text) and keeps at most 120 characters, never splitting one.
- Full-size copies of images in `~/.claude/agentville/images/` are deleted after a day instead of a week; thumbnails
  keep a week, and an image still attached to an unsent message (or named in a draft) is never deleted.
- The builder agent has an explicit tool list (Read, Edit, Write, Grep, Glob, Bash, TodoWrite) and no longer inherits
  web or MCP tools; the reviewers, the spec-writer and the approver use Bash only for read-only git and the affected
  tests (the approver also for the merge or PR it is allowed), never write files, push or deploy, and never check out
  or switch branches in the person's checkout.
- A publishing rule meant only for this repository's maintainer left the shipped `team-flow` skill; it now lives in
  the repository's root CLAUDE.md, which is not part of the plugin.
- The README says that the mailbox key lives in the plugin store, where Bash, MCP servers and other tools running as
  you on the machine can read it.

### Changes

- One name everywhere: the repository is `JAndresGarcia/agentville` and its marketplace is `jandresgarcia`, so the
  plugin installs as `agentville@jandresgarcia` (`/plugin marketplace add JAndresGarcia/agentville`, then
  `/plugin install agentville@jandresgarcia`). An install kept under an older marketplace name keeps working: tested
  in a throwaway config, where `claude plugin marketplace update` and `claude plugin list` still load it.
- Shipped text in English. The team flow skill is now `agentville:team-flow` (it was `flujo-de-equipo`), and the
  impact step's agents are `agentville:secretary` and `agentville:product` (they were `secretaria` and `producto`); on
  the map they read Secretary and Product. The old agent ids keep working as the same staff. The skill, the agents,
  the README, the docs and SECURITY.md are in English, with the same rules and the same verdict words; the skill's
  description is shorter and says when to use it and when not. English text says "panel" instead of "pane", and
  docs/using-the-pane.md is now docs/using-the-panel.md. The `/agentville` commands have English names first (`lite`,
  `refresh`, `sync`, `lang`, `calibrate`, `calibrate elements`, `calibrate clicks`, `click layer`, `simple drawing`);
  the Spanish names (`ligero`, `limpiar`, `sincronizar`, `idioma`, `calibrar`, `calibrar elementos`, `calibrar clics`,
  `capa de clics`, `dibujo simple`) keep working. The docs name each panel control by its English label. The README
  has a short "Make it yours" section (palette, language, team flow on or off, your own skills first, the ship fast
  line, the goals file and your own agents) and a "Translate it" section on editing the wording or adding a language.
  The impact page states the no-goals stop as one rule, and the uninstall steps warn that removing
  `~/.claude/agentville` cannot be undone and deletes the images it saved.
- English is the panel's default language. A language you picked in the tour, in the header or with
  `/agentville lang es|en` stays; an install that never picked one now opens in English, and `/agentville lang es`
  switches it back. In English the session's main agent is the Lead (it was the Jefe) and a child session's main agent
  is the Deputy (it was the Lead); Spanish keeps Jefe and Encargado. The `/agentville` command's description lists the
  English names only.
- The `team_flow` install option's choices are now "Agentville team flow" and "My own skills and agents" (the
  default). An install that saved "Flujo de equipo de Agentville" must pick the flow again, in the tour or in
  `/config`: the engine resets an unknown saved choice to the default. A flow picked in the tour still wins.
- A `/command` for another session lands in its chat's prompt box for you to press Enter: "Listo: /review quedó
  escrito en el chat de tienda; dale Enter allí", and the field empties. When it cannot (text in that box, an asleep
  or older session, no answer in about 10 seconds) the text as it would have been typed goes to the clipboard
  ("Copiado: pega /review con Cmd+V en el chat de tienda (el texto sigue en el campo)") and stays in the field; with
  no clipboard, or with that session gone, the toast says to type it there and that the text stays in the field.
- → at the end of a `/name` fills the picked suggestion, as Tab does: the desktop keeps Tab to move focus, so it never
  reached the field.

- The map keeps its people and its clicks with many offices. Repeated shapes (chairs, desks with their monitors,
  plants, island floors, the bubbles' frame) are drawn once per picture and placed with `<use>` (ids prefixed per
  layer and picture, `href`), and the house leaves out the tiles under the islands: 16 offices weigh 163K characters
  of layers instead of 256K. When the page's limit is near, the map sheds in this order: the working bubbles, the
  decoration (office screens and boards, plants, team tapetes, names), the people, the per-person zones (each office
  keeps one), then a plain map of floors and desks (your office's HQ and disk screens and every card's × keep their
  clicks), and hides only when even that does not fit; the line under the map names each step it took
  ("Sin nombres ni pantallas por ahora", "Mapa simple") and whether offices still take clicks. Only offices drawn on
  the floor count toward those steps, never the idle ones in the list or the ones that come along for a waiting Jefe.
  Awake sessions take the lowest free islands before idle ones. `/agentville dibujo simple` (or `simple drawing`) goes
  back to inline shapes (store flag `svg-use`, on by default) should the desktop not draw `<use>`; the panel's opening
  reply names it.
- No reload the app refuses: 142 of 142 plugin-initiated `/reload-plugins` runs were refused
  ("isn't available over a remote connection") and each left that line in the chat, so the mod never runs or sends one
  any more. Every session behind the mod on disk marks itself stuck at once (`syncStuck`, no settle wait, no
  `sync:<id>` mark) and its card says "Hay una versión nueva: escribe /reload-plugins en su chat" ("A new version is
  ready: type /reload-plugins in its chat") with "↗ Ir al chat"; the list says "falta /reload-plugins" ("needs
  /reload-plugins"). The old Actualizar Agentville button now reads "Cómo actualizar" ("How to update"): it opens that
  session's chat and shows one toast, "Escribe /reload-plugins en la sesión <name>", sending nothing;
  `/agentville sync` answers which sessions need it, opening the chat when just one does. A `/reload-plugins` order
  from an older panel is dropped, and one typed in the panel's message field (any case, or as
  `/<plugin>:reload-plugins`) opens the chat and clears the draft instead of being sent. The Actualizando / quedó al
  día / no se pudo actualizar toasts are gone, an asleep session says "dormida · al volver te dirá si falta
  /reload-plugins" ("asleep · will ask for /reload-plugins when it wakes"), and the cleanup deletes this session's own
  old `sync:<id>` mark.
- Click targets measured on the desktop with `calibrate clicks`: a card's × (notes, disk, HQ, usage) takes about 4
  cells by 2 rows around the drawn ×, which stays where it was; the notes card's pills take the whole drawn pill and a
  cell around it (a pill's own drawing ranks above its neighbour's padding), both cut to the drawn card so a click
  beside the card still only closes it; the disk screen's zone is the drawn screen, no longer the wall from the HQ's
  screen to the map's edge. Its two sides are empty runs now, so the map's click budget (GRID_MAX) rises from 680 to
  690 and a family of 3 measures 606 elements (was 600).
- The third palette is named "Hotel", as the tour already called it; its stored id stays `hotel`.
- After a key test on the desktop: Option+← and Cmd+← both reach the message field as "left · meta", so meta with ←
  or → stays the word jump and ↑ / ↓ (with or without Option or Cmd) and Home / End go to the start and end; the
  using-the-panel page lists the field's keys by name and the troubleshooting page no longer lists them as a limit.
  The key probe names a key only when it is a named key or one character with Option, Cmd or Ctrl held (a space, a
  paste or a plain character says "texto"), posts the text the key just made, and toasts after the draft or send is
  handled, a failing toast stopping nothing. A message queued for a busy Jefe and meant for a subagent reads "Tú →
  <name> (en cola)"; the Jefe's conversation reads a marked row as "Tú → <name>" only while that office has a
  subagent with that name and id; "en camino" also goes once the subagent's state changes after the send (words
  repeated as they were count); a word jump keeps accented letters typed as a letter and a mark together. A relayed
  message's blank lines draw as empty lines, and every face of yours is "Cara de Tú".

- The message field and messages to a subagent: a modifier (meta or ctrl) with the left or right arrow jumps a
  word, with shift extending the selection, and with backspace deletes a word; Home and End, Cmd+A, C, X and V work
  as before. With `/agentville calibrar clics` on, each key the field gets toasts its name and modifiers ("Tecla: left
  · meta"; a plain character only as "texto"), so a person can say what Option and Cmd send. A message for a subagent
  shows at once in its conversation as "Tú → <name> (en camino)" until it writes a newer row (or 10 minutes pass), and
  the Jefe's conversation shows the marked row as "Tú → <name>: <text>", drawn as plain text; only a row that is
  exactly the relay marker reads that way, anything like it stays as written. The troubleshooting page says panel text
  cannot be selected: use Copiar.

- Plainer words before publishing: counts say "1 equipo" / "1 team" and "1 fila" / "1 row" in the singular (more
  teams, agents on a floor, hidden table rows and columns, tasks done); "Sincronizar sesión" is now "Actualizar
  Agentville" ("Update Agentville") and a session whose reload did not take says "no se pudo actualizar" ("could not
  update"); the click test's line reads "Carga del panel" ("Panel load") in connections, redraws and messages per
  second; the disk card says "Copias de trabajo" ("Project copies") for worktrees and its map screen "Copias"
  ("Copies"); the map's description says offices, not islands; English says "panel" outside the tour (the tour keeps
  the design's copy); a failed reply reads "La última respuesta falló" ("The last reply failed"); and
  `/agentville` lists `idioma`/`lang` and `calibrar clics` in its description. A waiting child names its parent "of
  <parent>" in English, and none when its parent is unknown. `/agentville elite` no longer hides the map (only the
  whole words ligero, sin mapa and lite do). A request read after its hold ended still says "Te espera" when someone
  starts waiting with it. The relay rule says the Jefe may add its own ship fast verdict, never one from the relayed
  text.

- Your own skills come first: a skill or slash command you type in the session that defines its own workflow
  (it builds, then reviews or verifies, and opens a PR) runs end to end, with no Agentville impact step, triage or
  reviewers, and the Jefe says so in one line in your language ("Sigo con tu skill <name>; Agentville solo muestra el
  mapa." / "Following your <name> skill; Agentville only shows the map."). Only a skill you typed counts: one the
  Jefe, a subagent, a file or a tool result picked or names does not. A repository whose root CLAUDE.md, as loaded in
  the session's instructions, has a line of its own `Agentville: flow off` (or `Agentville: flujo apagado`) never
  uses the flow. A tool-only skill still runs inside the flow, a skill with no review step keeps Agentville's
  reviewers, the merge and deploy rules hold even when the skill says otherwise, and a live check you require blocks
  publishing. The team flow rule, the `team-flow` skill (new section "Your own skill first", and its
  description), the team flow page and the README say so. To fit, the rule's large-tier risk list moved to the skill
  (the rule points to it) and its cap went from 1100 to 1440 characters.
- Permission request polish: requests that arrive together toast once with their count ("2 piden permiso ·
  respóndelo aquí") and one read after its hold ended toasts nothing; the notes card's pill counts the seconds down
  too and, pressed, selects who asks so A and R answer at once; the panel trusts no hold end more than 10 s after the
  session started waiting, or after now. The expired card and the late toast say the same words: answer it in the chat
  {chat} of the app, where the request shows. The static "Tienes unos 8 s" line under the buttons is gone; the field
  reads "(te pide permiso: tu mensaje va después)". Queued bubbles take chat rows (Anteriores still steps back when
  they fill them all), and one goes as soon as the session lists a row of yours with its words written after the send
  (rows of yours now carry when they were written), or after 10 minutes.

- Permission requests are hard to miss and say how long they wait: a new one toasts once, opens the notes card on
  it and marks the "Te espera" strip "Nuevo"; Aprobar and Rechazar count the hold's seconds down ("Aprobar (6 s)"),
  with the same keys every second; past the hold the card offers no answer (a press then sends nothing) and says to
  answer it on the app's card in the chat that started the session (a child's parent), with "↗ Ir al chat" to that
  chat. A message sent from the field to a busy session shows as "Tú (en cola)" at once, and the field says a message
  goes after a waiting permission. The inline panel asks for the same 40 rows at every open.

- A ↗ at the right end of each session row's name line in the list opens that session's chat at once, without
  selecting the row, in both list modes; a session with no chat link has none. A new tour step, Ir al chat (go
  to a chat), shows it on a sample row: the tour has up to 12 steps, 7 with no sessions open. A tour left open past
  step 8 resumes one step off, once (the stored step number now counts the new step).
- A click on the big face in the detail's header, next to the session's name, opens that session's chat, through
  one invisible Client over the face only; a session with no chat link has no zone.
- The session list's click layer (the store flag `list-hit-layer`) is on by default: a missing value or a
  store error means on, only a stored `false` means off. `/agentville capa de clics` now switches to the old mode, one
  Client per row, as a fallback, and back. Live, every row selected on the first click and the panel's Clients fell
  from 22 to 15-18.
- A short README and a `docs/` folder: the README is now one page (what Agentville is, requirements, install,
  first run, five things you can do, links); the rest moved, with its content, to `docs/install-and-update.md`,
  `using-the-panel.md`, `team-flow.md`, `impact-and-goals.md`, `remote-control-and-mailbox.md`, `troubleshooting.md`
  and `privacy-and-files.md`. Fixed on the way: macOS is the only tested platform (pasting, opening chats and images,
  sub-offices and the worktree list need it), the shell commands need the 2.1.299 `claude`, map clicks follow the
  click budget (no fixed office count), the weight guard's real order, the flood meter's limits are estimates, the
  full `sync` answers and name matching, `refresh` never hides a session waiting for you, `ligero` also answers to
  `sin mapa` and `lite` and is kept until "Mostrar el mapa", `calibrar` and `calibrar elementos` are documented, and
  the Option or Cmd arrow shortcuts are a known limit.
- The team flow's agents, skill and rule agree: large means more than 5 files (the rule said 5 or more), medium 2
  to 5; only the Jefe deploys (the approver and builders never do); reviewers never ask for full-suite or CI evidence,
  and a prompt with no ship fast verdict means it does not apply; the full suite runs once plus one rerun after a fix
  its failure opened, and also when rounds run out; the approver escalates when the full suite still fails and, when a
  PR is required under ship fast, says the merge is blocked; "aprobado" resumes the approver, other answers are an
  extra round outside the cap; a re-triaged large change gets all four reviewers and rounds from zero; medium's
  security reviewer is for files outside the repo (untrusted input is already large), a rule that comes before the one
  for more than two areas; the plan's first step is Impact when it runs; deleting or moving files counts as risky for
  ship fast; the spec-writer gets the roadmap rows, Product's verdict and open nits, names an affected test per
  criterion and lists the large items as risks; the Secretary and Product route a request, not only a feature, and
  Product maps alta, media and baja.

- The session list can be clicked through one block, behind a switch, on by default (see above):
  `/agentville click layer` (or `capa de clics`) turns it on or off (the store flag `list-hit-layer`). Off, the list
  is today's, one click block per row. On, the list is drawn as today (rounded stripe, face, the name and its line
  across the whole column, "↳" children, the rounded card of the selected row), and ONE Client, `btns-pick`, of
  invisible click rows lies on top of it, so the list never eats the Client budget the map's click zones need. Each
  drawn row and its click row have the same fixed height in whole text cells (a session 3, its card centred, a group
  header 1, "Ver N más" and the page item 1), with no gap between rows on either side; the click rows have no hover
  glow. Past 35 session rows the list pages: the selected one is always drawn, the headers still count all, a last
  "Siguientes sesiones" goes to the next page ("Volver a las primeras sesiones" on the last), and a session that
  starts waiting sends the list back to its first page. A row's line is cut at 300 characters. Still past the Client
  budget with the map gone, the click rows become panel Buttons (a press may need a second click).
- Product decides business questions; only very grave ones reach you: the Secretary now answers `PRODUCT` by default,
  business decisions included (money, pricing, a new product, dropping a feature), and `PERSON` only with no goals
  file, a goal marked `Delegada: no`, or a very grave request (irreversible or hard to undo, legal or compliance,
  users' personal data or security, secrets, credentials, auth or permissions, contacting real users or publishing in
  your name, real spending beyond the goals, shutting down a product, out of the goals' scope; when unsure, `PERSON`).
  A goal allows spending only when it states an amount, and nothing in the goals file waives a very grave case.
  Product's voices debate, list 2 or 3 options and the Board picks one: it answers `DECIDED` (option, priority, what
  the team should do), `ESCALATE` (reason, options A, B, C and a recommended one, very grave cases only), `NO FIT` or
  `NO GOALS`, replacing `FITS`. On `DECIDED` the Jefe tells you in one line what was chosen and why and goes on to
  triage; the spec carries it. On Product's `ESCALATE` the Jefe asks one question and your letter is the decision;
  `PERSON` (yes or no), `NO FIT` and `NO GOALS` stop for you. Each question closes the Jefe's turn, so it walks to
  your desk and waits. A `DECIDED` never approves a merge, a deploy or any real spending (paying, subscribing,
  buying); any spend needs your yes. The team flow rule, the `team-flow` skill and the README say the same.
- Gem stays at her desk and the Jefe walks the impact step: while the Secretary runs, the session's Jefe
  stands at her visitor spot facing her. On PRODUCT, and while Product runs, it walks through Product's door and sits
  in a new visitor's chair at the head of its table, facing it. After Product's ESCALATE, NO FIT or NO GOALS, or her
  PERSON, it stays where it heard the verdict while its turn goes on (2 minutes at most) and walks from there into
  your queue once it asks; any other answer (DECIDED, an empty or cut-short one, a failed run) sends it back to its
  office. Verdicts are read by their first words, without markdown or punctuation, in any case. The Secretary never
  walks to Product's door or to you anymore.
- Archived sessions leave the map and the list: the app keeps an archived chat's record in place and sets its
  `isArchived`, so the open panel looks at the records of the sessions it knows (one `find` by record id, then reads 6
  at a time, argv only, at most 60 records) at most once a minute and drops the archived ones from everything it
  reads; an unarchived one comes back on the next look. A failed look, or a record cut short with no flag, keeps the
  last answer. Records are read by field when they do not parse whole (cut at 200 KB), the record's own ids and flag
  taken only before its first nested object, so a big record still gives them.
- New child sessions join their parent's block within seconds: a session looks its records up every 5 s for its
  first 5 minutes, then once a minute. No look spends a try in those 5 minutes, nor one whose record names no parent
  yet, so a child whose app record, `spawnedFrom` or parent's record comes late still links; after them a miss or a
  parent's record not readable yet spends one of the 10. The lookup keeps up to 20 records that name the session and
  reads them until its own, so other records naming it never crowd it out, and once found its own record is read again
  by its path, with no grep. With nothing left to learn from it (a root session), the looks stop after 20 minutes.
- The tour: Saltar (the header's, a card's or X) closes the tour at once and marks it done, instead of jumping to
  ¡Listo!; the team flow and "Abrir siempre" stay as they were, and Recorrido opens it again. The bubble never covers
  its target on a 1-row map: with no room under the target it goes above it (never higher than its usual top), and
  with the sample banner it stays under the banner (its floor comes from the banner's height) and a tall bubble is cut
  at the stage's bottom last, so it stays inside the panel. Its tail points at the target's middle.
- Tests: a thumbnail zoom whose thumbnail left the memory closes; tidy keeps an attached image's thumbnail `.txt`
  and an image a draft names.
- The people stay on the map: each person and each walking frame is a small pixel-art PNG (`<image>`, drawn pixelated)
  in place of hundreds of one-pixel vector rows, so the agents layer weighs 61% less with 16 offices of 4 (231,511 to
  90,590 characters) and 65% less on the freeze2 load (58,122 to 20,434). A floor now keeps its people with up to 10
  offices of 4 (6 before), and with 7 unlinked offices that each run a team of 6 beside one plain office (4 before);
  linked families fit either way. The PNGs come from a small encoder in the mod (`hooks/png.ts`: palette colour,
  fixed-Huffman deflate with bit-optimal matches, CRC-32 and Adler-32 by hand), each sprite encoded once and cached
  (the 1,000 last used). Sprites match the vector drawing pixel for pixel at whole scales; they are sharper at 1x, and
  at the map's own 1.25 scale they may look uneven on 1x screens (whole pixels, no blended seams): to check live.
  Positions, z order, name tags, bubbles, walking timing and click zones are as before; bubbles are written with fewer
  characters, the same pixels (their animations keep repeatCount). The store switch `vector-people` (true) draws the
  old vector sprites, for a live comparison; flipping it lets the panel measure the people's weight afresh. Without
  the map's people the role tags ("Build", "Code", "UX"...) over empty desks go too. The page-limit tests that relied
  on people being dropped now use heavier loads (7 offices with chat images, the freeze2 children each with a team of
  6, 11 offices).
- The panel never sends a tree the desktop page refuses: the page drops a panel's whole tree, silently, unless it
  has fewer than 2,000 nodes, a depth under 32 and fewer than 262,144 characters (every Svg source and alt, a Client's
  key, module and props JSON, every prop key and string value, every text child), and then keeps the old picture: a
  frozen panel with dead clicks. `pageOf` mirrors that count on every pass of the drawing, and the weight guard treats
  more than `PAGE_CHARS` (235,000, room for what only the wire adds), 1,800 nodes or depth 28 as too heavy. It steps
  down in order: the map's click zones, then the map's people (desks, boards and screens stay, no selected tile or
  person's tag over bare floor; the line under the map says only that the people are in the list), then the map with
  its note, then chat rows down to one (a subagent's bubbles too, which otherwise keep their 4 rows), and at last a
  light panel: the header, a line saying it holds too much to draw right now, and the first three requests, each
  command drawn whole as the card draws it, with Aprobar and Rechazar (A and R), so a wait is still answered and never
  unseen; one with no command gets no buttons. The notes no longer blame the number of offices. Each step comes back
  by itself: when the floor holds fewer offices, the panel's width or band count changes, the selected chat's pictures
  change (another office, older rows), or the panel would fit again with the map's or the people's layers (measured
  afresh) or the zones (what they cost when they went), in the same render, so a burst of new sessions that settles
  gets its people back at once. The tour goes the same way with the same latches, so its steps match what is drawn.
  render-log.json records chars, nodes and depth. The freeze2 load (a parent with 6 child sessions, 8 sessions at 110
  to 180 columns), now an anonymized fixture, and a 16-office floor with children arriving and images in chat pass the
  page's own rule in tests. A floor keeps every click zone with up to 5 full offices (6 or 7 when they are one
  family): the tests that assumed full floors with zones now use floors that fit.
- The map weighs about 18% less, drawn the same; the target of 35% is not reached. Numbers lose their leading zero
  (.5), box faces and floor tiles are paths whose corners after the first are relative moves (between rounded points,
  so each corner lands where it did), every sprite pixel run stays its own rectangle but moves from the last one and
  leaves the close to the fill, and a working bubble's dots share one fill. A full floor's layers went from 493,212 to
  405,911 characters; the map of 6 linked offices from 194,997 to 159,334, so 6 or 7 offices in one family keep the
  map, its people and every click zone (the freeze2 load too). In Chromium the house, a family floor, the lobby's
  people and the list faces draw pixel for pixel the same as before; elsewhere a few hundred edge pixels differ where
  a layer now splits at another place, and 2 pixels on one chair leg. Merging stacked runs (a third lighter) showed
  seams where colours meet, and `<use>` is not proven on the desktop, so neither ships.
- Child sessions stay quiet on a mod update: a session with a parent (started from another session) never runs
  the automatic /reload-plugins, which the app refuses it over its remote connection; it marks itself stuck at once
  (`syncStuck` = the disk version), so its card shows the line to type /reload-plugins in its chat, with no failed
  command row in its transcript and no note to its parent. Sessions without a parent reload as before.
- Copiar and Ver más in chat bubbles are readable: each is a plain Button in a Box of the bubble's dark ink with
  one cell of padding, so its light text reads on every bubble tint and palette.
- The panel stops freezing under load: redraws caused by background change (the ticker's syncs, the disk measure, a
  new mod version on disk) go through one gate, `redrawBg`: while the last tree weighed over 120 KB, at most one per
  1.5 s, and a change read inside the gap draws when it ends, never dropped; a lighter tree (the panel without the
  map) keeps its rate. Your presses, a field's posts, a toast's redraw, a sync you started (opening, refresh, sync),
  someone who starts waiting and a new permission request still redraw at once. The drawing reads the world sync last
  wrote from the module instead of the world atom, so an atom write no longer redraws outside the gate, and background
  asks that meet before a drawing merge into one; any drawing cancels a pending background redraw, so a later change
  waits from that drawing and is never lost. "Nothing drawn changed, no redraw" stays. A 10 s busy scene (16 offices,
  ~600 KB a tree, someone waiting) drew 10 trees, now 6.
- Paste text and copy the chat: Cmd+V in the message field attaches the clipboard's image as before, and with no image
  there the panel reads the clipboard's text (`/usr/bin/pbpaste`, argv only, UTF-8) and hands it to that field as a
  numbered `insert` prop; the field notes it while drawing and puts it at the caret or over the selection like typed
  text from a one-shot tick, once per number (no state or post while drawing). The text is untrusted: newlines and
  tabs become spaces, other control and format characters go (but the emoji joiner U+200D), it is trimmed and cut to
  4000 characters, and it only ever becomes field text; whitespace alone is no text. The panel drops it from the props
  once the field's draft holds it or on send. With neither an image nor text nothing changes and no toast shows. Every
  chat bubble with text has "Copiar" ("Copy") beside "Ver más", a panel Button like it (no new Client) that copies
  that message's whole text, its folded part included, and toasts "Copiado" ("Copied").
- Child rooms read as rooms: every room edge inside a family block gets Product's tall glass (1.5 high, one pane
  per tile) instead of the thin floor and wall-height lines; the block's outer border stays open. A room's back edges
  (top, left) draw behind its whole room, so its board, screen and plant stay in front; its front edges draw tile by
  tile, a tile early, so the board of the room below stays over them. Each child room has a one-tile door toward its
  parent, with a dark threshold on the floor: on its left edge for the room beside the parent, on its top edge for a
  room in the row below, at the room's free middle row or column. Walks in and out of a lower child room
  go along their row to that door and up, so no path crosses a pane. A family of 3 child rooms draws 595 elements, the
  same as before (the panes live inside the furniture Svgs).
- Nested sessions read as a tree in the list: each session sits right under the one that started it, at any depth
  (a grandchild under its child, under the root), indented 2 cells per level up to 3 levels, with "↳". The world keeps
  the direct link as `from` beside the family root in `parent`; a session whose starter is in another group nests
  under its root, and "Encargado de" and "coordina N" follow the starter. A thumbnail (in a message or attached above
  the field) opens the zoom on the first click: each line of thumbnails gets ONE band Client on its middle text row
  (bandhits.tsx), keyed by its line so lines of different heights never share a key, and only a thumbnail the last
  drawing showed opens. At most 6 such lines a render (attached first, then the newest messages); older lines keep a
  panel Button per thumbnail, and past CLIENT_MAX those Clients go before the map's zones do. Thumbnails are at most
  126 px tall (a tall one draws narrower); a file twice in one message draws once. "▸ Enviar" sits centred on the
  message field when its placeholder takes two lines, and at the top while the slash menu is open.
- Only "▸ Enviar" in the message field: the "Pegar imagen" button is gone; Cmd+V in the field still attaches the
  image on the clipboard. What is attached shows as a row of thumbnails (at most 96 px wide) above the field, with
  "N imágenes · Quitar" beside them, so the field keeps its width. A message's images sit in one wrapping row of
  thumbnails at most 140 px wide instead of a stack of large pictures; a click on one still opens the zoom. A session
  whose reload did not take shows its "escribe /reload-plugins" line in full ink, not dimmed.
- A session whose own reload did not take: its card no longer offers "Sincronizar sesión", which runs the same command
  there. It says "No se pudo sincronizar sola: escribe /reload-plugins en su chat" and shows "↗ Ir al chat" when its
  chat link is known; `/agentville sync <name>` answers "<name>: escribe /reload-plugins en su chat" and sends no
  order. At a narrow panel the message field shrinks (its placeholder is cut) so "Pegar imagen" and "▸ Enviar" stay
  whole.
- Arrancar leaves a ready line in that session's prompt box: before it opens that session's chat, the panel sends a
  signed `fill` order (the task id only); that session checks it like a dismiss order (fresh, its own shown
  suggestion, not settled) and, only while its own box is exactly empty, puts "Arranca la sesión sugerida «{title}»
  (proposal_id {task_id})." there with its own stored title checked again (pressTitle). It never sends it: you press
  Enter. This panel's own session fills its own box directly, with the same checks. Toasts: "Te dejé escrito
  «Arranca…» en su chat: dale Enter", "Ya está escrito en su chat: dale Enter" (the box already held that line), "Su
  campo ya tiene texto: añade «arráncala» al final y Enter" (other text, nothing written), and "Pulsa Start en la
  tarjeta de su chat" when the box could not take it or no answer came in about 10 seconds. The answers in
  `offer-acks` are `filled`, `ready`, `busy`, `gone` and `failed`. A start order from an older panel still acks
  `gone`. Descartar is unchanged, and a fill still waiting for its answer no longer holds it.

- Arrancar opens that session's chat: the app starts a suggested session only from its own card or from words you
  typed yourself, so the button now reads "▸ Arrancar en su chat" ("▸ Start in its chat") and opens that session's
  chat in the Claude app (the "↗ Ir al chat" link, `/usr/bin/open` with argv only, this panel's own session too),
  where you press Start on the app's card. The mod sends nothing to start it: no tool call and no message sent for you
  (N adds a fill order that only writes the line in its box). The toast reads "Abriendo el chat de {name}: pulsa Start
  en la tarjeta"; with no chat link known yet, "Abre su chat en la app y pulsa Start en la tarjeta", and nothing
  opens. The note stays until the app settles the suggestion. A start order from an older panel is answered `gone` and
  does nothing. Descartar and Sincronizar are unchanged.

- "Actualizar mod" is now "Sincronizar sesión" ("Sync session"), and "sin actualizar" reads "sin sincronizar". A
  session that is asleep, or whose beat went quiet with no failed reload of its own, gets no button: its list row and
  card say "dormida · se pone al día cuando vuelva" ("asleep · catches up when it wakes"), with "↗ Ir al chat" when
  its chat link is known, and no stuck note. A press on an awake session toasts "Sincronizando {name}…", then
  "{name} quedó al día" once its beat carries the new version, or after about 60 s "{name} no se sincronizó; escribe
  /reload-plugins en su chat" with "↗ Ir al chat" on its card. `/agentville sync` (or `sincronizar`), typed by you,
  sends the same signed order to every awake session on an older version, and `/agentville sync <name>` to that
  session only; it answers one line per session (syncing, asleep, already up to date, already asked, type it) or says
  no session has that name. Typed by anything else (a model, a plugin, another session's message) it sends nothing.
  Its follow-up toasts (quedó al día, no se sincronizó) show only while the panel is open in that session. The
  command's description and the open message mention it.

- Arrancar and Descartar on another session's suggestion reach that session: the panel sends it a signed start or
  dismiss order (the task id only); that session calls the app's tool as itself, with the same fixed consent words,
  and answers in the store's `offer-acks`. With no answer in about 10 seconds, a failure, an unexpected reply or an
  asleep session, the note shows again with "↗ Ir al chat" and a toast says to do it there. Such a press no longer
  sends the Jefe a prompt (the model refused those). A permission request's hold now takes only allow and deny orders.
- Map clicks step down by Client count: each zone set (per person, the selected office only, whole offices) also has
  to fit its band Clients within 48 less the panel's other Clients before the map's clicks go off. A 16-office floor
  at 110 columns now keeps the selected office's or whole-office clicks within 48 Clients (it used to lose them all).
- The too-heavy latches reset when the band count or the panel's width (in 10-column steps) changes, so narrowing the
  panel can bring the map's clicks back.
- A held request stores its time after the heartbeat is saved, and the ticker trusts it only between the last sync
  and now; the relink grep stops after 5 s.
- The header strip never breaks a line between ES and EN, and its pictures are centred on one line; the flood meter
  wraps, shows its rates with a decimal comma in Spanish, and shows its numbers' age counting up.
- `/agentville calibrar clics` tints each button of a strip row, not the whole row.
- Enviar reads the draft 170 ms after the press, still past the field's 150 ms debounce.
- A right click on the message field starts no caret blink timer.
- Fewer Clients: each row of picture buttons (the header's Recorrido, Abrir siempre and ES | EN; the banner; the
  palette; Adjuntar and Enviar; the map toggle; the disk card's buttons; Detener) is one picture with one click Client
  per text row, its zones from the same px widths that draw it. A drawing over 48 Clients (`CLIENT_MAX`) takes the
  same lighter passes as one over the element limit: kept hit bands, opened replies, map zones, then the map. The
  reference panel went from 36 to 30 Clients (16 to 10 besides the map); a 16-office floor at 110 columns needed 49.
- No redraw when nothing drawn changed: a sync whose world draws the same (the map's zones and every field but
  the event log, an office's task and a visit's end time) stores nothing and draws nothing.
- Map click keys hold: a hit band keeps its Client, empty, 10 seconds after its last zone, within the Client
  budget; a band's Buttons are keyed by their zone, not their place in the band; a small resize keeps the band count
  while bands stay 15 to 20 px.
- Requests past the hold: the card keeps the whole request and offers "↗ Ir al chat"; a request ending clears its
  tool too. A request held for the panel shows Aprobar within a second instead of on the next 3-second sync.
- A session started from another one learns its parent and chat link from its own listener, at most once a
  minute and ten times, the tries renewed when the app writes a new record for it.
- `/agentville calibrar clics` shows a flood meter: Clients, draws a second and messages a second.
- The notes pin on your desk is clickable all over: its zone takes the whole bands it touches, over the Jefe's.
- Enviar reads the draft after the press (now 170 ms), so a draft the field posts late is sent whole.
- Merge and deploy authority, in the team flow rule and skill, the approver and the README: the Jefe or the approver
  merges only as the repository's rules or you allow; otherwise it opens a PR, or asks you when the repo has no
  remote. It never deploys unless a rule or you say so. Your standing instructions (your CLAUDE.md, rules or memory at
  any level) or a yes in the session count as your allowing.
- Ship fast needs your yes: the first time a repository's ship fast line would apply in a session, the Jefe asks you
  once to confirm ship fast for that repository (it quotes the line); only then does the line count. A standing
  instruction of yours that confirms it counts as that yes.
- The README says what the mod reads and writes (app session records, the worktree registry, transcripts,
  `~/.claude/agentville`, `.agentville/metas.md`), the system-prompt sections it adds, what it does on your press and
  its automatic reload, plus the SHA-256 of the two embedded fonts (also in the `pixfont.ts` header).
- The team flow is opt-in: with no choice in the tour and no install option, no session gets the team flow rule. The
  `team_flow` install option defaults to "My own skills and agents"; a flow you picked in the tour still wins. A
  machine that already used an older Agentville (the welcome card of older versions dismissed, a mailbox key, a
  refresh's hidden list, or a heartbeat from a version before 1.0.0) keeps Agentville's team flow: the first session
  start after the update stores it as the tour choice, once (`team-flow-migrated` in the plugin store). A fresh
  install picks in the tour, whose team step presses no tile until you pick and says no team flow is on until then.
- The approval card shows exactly what Aprobar allows: a Bash command in full, and for any other tool its full name
  and each argument; the banner and the list row show it in one line (a tool's name and its file). A request too long
  to show whole, masked, or with hidden characters has no Aprobar and no A key and is answered in the session.
- Panel orders are signed over their target session too, so an order for one session never acts in another.
- `render-log.json` is written only while `/agentville calibrar` runs or the `render-log` debugging switch in the
  plugin store is on, not on every render.
- The README states the minimum Claude Code version: 2.1.299, the version Agentville was built and tested on.
- Teams, a Secretary and Product. With Agentville's team flow the Jefe names each subagent `<Letter>: <team name>`
  (`A: Función para medir bien`), and an office with teams becomes one wide room: the Jefe's desk, a row of desks per
  team (up to 3 rows of 3) over a floor strip "EQUIPO A · <NOMBRE>" ("+N" past the caps) and a role tag over each
  member (Impl, Spec, Código, Seg, UX, UI, Juez). Offices grow while the floor stays within 24 cells; sub-offices keep
  their role desks. A member that finishes or fails walks to its Jefe and back; finished ones keep their desk 10
  minutes. New or high-impact features first pass an impact step: two new read-only agents, `agentville:secretary`
  (haiku, answers PRODUCT or PERSON) and `agentville:product` (sonnet, answers FITS, NO FIT or NO GOALS with a
  priority), judge them against the repository's goals file `.agentville/metas.md`; anything but FITS asks you and
  stops. The first change request of a new office, whatever its size, goes to agentville:product first; with no goals
  file it stops for you once. FITS never approves a merge or a deploy. On the map the
  Secretary sits in your office (whoever waits for you passes her desk) and Product is a glass room on the lobby's
  right with a goals board (first 3 headings, redacted, "Sin metas" when none). Neither is clickable nor in the list.
  A repository without `.agentville/metas.md` stops for you once per session, then goes on with that answer. Stored
  positions reset once.
- Always in sync, with no off switch: every session stamps the mod version it loaded (`mod`, a hash of its files) in
  its heartbeat and, while idle, reloads itself onto a newer version on disk. A marketplace install follows
  `claude plugin update` (nothing is fetched on its own); a `--plugin-dir` folder counts once it has no uncommitted
  change and held for 20 s. A reload shows a `/reload-plugins` line in that session's conversation; nothing is lost
  and the next message works as usual. A session on an older version says "versión vieja" in the list right after its
  state ("sin sincronizar" when its reload did not take), and its card offers "Sincronizar sesión", a signed
  `/reload-plugins` order (once a minute, run when a busy session's turn ends), or says to type it in that session.
  The panel reads an older session's question and suggested sessions from its transcript tail (argv only, at most
  every 3 s, only when the file changed), and every title from the same tail instead of a shell line. Only a stopped
  call (an AbortError, "aborted", "cancelled") counts as you stopping the app's tool; the fallback toast reads "The
  app could not do it, so I asked <Jefe>".
- Panel buttons are bold, as the design draws them; the "Encendido"/"Apagado" chip is never clipped. The tour's
  Tu despacho step shows the real "Te espera" strip with Ver and says "Pulsa Ver y aprueba con A, rechaza con R."
  Ver opens the notes card when the Jefe waits only on suggested sessions; the note says at most "9+ notas", sits on
  the desk top, and its card closes when the last suggestion goes. Arrancar and Descartar toast at once; a refused or
  failed app call says "se lo pedí a <Jefe>"; only an aborted call (Esc) stops without the prompt.
- The panel's chrome follows the design: when someone waits, an amber "Te espera N" strip with the first one
  ("<name> (<office>): <what>", cut with an ellipsis) and Ver; when nobody waits the header says nothing. The banner
  no longer approves or rejects (its text may be cut): A and R move to the request's card. "▸ Abrir siempre" is a
  primary button with a green "Encendido" or grey "Apagado" chip instead of a sentence. Every panel button is drawn
  rounded, primary or outlined, as a picture with its click on top. The suggested-sessions card follows the design,
  at its size whatever the map's scale, its title naming the Jefe when one office suggests and each office otherwise.
- A turn that ends with a question (the app's closing card) or suggested sessions sends the Jefe to Tu despacho: the
  banner counts it and the session's card shows the question and a button per reply Claude offered with the exact text
  it sends under it. Suggested sessions are a note on your desk ("2 notas") whose card lists them with their office,
  Arrancar and Descartar. These call the app's own session tools with the app's task id, and fall back to a prompt to
  the Jefe when the tool is missing, fails or the app refuses. The question clears with your next message or turn;
  suggested sessions stay until started or dismissed or the session ends: up to 7 days, or until the session is quiet
  for 12 h. The closing recap shows as Claude's message. A reply or a suggested title with hidden characters
  (zero-width, bidi, tag or private-use characters) is never sent as your words; a press on Arrancar or Descartar
  tells the app it was yours, and one the app's dialog stopped is not retried as a prompt.
- The usage and disk cards no longer draw "Cerrar" beside their corner ×.
- A list row's line says the sessions it coordinates before the plan it left open.

- Agentville team flow: builders, fix rounds and reviewers run only the affected tests (never the full suite,
  integration, e2e, Docker or a CI wait); a large change runs the full suite once before the approver. A repository
  can opt in to ship fast with `Agentville: ship fast. Deploy: <command>` in its root CLAUDE.md: as soon as the
  reviews accept, the change is merged (by the approver for a large one) and the Jefe runs that command, once the
  affected tests ran locally: no full suite, no CI/CD wait. Only the root CLAUDE.md before the change counts; a change
  to that line or the deploy files never ships fast. Secrets and auth never ship fast; data, schema migrations and
  money only with `ship fast, risky`. Schema migrations make a change large.
- With a subagent selected, the field and the toast name it ("Escríbele a Tomás…", "Enviado a Tomás") and the
  message goes to the session's Jefe marked for that subagent, which relays it and says so in one line.
- Usage cards (office, HQ, disk) open on a click on their screen, not on hover, and close with the × in their
  corner or any other press in the panel; token counts of a million or more read as M (2.8M).
- The map shows only the sessions at work, on an even grid: up to four islands per row with the same gap between them
  and at the walls (on whole tiles), a short last row centred, and only the rows in use. A session where nobody
  waited, worked or read for 15 minutes leaves the map (the list keeps it, "sin actividad", and the line under the map
  counts it) and comes back with its next activity, in its old place if it is free. Office names are signs over the
  back edge of their island, clear of its people.
- `/agentville refresh` (or `limpiar`) hides every office where nobody is at work until its next activity and deletes
  Agentville's records of sessions that ended more than 2 hours ago (your chats are not touched); it answers in text
  and opens no panel.
- A disk screen in your office: free disk (amber under 10 GB, red under 5) and the app's worktrees. Its card lists the
  six biggest with their session and state, and how many sat unused for 30 days or more; pinned, it can ask up to
  three sessions' Jefes to remove the unused worktrees (listed first, skipping any with unsaved work) with the app's
  tool, and delete Agentville's chat images after a confirm.
- The list says when a session's turn ended with its plan still open ("terminó sin cerrar 2 pasos"), and the
  Agentville team flow asks the Jefe to close its plan before it ends a turn.
- The Agentville team flow is sized to each change's risk. The Jefe triages first: small changes get a 3-line spec,
  1 builder and 1 reviewer; medium changes get a spec, 1 builder and 2 reviewers with no approver; large or risky ones
  (shell commands or hooks, data, untrusted input, secrets, auth, money, dependencies, many files, anything shipped
  publicly) keep the four reviewers, two fix rounds and the approver. It triages again on the real diff before the
  review. Reviewers mark findings `[blocking]` or `[nit]`, only blocking ones open a round, a re-review goes only to
  the reviewers that asked for changes (and to security whenever a fix touches a risk item), and open nits are listed
  at the close for the next change. The tour's team flow tile and the install option say so.
- Sub-offices: a session started from another session is a glass-walled room inside its parent's office (up to 3
  rooms, "+N más" for the rest), its main agent labelled "Encargado" (Lead) under the family's one Jefe. In the list,
  children come right after their parent, indented with "↳", and the parent's row says how many sessions it
  coordinates.

- The tour moves onto the real map: Gem, the receptionist, points at each part of the office (your first office, its
  Jefe, the team, the board, the usage screen, the common area and your desk) with a dimmed map, a pulsing ring and a
  speech bubble; language, team flow and where the panel opens are cards over the map. Up to 11 steps; a step whose
  part is not on the map is skipped, and the header counts only the steps shown. Saltar marks the tour as done and
  shows its last step. The old card tour is gone.
- The tour has keys: S goes on (Empezar on the last step), T goes back and X skips; the header lists them. The arrow
  keys cannot be used: the desktop accepts only one letter or digit as a button's key.
- The spotlight stays on its target while a step is shown, even when agents walk past it.
- The team flow step names the skill you picked, in full, under the list, and keeps the list open with it. Saltar on
  the last step closes the tour.
- Whoever waits for you stops at the Secretary's desk first, then walks on to your office; an agent answered after a
  long wait walks back from the queue to its desk.
- Notes on your desk: the notes card opens by itself for a new note, never over another open card, and its × keeps it
  shut until a new note arrives. A Jefe's question is a note too, with a pill per reply and the full text each one
  sends (up to 3 lines) under it. The card keeps to the map's top-right corner.
- Product's room has an opaque sage meeting-room carpet.
- The Secretary is Gem, and she is the tour's guide; your office (the despacho) has glass walls, and the tour frames
  only the lobby's own corners.
- Tour copy: Gem no longer names herself in the despacho step ("pasa primero por mi escritorio y luego camina a tu
  despacho").
- Language switch: an ES | EN control in the panel's header switches the whole panel without opening the tour, and
  `/agentville idioma es|en` (or `lang es|en`) does the same from the prompt.
- Tidy state pills: every state pill ("✓ Terminó", "! Espera tu aprobación" and the rest) is sized from its words'
  measured width, with the same height, padding, icon spacing and centring, so none runs into its border.
- Suggests state: a Jefe that waits only on suggested sessions shows "Te sugiere sesiones" (Suggests sessions) in a
  dim pill with a dot, in its list row and with a dim stripe, and a plain dot bubble on the map, never
  "Espera tu aprobación"; a question or a permission keeps the amber wait.
- A character the width table lacks (Cyrillic, Greek and other scripts below CJK) now counts a full em, so labels and
  notes lines in those scripts wrap or widen instead of clipping.
- `/agentville calibrar clics` (calibrate clicks): every click zone tinted (map bands red, buttons blue, the field
  green) and every press toasted with its zone, its key and whether it found an action (or was dropped in the notes
  card's calm), keys only; a click with no toast never reached the panel. Run it again to stop.
- The notes card grows with the map: up to about 1270 px (144 columns, the usual panel width) it keeps the design's px
  size, above it the same share of the map (about 0.29), its pills and × still exact.
- The recommended reply stands out: a question's first reply is filled blue with "▸ " in the notes card and in the
  detail card; the others stay outlined.
- ↗ Ir al chat: a dim pill (never read as a reply) on a question in the notes card and a button in the detail card
  open that session's chat in the Claude app, through a checked `claude://claude.ai/epitaxy/local_<id>` link built
  from the app's own record of that session (each session learns its record id with its parent link). Sessions on an
  older mod show no button until they reload.

### Fixes

- The tour's chat step shows again in the desktop instead of a broken image: the office row's font list was not
  escaped, and its quoted "Segoe UI" closed the style attribute early.
- The map no longer drops to the simple map with 8 sessions and a few screenshots in the chat, or loses its clicks
  in a wide panel: thumbnails are made at 240 px instead of 360 (the zoom still opens the original); the chat draws
  its pictures within a budget a render, newest first, and older ones show as "Image · click to open", which opens
  the image; and past about 144 columns the map stops growing and sits centered, so its click zones stay within
  what the desktop draws. The line under the map no longer says the simple map takes clicks while it says there are
  too many offices to click. Pictures already on disk at the old size may show as "Image · click to open" in older
  chats.
- Dismiss on a suggestion the app already handled (started from its own card, or gone) removes the note and says
  "Already handled in the app; note removed"; before, the note stayed and every press said the app gave an unexpected
  answer.
- A message that fails to send comes back in the field with its images still attached, by Enter or by Enviar, and the
  toast says so; before, the draft and the images were gone.
- Backspace, Delete, the arrows, word jumps and clicks in the field move over whole characters: deleting an emoji, a
  flag or an accented letter no longer leaves half of it behind, and the caret draws the whole character. A long draft
  that scrolls never cuts an emoji at either edge of the field.
- The delete-images toast says nothing was deleted when every image is kept for an unsent message, and gives no MB
  figure when the folder cannot be measured again, instead of claiming all of it as freed.

- A one-row strip of buttons (Ir al chat, Mensajes anteriores) takes clicks on its own row only: its click layer no
  longer grew rows tall over what lies below it (EQUIPO, the Conversación tab, a message's face, the first Copiar).
- A press on a button inside an open card (a notes card reply pill, a question reply, the disk card's buttons) does
  its job: the panel no longer closes the card before the press arrives, which left it with "no action".
- Clicks on the map land on the first press after the notes card opens or closes: each band of the click layer is
  keyed by its own row, so a card that adds or removes bands above it no longer renames the ones below.
- Arrancar and Descartar never fail silently: an error on the way says "No se pudo arrancar/descartar «title»" and the
  suggestion shows again.
- A suggested session started or dismissed from another session (by hand, with the app's tools) leaves every panel on
  the next sync, once the app's result says it went through.
- An open panel is drawn again when a window attaches to its session, as on a session start or reload, so it no
  longer stays blank ("has not drawn in this panel") after `/reload-plugins`.
- A session whose start was cut short (a mod reload during it) now shows up: its first event makes its heartbeat.
- An awake session keeps its island when a sleeping or idle one claimed the same place.

- Tables in Claude's replies are drawn as tables in the chat: a bold header on a light tint, every column sharing the
  bubble's width and wrapping its text, with no pipes or dashes left. At most 40 rows and 12 columns are drawn; a line
  says how many more there are. A long reply folds by whole paragraphs, lists, code and tables; a single block longer
  than the fold shows its first part. Ver más shows only when something was left out.
- The chat's fold weighs what the panel draws, not only characters: each paragraph, styled word (code, bold, link),
  table row and cell counts, so a reply of thousands of tiny pieces folds to a few dozen. Ver más opens up to ten
  times as much and says when more does not fit; if an open reply still makes the panel too heavy, that reply closes
  again (the newest first) and says so.
- The whole map takes clicks, on the first press: its click zones are now cut into bands about one text row tall, each
  with its own region, instead of one region the desktop drew a single row tall (only the top of the map answered).
  The click layer is lighter too, so more offices keep a click per person.
- The panel's buttons take the first click: Aprobar and Rechazar, Ir al primero, Recorrido, Abrir siempre, the session
  list, Detener, the conversation's paging, Pegar imagen, Enviar, the colours and the map switch are now drawn inside
  their own regions, so a redraw no longer drops a press. Keys A, R and D work as before. The main button of each
  group (Aprobar, Enviar) is marked with ▸ as well as its colour.
- A session in the list is chosen by clicking its name or the line under it, not its face or its colour stripe. A
  nearly full context is said right after the session's state, so a narrow panel never cuts it off.
- Mensajes anteriores stays above the conversation and Ver lo más reciente below it, so neither moves under the
  pointer.
- An approval names the request it answers, so a press meant for an older request of the same agent does nothing.
- Every picture in the panel has a text description, and the tour's step icons are drawn at their own size.

### Follow-ups (not built)

- macOS field shortcuts Option or Cmd with arrows: the Client key event has no Option flag; a live probe first.
- List rows keep one Client each: each draws its face and stripe as panel pictures, which a Client cannot draw.
- Keep-alive for button Clients that come and go (Detener, Actualizar Agentville, Ir al chat), only if the meter or
  the desktop log shows clicks lost there.
- `CLIENT_MAX` and the meter's limits are estimates, not yet measured on the desktop.

## Preview - 2026-10-18

The private preview of Agentville, never tagged (its `plugin.json` already said 1.0.0); 1.0.0 above is the first
public release. The preview was Agentville, a pixel-art office for your Claude Code agents, as a Claude Code desktop mod.

### Features

- `/agentville` opens the pane: every live session is an office island on an open coworking floor (16 per floor, more
  floors as sessions grow), with a public lobby for idle agents and your own office at the back.
- Agents that need your OK walk to your desk and wait in line; approve or reject permission requests from the pane
  (keys A and R).
- Session panels grouped by what they need (waiting for you, working, paused or done), with each session's team, plan,
  tool steps and conversation as pixel-style bubbles.
- Usage screen per office (cost in US dollars, context fill, tool calls) and an HQ screen with the totals per team.
- Remote control: send a session a message or a `/command`, stop its running turn, and answer its requests; every
  order is signed (HMAC-SHA256) and expires after two minutes.
- "Abrir siempre" opens the pane in every session; `/agentville ligero` opens it without the map when the desktop
  does not draw it.
- Panel themes: Lobby cálido (default), Noche, Hotel.
- Install option `team_flow`: use the Agentville team flow or keep your own skills and agents.
- A 7-step tour on first open (language, how it works, teams, approvals, where it opens, privacy, done); the Recorrido
  (Tour) button opens it again. It never covers a waiting approval.
- The pane speaks Spanish or English, picked in the tour; Spanish until you pick.
- Team flow choice in the tour: Agentville's team flow (default), one of your own skills, or none. It is shared by all
  sessions and overrides the `team_flow` install option.

### Skills

- `flujo-de-equipo`: the team flow for any change to a repository. Spec, one or more builders, four parallel reviews,
  up to two fix rounds, then an approver that merges or escalates to you.

### Agents

- `spec-writer` (opus): turns a request into a short, testable spec.
- `builder` (opus): implements a spec with the smallest complete change and fixes review findings.
- `security-reviewer` (opus): reviews the change for security.
- `ux-reviewer` (sonnet): reviews the change for user experience.
- `ui-reviewer` (sonnet): reviews the change for visual design.
- `code-reviewer` (sonnet): reviews the change for code quality.
- `approver` (opus): approves the merge or escalates to you.
