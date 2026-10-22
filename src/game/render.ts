import type { StageDef } from "../core/types";

export const TILE = 16;
export const VIEW_W = 320;
export const VIEW_H = 180;

/** Largest integer scale that fits, so pixels are never blurred or unevenly sized. */
export function integerScale(availW: number, availH: number): number {
  return Math.max(1, Math.floor(Math.min(availW / VIEW_W, availH / VIEW_H)));
}

export interface Camera { x: number; y: number }

/** Pixel-aligned follow camera. Stages smaller than the view are centred rather than showing out-of-bounds. */
export function cameraFor(stage: StageDef, px: number, py: number): Camera {
  const worldW = stage.width * TILE, worldH = stage.height * TILE;
  const clamp = (v: number, worldSize: number, viewSize: number): number =>
    worldSize <= viewSize ? Math.round((worldSize - viewSize) / 2) : Math.round(Math.min(Math.max(v - viewSize / 2, 0), worldSize - viewSize));
  return { x: clamp(px * TILE, worldW, VIEW_W), y: clamp(py * TILE, worldH, VIEW_H) };
}

// Placeholder, code-drawn tiles. Real authored tileset is KM-022; these are NOT final art.
const PALETTE = { wall: "#5a3b26", wallTop: "#7b5438", floorA: "#c9a76b", floorB: "#bf9c5f", gate: "#8a2f2f", key: "#f0c93a", npc: "#3f7f8f", sign: "#e8d9b0", exit: "#3c9a5a", player: "#e8e2d0", ink: "#1a110a" };

export function drawStage(ctx: CanvasRenderingContext2D, stage: StageDef, cam: Camera, flags: ReadonlySet<string>, collected: ReadonlySet<string>): void {
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(stage.width, Math.ceil((cam.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(stage.height, Math.ceil((cam.y + VIEW_H) / TILE));
  const blockingIds = new Set(stage.tiles.filter((t) => t.blocking).map((t) => t.id));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const id = stage.legend[(stage.rows[y] ?? "")[x] ?? ""] ?? "";
    const sx = x * TILE - cam.x, sy = y * TILE - cam.y;
    if (blockingIds.has(id)) {
      ctx.fillStyle = PALETTE.wall; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop; ctx.fillRect(sx, sy, TILE, 3);
    } else {
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB; ctx.fillRect(sx, sy, TILE, TILE);
    }
  }
  for (const i of stage.interactables) {
    const sx = i.at.x * TILE - cam.x, sy = i.at.y * TILE - cam.y;
    if (i.kind === "item" && collected.has(i.id)) continue;
    if (i.kind === "gate" && i.opensWith && flags.has(i.opensWith)) continue;
    const colour = { gate: PALETTE.gate, item: PALETTE.key, npc: PALETTE.npc, sign: PALETTE.sign, exit: PALETTE.exit, stall: PALETTE.npc }[i.kind];
    ctx.fillStyle = colour;
    if (i.kind === "item") ctx.fillRect(sx + 5, sy + 5, 6, 6);
    else if (i.kind === "exit") ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
    else ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 2);
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, cam: Camera, px: number, py: number): void {
  const sx = Math.round(px * TILE - cam.x), sy = Math.round(py * TILE - cam.y);
  ctx.fillStyle = PALETTE.ink; ctx.fillRect(sx - 5, sy - 7, 10, 14);
  ctx.fillStyle = PALETTE.player; ctx.fillRect(sx - 4, sy - 6, 8, 12);
}
