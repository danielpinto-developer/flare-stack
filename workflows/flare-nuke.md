---
description: 💣 Nuke finished/stale chambers from flare-chambers — keeps dir, removes old worktrees
---

When the user says "flare nuke", "nuke", or "clean up chambers", execute:

// turbo-all

1. Run nuke: `flare nuke`
2. Report the results back to the user.

**Options:**

- `--stale <days>`: Auto-select chambers not modified in N days
- `--all`: Remove all chambers (dir stays)
- `-y`: Skip confirmation
