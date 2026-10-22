/**
 * Arabic answer normalization with an explicit policy per exercise (KM-051).
 * Policies never equate distinct letters unless documented below.
 */
export type NormalizationPolicy = "strict" | "ignoreTashkeel" | "lenient";

// Harakat, tanwin, shadda, sukun, dagger alef (U+064B–U+0652, U+0670).
const TASHKEEL = /[\u064B-\u0652\u0670]/g;
const TATWEEL = /\u0640/g;
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/g; // آ أ إ ٱ -> ا

export function normalizeArabic(input: string, policy: NormalizationPolicy): string {
  // NFC + whitespace collapse apply to every policy: they never change linguistic content.
  let s = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (policy === "strict") return s;
  s = s.replace(TASHKEEL, "").replace(TATWEEL, "");
  if (policy === "lenient") s = s.replace(ALEF_VARIANTS, "\u0627");
  // Deliberately NOT unified in any policy: ة/ه, ى/ي, و/ؤ, ء carriers other than alef.
  return s;
}

export function answersMatch(given: string, accepted: readonly string[], policy: NormalizationPolicy): boolean {
  const g = normalizeArabic(given, policy);
  return accepted.some((a) => normalizeArabic(a, policy) === g);
}
