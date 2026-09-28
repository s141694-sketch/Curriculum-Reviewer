import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueMatchesError, scoreAlignment, scoreLanguage, suggestionIsCorrect } from "@/lib/eval/metrics";
import { mutate, rng, seedErrors, type SeededError } from "@/lib/eval/seed";
import type { LanguageIssue, StandardAlignment } from "@/types/review";

const ARABIC_TEXT = Array.from(
  { length: 40 },
  (_, i) =>
    `تتكون الخلية من غشاء ونواة، وأن الطالب يتعلم على مراحل متدرجة في الوحدة ${i + 1}. يقارن المتعلم بين الأنسجة المختلفة ويستنتج العلاقة بينها.`,
).join("\n");

function issue(original: string, suggestion: string): LanguageIssue {
  return {
    sectionIndex: 0,
    type: "spelling",
    original,
    suggestion,
    explanation: "",
    severity: "medium",
    verified: true,
  };
}

describe("seedErrors", () => {
  it("is deterministic for a given seed", () => {
    const a = seedErrors(ARABIC_TEXT, { seed: 7 });
    const b = seedErrors(ARABIC_TEXT, { seed: 7 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.errors, seedErrors(ARABIC_TEXT, { seed: 8 }).errors);
  });

  it("plants the requested density and records exact offsets", () => {
    const result = seedErrors(ARABIC_TEXT, { seed: 1, per1k: 20 });
    assert.equal(result.errors.length, Math.round((result.wordCount / 1000) * 20));
    for (const error of result.errors) {
      assert.equal(result.text.slice(error.offset, error.offset + error.erroneous.length), error.erroneous);
      assert.notEqual(error.erroneous, error.correct);
    }
  });

  it("only changes the planted words", () => {
    const result = seedErrors(ARABIC_TEXT, { seed: 3, per1k: 20 });
    let restored = result.text;
    for (const error of [...result.errors].reverse()) {
      restored = restored.slice(0, error.offset) + error.correct + restored.slice(error.offset + error.erroneous.length);
    }
    assert.equal(restored, ARABIC_TEXT);
  });

  it("applies Arabic-specific mutations", () => {
    const random = rng(1);
    assert.equal(mutate("الخلية", "ar_taa_marbuta", random)?.word, "الخليه");
    assert.equal(mutate("على", "ar_alif_maqsura", random)?.word, "علي");
    assert.equal(mutate("أن", "ar_hamza", random)?.word, "ان");
    assert.equal(mutate("الطالب", "ar_taa_marbuta", random), null);
  });
});

describe("scoreLanguage", () => {
  const planted: SeededError[] = [
    { id: 1, type: "ar_taa_marbuta", lang: "ar", correct: "والخلية", erroneous: "والخليه", offset: 0, changeIndex: 6 },
    { id: 2, type: "ar_hamza", lang: "ar", correct: "أن", erroneous: "ان", offset: 20, changeIndex: 0 },
    { id: 3, type: "swap", lang: "en", correct: "science", erroneous: "sceince", offset: 40, changeIndex: 2 },
  ];

  it("matches an issue quoted without the attached prefix, but not an unrelated fragment", () => {
    assert.ok(issueMatchesError(issue("الخليه", "الخلية"), planted[0]));
    assert.ok(issueMatchesError(issue("تتكون والخليه من", "x"), planted[0]));
    // "والخ" is part of the word but does not cover the changed letter.
    assert.ok(!issueMatchesError(issue("والخ", "x"), planted[0]));
    assert.ok(suggestionIsCorrect(issue("الخليه", "الخلية"), planted[0]));
    assert.ok(!suggestionIsCorrect(issue("الخليه", "الخلايا"), planted[0]));
  });

  it("computes precision, recall and excludes pre-existing issues", () => {
    const seededIssues = [
      issue("الخليه", "الخلية"), // TP, correct fix
      issue("sceince", "sciense"), // TP, wrong fix
      issue("كلمه", "كلمة"), // pre-existing (also flagged on clean text)
      issue("صحيح", "صحيح جدا"), // false positive
    ];
    const cleanIssues = [issue("كلمه", "كلمة")];
    const m = scoreLanguage(planted, seededIssues, cleanIssues);

    assert.equal(m.truePositives, 2);
    assert.equal(m.falsePositives, 1);
    assert.equal(m.preExisting, 1);
    assert.equal(m.detected, 2);
    assert.equal(m.corrected, 1);
    assert.equal(m.precision, 2 / 3);
    assert.equal(m.recall, 2 / 3);
    assert.equal(m.correctionAccuracy, 0.5);
    assert.deepEqual(m.missed.map((e) => e.id), [2]);
    assert.equal(m.recallByType.ar_hamza?.recall, 0);
  });

  it("excludes planted errors whose source word was already wrong", () => {
    // The clean text already had "الخليه"; planting another error on it gives an unreliable answer key.
    const onWrongWord: SeededError = {
      id: 9, type: "double", lang: "ar", correct: "الخليه", erroneous: "الخخليه", offset: 0, changeIndex: 2,
    };
    const m = scoreLanguage([...planted, onWrongWord], [issue("الخخليه", "الخلية")], [issue("الخليه", "الخلية")]);
    assert.deepEqual(m.unreliable.map((e) => e.id), [9]);
    assert.equal(m.planted, 3);
    assert.equal(m.falsePositives, 0);
    assert.equal(m.preExisting, 1);
  });
});

describe("scoreAlignment", () => {
  const predicted = (statuses: Record<string, StandardAlignment["status"]>): StandardAlignment[] =>
    Object.entries(statuses).map(([code, status]) => ({
      code,
      description: "",
      status,
      evidence: [],
      evidenceVerified: false,
      gap: "",
      recommendation: "",
    }));

  it("gives kappa 1 for perfect agreement", () => {
    const gold = { A: "met", B: "partial", C: "not_met" } as const;
    const m = scoreAlignment(predicted(gold), gold);
    assert.equal(m.accuracy, 1);
    assert.equal(m.kappa, 1);
    assert.equal(m.weightedKappa, 1);
  });

  it("matches a hand-computed kappa and reports missing codes", () => {
    // gold:  met, met, partial, not_met ; agent: met, partial, partial, not_met
    const m = scoreAlignment(predicted({ A: "met", B: "partial", C: "partial", D: "not_met" }), {
      A: "met",
      B: "met",
      C: "partial",
      D: "not_met",
      E: "met",
    });
    assert.deepEqual(m.missingCodes, ["E"]);
    assert.equal(m.compared, 4);
    assert.equal(m.accuracy, 0.75);
    // po = 0.75; pe = (2*1 + 1*2 + 1*1) / 16 = 5/16; kappa = (0.75 - 5/16) / (1 - 5/16) = 7/11
    assert.ok(Math.abs(m.kappa - 7 / 11) < 1e-12);
    // A near miss (met -> partial) costs less under the weighted kappa.
    assert.ok(m.weightedKappa > m.kappa);
    assert.equal(m.confusion.met.partial, 1);
  });
});
