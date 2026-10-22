import { describe, expect, it } from "vitest";
import { QuestState } from "../../src/quests/evaluator";
import { validateQuest } from "../../src/content/validate";
import type { QuestDef } from "../../src/core/types";

const quest: QuestDef = {
  id: "q-test",
  title: "Test",
  objectives: [
    { id: "talk", type: "talk", target: "npc-a" },
    { id: "collect", type: "collect", target: "item-x", requires: ["talk"], setsFlag: "has-x" },
    { id: "deliver", type: "deliver", target: "npc-a", requires: ["collect"] },
    { id: "bonus", type: "inspect", target: "sign-1", optional: true },
  ],
};

describe("QuestState", () => {
  it("is valid content", () => expect(validateQuest(quest)).toEqual([]));

  it("ignores unrelated events and out-of-order events", () => {
    const q = new QuestState(quest);
    expect(q.dispatch({ type: "collect", target: "item-x" })).toEqual([]); // prerequisite not met
    expect(q.dispatch({ type: "talk", target: "npc-b" })).toEqual([]);
    expect(q.isComplete("talk")).toBe(false);
  });

  it("completes in order and sets flags", () => {
    const q = new QuestState(quest);
    q.dispatch({ type: "talk", target: "npc-a" });
    q.dispatch({ type: "collect", target: "item-x" });
    expect(q.hasFlag("has-x")).toBe(true);
    expect(q.isQuestComplete()).toBe(false);
    q.dispatch({ type: "deliver", target: "npc-a" });
    expect(q.isQuestComplete()).toBe(true); // optional "bonus" not required
  });

  it("does not cascade through a chain on a single event", () => {
    const chained: QuestDef = { id: "c", title: "c", objectives: [
      { id: "a", type: "talk", target: "n" },
      { id: "b", type: "talk", target: "n", requires: ["a"] },
    ] };
    const q = new QuestState(chained);
    expect(q.dispatch({ type: "talk", target: "n" })).toEqual(["a"]);
    expect(q.dispatch({ type: "talk", target: "n" })).toEqual(["b"]);
  });

  it("repeating a completed event does nothing (no duplicate rewards)", () => {
    const q = new QuestState(quest);
    q.dispatch({ type: "talk", target: "npc-a" });
    expect(q.dispatch({ type: "talk", target: "npc-a" })).toEqual([]);
  });

  it("restores from a snapshot and drops unknown objective ids", () => {
    const q = new QuestState(quest, { completed: ["talk", "removed-objective"], flags: [] });
    expect(q.isComplete("talk")).toBe(true);
    expect(q.snapshot().completed).toEqual(["talk"]);
    expect(q.activeObjectives().map((o) => o.id)).toContain("collect");
  });
});

describe("validateQuest", () => {
  it("catches unknown prerequisites, cycles, self-reference and duplicates", () => {
    const bad: QuestDef = { id: "bad", title: "bad", objectives: [
      { id: "a", type: "talk", target: "x", requires: ["b"] },
      { id: "b", type: "talk", target: "y", requires: ["a"] },
      { id: "c", type: "talk", target: "z", requires: ["nope", "c"] },
      { id: "c", type: "talk", target: "z" },
    ] };
    const m = validateQuest(bad).map((i) => i.message);
    expect(m).toContain("prerequisite cycle");
    expect(m).toContain('unknown prerequisite "nope"');
    expect(m).toContain("objective requires itself");
    expect(m).toContain("duplicate objective id");
  });

  it("requires at least one mandatory objective", () => {
    const q: QuestDef = { id: "o", title: "o", objectives: [{ id: "a", type: "talk", target: "x", optional: true }] };
    expect(validateQuest(q).map((i) => i.message)).toContain("no mandatory objective");
  });
});
