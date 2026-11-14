/* Type-to-find: ranks quick-access links as the user types, and (opt-in) appends
   web search predictions. Nothing is pre-selected, so Enter always searches what was typed
   unless the user arrows into the list. */
import { getSettings, getQuick } from "./store.js";
import { $, el, icon, hostOf, openUrl, looksLikeUrl } from "./util.js";
import { quickIcon } from "./quick.js";
import { getScope, runSearch } from "./search.js";
import { fetchPredictions, cancelPredictions, cached, providerOf } from "./predict.js";

const PREDICT_DELAY = 150;

let items = [];
let sel = -1;
let local = [];        // ranked tool/link matches for the current text
let preds = [];        // predictions currently shown
let predTimer = 0;

function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

const WORDS = /[\s\-&/,()]+/;

function score(q, title, keywords) {
  const t = norm(title);
  const words = t.split(WORDS).filter(Boolean);
  if (t.startsWith(q)) return 100;
  if (words.some(w => w.startsWith(q))) return 80;
  if ((keywords || []).some(k => norm(k).startsWith(q) || norm(k).split(/\s+/).some(w => w.startsWith(q)))) return 60;
  if (q.length >= 3 && t.includes(q)) return 40;
  // Initials, e.g. "pmt" → PM Toolkit, "rwa" → Remote Workstation Access
  if (q.length >= 2 && words.map(w => w[0]).join("").startsWith(q)) return 30;
  return 0;
}

const predicting = (s, text) => !!s.search.predictions && !!providerOf(s.search.engine) && getScope().id === "web" && !looksLikeUrl(text);

export function suggest(raw) {
  const s = getSettings();
  const text = raw.trim();
  const q = norm(text);
  clearTimeout(predTimer);
  if (q.length < 2 || q.startsWith("!") || (!s.search.suggestTools && !predicting(s, text))) { closeSuggest(); return; }
  local = [];
  if (s.search.suggestTools && getScope().id !== "archive") {
    const cands = [];
    for (const qa of getQuick()) {
      const sc = score(q, qa.name, [hostOf(qa.url)]);
      if (sc) cands.push({ kind: "quick", sc: sc + 5, title: qa.name, sub: hostOf(qa.url), url: qa.url, qa });
    }
    cands.sort((a, b) => b.sc - a.sc || a.title.localeCompare(b.title));
    local = cands.filter((item, index) => cands.findIndex(other => other.url === item.url) === index).slice(0, 5);
  }
  if (predicting(s, text)) {
    const hit = cached(s.search.engine, text);
    if (hit) preds = hit;
    else {
      // Keep earlier predictions that still fit what's typed so the list doesn't flicker while the next request runs.
      const lc = text.toLowerCase();
      preds = preds.filter(p => p.toLowerCase().startsWith(lc) && p.toLowerCase() !== lc);
      const provider = s.search.engine;
      predTimer = setTimeout(() => loadPredictions(text, provider), PREDICT_DELAY);
    }
  } else {
    cancelPredictions();
    preds = [];
  }
  sel = -1;
  draw(text);
}

async function loadPredictions(text, provider) {
  const list = await fetchPredictions(provider, text);
  const s = getSettings();
  if (!list || $("#suggest").hidden || $("#q").value.trim() !== text || !predicting(s, text) || s.search.engine !== provider) return;
  preds = list;
  const keep = sel >= 0 ? items[sel] : null;
  draw(text);
  if (keep) highlight(items.findIndex(it => it.kind === keep.kind && it.title === keep.title));
}

function draw(text) {
  const box = $("#suggest");
  const scope = getScope();
  items = [...local];
  const rows = [];
  if (local.length) {
    rows.push(el("div", { class: "sg-head" }, "Links"));
    local.forEach((it, i) => rows.push(row(it, i)));
    rows.push(el("div", { class: "sg-sep", role: "presentation" }));
  }
  items.push({ kind: "search", title: text, sub: scope.label });
  rows.push(row(items[items.length - 1], items.length - 1));
  if (preds.length) {
    rows.push(el("div", { class: "sg-head sg-head-pred" }, "Search suggestions"));
    for (const p of preds) {
      items.push({ kind: "pred", title: p, typed: text });
      rows.push(row(items[items.length - 1], items.length - 1));
    }
  }
  box.replaceChildren(...rows);
  box.hidden = false;
  $("#q").setAttribute("aria-expanded", "true");
  document.body.classList.add("suggest-open");
}

/* Typed prefix plain, completion bold, as search engines show it. */
function completion(title, typed) {
  const n = typed.length;
  if (n && title.toLowerCase().startsWith(typed.toLowerCase()) && title.length > n) return [title.slice(0, n), el("b", {}, title.slice(n))];
  return [title];
}

function row(it, i) {
  let lead;
  if (it.kind === "quick") lead = quickIcon(it.qa, { size: 32, px: 20 });
  else if (it.kind === "pred") lead = icon("magnifying-glass");
  else lead = icon(getScope().id === "web" ? "magnifying-glass" : getScope().icon);
  let label, trail;
  if (it.kind === "search") {
    label = el("span", { class: "sg-title" }, el("span", { class: "muted" },
      getScope().id === "archive" ? "Open latest saved copy of " : `Search ${it.sub} for `), `“${it.title}”`);
    trail = el("kbd", {}, "Enter");
  } else if (it.kind === "pred") {
    label = el("span", { class: "sg-title" }, ...completion(it.title, it.typed));
    trail = "";
  } else {
    label = el("span", { class: "sg-title" }, it.title);
    trail = el("span", { class: "sg-sub" }, it.sub);
  }
  return el("div", {
    class: "sg-item" + (it.kind === "search" ? " sg-search" : it.kind === "pred" ? " sg-pred" : ""), role: "option", id: `sg-${i}`,
    "aria-selected": "false", dataset: { i: String(i) },
    onmousedown: (e) => e.preventDefault(),
    onclick: (e) => activate(i, e.ctrlKey || e.metaKey),
    onmousemove: () => highlight(i),
  }, lead, label, trail);
}
function highlight(i) {
  sel = i;
  const box = $("#suggest");
  box.querySelectorAll(".sg-item").forEach(n => n.setAttribute("aria-selected", String(Number(n.dataset.i) === i)));
  $("#q").setAttribute("aria-activedescendant", i >= 0 ? `sg-${i}` : "");
}

export function moveSelection(d) {
  if (!items.length) return;
  let i = sel + d;
  if (i < -1) i = items.length - 1;
  if (i >= items.length) i = -1;
  highlight(i);
}

export const hasSelection = () => !$("#suggest").hidden && sel >= 0;
export const isOpen = () => !$("#suggest").hidden;

export function openSelected(newTab) { if (sel >= 0) activate(sel, newTab); }

function activate(i, newTab) {
  const it = items[i];
  if (!it) return;
  if (it.kind === "search") {
    const input = $("#q");
    input.form.requestSubmit();
    return;
  }
  closeSuggest();
  const s = getSettings();
  if (it.kind === "pred") {
    $("#q").value = it.title;
    $("#q-clear").hidden = false;
    runSearch(it.title, "web", newTab || s.search.newTab);
    return;
  }
  openUrl(it.url, newTab);
}

export function closeSuggest() {
  clearTimeout(predTimer);
  cancelPredictions();
  const box = $("#suggest");
  box.hidden = true;
  box.replaceChildren();
  items = [];
  sel = -1;
  $("#q").setAttribute("aria-expanded", "false");
  $("#q").removeAttribute("aria-activedescendant");
  document.body.classList.remove("suggest-open");
}
