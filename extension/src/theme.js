import { getSettings, subscribe } from "./store.js";
import { refreshBackground } from "./background.js";
import { readOmarchyPalette } from "./omarchy-wallpaper.js";
import { startOmarchyWatch } from "./omarchy-watch.js";

const mq = window.matchMedia("(prefers-color-scheme: dark)");
let palette=null;
const hexRgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ');

export function initTheme() {
  apply();
  void refreshOmarchyTheme();
  void startOmarchyWatch(omarchyChanged);
  mq.addEventListener("change", apply);
  window.addEventListener("resize", applyDensity);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void omarchyChanged(); });
  subscribe((s, what) => { if (what === "settings") apply(); });
}

export async function refreshOmarchyTheme() {
  palette=await readOmarchyPalette();
  apply();
}

export async function omarchyChanged() {
  await refreshOmarchyTheme();
  return getSettings().backgrounds.showWallpaper ? refreshBackground() : true;
}

function apply() {
  const s=getSettings(), root=document.documentElement;
  const dark=s.theme === "dark" || (s.theme === "auto" && (palette?.mode ? palette.mode === "dark" : mq.matches));
  root.dataset.theme=dark ? "dark" : "light";
  for (const key of ['--accent','--base','--text','--text-2','--glass','--glass-strong','--glass-focus','--dim-rgb']) root.style.removeProperty(key);
  if (palette) {
    const background=palette.background, foreground=palette.foreground;
    root.style.setProperty('--accent',palette.accent);
    root.style.setProperty('--base',background);
    root.style.setProperty('--text',foreground);
    root.style.setProperty('--text-2',palette.light_foreground || foreground);
    const rgb=hexRgb(palette.lighter_background || background);
    root.style.setProperty('--glass',`rgba(${rgb}, .58)`);
    root.style.setProperty('--glass-strong',`rgba(${rgb}, .92)`);
    root.style.setProperty('--glass-focus',`rgba(${rgb}, .74)`);
    root.style.setProperty('--dim-rgb',hexRgb(background));
  }
  root.style.setProperty("--dim", String(s.dim));
  root.style.setProperty("--surface-opacity", String(1 - s.surfaceTransparency / 100));
  root.style.setProperty("--blur", s.blur + "px");
  root.classList.toggle("no-blur", s.blur === 0);
  root.classList.toggle("kenburns", !!s.kenBurns);
  applyDensity();
}

function applyDensity() {
  const s=getSettings();
  document.documentElement.dataset.density=s.density === "auto" ? (window.innerHeight < 680 ? "tight" : window.innerHeight < 820 ? "compact" : "comfortable") : s.density;
}
