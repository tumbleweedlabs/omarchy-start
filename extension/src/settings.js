/* Settings drawer. Every control writes through store.update(); changes apply live everywhere. */
import { getSettings, update, subscribe, getQuick, getIcon, replaceAll, DEFAULTS, QUICK_DEFAULT, MARKETS } from "./store.js";
import { addLink, editLink, quickIcon, reorder, remove, validTileId } from "./quick.js";
import { decodes } from "./qicon.js";
import { geocode } from "./weather.js";
import { connectWallpaper, hasWallpaperFileAccess, savedWallpaperHome, validHome } from "./omarchy-wallpaper.js";
import { selectOmarchyFolder, startOmarchyWatch, isOmarchyWatching } from "./omarchy-watch.js";
import { omarchyChanged } from "./theme.js";
import { feedPermission, selectedFeed, validFeedUrl } from "./news-feed.js";
import { PREDICTORS, providerOf, hasAccess, requestAccess, dropAccess } from "./predict.js";
import { $, el, icon, hostOf, toast, debounce, uid, normaliseUrl } from "./util.js";
import { systemTz, zoneLabel, timeIn } from "./clock.js";
import { getLocationState, setAutomaticLocation, refreshLocation, subscribeLocation } from "./location.js";
import { SCOPES } from "./search.js";

let open = false;
let selfChange = 0;
let geoResults = null;
let wallpaperHome = "";
let wallpaperFileGranted = false;
let folderFallbackVisible = false;
let startShortcut = null;
let ZONES = [];
let predAccess = false;   // whether this browser has granted the chosen prediction provider

async function connectOmarchy(useFolderPicker = false) {
  const status = message => { const node=document.getElementById("omarchy-connect-status"); if (node) node.textContent=message; };
  try {
    status("Connecting…");
    if (useFolderPicker) {
      const folderHome = await selectOmarchyFolder();
      if (!folderHome) {
        status("Couldn’t infer your username from that folder. Enter it above, then connect.");
        return;
      }
      wallpaperHome = folderHome.replace(/^\/home\//, "");
    }
    const entered = wallpaperHome.trim().replace(/\/$/, "");
    const path = /^[A-Za-z0-9_.-]+$/.test(entered) ? `/home/${entered}` : entered;
    if (!validHome(path)) {
      folderFallbackVisible = true;
      if (open) render();
      status("Enter your Linux username or home directory.");
      return;
    }
    await connectWallpaper(path);
    wallpaperFileGranted = true;
    folderFallbackVisible = false;
    if ('FileSystemObserver' in window && !isOmarchyWatching()) await startOmarchyWatch(omarchyChanged);
    const displayed = await omarchyChanged();
    render();
    status(displayed ? "Connected." : "Connected; wallpaper unavailable.");
  } catch (error) {
    wallpaperFileGranted = await hasWallpaperFileAccess();
    if (!useFolderPicker && /Cannot read Omarchy/.test(error.message)) folderFallbackVisible = true;
    if (open) render();
    status(error.name === "AbortError" ? "Folder selection cancelled." : `Couldn’t connect: ${error.message}`);
  }
}

export function initSettings() {
  const btn = $("#settings-btn");
  if (!btn.firstChild) btn.append(icon("gear-six"));
  btn.addEventListener("click", toggle);
  $("#drawer-veil").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); toggle(); }
    else if (e.key === "Escape" && open && !$("#dlg").open && $("#menu").hidden) { e.preventDefault(); close(); }
  });
  subscribe(async () => { if (open && !selfChange) { await refreshPredAccess(); render(); } });
  subscribeLocation(() => { if (open) render(); });
  chrome.permissions?.onAdded?.addListener(onPermChange);
  chrome.permissions?.onRemoved?.addListener(onPermChange);
  try { ZONES = Intl.supportedValuesOf("timeZone"); } catch { ZONES = []; }
}

function toggle() { open ? close() : show(); }

