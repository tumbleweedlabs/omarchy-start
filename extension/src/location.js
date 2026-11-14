// Automatic location and manual weather/clock preferences are stored on this device.
const MODE_KEY = "deviceLocationAutomatic";
const FIX_KEY = "deviceLocationFix";
export const LOCATION_TTL = 30 * 60 * 1000;
const listeners = new Set();
let automatic = false;
let fix = null;
let phase = "manual";
let error = "";
let sequence = 0;
let pending = null;
let timer;

function validFix(value) {
  if (!value || !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 ||
      !Number.isFinite(value.lon) || Math.abs(value.lon) > 180 ||
      !Number.isFinite(value.at) || value.at <= 0 || value.at > Date.now() ||
      typeof value.tz !== "string" || !value.tz) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value.tz }); return true; }
  catch { return false; }
}

function fresh() { return fix && Date.now() - fix.at < LOCATION_TTL; }
function emit() { for (const fn of listeners) fn(); }
export function subscribeLocation(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getLocationState() {
  const cached = automatic && fix && (phase === "fallback" || !fresh());
  const place = fix && (typeof fix.name === "string" && fix.name.trim()
    ? fix.name : `${fix.lat.toFixed(3)}°, ${fix.lon.toFixed(3)}°`);
  const city = fix && (typeof fix.city === "string" && fix.city.trim()
    ? fix.city : fix.name ? fix.name.split(",")[0].trim() : place);
  const suffix = cached ? " (last known)" : "";
  return {
    automatic, phase, error, at: fix?.at || null,
    tz: automatic && fix ? fix.tz : null,
    label: automatic && fix ? `${place}${suffix}` : "",
    shortLabel: automatic && fix ? `${city}${suffix}` : "",
    nameError: automatic && fix ? fix.nameError || "" : "",
    fallback: automatic && (!fix || !!cached),
  };
}

export function effectiveWeather(settings) {
  const fixed = settings.fixedLocation;
  const weather = fixed ? { ...settings.weather, name: fixed.name, lat: fixed.lat, lon: fixed.lon } : settings.weather;
  if (!automatic) return weather;
  const state = getLocationState();
  return fix
    ? { ...weather, name: state.shortLabel, lat: fix.lat, lon: fix.lon }
    : { ...weather, name: `${weather.name} (manual fallback)` };
}

export function effectiveMyClock(settings) {
  const fixed = settings.fixedLocation;
  const clock = fixed ? { label: fixed.name.split(",")[0] + (fixed.tz ? "" : " (time zone unavailable)"), tz: fixed.tz || "" } : settings.myClock;
  if (!automatic) return clock;
  const state = getLocationState();
  return fix
    ? { label: state.shortLabel, tz: fix.tz }
    : { ...clock, label: `${clock.label || "Local time"} (manual fallback)` };
}

function schedule() {
  clearTimeout(timer);
  if (!automatic) return;
  timer = setTimeout(() => {
    emit();
    if (!document.hidden) void refreshLocation();
    else schedule();
  }, phase === "ready" && fresh() ? Math.max(1000, fix.at + LOCATION_TTL - Date.now()) : LOCATION_TTL);
}

function fail(message) {
  error = message;
  phase = "fallback";
  console.warn("Location:", message);
  emit();
}

export async function initLocation() {
  try {
    const stored = await chrome.storage.local.get([MODE_KEY, FIX_KEY]);
    automatic = stored[MODE_KEY] === true;
    fix = validFix(stored[FIX_KEY]) ? stored[FIX_KEY] : null;
    phase = automatic ? (fresh() ? "ready" : "fallback") : "manual";
  } catch (e) {
    fail("Couldn't read device location settings. Using the saved manual setup.");
  }
  emit();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!changes[MODE_KEY] && !changes[FIX_KEY])) return;
    if (changes[MODE_KEY]) {
      const next = changes[MODE_KEY].newValue === true;
      if (next !== automatic) { automatic = next; sequence++; pending = null; error = ""; }
    }
    if (changes[FIX_KEY]) {
      fix = validFix(changes[FIX_KEY].newValue) ? changes[FIX_KEY].newValue : null;
      if (fix) error = "";
    }
    phase = automatic ? (fresh() ? "ready" : "fallback") : "manual";
    emit();
    schedule();
    if (automatic && !fresh() && !document.hidden) void refreshLocation();
  });
  chrome.permissions.onRemoved.addListener(({ permissions }) => {
    if (automatic && permissions?.includes("geolocation")) {
      sequence++;
      pending = null;
      fail("Location permission was removed. Allow location in Settings to resume detection.");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && automatic) void refreshLocation();
  });
  schedule();
  if (automatic) void refreshLocation();
}

