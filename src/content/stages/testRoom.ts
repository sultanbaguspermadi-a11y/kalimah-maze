import type { StageDef } from "../../core/types";

/**
 * Foundation test scene (KM-010..KM-014, KM-031 fixture). NOT the Morning Market:
 * the authored Stage 1 layout (KM-070) is separate work. Contains one gate/key pair so the
 * reachability validator is exercised against real data.
 */
export const testRoom: StageDef = {
  id: "test-room",
  version: 1,
  width: 16,
  height: 10,
  rows: [
    "################",
    "#.S..#.......K.#",
    "#....#.........#",
    "#....G.........#",
    "#....#.........#",
    "##########.#####",
    "#..............#",
    "#...N..........#",
    "#.............E#",
    "################",
  ],
  legend: { "#": "wall", ".": "floor", G: "floor", K: "floor", S: "floor", N: "floor", E: "floor" },
  tiles: [
    { id: "wall", kind: "wall", blocking: true },
    { id: "floor", kind: "floor", blocking: false },
  ],
  spawn: { x: 2.5, y: 7.5 },
  interactables: [
    { id: "key-brass", kind: "item", at: { x: 13, y: 1 } },
    { id: "gate-west", kind: "gate", at: { x: 5, y: 3 }, opensWith: "has-brass-key" },
    { id: "sign-1", kind: "sign", at: { x: 2, y: 1 } },
    { id: "npc-merchant", kind: "npc", at: { x: 4, y: 7 } },
    { id: "exit-door", kind: "exit", at: { x: 14, y: 8 } },
  ],
  // The sign room is sealed behind the gate; the key lies in the east room, so the fixture is solvable only in the right order.
  mandatoryPoints: [{ id: "reach-sign", at: { x: 2, y: 2 } }],
  exit: { at: { x: 14, y: 8 } },
  flagProducers: [{ flag: "has-brass-key", by: "key-brass" }],
};
