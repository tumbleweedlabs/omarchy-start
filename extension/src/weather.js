/* Weather widget (Open-Meteo, no key): forecast, sun times and air quality. Cached for 30 minutes. */
import { getSettings, subscribe } from "./store.js";
import { $, el, icon } from "./util.js";
import { effectiveWeather, subscribeLocation } from "./location.js";

const TTL = 30 * 60 * 1000;
const VERSION = 4;
let timer;
let loadSequence = 0;
const dateFormatters = new Map();

// [label, day icon, night icon, colour class]
const WMO = {
  0: ["Clear", "sun", "moon", "sun"], 1: ["Mainly clear", "cloud-sun", "cloud-moon", "sun"], 2: ["Partly cloudy", "cloud-sun", "cloud-moon", "sun"],
  3: ["Overcast", "cloud", null, "cloud"], 45: ["Fog", "cloud-fog", null, "fog"], 48: ["Freezing fog", "cloud-fog", null, "fog"],
  51: ["Light drizzle", "cloud-rain", null, "rain"], 53: ["Drizzle", "cloud-rain", null, "rain"], 55: ["Heavy drizzle", "cloud-rain", null, "rain"],
  56: ["Freezing drizzle", "cloud-rain", null, "rain"], 57: ["Freezing drizzle", "cloud-rain", null, "rain"],
  61: ["Light rain", "cloud-rain", null, "rain"], 63: ["Rain", "cloud-rain", null, "rain"], 65: ["Heavy rain", "cloud-rain", null, "rain"],
  66: ["Freezing rain", "cloud-rain", null, "rain"], 67: ["Freezing rain", "cloud-rain", null, "rain"],
  71: ["Light snow", "cloud-snow", null, "snow"], 73: ["Snow", "cloud-snow", null, "snow"], 75: ["Heavy snow", "cloud-snow", null, "snow"], 77: ["Snow grains", "cloud-snow", null, "snow"],
  80: ["Light showers", "cloud-rain", null, "rain"], 81: ["Showers", "cloud-rain", null, "rain"], 82: ["Heavy showers", "cloud-rain", null, "rain"],
  85: ["Snow showers", "cloud-snow", null, "snow"], 86: ["Snow showers", "cloud-snow", null, "snow"],
  95: ["Thunderstorm", "cloud-lightning", null, "storm"], 96: ["Thunderstorm, hail", "cloud-lightning", null, "storm"], 99: ["Thunderstorm, hail", "cloud-lightning", null, "storm"],
};

function wx(code, day) {
  const [label, d, n, tone] = WMO[code] || ["", "cloud", null, "cloud"];
  const name = !day && n ? n : d;
  const t = !day && (name === "moon" || name === "cloud-moon") ? "night" : tone;
  return { label, svg: icon(name, `wx wx-${t}`) };
}

function key(w) { return `${w.lat.toFixed(3)},${w.lon.toFixed(3)},${w.units}`; }
function airKey(w) { return `${w.lat.toFixed(3)},${w.lon.toFixed(3)}`; }
function shortName(name) {
  const value = name || "";
  return value.includes("°") ? value : value.split(",")[0].trim();
}

