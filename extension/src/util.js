import { ICONS } from "./icons.js";
import { BRAND_ICONS } from "./brand-icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Build a Phosphor duotone icon as inline SVG (duotone layer gets class "duo"). */
export function icon(name, cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 256 256");
  svg.setAttribute("class", (`ico ico-${name} ` + cls).trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const parts = ICONS[name] || ICONS["squares-four"];
  for (const [tag, attrs, duo] of parts) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (duo) node.setAttribute("class", "duo");
    svg.appendChild(node);
  }
  return svg;
}

/** Build a monochrome Font Awesome brand mark as inline SVG. */
export function brandIcon(name, cls = "") {
  const def = BRAND_ICONS[name];
  if (!def) return icon("squares-four", cls);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${def.width} ${def.height}`);
  svg.setAttribute("class", (`ico ico-brand ` + cls).trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of def.paths) {
    const node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("d", d);
    svg.appendChild(node);
  }
  return svg;
}

/** Omarchy's geometric O mark, colored by the active page theme. */
export function omarchyIcon(cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 135 270");
  svg.setAttribute("class", (`ico ico-omarchy ` + cls).trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "m105 30.002h15v14.997h15v180.001h-15v15h-15v15.002h-75v-15.002h-15v-15h-15v-180.001h15v-14.997h15v-15.002h75zm-60 194.998h45v-179.998h-45z");
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  return svg;
}

/** Tiny DOM builder: el("a", {class: "x", href, onclick}, child, "text"). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Accept "example.com", "https://x.y/z"; return a normalised https URL or null. */
export function normaliseUrl(input) {
  let s = (input || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch { return null; }
}

/** True when the text looks like a web address rather than a search. */
export function looksLikeUrl(text) {
  const s = text.trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s);
}

export function faviconUrl(pageUrl, size = 32) {
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`);
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

let toastTimer, toastHideTimer;
export function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  if (t.matches(":popover-open")) t.hidePopover();
  t.showPopover();
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    toastHideTimer = setTimeout(() => { t.hidePopover(); t.hidden = true; }, 250);
  }, ms);
}

/** Open a URL in this tab, or a background tab. */
export function openUrl(url, newTab = false) {
  if (newTab) return chrome.tabs.create({ url, active: false });
  else location.assign(url);
}
