/* Top widgets: Date (with mini month) and Clock (analog face + digital time + up to 3 world clocks).
   Both follow "My clock" — either this computer's time zone or a location chosen in Settings. */
import { getSettings, subscribe } from "./store.js";
import { $, el } from "./util.js";
import { effectiveMyClock, subscribeLocation } from "./location.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let timer;
let face = null;
let lastMinute = "";
let lastDay = "";

export const systemTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const myTz = (s) => effectiveMyClock(s)?.tz || systemTz();
export function zoneLabel(tz) { return (tz.split("/").pop() || tz).replace(/_/g, " "); }

const fmtCache = new Map();
function partsIn(date, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month - 1, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}
const dayNum = (p) => Date.UTC(p.y, p.mo, p.d) / 86400000;

/** Time now in a zone, formatted to the user's 12/24-hour setting (used by Settings previews too). */
export function timeIn(tz, s = getSettings(), date = new Date()) {
  const { main, period } = timeParts(date, timeOpts(s, { timeZone: tz }));
  return `${main}${period ? " " + period : ""}`;
}

export function initClock() {
  renderAll();
  schedule();
  subscribe((s, what) => { if (what === "settings") { face = null; lastMinute = ""; lastDay = ""; renderAll(); schedule(); } });
  subscribeLocation(() => { face = null; lastMinute = ""; lastDay = ""; renderAll(); schedule(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderAll(); schedule(); } });
}

function needsSeconds(s) { return s.clock.analog || s.clock.seconds; }

function schedule() {
  clearTimeout(timer);
  const s = getSettings();
  const now = new Date();
  const ms = needsSeconds(s) ? 1000 - now.getMilliseconds() : 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  timer = setTimeout(() => { tick(); schedule(); }, ms + 10);
}

function tick() {
  const s = getSettings();
  const now = new Date();
  const tz = myTz(s);
  if (face) setFace(now, tz);
  const minuteKey = `${now.getHours()}:${now.getMinutes()}:${s.clock.seconds ? now.getSeconds() : ""}`;
  if (minuteKey !== lastMinute) renderClock(now, s);
  const p = partsIn(now, tz);
  if (`${p.y}-${p.mo}-${p.d}` !== lastDay) renderDate(now, s);
}

function renderAll() {
  const now = new Date();
  const s = getSettings();
  renderDate(now, s);
  renderClock(now, s);
}

/* ---------- formatting ---------- */
function timeParts(date, opts) {
  const parts = new Intl.DateTimeFormat(undefined, opts).formatToParts(date);
  const period = parts.find(p => p.type === "dayPeriod");
  const main = parts.filter(p => p.type !== "dayPeriod").map(p => p.value).join("").trim();
  return { main, period: period ? period.value : "" };
}
function timeOpts(s, extra = {}) {
  const o = { hour: "numeric", minute: "2-digit", hour12: !s.clock.h24, ...extra };
  if (s.clock.h24) o.hourCycle = "h23";
  return o;
}

/* ---------- Date widget ---------- */
function renderDate(now, s) {
  const tz = myTz(s);
  const p = partsIn(now, tz);
  lastDay = `${p.y}-${p.mo}-${p.d}`;
  const noon = new Date(Date.UTC(p.y, p.mo, p.d, 12));
  const f = (o) => new Intl.DateTimeFormat(undefined, { ...o, timeZone: "UTC" }).format(noon);
  const w = $("#w-date");
  const month = f({ month: "long" });
  const main = el("span", { class: "wd-main" },
    el("span", { class: "wd-dow" }, f({ weekday: "long" })),
    el("span", { class: "wd-day" }, String(p.d)),
    el("span", { class: "wd-month" }, s.clock.showYear ? `${month} ${p.y}` : month));
  w.replaceChildren(main, miniMonth(p));
  w.setAttribute("aria-label", `${f({ dateStyle: "full" })}.`);
}

function miniMonth(p) {
  const start = new Date(Date.UTC(p.y, p.mo, 1)).getUTCDay();   // Sunday-first weeks
  const days = new Date(Date.UTC(p.y, p.mo + 1, 0)).getUTCDate();
  const narrow = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });
  const heads = Array.from({ length: 7 }, (_, i) => el("span", { class: "mm-h" }, narrow.format(new Date(Date.UTC(2023, 0, 1 + i, 12)))));
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(el("span", { class: "mm-d blank" }));
  for (let d = 1; d <= days; d++) {
    const dow = (start + d - 1) % 7;
    cells.push(el("span", { class: "mm-d" + (d === p.d ? " today" : "") + (dow === 0 || dow === 6 ? " we" : "") }, String(d)));
  }
  const rows = Math.ceil((start + days) / 7);
  return el("span", { class: "mm", "aria-hidden": "true", style: { "--mm-rows": String(rows) } }, ...heads, ...cells);
}