function airCategory(value) {
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

function airDescription(air, stale) {
  if (!air) return "US AQI unavailable";
  return `US AQI ${air.value}: ${airCategory(air.value)}. Open-Meteo model estimate for ${air.modelTime.replace("T", " ")} (${air.timezone})${stale ? "; cached" : ""}`;
}

function locationRow(w, air, stale) {
  return el("span", { class: "ww-heading" },
    el("span", { class: "ww-loc" }, icon("navigation-arrow"), el("span", { class: "ww-loc-name" }, shortName(w.name))),
    el("span", { class: "ww-aqi", title: airDescription(air, stale) }, air ? `US AQI ${air.value}${stale ? " (cached)" : ""}` : "US AQI —"));
}

function dayInZone(zone, at = Date.now()) {
  if (!zone) return null;
  try {
    let formatter = dateFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
      dateFormatters.set(zone, formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (error) {
    console.warn("Weather: invalid location time zone.", error);
    return null;
  }
}

function nextDelay(data, interval) {
  if (!data?.timezone) return interval;
  const now = Date.now();
  const today = dayInZone(data.timezone, now);
  const endDay = dayInZone(data.timezone, now + interval);
  if (!today || !endDay || today === endDay) return interval;
  let low = now, high = now + interval;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (dayInZone(data.timezone, mid) === today) low = mid;
    else high = mid;
  }
  return Math.min(interval, Math.max(1000, high - now + 100));
}

function readSolarDays(daily) {
  if (!daily || !Array.isArray(daily.time) || !daily.time.length ||
      !["sunrise", "sunset", "daylight_duration"].every(k => Array.isArray(daily[k]) && daily[k].length >= daily.time.length)) {
    throw new Error("Open-Meteo returned incomplete sunrise and sunset data");
  }
  return daily.time.map((date, i) => {
    const sunrise = daily.sunrise[i], sunset = daily.sunset[i], daylight = daily.daylight_duration[i];
    const validTime = value => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !validTime(sunrise) || !validTime(sunset) ||
        !(daylight === null || (typeof daylight === "number" && Number.isFinite(daylight) && daylight >= 0))) {
      throw new Error("Open-Meteo returned invalid sunrise or sunset data");
    }
    return { date, sunrise, sunset, daylight };
  });
}

export function initWeather() {
  load();
  subscribe((s, what) => { if (what === "settings") load(); });
  subscribeLocation(() => load());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

}

async function load() {
  const sequence = ++loadSequence;
  clearTimeout(timer);
  const w = effectiveWeather(getSettings());
  const box = $("#w-weather");
  if (!w.show || !Number.isFinite(w.lat) || !Number.isFinite(w.lon)) { box.hidden = true; syncCount(); return; }
  box.hidden = false;
  syncCount();
  const { weatherCache: c, airQualityCache: a } = await chrome.storage.local.get(["weatherCache", "airQualityCache"]);
  if (sequence !== loadSequence) return;
  const usable = c && (c.v === VERSION || c.v === 3 || c.v === 2) && c.key === key(w);
  const fresh = usable && c.v === VERSION && c.forecastDate === dayInZone(c.timezone) && Date.now() - c.at < TTL;
  const airUsable = a && a.key === airKey(w) && Number.isFinite(a.value) && a.value >= 0 &&
    typeof a.modelTime === "string" && typeof a.timezone === "string" && Number.isFinite(a.at);
  const airFresh = airUsable && Date.now() - a.at < TTL;
  let displayed = usable ? c : null;
  let weatherStale = !fresh;
  let air = airUsable ? a : null;
  let airStale = !!airUsable && !airFresh;
  let emptyMessage = "Updating…";
  let weatherRetryAt = fresh ? c.at + TTL : Date.now() + TTL;
  let airRetryAt = airFresh ? a.at + TTL : Date.now() + TTL;
  const redraw = () => {
    if (sequence !== loadSequence) return;
    if (displayed) render(displayed, weatherStale, air, airStale);
    else renderEmpty(w, emptyMessage, air, airStale);
  };
  redraw();
  const jobs = [];
  if (!fresh) {
    jobs.push((async () => { try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}` +
        `&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day` +
        `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration&forecast_days=2` +
        `&temperature_unit=${w.units === "C" ? "celsius" : "fahrenheit"}&timezone=auto`;
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (sequence !== loadSequence) return;
      const solarDays = readSolarDays(j.daily);
      if (!dayInZone(j.timezone) || !Number.isFinite(j.utc_offset_seconds)) throw new Error("Open-Meteo returned an invalid time zone");
      const now = j.current.time || "";
      let i0 = (j.hourly.time || []).findIndex(t => t > now);
      if (i0 < 0) i0 = 0;
      const hours = (j.hourly.time || []).slice(i0, i0 + 5).map((t, k) => ({
        t, temp: j.hourly.temperature_2m[i0 + k], code: j.hourly.weather_code[i0 + k], day: j.hourly.is_day[i0 + k] === 1,
      }));
      const data = {
        v: VERSION, key: key(w), at: Date.now(),
        temp: j.current.temperature_2m, code: j.current.weather_code, day: j.current.is_day === 1,
        hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0], hours,
        timezone: j.timezone, offsetSeconds: j.utc_offset_seconds, forecastDate: j.daily.time[0], solarDays,
      };
      await chrome.storage.local.set({ weatherCache: data });
      if (sequence !== loadSequence) return;
      displayed = data;
      weatherStale = false;
      weatherRetryAt = data.at + TTL;
      redraw();
    } catch (error) {
      if (sequence !== loadSequence) return;
      console.warn("Weather: couldn't refresh forecast.", error);
      weatherStale = true;
      if (!displayed) emptyMessage = "Weather unavailable";
      weatherRetryAt = Date.now() + TTL;
      redraw();
    } })());
  }
  if (!airFresh) {
    jobs.push((async () => { try {
      const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${w.lat}&longitude=${w.lon}` +
        "&current=us_aqi&timezone=auto";
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (sequence !== loadSequence) return;
      if (!Number.isFinite(j.current?.us_aqi) || j.current.us_aqi < 0 ||
          typeof j.current.time !== "string" || typeof j.timezone !== "string") {
        throw new Error("Open-Meteo returned invalid air-quality data");
      }
      const data = {
        key: airKey(w), at: Date.now(), value: Math.round(j.current.us_aqi),
        modelTime: j.current.time, timezone: j.timezone,
      };
      await chrome.storage.local.set({ airQualityCache: data });
      if (sequence !== loadSequence) return;
      air = data;
      airStale = false;
      airRetryAt = data.at + TTL;
      redraw();
    } catch (error) {
      if (sequence !== loadSequence) return;
      console.warn("Weather: couldn't refresh air quality.", error);
      airStale = !!air;
      airRetryAt = Date.now() + TTL;
      redraw();
    } })());
  }
  await Promise.all(jobs);
  if (sequence !== loadSequence) return;
  const interval = Math.max(1000, Math.min(weatherRetryAt, airRetryAt) - Date.now());
  timer = setTimeout(load, nextDelay(displayed, interval));
}

