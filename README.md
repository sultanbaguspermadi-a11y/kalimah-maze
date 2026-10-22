# Kalimah Maze: Chronicles of the Lost Bazaar

Browser-first top-down pixel-art Arabic-learning game. **Status: foundation only (Phase 0 + part of Phase 1).** The Morning Market vertical slice, art pipeline, learning content, boss and PWA are not built yet.

## Commands
- `npm install`
- `npm run dev` — dev server
- `npm test` — Vitest unit/integration tests (Node, no browser)
- `npm run typecheck`
- `npm run build` — typecheck + production build to `dist/`

## What exists
Input action map, tile collision with gates, level reachability validator, quest evaluator, versioned save with sanitising/recovery, Arabic normalization policies, content validators, and a placeholder test scene (code-drawn tiles, not final art). See `docs/REPOSITORY_AUDIT.md`, `docs/adr/0001-game-architecture.md`, `CONTENT_GUIDE.md`, `ASSET_REGISTER.md`, `SOURCE_REGISTER.md`.

## Not built / not verified
No browser or device testing has been run. No Arabic content or review exists. No audio, PWA, settings UI, dialogue, journal, art bible.
