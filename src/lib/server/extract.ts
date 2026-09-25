import "server-only";
import type { DocumentSection } from "@/types/review";

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Extract plain text from an uploaded curriculum file. */
export async function extractText(fileName: string, data: ArrayBuffer): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return normalize(new TextDecoder("utf-8").decode(data));
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return normalize(result.value);
  }

  if (lower.endsWith(".pdf")) {
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractPdfText(pdf, { mergePages: false });
    // Keep page breaks as blank lines so sectioning still has boundaries.
    return normalize(text.map(fixVisualArabic).join("\n\n"));
  }

  throw new Error(
    `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
  );
}

// Arabic presentation forms (contextual glyph shapes), which many PDFs store instead of letters.
const PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_RUN = /[A-Za-z0-9\u0660-\u0669][A-Za-z0-9\u0660-\u0669.,:%/_-]*/g;

// Runs of basic-block Arabic characters (plus punctuation) that pdf.js's own
// bidi pass already reversed. It treats presentation forms as LTR, so on a
// visual-order line it only flips these runs, leaving a mix of both orders.
const PDFJS_RTL_RUN = /[\u0600-\u06FF.,:;!?()\u00AB\u00BB-]+/g;

/**
 * Some PDFs store Arabic as shaped glyphs in visual (left-to-right) order, so
 * extracted lines come out reversed, e.g. "ﺔﻴﻠﺨﻟا" instead of "الخلية".
 * For such lines: undo pdf.js's partial reordering to get pure visual order,
 * reverse to logical order, restore embedded LTR runs (numbers, Latin words),
 * then map glyphs back to plain letters with NFKC.
 */
export function fixVisualArabic(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!PRESENTATION_FORMS.test(line)) return line.normalize("NFKC");
      const visual = line.replace(PDFJS_RTL_RUN, (run) =>
        /[\u0600-\u06FF]/.test(run) ? Array.from(run).reverse().join("") : run,
      );
      const reversed = Array.from(visual).reverse().join("");
      const restored = reversed.replace(LTR_RUN, (run) => Array.from(run).reverse().join(""));
      return restored.normalize("NFKC");
    })
    .join("\n");
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Lines that look like headings: markdown headings, numbered headings
// ("1.", "1.2", "Unit 3", "الوحدة الثالثة", "الدرس 2"), or short lines ending with ":".
const HEADING_PATTERN =
  /^(#{1,6}\s+.+|(\d+(\.\d+)*[.)]?\s+.{2,80})|((unit|chapter|lesson|module|section|الوحدة|الفصل|الدرس|الباب|المحور|الموضوع)(?=[\s:]|$).{0,80})|(.{2,60}:))$/i;

/**
 * Split text into sections by headings, then merge/split so each section is
 * a workable size for the per-section agents.
 */
export function splitIntoSections(text: string, targetChars = 6000): DocumentSection[] {
  const lines = text.split("\n");
  const raw: { heading: string; lines: string[] }[] = [{ heading: "", lines: [] }];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length <= 90 && HEADING_PATTERN.test(trimmed)) {
      raw.push({ heading: trimmed.replace(/^#+\s*/, ""), lines: [] });
    } else {
      raw[raw.length - 1].lines.push(line);
    }
  }

  // Merge tiny sections into their predecessor, split oversized ones on paragraph breaks.
  const merged: { heading: string; text: string }[] = [];
  for (const part of raw) {
    const body = part.lines.join("\n").trim();
    if (!body && !part.heading) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.text.length + body.length < targetChars / 3) {
      previous.text = [previous.text, part.heading, body].filter(Boolean).join("\n");
      continue;
    }
    merged.push({ heading: part.heading, text: body });
  }

  const sections: DocumentSection[] = [];
  for (const part of merged) {
    for (const chunk of chunkByParagraph(part.text, targetChars)) {
      sections.push({ index: sections.length, heading: part.heading, text: chunk });
    }
  }
  return sections.filter((section) => section.text.trim() || section.heading);
}

function chunkByParagraph(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n\n+/)) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = "";
    }
    // A single paragraph longer than the limit is hard-split on sentence ends.
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      let rest = paragraph;
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars);
        const cut = Math.max(
          window.lastIndexOf(". "),
          window.lastIndexOf("؟ "),
          window.lastIndexOf("? "),
          window.lastIndexOf("! "),
          window.lastIndexOf("\n"),
        );
        const end = cut > maxChars / 2 ? cut + 1 : maxChars;
        chunks.push(rest.slice(0, end).trim());
        rest = rest.slice(end);
      }
      if (rest.trim()) chunks.push(rest.trim());
      continue;
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(current);
  return chunks;
}
