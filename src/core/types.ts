/** Shared domain types. Kept DOM-free so every system is testable in Node. */
export type ReviewStatus = "unreviewed" | "in-review" | "reviewed";

export interface Point { x: number; y: number }

export type TileKind = "floor" | "wall" | "prop" | "door" | "water";

export interface TileDef {
  id: string;
  kind: TileKind;
  /** Collision is data, separate from art (PRD §11). */
  blocking: boolean;
}

export interface Interactable {
  id: string;
  kind: "npc" | "sign" | "stall" | "gate" | "exit" | "item";
  at: Point;
  /** Tiles blocked by this object's footprint, relative to `at`. */
  footprint?: Point[];
  /** Gate only: passable iff this flag is set. */
  opensWith?: string;
}

export interface StageDef {
  id: string;
  version: number;
  width: number;
  height: number;
  /** One string per row; each char maps through `legend`. */
  rows: string[];
  legend: Record<string, string>;
  tiles: TileDef[];
  spawn: Point;
  interactables: Interactable[];
  /** Points the player must reach (mandatory triggers). */
  mandatoryPoints: { id: string; at: Point; requiresFlags?: string[] }[];
  exit: { at: Point; requiresFlags?: string[] };
  /** Flags that interactions can produce, with the interactable that produces them. */
  flagProducers: { flag: string; by: string }[];
}

export type ObjectiveType =
  | "collect" | "deliver" | "inspect" | "talk" | "answer"
  | "activate" | "unlock" | "survive" | "reach" | "boss-phase";

export interface ObjectiveDef {
  id: string;
  type: ObjectiveType;
  /** Target entity/item/challenge id the event must reference. */
  target: string;
  optional?: boolean;
  requires?: string[]; // objective ids that must be complete first
  setsFlag?: string;
}

export interface QuestDef {
  id: string;
  title: string;
  objectives: ObjectiveDef[];
}

export interface GameEvent { type: ObjectiveType; target: string }
