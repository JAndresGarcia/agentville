#!/usr/bin/env bash
# Fails when hooks/register.tsx breaks a rule the plugin directory's review enforces (docs: BN findings, proven on the
# directory's portal; `claude plugin validate` passes every one of these, so only this check catches them locally):
# no `[` in a call's type arguments or an `is [` predicate, no destructured Client, register named once, no type
# arguments at a call that passes `$`, and a helper that takes `$` named nothing else in the file.
# Usage: bash scripts/check-register-rules.sh [file]   (default agentville/hooks/register.tsx; `-` reads stdin)
# shortcut: grep heuristics over lines, not a parser; a rule broken across lines slips by. Move to a TypeScript
# AST check if one ever does.
set -eu
src=$(cat "${1:-agentville/hooks/register.tsx}")
# Code only: `//` comments dropped (they never tripped the portal), line numbers kept.
code=$(printf '%s\n' "$src" | sed -E 's#(^|[[:space:]])//.*$##')
bad=0
hit() { # $1 rule, $2 grep -nE pattern
  local out
  out=$(printf '%s\n' "$code" | grep -nE "$2") || return 0
  printf '%s\n' "$out" | cut -c1-160 | sed "s#^#$1: line #"
  bad=1
}
hit 'array or tuple type in type arguments (name the type first)' '[A-Za-z_]<[^;=()]*\[[^;()]*>\('
hit 'tuple type predicate (name the type first)' '\bis \['
hit 'Client destructured (use ui.Client)' '\{[^}]*\bClient\b[^}]*\}[[:space:]]*='
hit 'type arguments at a call that passes $' '[A-Za-z_]<[^()]*>\(\$[,)]'
n=$(printf '%s\n' "$code" | grep -oE '(^|[^.A-Za-z0-9_$])register\b' | wc -l | tr -d ' ')
if [ "$n" -ne 1 ]; then echo "register named $n times, not once:"; printf '%s\n' "$code" | grep -nE '(^|[^.A-Za-z0-9_$])register\b' | cut -c1-160; bad=1; fi
# Helpers that take `$` (function declarations), each used for nothing else: no param, local or type query of its name.
for name in $(printf '%s\n' "$code" | sed -nE 's/^(export )?(async )?function ([A-Za-z_][A-Za-z0-9_]*)\(\$.*/\3/p' | sort -u); do
  hit "helper $name also used as another name" "typeof $name\b|\b(const|let|var) $name\b|[(,][[:space:]]*$name[[:space:]]*(:|,|\)|=[^=>])|[{,][[:space:]]*$name[[:space:]]*[,}]"
done
if [ "$bad" -eq 0 ]; then echo "register rules: every directory rule holds"; fi
exit "$bad"
