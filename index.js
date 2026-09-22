// ProtonDB's web client currently uses this proxy to search SteamDB's game index.
// It does not need an API key and avoids embedding SteamDB/Algolia credentials.
const SEARCH_URL = "https://www.protondb.com/proxy/steamdb2/query";
const SUMMARY_URL = "https://www.protondb.com/api/v1/reports/summaries";
const RESULTS_PER_PAGE = 8;
const RATING_CACHE_TTL_MS = 5 * 60 * 1000;
const ratingCache = new Map();

const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

function titleCase(value) {
  if (typeof value !== "string" || !value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function appUrl(appId) {
  return `https://www.protondb.com/app/${encodeURIComponent(String(appId))}`;
}

function cacheGet(appId) {
  const cached = ratingCache.get(appId);
  if (!cached || cached.expiresAt <= Date.now()) {
    ratingCache.delete(appId);
    return undefined;
  }
  return cached.value;
}

function cacheSet(appId, value) {
  ratingCache.set(appId, {
    value,
    expiresAt: Date.now() + RATING_CACHE_TTL_MS,
  });
}

function formatSnippet(hit, summary) {
  const pieces = [];
  const tier = titleCase(summary?.tier);

  if (tier) pieces.push(`ProtonDB: ${tier}`);
  if (Number.isFinite(summary?.total) && summary.total > 0) {
    pieces.push(`${summary.total.toLocaleString()} reports`);
  }
  pieces.push(`Steam App ID: ${hit.objectID}`);
  if (hit.releaseYear) pieces.push(`Released: ${hit.releaseYear}`);

  return pieces.join(" · ");
}

export default class ProtonDBEngine {
  isClientExposed = false;
  name = "ProtonDB";
  bangShortcut = "protondb";

  async _getSummary(appId, doFetch, context) {
    const cached = cacheGet(appId);
    if (cached !== undefined) return cached;

    const response = await doFetch(`${SUMMARY_URL}/${encodeURIComponent(String(appId))}.json`, {
      headers: {
        Accept: "application/json",
        "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
      },
    });

    // A game without reports may return a non-OK response. It remains a valid search hit.
    if (!response.ok) {
      cacheSet(appId, null);
      return null;
    }

    const summary = await response.json();
    cacheSet(appId, summary);
    return summary;
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const cleanQuery = String(query ?? "").trim();
    if (!cleanQuery) return [];

    const doFetch = context?.fetch ?? fetch;
    const requestedPage = Math.max(0, Number(page) - 1);
    const searchBody = {
      query: cleanQuery,
      page: requestedPage,
      hitsPerPage: RESULTS_PER_PAGE,
      attributesToRetrieve: ["name", "objectID", "releaseYear"],
      attributesToHighlight: [],
      attributesToSnippet: [],
      facetFilters: [["appType:Game"]],
    };

    const response = await doFetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
      },
      body: JSON.stringify(searchBody),
    });
    context?.sentinel?.(response, this.name);

    if (!response.ok) {
      throw new Error(`ProtonDB search request failed (${response.status})`);
    }

    const data = await response.json();
    const hits = (Array.isArray(data?.hits) ? data.hits : []).filter(
      (hit) => hit?.objectID && hit?.name,
    );
    const summaries = await Promise.all(
      hits.map(async (hit) => {
        try {
          return await this._getSummary(hit.objectID, doFetch, context);
        } catch {
          // Results should still be useful if ProtonDB's summary endpoint is delayed.
          return null;
        }
      }),
    );

    return hits.map((hit, index) => ({
        title: hit.name,
        url: appUrl(hit.objectID),
        snippet: formatSnippet(hit, summaries[index]),
        source: this.name,
      }));
  }
}

// A custom engine type creates a dedicated tab rather than mixing game results into Web.
export const type = "games";