async function show() {
  open = true;
  const sectionToOpen = $("#settings-btn").dataset.openSection;
  delete $("#settings-btn").dataset.openSection;
  wallpaperHome = (await savedWallpaperHome()).replace(/^\/home\//, "");
  wallpaperFileGranted = await hasWallpaperFileAccess();
  startShortcut = await chrome.commands.getAll().then(commands => commands.find(command => command.name === "open-start-page")?.shortcut || "").catch(() => null);
  await refreshPredAccess();
  render();
  const d = $("#drawer");
  d.hidden = false;
  $("#drawer-veil").hidden = false;
  requestAnimationFrame(() => {
    d.classList.add("show"); $("#drawer-veil").classList.add("show");
    const body = d.querySelector(".drawer-body");
    const section = sectionToOpen && d.querySelector(`#set-section-${sectionToOpen}`);
    if (body && section) body.scrollTop += section.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    (section?.querySelector("#omarchy-connect") || d.querySelector(".drawer-close")).focus({ preventScroll: true });
  });
}

function close() {
  if (!open) return;
  open = false;
  const d = $("#drawer");
  d.classList.remove("show");
  $("#drawer-veil").classList.remove("show");
  setTimeout(() => { if (!open) { d.hidden = true; $("#drawer-veil").hidden = true; } }, 260);
  $("#settings-btn").focus();
}

async function set(mutator, rerender = false) {
  selfChange++;
  try { await update(mutator); } finally { selfChange--; }
  if (rerender) render();
}

/* ---------- web search predictions ---------- */
async function refreshPredAccess() { predAccess = await hasAccess(getSettings().search.engine); }
async function onPermChange() {
  if (!open) return;
  const previousPredAccess = predAccess;
  const previousWallpaperAccess = wallpaperFileGranted;
  [predAccess, wallpaperFileGranted] = await Promise.all([
    hasAccess(getSettings().search.engine),
    hasWallpaperFileAccess(),
  ]);
  if (predAccess !== previousPredAccess || wallpaperFileGranted !== previousWallpaperAccess) render();
}

async function setPredictions(on) {
  const p = providerOf(getSettings().search.engine);
  if (on && p) {
    if (!(await requestAccess(p))) { toast(`Access to ${PREDICTORS[p].label} was not allowed.`); render(); return; }
    predAccess = true;
  } else if (!on) { await dropAccess(); predAccess = false; }
  await set(x => { x.search.predictions = on; }, true);
}

async function setSearchEngine(id) {
  const p = providerOf(id);
  const on = getSettings().search.predictions;
  // Request while still handling the user's selection, then save the engine even if denied.
  const allowed = on && p ? await requestAccess(p) : false;
  await set(x => { x.search.engine = id; });
  await dropAccess(allowed ? p : undefined);
  predAccess = allowed;
  render();
}

async function allowPredictions() {
  const p = providerOf(getSettings().search.engine);
  if (!p || !(await requestAccess(p))) { toast("Prediction access was not allowed."); return; }
  predAccess = true; render();
}

function predictionRows(s) {
  const on = !!s.search.predictions;
  const p = providerOf(s.search.engine);
  const note = !p ? (s.search.engine === "browser"
    ? "Select a search engine to enable predictions."
    : "Predictions unavailable for this engine.")
    : on ? `Typed queries are sent to ${PREDICTORS[p].label}.`
    : "Typed queries are sent to the selected engine.";
  return [
    row("Show web search predictions", toggleCtl("set-pred", on, setPredictions, "Show web search predictions"), "Off by default"),
    el("p", { class: "set-note", id: "set-pred-note" }, note),
    on && p && !predAccess ? el("div", { class: "list-row" },
      el("p", { class: "set-note grow" }, `Allow ${PREDICTORS[p].label} predictions.`),
      el("button", { class: "btn sm", type: "button", id: "set-pred-allow", onclick: allowPredictions }, "Allow")) : "",
  ];
}

/* ---------- control builders ---------- */
let idn = 0;
const nid = (p) => `${p}-${++idn}`;

function row(label, control, hint) {
  return el("div", { class: "set-row" },
    el("div", { class: "set-label" }, el("span", {}, label), hint ? el("span", { class: "set-hint" }, hint) : ""),
    el("div", { class: "set-ctl" }, control));
}

function seg(id, value, options, onChange) {
  return el("div", { class: "seg", role: "radiogroup", id },
    options.map(([v, label]) => el("button", {
      type: "button", role: "radio", "aria-checked": String(v === value), class: "seg-btn",
      onclick: () => onChange(v),
    }, label)));
}

function toggleCtl(id, checked, onChange, label) {
  return el("button", {
    id, type: "button", role: "switch", class: "switch", "aria-checked": String(!!checked), "aria-label": label,
    onclick: () => onChange(!checked),
  }, el("span", { class: "knob" }));
}

function select(id, value, options, onChange, label) {
  const s = el("select", { id, class: "input select", "aria-label": label, onchange: (e) => onChange(e.target.value) },
    options.map(([v, l]) => el("option", { value: v, selected: v === value }, l)));
  return s;
}

function section(title, ...children) {
  return el("section", { class: "set-sec", id: `set-section-${title.toLowerCase().replace(/\s+/g, "-")}` }, el("h3", { class: "set-h" }, title), ...children);
}

/* ---------- render ---------- */
function render() {
  const d = $("#drawer");
  const scroll = d.querySelector(".drawer-body")?.scrollTop || 0;
  const focusId = document.activeElement && d.contains(document.activeElement) ? document.activeElement.id : null;
  idn = 0;
  const s = getSettings();

  const body = el("div", { class: "drawer-body" },
    appearance(s), clock(s), deviceLocation(s), clocks(s), weather(s), news(s), searchEngine(s), search(s), quick(s), backgrounds(s), data(), about());

  d.replaceChildren(
    el("header", { class: "drawer-head" },
      el("h2", {}, "Settings"),
      el("button", { class: "icon-btn drawer-close", type: "button", "aria-label": "Close settings", onclick: close }, icon("x"))),
    body);
  body.scrollTop = scroll;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function appearance(s) {
  return section("Appearance",
    row("Theme", seg("set-theme", s.theme, [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]], v => set(x => { x.theme = v; }, true)), "Auto follows your system"),
    row("Density", seg("set-density", s.density, [["auto", "Auto"], ["roomy", "Roomy"], ["comfortable", "Comfy"], ["compact", "Compact"]], v => set(x => { x.density = v; }, true))),
    row("Element transparency", (() => {
      const out = el("output", { class: "range-val" }, `${s.surfaceTransparency}%`);
      const r = el("input", {
        id: "set-transparency", type: "range", min: "0", max: "100", step: "5", value: String(s.surfaceTransparency), class: "range", "aria-label": "Element transparency",
        oninput: (e) => { out.textContent = `${e.target.value}%`; document.documentElement.style.setProperty("--surface-opacity", String(1 - Number(e.target.value) / 100)); },
        onchange: (e) => set(x => { x.surfaceTransparency = Number(e.target.value); }),
      });
      return el("div", { class: "range-wrap" }, r, out);
    })(), "Text remains opaque."),
    row("Background dim", (() => {
      const out = el("output", { class: "range-val" }, `${Math.round(s.dim * 100)}%`);
      const r = el("input", {
        id: "set-dim", type: "range", min: "0", max: "60", step: "5", value: String(Math.round(s.dim * 100)), class: "range", "aria-label": "Background dim",
        oninput: (e) => { out.textContent = `${e.target.value}%`; document.documentElement.style.setProperty("--dim", String(e.target.value / 100)); },
        onchange: (e) => set(x => { x.dim = Number(e.target.value) / 100; }),
      });
      return el("div", { class: "range-wrap" }, r, out);
    })()),
    row("Slow wallpaper zoom", toggleCtl("set-kb", s.kenBurns, v => set(x => { x.kenBurns = v; }, true), "Slow wallpaper zoom")));
}

function clock(s) {
  return section("Clock",
    row("24-hour clock", toggleCtl("set-h24", s.clock.h24, v => set(x => { x.clock.h24 = v; }, true), "24-hour clock")),
    row("Show seconds", toggleCtl("set-sec", s.clock.seconds, v => set(x => { x.clock.seconds = v; }, true), "Show seconds")),
    row("Show year in date", toggleCtl("set-year", s.clock.showYear, v => set(x => { x.clock.showYear = v; }, true), "Show year")),
    row("Analog clock face", toggleCtl("set-analog", s.clock.analog, v => set(x => { x.clock.analog = v; }, true), "Analog clock face")));
}

/* ---------- Clocks: my clock + 3 world clocks, set by city ---------- */
function deviceLocation(s) {
  const state = getLocationState();
  const fixed = s.fixedLocation;
  const q = el("input", { id: "set-geo", class: "input sm grow", placeholder: "Search for a city", "aria-label": "Search for a fixed location" });
  const find = async () => {
    const term = q.value.trim();
    if (!term) return;
    try { geoResults = (await geocode(term)).filter(r => r.tz); }
    catch { geoResults = []; toast("Couldn't search locations."); }
    render();
    document.getElementById("set-geo")?.focus();
  };
  q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); void find(); } });
  const results = geoResults ? el("div", { class: "geo-results" }, geoResults.length ? geoResults.map(r => el("button", {
    class: "geo-item", type: "button", onclick: async () => {
      geoResults = null;
      await set(x => { x.fixedLocation = { name: r.name, lat: r.lat, lon: r.lon, tz: r.tz }; }, true);
    },
  }, icon("map-pin"), r.name)) : el("p", { class: "set-note" }, "No locations found.")) : "";
  const status = state.phase === "detecting" ? "Detecting…" : state.error ? state.error
    : state.automatic ? (state.label || "Location unavailable; using fixed location.") : "";
  return section("Location",
    row("Location", seg("set-location-mode", state.automatic ? "auto" : "fixed", [["auto", "Auto detect"], ["fixed", "Fixed location"]], async v => {
      geoResults = null;
      try { await setAutomaticLocation(v === "auto"); } catch (e) { toast(e.message); }
      render();
    })),
    el("p", { class: "set-note" }, "Weather and local time. Auto sends coordinates to Open-Meteo and BigDataCloud."),
    state.automatic ? el("p", { class: "set-note", role: "status" }, status) : [
      row("Fixed location", el("span", { class: "set-value" }, icon("map-pin"), fixed.name)),
      fixed.tz ? "" : el("p", { class: "set-note", role: "status" }, "Time zone unavailable. Search again when online."),
      el("div", { class: "list-row" }, q, el("button", { class: "btn sm", type: "button", onclick: find }, icon("magnifying-glass"), "Find")), results,
    ],
    state.automatic && state.nameError ? el("p", { class: "set-note" }, state.nameError) : "");
}

