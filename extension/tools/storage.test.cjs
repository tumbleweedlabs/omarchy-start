const assert = require("node:assert/strict");
const test = require("node:test");
let serial = 0;

async function fixture(t, localData = {}, legacyData = {}) {
  const descriptors = new Map(["chrome", "navigator"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => {
    for (const [k, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor);
      else delete globalThis[k];
    }
  });
  t.mock.method(console, "error", () => {});
  const local = structuredClone(localData), legacy = structuredClone(legacyData);
  const calls = { removed: [], reads: 0, failWrite: false, failRemove: false, corrupt: false };
  let queue = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    request(name, run) {
      const result = queue.then(run);
      queue = result.catch(() => {});
      return result;
    },
  } } });
  globalThis.chrome = { storage: {
    local: {
      async get(keys) {
        const found = structuredClone(keys === null ? local : Object.fromEntries(keys.map(k => [k, local[k]])));
        if (calls.corrupt && keys?.includes("settings")) found.settings = { theme: "corrupt" };
        return found;
      },
      async set(items) {
        if (calls.failWrite) throw new Error("QUOTA_BYTES");
        Object.assign(local, structuredClone(items));
      },
    },
    sync: {
      async get() { calls.reads++; return structuredClone(legacy); },
      async set() { throw new Error("Sync writes are forbidden"); },
      async remove(keys) {
        if (calls.failRemove) throw new Error("Removal unavailable");
        calls.removed.push(...keys);
        keys.forEach(k => delete legacy[k]);
      },
    },
  } };
  const load = () => import(`../src/storage.js?migration=${serial++}`);
  return { local, legacy, calls, load, ready: (await load()).localStorageReady };
}

test("migration copies only owned keys, preserves local authority, and verifies before deleting", async t => {
  const f = await fixture(t, { quick: [{ id: "local" }], "qi:local": { r: "new" }, bgCached: ["photo"], deviceLocation: "here" },
    { settings: { theme: "light" }, quick: [{ id: "old" }], "qi:local": { r: "old" }, "qi:old": { r: "legacy" }, unrelated: "keep" });
  await f.ready();
  assert.deepEqual(f.local.settings, { theme: "light" });
  assert.deepEqual(f.local.quick, [{ id: "local" }]);
  assert.equal(f.local["qi:local"].r, "new");
  assert.equal(f.local["qi:old"].r, "legacy");
  assert.deepEqual(f.local.bgCached, ["photo"]);
  assert.equal(f.local.deviceLocation, "here");
  assert.deepEqual(f.legacy, { unrelated: "keep" });
  assert.equal(f.local.localStorageMigration, "complete");
  await (await f.load()).localStorageReady();
  assert.equal(f.calls.reads, 1, "a completed migration must never consume sync again");
});

test("page and worker migration instances serialize without losing local changes", async t => {
  const f = await fixture(t, {}, { settings: { theme: "light" }, quick: [] });
  const other = await f.load();
  await Promise.all([f.ready(), other.localStorageReady()]);
  assert.equal(f.calls.reads, 1);
  assert.equal(f.calls.removed.length, 2);
});

test("quota failure leaves legacy data intact and migration retryable", async t => {
  const f = await fixture(t, {}, { settings: { theme: "light" } });
  f.calls.failWrite = true;
  await assert.rejects(f.ready(), /Reload to retry/);
  assert.deepEqual(f.calls.removed, []);
  assert.ok(f.legacy.settings);
  f.calls.failWrite = false;
  await f.ready();
  assert.equal(f.local.settings.theme, "light");
  assert.equal(f.legacy.settings, undefined);
});

test("verification failure never deletes data, including on the next migration instance", async t => {
  const f = await fixture(t, {}, { settings: { theme: "light" } });
  f.calls.corrupt = true;
  await assert.rejects(f.ready(), /Reload to retry/);
  assert.deepEqual(f.calls.removed, []);
  assert.ok(f.legacy.settings);
  await assert.rejects((await f.load()).localStorageReady(), /Reload to retry/);
  assert.deepEqual(f.calls.removed, []);
  f.calls.corrupt = false;
  await f.ready();
  assert.equal(f.local.settings.theme, "light");
  assert.equal(f.local.localStorageMigration, "complete");
});

test("failed legacy cleanup retries removal without overwriting the authoritative local copy", async t => {
  const f = await fixture(t, {}, { settings: { theme: "light" } });
  f.calls.failRemove = true;
  await assert.rejects(f.ready(), /Reload to retry/);
  assert.equal(f.local.localStorageMigration, "copied");
  f.local.settings.theme = "dark";
  f.calls.failRemove = false;
  await (await f.load()).localStorageReady();
  assert.equal(f.local.settings.theme, "dark");
  assert.equal(f.legacy.settings, undefined);
});
