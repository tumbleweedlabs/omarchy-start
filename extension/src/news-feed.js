export const NEWS_FEED = "https://omarchy.org/news/rss.xml";
export const NEWS_HOME = "https://omarchy.org/news/";
export const NEWS_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";

export function validFeedUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export function selectedFeed(news) {
  return news?.source === "custom" ? validFeedUrl(news.customUrl) : NEWS_FEED;
}

export function feedPermission(value) {
  const url = validFeedUrl(value);
  return url ? `${new URL(url).origin}/*` : null;
}

function safeLink(value, feedUrl, official = false) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(String(value || ""), feedUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.href.length > 2048) return null;
    if (official && (url.hostname !== "omarchy.org" || !url.pathname.startsWith("/news/"))) return null;
    return url.href;
  } catch { return null; }
}

export function feedHome(value, feedUrl) {
  return safeLink(value, feedUrl) || new URL(feedUrl).origin + "/";
}

function openingText(html, parser) {
  if (!html) return "";
  // Strip active and resource-bearing markup before parsing an inert HTML document.
  const textHtml = String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(?:img|iframe|audio|video|source|object|embed|link)\b[^>]*>/gi, " ");
  const doc = parser.parseFromString(textHtml, "text/html");
  const paragraphs = [...doc.body.querySelectorAll("p")]
    .map(node => node.textContent.trim()).filter(Boolean);
  return (paragraphs.length ? paragraphs.slice(0, 5).join(" ") : doc.body.textContent).trim();
}

function shortText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/\s+\S*$/, "").trimEnd() + "…";
}

export function normaliseNewsItems(items, feedUrl = NEWS_FEED) {
  if (!Array.isArray(items) || !validFeedUrl(feedUrl)) return [];
  const seen = new Set();
  return items.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const title = shortText(item.title, 180);
    const publishedAt = Number(item.publishedAt);
    const url = safeLink(item.url, feedUrl, feedUrl === NEWS_FEED);
    if (!title || !Number.isFinite(publishedAt) || publishedAt <= 0 || publishedAt > Date.now() + 86400000 || !url || seen.has(url)) return [];
    seen.add(url);
    return [{ title, excerpt: shortText(item.excerpt, 520), url, publishedAt }];
  }).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 3);
}

function atomLink(node) {
  const links = [...node.querySelectorAll("link")];
  return (links.find(link => !link.getAttribute("rel") || link.getAttribute("rel") === "alternate") || links[0])?.getAttribute("href");
}

export function parseNewsFeed(xml, feedUrl = NEWS_FEED, Parser = DOMParser) {
  if (!validFeedUrl(feedUrl)) throw new Error("Invalid feed URL");
  const parser = new Parser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid RSS or Atom feed");
  const rss = doc.querySelector("rss > channel");
  const atom = !rss && doc.documentElement?.localName === "feed" ? doc.documentElement : null;
  if (!rss && !atom) throw new Error("Invalid RSS or Atom feed");
  const root = rss || atom;
  const title = shortText(root.querySelector("title")?.textContent, 72) || new URL(feedUrl).hostname;
  const home = feedHome(rss ? root.querySelector("link")?.textContent : atomLink(root), feedUrl);
  const entries = [...root.querySelectorAll(rss ? "item" : "entry")].map(node => ({
    title: node.querySelector("title")?.textContent,
    url: rss ? node.querySelector("link")?.textContent : atomLink(node),
    publishedAt: Date.parse(node.querySelector(rss ? "pubDate" : "published")?.textContent || node.querySelector("updated")?.textContent || ""),
    excerpt: openingText(rss
      ? node.getElementsByTagNameNS(CONTENT_NS, "encoded")[0]?.textContent || node.querySelector("description")?.textContent
      : node.querySelector("content")?.textContent || node.querySelector("summary")?.textContent, parser),
  }));
  const stories = normaliseNewsItems(entries, feedUrl);
  if (!stories.length) throw new Error("Feed has no usable stories");
  return { title, home, stories };
}