let clockEdit = null;     // "my" | 0 | 1 | 2 | null

function clocks(s) {
  const rows = s.worldClocks.map((c, i) => clockRow(s, i, `World clock ${i + 1}`, c && c.label, c && c.tz, ""));
  return section("Clocks",
    el("div", { class: "clk-list" }, rows),
    row("Show world clocks", toggleCtl("set-wc", s.worldClocksShow, v => set(x => { x.worldClocksShow = v; }, true), "Show world clocks")));
}

function clockRow(s, key, title, label, tz, note) {
  const editing = clockEdit === key;
  const empty = !tz;
  const meta = empty ? el("span", { class: "clk-empty" }, "Not set")
    : el("span", { class: "clk-meta" }, el("span", { class: "clk-name" }, label),
        el("span", { class: "clk-sub" }, `${timeIn(tz, s)} · ${tzLong(tz)}`));
  const btns = el("div", { class: "clk-btns" },
    el("button", {
      class: "btn ghost sm", type: "button", id: `set-clk-${key}-edit`, "aria-expanded": String(editing),
      onclick: () => { clockEdit = editing ? null : key; render(); if (clockEdit !== null) document.getElementById("set-clk-q")?.focus(); },
    }, icon(empty ? "plus" : "map-pin"), empty ? "Set city" : (editing ? "Done" : "Change")),
    key !== "my" && !empty ? el("button", {
      class: "icon-btn sm", type: "button", title: "Remove", "aria-label": `Remove ${label}`,
      onclick: () => { if (clockEdit === key) clockEdit = null; set(x => { x.worldClocks[key] = null; }, true); },
    }, icon("trash")) : "");
  return el("div", { class: "clk-row" + (editing ? " editing" : "") },
    el("div", { class: "clk-head" },
      el("div", { class: "clk-info" }, el("span", { class: "clk-title" }, title), meta, note ? el("span", { class: "clk-note" }, note) : ""),
      btns),
    editing ? clockEditor(s, key, label, tz) : "");
}

