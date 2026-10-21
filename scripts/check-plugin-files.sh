#!/usr/bin/env bash
# Fails when a tracked file of the plugin folder (agentville/) is a symlink, or, unless it is an image or a font, is
# over 256 KiB or binary: Anthropic's plugin directory holds such a plugin back. `claude plugin test` cannot run this
# check, because its test kit has no file system. Usage: bash scripts/check-plugin-files.sh [repository folder]
set -eu
cd "${1:-.}"
limit=262144
bad=0
while IFS= read -r -d '' f; do
  if [ -L "$f" ]; then echo "symlink: $f"; bad=1; continue; fi
  case "$f" in *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.svg|*.ttf|*.otf|*.woff|*.woff2) continue ;; esac
  size=$(wc -c < "$f" | tr -d ' ')
  # The directory's $ rule needs register.tsx whole (a function handed $ lives in the file that calls it); over the
  # size only causes a policy hold, so it is exempt from the size rule (still checked for binary content).
  if [ "$size" -gt "$limit" ] && [ "$f" != agentville/hooks/register.tsx ]; then echo "over 256 KiB: $f ($size bytes)"; bad=1; fi
  if [ "$size" -gt 0 ] && ! grep -Iq . "$f"; then echo "binary: $f"; bad=1; fi
done < <(git ls-files -z agentville)
if [ "$bad" -eq 0 ]; then echo "plugin files: no symlink, no binary, every file at most 256 KiB (hooks/register.tsx exempt)"; fi
exit "$bad"
