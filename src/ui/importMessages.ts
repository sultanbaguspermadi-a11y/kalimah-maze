import type { FileImportResult } from "../persistence/importExport";
import type { ImportOutcome } from "../persistence/legacyMigration";

/** Plain-language (Indonesian) result text; kept pure so it is unit-tested. */
export function describeImport(r: FileImportResult | ImportOutcome): { ok: boolean; text: string } {
  switch (r.status) {
    case "restored": return { ok: true, text: "Progres berhasil dipulihkan. Progres sebelumnya disimpan sebagai cadangan." };
    case "legacy-imported":
    case "imported": {
      const s = r.summary;
      const dropped = r.dropped.length ? ` ${r.dropped.length} entri tidak dapat dibawa dan dilewati.` : "";
      return { ok: true, text: `Progres lama diimpor: ${s.discoveredWords} kata ditemukan, ${s.lexiconEntries} statistik kata, ${s.nahwuEntries} statistik nahwu, ${s.bestScores} skor terbaik.${dropped} Data lama tidak diubah.` };
    }
    case "already-imported": return { ok: true, text: "Data ini sudah pernah diimpor; tidak ada yang berubah." };
    case "absent": return { ok: false, text: "Tidak ada progres lama di penyimpanan peramban ini. Jika game lama dibuka dari alamat/peramban lain, salin datanya lalu tempel di bawah." };
    case "unusable": return { ok: false, text: `Data tidak dapat digunakan: ${r.reason}. Tidak ada yang diubah.` };
    case "failed": return { ok: false, text: `Impor gagal: ${r.reason}. Progres Anda tidak diubah.` };
  }
}
