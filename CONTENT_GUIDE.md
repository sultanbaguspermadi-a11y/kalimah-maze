# Content Guide (KM-004 / KM-050 / KM-062)

## Status vocabulary
`pending_review` (default for everything authored or imported) · `reviewed` · `disputed` · `withdrawn`.
`reviewed` is valid only with `reviewedBy`, `reviewedOn` (YYYY-MM-DD) and `evidence` (reference to documented sign-off) and with no unresolved dispute. Non-reviewed items must not carry reviewer fields. `src/content/review.ts` enforces this; tests cover it. **Nobody, including the implementer, may set `reviewed` without that evidence.**

## Per item
Every item records: stable `id` (never reused), `provenance` (kind, file/hash, note, `sourceIds` actually consulted), and a `review` trail: `notes`, `corrections` (field, from, to, reason, by, date), `disputes` (raised/resolved), reviewer fields. Items without a recorded reference warn in development and block release.

## Sources
`src/content/data/sources.json` is the bibliographic register (empty). Add an entry only after the source was actually consulted; set `verifiedAgainstContent` only when someone checked that item against it. Never invent editions, pages or URLs. See `SOURCE_REGISTER.md`.

## Files
- `legacy-lexicon.json`, `legacy-nahwu.json`: 24 words and 15 nahwu questions extracted from the prototype by `tools/extract-legacy-content.mjs` (refuses to overwrite without `--force`). IDs are frozen; glosses and answers may be corrected without changing ids.
- Arabic is stored with harakat. Answer comparison policy is chosen per exercise (`strict`, `ignoreTashkeel`, `lenient`; see `src/learning/normalize.ts`).

## Workflow
1. `npm run validate:content` / `npm test` — structure (answer key ∈ options, unique ids, valid review trail).
2. `npm run export:review` — packet for an independent reviewer.
3. Apply reviewer decisions to the JSON (record corrections and disputes), then `npm run release:check`.

Current status: **all 39 items are a technical seed, `pending_review`, with no recorded references. Not for public release.**
