/* Settings store: defaults + chrome.storage.local, live change events across tabs.
   Quick-access links live under their own key,
   and each custom link icon has its own "qi:<link id>" key. */
import { ICON_KEY_PREFIX, iconKey, itemBytes, validIconData } from "./qicon.js";
import { localStorageReady } from "./storage.js";
import { validFeedUrl } from "./news-feed.js";

export const MARKETS = [
  ["en-US", "United States"], ["en-GB", "United Kingdom"], ["en-CA", "Canada"], ["en-AU", "Australia"],
  ["en-IN", "India"], ["de-DE", "Germany"], ["fr-FR", "France"], ["ja-JP", "Japan"], ["zh-CN", "China"],
  ["es-ES", "Spain"], ["it-IT", "Italy"], ["pt-BR", "Brazil"], ["en-NZ", "New Zealand"],
];

export const DEFAULTS = {
  v: 1,
  theme: "auto",            // auto | light | dark
  density: "comfortable",   // auto | roomy | comfortable (Comfy) | compact
  surfaceTransparency: 10, // percentage: 0 opaque, 100 transparent
  dim: 0.15,                // 0 – 0.6
  blur: 0,                 // px: 0 | 10 | 20 | 32
  kenBurns: true,
  clock: { h24: true, seconds: false, showYear: false, analog: true },
  fixedLocation: null,
  myClock: { label: "", tz: "" },   // tz "" = follow this computer; label "" = "Local time"
  worldClocksShow: true,
  worldClocks: [
    { label: "London", tz: "Europe/London" },
    { label: "New York", tz: "America/New_York" },
    { label: "Hong Kong", tz: "Asia/Hong_Kong" },
  ],
  weather: { show: true, name: "Seattle, WA", lat: 47.6062, lon: -122.3321, units: "F" },
  search: {
    engine: "browser", images: "google", videos: "youtube", wikiLang: "en", dictionary: "mw", thesaurus: "mw",
    newTab: false, suggestTools: true, predictions: false, predictProvider: "bing",
  },
  quickShow: true,
  news: { show: true, source: "omarchy", customUrl: "" },
  tiles: { view: "carousel", hiddenGroups: [], hiddenTiles: [], newTab: false, badges: true },
  backgrounds: { showWallpaper: true },
};

export const QUICK_DEFAULT = [{ id: "omarchy", name: "Omarchy", url: "https://omarchy.org/" }];

let settings = structuredClone(DEFAULTS);
let quick = [];
let icons = {};             // link id → { r: revision, d: data URL }, key "qi:<id>"
const listeners = new Set();

const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES || 10485760;

export class StorageError extends Error {}

function storageError(e) {
  if (e instanceof StorageError) return e;
  const m = String((e && e.message) || e);
  if (/MAX_WRITE_OPERATIONS/i.test(m)) return new StorageError("Too many changes in a short time. Wait a minute, then try again.");
  if (/QUOTA/i.test(m)) return new StorageError("Local browser storage is full. Remove a custom icon or quick link, then try again.");
  return new StorageError("Couldn't save to browser storage. Try again.");
}

/** Reject writes that would exceed the total local quota, counting what they replace. */
async function checkQuota(items) {
  let add = 0;
  for (const [k, v] of Object.entries(items)) {
    const b = itemBytes(k, v);
    add += b;
  }
  const [used, replaced] = await Promise.all([
    chrome.storage.local.getBytesInUse(null),
    chrome.storage.local.getBytesInUse(Object.keys(items)),
  ]);
  if (used - replaced + add > LOCAL_QUOTA) throw new StorageError("Not enough local browser storage for this change. Remove a custom icon or quick link, then try again.");
}

async function write(items) {
  try {
    await localStorageReady();
    await checkQuota(items);
    await chrome.storage.local.set(items);
  } catch (e) { throw storageError(e); }
}

function validIconRecord(v) { return v && typeof v === "object" && typeof v.r === "string" && validIconData(v.d); }

