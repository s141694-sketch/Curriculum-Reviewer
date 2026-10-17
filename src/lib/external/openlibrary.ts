import type { ReferenceItem } from "@/types/references";
import { getJson } from "./http";

// Open Library search. Arabic editions are listed first; relevance order is
// kept otherwise.

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  edition_count?: number;
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
}

const FIELDS = "key,title,author_name,first_publish_year,cover_i,language,edition_count";

export function openLibraryUrl(query: string, limit: number): string {
  const params = new URLSearchParams({ q: query, limit: String(limit * 2), fields: FIELDS });
  return `https://openlibrary.org/search.json?${params}`;
}

export function parseOpenLibrary(data: OpenLibraryResponse, limit: number): ReferenceItem[] {
  const items = (data.docs ?? []).map((doc): ReferenceItem => {
    const meta: string[] = [];
    if (doc.author_name?.length) meta.push(doc.author_name.slice(0, 2).join("، "));
    if (doc.first_publish_year) meta.push(String(doc.first_publish_year));
    if (doc.edition_count) meta.push(`عدد الطبعات: ${doc.edition_count}`);
    return {
      id: doc.key,
      title: doc.title,
      url: `https://openlibrary.org${doc.key}`,
      thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : undefined,
      meta,
      arabic: doc.language?.includes("ara") ?? false,
    };
  });
  return [...items.filter((i) => i.arabic), ...items.filter((i) => !i.arabic)].slice(0, limit);
}

export async function searchOpenLibrary(query: string, limit = 6): Promise<ReferenceItem[]> {
  const data = await getJson<OpenLibraryResponse>("books", openLibraryUrl(query, limit));
  return parseOpenLibrary(data, limit);
}
