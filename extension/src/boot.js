/* Applies theme/density from a local settings mirror before first paint. */
(function () {
  var b = {};
  try { b = JSON.parse(localStorage.getItem("ant:boot") || "{}"); } catch (e) { b = {}; }
  var root = document.documentElement;
  var theme = b.theme || "auto";
  var dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  var density = b.density || "auto";
  var h = window.innerHeight;
  root.dataset.density = density === "auto" ? (h < 680 ? "tight" : h < 820 ? "compact" : "comfortable") : density;
  if (typeof b.surfaceTransparency === "number") root.style.setProperty("--surface-opacity", String(1 - Math.max(0, Math.min(100, b.surfaceTransparency)) / 100));
  if (typeof b.dim === "number") root.style.setProperty("--dim", String(b.dim));
  if (typeof b.blur === "number") root.style.setProperty("--blur", b.blur + "px");
  var showWallpaper = typeof b.showWallpaper === "boolean" ? b.showWallpaper : b.backgroundSource ? b.backgroundSource === "omarchy" : true;
  root.dataset.backgroundSource = showWallpaper ? "omarchy" : "color";
  try {
    localStorage.removeItem("ant:background-previews");
    localStorage.removeItem("ant:wallpaper-preview");
  } catch (e) { /* Old thumbnails can be discarded later. */ }
  // Start the original-byte cache read before the page's modules or settings load.
  // The image is only shown for the source that is still selected when it arrives.
  try {
    if (!showWallpaper) return;
    caches.open("omarchy-wallpaper-v1").then(function (cache) { return cache.match("https://omarchy-start.invalid/cache/current-wallpaper"); }).then(function (response) {
      return response && response.ok ? response.blob() : null;
    }).then(function (blob) {
      if (!blob || !blob.size || !blob.type.startsWith("image/") || root.dataset.backgroundSource !== "omarchy") return;
      if (root.dataset.backgroundCacheSource === "omarchy" && root.dataset.backgroundCacheUrl) return;
      var url = URL.createObjectURL(blob);
      if (root.dataset.backgroundSource !== "omarchy") { URL.revokeObjectURL(url); return; }
      var previous = root.dataset.backgroundCacheUrl;
      root.style.setProperty("--background-image", 'url("' + url + '")');
      root.dataset.backgroundCacheUrl = url;
      root.dataset.backgroundCacheSource = "omarchy";
      if (previous) URL.revokeObjectURL(previous);
    }).catch(function () { /* The page can still load its source normally. */ });
  } catch (e) { /* Cache Storage may be unavailable. */ }
})();
