# Troubleshooting

Back to the [README](../README.md).

## If the panel is blank

1. Run `/agentville lite` (`/agentville ligero` and `/agentville sin mapa` do the same): it opens the panel without
   the map (list, chat and buttons). The choice is kept until you press "Show the map", which brings the map back.
2. If the panel froze, run `/reload-plugins` to redraw it.
3. If it still does not draw, start a new session, or update the plugin with the command below, then start a new
   session.

```bash
claude plugin update agentville@jandresgarcia
```

The command's reply says so too.

## The panel goes light by itself

Many sessions, or many people on the map, can make the panel too big for the desktop to draw. The desktop then keeps
the old picture, and the panel looks frozen. To avoid that, the panel drops detail by itself, in this order:

1. The bubbles over the people at work (the three dots). A bubble that asks for you, or shows an error, stays.
2. The decoration: each office's screen and board, the plants, the team names on the floor and the office names (the
   line under the map says "No names or screens for now").
3. The people on the map (the line under the map says the people are in the list).
4. The per-person click zones (the invisible areas that catch your clicks): every office keeps at least one zone, so a
   click on an office still opens it.
5. A plain map: only the floors and the desks, each office still clickable, and your office's notes and screens (the
   line says "Simple map").
6. The map itself, only when even the plain map does not fit.
7. Chat rows, down to one.
8. Last, a short panel: the header, a line saying it holds too much to show right now, and the first three requests.

Through steps 1 to 7 the list always keeps working: you can still choose a session there, approve, reject and send
messages. Even the short panel of step 8 keeps Approve and Reject (keys A and R) for the first
three requests. Offices that are only in the list (idle, asleep) do not count toward these steps. Fewer sessions on
the floor (close them, or hide them with `/agentville refresh`), a different panel width or fewer pictures in the open
chat bring the detail back by itself.

## A session is asleep or needs /reload-plugins

A session never reloads by itself: the app refuses `/reload-plugins` from a plugin
("isn't available over a remote connection"), so type it in that session's chat. See
[Update](install-and-update.md#update): a session behind the mod on disk says so in the list, and its card tells you
what to type and where.

## Known limits

- macOS is the only tested platform (see [Requirements](install-and-update.md#requirements)).
- Text in the panel cannot be selected (the desktop offers no selectable text there): use the Copy buttons on
  messages.
- The panel asks for the same height (40 rows) every time it opens inline, so it is as tall in every chat; a size you
  dragged wins. Where the panel sits (above the prompt, or in the dock beside it) is up to the desktop, not the mod.

## Calibration (for developers)

These commands measure what the desktop can draw. You do not need them in everyday use.

### Click calibration

`/agentville calibrate clicks` (or `calibrar clics`) tints every click zone of the panel and shows each press in a
toast (the zone, its key and whether it found an action; the message field says only the kind of message (send, menu,
copy, paste image), never its text). Each key the message field gets shows as "Key: <key> · <modifiers>" (for example
"Key: left · meta", which is what both Option+← and Cmd+← send); a character typed, a space or a paste shows only as
"text", and a character is named only with Option, Cmd or Ctrl held (a shortcut). The keys the field takes are in [The
message field](using-the-panel.md#the-message-field). A row of buttons is tinted per button, its gaps left clear. If a
click shows no toast, it never reached the panel. The command is a toggle: type it again, or run `/reload-plugins`, to
turn the tinting off. Nothing is written to disk.

If a row on the session list needs two clicks or selects the wrong session, `/agentville click layer` (or
`capa de clics`) switches the list to its old click mode, where each row takes its own click; the list looks the
same. The choice is remembered; type the command again to return to the normal mode.

If the map draws with missing chairs, desks, plants or island floors, `/agentville simple drawing` (or
`dibujo simple`) draws each of them on its own, as before shapes were shared; the map then weighs more and sheds
detail sooner. The choice is remembered; type the command again to return to the normal drawing.

Each click zone is a small piece the desktop app draws for the mod, a connection of its own. While the test runs, a
"Panel load" line under the panel says how many connections the drawing holds, how many times a
second it was redrawn and how many messages a second those connections sent, over the last 5 seconds. Past 48
connections, 1 redraw or 20 messages a second it turns amber and warns that the panel may go blank (the desktop drops
every connection of a mod that floods it). These limits are estimates, not yet measured on the desktop. Its numbers
hold until the next redraw, so under them "Ns ago" counts up on its own: an old age means the numbers are
not live.

The weight guard works by the same counts: a drawing over 48 connections first drops the click areas it kept for a
few seconds and the replies you opened in full, then the map's per-person zones (each office keeps one), then the
map's other steps above. The desktop draws nothing new for a
tree over 2,000 nodes, depth 32 or 262,144 characters, so the panel stays under that.

### Size calibration

`/agentville calibrate` (or `calibrar`) grows the real panel by 1 KB a second and shows the total big;
`/agentville calibrate elements` (or `calibrar elementos`) adds 40 elements a second (20 click buttons) instead. Write
down the last number you see before the panel goes black, then press Stop. While it runs, each drawing's
size goes to `~/.claude/agentville/render-log.json`.
