// Public-release content gate (KM-062 Arabic content review, KM-114 final content review).
// Exits non-zero until every item is expert-reviewed with documented evidence and has a recorded reference.
import { loadContentItems, loadSources, validateContentItems } from "../src/content/items";

const items = loadContentItems();
const issues = validateContentItems(items, loadSources(), true).filter((i) => i.severity === "error");
const reviewed = items.filter((i) => i.review.status === "reviewed").length;
const byWhere = new Map<string, string[]>();
for (const i of issues) byWhere.set(i.where, [...(byWhere.get(i.where) ?? []), i.message]);

console.log(`Content items: ${items.length}; expert-reviewed with evidence: ${reviewed}; blocked items: ${byWhere.size}`);
for (const [where, msgs] of [...byWhere].slice(0, 10)) console.log(`  ${where}: ${msgs.join("; ")}`);
if (byWhere.size > 10) console.log(`  ... and ${byWhere.size - 10} more (run npm run export:review for the full list)`);
if (issues.length) {
  console.error("\nRELEASE BLOCKED: KM-062 / KM-114 are OPEN. No academic sign-off exists. Do not publish.");
  process.exit(1);
}
console.log("\nContent gate satisfied (all items reviewed with evidence and references).");
