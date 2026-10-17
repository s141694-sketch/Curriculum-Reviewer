// Shape shared by every external reference source (docs/external-apis.md).

export type ReferenceSource = "wikipedia" | "books" | "research";

export interface ReferenceItem {
  id: string;
  title: string;
  url: string;
  /** Short plain-text summary, when the source provides one. */
  snippet?: string;
  thumbnail?: string;
  /** Small facts shown under the title: authors, year, citations… */
  meta: string[];
  /** True when the item itself is in Arabic. */
  arabic: boolean;
}

export interface ReferenceResult {
  source: ReferenceSource;
  query: string;
  items: ReferenceItem[];
}
