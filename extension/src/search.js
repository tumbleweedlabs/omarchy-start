import { getSettings, subscribe } from "./store.js";
import { $, el, icon, looksLikeUrl, normaliseUrl, openUrl, toast } from "./util.js";
import { suggest, closeSuggest, moveSelection, openSelected, hasSelection, isOpen } from "./suggest.js";
import { showMenu } from "./menu.js";

export const SCOPES = [
  { id: "web", label: "Web", icon: "globe-simple", ph: "Search the web or your links" },
  { id: "plugins", label: "Omarchy plugins", icon: "buildings", ph: "Search Omarchy plugins" },
  { id: "github", label: "GitHub", icon: "globe-simple", ph: "Search GitHub repositories" },
  { id: "images", label: "Images", icon: "image", ph: "Search images" },
  { id: "videos", label: "Videos", icon: "play-circle", ph: "Search videos" },
  { id: "wikipedia", label: "Wikipedia", icon: "book-open-text", ph: "Search Wikipedia" },
  { id: "dictionary", label: "Dictionary", icon: "book-bookmark", ph: "Look up a word" },
  { id: "thesaurus", label: "Thesaurus", icon: "arrows-left-right", ph: "Find synonyms" },
  { id: "archive", label: "Web Archive", icon: "bank", ph: "Paste a public URL to open its latest saved copy" },
];

export const WEB_ENGINES = {
  google: "https://www.google.com/search?q=%s",
  bing: "https://www.bing.com/search?q=%s",
  duckduckgo: "https://duckduckgo.com/?q=%s",
  brave: "https://search.brave.com/search?q=%s",
  startpage: "https://www.startpage.com/sp/search?query=%s",
  ecosia: "https://www.ecosia.org/search?q=%s",
  kagi: "https://kagi.com/search?q=%s",
};

export const PROVIDERS = {
  archive: "https://archive.org/wayback/available?url=%s",
  github: "https://github.com/search?type=repositories&q=%s",
  plugins: "https://plugins.omarchy.org/?q=%s#catalog",
  images: { google: "https://www.google.com/search?udm=2&q=%s", bing: "https://www.bing.com/images/search?q=%s" },
  videos: { youtube: "https://www.youtube.com/results?search_query=%s", bing: "https://www.bing.com/videos/search?q=%s" },
  wikipedia: "https://%l.wikipedia.org/w/index.php?search=%s",
  dictionary: { mw: "https://www.merriam-webster.com/dictionary/%s", cambridge: "https://dictionary.cambridge.org/dictionary/english/%s" },
  thesaurus: { mw: "https://www.merriam-webster.com/thesaurus/%s", tcom: "https://www.thesaurus.com/browse/%s" },
};

const BANGS = {
  "!gh": "github", "!op": "plugins", "!i": "images", "!img": "images", "!v": "videos", "!vid": "videos", "!yt": "videos",
  "!w": "wikipedia", "!wiki": "wikipedia", "!web": "web", "!g": "web",
  "!d": "dictionary", "!def": "dictionary", "!t": "thesaurus", "!syn": "thesaurus",
};

let scope = "web";
let archiveController = null;

export function initSearch() {
  scope = "web";
  renderScope();
  const input = $("#q");
  const form = $("#search-form");
  const clear = $("#q-clear");
  clear.append(icon("x"));

  $("#scope-btn").addEventListener("click", openScopeMenu);
  $("#scope-btn").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openScopeMenu(); }
  });

  form.addEventListener("submit", (e) => { e.preventDefault(); submit(false); });
  input.addEventListener("input", () => {
    cancelArchiveSearch();
    clear.hidden = !input.value;
    suggest(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || (e.key === "Tab" && isOpen() && !e.shiftKey && !hasSelection())) {
      if (isOpen()) { e.preventDefault(); moveSelection(1); }
    } else if (e.key === "ArrowUp") {
      if (isOpen()) { e.preventDefault(); moveSelection(-1); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const newTab = e.ctrlKey || e.metaKey;
      if (hasSelection()) openSelected(newTab);
      else submit(newTab);
    } else if (e.key === "Escape") {
      cancelArchiveSearch();
      if (isOpen()) closeSuggest();
      else { input.value = ""; clear.hidden = true; }
    }
  });
  input.addEventListener("blur", () => setTimeout(() => { if (!document.activeElement || !document.activeElement.closest("#suggest")) closeSuggest(); }, 120));
  clear.addEventListener("click", () => { cancelArchiveSearch(); input.value = ""; clear.hidden = true; closeSuggest(); input.focus(); });

  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable], dialog, .drawer");
    if (e.key === "/" && !typing) { e.preventDefault(); input.focus(); input.select(); }
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      setScope(SCOPES[Number(e.key) - 1].id);
      input.focus();
    }
  });

  focusSearch();
  window.addEventListener("pageshow", focusSearch);
  window.addEventListener("pagehide", cancelArchiveSearch);
  window.addEventListener("focus", () => {
    const active = document.activeElement;
    if (!active || active === document.body) focusSearch();
  });
  subscribe((st, what) => { if (what === "settings") renderScope(); });
}

export function focusSearch() {
  const input = $("#q");
  if (document.activeElement !== input) input.focus({ preventScroll: true });
}

function openScopeMenu() {
  const b = $("#scope-btn");
  const r = b.getBoundingClientRect();
  showMenu(r.left - 4, r.bottom + 8, SCOPES.map((sc, i) => ({
    label: sc.label, icon: sc.icon, hint: `Alt+${i + 1}`, checked: sc.id === scope,
    action: () => { setScope(sc.id); $("#q").focus(); },
  })), b, { wide: true });
}

