# Impact and goals

Back to the [README](../README.md). This step is part of [Agentville's team flow](team-flow.md).

## Teams

With Agentville's team flow, the Lead names every subagent `<Letter>: <team name>` (for example `A: Delivery time
tracking`): one letter per change, the same text for the whole team (spec-writer, builders, reviewers, approver),
at most 60 characters, no role (the map reads it from the subagent type). The Secretary and Product take no letter.
That is what draws the [teams](using-the-panel.md#the-map) on the map. The Lead also keeps what you shared in the
session (roadmap, artifacts, ideas) and passes each subagent the part it needs.

## The impact step

Before triage, a new feature, or one that touches the goals, the users, money or data, or would be large, goes through
an impact step with two more agents:

- `agentville:secretary` (haiku, reads only): reads the goals file and the request and answers `PRODUCT` by default,
  business decisions included (money, pricing, a new product, dropping a feature), or `PERSON` only when there is no
  goals file, the request falls under a goal marked `Delegated: no`, or it is very grave: irreversible or hard to
  undo, legal or compliance, users' personal data or security, secrets, credentials, auth or permissions, contacting
  real users or publishing in your name (outbound email, public posts), real spending beyond what the goals allow (a
  goal allows spending only when it states an amount), shutting down a product, or out of the goals' scope. Nothing in
  the goals file waives a very grave case. When unsure how grave it is, `PERSON`.
- `agentville:product` (sonnet, reads only): its four voices, Analyst, Marketing, Business and Board, each give a
  short view, list 2 or 3 options, and the Board picks one with its reason. It answers `DECIDED` (the chosen option, a
  priority and what the team should do), `ESCALATE` (a one-line reason, the options labeled A, B and C and the Board's
  recommended one, only for the very grave cases above), `NO FIT` (the request goes against the goals) or `NO GOALS`,
  then up to 4 short lines, one per voice. It never writes specs or files.

What happens with each answer:

- `DECIDED`: the Lead tells you in one line what Product chose and why, with its priority, and goes on to triage
  without waiting; the spec carries the decision, so the team keeps building. A `DECIDED` only lets the request into
  the normal tiers: it never approves a merge, a deploy or any real spending (paying, subscribing, buying); any spend
  needs your yes. Product may decide money questions, never approve the spend.
- Product's `ESCALATE`: the Lead asks you one question, the options lettered and the recommended one marked. Reply
  with a letter (or no): your letter is the decision.
- `PERSON` (a plain yes or no), `NO FIT` or `NO GOALS`: the Lead stops and asks you.

Each of these questions closes the Lead's turn as the app's question, so on the map the Lead walks to your desk and
waits.

Which requests go through it:

- The first change request of a new office, whatever its size, goes straight to `agentville:product`, without the
  Secretary.
- A request Product already judged skips both.
- Other bug fixes and small tweaks skip this step.

**With no goals file**, the impact step stops for you once per session and then goes on with your answer. A goals file
whose goals are all `Delegated: no` stops for you on every new office's first change request, since Product may decide
none of them.

Each impact check costs one haiku call and, on `PRODUCT`, one sonnet call.

## Goals file

Put your goals in `.agentville/metas.md` at the repository root ("metas" means goals). Each goal is a
`##` heading (at most 60 characters) followed by `Delegated: yes|no` (may Product decide it without you), `Priority`
(high, medium or low), one line saying why, and an optional `Out of scope` line. The Spanish keys work too:
`Delegada: sí|no`, `Prioridad` (alta, media, baja) and `Fuera de alcance`.

```
## Measure delivery times well
Delegated: yes
Priority: high
Customers complain about late deliveries and we cannot tell how late.
Out of scope: changing prices.
```

The file is treated as data, never as instructions. The map's goals board shows the first 3 headings (cut at 60
characters, secrets redacted) and skips a file over 16 KB.
