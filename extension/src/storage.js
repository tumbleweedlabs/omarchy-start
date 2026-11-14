/* One-time migration. Only these extension-owned keys ever enter browser sync. */
import { ICON_KEY_PREFIX } from "./qicon.js";

const MARKER = "localStorageMigration";
let migrating;

export function localStorageReady() {
  if (!migrating) {
    migrating = (async () => {
      const marker = await chrome.storage.local.get([MARKER]);
      if (marker[MARKER] === "complete") return;
      return navigator.locks.request("ant-storage-migration", async () => {
        const local = chrome.storage.local;
        const saved = await local.get(null);
        if (saved[MARKER] === "complete") return;
        const legacy = await chrome.storage.sync.get(null);
        const keys = Object.keys(legacy).filter(k => k === "settings" || k === "quick" || k.startsWith(ICON_KEY_PREFIX));
        const copied = {};
        for (const key of keys) {
          if ((!(key in saved) || saved[MARKER]?.pending?.includes(key)) && saved[MARKER] !== "copied") {
            copied[key] = legacy[key];
          }
        }
        if (saved[MARKER]?.pending?.some(key => !(key in legacy))) {
          throw new Error("The legacy migration source changed before its copy could be verified.");
        }
        if (saved[MARKER] !== "copied") {
          await local.set({ ...copied, [MARKER]: { pending: Object.keys(copied) } });
        }
        const verified = await local.get(Object.keys(copied));
        for (const [key, value] of Object.entries(copied)) {
          if (JSON.stringify(verified[key]) !== JSON.stringify(value)) {
            throw new Error("Could not verify the local copy. Browser sync data was not removed.");
          }
          await local.set({ [MARKER]: "copied" });
        }
        if (keys.length) await chrome.storage.sync.remove(keys);
        await local.set({ [MARKER]: "complete" });
      });
    })().catch(error => {
      migrating = null;
      console.error("Local storage migration:", error);
      throw new Error("Couldn't finish moving settings to this device or removing old browser sync data. Reload to retry. Your saved data has not been discarded.", { cause: error });
    });
  }
  return migrating;
}
