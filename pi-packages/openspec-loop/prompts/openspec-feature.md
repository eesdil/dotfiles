---
description: Full OpenSpec feature flow — plan then controlled apply loop
argument-hint: "[feature description]"
---

Run the full openspec-loop package workflow for: ${1:-this feature}

1. Prefer `/openspec-feature ${1:-}` if the command exists.
2. Path **Full**: create OpenSpec plan artifacts first (no code), then start the apply loop with model/gates selection.
3. Do not implement feature code during planning.
4. After `tasks.md` is ready, confirm main + gate models before applying.