function isObj(o) { return o && typeof o === "object" && !Array.isArray(o); }
export function merge(base, over) {
  if (!isObj(over)) return structuredClone(base);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (isObj(v) && isObj(base[k])) out[k] = merge(base[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

export const WORLD_SLOTS = 3;
function normalise(st) {
  st.surfaceTransparency = Number.isFinite(st.surfaceTransparency) ? Math.max(0, Math.min(100, st.surfaceTransparency)) : 10;
  delete st.pomodoro;
  if (!isObj(st.news)) st.news = structuredClone(DEFAULTS.news);
  st.news.show = st.news.show === true;
  st.news.source = st.news.source === "custom" ? "custom" : "omarchy";
  st.news.customUrl = validFeedUrl(st.news.customUrl) || "";
  const wc = Array.isArray(st.worldClocks) ? st.worldClocks : [];
  st.worldClocks = Array.from({ length: WORLD_SLOTS }, (_, i) => {
    const c = wc[i];
    return c && typeof c.tz === "string" && c.tz ? { label: String(c.label || c.tz.split("/").pop().replace(/_/g, " ")), tz: c.tz } : null;
  });
  if (st.search) delete st.search.autofocus;
  if (!st.fixedLocation || typeof st.fixedLocation !== "object") {
    const w = st.weather || DEFAULTS.weather;
    const seattle = Math.abs(w.lat - 47.6062) < 0.001 && Math.abs(w.lon + 122.3321) < 0.001;
    st.fixedLocation = { name: w.name, lat: w.lat, lon: w.lon, tz: seattle ? "America/Los_Angeles" : "" };
  }
  if (!st.myClock || typeof st.myClock !== "object") st.myClock = { label: "", tz: "" };
  if (!isObj(st.backgrounds)) st.backgrounds = structuredClone(DEFAULTS.backgrounds);
  if (typeof st.backgrounds.source === "string") st.backgrounds.showWallpaper = st.backgrounds.source === "omarchy";
  else if (typeof st.backgrounds.showWallpaper !== "boolean") st.backgrounds.showWallpaper = true;
  delete st.backgrounds.source;
  delete st.backgrounds.markets;
  delete st.backgrounds.caption;
  delete st.backgrounds.pinnedPhoto;
  return st;
}

function mirrorBoot() {
  try {
    localStorage.setItem("ant:boot", JSON.stringify({
      theme: settings.theme, density: settings.density, dim: settings.dim,
      blur: settings.blur, surfaceTransparency: settings.surfaceTransparency,
      showWallpaper: settings.backgrounds.showWallpaper,
    }));
    if (globalThis.document?.documentElement) document.documentElement.dataset.backgroundSource = settings.backgrounds.showWallpaper ? "omarchy" : "color";
  } catch { /* ignore */ }
}

function emit(what) { for (const fn of listeners) fn(settings, what); }

export async function loadSettings() {
  let got = await chrome.storage.local.get(null);
  // The completed migration marker is included in this read, so ordinary new
  // tabs skip a second storage read and a cross-context lock.
  if (got.localStorageMigration !== "complete") {
    await localStorageReady();
    got = await chrome.storage.local.get(null);
  }
  settings = normalise(merge(DEFAULTS, got.settings));
  if (got.pomodoroState !== undefined) void chrome.storage.local.remove("pomodoroState").catch(() => {});
  quick = Array.isArray(got.quick) ? got.quick : got.settings === undefined ? structuredClone(QUICK_DEFAULT) : [];
  icons = {};
  for (const [k, v] of Object.entries(got)) {
    if (k.startsWith(ICON_KEY_PREFIX) && validIconRecord(v)) icons[k.slice(ICON_KEY_PREFIX.length)] = v;
  }
  mirrorBoot();
  return settings;
}

export const getSettings = () => settings;
export const getQuick = () => quick;

/** The custom icon for a link, or null. Only used once its data matches the link's revision,
    so cross-tab deliveries in either order fall back until both arrive. */
export function getIcon(q) {
  const rec = q && q.ic && icons[q.id];
  return rec && rec.r === q.ic ? rec.d : null;
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** update(s => { s.theme = "dark"; }) — persists and notifies. */
export async function update(mutator) {
  const next = structuredClone(settings);
  mutator(next);
  const normalised = normalise(next);
  await write({ settings: normalised });
  settings = normalised;
  mirrorBoot();
  emit("settings");
}

function applyQuick(list, iconRecs = {}, drop = []) {
  let changed = JSON.stringify(list) !== JSON.stringify(quick);
  quick = list;
  for (const [id, rec] of Object.entries(iconRecs)) {
    if (JSON.stringify(icons[id]) !== JSON.stringify(rec)) { icons[id] = rec; changed = true; }
  }
  for (const id of drop) if (icons[id]) { delete icons[id]; changed = true; }
  if (changed) emit("quick");
}

/**
 * Persist the link list, plus any new icon records ({ id: { r, d } }) in the same write.
 * Local state changes only after the write succeeds; throws StorageError otherwise.
 * Afterwards, removes icon keys for links this change deleted or switched away from a custom icon.
 */
export async function setQuick(list, iconRecs = {}) {
  const prev = quick;
  const items = { quick: list };
  for (const [id, rec] of Object.entries(iconRecs)) items[iconKey(id)] = rec;
  await write(items);
  const kept = new Map(list.map(q => [q.id, q]));
  const stale = prev
    .filter(p => p.ic && (!kept.has(p.id) || !kept.get(p.id).ic))
    .map(p => p.id)
    .filter(id => !iconRecs[id]);
  applyQuick(list, iconRecs, stale);
  if (stale.length) await chrome.storage.local.remove(stale.map(iconKey));
}

/** Replace settings, links and icons (import / reset). Old icon keys are removed only after the new data is saved. */
export async function replaceAll(data) {
  const nextSettings = normalise(merge(DEFAULTS, data && data.settings));
  const nextQuick = Array.isArray(data && data.quick) ? data.quick : [];
  const nextIcons = (data && data.icons) || {};
  const items = { settings: nextSettings, quick: nextQuick };
  for (const [id, rec] of Object.entries(nextIcons)) items[iconKey(id)] = rec;
  const stored = Object.keys(await chrome.storage.local.get(null)).filter(k => k.startsWith(ICON_KEY_PREFIX));
  const obsolete = [...new Set([...Object.keys(icons).map(iconKey), ...stored])].filter(k => !(k in items));
  // Make room first when the old icons are what stands in the way; nothing else is discarded before saving.
  await write(items).catch(async (e) => {
    if (!obsolete.length) throw e;
    const backup = await chrome.storage.local.get(obsolete);
    await chrome.storage.local.remove(obsolete);
    try { await write(items); } catch (e2) { await chrome.storage.local.set(backup); throw e2; }
  });
  settings = nextSettings;
  mirrorBoot();
  emit("settings");
  applyQuick(nextQuick, nextIcons, Object.keys(icons).filter(id => !nextIcons[id]));
  if (obsolete.length) await chrome.storage.local.remove(obsolete);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) {
    const nv = normalise(merge(DEFAULTS, changes.settings.newValue));
    if (JSON.stringify(nv) !== JSON.stringify(settings)) { settings = nv; mirrorBoot(); emit("settings"); }
  }
  const recs = {}, drop = [];
  for (const [k, c] of Object.entries(changes)) {
    if (!k.startsWith(ICON_KEY_PREFIX)) continue;
    const id = k.slice(ICON_KEY_PREFIX.length);
    if (validIconRecord(c.newValue)) recs[id] = c.newValue; else drop.push(id);
  }
  if (changes.quick || Object.keys(recs).length || drop.length) {
    applyQuick(changes.quick ? (changes.quick.newValue || []) : quick, recs, drop);
  }
});
