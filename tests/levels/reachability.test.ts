import { describe, expect, it } from "vitest";
import { testRoom } from "../../src/content/stages/testRoom";
import { floodFill, validateStageReachability } from "../../src/world/reachability";
import { CollisionGrid } from "../../src/world/grid";
import { validateStageShape } from "../../src/content/validate";
import type { StageDef } from "../../src/core/types";

const clone = (s: StageDef): StageDef => structuredClone(s);
const msgs = (s: StageDef): string[] => validateStageReachability(s).map((i) => i.message);
const setTile = (s: StageDef, x: number, y: number, ch: string): void => {
  const r = s.rows[y] as string;
  s.rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
};

describe("test room", () => {
  it("has valid shape and is fully solvable", () => {
    expect(validateStageShape(testRoom)).toEqual([]);
    expect(validateStageReachability(testRoom)).toEqual([]);
  });

  it("the gate is real: the sign room is unreachable until the key flag is set", () => {
    const spawn = { x: 2, y: 7 };
    const closed = floodFill(CollisionGrid.fromStage(testRoom), spawn);
    expect(closed.has("2,2")).toBe(false);
    const open = floodFill(CollisionGrid.fromStage(testRoom, new Set(["has-brass-key"])), spawn);
    expect(open.has("2,2")).toBe(true);
  });
});

describe("broken fixtures fail with clear messages", () => {
  it("flags a key placed behind its own gate", () => {
    const s = clone(testRoom);
    s.interactables = s.interactables.map((i) => (i.id === "key-brass" ? { ...i, at: { x: 3, y: 4 } } : i));
    const m = msgs(s);
    expect(m).toContain('flag "has-brass-key" (from "key-brass") is unobtainable — likely behind its own gate');
    expect(m).toContain('mandatory point "reach-sign" at 2,2 is unreachable');
  });

  it("flags a gate nothing can open", () => {
    const s = clone(testRoom);
    s.flagProducers = [];
    expect(msgs(s)).toContain('gate "gate-west" opens with "has-brass-key" but no interactable produces it');
  });

  it("flags an unreachable exit", () => {
    const s = clone(testRoom);
    setTile(s, 13, 8, "#");
    setTile(s, 14, 7, "#");
    expect(msgs(s)).toContain("exit at 14,8 is unreachable");
  });

  it("flags a mandatory point that is unreachable", () => {
    const s = clone(testRoom);
    s.mandatoryPoints = [{ id: "bad", at: { x: 0, y: 0 } }];
    expect(msgs(s)).toContain('mandatory point "bad" at 0,0 is unreachable');
  });

  it("flags a spawn on a blocked tile", () => {
    const s = clone(testRoom);
    s.spawn = { x: 0.5, y: 0.5 };
    expect(msgs(s)).toContain("spawn is on a blocked tile");
  });

  it("flags malformed rows and unmapped characters", () => {
    const s = clone(testRoom);
    s.rows[2] = "#....#..?......"; // 15 chars, contains an unmapped "?"
    const m = validateStageShape(s).map((i) => i.message);
    expect(m).toContain("row 2 length 15 != width 16");
    expect(m).toContain('unmapped char "?" at 8,2');
  });

  it("flags an unknown flag producer", () => {
    const s = clone(testRoom);
    s.flagProducers = [{ flag: "x", by: "ghost" }];
    expect(validateStageShape(s).map((i) => i.message)).toContain('flag "x" produced by unknown interactable "ghost"');
  });
});
