# Legacy migration (KM-016)

Source: `legacy/Kalimah_Maze_WordGate.html` (sha256 in `legacy/SHA256.txt`), localStorage key **`kalimah-maze-v1`**, schema `v: 1 | v: 2`.
The schema below was read from that file's code, not assumed.

## Prototype schema
`{ v, lex:{<wId>:{ok,no,dirs,rounds[≤6],last}}, nq:{<nId>:{ok,no,last}}, words:[wId], best:{"<difficulty>/<mode>":score}, set:{lang,vm,vmu,vs,mt,snd,mus,rm,ar,ctl,th,tr,lh}, diff, mode, theme }`
Word ids `w0…w23` are positional; question ids `n1…n15`. The prototype treats `v:1` and `v:2` identically, so do we.

## Safety guarantees (all covered by `tests/persistence/*`)
- The legacy key is **only read**. Import never writes or deletes it (test asserts no `setItem`/`removeItem` on it).
- The new save is written only after the merged data passes validation (sanitise round-trip), then **read back and compared**; any mismatch or storage error restores the previous bytes (or removes the new key if there were none).
- Idempotent: the same legacy text is recognised by a content hash and is a no-op; the merge is also idempotent on its own (max / OR / ordered union).
- Later import of *changed* legacy data merges by max, never downgrades new-game progress, and never overwrites the player's current settings.
- A corrupt new save is copied to `kalimah-maze.save.corrupt` before being replaced.
- `retireLegacy()` can remove the legacy key, but only on explicit call, only if the new save validates and records an import of exactly the current legacy text. **Nothing calls it automatically and the UI has no button for it.**

## Origins and other browsers
`localStorage` is per-origin. The new app can read `kalimah-maze-v1` only if the prototype was served from the same origin. It cannot reach `file://` pages, other domains or other browsers, and it does not try. Fallback: in the old page run `copy(localStorage.getItem('kalimah-maze-v1'))`, then paste (or save as a `.json`/`.txt` file) in **Impor / ekspor** on the title screen. The same dialog exports the new save as JSON (`kalimah-maze-save` envelope) and restores it; restoring keeps the previous save as `kalimah-maze.save.pre-import`.

## Mapping
| Prototype | New save | Note |
|---|---|---|
| `lex[w*]` ok/no/dirs/rounds/last | `lexiconStats[lex-*]` | ids via frozen map (`src/content/data/legacy-lexicon.json`) |
| stage 1 / 2 / 3 | `lexicon.state` discovered / practised / reverse | same rule as prototype `stOf` |
| `words` | `legacy.discovered` (+ a stats entry per word) | |
| `nq[n*]` | `nahwuStats[nq-n*]` | |
| `best` | `legacy.bestScores` | kept verbatim, max per key |
| `set.lang vm vmu vs mt snd mus rm ar ctl th tr lh` | `language masterVolume musicVolume sfxVolume muted sfxEnabled musicEnabled reducedMotion arabicTextScale controlScheme theme showTranslation leftHanded` | `vm/100`; `ar` 0/1/2 → 0.85/1/1.3; `stick` → `joystick`; `rm` on also turns screen shake off |
| `diff` | `settings.difficulty` + `legacy.preferences.difficulty` | chill→gentle, normal/tricky→standard, hard/hardcore→hard |
| `mode`, `theme` | `legacy.preferences.mode / zoneTheme` | preserved, no equivalent yet |

## Cannot be migrated safely (documented, not hidden)
1. **"Mastered" is downgraded to `reverse`** (original kept in `legacy.legacyMastered`). The prototype granted it after 3 credited rounds ≥5 min apart; the new game requires its own spaced reviews.
2. **Difficulty 5 → 3 levels is lossy** (tricky→standard, hardcore→hard); the original value is kept.
3. **`box` and `due` are derived** (`box = min(5, rounds)`, `due = last`), not original data; the prototype had no scheduler.
4. **Counters merge by max, not sum**, to keep re-import idempotent. If someone plays both versions, only the larger count survives.
5. **Best scores** use the prototype's scoring and are not comparable with the new game; stored, not displayed.
6. **Game mode and zone theme** have no counterpart yet; stored only.
7. **Unknown ids, malformed entries, invalid settings, bad `best` keys** are dropped (the prototype also discards unknown ids) and counted in the import report. Valid sibling fields are still imported.
8. **Numeric coercion:** counters follow the prototype's `+x|0` semantics but are clamped to 0…2³¹−1 instead of wrapping; timestamps keep full epoch-ms precision.
9. The prototype's `S` has only the top-level fields listed above, so nothing else could be carried over.
10. The prototype's Arabic words and questions are imported **as unreviewed content** (`pending_review`); see `CONTENT_GUIDE.md`.

## Test caveat
Tests use a **synthetic** save built from the real schema. No real player save from the prototype was available, and the import has **not** been run against a real browser's localStorage.
