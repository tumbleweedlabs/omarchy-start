const assert = require("node:assert/strict");
const test = require("node:test");

test("RSS settings accept only HTTPS feed URLs and refresh after two hours", async () => {
  const feed = await import("../src/news-feed.js");
  assert.equal(feed.NEWS_MAX_AGE_MS, 2 * 60 * 60 * 1000);
  assert.equal(feed.selectedFeed({ source: "omarchy" }), feed.NEWS_FEED);
  assert.equal(feed.selectedFeed({ source: "custom", customUrl: "https://example.org/feed.xml" }), "https://example.org/feed.xml");
  assert.equal(feed.feedPermission("https://example.org/feed.xml"), "https://example.org/*");
  for (const url of ["http://example.org/feed", "https://user:pass@example.org/feed", "file:///tmp/feed.xml", "https://example.org:8443/feed"]) {
    assert.equal(feed.validFeedUrl(url), null);
  }
});

test("news keeps the newest three safe story links for the selected source", async () => {
  const { normaliseNewsItems, NEWS_FEED } = await import("../src/news-feed.js");
  const items = [
    { title: "Older", url: "https://omarchy.org/news/older", publishedAt: 10 },
    { title: " New\n story ", excerpt: "A  brief\n summary.", url: "https://omarchy.org/news/new", publishedAt: 40 },
    { title: "Duplicate", url: "https://omarchy.org/news/new", publishedAt: 35 },
    { title: "External", url: "https://elsewhere.org/news/evil", publishedAt: 50 },
    { title: "Script", url: "javascript:alert(1)", publishedAt: 60 },
    { title: "Middle", url: "https://omarchy.org/news/middle", publishedAt: 30 },
    { title: "Fourth", url: "https://omarchy.org/news/fourth", publishedAt: 20 },
  ];
  assert.deepEqual(normaliseNewsItems(items, NEWS_FEED).map(x => x.title), ["New story", "Middle", "Fourth"]);
  assert.deepEqual(normaliseNewsItems(items, "https://example.org/feed.xml").map(x => x.title), ["External", "New story", "Middle"]);
  assert.equal(normaliseNewsItems([{ title: "Missing link", publishedAt: 10 }], "https://example.org/feed.xml").length, 0);
});

test("RSS and Atom parsers extract source title, home, body text and stories", async () => {
  const { parseNewsFeed, NEWS_FEED } = await import("../src/news-feed.js");
  const node = (value, attrs = {}) => ({ textContent: value, getAttribute: key => attrs[key] || null });
  const entry = fields => ({
    querySelector: key => fields[key] ? node(fields[key]) : null,
    querySelectorAll: key => key === "link" ? fields.links || [] : [],
    getElementsByTagNameNS: () => fields.content ? [node(fields.content)] : [],
  });
  class FeedParser {
    parseFromString(_xml, type) {
      if (type === "text/html") return { body: { querySelectorAll: () => [node("Opening body text.")], textContent: "Opening body text." } };
      const rss = _xml.includes("rss");
      const root = rss
        ? { querySelector: key => ({ title: node("Omarchy news"), link: node("https://omarchy.org/news/") })[key] || null,
            querySelectorAll: () => [entry({ title: "RSS story", link: "https://omarchy.org/news/rss-story", pubDate: "Fri, 13 Nov 2026 12:00:00 GMT", content: "<p>Opening body text.</p>" })] }
        : { localName: "feed", querySelector: key => key === "title" ? node("Example Journal") : null,
            querySelectorAll: key => key === "link" ? [node("", { href: "https://example.org/", rel: "alternate" })]
              : [entry({ title: "Atom story", published: "Fri, 13 Nov 2026 12:00:00 GMT", summary: "<p>Opening body text.</p>", links: [node("", { href: "https://example.org/stories/one", rel: "alternate" })] })] };
      return { querySelector: key => key === "rss > channel" && rss ? root : null, documentElement: rss ? null : root };
    }
  }
  const rss = parseNewsFeed("<rss/>", NEWS_FEED, FeedParser);
  assert.equal(rss.title, "Omarchy news");
  assert.equal(rss.stories[0].excerpt, "Opening body text.");
  const atom = parseNewsFeed("<feed/>", "https://example.org/atom.xml", FeedParser);
  assert.equal(atom.title, "Example Journal");
  assert.equal(atom.home, "https://example.org/");
  assert.equal(atom.stories[0].url, "https://example.org/stories/one");
});
