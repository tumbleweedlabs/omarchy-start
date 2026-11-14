const assert = require("node:assert/strict");
const test = require("node:test");

test("the guide runs once when introduced, including an unpacked-extension reload", async t => {
  const oldChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const oldCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  t.after(() => {
    if (oldChrome) Object.defineProperty(globalThis, "chrome", oldChrome); else delete globalThis.chrome;
    if (oldCaches) Object.defineProperty(globalThis, "caches", oldCaches); else delete globalThis.caches;
  });
  const local = {};
  let installed;
  globalThis.chrome = {
    action: { onClicked: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    runtime: { onInstalled: { addListener(fn) { installed = fn; } } },
    storage: { local: {
      async get() { return { ...local }; },
      async set(items) { Object.assign(local, items); },
      async remove(keys) { for (const key of keys) delete local[key]; },
    } },
  };
  globalThis.caches = { async delete() { return false; } };
  await import("../background/sw.js");
  await installed({ reason: "update" });
  assert.equal(local.firstRunTour, "pending");
  assert.equal(local.firstRunTourVersion, 1);
  local.firstRunTour = "seen";
  await installed({ reason: "update" });
  assert.equal(local.firstRunTour, "seen");
  delete local.firstRunTourVersion;
  delete local.firstRunTour;
  await installed({ reason: "install" });
  assert.equal(local.firstRunTour, "pending");
  local.firstRunTour = "seen";
  await installed({ reason: "chrome_update" });
  assert.equal(local.firstRunTour, "seen");
});
