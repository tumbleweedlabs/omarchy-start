/* Keep the last successfully displayed Omarchy wallpaper for the next tab. */
const CACHE = 'omarchy-wallpaper-v1';
// CacheStorage only accepts HTTP(S) request keys; this reserved URL is never fetched.
const KEY = 'https://omarchy-start.invalid/cache/current-wallpaper';

function requestUrl() {
  return KEY;
}

export async function cachedWallpaper() {
  const cache = await caches.open(CACHE);
  const response = await cache.match(requestUrl());
  if (!response?.ok) return null;
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || !blob.size) return null;
  return { blob, stamp: response.headers.get('x-wallpaper-stamp') || '' };
}

export async function cacheWallpaper(blob, stamp) {
  const cache = await caches.open(CACHE);
  await cache.put(requestUrl(), new Response(blob, {
    headers: { 'content-type': blob.type, 'x-wallpaper-stamp': stamp },
  }));
}

export async function clearCachedWallpaper() {
  const cache = await caches.open(CACHE);
  await cache.delete(requestUrl());
}