function renderScope() {
  const cur = SCOPES.find(x => x.id === scope) || SCOPES[0];
  const b = $("#scope-btn");
  b.replaceChildren(icon(cur.icon), el("span", { class: "scope-label" }, cur.label), icon("caret-down", "caret"));
  b.title = `Searching ${cur.label}. Click to change (Alt+1–9)` +
    (scope === "archive" ? ". Submitting sends this URL to the Internet Archive." : "");
  b.setAttribute("aria-label", `Search in: ${cur.label}. Change`);
  b.dataset.scope = cur.id;
  $("#q").placeholder = `${cur.ph} · Alt+1–9 to switch search type`;
}

export function setScope(id) {
  cancelArchiveSearch();
  scope = id;
  renderScope();
  const input = $("#q");
  if (input.value) suggest(input.value);
}

export function getScope() { return SCOPES.find(x => x.id === scope) || SCOPES[0]; }

function submit(newTab) {
  const input = $("#q");
  let text = input.value.trim();
  if (!text) return;
  let sc = scope;
  const m = /^(![a-z]+)\s+(.+)$/i.exec(text);
  if (m && BANGS[m[1].toLowerCase()]) { sc = BANGS[m[1].toLowerCase()]; text = m[2]; }
  runSearch(text, sc, newTab || getSettings().search.newTab);
}

export function runSearch(text, sc, newTab) {
  cancelArchiveSearch();
  const s = getSettings();
  if (sc === "archive") {
    closeSuggest();
    void openLatestArchive(text, newTab);
    return;
  }
  if (sc === "web") {
    if (looksLikeUrl(text)) {
      openUrl(/^https?:\/\//i.test(text) ? text : "https://" + text, newTab);
      return;
    }
    const engine = WEB_ENGINES[s.search.engine];
    if (engine) openUrl(engine.replace("%s", encodeURIComponent(text)), newTab);
    else chrome.search.query({ text, disposition: newTab ? "NEW_TAB" : "CURRENT_TAB" });
    return;
  }
  let tpl;
  if (sc === "github") tpl = PROVIDERS.github;
  else if (sc === "plugins") tpl = PROVIDERS.plugins;
  else if (sc === "images") tpl = PROVIDERS.images[s.search.images] || PROVIDERS.images.google;
  else if (sc === "videos") tpl = PROVIDERS.videos[s.search.videos] || PROVIDERS.videos.youtube;
  else if (sc === "wikipedia") tpl = PROVIDERS.wikipedia.replace("%l", encodeURIComponent(s.search.wikiLang || "en"));
  else if (sc === "dictionary") tpl = PROVIDERS.dictionary[s.search.dictionary] || PROVIDERS.dictionary.mw;
  else if (sc === "thesaurus") tpl = PROVIDERS.thesaurus[s.search.thesaurus] || PROVIDERS.thesaurus.mw;
  if (!tpl) return;
  // Dictionary sites expect a single lower-case headword in the path.
  const q = (sc === "dictionary" || sc === "thesaurus") ? encodeURIComponent(text.toLowerCase()) : encodeURIComponent(text);
  openUrl(tpl.replace("%s", q), newTab);
}

function cancelArchiveSearch() {
  archiveController?.abort();
  archiveController = null;
}

async function openLatestArchive(text, newTab) {
  const normalised = normaliseUrl(text);
  if (!normalised) { toast("Paste a valid http:// or https:// web address."); return; }
  const target = new URL(normalised);
  if (target.username || target.password) { toast("Use a URL without a username or password."); return; }
  target.hash = "";
  const controller = new AbortController();
  archiveController = controller;
  const timer = setTimeout(() => controller.abort(), 15000);
  toast("Looking for the latest saved copy…");
  try {
    // Omitting timestamp asks the Availability API for its newest available capture.
    const response = await fetch(PROVIDERS.archive.replace("%s", encodeURIComponent(target.href)), {
      signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
    });
    if (!response.ok) throw new Error(`Internet Archive returned HTTP ${response.status}`);
    const data = await response.json();
    if (archiveController !== controller) return;
    controller.signal.throwIfAborted();
    const snapshots = data?.archived_snapshots;
    if (!snapshots || typeof snapshots !== "object" || Array.isArray(snapshots)) {
      throw new Error("Internet Archive returned an invalid availability response");
    }
    const capture = snapshots.closest;
    if (!capture || capture.available === false || (capture.available === true && String(capture.status) !== "200")) {
      toast("No available saved copy was found for that URL.");
      return;
    }
    if (capture.available !== true || !/^\d{14}$/.test(capture.timestamp) || typeof capture.url !== "string") {
      throw new Error("Internet Archive returned an invalid capture");
    }
    const archived = new URL(capture.url);
    if (!["http:", "https:"].includes(archived.protocol) || archived.hostname !== "web.archive.org" ||
        archived.port || archived.username || archived.password ||
        !archived.pathname.startsWith(`/web/${capture.timestamp}/`)) {
      throw new Error("Internet Archive returned an unexpected capture URL");
    }
    archived.protocol = "https:";
    await openUrl(archived.href, newTab);
  } catch (error) {
    if (archiveController !== controller) return;
    console.warn("Web Archive: couldn't open the latest saved copy.", error);
    toast(controller.signal.aborted
      ? "Web Archive lookup timed out. Try again."
      : "Couldn't open the archived copy. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    if (archiveController === controller) archiveController = null;
  }
}
