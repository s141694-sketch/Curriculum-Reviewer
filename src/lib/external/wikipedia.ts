import type { ReferenceItem } from "@/types/references";
import { getJson } from "./http";

// Arabic Wikipedia through the MediaWiki Action API: one call searches and
// returns the intro extract, canonical URL and a thumbnail for each hit.

interface WikiPage {
  pageid: number;
  title: string;
  index?: number;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source: string };
}

interface WikiResponse {
  query?: { pages?: WikiPage[] };
}

export function wikipediaUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    gsrnamespace: "0",
    prop: "extracts|info|pageimages",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    exlimit: String(limit),
    inprop: "url",
    piprop: "thumbnail",
    pithumbsize: "160",
  });
  return `https://ar.wikipedia.org/w/api.php?${params}`;
}

export function parseWikipedia(data: WikiResponse): ReferenceItem[] {
  const pages = [...(data.query?.pages ?? [])];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.map((page) => ({
    id: String(page.pageid),
    title: page.title,
    url:
      page.fullurl ??
      `https://ar.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    snippet: page.extract?.trim() || undefined,
    thumbnail: page.thumbnail?.source,
    meta: ["ويكيبيديا العربية"],
    arabic: true,
  }));
}

export async function searchWikipedia(query: string, limit = 3): Promise<ReferenceItem[]> {
  return parseWikipedia(await getJson<WikiResponse>("wikipedia", wikipediaUrl(query, limit)));
}
