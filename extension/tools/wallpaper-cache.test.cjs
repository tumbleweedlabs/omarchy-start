const test = require('node:test');
const assert = require('node:assert/strict');

test('last Omarchy wallpaper survives a tab reload and can be replaced', async t => {
  const oldCaches = globalThis.caches;
  t.after(() => { globalThis.caches = oldCaches; });
  const entries = new Map();
  globalThis.caches = { open: async name => {
    assert.equal(name, 'omarchy-wallpaper-v1');
    return {
      match: async key => entries.get(key)?.clone(),
      put: async (key, response) => { entries.set(key, response.clone()); },
      delete: async key => entries.delete(key),
    };
  } };
  const cache = await import('../src/wallpaper-cache.js');
  assert.equal(await cache.cachedWallpaper(), null);
  const first = new Blob(['first'], { type: 'image/png' });
  await cache.cacheWallpaper(first, 'background:1:5');
  assert.equal(await (await cache.cachedWallpaper()).blob.text(), 'first');
  const second = new Blob(['second'], { type: 'image/png' });
  await cache.cacheWallpaper(second, 'background:2:6');
  const restored = await cache.cachedWallpaper();
  assert.equal(restored.stamp, 'background:2:6');
  assert.equal(await restored.blob.text(), 'second');
  await cache.clearCachedWallpaper();
  assert.equal(await cache.cachedWallpaper(), null);
});
