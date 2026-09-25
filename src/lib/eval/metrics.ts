// Scoring the agents against known answers. Pure functions, no model calls.

import { normalizeForMatch, wordTokens } from "@/lib/text";
import type { AlignmentStatus, LanguageIssue, StandardAlignment } from "@/types/review";
import type { SeededError, SeedErrorType } from "@/lib/eval/seed";

// ---------------------------------------------------------------------------
// Language agent: detection of planted spelling errors.

/**
 * Does a reported issue point at this planted error? The agent may quote the
 * word with or without attached prefixes (و، ب، ال...) or with neighbouring
 * words, so we accept any quoted token that overlaps the changed letter.
 */
export function issueMatchesError(issue: Pick<LanguageIssue, "original">, error: SeededError): boolean {
  const erroneous = normalizeForMatch(error.erroneous);
  for (const token of wordTokens(issue.original)) {
    if (token === erroneous) return true;
    if (token.length >= 3 && token.includes(erroneous)) return true;
    // Token is a piece of the erroneous word (e.g. without the و prefix): it must cover the change.
    if (token.length >= 3) {
      let from = erroneous.indexOf(token);
      while (from !== -1) {
        if (from <= error.changeIndex && error.changeIndex < from + token.length) return true;
        from = erroneous.indexOf(token, from + 1);
      }
    }
  }
  return false;
}

/** Was the suggested correction right (contains the original correct word)? */
export function suggestionIsCorrect(issue: Pick<LanguageIssue, "suggestion">, error: SeededError): boolean {
  const correct = normalizeForMatch(error.correct);
  return wordTokens(issue.suggestion).some(
    (token) =>
      token === correct ||
      // Suggestion kept or dropped a short attached prefix (و، ب، ل...).
      (token.length >= 3 &&
        (token.endsWith(correct) || (correct.endsWith(token) && correct.length - token.length <= 2))),
  );
}

export interface LanguageMetrics {
  /** Planted errors used for scoring (excludes `unreliable`). */
  planted: number;
  /**
   * Planted errors whose "correct" word the agent already flagged in the clean
   * text: the source word was probably wrong to begin with, so the answer key
   * is unreliable. Excluded from recall and precision.
   */
  unreliable: SeededError[];
  detected: number;
  corrected: number;
  /** Issues matching a planted error. */
  truePositives: number;
  /** Issues matching nothing planted and not already reported on the clean text. */
  falsePositives: number;
  /** Issues also reported on the clean text: probably real pre-existing errors, excluded from precision. */
  preExisting: number;
  precision: number;
  recall: number;
  f1: number;
  /** Share of detected errors whose suggested correction was right. */
  correctionAccuracy: number;
  recallByType: Partial<Record<SeedErrorType, { planted: number; detected: number; recall: number }>>;
  missed: SeededError[];
  falsePositiveIssues: LanguageIssue[];
}