function tzLong(tz) {
  try {
    const p = new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find(x => x.type === "timeZoneName");
    return p ? p.value : tz;
  } catch { return tz; }
}

function clockEditor(s, key, label, tz) {
  const results = el("div", { class: "clk-results", role: "listbox", "aria-label": "Matching places" });
  const q = el("input", { id: "set-clk-q", class: "input sm grow", placeholder: "Type a city, e.g. Tokyo or Seattle", "aria-label": "Search for a city", autocomplete: "off", spellcheck: "false" });
  let seq = 0;
  const choose = (place) => {
    clockEdit = null;
    set(x => {
      if (key === "my") x.myClock = { label: place.label, tz: place.tz };
      else x.worldClocks[key] = { label: place.label, tz: place.tz };
    }, true);
    toast(`${key === "my" ? "Your clock" : "World clock"} set to ${place.label}.`);
  };
  const show = (list, note) => {
    results.replaceChildren(...list.map(pl => el("button", {
      class: "geo-item", type: "button", role: "option", onclick: () => choose(pl),
    }, icon("map-pin"), el("span", { class: "geo-name" }, pl.display), el("span", { class: "geo-time" }, `${timeIn(pl.tz, s)} · ${tzLong(pl.tz)}`))),
      note ? el("p", { class: "set-note" }, note) : "");
  };
  const search = async () => {
    const term = q.value.trim();
    const my = ++seq;
    if (term.length < 2) { show([], ""); return; }
    const local = zoneMatches(term);
    show(local, local.length ? "" : "Searching…");
    try {
      const online = (await geocode(term)).filter(r => r.tz).map(r => ({ label: r.name.split(",")[0], display: r.name, tz: r.tz }));
      if (my !== seq) return;
      const seen = new Set();
      const merged = [...online, ...local].filter(pl => { const k = pl.label.toLowerCase() + "|" + pl.tz; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
      show(merged, merged.length ? "" : "No places found. Try a nearby major city.");
    } catch {
      if (my === seq) show(local, local.length ? "Offline: showing time-zone matches only." : "Couldn't search right now. Try a major city name, e.g. London.");
    }
  };
  const debounced = debounce(search, 280);
  q.addEventListener("input", debounced);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const first = results.querySelector(".geo-item"); if (first) first.click(); else search(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); clockEdit = null; render(); }
    if (e.key === "ArrowDown") { e.preventDefault(); results.querySelector(".geo-item")?.focus(); }
  });
  results.addEventListener("keydown", (e) => {
    const items = [...results.querySelectorAll(".geo-item")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i <= 0 ? q : items[i - 1]).focus(); }
  });

  const extras = [];
  if (tz) {
    const name = el("input", {
      id: `set-clk-name-${key}`, class: "input sm", value: label || "", "aria-label": "Name shown", placeholder: "Name shown",
      onchange: (e) => {
        const v = e.target.value.trim() || (key === "my" && !getSettings().myClock.tz ? "" : zoneLabel(tz));
        set(x => { if (key === "my") x.myClock.label = v; else if (x.worldClocks[key]) x.worldClocks[key].label = v; });
      },
    });
    extras.push(el("label", { class: "clk-rename" }, el("span", { class: "field-label" }, "Name shown"), name));
  }
  if (key === "my" && getSettings().myClock.tz) {
    extras.push(el("button", {
      class: "btn ghost sm", type: "button",
      onclick: () => { clockEdit = null; set(x => { x.myClock = { label: "", tz: "" }; }, true); toast("Your clock now follows this computer's time zone."); },
    }, icon("arrow-counter-clockwise"), "Use this computer's time zone"));
  }
  return el("div", { class: "clk-editor" }, el("div", { class: "list-row" }, q), results, ...extras);
}

