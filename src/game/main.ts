import { InputState } from "../input/actions";
import { CollisionGrid, findSafeSpawn, moveWithCollision } from "../world/grid";
import { testRoom } from "../content/stages/testRoom";
import { testQuest } from "../content/quests/testQuest";
import { QuestState } from "../quests/evaluator";
import { loadSave, resetSave, writeSave, type SaveData } from "../persistence/save";
import { importLegacyFromStorage } from "../persistence/legacyMigration";
import { createImportDialog } from "../ui/importDialog";
import { describeImport } from "../ui/importMessages";
import { VIEW_H, VIEW_W, cameraFor, drawPlayer, drawStage, integerScale } from "./render";
import type { Interactable } from "../core/types";

type Mode = "title" | "play" | "paused" | "message";
const SPEED = 4.2; // tiles per second
const INTERACT_RANGE = 1.3;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;

function showFatal(msg: string): void {
  const f = document.getElementById("fatal");
  const m = document.getElementById("fatal-msg");
  if (m) m.textContent = `Terjadi kesalahan: ${msg}`;
  f?.classList.add("show");
}
window.addEventListener("error", (e) => showFatal(e.message));
window.addEventListener("unhandledrejection", (e) => showFatal(String((e.reason as Error | undefined)?.message ?? e.reason)));
document.getElementById("fatal-reload")?.addEventListener("click", () => location.reload());

const reducedMotionPref = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const firstLoad = loadSave(localStorage, reducedMotionPref);
let startupNotice = "";
if (firstLoad.status === "new") {
  // First run on this origin: pick up the prototype's save if it is reachable. The legacy key is only read, never changed.
  const r = importLegacyFromStorage(localStorage);
  if (r.status !== "absent") startupNotice = describeImport(r).text;
}
let save: SaveData = (startupNotice ? loadSave(localStorage, reducedMotionPref) : firstLoad).data;
const input = new InputState();
const quest = new QuestState(testQuest, save.quests[testQuest.id]);

let mode: Mode = "title";
let message = "";
let pos = { x: testRoom.spawn.x, y: testRoom.spawn.y };
let flags = new Set<string>(quest.snapshot().flags);
let collected = new Set<string>(quest.isComplete("get-key") ? ["key-brass"] : []);
let grid = CollisionGrid.fromStage(testRoom, flags);
let scale = 1;

const persist = (): void => {
  save = { ...save, quests: { ...save.quests, [testQuest.id]: quest.snapshot() } };
  writeSave(localStorage, save);
};

function resize(): void {
  scale = integerScale(window.innerWidth, window.innerHeight);
  canvas.width = VIEW_W * scale; canvas.height = VIEW_H * scale;
  canvas.style.width = `${VIEW_W * scale}px`; canvas.style.height = `${VIEW_H * scale}px`;
  input.releaseAll(); // resizing must never leave a direction stuck
}
window.addEventListener("resize", resize);
resize();

function setMode(m: Mode): void {
  mode = m;
  input.releaseAll();
  titleBar.style.display = m === "title" ? "flex" : "none";
}

function startGame(): void {
  const safe = findSafeSpawn(grid, testRoom.spawn);
  pos = safe ?? { ...testRoom.spawn };
  setMode("play");
}

function nearest(): Interactable | null {
  let best: Interactable | null = null, bestD = INTERACT_RANGE;
  for (const i of testRoom.interactables) {
    if (i.kind === "item" && collected.has(i.id)) continue;
    if (i.kind === "gate" && i.opensWith && flags.has(i.opensWith)) continue;
    const d = Math.hypot(i.at.x + 0.5 - pos.x, i.at.y + 0.5 - pos.y);
    if (d < bestD) { best = i; bestD = d; }
  }
  return best;
}