function syncCount() {
  const n = [...document.querySelectorAll("#widgets > .widget")].filter(x => !x.hidden).length;
  $("#widgets").dataset.count = String(n);
}

function renderEmpty(w, message = "Updating…", air = null, airStale = false) {
  const box = $("#w-weather");
  box.classList.add("stale");
  box.replaceChildren(
    el("span", { class: "ww-top" },
      el("span", { class: "ww-now" },
        locationRow(w, air, airStale),
        el("span", { class: "ww-temp" }, "–°")),
      el("span", { class: "ww-cond" }, icon("cloud", "wx wx-cloud"), el("span", { class: "ww-label" }, message))));
  box.title = `Weather for ${w.name} · ${airDescription(air, airStale)}`;
  box.setAttribute("aria-label", `Weather in ${w.name}: ${message}. ${airDescription(air, airStale)}.`);
}

function hourLabel(t) {
  const h = Number((t.split("T")[1] || "0").slice(0, 2));
  if (getSettings().clock.h24) return String(h).padStart(2, "0");
  const p = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}${p}`;
}

function solarTime(value, date, zone, offsetSeconds) {
  if (typeof value !== "string" || !zone || !Number.isFinite(offsetSeconds)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!m) return null;
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - offsetSeconds * 1000;
  if (dayInZone(zone, at) !== date) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at).map(p => [p.type, p.value]));
  if (getSettings().clock.h24) return `${parts.hour}:${parts.minute}`;
  const hour = Number(parts.hour);
  return `${hour % 12 || 12}:${parts.minute} ${hour < 12 ? "AM" : "PM"}`;
}

function render(d, stale, air, airStale) {
  const w = effectiveWeather(getSettings());
  const box = $("#w-weather");
  const now = wx(d.code, d.day);
  const hl = `H:${Math.round(d.hi)}°  L:${Math.round(d.lo)}°`;
  const today = dayInZone(d.timezone);
  const solar = Array.isArray(d.solarDays) ? d.solarDays.find(day => day.date === today) : null;
  const noSunEvents = solar && typeof solar.daylight === "number" && (solar.daylight <= 0 || solar.daylight >= 86400);
  const sunrise = solar && solar.daylight !== null && !noSunEvents ? solarTime(solar.sunrise, solar.date, d.timezone, d.offsetSeconds) : null;
  const sunset = solar && solar.daylight !== null && !noSunEvents ? solarTime(solar.sunset, solar.date, d.timezone, d.offsetSeconds) : null;
  const sunriseDesc = sunrise ? `Sunrise ${sunrise}` : noSunEvents ? "No sunrise today" : "Sunrise unavailable";
  const sunsetDesc = sunset ? `Sunset ${sunset}` : noSunEvents ? "No sunset today" : "Sunset unavailable";
  const sunItem = (label, time) => el("span", { class: "ww-solar-item" },
    el("span", { class: "ww-ht" }, label), icon("sun-horizon", "wx wx-sun"),
    el("span", { class: "ww-hv" }, time || "—"));
  const hours = (d.hours || []).map(h => {
    const x = wx(h.code, h.day);
    return el("span", { class: "ww-h" }, el("span", { class: "ww-ht" }, hourLabel(h.t)), x.svg, el("span", { class: "ww-hv" }, `${Math.round(h.temp)}°`));
  });
  box.replaceChildren(
    el("span", { class: "ww-top" },
      el("span", { class: "ww-now" },
        locationRow(w, air, airStale),
        el("span", { class: "ww-temp" }, `${Math.round(d.temp)}°`)),
      el("span", { class: "ww-cond" }, now.svg, el("span", { class: "ww-label" }, now.label), el("span", { class: "ww-hl" }, hl))),
    el("span", { class: "ww-details" },
      hours.length ? el("span", { class: "ww-hours" }, hours) : "",
      el("span", { class: "ww-solar" }, sunItem("Sunrise", sunrise), sunItem("Sunset", sunset))));
  const updated = new Date(d.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  box.title = `${w.name} · ${now.label} · High ${Math.round(d.hi)}° · Low ${Math.round(d.lo)}° · ${sunriseDesc} · ${sunsetDesc} · ${airDescription(air, airStale)} · Updated ${updated}${stale ? " (offline)" : ""}.`;
  box.setAttribute("aria-label", `Weather in ${w.name}: ${Math.round(d.temp)} degrees, ${now.label}. High ${Math.round(d.hi)}, low ${Math.round(d.lo)}. ${sunriseDesc}. ${sunsetDesc}. ${airDescription(air, airStale)}.`);
  box.classList.toggle("stale", !!stale);
}

/** City search for the settings panel. */
export async function geocode(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  return (j.results || []).map(x => ({
    name: [x.name, x.admin1 && x.admin1 !== x.name ? x.admin1 : null, x.country_code].filter(Boolean).join(", "),
    lat: x.latitude, lon: x.longitude, tz: x.timezone,
  }));
}
