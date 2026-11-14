/* The only image background is the user's current Omarchy wallpaper. */
import { getSettings, subscribe } from "./store.js";
import { $ } from "./util.js";
import { readWallpaper } from "./omarchy-wallpaper.js";
import { cachedWallpaper, cacheWallpaper, clearCachedWallpaper } from "./wallpaper-cache.js";

let currentUrl = null;
let wallpaperStamp = "";
let generation = 0;
let request = 0;
const enabled = () => getSettings().backgrounds.showWallpaper;

function clearWallpaper() {
  ++generation;
  ++request;
  wallpaperStamp = "";
  for (const image of [$("#bg"), $("#bg-next")]) {
    image.classList.remove("show");
    image.removeAttribute("src");
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  const root = document.documentElement;
  root.dataset.backgroundSource = "color";
  root.style.removeProperty("--background-image");
  if (root.dataset.backgroundCacheUrl) URL.revokeObjectURL(root.dataset.backgroundCacheUrl);
  delete root.dataset.backgroundCacheUrl;
  delete root.dataset.backgroundCacheSource;
}

async function paint(url, id, immediate = false) {
  const valid = () => enabled() && id === request;
  const front = $("#bg"), back = $("#bg-next");
  if (!valid()) return false;
  if (!front.classList.contains("show")) {
    front.src = url;
    await front.decode();
    if (!valid()) return false;
    if (immediate) front.style.transition = "none";
    front.classList.add("show");
    if (immediate) setTimeout(() => front.style.removeProperty("transition"), 0);
  } else {
    back.src = url;
    await back.decode();
    if (!valid()) return false;
    back.classList.add("show");
    await new Promise(resolve => setTimeout(resolve, 450));
    if (!valid()) return false;
    front.src = url;
    await front.decode();
    back.classList.remove("show");
    back.removeAttribute("src");
  }
  if (currentUrl) setTimeout(old => URL.revokeObjectURL(old), 1200, currentUrl);
  currentUrl = url;
  return true;
}

async function restoreCachedWallpaper() {
  if (!enabled()) return false;
  const id = ++request;
  try {
    const cached = await cachedWallpaper();
    if (!cached || !enabled() || id !== request) return false;
    const url = URL.createObjectURL(cached.blob);
    try {
      if (!await paint(url, id, true)) { URL.revokeObjectURL(url); return false; }
    } catch (error) { URL.revokeObjectURL(url); throw error; }
    wallpaperStamp = cached.stamp;
    return true;
  } catch {
    await clearCachedWallpaper().catch(() => {});
    return false;
  }
}

export async function refreshBackground() {
  if (!enabled()) return false;
  const id = ++request;
  const currentGeneration = generation;
  try {
    const blob = await readWallpaper();
    if (!enabled() || id !== request || currentGeneration !== generation) return false;
    const stamp = `${blob.name}:${blob.lastModified}:${blob.size}`;
    if (stamp === wallpaperStamp && $("#bg").classList.contains("show")) return true;
    const url = URL.createObjectURL(blob);
    try {
      if (!await paint(url, id)) { URL.revokeObjectURL(url); return false; }
    } catch (error) { URL.revokeObjectURL(url); throw error; }
    wallpaperStamp = stamp;
    await cacheWallpaper(blob, stamp).catch(() => {});
    return true;
  } catch (_) {
    // Missing file access or an unconnected wallpaper is an expected state.
    // Keep the cached image (if any) and let Settings explain reconnection.
    return false;
  }
}

export async function initBackground() {
  let wasEnabled = enabled();
  if (!wasEnabled) clearWallpaper();
  subscribe((_, what) => {
    if (what !== "settings" || enabled() === wasEnabled) return;
    wasEnabled = enabled();
    if (wasEnabled) void restoreCachedWallpaper().then(() => refreshBackground());
    else clearWallpaper();
  });
  if (wasEnabled) {
    await restoreCachedWallpaper();
    void refreshBackground();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && enabled()) void refreshBackground(); });
}