/* Instant, offline matches against the browser's own time-zone list (e.g. "tok" → Asia/Tokyo). */
function zoneMatches(term) {
  const t = term.toLowerCase().replace(/\s+/g, " ");
  const out = [];
  for (const z of ZONES) {
    const city = zoneLabel(z);
    const c = city.toLowerCase();
    if (c.startsWith(t) || (t.length >= 3 && c.includes(t))) {
      const region = z.split("/")[0].replace(/_/g, " ");
      out.push({ label: city, display: `${city}, ${region}`, tz: z, rank: c.startsWith(t) ? 0 : 1 });
    }
  }
  return out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, 5);
}

function weather(s) {
  const w = s.weather;
  return section("Weather",
    row("Show weather", toggleCtl("set-w", w.show, v => set(x => { x.weather.show = v; }, true), "Show weather")),
    row("Units", seg("set-units", w.units, [["F", "°F"], ["C", "°C"]], v => set(x => { x.weather.units = v; }, true))),
    el("p", { class: "set-note" }, "Weather data by Open-Meteo.com."));
}

async function setNews(on) {
  try {
    const permission = feedPermission(selectedFeed(getSettings().news));
    if (on && permission && !(await chrome.permissions.request({ origins: [permission] }))) { toast("Feed access was not allowed."); render(); return; }
    await set(x => { x.news.show = on; }, true);
  } catch (error) {
    toast(`Couldn't change RSS setting: ${error.message}`);
    render();
  }
}

