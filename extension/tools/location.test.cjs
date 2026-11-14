const assert = require("node:assert/strict");
const test = require("node:test");

const settings = {
  weather: { name: "Seattle, WA", lat: 47.6, lon: -122.3, show: true, units: "F", click: "bing" },
  myClock: { label: "London", tz: "Europe/London" },
  worldClocks: [{ label: "Tokyo", tz: "Asia/Tokyo" }],
};
let serial = 0;
const storedFix = (at = Date.now()) => ({ lat: 35.676, lon: 139.65, tz: "Asia/Tokyo", name: "Tokyo, Japan", city: "Tokyo", at });

test("manifest declares geolocation as required, never optional", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.ok(manifest.permissions.includes("geolocation"));
  assert.ok(!manifest.optional_permissions?.includes("geolocation"));
});

async function fixture(t, saved = {}) {
  const savedGlobals = new Map(["chrome", "navigator", "document", "fetch", "setTimeout", "clearTimeout"]
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  t.mock.method(console, "warn", () => {});
  const local = structuredClone(saved);
  const changes = [], removed = [], visibility = [], timers = [];
  const calls = { positions: 0, requests: 0, fetches: 0, syncWrites: 0 };
  let allowed = true, positionError = null, fetchError = null, release = null, cityFailure = false;
  const setGlobal = (key, value) => Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const storage = {
    async get(keys) {
      return Object.fromEntries((typeof keys === "string" ? [keys] : keys).map(key => [key, local[key]]));
    },
    async set(items) {
      const event = {};
      for (const [key, value] of Object.entries(items)) {
        event[key] = { oldValue: local[key], newValue: value };
        local[key] = value;
      }
      for (const fn of changes) fn(event, "local");
    },
  };
  setGlobal("chrome", {
    runtime: { getManifest: () => ({ permissions: ["geolocation"] }) },
    storage: { local: storage, sync: { set() { calls.syncWrites++; } }, onChanged: { addListener: fn => changes.push(fn) } },
    permissions: {
      request: async () => { calls.requests++; return allowed; },
      contains: async () => allowed,
      onRemoved: { addListener: fn => removed.push(fn) },
    },
  });
  setGlobal("document", { hidden: false, addEventListener: (_, fn) => visibility.push(fn) });
  setGlobal("navigator", {
    geolocation: { getCurrentPosition(resolve, reject, options) {
      calls.positions++;
      assert.equal(options.enableHighAccuracy, false);
      assert.ok(options.timeout > 0);
      const complete = () => positionError ? reject(positionError)
        : resolve({ coords: { latitude: 40.712812, longitude: -74.006012 } });
      if (release) release.complete = complete;
      else complete();
    } },
  });
  setGlobal("fetch", async url => {
    calls.fetches++;
    assert.match(url, /latitude=40\.713&longitude=-74\.006/);
    if (fetchError) throw fetchError;
    if (url.includes("bigdatacloud")) {
      if (cityFailure) throw new Error("City lookup offline");
      return { ok: true, json: async () => ({ city: "New York", principalSubdivision: "New York", countryName: "United States" }) };
    }
    return { ok: true, json: async () => ({ timezone: "America/New_York" }) };
  });
  setGlobal("setTimeout", (fn, delay) => { const timer = { fn, delay }; timers.push(timer); return timer; });
  setGlobal("clearTimeout", timer => { if (timer) timer.cancelled = true; });
  const api = await import(`../src/location.js?test=${serial++}`);
  await api.initLocation();
  return {
    api, local, calls, storage, timers, visibility,
    deny() { allowed = false; },
    geoError(code) { positionError = code === null ? null : { code }; },
    offline() { fetchError = new Error("Offline"); },
    cityOffline() { cityFailure = true; },
    hold() { release = {}; return release; },
    revoke() { allowed = false; for (const fn of removed) fn({ permissions: ["geolocation"] }); },
  };
}

test("manual is the default and does not request or fetch device location", async t => {
  const { api, calls } = await fixture(t);
  assert.equal(api.getLocationState().automatic, false);
  assert.equal(api.effectiveWeather(settings), settings.weather);
  assert.equal(api.effectiveMyClock(settings), settings.myClock);
  assert.equal(calls.requests + calls.positions + calls.fetches, 0);
});

test("an older loaded manifest produces a reload instruction before detecting location", async t => {
  const { api, calls, local } = await fixture(t);
  chrome.runtime.getManifest = () => ({ permissions: ["storage"] });
  await assert.rejects(api.setAutomaticLocation(true), /Reload Omarchy Start/);
  assert.equal(calls.requests, 0);
  assert.equal(local.deviceLocationAutomatic, undefined);
  assert.equal(api.getLocationState().automatic, false);
});

test("enabling detects approximate position and timezone without changing manual or sync settings", async t => {
  const { api, calls, local } = await fixture(t);
  const before = structuredClone(settings);
  await api.setAutomaticLocation(true);
  assert.equal(calls.requests, 0);
  assert.equal(calls.positions, 1);
  assert.equal(calls.fetches, 2);
  assert.equal(calls.syncWrites, 0);
  assert.equal(local.deviceLocationAutomatic, true);
  assert.equal(local.deviceLocationFix.lat, 40.713);
  assert.equal(api.effectiveWeather(settings).name, "New York");
  assert.equal(api.effectiveMyClock(settings).tz, "America/New_York");
  assert.deepEqual(settings, before);
  await api.setAutomaticLocation(false);
  assert.equal(api.effectiveWeather(settings), settings.weather);
  assert.equal(api.effectiveMyClock(settings), settings.myClock);
});

test("permission denial retains a visible manual fallback without repeated prompts", async t => {
  const { api, calls, deny } = await fixture(t);
  deny();
  await api.setAutomaticLocation(true);
  assert.equal(api.getLocationState().fallback, true);
  assert.match(api.getLocationState().error, /permission/i);
  assert.match(api.effectiveWeather(settings).name, /manual fallback/);
  assert.equal(api.effectiveMyClock(settings).tz, "Europe/London");
  await api.refreshLocation(true);
  assert.equal(calls.requests, 0);
  assert.equal(calls.positions, 0);
});

test("automatic location includes city lookup with short widget names and full settings name", async t => {
  const { api, calls, local } = await fixture(t);
  await api.setAutomaticLocation(true);
  assert.equal(calls.fetches, 2);
  assert.equal(local.deviceLocationCityNames, undefined);
  assert.equal(api.getLocationState().label, "New York, United States");
  assert.equal(api.effectiveWeather(settings).name, "New York");
  assert.equal(api.effectiveMyClock(settings).label, "New York");
});

test("failed city lookup keeps valid weather coordinates and explicitly reports name failure", async t => {
  const { api, cityOffline } = await fixture(t);
  cityOffline();
  await api.setAutomaticLocation(true);
  assert.equal(api.getLocationState().phase, "ready");
  assert.equal(api.effectiveMyClock(settings).tz, "America/New_York");
  assert.match(api.getLocationState().nameError, /City name unavailable/);
  assert.equal(api.getLocationState().label, "40.713°, -74.006°");
});

test("old unnamed fixes upgrade automatically even with the legacy city switch off", async t => {
  const { api, calls } = await fixture(t, {
    deviceLocationAutomatic: true, deviceLocationCityNames: false,
    deviceLocationFix: { ...storedFix(), name: undefined, city: undefined },
  });
  await api.refreshLocation();
  assert.equal(calls.positions, 1);
  assert.equal(api.getLocationState().label, "New York, United States");
});

test("a fresh cached fix is reused across loads without a new position lookup", async t => {
  const { api, calls } = await fixture(t, { deviceLocationAutomatic: true, deviceLocationFix: storedFix() });
  await api.refreshLocation();
  assert.equal(api.getLocationState().phase, "ready");
  assert.equal(api.effectiveMyClock(settings).tz, "Asia/Tokyo");
  assert.equal(calls.positions, 0);
  assert.equal(calls.requests, 0);
});

test("the refresh timer respects the age of an already cached fix", async t => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const { api, timers } = await fixture(t, {
    deviceLocationAutomatic: true, deviceLocationFix: storedFix(now - 29 * 60 * 1000),
  });
  await api.refreshLocation();
  assert.equal(timers.at(-1).delay, 60000);
});

