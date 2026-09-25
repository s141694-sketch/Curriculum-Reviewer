// Arabic UI labels shared by pages and the Markdown export.

import type {
  AlignmentStatus,
  BloomLevel,
  LanguageIssueType,
  ReviewStatus,
  StageId,
  StageStatus,
} from "@/types/review";

export const STAGE_LABELS: Record<StageId, { name: string; agent: string }> = {
  ingestion: { name: "استخراج المحتوى وتحليل البنية", agent: "وكيل الاستيعاب" },
  language: { name: "التدقيق الإملائي واللغوي", agent: "وكيل التدقيق اللغوي" },
  standards: { name: "المطابقة مع المعايير", agent: "وكيل المعايير" },
  content: { name: "تحليل المحتوى التربوي", agent: "وكيل تحليل المحتوى" },
  report: { name: "إعداد التقرير النهائي", agent: "وكيل التقارير" },
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  pending: "بانتظار الدور",
  running: "قيد التنفيذ",
  done: "مكتمل",
  failed: "فشل",
  skipped: "تم التخطي",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  queued: "في الطابور",
  running: "قيد المراجعة",
  done: "مكتملة",
  failed: "فشلت",
};

export const ALIGNMENT_LABELS: Record<AlignmentStatus, string> = {
  met: "متحقق",
  partial: "متحقق جزئيًا",
  not_met: "غير متحقق",
};

export const ISSUE_TYPE_LABELS: Record<LanguageIssueType, string> = {
  spelling: "إملائي",
  grammar: "نحوي",
  punctuation: "ترقيم",
  style: "أسلوب",
  terminology: "مصطلحات",
};

export const SEVERITY_LABELS = { high: "عالية", medium: "متوسطة", low: "منخفضة" } as const;

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: "التذكر",
  understand: "الفهم",
  apply: "التطبيق",
  analyze: "التحليل",
  evaluate: "التقويم",
  create: "الإبداع",
};