async function setNewsSource(source) {
  try {
    const news = { ...getSettings().news, source };
    const permission = feedPermission(selectedFeed(news));
    if (news.show && permission && !(await chrome.permissions.request({ origins: [permission] }))) { toast("Feed access was not allowed."); return; }
    await set(x => { x.news.source = source; }, true);
  } catch (error) { toast(`Couldn't change RSS source: ${error.message}`); }
}

async function connectCustomFeed() {
  const input = $("#set-rss-url");
  const url = validFeedUrl(input?.value);
  if (!url) { toast("Enter an HTTPS RSS or Atom URL."); input?.focus(); return; }
  try {
    if (!(await chrome.permissions.request({ origins: [feedPermission(url)] }))) { toast("Feed access was not allowed."); return; }
    await set(x => { x.news.customUrl = url; x.news.source = "custom"; x.news.show = true; }, true);
  } catch (error) { toast(`Couldn't save feed: ${error.message}`); }
}

function news(s) {
  return section("RSS",
    row("Enable RSS", toggleCtl("set-news", s.news.show, setNews, "Enable RSS")),
    s.news.show ? [
      row("Source", seg("set-rss-source", s.news.source, [["omarchy", "Omarchy news"], ["custom", "User specified"]], setNewsSource)),
      s.news.source === "custom" ? row("Feed URL", el("div", { class: "rss-url-controls" },
        el("input", { id: "set-rss-url", class: "input sm", type: "url", inputmode: "url", autocomplete: "url", spellcheck: false,
          placeholder: "https://example.org/feed.xml", value: s.news.customUrl, "aria-label": "RSS or Atom feed URL",
          onkeydown: event => { if (event.key === "Enter") { event.preventDefault(); void connectCustomFeed(); } } }),
        el("button", { class: "btn sm", type: "button", onclick: connectCustomFeed }, "Use feed"))) : "",
    ] : "");
}

function searchEngine(s) {
  const engines = [["browser", "Browser default"], ["google", "Google"], ["bing", "Bing"], ["duckduckgo", "DuckDuckGo"], ["brave", "Brave Search"], ["startpage", "Startpage"], ["ecosia", "Ecosia"], ["kagi", "Kagi"]];
  return section("Search engine",
    row("Web searches", select("set-search-engine", s.search.engine, engines, setSearchEngine, "Web search engine")),
    el("p", { class: "set-note" }, "Used for Web searches and predictions."));
}

function search(s) {
  const langs = [["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"], ["it", "Italiano"], ["nl", "Nederlands"], ["pl", "Polski"], ["pt", "Português"], ["ja", "日本語"], ["zh", "中文"]];
  return section("Search",
    el("p", { class: "set-note" }, "Web Archive sends URLs to the Internet Archive; use public URLs only."),
    row("Images from", select("set-img", s.search.images, [["google", "Google"], ["bing", "Bing"]], v => set(x => { x.search.images = v; }, true), "Image search provider")),
    row("Videos from", select("set-vid", s.search.videos, [["youtube", "YouTube"], ["bing", "Bing"]], v => set(x => { x.search.videos = v; }, true), "Video search provider")),
    row("Wikipedia language", select("set-wiki", s.search.wikiLang, langs, v => set(x => { x.search.wikiLang = v; }), "Wikipedia language")),
    row("Dictionary", select("set-dict", s.search.dictionary, [["mw", "Merriam-Webster"], ["cambridge", "Cambridge"]], v => set(x => { x.search.dictionary = v; }), "Dictionary")),
    row("Thesaurus", select("set-thes", s.search.thesaurus, [["mw", "Merriam-Webster"], ["tcom", "Thesaurus.com"]], v => set(x => { x.search.thesaurus = v; }), "Thesaurus")),
    ...predictionRows(s),
    row("Suggest links as I type", toggleCtl("set-sug", s.search.suggestTools, v => set(x => { x.search.suggestTools = v; }, true), "Suggest links")),
    row("Open results in a new tab", toggleCtl("set-snt", s.search.newTab, v => set(x => { x.search.newTab = v; }, true), "Open results in new tab")));
}

