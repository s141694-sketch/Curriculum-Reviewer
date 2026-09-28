// Seeded-error generator for evaluating the language agent without a human
// expert: take a (mostly) clean text, plant realistic spelling errors at known
// places, and keep an answer key. Because we know exactly which errors exist,
// the agent's precision and recall can be measured automatically.

export type SeedErrorType =
  | "ar_taa_marbuta" // ة -> ه at word end (الخلية -> الخليه)
  | "ar_hamza" // أ/إ/آ -> ا (أن -> ان)
  | "ar_alif_maqsura" // ى <-> ي at word end (على -> علي)
  | "swap" // adjacent letters swapped (typo)
  | "drop" // one letter dropped (typo)
  | "double"; // one letter doubled (typo)

export interface SeededError {
  id: number;
  type: SeedErrorType;
  lang: "ar" | "en";
  /** The correct word as it was in the clean text. */
  correct: string;
  /** The misspelled word planted in the seeded text. */
  erroneous: string;
  /** Character offset of `erroneous` in the seeded text. */
  offset: number;
  /** Index inside `erroneous` where the change was made (for match checks). */
  changeIndex: number;
}

export interface SeedOptions {
  /** Planted errors per 1,000 words (default 8). */
  per1k?: number;
  /** PRNG seed, so the same input always produces the same test set. */
  seed?: number;
  /** Restrict to some error types. */
  types?: SeedErrorType[];
}

export interface SeedResult {
  text: string;
  errors: SeededError[];
  wordCount: number;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARABIC_WORD = /^[ء-ي]+$/;
const LATIN_WORD = /^[A-Za-z]+$/;

interface Mutation {
  word: string;
  changeIndex: number;
}

/** Apply one mutation of `type`, or return null if it does not apply to this word. */
export function mutate(word: string, type: SeedErrorType, random: () => number): Mutation | null {
  const last = word.length - 1;
  switch (type) {
    case "ar_taa_marbuta":
      return word.endsWith("ة") ? { word: word.slice(0, -1) + "ه", changeIndex: last } : null;
    case "ar_alif_maqsura":
      if (word.endsWith("ى")) return { word: word.slice(0, -1) + "ي", changeIndex: last };
      return null;
    case "ar_hamza": {
      const index = word.search(/[أإآ]/);
      return index === -1
        ? null
        : { word: word.slice(0, index) + "ا" + word.slice(index + 1), changeIndex: index };
    }
    case "swap": {
      // Swap two different adjacent letters away from the first letter.
      const candidates: number[] = [];
      for (let i = 1; i < last; i++) if (word[i] !== word[i + 1]) candidates.push(i);
      if (!candidates.length) return null;
      const i = candidates[Math.floor(random() * candidates.length)];
      return { word: word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2), changeIndex: i };
    }
    case "drop": {
      if (word.length < 5) return null;
      const i = 1 + Math.floor(random() * (word.length - 2));
      return { word: word.slice(0, i) + word.slice(i + 1), changeIndex: Math.min(i, word.length - 2) };
    }
    case "double": {
      const i = 1 + Math.floor(random() * (word.length - 2));
      return { word: word.slice(0, i + 1) + word[i] + word.slice(i + 1), changeIndex: i };
    }
  }
}

/** Fisher-Yates shuffle (returns a copy). */
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ARABIC_TYPES: SeedErrorType[] = ["ar_taa_marbuta", "ar_hamza", "ar_alif_maqsura", "swap", "drop", "double"];
const LATIN_TYPES: SeedErrorType[] = ["swap", "drop", "double"];

export function seedErrors(text: string, options: SeedOptions = {}): SeedResult {
  const random = rng(options.seed ?? 42);
  const per1k = options.per1k ?? 8;
  const allowed = new Set(options.types ?? ARABIC_TYPES);

  // Tokens with their offsets; only plain letter-words (no diacritics/digits) are eligible.
  const tokens = [...text.matchAll(/[\p{L}\p{M}]+/gu)].map((m) => ({ word: m[0], offset: m.index! }));
  const vocabulary = new Set(tokens.map((t) => t.word));
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const target = Math.max(1, Math.round((wordCount / 1000) * per1k));

  const eligible = tokens.filter(
    (t) => t.word.length >= 4 && (ARABIC_WORD.test(t.word) || LATIN_WORD.test(t.word)),
  );

  // Shuffle, then take words until the target is met, keeping errors apart.
  const candidates = shuffle(eligible, random);

  const chosen: { offset: number; word: string; type: SeedErrorType; mutation: Mutation; lang: "ar" | "en" }[] = [];
  for (const token of candidates) {
    if (chosen.length >= target) break;
    if (chosen.some((c) => Math.abs(c.offset - token.offset) < 40)) continue;

    const lang = ARABIC_WORD.test(token.word) ? "ar" : "en";
    const types = (lang === "ar" ? ARABIC_TYPES : LATIN_TYPES).filter((t) => allowed.has(t));
    // For Arabic, try the Arabic-specific errors (ة/ه، ى/ي، همزة) first 60% of the time:
    // they are the most common real mistakes, but typos should still be represented.
    const shuffled = shuffle(types, random);
    const ordered =
      random() < 0.6 ? [...shuffled.filter((t) => t.startsWith("ar_")), ...shuffled.filter((t) => !t.startsWith("ar_"))] : shuffled;
    for (const type of ordered) {
      const mutation = mutate(token.word, type, random);
      // Skip mutations that produce another real word from this text (ambiguous answer key).
      if (mutation && mutation.word !== token.word && !vocabulary.has(mutation.word)) {
        chosen.push({ offset: token.offset, word: token.word, type, mutation, lang });
        break;
      }
    }
  }

  // Rebuild the text in offset order, tracking the shift introduced by length changes.
  chosen.sort((a, b) => a.offset - b.offset);
  let output = "";
  let cursor = 0;
  const errors: SeededError[] = [];
  for (const [index, c] of chosen.entries()) {
    output += text.slice(cursor, c.offset);
    errors.push({
      id: index + 1,
      type: c.type,
      lang: c.lang,
      correct: c.word,
      erroneous: c.mutation.word,
      offset: output.length,
      changeIndex: c.mutation.changeIndex,
    });
    output += c.mutation.word;
    cursor = c.offset + c.word.length;
  }
  output += text.slice(cursor);

  return { text: output, errors, wordCount };
}
