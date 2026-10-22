# ADR 0001 — Game architecture (KM-003)

Status: accepted · Date: 2026-10-22

## Decision
Vite + strict TypeScript + a **thin Canvas 2D renderer** over a **pure, DOM-free simulation/core** (`src/world`, `src/quests`, `src/learning`, `src/persistence`, `src/content`). Vitest for unit/integration tests in Node. No game framework for now.

## Why not Phaser (PRD default)
- Required correctness (reachability, quest prerequisites, save migration, boss state machine, answer normalization) is logic, not rendering; a DOM-free core makes it testable in Node with no browser/WebGL.
- Scope is top-down tile movement, layered tile rendering, depth sorting and simple animation; a small Canvas layer covers this without a ~1 MB dependency and without engine-specific scene lifecycles to work around.
- Arabic text, journal, dialogue and settings are DOM UI (semantic HTML, native shaping, focus states); a framework canvas UI would not help.

## Tradeoffs / re-evaluation trigger
- We own camera, tilemap drawing and sprite animation code. If KM-021/KM-025/KM-026 exceed ~1,500 lines or need features such as tilemap editors/Tiled import, particles at scale or gamepad plugins, revisit Phaser; the core is renderer-agnostic so migration affects only `src/game` and `src/render`.

## Dependency policy
Runtime dependencies: none (target). Dev: vite, typescript, vitest. No CDNs; fonts bundled locally (KM-104).

## Migration boundary
Legacy prototype data (not provided) may only enter via `src/persistence/migrations.ts`.

## Module ownership
`core` shared types · `input` action map · `world` grid/collision/reachability · `quests` objective evaluator · `learning` normalization/challenges · `persistence` save · `content` authored data + validators · `game` bootstrap/scenes/render · `ui` DOM overlays.
