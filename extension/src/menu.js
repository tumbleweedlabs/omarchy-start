/* Small context menu used by tiles and quick-access links. */
import { $, el, icon } from "./util.js";

let returnFocus = null;

export function showMenu(x, y, items, anchor, opts = {}) {
  const m = $("#menu");
  returnFocus = anchor || document.activeElement;
  m.classList.toggle("menu-wide", !!opts.wide);
  m.replaceChildren(...items.map(it => el("button", {
    class: "menu-item" + (it.danger ? " danger" : "") + (it.checked ? " on" : ""),
    role: it.checked === undefined ? "menuitem" : "menuitemradio", type: "button",
    "aria-checked": it.checked === undefined ? null : String(!!it.checked),
    onclick: () => { hideMenu(); it.action(); },
  }, icon(it.icon), el("span", { class: "menu-label" }, it.label), it.hint ? el("kbd", {}, it.hint) : "")));
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
  m.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
  m.classList.add("show");
  (m.querySelector("button.on") || m.querySelector("button"))?.focus();
}

export function hideMenu() {
  const m = $("#menu");
  if (m.hidden) return;
  m.classList.remove("show");
  m.hidden = true;
  if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}

document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#menu")) hideMenu(); }, true);
document.addEventListener("keydown", (e) => {
  const m = $("#menu");
  if (m.hidden) return;
  const btns = [...m.querySelectorAll("button")];
  const i = btns.indexOf(document.activeElement);
  if (e.key === "Escape") { e.preventDefault(); hideMenu(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
});
window.addEventListener("blur", hideMenu);
window.addEventListener("resize", hideMenu);
document.addEventListener("scroll", hideMenu, true);
