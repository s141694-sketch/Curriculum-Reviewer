import type { ReferenceItem } from "@/types/references";
import { getJson } from "./http";

// OpenAlex works search: research that backs design decisions (Bloom levels,
// alignment of objectives and assessment…). Optional OPENALEX_API_KEY and
// OPENALEX_MAILTO are passed through when set.

interface OpenAlexWork {
  id: string;
  display_name?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  cited_by_count?: number;
  language?: string | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

const SELECT =
  "id,display_name,publication_year,doi,cited_by_count,language,open_access,primary_location";

export function openAlexUrl(query: string, limit: number): string {
  const params = new URLSearchParams({ search: query, "per-page": String(limit), select: SELECT });
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
  return `https://api.openalex.org/works?${params}`;
}

export function parseOpenAlex(data: OpenAlexResponse): ReferenceItem[] {
  return (data.results ?? [])
    .filter((work) => work.display_name)
    .map((work): ReferenceItem => {
      const meta: string[] = [];
      if (work.publication_year) meta.push(String(work.publication_year));
      const venue = work.primary_location?.source?.display_name;
      if (venue) meta.push(venue);
      if (typeof work.cited_by_count === "number") meta.push(`الاستشهادات: ${work.cited_by_count}`);
      if (work.open_access?.is_oa) meta.push("وصول مفتوح");
      return {
        id: work.id,
        title: work.display_name ?? "",
        url:
          work.doi ??
          work.open_access?.oa_url ??
          work.primary_location?.landing_page_url ??
          work.id,
        meta,
        arabic: work.language === "ar",
      };
    });
}

export async function searchOpenAlex(query: string, limit = 5): Promise<ReferenceItem[]> {
  return parseOpenAlex(await getJson<OpenAlexResponse>("research", openAlexUrl(query, limit)));
}
