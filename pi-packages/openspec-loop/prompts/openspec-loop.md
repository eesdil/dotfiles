---
description: Apply loop only — models, gates, YAML run templates
argument-hint: "[change-name]"
---

Start the controlled apply loop for an existing OpenSpec change: ${1:-}

1. Prefer `/openspec-loop ${1:-}` if available.
2. Confirm the main model, pick gate models, optionally load a saved run template.
3. Do not start apply until `tasks.md` exists (use `/openspec-plan` or `/openspec-feature` first).
