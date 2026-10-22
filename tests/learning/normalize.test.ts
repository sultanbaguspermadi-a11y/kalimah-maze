import { describe, expect, it } from "vitest";
import { answersMatch, normalizeArabic } from "../../src/learning/normalize";

describe("normalizeArabic", () => {
  it("strict keeps tashkeel but collapses whitespace", () => {
    expect(normalizeArabic("  كَتَبَ   الطَّالِبُ ", "strict")).toBe("كَتَبَ الطَّالِبُ");
    expect(normalizeArabic("كَتَبَ", "strict")).not.toBe(normalizeArabic("كتب", "strict"));
  });

  it("ignoreTashkeel strips harakat, shadda, tanwin and tatweel only", () => {
    expect(normalizeArabic("الطَّالِبُ", "ignoreTashkeel")).toBe("الطالب");
    expect(normalizeArabic("كِتَابًا", "ignoreTashkeel")).toBe("كتابا");
    expect(normalizeArabic("كـتـاب", "ignoreTashkeel")).toBe("كتاب");
    // alef variants are NOT merged under this policy
    expect(normalizeArabic("أَكَلَ", "ignoreTashkeel")).not.toBe(normalizeArabic("اكل", "ignoreTashkeel"));
  });

  it("lenient merges alef-hamza variants but never ة/ه or ى/ي", () => {
    expect(normalizeArabic("أكل", "lenient")).toBe(normalizeArabic("اكل", "lenient"));
    expect(normalizeArabic("إسلام", "lenient")).toBe("اسلام");
    expect(normalizeArabic("مدرسة", "lenient")).not.toBe(normalizeArabic("مدرسه", "lenient"));
    expect(normalizeArabic("على", "lenient")).not.toBe(normalizeArabic("علي", "lenient"));
  });

  it("sarf-style distinction: strict tells apart forms differing only by shadda", () => {
    expect(answersMatch("عَلَمَ", ["عَلَّمَ"], "strict")).toBe(false);
    expect(answersMatch("عَلَمَ", ["عَلَّمَ"], "ignoreTashkeel")).toBe(true); // use only where vowelling is not the tested point
  });

  it("matches against any accepted variant", () => {
    expect(answersMatch("الكتاب", ["الْكِتَابُ", "كتاب"], "ignoreTashkeel")).toBe(true);
    expect(answersMatch("قلم", ["الْكِتَابُ"], "ignoreTashkeel")).toBe(false);
  });
});
