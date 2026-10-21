# Install and update

Back to the [README](../README.md).

## Requirements

- Claude Code 2.1.299 or newer, the one that ships with the desktop app. Agentville is a mod (a plugin hooks
  module), and 2.1.299 is the version it was built and tested on; older versions are not supported. The shell
  commands on this page need that `claude` too: the `claude` on your PATH may be older and lack `--config` or
  `configure`. Check with `claude --version`.
- The Claude desktop app, for the map and the tour. In a terminal session the hooks run and the session appears in
  the list of a desktop panel, where it can be answered; `/agentville` there only says the panel opens once the app
  connects.
- macOS. It is the only platform Agentville is tested on, and several parts need it: pasting uses `/usr/bin/pbpaste`
  and `/usr/bin/osascript`; "↗ Open chat", "▸ Start in its chat" and opening an image in Preview use `/usr/bin/open`;
  thumbnails, pasted images and the zoom use `sips`; and sub-offices, chat links and the worktree list read the
  desktop app's records under `~/Library/Application Support/Claude/`.
- No `allowManagedHooksOnly` in your organization's managed settings: with it, Claude Code loads no hooks of a
  plugin you install yourself, and Agentville does not run.

## Install

It installs at user scope, so it runs in every session.

In a session:

```
/plugin marketplace add JAndresGarcia/agentville
/plugin install agentville@jandresgarcia
```

From a shell:

```bash
claude plugin marketplace add JAndresGarcia/agentville
claude plugin install agentville@jandresgarcia
```

In the desktop app: **+ > Plugins**, add the marketplace `JAndresGarcia/agentville` (listed as `jandresgarcia`), then
install `agentville`.

From a local clone:

```bash
git clone https://github.com/JAndresGarcia/agentville.git
claude plugin marketplace add ./agentville
claude plugin install agentville@jandresgarcia
```

One option, `team_flow`, sets how your teams work:

- "Agentville team flow": every session runs its changes through the plugin's [team flow](team-flow.md).
- "My own skills and agents" (the default): Agentville stops telling your Lead to use its team flow and stops asking
  subagents for a plan; the skill and agents stay installed and you can still call them.

The shell install does not ask: `team_flow` stays unset, and unset means no team flow until you pick one in the tour
(a machine that already used Agentville keeps its team flow, see [Team
flow](team-flow.md#which-flow-a-session-follows)). The app's installer may ask you. To turn on Agentville's team flow
at install, add `--config` (after the marketplace is added):

```bash
claude plugin install agentville@jandresgarcia --config team_flow="Agentville team flow"
```

To change it later, run `/plugin configure agentville@jandresgarcia` in a session, or from a shell:

```bash
claude plugin configure agentville@jandresgarcia
echo '{"team_flow":"My own skills and agents"}' | claude plugin configure agentville@jandresgarcia --values-stdin
```

The first command shows the option; the second sets it. Start a new session to apply it. A team flow picked in the
panel's [tour](using-the-panel.md#tour) overrides this option in every session, whichever way it is set.

Check the install: `claude plugin list` shows `agentville@jandresgarcia` with its version, and in a new desktop
session `/agentville` opens the panel. It opens by itself in every session only when "Always open"
is on.

### Optional: list /agentville in the / menu from the start

The desktop app builds its `/` menu before the mod's hooks run, so the mod's own command only shows there once a
session has started. To list it as plain `/agentville` from the start, copy the command file to your user commands
(a plugin's own command file would show as `/agentville:agentville`). From the marketplace copy:

```bash
mkdir -p ~/.claude/commands && cp ~/.claude/plugins/marketplaces/jandresgarcia/agentville-command.md ~/.claude/commands/agentville.md
```

From a local clone, copy `<clone folder>/agentville-command.md` instead (the file sits at the clone's root).

## Update

```bash
claude plugin marketplace update jandresgarcia && claude plugin update agentville@jandresgarcia
```

If you copied the command file, copy it again (see
[Optional: list /agentville in the / menu from the start](#optional-list-agentville-in-the--menu-from-the-start)).

Running sessions do not reload on their own: the app refuses `/reload-plugins` when a plugin runs it ("isn't
available over a remote connection"), so only you can, by typing it in each session's chat. Every 20 seconds each
session compares the mod it loaded with the one on disk and, when they differ, the panel tells you. What counts as
"on disk" depends on how you installed it:

- **Marketplace install** (the commands above, a copy in the plugin cache): the new version after
  `claude plugin update`. Nothing is fetched on its own.
- **Folder install** (`claude --plugin-dir <folder>`, you edit the files): the folder's version once it has no
  uncommitted changes (`git status`), so a checkout mid-edit is never offered.

Typing `/reload-plugins` loses nothing and your next message works as usual. It reloads every plugin in that session,
and its next turn may rewrite the prompt cache once.

A session behind the mod on disk shows "old version" in the panel's list, or "needs /reload-plugins" once it noticed
by itself. What to do:

- **It noticed by itself:** its card says "A new version is ready: type /reload-plugins in its chat", with "↗ Open
  chat" when its chat link is known, so type it there.
- **An older session that did not notice:** select it and press "How to update". Its chat opens and a toast says "Type
  /reload-plugins in the session <name>", so type it there. The panel sends the session nothing.
- **Asleep, or its status file went quiet:** it shows "asleep · will ask for /reload-plugins when it
  wakes" with no button, and "↗ Open chat" when its chat link is known.
- **A broken copy on disk was loaded:** fix it on disk, then type `/reload-plugins` in each session.

Typing `/reload-plugins` in the panel's message field does not send it either: the session's chat opens with the same
toast and the field is cleared.

To see which sessions need it, type `/agentville sync` (see [Update sessions](using-the-panel.md#update-sessions)).

## Uninstall

```bash
claude plugin uninstall agentville@jandresgarcia
claude plugin marketplace remove jandresgarcia
```

If you copied the command file, remove it:

```bash
rm -f ~/.claude/commands/agentville.md
```

Optionally, remove what Agentville left on disk (session status files, orders, thumbnails and full copies of pasted
images; see [Privacy and files](privacy-and-files.md)). This cannot be undone: it deletes every image Agentville
saved, including the copies of images you pasted, so keep any you still need first.

```bash
rm -rf ~/.claude/agentville
```

## Develop

Repository contents:

- `agentville/`: the plugin (the mod's hooks, its agents and skill, tests).
- `docs/`: these pages.
- `CHANGELOG.md`: what changed in each version.

Check and test:

```bash
claude plugin validate agentville && claude plugin test agentville
```

Publish the public copy from tracked files only, with `git archive` of the commit you publish (for example
`git archive --format=tar <commit> agentville docs README.md SECURITY.md CHANGELOG.md LICENSE | tar -x -C <empty folder>`),
never `rsync` or `cp` of a checkout: those carry untracked files such as `node_modules` or generated types. The
owner's live check comes first.

After changing the mod, refresh the installed copy:

```bash
claude plugin marketplace update jandresgarcia && claude plugin update agentville@jandresgarcia
```
