/** Gameplay talks only to Actions; devices map into them (KM-012). */
export type Action = "up" | "down" | "left" | "right" | "interact" | "pause" | "journal";

export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  interact: ["KeyE", "Enter", "Space"],
  pause: ["Escape", "KeyP"],
  journal: ["KeyJ"],
};

/** Device-agnostic input state. Keyboard, joystick and D-pad all write here. */
export class InputState {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private bindings: Bindings;
  private codeToActions = new Map<string, Action[]>();

  constructor(bindings: Bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.rebuild();
  }

  setBindings(b: Bindings): void { this.bindings = b; this.rebuild(); }

  private rebuild(): void {
    this.codeToActions.clear();
    for (const [action, codes] of Object.entries(this.bindings) as [Action, string[]][]) {
      for (const c of codes) this.codeToActions.set(c, [...(this.codeToActions.get(c) ?? []), action]);
    }
  }

  /** Returns true if the code is bound (caller may preventDefault). */
  keyDown(code: string): boolean {
    const actions = this.codeToActions.get(code);
    if (!actions) return false;
    for (const a of actions) { if (!this.held.has(a)) this.pressed.add(a); this.held.add(a); }
    return true;
  }
  keyUp(code: string): void { for (const a of this.codeToActions.get(code) ?? []) this.held.delete(a); }

  /** Virtual controls (joystick/D-pad/buttons) call this. */
  setHeld(a: Action, on: boolean): void {
    if (on) { if (!this.held.has(a)) this.pressed.add(a); this.held.add(a); } else this.held.delete(a);
  }

  isHeld(a: Action): boolean { return this.held.has(a); }
  /** True once per press; consumed on read. */
  consume(a: Action): boolean { return this.pressed.delete(a); }

  /** Call on pause, dialogue open, blur, resize and stage transition so no input sticks. */
  releaseAll(): void { this.held.clear(); this.pressed.clear(); }

  /** Movement vector from held actions; opposite directions cancel. */
  axis(): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
    const x = (this.isHeld("right") ? 1 : 0) - (this.isHeld("left") ? 1 : 0);
    const y = (this.isHeld("down") ? 1 : 0) - (this.isHeld("up") ? 1 : 0);
    return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1 };
  }
}
