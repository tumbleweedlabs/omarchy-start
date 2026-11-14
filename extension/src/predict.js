/* Web search predictions. Opt-in: nothing is sent unless the user has turned predictions on
   in Settings and granted this device access to the chosen provider's origin. */

export const PREDICTORS = {
  bing: { label: "Bing", origin: "https://api.bing.com/*", url: "https://api.bing.com/osjson.aspx?query=%s" },
  google: { label: "Google", origin: "https://suggestqueries.google.com/*", url: "https://suggestqueries.google.com/complete/search?client=firefox&ie=utf-8&oe=utf-8&q=%s" },
  duckduckgo: { label: "DuckDuckGo", origin: "https://duckduckgo.com/*", url: "https://duckduckgo.com/ac/?type=list&q=%s" },
  brave: { label: "Brave", origin: "https://search.brave.com/*", url: "https://search.brave.com/api/suggest?q=%s" },
  startpage: { label: "Startpage", origin: "https://www.startpage.com/*", url: "https://www.startpage.com/osuggestions?q=%s" },
  ecosia: { label: "Ecosia", origin: "https://ac.ecosia.org/*", url: "https://ac.ecosia.org/autocomplete?type=list&q=%s" },
};

export const MAX_PREDICTIONS = 5;
const TIMEOUT_MS = 1500;
const CACHE_MAX = 60;

const cache = new Map();
let ctrl = null;

export const providerOf = (id) => (Object.hasOwn(PREDICTORS, id) ? id : null);

export async function hasAccess(id) {
  if (!providerOf(id)) return false;
  try { return await chrome.permissions.contains({ origins: [PREDICTORS[providerOf(id)].origin] }); }
  catch { return false; }
}

/* Must be called directly from a click/change handler so the browser sees a user gesture. */
export async function requestAccess(id) {
  if (!providerOf(id)) return false;
  try { return await chrome.permissions.request({ origins: [PREDICTORS[providerOf(id)].origin] }); }
  catch { return false; }
}

/* Drops host access for every provider except `keep` (pass nothing to drop all). */
export async function dropAccess(keep) {
  const origins = Object.entries(PREDICTORS).filter(([id]) => id !== keep).map(([, p]) => p.origin);
  try { await chrome.permissions.remove({ origins }); } catch { /* not granted */ }
}

/* Accepts the OpenSearch shape [query, [s1, s2, …]] plus {suggestions:[…]} / {phrase} variants. */
export function parsePredictions(data, query) {
  let list = [];
  if (Array.isArray(data) && Array.isArray(data[1])) list = data[1];
  else if (data && Array.isArray(data.suggestions)) list = data.suggestions;
  else if (Array.isArray(data)) list = data;
  const q = query.trim().toLowerCase();
  const seen = new Set([q]);
  const out = [];
  for (const raw of list) {
    let s = typeof raw === "string" ? raw : (raw && typeof raw.phrase === "string" ? raw.phrase : null);
    if (!s) continue;
    s = s.replace(/\s+/g, " ").trim().slice(0, 200);
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= MAX_PREDICTIONS) break;
  }
  return out;
}

export function cached(id, query) {
  return cache.get(providerOf(id) + "\n" + query.trim().toLowerCase()) || null;
}

/* Resolves to a list of predictions, or null if the request was superseded, failed or isn't allowed. */
export async function fetchPredictions(id, query) {
  cancelPredictions();
  const p = PREDICTORS[providerOf(id)];
  if (!p) return null;
  const key = providerOf(id) + "\n" + query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const c = (ctrl = new AbortController());
  if (!(await hasAccess(id)) || c.signal.aborted) return null;
  const timer = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(p.url.replace("%s", encodeURIComponent(query.trim())), {
      signal: c.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "default",
    });
    if (!res.ok) return null;
    const list = parsePredictions(JSON.parse(await res.text()), query);
    cache.set(key, list);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return list;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (ctrl === c) ctrl = null;
  }
}

export function cancelPredictions() {
  if (ctrl) { ctrl.abort(); ctrl = null; }
}
