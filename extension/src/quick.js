import { getSettings, getQuick, setQuick, getIcon, subscribe } from "./store.js";
import { $, el, icon, brandIcon, omarchyIcon, uid, normaliseUrl, faviconUrl, hostOf, toast } from "./util.js";
import { showMenu } from "./menu.js";
import { formDialog } from "./dialog.js";
import { ICON_ACCEPT, IconError, processIconFile } from "./qicon.js";
import { suggestedBrandIcon } from "./quick-icons.js";

const MAX = 12;

export const validTileId = (id) => typeof id === "string" && id.length <= 100 && id.trim().length > 0;

function suggestedIcon(q) {
  try {
    const url = new URL(q?.url);
    if (url.protocol === "https:" && url.hostname.toLowerCase().replace(/^www\./, "") === "omarchy.org") return { type: "omarchy" };
  } catch { /* Other links can use a favicon or monogram. */ }
  const brand = suggestedBrandIcon(q?.url);
  if (brand) return { type: "brand", name: brand };
  let url;
  try { url = new URL(q?.url); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "avtoolspro.com") return { type: "phosphor", name: "speaker-high" };
  if (host === "web.archive.org") return { type: "phosphor", name: "bank" };
  return null;
}

function suggestedIconNode(q, px) {
  const suggestion = suggestedIcon(q);
  if (!suggestion) return null;
  const svg = suggestion.type === "omarchy"
    ? omarchyIcon("qa-tool-icon")
    : suggestion.type === "brand"
    ? brandIcon(suggestion.name, "qa-tool-icon")
    : icon(suggestion.name, "qa-tool-icon");
  svg.style.setProperty("--qa-tool-size", `${px}px`);
  return svg;
}

export function initQuick() {
  render();
  subscribe((s, what) => { if (what === "quick" || what === "settings") render(); });
}

/** A custom image, a domain-suggested icon, or the browser favicon. */
export function quickIcon(q, { size = 32, px = 20, cls = "fav" } = {}) {
  const custom = getIcon(q);
  const suggested = !custom && !q.useSiteIcon && suggestedIconNode(q, px);
  if (suggested) return suggested;
  const img = el("img", {
    class: cls + (custom ? " custom" : ""), src: custom || faviconUrl(q.url, size),
    alt: "", width: px, height: px, draggable: "false",
  });
  img.addEventListener("error", () => img.replaceWith(monogram(q.name)), { once: true });
  return img;
}

function render() {
  const box = $("#quick");
  const s = getSettings();
  const list = getQuick();
  if (!s.quickShow) { box.hidden = true; return; }
  box.hidden = false;
  box.classList.toggle("glass", list.length > 0);
  box.classList.toggle("empty", list.length === 0);
  const items = list.map((q, i) => link(q, i, s));
  if (list.length < MAX) {
    items.push(el("button", {
      class: "qa qa-add" + (list.length ? "" : " qa-empty"), type: "button",
      title: "Add a quick-access link", "aria-label": "Add a quick-access link", onclick: () => addLink(),
    }, icon("plus"), list.length ? "" : el("span", { class: "qa-add-label" }, "Add quick link")));
  }
  box.replaceChildren(...items);
}

function monogram(name) {
  return el("span", { class: "mono", "aria-hidden": "true" }, (name || "?").trim().charAt(0).toUpperCase());
}

