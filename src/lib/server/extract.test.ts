import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixVisualArabic, splitIntoSections } from "@/lib/server/extract";

describe("fixVisualArabic", () => {
  it("restores visual-order Arabic extracted by pdf.js", () => {
    // Real pdf.js output for "الوحدة الأولى: الخلية" from a generated PDF.
    assert.equal(fixVisualArabic("ﺔﻴﻠﺨﻟا :ﻰﻟوﻷا ةﺪﺣﻮﻟا"), "الوحدة الأولى: الخلية");
    assert.equal(
      fixVisualArabic(".ﺎﻬﻔﺋﺎﻇوو ﺔﻴﻠﺨﻟا تﺎﻧﻮﻜﻣ ﺐﻟﺎﻄﻟا ﻒﺼﻳ أن"),
      "أن يصف الطالب مكونات الخلية ووظائفها.",
    );
  });

  it("leaves logical-order and Latin text alone", () => {
    assert.equal(fixVisualArabic("الوحدة 12 Unit"), "الوحدة 12 Unit");
    assert.equal(fixVisualArabic("Plain English line."), "Plain English line.");
  });
});

describe("splitIntoSections", () => {
  it("splits on Arabic and English headings without losing text", () => {
    const body = "جملة تعليمية طويلة. ".repeat(150);
    const text = `الوحدة الأولى\n${body}\nUnit 2 Cells\n${body}\nالدرس 3\n${body}`;
    const sections = splitIntoSections(text);
    assert.deepEqual(
      sections.map((s) => s.heading),
      ["الوحدة الأولى", "Unit 2 Cells", "الدرس 3"],
    );
    const letters = (s: string) => s.replace(/\s/g, "");
    assert.equal(
      letters(sections.map((s) => s.text).join("")),
      letters(body.repeat(3)),
    );
  });

  it("hard-splits oversized paragraphs", () => {
    const sections = splitIntoSections("كلمة ".repeat(5000), 6000);
    assert.ok(sections.length > 1);
    assert.ok(sections.every((s) => s.text.length <= 6000));
  });
});
