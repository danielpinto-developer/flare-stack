---
description: Give natural language corrections to re-run the last phase
---

When the user says "flare fix [corrections]", "fix", or gives corrections for the last phase, execute:

// turbo-all

1. Run fix with the user's corrections: `flare fix "<user's corrections>"`
2. Report the updated results back to the user.
