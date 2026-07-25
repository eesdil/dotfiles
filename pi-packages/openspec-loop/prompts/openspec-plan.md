---
description: OpenSpec planning only (proposal, specs, design, tasks)
argument-hint: "[feature description]"
---

Plan (do not implement) with OpenSpec for: ${1:-this feature}

1. Prefer `/openspec-plan ${1:-}` if available.
2. Create `openspec/changes/<id>/{proposal.md,design.md,tasks.md,specs/}`.
3. Stop when the plan is ready for `/openspec-loop`.
