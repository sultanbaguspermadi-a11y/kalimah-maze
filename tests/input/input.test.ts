import { describe, expect, it } from "vitest";
import { InputState } from "../../src/input/actions";

describe("InputState", () => {
  it("maps keyboard and virtual controls to the same actions", () => {
    const i = new InputState();
    i.keyDown("KeyW");
    expect(i.axis()).toEqual({ x: 0, y: -1 });
    i.keyUp("KeyW");
    i.setHeld("right", true);
    expect(i.axis()).toEqual({ x: 1, y: 0 });
  });

  it("opposite directions cancel", () => {
    const i = new InputState();
    i.keyDown("KeyA"); i.keyDown("KeyD");
    expect(i.axis().x).toBe(0);
  });

  it("press is consumed once", () => {
    const i = new InputState();
    i.keyDown("KeyE");
    expect(i.consume("interact")).toBe(true);
    expect(i.consume("interact")).toBe(false);
  });

  it("releaseAll clears held and pending presses (no stuck input after pause/resize)", () => {
    const i = new InputState();
    i.keyDown("KeyD"); i.keyDown("KeyE");
    i.releaseAll();
    expect(i.axis()).toEqual({ x: 0, y: 0 });
    expect(i.consume("interact")).toBe(false);
  });

  it("supports remapping and ignores unbound keys", () => {
    const i = new InputState();
    expect(i.keyDown("KeyZ")).toBe(false);
    i.setBindings({ ...{ up: ["KeyI"], down: ["KeyK"], left: ["KeyJ"], right: ["KeyL"], interact: ["KeyZ"], pause: ["Escape"], journal: ["Tab"] } });
    expect(i.keyDown("KeyZ")).toBe(true);
    expect(i.consume("interact")).toBe(true);
    expect(i.keyDown("KeyW")).toBe(false);
  });
});
