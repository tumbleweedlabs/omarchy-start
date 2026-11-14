const assert = require("node:assert/strict");
const test = require("node:test");

test("local store migrates wallpaper choice, saves RSS settings and quick icons, and preserves state on failed writes", async t => {
  const descriptors = new Map(["chrome", "navigator", "localStorage"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => {
    for (const [k, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor);
      else delete globalThis[k];
    }
  });
  const saved = { localStorageMigration: "complete", settings: { backgrounds: { source: "bing" } } }, listeners = [];
  let fail = false, fullReads = 0;
  globalThis.chrome = { storage: {
    local: {
      async get(keys) {
        if (keys === null) fullReads++;
        return structuredClone(keys === null ? saved : Object.fromEntries(keys.map(k => [k, saved[k]])));
      },
      async getBytesInUse() { return 0; },
      async set(items) {
        if (fail) throw new Error("QUOTA_BYTES");
        const changes = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: saved[k], newValue: v };
          saved[k] = structuredClone(v);
        }
        listeners.forEach(fn => fn(changes, "local"));
      },
      async remove(keys) { keys.forEach(k => delete saved[k]); },
    },
    sync: { async get() { throw new Error("Sync reads forbidden"); }, async set() { throw new Error("Sync writes forbidden"); } },
    onChanged: { addListener(fn) { listeners.push(fn); } },
  } };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { async request(_, fn) { return fn(); } } } });
  globalThis.localStorage = { setItem() {} };
  const store = await import("../src/store.js");
  delete saved.settings;
  await store.loadSettings();
  assert.equal(store.getSettings().density, "comfortable");
  assert.equal(store.getSettings().clock.h24, true);
  assert.equal(store.getSettings().news.show, true);
  assert.deepEqual(store.getQuick(), store.QUICK_DEFAULT);
  saved.settings = { backgrounds: { source: "bing" } };
  await store.loadSettings();
  assert.equal(fullReads, 2, "completed migration reads local settings once per startup");
  assert.equal(store.getSettings().backgrounds.showWallpaper, false);
  assert.equal(store.getSettings().density, "comfortable");
  assert.equal(store.getSettings().clock.h24, true);
  assert.equal(store.getSettings().news.show, true);
  assert.deepEqual(store.getQuick(), [], "an existing profile without links keeps its empty list");
  await store.update(s => { s.backgrounds.showWallpaper = true; s.news = { show: true, source: "custom", customUrl: "https://example.org/feed.xml" }; });
  assert.equal(saved.settings.backgrounds.showWallpaper, true);
  assert.equal(saved.settings.news.customUrl, "https://example.org/feed.xml");
  const snapshot = structuredClone(store.getSettings());
  fail = true;
  await assert.rejects(store.update(s => { s.news.customUrl = "https://other.org/rss"; }), /storage is full/);
  assert.deepEqual(store.getSettings(), snapshot);
  fail = false;
  const icon = { r: "revision", d: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2kAAAAASUVORK5CYII=" };
  await store.setQuick([{ id: "one", name: "One", url: "https://example.invalid/", ic: icon.r }], { one: icon });
  assert.deepEqual(saved["qi:one"], icon);
  assert.equal(store.getIcon(store.getQuick()[0]), icon.d);
  const backup = { settings: structuredClone(store.getSettings()), quick: structuredClone(store.getQuick()), icons: { one: icon } };
  listeners.forEach(fn => fn({ settings: { newValue: { theme: "wrong" } } }, "sync"));
  assert.deepEqual(store.getSettings(), backup.settings);
  await store.replaceAll({ settings: store.DEFAULTS, quick: [] });
  assert.equal(store.getSettings().backgrounds.showWallpaper, true);
  assert.equal(store.getSettings().news.show, true);
  assert.equal(saved["qi:one"], undefined);
  await store.replaceAll(backup);
  assert.equal(store.getSettings().news.customUrl, "https://example.org/feed.xml");
  assert.equal(store.getIcon(store.getQuick()[0]), icon.d);
  await store.replaceAll({ settings: { news: { show: true, source: "custom", customUrl: "http://insecure.test/rss" } }, quick: [] });
  assert.equal(store.getSettings().news.customUrl, "");
});
