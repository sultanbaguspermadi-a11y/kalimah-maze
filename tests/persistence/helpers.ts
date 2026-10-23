import type { KeyValueStore } from "../../src/persistence/save";

export class MemStore implements KeyValueStore {
  m = new Map<string, string>();
  writes: string[] = [];
  removes: string[] = [];
  failWriteFor: string | null = null;
  mangleWriteFor: string | null = null;
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void {
    if (this.failWriteFor === k) throw new Error("QuotaExceededError");
    this.writes.push(k);
    if (this.mangleWriteFor === k) { this.mangleWriteFor = null; this.m.set(k, v.slice(0, -5)); return; } // corrupt the first write only
    this.m.set(k, v);
  }
  removeItem(k: string): void { this.removes.push(k); this.m.delete(k); }
}

/**
 * SYNTHETIC legacy save built from the prototype's real schema (read from Kalimah_Maze_WordGate.html:
 * `{v, lex:{id:{ok,no,dirs,rounds,last}}, nq:{id:{ok,no,last}}, words:[], best:{"diff/mode":n}, set:{...}, diff, mode, theme}`).
 * It is not a capture of a real player's data.
 */
export function legacyFixture(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 2,
    lex: {
      w0: { ok: 4, no: 1, dirs: 3, rounds: ["r1", "r2", "r3"], last: 1_700_000_000_000 }, // prototype "Mastered"
      w1: { ok: 2, no: 0, dirs: 1, rounds: ["r1"], last: 1_700_000_100_000 },              // recall
      w2: { ok: 0, no: 2, dirs: 0, rounds: [], last: 0 },                                  // discovered only
      w6: { ok: 3, no: 0, dirs: 3, rounds: ["r1", "r2"], last: 1_700_000_200_000 },        // reverse
    },
    nq: { n1: { ok: 3, no: 1, last: 1_700_000_300_000 }, n9: { ok: 1, no: 2, last: 1_700_000_400_000 } },
    words: ["w0", "w1", "w2", "w6"],
    best: { "normal/adv": 1200, "hard/nahwu": 800 },
    set: { lang: "en", vm: 70, vmu: 40, vs: 90, mt: 1, snd: 1, mus: 0, rm: 1, ar: 2, ctl: "swipe", th: "dark", tr: 0, lh: 1 },
    diff: "tricky", mode: "nahwu", theme: "tech",
    ...over,
  };
}
export const legacyText = (over: Record<string, unknown> = {}): string => JSON.stringify(legacyFixture(over));