function link(q, i, s) {
  const img = quickIcon(q, { size: 64, px: 24, cls: "" });
  const a = el("a", {
    class: "qa", href: q.url, draggable: "true", dataset: { i: String(i) },
    "aria-label": q.name, target: s.search.newTab ? "_blank" : null,
  }, img, el("span", { class: "qa-tip" }, q.name));
  // Chromium returns a generic globe for unknown sites; flag the 16px default.
  if (img instanceof HTMLImageElement && !img.classList.contains("custom")) {
    img.addEventListener("load", () => { if (img.naturalWidth && img.naturalWidth < 17 && img.naturalHeight < 17) img.classList.add("fav-small"); }, { once: true });
  }
  a.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(q, e.clientX, e.clientY, a); });
  a.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); reorder(i, i + (e.key === "ArrowLeft" ? -1 : 1), true); }
    if (e.key === "Delete") { e.preventDefault(); remove(q); }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = a.getBoundingClientRect(); menu(q, r.left, r.bottom + 4, a); }
  });
  a.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/ant-qa", String(i)); e.dataTransfer.effectAllowed = "move"; a.classList.add("dragging"); });
  a.addEventListener("dragend", () => a.classList.remove("dragging"));
  a.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/ant-qa")) { e.preventDefault(); a.classList.add("drop"); } });
  a.addEventListener("dragleave", () => a.classList.remove("drop"));
  a.addEventListener("drop", (e) => {
    e.preventDefault();
    a.classList.remove("drop");
    const from = Number(e.dataTransfer.getData("text/ant-qa"));
    if (!Number.isNaN(from)) reorder(from, i);
  });
  return a;
}

function menu(q, x, y, anchor) {
  showMenu(x, y, [
    { label: "Open in new tab", icon: "arrow-square-out", action: () => chrome.tabs.create({ url: q.url, active: false }) },
    { label: "Edit name, address or icon", icon: "pencil-simple", action: () => editLink(q) },
    { label: "Remove", icon: "trash", danger: true, action: () => remove(q) },
  ], anchor);
}

export async function reorder(from, to, refocus) {
  const list = getQuick().slice();
  if (to < 0 || to >= list.length || from === to) return;
  const [m] = list.splice(from, 1);
  list.splice(to, 0, m);
  try { await setQuick(list); } catch (e) { toast(e.message); return; }
  if (refocus) $(`#quick .qa[data-i="${to}"]`)?.focus();
}

export async function remove(q) {
  try { await setQuick(getQuick().filter(x => x.id !== q.id)); } catch (e) { toast(e.message); return; }
  toast(`Removed ${q.name}.`);
}

function validate(v) {
  if (!normaliseUrl(v.url)) return "Enter a valid web address, e.g. example.com";
  return "";
}

/** File picker + preview for a link's icon. */
function iconPicker(q, initial = {}) {
  const current = q ? getIcon(q) : null;
  const state = { mode: "keep", data: null, pending: null };
  let choice = 0;
  let url = q ? q.url : (initial.url || "");
  let name = q ? q.name : (initial.name || "");
  const preview = el("div", { class: "qi-preview", "aria-hidden": "true" });
  const status = el("p", { class: "qi-status", role: "status", "aria-live": "polite" });
  const file = el("input", { type: "file", accept: ICON_ACCEPT, hidden: true, tabindex: "-1" });
  const chooseLabel = el("span", {}, "Choose image…");
  const choose = el("button", { class: "btn sm", type: "button", onclick: () => file.click() }, icon("image"), chooseLabel);
  const reset = el("button", { class: "btn ghost sm", type: "button", onclick: () => {
    choice++; state.mode = "site"; state.data = null;
    setStatus("The website's own icon will be used."); paint(); choose.focus();
  } }, icon("globe-simple"), "Use website icon");
  const useSuggested = el("button", { class: "btn ghost sm", type: "button", onclick: () => {
    choice++; state.mode = "suggested"; state.data = null;
    setStatus("The matching suggested icon will be used."); paint(); choose.focus();
  } }, icon("squares-four"), "Use suggested icon");
  const suggested = () => suggestedIcon({ ...(q || {}), url: normaliseUrl(url) || url, name });
  const source = () => {
    if (state.mode === "custom" || state.mode === "site") return state.mode;
    if (state.mode === "keep" && current) return "custom";
    return suggested() && (state.mode === "suggested" || !q?.useSiteIcon) ? "suggested" : "site";
  };

  function setStatus(msg, error = false) { status.textContent = msg; status.classList.toggle("err", error); }
  function paint() {
    const kind = source();
    const d = state.mode === "custom" ? state.data : current;
    const target = normaliseUrl(url);
    let n;
    if (kind === "custom") n = el("img", { class: "custom", src: d, alt: "", width: 32, height: 32 });
    else if (kind === "suggested") n = suggestedIconNode({ ...(q || {}), url: target || url, name }, 28);
    else if (target) {
      n = el("img", { src: faviconUrl(target, 64), alt: "", width: 32, height: 32 });
      n.addEventListener("error", () => n.replaceWith(monogram(name || hostOf(target))), { once: true });
    } else n = icon("image");
    preview.replaceChildren(n);
    reset.hidden = kind === "site";
    useSuggested.hidden = !suggested() || kind === "suggested";
    chooseLabel.textContent = kind === "custom" ? "Replace image…" : "Choose image…";
    choose.setAttribute("aria-label", kind === "custom" ? "Replace icon image" : "Choose icon image");
  }
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    file.value = "";
    if (!f) return;
    const selected = ++choice;
    setStatus("Preparing icon…");
    const pending = processIconFile(f)
      .then(r => {
        if (selected !== choice) return;
        state.mode = "custom"; state.data = r.data;
        setStatus(`Icon ready (${r.w} × ${r.h} px). Save to apply it.`); paint();
      })
      .catch(e => {
        if (selected === choice) setStatus(e instanceof IconError ? e.message : "That image couldn't be processed. Try a different file.", true);
      })
      .finally(() => { if (state.pending === pending) state.pending = null; });
    state.pending = pending;
  });
  paint();
  const node = el("div", { class: "field qi-field", role: "group", "aria-label": "Icon" },
    el("span", { class: "field-label" }, "Icon"),
    el("div", { class: "qi-row" }, preview, el("div", { class: "qi-btns" }, choose, useSuggested, reset)),
    el("p", { class: "qi-hint" }, "PNG, JPEG, WebP, ICO or SVG, up to 10 MB. Resized on this device and synced with your quick links."),
    status, file);
  return {
    node, state,
    onReady(inputs) {
      inputs.url.addEventListener("input", () => { url = inputs.url.value; paint(); });
      inputs.name.addEventListener("input", () => { name = inputs.name.value; paint(); });
    },
    async settle() { if (state.pending) await state.pending; },
  };
}

