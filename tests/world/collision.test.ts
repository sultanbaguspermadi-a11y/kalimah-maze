import { describe, expect, it } from "vitest";
import { testRoom } from "../../src/content/stages/testRoom";
import { CollisionGrid, findSafeSpawn, moveWithCollision } from "../../src/world/grid";

const grid = CollisionGrid.fromStage(testRoom);

describe("collision", () => {
  it("cannot pass through walls even with a huge frame step (no tunnelling)", () => {
    const p = moveWithCollision(grid, { x: 2.5, y: 7.5 }, 0, 40);
    expect(p.y).toBeLessThan(9); // bottom wall row is y=9
    expect(grid.boxBlocked(p, 0.35)).toBe(false);
  });

  it("slides along a wall instead of sticking", () => {
    const p = moveWithCollision(grid, { x: 2.5, y: 8.5 }, 2, 2); // pushes into bottom wall while moving right
    expect(p.x).toBeGreaterThan(4);
    expect(grid.boxBlocked(p, 0.35)).toBe(false);
  });

  it("closed gate blocks and open gate passes", () => {
    expect(grid.isBlockedTile(5, 3)).toBe(true);
    const open = CollisionGrid.fromStage(testRoom, new Set(["has-brass-key"]));
    expect(open.isBlockedTile(5, 3)).toBe(false);
  });

  it("npc footprint blocks, items and exit markers do not", () => {
    expect(grid.isBlockedTile(4, 7)).toBe(true);
    expect(grid.isBlockedTile(13, 1)).toBe(false);
    expect(grid.isBlockedTile(14, 8)).toBe(false);
  });

  it("out-of-bounds is blocked", () => {
    expect(grid.isBlockedTile(-1, 0)).toBe(true);
    expect(grid.isBlockedTile(16, 0)).toBe(true);
  });

  it("relocates an unsafe spawn to a nearby free tile", () => {
    const p = findSafeSpawn(grid, { x: 4.5, y: 7.5 }); // on the NPC
    expect(p).not.toBeNull();
    expect(grid.boxBlocked(p!, 0.35)).toBe(false);
  });
});