/* ---------- Clock widget ---------- */
function buildFace() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "-50 -50 100 100");
  svg.setAttribute("class", "face");
  svg.setAttribute("aria-hidden", "true");
  const add = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.appendChild(n);
    return n;
  };
  add("circle", { r: "48", class: "face-bg" });
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const a = (i * 6) * Math.PI / 180;
    const r1 = major ? (i % 15 === 0 ? 36 : 39) : 43;
    const r2 = 45;
    add("line", {
      x1: (Math.sin(a) * r1).toFixed(2), y1: (-Math.cos(a) * r1).toFixed(2),
      x2: (Math.sin(a) * r2).toFixed(2), y2: (-Math.cos(a) * r2).toFixed(2),
      class: major ? "tk tk-h" : "tk tk-m",
    });
  }
  const hr = add("line", { x1: "0", y1: "5", x2: "0", y2: "-23", class: "hand hand-h" });
  const mn = add("line", { x1: "0", y1: "6", x2: "0", y2: "-35", class: "hand hand-m" });
  const sc = add("g", { class: "hand-s" });
  add("line", { x1: "0", y1: "9", x2: "0", y2: "-40" }, sc);
  add("circle", { r: "2.6", class: "hub" });
  add("circle", { r: "1", class: "hub-in" });
  return { svg, hr, mn, sc };
}

function setFace(now, tz) {
  const p = partsIn(now, tz);
  const h = p.h % 12;
  face.hr.setAttribute("transform", `rotate(${((h + p.mi / 60) * 30).toFixed(2)})`);
  face.mn.setAttribute("transform", `rotate(${((p.mi + p.s / 60) * 6).toFixed(2)})`);
  face.sc.setAttribute("transform", `rotate(${p.s * 6})`);
}

function renderClock(now, s) {
  lastMinute = `${now.getHours()}:${now.getMinutes()}:${s.clock.seconds ? now.getSeconds() : ""}`;
  const tz = myTz(s);
  const w = $("#w-clock");
  const { main, period } = timeParts(now, timeOpts(s, { timeZone: tz, ...(s.clock.seconds ? { second: "2-digit" } : {}) }));
  const my = effectiveMyClock(s);
  const label = my?.label || (my?.tz ? zoneLabel(my.tz) : "Local time");
  const digital = el("span", { class: "wc-digital", "aria-label": `${label ? label + " " : ""}${main} ${period}`.trim() },
    el("span", { class: "hm" }, main), period ? el("span", { class: "ampm" }, period) : "");

  const list = (s.worldClocksShow ? s.worldClocks : []).filter(c => c && c.tz);
  const myDay = dayNum(partsIn(now, tz));
  const rows = [];
  for (const c of list) {
    try {
      const p = partsIn(now, c.tz);
      const diff = dayNum(p) - myDay;
      const night = p.h < 6 || p.h >= 19;
      rows.push(el("span", { class: "wl-row" + (night ? " night" : ""), title: `${c.label} · ${c.tz}` },
        el("span", { class: "wl-dot", "aria-hidden": "true" }),
        el("span", { class: "wl-city" }, c.label),
        el("span", { class: "wl-time" }, timeIn(c.tz, s, now)),
        el("span", { class: "wl-diff" }, diff ? (diff > 0 ? `+${diff}` : `${diff}`) : "")));
    } catch { /* bad zone */ }
  }
  let sub;
  if (rows.length) sub = el("span", { class: "wl" }, rows);
  else {
    const tzName = new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "long" }).formatToParts(now).find(p => p.type === "timeZoneName");
    sub = el("span", { class: "wc-tz" }, tzName ? tzName.value : "");
  }

  if (s.clock.analog) {
    if (!face) face = buildFace();
    setFace(now, tz);
  } else face = null;
  w.classList.toggle("no-face", !s.clock.analog);
  w.classList.toggle("no-world", !rows.length);
  w.setAttribute("aria-label", `Clock${label ? " — " + label : ""}`);
  w.replaceChildren(...(face ? [face.svg] : []),
    el("span", { class: "wc-side" }, label ? el("span", { class: "wc-loc" }, label) : "", digital, sub));
}
