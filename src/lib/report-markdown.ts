import {
  ALIGNMENT_LABELS,
  BLOOM_LABELS,
  ISSUE_TYPE_LABELS,
  SEVERITY_LABELS,
  STAGE_LABELS,
  STAGE_STATUS_LABELS,
} from "@/lib/labels";
import type { Review } from "@/types/review";

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Render a complete review as a Markdown document for archiving or sharing. */
export function reviewToMarkdown(review: Review): string {
  const out: string[] = [];
  const score = (value: number | null | undefined) => (value == null ? "—" : `${value}/100`);

  out.push(`# تقرير مراجعة المنهج: ${review.title}`, "");
  out.push(`- تاريخ المراجعة: ${new Date(review.createdAt).toLocaleString("ar-OM")}`);
  if (review.fileName) out.push(`- الملف: ${review.fileName}`);
  out.push(`- إطار المعايير: ${review.frameworkName ?? "لم يُحدد"}`);
  out.push(`- محرك الذكاء الاصطناعي: ${review.engine || "—"}`, "");

  out.push("## حالة مراحل الأتمتة", "");
  for (const stage of review.stages) {
    out.push(
      `- ${STAGE_LABELS[stage.id].agent} (${STAGE_LABELS[stage.id].name}): ${STAGE_STATUS_LABELS[stage.status]}${stage.error ? ` — ${stage.error}` : ""}`,
    );
  }
  out.push("");

  if (review.report) {
    const r = review.report;
    out.push("## الملخص التنفيذي", "", r.executiveSummary, "");
    out.push("## الدرجات", "");
    out.push("| المحور | الدرجة |", "|---|---|");
    out.push(`| الدرجة الكلية | ${score(r.overallScore)} |`);
    out.push(`| سلامة اللغة | ${score(r.scores.language)} |`);
    out.push(`| المطابقة مع المعايير | ${score(r.scores.standards)} |`);
    out.push(`| جودة المحتوى | ${score(r.scores.content)} |`, "");
    out.push("## أبرز النتائج", "", ...r.keyFindings.map((f) => `- ${f}`), "");
    out.push("## التوصيات", "");
    out.push("| الأولوية | المجال | الإجراء |", "|---|---|---|");
    for (const rec of r.recommendations) {
      out.push(`| ${SEVERITY_LABELS[rec.priority]} | ${cell(rec.area)} | ${cell(rec.action)} |`);
    }
    out.push("");
  }

  if (review.profile) {
    const p = review.profile;
    out.push("## وصف المنهج", "");
    out.push(`- المادة: ${p.subject}`, `- المرحلة: ${p.gradeLevel}`, `- اللغة: ${p.language}`, "");
    out.push(p.summary, "");
    if (p.learningObjectives.length) {
      out.push("### الأهداف المعلنة", "", ...p.learningObjectives.map((o) => `- ${o}`), "");
    }
  }

  if (review.alignment) {
    out.push(`## مصفوفة المطابقة مع المعايير (${review.frameworkName ?? ""})`, "");
    out.push("| الرمز | المعيار | الحالة | الشواهد | الفجوة | التوصية |", "|---|---|---|---|---|---|");
    for (const a of review.alignment) {
      out.push(
        `| ${cell(a.code)} | ${cell(a.description)} | ${ALIGNMENT_LABELS[a.status]} | ${cell(a.evidence.join(" / "))}${a.evidence.length && !a.evidenceVerified ? " ⚠️" : ""} | ${cell(a.gap)} | ${cell(a.recommendation)} |`,
      );
    }
    out.push("", "⚠️ = شاهد لم يُعثر عليه حرفيًا في النص، يحتاج تحققًا بشريًا.", "");
  }

  if (review.content) {
    const c = review.content;
    out.push("## تحليل المحتوى", "");
    for (const d of c.dimensions) {
      out.push(`### ${d.label} — ${d.score}/100`, "");
      if (d.findings.length) out.push("**الملاحظات:**", ...d.findings.map((f) => `- ${f}`), "");
      if (d.recommendations.length)
        out.push("**التوصيات:**", ...d.recommendations.map((f) => `- ${f}`), "");
    }
    out.push("### توزيع مستويات بلوم", "", "| المستوى | العدد |", "|---|---|");
    for (const [level, count] of Object.entries(c.bloomDistribution)) {
      out.push(`| ${BLOOM_LABELS[level as keyof typeof BLOOM_LABELS]} | ${count} |`);
    }
    out.push("");
    if (c.accuracyConcerns.length) {
      out.push("### ملاحظات على الدقة العلمية", "");
      for (const concern of c.accuracyConcerns) out.push(`- «${concern.claim}»: ${concern.concern}`);
      out.push("");
    }
    if (c.strengths.length) out.push("### نقاط القوة", "", ...c.strengths.map((s) => `- ${s}`), "");
  }

  if (review.languageIssues) {
    out.push(`## الأخطاء اللغوية والإملائية (${review.languageIssues.length})`, "");
    out.push("| النوع | الخطورة | النص الأصلي | التصحيح المقترح | التوضيح |", "|---|---|---|---|---|");
    for (const issue of review.languageIssues) {
      out.push(
        `| ${ISSUE_TYPE_LABELS[issue.type]} | ${SEVERITY_LABELS[issue.severity]} | ${cell(issue.original)}${issue.verified ? "" : " ⚠️"} | ${cell(issue.suggestion)} | ${cell(issue.explanation)} |`,
      );
    }
    out.push("");
  }

  out.push(
    "---",
    "",
    "_هذا التقرير مُعدّ آليًا بواسطة وكلاء ذكاء اصطناعي، وهو أداة مساعدة لا تغني عن مراجعة الخبير المختص._",
  );
  return out.join("\n");
}
