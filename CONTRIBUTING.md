# Contributing to Agentville

Thanks for helping. Bug reports, ideas, translations and pull requests are all welcome. Please write issues, pull
requests, commits and code comments in English, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

- **Found a bug or have an idea?** Open an issue with the bug or feature form.
- **Found a security issue?** Do not open a public issue: report it privately, as [SECURITY.md](SECURITY.md#reporting-an-issue)
  says.
- **Want to change code or text?** Open an issue first for anything larger than a small fix, so we agree on the
  approach before you build it.

## Set up

You need the Claude desktop app, to see the map, and Claude Code 2.1.299 or newer. Agentville is tested on macOS
only.

1. Check your Claude Code version:

   ```bash
   claude --version
   ```

   It must show 2.1.299 or newer. An older `claude` has no `plugin test` and no `validate --strict`, so the commands
   below fail with it.

2. If it is older, either update it (`claude update`, or the way you installed it), or use the copy that ships with
   the desktop app, which is always new enough:

   ```bash
   ls ~/Library/Application\ Support/Claude/claude-code/
   ```

   Each version folder holds `<id>/claude.app/Contents/MacOS/claude`. Use the newest one in place of `claude`, for
   example:

   ```bash
   alias claude='"$HOME/Library/Application Support/Claude/claude-code/<version>/<id>/claude.app/Contents/MacOS/claude"'
   ```

3. Clone the repository, then check and test it:

   ```bash
   git clone https://github.com/JAndresGarcia/agentville.git
   cd agentville
   claude plugin validate --strict agentville && claude plugin test agentville
   ```

`claude plugin test agentville` runs every `*.test.ts` and `*.test.tsx` under `agentville/`. To try your change in the
desktop app, install from your clone as [Install and update](docs/install-and-update.md) says, then type
`/reload-plugins` in a session.

## What a good change looks like

- **Small and focused.** One fix or feature per pull request. Keep the structure the code already has, and add no
  dependency.
- **Tested.** New logic comes with a test next to the existing ones in `agentville/tests/`, and the whole suite
  passes. `bash scripts/check-plugin-files.sh` passes too: no file in `agentville/` over 256 KiB (split a big one).
  So does `bash scripts/check-register-rules.sh`: `hooks/register.tsx` keeps the rules Anthropic's plugin directory
  enforces (the script names each one it finds broken).
- **Style.** Match the surrounding code: TypeScript, short names, comments only for the why the code cannot show.
  No em dash in any text.
- **Changelog.** Add a line under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.

### Panel text in two languages

All panel text lives in `STRINGS` in `agentville/hooks/i18n.ts`, as pairs `[es, en]`: Spanish first, English second.
A new or changed text needs both sides, with the same `{placeholders}` on each. If you do not speak Spanish, write the
English side and say so in the pull request; we will fill in the Spanish. A test checks every pair. More in
[Translate it](README.md#translate-it).

### Security rules

Agentville runs inside people's Claude Code sessions, so these rules hold for every change. [SECURITY.md](SECURITY.md)
describes what the mod does today; a change that alters any of it updates that page too.

- No network calls from the mod.
- Write only under `~/.claude/agentville` and the plugin's own store.
- Run system programs only from the fixed list in SECURITY.md, by argv, never through a shell.
- Treat session titles, transcripts, notes and repository files as untrusted: escape them before drawing, and never
  run them as commands.
- Another session can be steered only through signed orders in the local mailbox; a new kind of order needs its own
  signature check and tests.
- Mask obvious tokens before anything is written to disk.

## Pull request flow

1. Fork the repository and create a branch from `main` (for example `fix/blank-panel` or `feat/new-palette`).
2. Make the change, run `claude plugin validate --strict agentville && claude plugin test agentville`, and update
   the docs and the CHANGELOG it affects.
3. Open a pull request and fill in its template: what changed, why, and how you tested it (a screenshot for anything
   visible).
4. A maintainer reviews it. Expect questions or requested changes; once it is approved, the maintainer merges it.

Releases and version numbers are handled by the maintainer: see [Releasing](docs/releasing.md).

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