function ratio(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/** Was this word flagged as an error in the clean text? */
function flaggedInClean(word: string, cleanIssues: LanguageIssue[]): boolean {
  const target = normalizeForMatch(word);
  return cleanIssues.some((issue) =>
    wordTokens(issue.original).some(
      (token) =>
        token === target ||
        (token.length >= target.length - 2 && token.length >= 3 && (target.includes(token) || token.includes(target))),
    ),
  );
}

export function scoreLanguage(
  allPlanted: SeededError[],
  seededIssues: LanguageIssue[],
  cleanIssues: LanguageIssue[] = [],
): LanguageMetrics {
  const cleanOriginals = new Set(cleanIssues.map((i) => normalizeForMatch(i.original)));
  const unreliable = allPlanted.filter((error) => flaggedInClean(error.correct, cleanIssues));
  const planted = allPlanted.filter((error) => !unreliable.includes(error));

  const detectedIds = new Set<number>();
  const correctedIds = new Set<number>();
  let truePositives = 0;
  let preExisting = 0;
  const falsePositiveIssues: LanguageIssue[] = [];

  for (const issue of seededIssues) {
    const matches = planted.filter((error) => issueMatchesError(issue, error));
    if (!matches.length && unreliable.some((error) => issueMatchesError(issue, error))) {
      preExisting++;
    } else if (matches.length) {
      truePositives++;
      for (const error of matches) {
        detectedIds.add(error.id);
        if (suggestionIsCorrect(issue, error)) correctedIds.add(error.id);
      }
    } else if (cleanOriginals.has(normalizeForMatch(issue.original))) {
      preExisting++;
    } else {
      falsePositiveIssues.push(issue);
    }
  }

  const precision = ratio(truePositives, truePositives + falsePositiveIssues.length);
  const recall = ratio(detectedIds.size, planted.length);

  const recallByType: LanguageMetrics["recallByType"] = {};
  for (const error of planted) {
    const entry = (recallByType[error.type] ??= { planted: 0, detected: 0, recall: 0 });
    entry.planted++;
    if (detectedIds.has(error.id)) entry.detected++;
  }
  for (const entry of Object.values(recallByType)) entry!.recall = ratio(entry!.detected, entry!.planted);

  return {
    planted: planted.length,
    unreliable,
    detected: detectedIds.size,
    corrected: correctedIds.size,
    truePositives,
    falsePositives: falsePositiveIssues.length,
    preExisting,
    precision,
    recall,
    f1: ratio(2 * precision * recall, precision + recall),
    correctionAccuracy: ratio(correctedIds.size, detectedIds.size),
    recallByType,
    missed: planted.filter((error) => !detectedIds.has(error.id)),
    falsePositiveIssues,
  };
}

// ---------------------------------------------------------------------------
// Standards agent: agreement with human (gold) labels.

export const ALIGNMENT_CLASSES: AlignmentStatus[] = ["met", "partial", "not_met"];

export interface AlignmentMetrics {
  compared: number;
  /** Codes in the gold file that the review does not contain. */
  missingCodes: string[];
  accuracy: number;
  /** Cohen's kappa: agreement corrected for chance (1 = perfect, 0 = chance level). */
  kappa: number;
  /** Quadratic-weighted kappa: treats met/partial/not_met as ordered, so near-misses cost less. */
  weightedKappa: number;
  /** confusion[gold][predicted] */
  confusion: Record<AlignmentStatus, Record<AlignmentStatus, number>>;
  disagreements: { code: string; gold: AlignmentStatus; predicted: AlignmentStatus }[];
}

export function scoreAlignment(
  predicted: StandardAlignment[],
  gold: Record<string, AlignmentStatus>,
): AlignmentMetrics {
  const byCode = new Map(predicted.map((a) => [a.code.trim(), a.status]));
  const confusion = Object.fromEntries(
    ALIGNMENT_CLASSES.map((g) => [g, Object.fromEntries(ALIGNMENT_CLASSES.map((p) => [p, 0]))]),
  ) as AlignmentMetrics["confusion"];

  const missingCodes: string[] = [];
  const disagreements: AlignmentMetrics["disagreements"] = [];
  let agree = 0;
  let n = 0;

  for (const [code, goldStatus] of Object.entries(gold)) {
    const predictedStatus = byCode.get(code.trim());
    if (!predictedStatus) {
      missingCodes.push(code);
      continue;
    }
    n++;
    confusion[goldStatus][predictedStatus]++;
    if (goldStatus === predictedStatus) agree++;
    else disagreements.push({ code, gold: goldStatus, predicted: predictedStatus });
  }

  return {
    compared: n,
    missingCodes,
    accuracy: ratio(agree, n),
    kappa: cohensKappa(confusion, n, (i, j) => (i === j ? 0 : 1)),
    weightedKappa: cohensKappa(confusion, n, (i, j) => ((i - j) / (ALIGNMENT_CLASSES.length - 1)) ** 2),
    confusion,
    disagreements,
  };
}

/**
 * Cohen's kappa from a confusion matrix; `weight(i, j)` is the disagreement
 * weight between classes i and j (0 on the diagonal).
 */
function cohensKappa(
  confusion: AlignmentMetrics["confusion"],
  n: number,
  weight: (i: number, j: number) => number,
): number {
  if (n === 0) return 0;
  const k = ALIGNMENT_CLASSES.length;
  const rows = ALIGNMENT_CLASSES.map((g) => ALIGNMENT_CLASSES.reduce((s, p) => s + confusion[g][p], 0));
  const cols = ALIGNMENT_CLASSES.map((p) => ALIGNMENT_CLASSES.reduce((s, g) => s + confusion[g][p], 0));

  let observed = 0;
  let expected = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = weight(i, j);
      observed += w * confusion[ALIGNMENT_CLASSES[i]][ALIGNMENT_CLASSES[j]];
      expected += (w * rows[i] * cols[j]) / n;
    }
  }
  if (expected === 0) return observed === 0 ? 1 : 0;
  return 1 - observed / expected;
}
