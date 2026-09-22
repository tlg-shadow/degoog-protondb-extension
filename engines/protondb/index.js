const SEARCH_URL = "https://www.protondb.com/proxy/steamdb2/query";
const SUMMARY_URL = "https://www.protondb.com/api/v1/reports/summaries";
const LIMIT = 8;
const cache = new Map();
const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133 Safari/537.36";

const titleCase = (value) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "";
const linkFor = (id) => `https://www.protondb.com/app/${encodeURIComponent(String(id))}`;

export default class ProtonDBEngine {
  isClientExposed = false;
  name = "ProtonDB";
  bangShortcut = "protondb";

  async summary(id, doFetch, context) {
    const saved = cache.get(id);
    if (saved && saved.until > Date.now()) return saved.value;
    const response = await doFetch(`${SUMMARY_URL}/${encodeURIComponent(id)}.json`, { headers: { Accept: "application/json", "User-Agent": context?.userAgent?.() ?? ua } });
    const value = response.ok ? await response.json() : null;
    cache.set(id, { value, until: Date.now() + 300000 });
    return value;
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const q = String(query ?? "").trim();
    if (!q) return [];
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(SEARCH_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": context?.userAgent?.() ?? ua },
      body: JSON.stringify({ query: q, page: Math.max(0, Number(page) - 1), hitsPerPage: LIMIT, attributesToRetrieve: ["name", "objectID", "releaseYear"], attributesToHighlight: [], attributesToSnippet: [], facetFilters: [["appType:Game"]] })
    });
    context?.sentinel?.(response, this.name);
    if (!response.ok) throw new Error(`ProtonDB search request failed (${response.status})`);
    const hits = (await response.json()).hits?.filter((hit) => hit?.name && hit?.objectID) ?? [];
    const summaries = await Promise.all(hits.map(async (hit) => { try { return await this.summary(hit.objectID, doFetch, context); } catch { return null; } }));
    return hits.map((hit, index) => {
      const summary = summaries[index];
      const parts = [];
      if (summary?.tier) parts.push(`ProtonDB: ${titleCase(summary.tier)}`);
      if (Number.isFinite(summary?.total) && summary.total > 0) parts.push(`${summary.total.toLocaleString()} reports`);
      parts.push(`Steam App ID: ${hit.objectID}`);
      if (hit.releaseYear) parts.push(`Released: ${hit.releaseYear}`);
      return { title: hit.name, url: linkFor(hit.objectID), snippet: parts.join(" · "), source: this.name };
    });
  }
}

export const type = "games";
