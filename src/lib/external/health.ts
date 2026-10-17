import { USER_AGENT } from "./http";

// Live probe of every candidate in docs/external-apis.md (bd: cr-ekm.1).
// Runs on the server that hosts Harak, so it answers "does this API work from
// where we deploy", which the cloud sandbox could not.

interface Probe {
  id: string;
  name: string;
  url: string;
  /** The response should contain Arabic text when the API serves Arabic. */
  expectArabic?: boolean;
  /** Extra success condition on the body text. */
  bodyIncludes?: string;
  note?: string;
}

export interface ProbeResult {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  contentType: string | null;
  /** Value of Access-Control-Allow-Origin for our Origin (null = no CORS). */
  cors: string | null;
  arabic: boolean | null;
  error?: string;
  note?: string;
}

const AR = encodeURIComponent("تعليم");
const EN = encodeURIComponent("bloom taxonomy");

export const PROBES: Probe[] = [
  {
    id: "wikipedia-ar",
    name: "Wikipedia (ar)",
    url: `https://ar.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${AR}&srlimit=1`,
    expectArabic: true,
  },
  {
    id: "wiktionary-ar",
    name: "Wiktionary (ar)",
    url: `https://ar.wiktionary.org/w/api.php?action=query&format=json&list=search&srsearch=${AR}&srlimit=1`,
    expectArabic: true,
  },
  {
    id: "wikidata",
    name: "Wikidata (read)",
    url: `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=ar&uselang=ar&search=${AR}&limit=1`,
    expectArabic: true,
    note: "Read without OAuth",
  },
  {
    id: "openlibrary",
    name: "Open Library",
    url: `https://openlibrary.org/search.json?q=${AR}&limit=1&fields=key,title,language`,
    expectArabic: true,
  },
  {
    id: "google-books",
    name: "Google Books (no key)",
    url: `https://www.googleapis.com/books/v1/volumes?q=${AR}&maxResults=1`,
    expectArabic: true,
  },
  {
    id: "archive-org",
    name: "Archive.org",
    url: `https://archive.org/advancedsearch.php?q=${AR}&fl[]=identifier&fl[]=title&rows=1&output=json`,
    expectArabic: true,
  },
  {
    id: "gutendex",
    name: "Gutendex (Arabic books)",
    url: "https://gutendex.com/books/?languages=ar",
    note: "count = number of Arabic books",
  },
  {
    id: "openalex",
    name: "OpenAlex",
    url: `https://api.openalex.org/works?search=${EN}&per-page=1&select=id,display_name`,
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${EN}&limit=1&fields=title,year`,
  },
  {
    id: "crossref",
    name: "Crossref",
    url: `https://api.crossref.org/works?query=${EN}&rows=1&select=DOI,title`,
  },
  {
    id: "libretranslate",
    name: "LibreTranslate (public)",
    url: "https://libretranslate.com/languages",
    bodyIncludes: '"ar"',
    note: "ok = Arabic listed; translating may still need a key",
  },
  {
    id: "codecogs",
    name: "CodeCogs LaTeX",
    url: "https://latex.codecogs.com/svg.image?x%5E2",
    bodyIncludes: "<svg",
  },
  {
    id: "quran-cloud",
    name: "Quran Cloud",
    url: "https://api.alquran.cloud/v1/ayah/1:1/quran-uthmani",
    expectArabic: true,
  },
  {
    id: "quran-api",
    name: "Quran-api (jsDelivr)",
    url: "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf/1/1.json",
    expectArabic: true,
  },
  {
    id: "universities",
    name: "Universities List (Oman)",
    url: "http://universities.hipolabs.com/search?country=Oman",
    bodyIncludes: "Sultan Qaboos",
  },
  {
    id: "worldbank",
    name: "World Bank (Oman)",
    url: "https://api.worldbank.org/v2/country/OMN/indicator/SE.PRM.ENRR?format=json&per_page=1",
    bodyIncludes: "Oman",
  },
];

// Arabic letters, raw or as JSON \u06xx escapes (MediaWiki escapes by default).
const ARABIC = /[؀-ۿ]|\\u06[0-9a-fA-F]{2}/;

async function runProbe(probe: Probe, origin: string): Promise<ProbeResult> {
  const started = Date.now();
  const base = { id: probe.id, name: probe.name, url: probe.url, note: probe.note };
  try {
    const response = await fetch(probe.url, {
      headers: { "User-Agent": USER_AGENT, Origin: origin },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const body = (await response.text()).slice(0, 200_000);
    const contentOk = probe.bodyIncludes ? body.includes(probe.bodyIncludes) : true;
    return {
      ...base,
      ok: response.ok && contentOk,
      status: response.status,
      ms: Date.now() - started,
      contentType: response.headers.get("content-type"),
      cors: response.headers.get("access-control-allow-origin"),
      arabic: probe.expectArabic ? ARABIC.test(body) : null,
      error: response.ok && !contentOk ? `body lacks ${probe.bodyIncludes}` : undefined,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: null,
      ms: Date.now() - started,
      contentType: null,
      cors: null,
      arabic: null,
      error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
    };
  }
}

export async function runAllProbes(origin: string): Promise<ProbeResult[]> {
  return Promise.all(PROBES.map((probe) => runProbe(probe, origin)));
}
