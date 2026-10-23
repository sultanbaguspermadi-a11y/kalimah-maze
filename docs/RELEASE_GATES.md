# Release gates

| Gate | Status | Closed by |
|---|---|---|
| **KM-062** Arabic content review | **OPEN** | A named qualified reviewer records `reviewed` + date + sign-off reference for every item; `npm run release:check` exits 0 |
| **KM-114** Final content review | **OPEN** | Same, for the final shipped content set, after any corrections |

- No qualified Arabic reviewer has been appointed. Development and internal testing continue; **public release is not approved and must not be described as academically reviewed.**
- `npm run release:check` currently exits **1** (39 items `pending_review`, none with a recorded reference). `npm run build:release` therefore fails by design.
- Normal builds (`npm run build`) are unaffected so work is never blocked.
- Reviewers receive `npm run export:review` → `review-packet/` (JSON, CSV, Markdown). Returning decisions into the repository is still a manual edit of the content JSON (no importer yet).
