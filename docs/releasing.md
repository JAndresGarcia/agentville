# Releasing

Agentville uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **Patch** (1.0.1): fixes that change no command, setting or stored file.
- **Minor** (1.1.0): new features that keep every command, setting and stored file working.
- **Major** (2.0.0): a change that breaks one of them, such as a removed command or a stored file read differently.

The version lives in two places, and they always match: `version` in `agentville/.claude-plugin/plugin.json` and the
newest version heading in [CHANGELOG.md](../CHANGELOG.md).

## Make a release

1. In `CHANGELOG.md`, rename the entries under `## Unreleased` to `## X.Y.Z - YYYY-MM-DD` (today's date), and add a
   new, empty `## Unreleased` above it.
2. Set `"version": "X.Y.Z"` in `agentville/.claude-plugin/plugin.json`.
3. Check and test, with Claude Code 2.1.299 or newer:

   ```bash
   claude plugin validate --strict agentville && claude plugin test agentville && bash scripts/check-plugin-files.sh
   ```

   The last command fails when a file in `agentville/` is a symlink, or, unless it is an image or a font, is binary or
   over 256 KiB: Anthropic's plugin directory holds such a plugin back, and `claude plugin test` cannot check it.
   `agentville/hooks/register.tsx` is exempt from the size rule: the directory's `$` rule needs it whole, and its size
   only causes a policy hold.

4. Commit both files as `Release vX.Y.Z`. Before tagging, the maintainer checks that commit live in the desktop app.
5. Tag the release in the public repository, [JAndresGarcia/agentville](https://github.com/JAndresGarcia/agentville),
   on the commit that publishes it, and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main vX.Y.Z
   ```

6. Publish a GitHub release whose notes are that version's CHANGELOG section. Write the notes outside the
   repository, so they are never committed:

   ```bash
   notes="$(mktemp)"
   awk -v v="X.Y.Z" '$0 ~ "^## " v " " {f=1; next} /^## / && f {exit} f' CHANGELOG.md > "$notes"
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file "$notes"
   rm "$notes"
   ```

   A section too long to read as release notes (1.0.0's is) gets short highlights instead, ending with a link to
   the CHANGELOG, for example:

   ```markdown
   First public release of Agentville, a pixel-art office for your Claude Code agents.

   - Every session is an office with its team; idle agents rest in the lobby.
   - See every permission request at one desk: reject it there, or open its chat to approve; message any session.
   - An optional team flow sized to each change's risk.
   - English and Spanish.

   Everything in this version: [CHANGELOG](https://github.com/JAndresGarcia/agentville/blob/v1.0.0/CHANGELOG.md#100---2026-10-20).
   ```

## How people update

Claude Code reads the plugin from this repository's marketplace, `jandresgarcia`. To get a new release:

```bash
claude plugin marketplace update jandresgarcia && claude plugin update agentville@jandresgarcia
```

In a session, `/plugin marketplace update jandresgarcia` refreshes the marketplace the same way. Then type
`/reload-plugins` in each running session. More in [Install and update](install-and-update.md#update).