test("timeout and offline failures keep the last location and label the fallback", async t => {
  const { api, geoError, offline } = await fixture(t, { deviceLocationFix: storedFix() });
  geoError(3);
  await api.setAutomaticLocation(true);
  assert.match(api.getLocationState().error, /timed out/);
  assert.match(api.effectiveWeather(settings).name, /last known/);
  assert.equal(api.effectiveMyClock(settings).tz, "Asia/Tokyo");
  geoError(null);
  offline();
  await api.refreshLocation(true);
  assert.match(api.getLocationState().error, /Offline/);
  assert.equal(api.getLocationState().fallback, true);
});

test("revoked permission immediately marks cached location as a fallback", async t => {
  const { api, revoke, calls } = await fixture(t);
  await api.setAutomaticLocation(true);
  revoke();
  assert.match(api.getLocationState().error, /removed/);
  assert.equal(api.getLocationState().fallback, true);
  await api.refreshLocation(true);
  assert.equal(calls.positions, 1);
});

test("returning after a failed forced refresh does not relabel an unverified fix as live", async t => {
  const { api, geoError, visibility, calls } = await fixture(t);
  await api.setAutomaticLocation(true);
  geoError(1);
  await api.refreshLocation(true);
  assert.match(api.getLocationState().label, /last known/);
  visibility[0]();
  await api.refreshLocation();
  assert.match(api.getLocationState().label, /last known/);
  assert.equal(calls.positions, 3);
});