function quick(s) {
  const list = getQuick();
  const rows = list.map((q, i) => el("div", { class: "list-row qa-row" },
    quickIcon(q, { size: 32, px: 18 }),
    el("div", { class: "qa-meta" }, el("span", { class: "qa-name" }, q.name), el("span", { class: "qa-host" }, hostOf(q.url))),
    el("button", { class: "icon-btn sm", type: "button", title: "Move up", "aria-label": `Move ${q.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, icon("arrow-up")),
    el("button", { class: "icon-btn sm", type: "button", title: "Move down", "aria-label": `Move ${q.name} down`, disabled: i === list.length - 1, onclick: () => move(i, 1) }, icon("arrow-down")),
    el("button", { class: "icon-btn sm", type: "button", title: "Edit name, address or icon", "aria-label": `Edit ${q.name}`, onclick: async () => { await editLink(q); render(); } }, icon("pencil-simple")),
    el("button", { class: "icon-btn sm", type: "button", title: "Remove", "aria-label": `Remove ${q.name}`, onclick: async () => { await remove(q); render(); } }, icon("trash"))));
  async function move(i, d) {
    await reorder(i, i + d);
    render();
  }
  return section("Quick access",
    row("Show quick access", toggleCtl("set-qs", s.quickShow, v => set(x => { x.quickShow = v; }, true), "Show quick access")),
    el("div", { class: "list" }, rows.length ? rows : el("p", { class: "set-note" }, "No links yet.")),
    list.length < 12 ? el("button", { class: "btn ghost sm", type: "button", onclick: async () => { await addLink(); render(); } }, icon("plus"), "Add website") : "");
}

function backgrounds(s) {
  const picker = !!window.showDirectoryPicker;
  return section("Background",
    row("Show Omarchy wallpaper", toggleCtl("set-wallpaper", s.backgrounds.showWallpaper, v => set(x => { x.backgrounds.showWallpaper = v; }, true), "Show Omarchy wallpaper")),
    s.backgrounds.showWallpaper ? [
      el("div", {class:"background-connect"},
        el("p", {class:"set-note"}, "Enter your Linux username to connect the wallpaper."),
        el("input", {id:"omarchy-home",class:"input",type:"text",spellcheck:false,autocomplete:"off",placeholder:"username",value:wallpaperHome,"aria-label":"Linux username or home directory",oninput:e=>{wallpaperHome=e.target.value;} }),
        el("button", {id:"omarchy-connect",class:"btn sm",type:"button",onclick:()=>connectOmarchy()}, "Connect Omarchy"),
        picker && folderFallbackVisible ? el("button", {class:"btn ghost sm",type:"button",onclick:()=>connectOmarchy(true)}, "Choose folder instead") : "",
        picker && folderFallbackVisible ? el("p", {class:"set-note"}, "Select /home/username/.local/state/omarchy. Show hidden folders with Ctrl+H.") : "",
        wallpaperHome && !wallpaperFileGranted ? el("p", {class:"set-note"}, "Enable ‘Allow access to file URLs’ in extension details.") : "",
        el("p", {id:"omarchy-connect-status",class:"set-note",role:"status","aria-live":"polite"}, ""))
    ] : "");
}

function data() {
  const file = el("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: importFile });
  return section("Backup",
    el("div", { class: "btn-row" },
      el("button", { class: "btn sm", type: "button", onclick: exportFile }, icon("download-simple"), "Export"),
      el("button", { class: "btn sm", type: "button", onclick: () => file.click() }, icon("upload-simple"), "Import"),
      el("button", {
        class: "btn ghost sm danger", type: "button",
        onclick: async () => {
          if (!confirm("Reset all settings, quick links and saved legacy groups to defaults?")) return;
          try {
            await setAutomaticLocation(false);
            await replaceAll({ settings: DEFAULTS, quick: QUICK_DEFAULT, icons: {} });
            await chrome.storage.local.remove(["linkGroups", "omarchyNewsCache", "rssFeedCache"]);
          } catch (e) { toast(e.message); return; }
          render();
          toast("Settings reset.");
        },
      }, icon("arrow-counter-clockwise"), "Reset")),
    file);
}

async function exportFile() {
  const { linkGroups = [] } = await chrome.storage.local.get("linkGroups");
  const quick = getQuick().map(q => {
    const out = { id: q.id, name: q.name, url: q.url };
    if (validTileId(q.tileId)) out.tileId = q.tileId;
    if (q.useSiteIcon === true) out.useSiteIcon = true;
    const d = getIcon(q);
    if (d) out.icon = d;
    return out;
  });
  const blob = new Blob([JSON.stringify({ app: "omarchy-start", v: 2, settings: getSettings(), quick, linkGroups }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `omarchy-start-settings-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function importFile(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  let j;
  try {
    j = JSON.parse(await f.text());
    if (!j || j.app !== "omarchy-start" || typeof j.settings !== "object") throw new Error("format");
  } catch {
    toast("That file isn't an Omarchy Start settings export.");
    return;
  }
  // Accepts v1 (no icons) and v2 (icon data per link). Invalid or duplicate IDs get fresh ones.
  const seen = new Set();
  const quick = [], icons = {};
  let skipped = 0;
  for (const q of (Array.isArray(j.quick) ? j.quick : []).filter(q => q && typeof q.url === "string" && /^https?:\/\//i.test(q.url)).slice(0, 12)) {
    let id = typeof q.id === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(q.id) ? q.id : uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    const link = { id, name: String(q.name || hostOf(q.url)).slice(0, 60), url: q.url };
    if (validTileId(q.tileId)) link.tileId = q.tileId;
    if (q.useSiteIcon === true) link.useSiteIcon = true;
    if (q.icon != null) {
      if (await decodes(q.icon)) { link.ic = uid(); icons[id] = { r: link.ic, d: q.icon }; } else skipped++;
    }
    quick.push(link);
  }
  try {
    await replaceAll({ settings: j.settings, quick, icons });
    if (Array.isArray(j.linkGroups)) {
      const groups = j.linkGroups.slice(0, 30).filter(g => g && typeof g.name === "string" && Array.isArray(g.links)).map(g => ({ id: uid(), name: g.name.slice(0, 60), cols: Math.max(1, Math.min(8, Number(g.cols) || 3)), links: g.links.slice(0, 100).filter(q => q && typeof q.name === "string" && normaliseUrl(q.url)).map(q => ({ id: uid(), name: q.name.slice(0, 60), url: normaliseUrl(q.url) })) }));
      await chrome.storage.local.set({ linkGroups: groups });
    }
  } catch (x) {
    toast(`Import failed: ${x.message} Some settings may already have been imported.`, 5000);
    return;
  }
  render();
  toast(skipped ? `Settings imported. ${skipped} invalid icon${skipped === 1 ? " was" : "s were"} skipped.` : "Settings imported.");
}

function about() {
  const v = chrome.runtime.getManifest().version;
  const keys = [
    ["/", "Focus search within the page"],
    ...(startShortcut ? [[startShortcut, "Open Omarchy Start"]] : []),
    ...SCOPES.map((scope, index) => [`Alt+${index + 1}`, scope.label]),
    ["Ctrl+Enter", "Search in a new tab"],
    ["↓ ↑", "Pick a suggested link"],
    ["Ctrl+,", "Settings"],
  ];
  return section("Shortcuts",
    el("dl", { class: "keys" }, keys.flatMap(([k, d]) => [el("dt", {}, el("kbd", {}, k)), el("dd", {}, d)])),
    startShortcut === "" ? el("p", { class: "set-note", role: "status" }, "Alt+T is unassigned. Only one copy can use it. Open chrome://extensions/shortcuts and assign it to Omarchy Start.") : "",
    el("button", { class: "btn ghost sm", type: "button", onclick: async () => {
      close();
      await new Promise(resolve => setTimeout(resolve, 280));
      const { startTour } = await import("./tour.js");
      startTour();
    } }, "Replay tour"),
    el("p", { class: "set-note" }, `Omarchy Start ${v} · Icons by Phosphor`),
    el("p", { class: "set-note settings-credit" }, "Designed by Tumbleweed Labs · ",
      el("a", { href: "https://github.com/tumbleweedlabs/omarchy-start", target: "_blank", rel: "noopener noreferrer" }, "View source")));
}
