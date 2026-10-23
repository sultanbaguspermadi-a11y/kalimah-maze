import { LEGACY_EXPORT_SNIPPET, LEGACY_KEY, importLegacyFromStorage } from "../persistence/legacyMigration";
import { exportSave, importFromText } from "../persistence/importExport";
import { loadSave, type KeyValueStore } from "../persistence/save";
import { describeImport } from "./importMessages";

/** Builds the import/export dialog once; returns `open()`. Reloads the page after a successful change so all state is consistent. */
export function createImportDialog(store: KeyValueStore): () => void {
  const dlg = document.createElement("dialog");
  dlg.setAttribute("aria-labelledby", "imp-title");
  dlg.style.cssText = "max-width:min(560px,92vw);background:#2b1d12;color:#f4e6c8;border:2px solid #c9a76b;border-radius:8px;padding:16px;";
  dlg.innerHTML = `
    <h2 id="imp-title" style="margin:0 0 8px;font-size:1.1rem">Impor / ekspor progres</h2>
    <p style="margin:0 0 8px">Progres game lama (<code>${LEGACY_KEY}</code>) hanya bisa dibaca bila game lama pernah dibuka di alamat dan peramban yang sama.
    Jika tidak, buka game lama, jalankan di konsol: <code id="imp-snip"></code> lalu tempel hasilnya di bawah atau simpan sebagai berkas.</p>
    <label for="imp-file">Berkas (.json / .txt)</label><br>
    <input id="imp-file" type="file" accept="application/json,.json,.txt" style="margin:4px 0 8px;max-width:100%"><br>
    <label for="imp-paste">Atau tempel data</label><br>
    <textarea id="imp-paste" rows="5" style="width:100%;box-sizing:border-box;margin:4px 0 8px;font-family:monospace"></textarea>
    <p id="imp-status" role="status" aria-live="polite" style="min-height:2.4em;margin:0 0 8px"></p>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button type="button" id="imp-old">Impor dari penyimpanan lama</button>
      <button type="button" id="imp-go">Impor data yang ditempel / dipilih</button>
      <button type="button" id="imp-export">Ekspor progres</button>
      <button type="button" id="imp-close">Tutup</button>
    </div>`;
  document.body.append(dlg);
  dlg.querySelectorAll("button").forEach((b) => { (b as HTMLElement).style.cssText = "font:inherit;min-height:44px;padding:8px 14px;"; });
  (dlg.querySelector("#imp-snip") as HTMLElement).textContent = LEGACY_EXPORT_SNIPPET;

  const status = dlg.querySelector("#imp-status") as HTMLElement;
  const paste = dlg.querySelector("#imp-paste") as HTMLTextAreaElement;
  const file = dlg.querySelector("#imp-file") as HTMLInputElement;
  const show = (r: Parameters<typeof describeImport>[0]): void => {
    const d = describeImport(r);
    status.textContent = d.text;
    if (d.ok && r.status !== "already-imported" && r.status !== "absent") setTimeout(() => location.reload(), 1500);
  };

  dlg.querySelector("#imp-old")?.addEventListener("click", () => show(importLegacyFromStorage(store)));
  dlg.querySelector("#imp-go")?.addEventListener("click", () => {
    const f = file.files?.[0];
    if (f) { void f.text().then((t) => show(importFromText(store, t, "file")), () => { status.textContent = "Berkas tidak dapat dibaca."; }); return; }
    if (!paste.value.trim()) { status.textContent = "Pilih berkas atau tempel data terlebih dahulu."; return; }
    show(importFromText(store, paste.value, "paste"));
  });
  dlg.querySelector("#imp-export")?.addEventListener("click", () => {
    const blob = new Blob([exportSave(loadSave(store).data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kalimah-maze-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  dlg.querySelector("#imp-close")?.addEventListener("click", () => dlg.close());
  return () => { status.textContent = ""; if (!dlg.open) dlg.showModal(); };
}
