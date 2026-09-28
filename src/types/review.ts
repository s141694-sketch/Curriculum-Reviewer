// Types for the automated curriculum review pipeline.

export type StageId = "ingestion" | "language" | "standards" | "content" | "report";

export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface StageState {
  id: StageId;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Human-readable progress note, e.g. "3/8 sections checked". */
  progress?: string;
}

export type ReviewStatus = "queued" | "running" | "done" | "failed";

export interface Standard {
  code: string;
  description: string;
}

export interface StandardsFramework {
  id: string;
  name: string;
  description: string;
  /** Where the standards come from (ministry document, international body, etc.). */
  source: string;
  standards: Standard[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSection {
  index: number;
  heading: string;
  text: string;
}

export interface CurriculumProfile {
  subject: string;
  gradeLevel: string;
  language: string;
  summary: string;
  learningObjectives: string[];
  unitTitles: string[];
}

export type LanguageIssueType = "spelling" | "grammar" | "punctuation" | "style" | "terminology";

export interface LanguageIssue {
  sectionIndex: number;
  type: LanguageIssueType;
  original: string;
  suggestion: string;
  explanation: string;
  severity: "low" | "medium" | "high";
  /** True when `original` was found verbatim in the section text (guards against invented errors). */
  verified: boolean;
}

export type AlignmentStatus = "met" | "partial" | "not_met";

export interface StandardAlignment {
  code: string;
  description: string;
  status: AlignmentStatus;
  evidence: string[];
  /** Share of evidence quotes found verbatim in the document. */
  evidenceVerified: boolean;
  gap: string;
  recommendation: string;
}

export interface ContentDimension {
  key: string;
  label: string;
  score: number;
  findings: string[];
  recommendations: string[];
}

export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export interface ContentAnalysis {
  dimensions: ContentDimension[];
  bloomDistribution: Record<BloomLevel, number>;
  accuracyConcerns: { claim: string; concern: string; sectionIndex: number }[];
  strengths: string[];
}

export interface ReportRecommendation {
  priority: "high" | "medium" | "low";
  area: string;
  action: string;
}

export interface FinalReport {
  executiveSummary: string;
  overallScore: number;
  scores: {
    language: number | null;
    standards: number | null;
    content: number | null;
  };
  keyFindings: string[];
  recommendations: ReportRecommendation[];
}

export interface Review {
  id: string;
  title: string;
  fileName: string | null;
  frameworkId: string | null;
  frameworkName: string | null;
  status: ReviewStatus;
  stages: StageState[];
  createdAt: string;
  updatedAt: string;
  /** Model/provider that produced the results, for traceability. */
  engine: string;
  sourceText: string;
  sections: DocumentSection[];
  profile: CurriculumProfile | null;
  languageIssues: LanguageIssue[] | null;
  alignment: StandardAlignment[] | null;
  content: ContentAnalysis | null;
  report: FinalReport | null;
}

/** Review without the heavy fields, for list views. */
export type ReviewSummary = Pick<
  Review,
  "id" | "title" | "fileName" | "frameworkName" | "status" | "stages" | "createdAt" | "updatedAt"
> & { overallScore: number | null };
