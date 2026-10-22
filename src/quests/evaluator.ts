import type { GameEvent, ObjectiveDef, QuestDef } from "../core/types";

export interface QuestProgress { completed: string[]; flags: string[] }

/** Deterministic objective evaluator (KM-033). Unrelated events never complete an objective. */
export class QuestState {
  private done: Set<string>;
  private flags: Set<string>;

  constructor(readonly quest: QuestDef, saved?: QuestProgress) {
    const known = new Set(quest.objectives.map((o) => o.id));
    // Saved ids that no longer exist (content changed) are dropped rather than trusted.
    this.done = new Set((saved?.completed ?? []).filter((id) => known.has(id)));
    this.flags = new Set(saved?.flags ?? []);
  }

  isComplete(objectiveId: string): boolean { return this.done.has(objectiveId); }
  hasFlag(f: string): boolean { return this.flags.has(f); }

  /** Objective is active when not done and every prerequisite is done. */
  isActive(o: ObjectiveDef): boolean {
    return !this.done.has(o.id) && (o.requires ?? []).every((r) => this.done.has(r));
  }

  activeObjectives(): ObjectiveDef[] { return this.quest.objectives.filter((o) => this.isActive(o)); }

  /**
   * Returns ids completed by this event, in declaration order.
   * Eligibility is decided before any completion, so one event can never cascade through a
   * prerequisite chain (A then B on the same target needs two separate events).
   */
  dispatch(ev: GameEvent): string[] {
    const eligible = this.quest.objectives.filter(
      (o) => o.type === ev.type && o.target === ev.target && this.isActive(o),
    );
    for (const o of eligible) {
      this.done.add(o.id);
      if (o.setsFlag) this.flags.add(o.setsFlag);
    }
    return eligible.map((o) => o.id);
  }

  isQuestComplete(): boolean {
    return this.quest.objectives.filter((o) => !o.optional).every((o) => this.done.has(o.id));
  }

  snapshot(): QuestProgress { return { completed: [...this.done], flags: [...this.flags] }; }
}