test("disabling while detection is pending ignores the late result", async t => {
  const { api, local, hold } = await fixture(t);
  const blocked = hold();
  const work = api.setAutomaticLocation(true);
  for (let i = 0; i < 20 && !blocked.complete; i++) await Promise.resolve();
  assert.ok(blocked.complete);
  await api.setAutomaticLocation(false);
  blocked.complete();
  await work;
  assert.equal(local.deviceLocationAutomatic, false);
  assert.equal(local.deviceLocationFix, undefined);
  assert.equal(api.effectiveWeather(settings), settings.weather);
});

test("returning to a visible dashboard refreshes an expired fix and detects movement", async t => {
  const now = Date.now();
  const { api, calls, visibility } = await fixture(t, { deviceLocationAutomatic: true, deviceLocationFix: storedFix(now) });
  await api.refreshLocation();
  t.mock.method(Date, "now", () => now + api.LOCATION_TTL + 1);
  visibility[0]();
  await api.refreshLocation();
  assert.equal(calls.positions, 1);
  assert.equal(api.effectiveWeather(settings).lat, 40.713);
  assert.equal(api.effectiveMyClock(settings).tz, "America/New_York");
});

test("invalid saved fixes fall back to manual settings", async t => {
  const { api, deny } = await fixture(t, { deviceLocationFix: { ...storedFix(), tz: "not/a-zone" } });
  deny();
  await api.setAutomaticLocation(true);
  assert.equal(api.getLocationState().at, null);
  assert.match(api.effectiveWeather(settings).name, /manual fallback/);
});

test("other tabs' mode and position changes update the effective location", async t => {
  const { api, storage } = await fixture(t);
  await storage.set({ deviceLocationFix: storedFix(), deviceLocationAutomatic: true });
  await api.refreshLocation();
  assert.equal(api.effectiveMyClock(settings).tz, "Asia/Tokyo");
  await storage.set({ deviceLocationAutomatic: false });
  assert.equal(api.effectiveMyClock(settings), settings.myClock);
});

test("a successful fix from another tab clears an earlier detection failure", async t => {
  const { api, storage, geoError } = await fixture(t);
  geoError(3);
  await api.setAutomaticLocation(true);
  assert.match(api.getLocationState().error, /timed out/);
  await storage.set({ deviceLocationFix: storedFix() });
  assert.equal(api.getLocationState().error, "");
  assert.equal(api.getLocationState().fallback, false);
});

test("a queued cross-tab refresh uses the fix written by the previous lock holder", async t => {
  const { api, storage, calls } = await fixture(t);
  let release;
  navigator.locks = { request: (_, run) => new Promise(resolve => {
    release = () => resolve(run());
  }) };
  await storage.set({ deviceLocationAutomatic: true });
  const work = api.refreshLocation();
  assert.ok(release);
  await storage.set({ deviceLocationFix: storedFix() });
  release();
  await work;
  assert.equal(api.effectiveMyClock(settings).tz, "Asia/Tokyo");
  assert.equal(calls.positions, 0);
});

test('one fixed location supplies both weather coordinates and local clock time zone', async t => {
  const { api } = await fixture(t);
  const config = { ...settings, fixedLocation: { name: 'Tokyo, JP', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' } };
  assert.equal(api.effectiveWeather(config).lat, 35.68);
  assert.equal(api.effectiveWeather(config).name, 'Tokyo, JP');
  assert.equal(api.effectiveMyClock(config).label, 'Tokyo');
  assert.equal(api.effectiveMyClock(config).tz, 'Asia/Tokyo');
  await api.setAutomaticLocation(true);
  assert.equal(api.effectiveWeather(config).name, 'New York');
  assert.equal(api.effectiveMyClock(config).tz, 'America/New_York');
  await api.setAutomaticLocation(false);
  assert.equal(api.effectiveWeather(config).name, 'Tokyo, JP');
  assert.equal(api.effectiveMyClock(config).tz, 'Asia/Tokyo');
});
