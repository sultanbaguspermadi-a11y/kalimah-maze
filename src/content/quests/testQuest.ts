import type { QuestDef } from "../../core/types";

/** Foundation fixture quest exercising collect -> inspect -> reach through real interactions. */
export const testQuest: QuestDef = {
  id: "q-foundation",
  title: "Uji fondasi",
  objectives: [
    { id: "get-key", type: "collect", target: "key-brass", setsFlag: "has-brass-key" },
    { id: "read-sign", type: "inspect", target: "sign-1", requires: ["get-key"] },
    { id: "leave", type: "reach", target: "exit-door", requires: ["read-sign"] },
  ],
};
