// Text helpers shared by the agents, the pipeline and the evaluation tools.

/**
 * Normalise for tolerant comparisons: Unicode compatibility forms, Arabic
 * diacritics and tatweel, quotes, whitespace and case. Deliberately does NOT
 * merge letters such as ة/ه, ى/ي or أ/ا, because those are real spelling errors.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[“”«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when `quote` appears (after normalisation) inside `source`. */
export function appearsIn(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length > 0 && normalizeForMatch(source).includes(q);
}

/** Split normalised text into word tokens (Arabic or Latin letters and digits). */
export function wordTokens(text: string): string[] {
  return normalizeForMatch(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
