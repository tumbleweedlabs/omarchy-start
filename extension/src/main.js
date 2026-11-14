import { loadSettings, getSettings, update, subscribe } from "./store.js";
import { initTheme } from "./theme.js";
import { initClock } from "./clock.js";
import { initBackground } from "./background.js";
import { initSearch } from "./search.js";
import { initQuick } from "./quick.js";
import { initLocation, resolveFixedLocation } from "./location.js";
import { icon, toast } from "./util.js";

function prepareSettings() {
  const button = document.getElementById("settings-btn");
  button.append(icon("gear-six"));
  let pending = null;
  let ready = false;
  let opening = false;

  function load() {
    if (ready) return Promise.resolve(true);
    if (!pending) pending = import("./settings.js").then(({ initSettings }) => {
      button.removeEventListener("click", openEarly);
      document.removeEventListener("keydown", shortcutEarly);
      initSettings();
      ready = true;
      return true;
    }).catch(error => {
      pending = null;
      console.error("Settings startup:", error);
      toast("Couldn't open Settings. Try again.");
      return false;
    });
    return pending;
  }

  function openEarly(event) {
    event.preventDefault();
    if (opening) return;
    opening = true;
    void load().then(ok => {
      opening = false;
      if (ok) button.click();
    });
  }

  function shortcutEarly(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === ",") openEarly(event);
  }

  button.addEventListener("click", openEarly);
  document.addEventListener("keydown", shortcutEarly);
  if (window.requestIdleCallback) requestIdleCallback(() => { void load(); }, { timeout: 2000 });
  else setTimeout(() => { void load(); }, 0);
}

async function start() {
  document.getElementById("q")?.focus({ preventScroll: true });
  await loadSettings();
  initBackground().catch(error => {
    console.error("Background startup:", error);
    toast(`Couldn't load wallpaper. ${error.message}`, 5000);
  });
  const locationReady = initLocation();
  initTheme();
  initClock();
  initSearch();
  initQuick();
  prepareSettings();
  document.documentElement.classList.add("ready");

  // The guide is loaded only on a fresh install; ordinary tabs pay no tour cost.
  void chrome.storage.local.get("firstRunTour").then(({ firstRunTour }) => {
    if (firstRunTour === "pending") return import("./tour.js").then(({ startTour }) => startTour({ checkShortcut: true }));
  }).catch(error => console.warn("First-run guide unavailable:", error));

  // Optional news and weather do not hold the page invisible.
  let newsLoading = false;
  function loadNews() {
    if (newsLoading || document.getElementById("omarchy-news")?.dataset.initialized) return;
    newsLoading = true;
    const begin = () => {
      void import("./news.js").then(({ initNews }) => initNews()).catch(error => {
        console.error("News startup:", error);
      }).finally(() => { newsLoading = false; });
    };
    if (window.requestIdleCallback) requestIdleCallback(begin, { timeout: 3000 });
    else setTimeout(begin, 0);
  }
  if (getSettings().news.show) loadNews();
  subscribe((s, what) => { if (what === "settings" && s.news.show) loadNews(); });
  void locationReady.then(() => {
    void resolveFixedLocation(getSettings, update);
    return import("./weather.js");
  }).then(({ initWeather }) => initWeather()).catch(error => {
    console.error("Weather startup:", error);
    toast("Couldn't load weather.");
  });
}

start().catch(error => {
  console.error("Dashboard startup:", error);
  toast(error.message || "Couldn't load your saved settings. Reload to retry.", 15000);
});