export async function addLink(prefill = {}) {
  if (getQuick().length >= MAX) { toast("Quick access is full (12 links)."); return; }
  const picker = iconPicker(null, prefill);
  await formDialog({
    title: "Add quick link",
    fields: [
      { name: "url", label: "Web address", value: prefill.url || "", placeholder: "e.g. example.com" },
      { name: "name", label: "Name (optional)", value: prefill.name || "", placeholder: "Shown on hover" },
      picker.node,
    ],
    submitLabel: "Add", validate, onReady: picker.onReady,
    commit: async (v) => {
      await picker.settle();
      const list = getQuick();
      if (list.length >= MAX) return "Quick access is full (12 links).";
      const url = normaliseUrl(v.url);
      const id = uid();
      const rec = picker.state.mode === "custom" ? { r: uid(), d: picker.state.data } : null;
      const q = { id, name: v.name || hostOf(url), url };
      if (rec) q.ic = rec.r;
      else if (picker.state.mode === "site") q.useSiteIcon = true;
      await setQuick([...list, q], rec ? { [id]: rec } : {});
      return "";
    },
  });
}

export async function editLink(q) {
  const picker = iconPicker(q);
  await formDialog({
    title: "Edit quick link",
    fields: [
      { name: "url", label: "Web address", value: q.url },
      { name: "name", label: "Name", value: q.name },
      picker.node,
    ],
    validate, onReady: picker.onReady,
    commit: async (v) => {
      await picker.settle();
      const list = getQuick();
      if (!list.some(x => x.id === q.id)) return "This link was removed, possibly in another tab.";
      const url = normaliseUrl(v.url);
      const { mode, data } = picker.state;
      const rec = mode === "custom" ? { r: uid(), d: data } : null;
      await setQuick(list.map(x => {
        if (x.id !== q.id) return x;
        const n = { ...x, url, name: v.name || hostOf(url) };
        if (rec) { n.ic = rec.r; delete n.useSiteIcon; }
        else if (mode === "site") {
          delete n.ic; n.useSiteIcon = true;
        } else if (mode === "suggested") { delete n.ic; delete n.useSiteIcon; }
        return n;
      }), rec ? { [q.id]: rec } : {});
      return "";
    },
  });
}
