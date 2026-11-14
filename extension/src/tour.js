import { el, toast } from "./util.js";

const STEPS = [
  {
    target: "#widgets",
    title: "Your day at a glance",
    body: "Calendar, clocks, and weather stay up top. Location and display choices are in Settings.",
  },
  {
    target: "#search-form",
    title: "Search from one place",
    body: "Web is the default. Use the picker or Alt+1–9 for Omarchy Plugins, GitHub, and other searches.",
  },
  {
    target: "#quick",
    title: "Keep sites close",
    body: "Use Add quick link for favorite sites. Type a link's name in search to find it again.",
  },
  {
    target: "#settings-btn",
    title: "Connect Omarchy",
    body: "Open Settings, then select your Omarchy folder to show your wallpaper and follow your theme.",
  },
];

let active = null;

export function startTour({ checkShortcut = false } = {}) {
  if (active) return;
  const previousFocus = document.activeElement;
  const highlight = el("div", { class: "tour-highlight", "aria-hidden": "true" });
  const card = el("div", { class: "tour-card glass-strong" });
  const layer = el("div", { class: "tour-layer", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-title" }, highlight, card);
  document.body.append(layer);
  let stepIndex = 0;

  function place() {
    const selector = STEPS[stepIndex].target;
    const target = document.querySelector(selector);
    const fallback = document.getElementById("settings-btn");
    const rect = (target && !target.hidden && target.getBoundingClientRect().width ? target : fallback)?.getBoundingClientRect();
    if (!rect) return;
    const pad = 12;
    highlight.style.left = `${Math.max(0, rect.left - 5)}px`;
    highlight.style.top = `${Math.max(0, rect.top - 5)}px`;
    highlight.style.width = `${Math.min(innerWidth, rect.right + 5) - Math.max(0, rect.left - 5)}px`;
    highlight.style.height = `${Math.min(innerHeight, rect.bottom + 5) - Math.max(0, rect.top - 5)}px`;
    const width = card.offsetWidth, height = card.offsetHeight;
    const left = Math.min(innerWidth - width - pad, Math.max(pad, rect.left + rect.width / 2 - width / 2));
    const below = rect.bottom + 16;
    const above = rect.top - height - 16;
    const top = below + height <= innerHeight - pad ? below : above >= pad ? above : Math.max(pad, (innerHeight - height) / 2);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function finish(openSettings = false) {
    if (!active) return;
    active = null;
    window.removeEventListener("resize", place);
    document.removeEventListener("keydown", onKey, true);
    layer.remove();
    void chrome.storage.local.set({ firstRunTour: "seen" }).catch(error => console.warn("Couldn't save tour state:", error));
    if (checkShortcut) void chrome.commands.getAll().then(commands => {
      if (!commands.find(command => command.name === "open-start-page")?.shortcut) {
        toast("Alt+T is unassigned. Set it in chrome://extensions/shortcuts.", 8000);
      }
    }).catch(() => {});
    if (openSettings || checkShortcut) {
      const settingsButton = document.getElementById("settings-btn");
      settingsButton.dataset.openSection = "background";
      settingsButton.click();
    }
    else previousFocus?.focus?.({ preventScroll: true });
  }

  function showStep() {
    const step = STEPS[stepIndex];
    const last = stepIndex === STEPS.length - 1;
    const primary = el("button", { class: "btn primary sm", type: "button", onclick: () => {
      if (last) finish(true);
      else { stepIndex++; showStep(); }
    } }, last ? "Open Settings" : "Next");
    card.replaceChildren(
      el("span", { class: "tour-count" }, `${stepIndex + 1} / ${STEPS.length}`),
      el("h2", { id: "tour-title" }, step.title),
      el("p", { class: "tour-copy" }, step.body),
      el("div", { class: "tour-actions" },
        el("button", { class: "btn ghost sm", type: "button", onclick: () => finish() }, last ? "Finish" : "Skip"),
        stepIndex ? el("button", { class: "btn ghost sm", type: "button", onclick: () => { stepIndex--; showStep(); } }, "Back") : "",
        primary),
    );
    place();
    primary.focus({ preventScroll: true });
  }

  function onKey(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(); return; }
    if (event.key === "ArrowRight" && stepIndex < STEPS.length - 1) { event.preventDefault(); event.stopPropagation(); stepIndex++; showStep(); return; }
    if (event.key === "ArrowLeft" && stepIndex > 0) { event.preventDefault(); event.stopPropagation(); stepIndex--; showStep(); return; }
    if (event.key !== "Tab") return;
    const buttons = [...card.querySelectorAll("button")];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  active = layer;
  window.addEventListener("resize", place);
  document.addEventListener("keydown", onKey, true);
  showStep();
}
