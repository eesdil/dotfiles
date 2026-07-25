---
name: openspec-feature
description: >-
  Full OpenSpec workflow for Pi: plan artifacts first, then controlled apply
  loop with selectable main/gate models and YAML run templates. Use when the
  user wants to build a feature with OpenSpec planning and gated implementation.
---

# OpenSpec feature workflow

## Phases

1. **Plan** — OpenSpec change artifacts only (`proposal`, `specs`, `design`, `tasks`). No feature code.
2. **Apply** — `/openspec-loop` controller: confirm models, walk tasks, run shell/agent gates.

## Commands

- `/openspec-feature` — full plan → apply
- `/openspec-plan` — plan only
- `/openspec-loop` — apply only

## Rules

- Never implement during planning.
- Always confirm the main model before apply.
- Prefer fixing gate failures over skipping them.
- Save useful model combos as YAML under `.pi/openspec-loop/runs/`.
