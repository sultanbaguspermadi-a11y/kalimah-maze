# Content Guide (KM-004 / KM-050)
- Content files live in `src/content/`; they are validated by `src/content/validate.ts` and `tests/content`.
- `reviewStatus` values: `unreviewed` | `in-review` | `reviewed`. Only a named reviewer with a date may set `reviewed` (`reviewedBy`, `reviewedOn`). The validator rejects `reviewed` without both.
- Mandatory (gate/boss) challenges must be `reviewed` for a **release** build; development builds only warn.
- Arabic is stored with tashkeel in `ar`; `arPlain` is the search/comparison form. Normalization is chosen explicitly per exercise (`strict`, `ignoreTashkeel`, `lenient`).
- Current content status: **all content is a technical fixture, unreviewed; not for public release.**
