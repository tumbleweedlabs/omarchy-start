import { getSettings, subscribe } from "./store.js";
import { el } from "./util.js";
import { NEWS_FEED, NEWS_HOME, NEWS_MAX_AGE_MS, feedHome, feedPermission, normaliseNewsItems, parseNewsFeed, selectedFeed, validFeedUrl } from "./news-feed.js";

const CACHE_KEY = "rssFeedCache";
const OLD_CACHE_KEY = "omarchyNewsCache";
const CACHE_VERSION = 1;
const MAX_FEEDS = 4;

function cleanRecord(raw, url) {
  if (!raw || typeof raw !== "object") return null;
  const stories = normaliseNewsItems(raw.stories, url);
  if (!stories.length) return null;
  const fetchedAt = Math.min(Math.max(Number(raw.fetchedAt) || 0, 0), Date.now());
  const title = String(raw.title || (url === NEWS_FEED ? "Omarchy news" : new URL(url).hostname)).replace(/\s+/g, " ").trim().slice(0, 72);
  return { version: CACHE_VERSION, fetchedAt, title, home: url === NEWS_FEED ? NEWS_HOME : feedHome(raw.home, url), stories };
}

function cleanCache(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([url, value]) => {
    if (validFeedUrl(url) !== url) return [];
    const record = cleanRecord(value, url);
    return record ? [[url, record]] : [];
  }).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, MAX_FEEDS));
}

export async function initNews() {
  const root = document.getElementById("omarchy-news");
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = "true";
  let cache = {};
  let activeFetch = null;
  let refreshTimer = null;
  let lastAttempt = 0;

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    const news = getSettings().news;
    const url = news.show && selectedFeed(news);
    if (!url) return;
    const fetchedAt = cache[url]?.fetchedAt || 0;
    const delay = Math.max(
      60_000,
      fetchedAt ? NEWS_MAX_AGE_MS - (Date.now() - fetchedAt) : 0,
      lastAttempt ? 15 * 60_000 - (Date.now() - lastAttempt) : 15 * 60_000,
    );
    refreshTimer = setTimeout(() => { void refresh().finally(scheduleRefresh); }, delay);
  }

  function render() {
    const settings = getSettings().news;
    const url = selectedFeed(settings);
    const record = url && cache[url];
    if (!settings.show || !record) { root.hidden = true; return; }
    root.setAttribute("aria-label", url === NEWS_FEED ? "Omarchy news" : `${record.title} news`);
    const format = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
    root.replaceChildren(
      el("div", { class: "news-head" },
        el("h2", {}, url === NEWS_FEED ? "OMARCHY / NEWS" : `RSS / ${record.title}`),
        el("a", { href: record.home, target: "_blank", rel: "noopener noreferrer" }, "All news ↗")),
      el("div", { class: "news-grid" }, record.stories.map(story =>
        el("a", { class: "news-card glass", href: story.url, target: "_blank", rel: "noopener noreferrer" },
          el("time", { datetime: new Date(story.publishedAt).toISOString() }, format.format(story.publishedAt)),
          el("span", { class: "news-title" }, story.title),
          story.excerpt ? el("span", { class: "news-excerpt" }, story.excerpt) : "",
          el("span", { class: "news-arrow", "aria-hidden": "true" }, "↗")))));
    root.hidden = false;
  }

  async function refresh() {
    const settings = getSettings().news;
    const url = settings.show && selectedFeed(settings);
    if (!url) { activeFetch?.controller.abort(); return; }
    if (activeFetch?.url === url) return;
    activeFetch?.controller.abort();
    const record = cache[url];
    if (record && Date.now() - record.fetchedAt < NEWS_MAX_AGE_MS) return;
    lastAttempt = Date.now();
    const permission = feedPermission(url);
    if (!permission || !(await chrome.permissions.contains({ origins: [permission] }))) return;
    // Settings may change while the permission check is in flight.
    if (!getSettings().news.show || selectedFeed(getSettings().news) !== url) return;
    const controller = new AbortController();
    activeFetch = { url, controller };
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { credentials: "omit", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      if (response.url && new URL(response.url).origin !== new URL(url).origin) throw new Error("Feed redirected to another host");
      const xml = await response.text();
      if (xml.length > 1_000_000) throw new Error("Feed is too large");
      const parsed = parseNewsFeed(xml, url);
      cache = cleanCache({ ...cache, [url]: { ...parsed, fetchedAt: Date.now() } });
      render();
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
    } catch (error) {
      if (error.name !== "AbortError") console.warn("RSS feed unavailable:", error);
    } finally {
      clearTimeout(timeout);
      if (activeFetch?.controller === controller) activeFetch = null;
      scheduleRefresh();
    }
  }

  subscribe((_, what) => {
    if (what !== "settings") return;
    render();
    void refresh();
    scheduleRefresh();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[CACHE_KEY]?.newValue) return;
    cache = cleanCache(changes[CACHE_KEY].newValue);
    render();
    scheduleRefresh();
  });

  try {
    const saved = await chrome.storage.local.get([CACHE_KEY, OLD_CACHE_KEY]);
    cache = cleanCache(saved[CACHE_KEY]);
    if (!cache[NEWS_FEED] && saved[OLD_CACHE_KEY]) {
      const old = cleanRecord(saved[OLD_CACHE_KEY], NEWS_FEED);
      if (old) cache[NEWS_FEED] = old;
    }
    render();
  } catch (error) { console.warn("RSS cache unavailable:", error); }
  void refresh();
  scheduleRefresh();
}