function activate(i: Interactable): void {
  switch (i.kind) {
    case "item": {
      collected.add(i.id);
      const done = quest.dispatch({ type: "collect", target: i.id });
      flags = new Set(quest.snapshot().flags);
      grid = CollisionGrid.fromStage(testRoom, flags);
      message = done.length ? "Kunci kuningan diambil. Gerbang barat terbuka." : "Sudah diambil.";
      break;
    }
    case "sign": quest.dispatch({ type: "inspect", target: i.id }); message = "Papan: (uji fondasi) tanda ini dibaca."; break;
    case "npc": message = "Pedagang: (placeholder dialog — sistem dialog belum dibuat, KM-041)."; break;
    case "gate": message = "Gerbang terkunci. Cari kuncinya."; break;
    case "exit": {
      const done = quest.dispatch({ type: "reach", target: i.id });
      message = done.length ? "Pintu keluar tercapai. Uji fondasi selesai." : "Baca papan di ruang barat dulu.";
      break;
    }
    default: message = ""; break;
  }
  persist();
  if (message) setMode("message");
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp so a background tab can't teleport the player
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function update(dt: number): void {
  if (input.consume("pause")) {
    if (mode === "play") setMode("paused");
    else if (mode === "paused") setMode("play");
    else if (mode === "message") setMode("play");
    return;
  }
  if (mode === "title") { if (input.consume("interact")) startGame(); return; }
  if (mode === "message") { if (input.consume("interact")) setMode("play"); return; }
  if (mode === "paused") return;
  const a = input.axis();
  if (a.x !== 0 || a.y !== 0) {
    const len = Math.hypot(a.x, a.y);
    pos = moveWithCollision(grid, pos, (a.x / len) * SPEED * dt, (a.y / len) * SPEED * dt);
  }
  if (input.consume("interact")) { const t = nearest(); if (t) activate(t); }
}

function text(s: string, x: number, y: number, size = 8, colour = "#f4e6c8"): void {
  ctx.fillStyle = colour; ctx.font = `${size}px monospace`; ctx.textBaseline = "top"; ctx.fillText(s, x, y);
}

function draw(): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#1a110a"; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (mode === "title") {
    text("KALIMAH MAZE", 96, 54, 16);
    text("Chronicles of the Lost Bazaar", 78, 76);
    text("Tekan E / Enter / Space atau ketuk Mulai", 52, 100);
    text("(adegan uji fondasi — bukan Morning Market)", 52, 116, 8, "#c9a76b");
    if (startupNotice) text(startupNotice.slice(0, 64), 8, VIEW_H - 12, 6, "#c9a76b");
    return;
  }
  const cam = cameraFor(testRoom, pos.x, pos.y);
  drawStage(ctx, testRoom, cam, flags, collected);
  drawPlayer(ctx, cam, pos.x, pos.y);
  const near = mode === "play" ? nearest() : null;
  if (near) text(`[E] ${near.id}`, 6, VIEW_H - 14);
  const active = quest.activeObjectives().map((o) => o.id).join(", ") || "selesai";
  text(`Tujuan: ${active}`, 6, 4, 8);
  if (mode === "message" || mode === "paused") {
    ctx.fillStyle = "rgba(26,17,10,0.85)"; ctx.fillRect(16, 60, VIEW_W - 32, 60);
    text(mode === "paused" ? "JEDA — tekan Esc / P untuk lanjut" : message, 24, 84);
  }
}

window.addEventListener("keydown", (e) => { if (input.keyDown(e.code)) e.preventDefault(); });
window.addEventListener("keyup", (e) => input.keyUp(e.code));
window.addEventListener("blur", () => { input.releaseAll(); if (mode === "play") setMode("paused"); });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "play") setMode("paused"); });

// ---- Touch controls (DOM, so they get focus/semantics and respect safe areas) ----
function buildTouchControls(): void {
  if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;
  const s = save.settings;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
  const size = Math.round(120 * s.joystickSize);
  const side = s.leftHanded ? "right" : "left";
  const other = s.leftHanded ? "left" : "right";
  const pad = document.createElement("div");
  pad.style.cssText = `position:absolute;${side}:16px;bottom:16px;width:${size}px;height:${size}px;border-radius:50%;background:rgba(244,230,200,${s.joystickOpacity * 0.35});border:2px solid rgba(244,230,200,${s.joystickOpacity});pointer-events:auto;touch-action:none;`;
  pad.setAttribute("aria-label", "Joystick gerak");
  const apply = (e: PointerEvent): void => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const dead = r.width * 0.12;
    input.setHeld("left", dx < -dead); input.setHeld("right", dx > dead);
    input.setHeld("up", dy < -dead); input.setHeld("down", dy > dead);
  };
  const release = (): void => { (["left", "right", "up", "down"] as const).forEach((a) => input.setHeld(a, false)); };
  pad.addEventListener("pointerdown", (e) => { pad.setPointerCapture(e.pointerId); apply(e); });
  pad.addEventListener("pointermove", (e) => { if (pad.hasPointerCapture(e.pointerId)) apply(e); });
  pad.addEventListener("pointerup", release); pad.addEventListener("pointercancel", release);
  const btn = (label: string, aria: string, bottom: number, onTap: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-label", aria);
    b.style.cssText = `position:absolute;${other}:16px;bottom:${bottom}px;min-width:64px;min-height:64px;border-radius:50%;font:bold 16px system-ui;background:rgba(244,230,200,0.85);color:#2b1d12;border:2px solid #2b1d12;pointer-events:auto;touch-action:manipulation;`;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); onTap(); });
    return b;
  };
  wrap.append(
    pad,
    btn("E", "Interaksi", 16, () => { input.setHeld("interact", true); input.setHeld("interact", false); }),
    btn("II", "Jeda", 96, () => { input.setHeld("pause", true); input.setHeld("pause", false); }),
  );
  document.body.append(wrap);
  canvas.addEventListener("pointerdown", () => { if (mode === "title") startGame(); });
}
buildTouchControls();

// ---- Title-screen DOM controls (Start / Reset with confirmation) ----
const titleBar = document.createElement("div");
titleBar.style.cssText = "position:fixed;left:0;right:0;top:calc(50% + 40px);display:flex;gap:12px;justify-content:center;z-index:2;";
const mk = (label: string, fn: () => void): HTMLButtonElement => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label; b.style.cssText = "font:inherit;min-height:44px;padding:8px 18px;";
  b.addEventListener("click", fn); return b;
};
const openImport = createImportDialog(localStorage);
titleBar.append(
  mk("Mulai", startGame),
  mk("Impor / ekspor", openImport),
  mk("Hapus progres", () => {
    if (confirm("Hapus semua progres tersimpan? Tindakan ini tidak dapat dibatalkan.")) { resetSave(localStorage); location.reload(); }
  }),
);
document.body.append(titleBar);
requestAnimationFrame(frame);
