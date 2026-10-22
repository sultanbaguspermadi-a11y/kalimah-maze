import type { Point, StageDef } from "../core/types";
import { CollisionGrid } from "./grid";
import type { Issue } from "../content/validate";

const key = (p: Point): string => `${p.x},${p.y}`;
const DIRS: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Tiles reachable from `from` by 4-way walking on the given grid. */
export function floodFill(grid: CollisionGrid, from: Point): Set<string> {
  const seen = new Set<string>();
  if (grid.isBlockedTile(from.x, from.y)) return seen;
  const q: Point[] = [from];
  seen.add(key(from));
  while (q.length) {
    const c = q.pop() as Point;
    for (const d of DIRS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (grid.isBlockedTile(n.x, n.y) || seen.has(key(n))) continue;
      seen.add(key(n));
      q.push(n);
    }
  }
  return seen;
}

/** An interactable is usable if the player can stand on or beside its anchor tile. */
function usable(reach: Set<string>, at: Point): boolean {
  return reach.has(key(at)) || DIRS.some((d) => reach.has(key({ x: at.x + d.x, y: at.y + d.y })));
}

/**
 * Computes the set of flags obtainable by a fair player (fixpoint: reach -> use producers -> new flags
 * may open gates -> reach more). A key behind its own gate never becomes obtainable, so it is reported.
 */
export function obtainableFlags(stage: StageDef): { flags: Set<string>; reach: Set<string> } {
  const flags = new Set<string>();
  let reach = new Set<string>();
  for (let guard = 0; guard < 64; guard++) {
    const grid = CollisionGrid.fromStage(stage, flags);
    reach = floodFill(grid, { x: Math.floor(stage.spawn.x), y: Math.floor(stage.spawn.y) });
    let grew = false;
    for (const p of stage.flagProducers) {
      const owner = stage.interactables.find((i) => i.id === p.by);
      if (!owner || flags.has(p.flag)) continue;
      if (usable(reach, owner.at)) { flags.add(p.flag); grew = true; }
    }
    if (!grew) break;
  }
  return { flags, reach };
}

export function validateStageReachability(stage: StageDef): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string): void => { issues.push({ severity: "error", where: stage.id, message }); };
  const base = CollisionGrid.fromStage(stage);
  if (base.isBlockedTile(Math.floor(stage.spawn.x), Math.floor(stage.spawn.y))) err("spawn is on a blocked tile");

  const { flags, reach } = obtainableFlags(stage);
  const missing = (req: string[] | undefined): string[] => (req ?? []).filter((f) => !flags.has(f));

  for (const m of stage.mandatoryPoints) {
    if (!reach.has(key(m.at))) err(`mandatory point "${m.id}" at ${key(m.at)} is unreachable`);
    const miss = missing(m.requiresFlags);
    if (miss.length) err(`mandatory point "${m.id}" requires flags that can never be obtained: ${miss.join(", ")}`);
  }
  if (!reach.has(key(stage.exit.at))) err(`exit at ${key(stage.exit.at)} is unreachable`);
  const exitMiss = missing(stage.exit.requiresFlags);
  if (exitMiss.length) err(`exit requires flags that can never be obtained: ${exitMiss.join(", ")}`);

  for (const p of stage.flagProducers) {
    if (!flags.has(p.flag)) err(`flag "${p.flag}" (from "${p.by}") is unobtainable — likely behind its own gate`);
  }
  // A gate whose opening flag nothing produces is a permanent block.
  for (const i of stage.interactables) {
    if (i.kind === "gate" && i.opensWith && !stage.flagProducers.some((p) => p.flag === i.opensWith)) {
      err(`gate "${i.id}" opens with "${i.opensWith}" but no interactable produces it`);
    }
  }
  return issues;
}