async function cityName(lat, lon) {
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    { signal: AbortSignal.timeout(10000), credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("City-name lookup is unavailable.");
  const data = await response.json();
  const city = data.city || data.locality;
  if (typeof city !== "string" || !city.trim()) throw new Error("No city name was returned for these coordinates.");
  return {
    city: city.trim(),
    name: [...new Set([city, data.principalSubdivision, data.countryName]
      .filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))].join(", "),
  };
}

export async function setAutomaticLocation(enabled) {
  if (enabled) {
    const manifest = chrome.runtime.getManifest();
    if (!(manifest.permissions || []).includes("geolocation")) {
      throw new Error("Reload Omarchy Start on the browser's Extensions page, then open a new tab and try again. The running extension hasn't loaded its location permission yet.");
    }
  }
  sequence++;
  pending = null;
  try { await chrome.storage.local.set({ [MODE_KEY]: enabled }); }
  catch (e) {
    console.warn("Location: couldn't save automatic mode.", e);
    throw new Error("Couldn't save the location setting. Try again.");
  }
  automatic = enabled;
  error = "";
  phase = enabled ? (fresh() ? "ready" : "fallback") : "manual";
  emit();
  schedule();
  if (enabled) await refreshLocation(true);
}

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Device location is unavailable in this browser.")); return; }
    navigator.geolocation.getCurrentPosition(resolve, e => {
      reject(new Error(e.code === 1 ? "Location access is blocked by the browser or device."
        : e.code === 3 ? "Location detection timed out." : "The device couldn't determine its location."));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });
}

export function refreshLocation(force = false) {
  if (!automatic) return Promise.resolve();
  if (pending) return pending;
  const current = sequence;
  const active = () => automatic && current === sequence;
  const run = async () => {
    if (!active()) return;
    if (!(await chrome.permissions.contains({ permissions: ["geolocation"] }))) {
      if (active()) fail("Location permission is not available. Check the extension and device location permissions, then refresh.");
      return;
    }
    const stored = await chrome.storage.local.get(FIX_KEY);
    if (!active()) return;
    if (validFix(stored[FIX_KEY])) fix = stored[FIX_KEY];
    if (!force && fresh() && !error && (fix.name || fix.nameError)) { phase = "ready"; emit(); return; }
    phase = "detecting";
    error = "";
    emit();
    const { coords } = await position();
    if (!active()) return;
    // Keep only approximate coordinates; no high-accuracy watch or position history.
    const lat = Math.round(coords.latitude * 1000) / 1000;
    const lon = Math.round(coords.longitude * 1000) / 1000;
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      throw new Error("The device returned an invalid location.");
    }
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&forecast_days=1&timezone=auto`,
      { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Couldn't resolve the detected location's time zone.");
    const data = await response.json();
    if (!active()) return;
    const next = { lat, lon, tz: data.timezone, at: Date.now() };
    if (!validFix(next)) throw new Error("The weather service returned an invalid location time zone.");
    try { Object.assign(next, await cityName(lat, lon)); }
    catch (e) {
      console.warn("Location: couldn't resolve city name.", e);
      next.nameError = "City name unavailable; showing detected coordinates. Refresh location to retry.";
    }
    if (!active()) return;
    await chrome.storage.local.set({ [FIX_KEY]: next });
    if (!active()) return;
    fix = next;
    phase = "ready";
    error = "";
    emit();
  };
  const work = navigator.locks
    ? navigator.locks.request("omarchy-start-device-location", run)
    : Promise.resolve().then(run);
  const task = work.catch(e => {
    if (active()) fail(e.message || "Couldn't update device location.");
  }).finally(() => {
    if (pending === task) pending = null;
    if (active()) schedule();
  });
  pending = task;
  return task;
}

// Resolve migrated fixed weather locations without guessing their time zone.
export async function resolveFixedLocation(getSettings, update) {
  const place = getSettings().fixedLocation;
  if (!place || place.tz || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m&forecast_days=1&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Time zone lookup failed");
    const { timezone } = await response.json();
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    if (!timezone) throw new Error("No time zone returned");
    await update(s => { if (s.fixedLocation && !s.fixedLocation.tz && s.fixedLocation.lat === place.lat && s.fixedLocation.lon === place.lon) s.fixedLocation.tz = timezone; });
  } catch (e) { console.warn("Fixed location time zone unavailable:", e); }
}
