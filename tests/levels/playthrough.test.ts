import { describe, expect, it } from "vitest";
import { testRoom } from "../../src/content/stages/testRoom";
import { testQuest } from "../../src/content/quests/testQuest";
import { QuestState } from "../../src/quests/evaluator";
import { CollisionGrid, moveWithCollision } from "../../src/world/grid";
import type { Point } from "../../src/core/types";

/** BFS over tiles on the current grid; returns tile-centre waypoints. */
function path(grid: CollisionGrid, from: Point, to: Point): Point[] {
  const k = (p: Point): string => `${p.x},${p.y}`;
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const prev = new Map<string, Point | null>([[k(start), null]]);
  const q = [start];
  while (q.length) {
    const c = q.shift() as Point;
    if (c.x === to.x && c.y === to.y) break;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (grid.isBlockedTile(n.x, n.y) || prev.has(k(n))) continue;
      prev.set(k(n), c); q.push(n);
    }
  }
  const out: Point[] = [];
  for (let c: Point | null | undefined = to; c; c = prev.get(k(c))) out.unshift({ x: c.x + 0.5, y: c.y + 0.5 });
  return out;
}

/** Walk with the REAL collision body (radius 0.35), so 1-tile doorways must actually be passable. */
function walk(grid: CollisionGrid, from: Point, to: Point): Point {
  let pos = from;
  for (const wp of path(grid, from, { x: Math.floor(to.x), y: Math.floor(to.y) })) {
    for (let i = 0; i < 400 && Math.hypot(wp.x - pos.x, wp.y - pos.y) > 0.05; i++) {
      const dx = wp.x - pos.x, dy = wp.y - pos.y, len = Math.hypot(dx, dy), step = Math.min(len, 4.2 / 60);
      pos = moveWithCollision(grid, pos, (dx / len) * step, (dy / len) * step);
    }
    expect(Math.hypot(wp.x - pos.x, wp.y - pos.y)).toBeLessThan(0.1); // got stuck => doorway too narrow
  }
  return pos;
}

describe("foundation scene playthrough with real movement", () => {
  it("completes key -> sign -> exit from a fresh state", () => {
    const quest = new QuestState(testQuest);
    let pos: Point = { ...testRoom.spawn };
    let flags = new Set<string>();
    let grid = CollisionGrid.fromStage(testRoom, flags);

    pos = walk(grid, pos, { x: 13, y: 1 });
    expect(quest.dispatch({ type: "collect", target: "key-brass" })).toEqual(["get-key"]);
    flags = new Set(quest.snapshot().flags);
    grid = CollisionGrid.fromStage(testRoom, flags);

    pos = walk(grid, pos, { x: 2, y: 2 }); // inside the west room, through the opened gate
    expect(quest.dispatch({ type: "inspect", target: "sign-1" })).toEqual(["read-sign"]);

    pos = walk(grid, pos, { x: 14, y: 8 });
    expect(quest.dispatch({ type: "reach", target: "exit-door" })).toEqual(["leave"]);
    expect(quest.isQuestComplete()).toBe(true);
  });

  it("cannot read the sign or leave before the prerequisites", () => {
    const quest = new QuestState(testQuest);
    expect(quest.dispatch({ type: "inspect", target: "sign-1" })).toEqual([]);
    expect(quest.dispatch({ type: "reach", target: "exit-door" })).toEqual([]);
    expect(quest.isQuestComplete()).toBe(false);
  });
});
