import type { Point, StageDef } from "../core/types";

/** Immutable collision view of a stage for a given flag set. */
export class CollisionGrid {
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;

  private constructor(w: number, h: number, blocked: Uint8Array) {
    this.width = w; this.height = h; this.blocked = blocked;
  }

  /** Gates are blocking unless their `opensWith` flag is set. Item/exit markers never block. */
  static fromStage(stage: StageDef, flags: ReadonlySet<string> = new Set()): CollisionGrid {
    const blocked = new Uint8Array(stage.width * stage.height);
    const tileById = new Map(stage.tiles.map((t) => [t.id, t]));
    for (let y = 0; y < stage.height; y++) {
      const row = stage.rows[y] ?? "";
      for (let x = 0; x < stage.width; x++) {
        const tileId = stage.legend[row[x] ?? ""];
        const tile = tileId ? tileById.get(tileId) : undefined;
        // Unknown tiles block: fail closed so bad data cannot create walk-through walls.
        blocked[y * stage.width + x] = !tile || tile.blocking ? 1 : 0;
      }
    }
    const set = (x: number, y: number): void => {
      if (x >= 0 && y >= 0 && x < stage.width && y < stage.height) blocked[y * stage.width + x] = 1;
    };
    for (const i of stage.interactables) {
      if (i.kind === "item" || i.kind === "exit") continue;
      if (i.kind === "gate" && i.opensWith && flags.has(i.opensWith)) continue;
      const fp = i.footprint ?? [{ x: 0, y: 0 }];
      for (const o of fp) set(i.at.x + o.x, i.at.y + o.y);
    }
    return new CollisionGrid(stage.width, stage.height, blocked);
  }

  isBlockedTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return this.blocked[y * this.width + x] === 1;
  }

  /** Axis-aligned box (tile units, centred on pos, half-extent `r`) overlap test. */
  boxBlocked(p: Point, r: number): boolean {
    const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r - 1e-9);
    const y0 = Math.floor(p.y - r), y1 = Math.floor(p.y + r - 1e-9);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.isBlockedTile(x, y)) return true;
    return false;
  }
}

/**
 * Moves `pos` by (dx, dy) with axis-separated resolution so the actor slides along walls.
 * Large steps are subdivided so fast frames or low FPS cannot tunnel through a 1-tile wall.
 */
export function moveWithCollision(grid: CollisionGrid, pos: Point, dx: number, dy: number, r = 0.35): Point {
  const maxStep = 0.25;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));
  let p = { ...pos };
  for (let i = 0; i < steps; i++) {
    const nx = { x: p.x + dx / steps, y: p.y };
    if (!grid.boxBlocked(nx, r)) p = nx;
    const ny = { x: p.x, y: p.y + dy / steps };
    if (!grid.boxBlocked(ny, r)) p = ny;
  }
  return p;
}

/** Spawn is valid when the actor's box is free; otherwise search nearby tile centres (safe spawn handling). */
export function findSafeSpawn(grid: CollisionGrid, want: Point, r = 0.35): Point | null {
  const cx = Math.floor(want.x) + 0.5, cy = Math.floor(want.y) + 0.5;
  for (let ring = 0; ring <= 4; ring++) {
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const p = { x: cx + dx, y: cy + dy };
      if (!grid.boxBlocked(p, r)) return p;
    }
  }
  return null;
}
