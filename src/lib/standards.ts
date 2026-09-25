import type { Standard } from "@/types/review";

/**
 * Parse standards pasted as one per line. Accepted forms:
 *   CODE | description
 *   CODE: description
 *   CODE - description   (code must not contain spaces)
 *   description          (auto-numbered S1, S2, ...)
 */
export function parseStandards(text: string): Standard[] {
  const standards: Standard[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match =
      line.match(/^([^|]{1,40}?)\s*\|\s*(.+)$/) ??
      line.match(/^([^\s:]{1,40})\s*:\s*(.+)$/) ??
      line.match(/^([^\s]{1,40})\s+[-–]\s+(.+)$/);
    if (match) {
      standards.push({ code: match[1].trim(), description: match[2].trim() });
    } else {
      standards.push({ code: `S${standards.length + 1}`, description: line });
    }
  }
  return standards;
}

export function formatStandards(standards: Standard[]): string {
  return standards.map((s) => `${s.code} | ${s.description}`).join("\n");
}
