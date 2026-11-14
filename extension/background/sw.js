async function openStartPage() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  } catch (error) {
    console.error("Could not open the start page:", error);
  }
}

chrome.action.onClicked.addListener(openStartPage);
chrome.commands.onCommand.addListener(command => {
  if (command === "open-start-page") void openStartPage();
});

// Remove data from providers retired in favor of the desktop wallpaper.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  try {
    const keys = ["bgPool", "bgCached", "bgRecent", "bgHidden", "bgPoolAt", "bgRes"];
    const saved = await chrome.storage.local.get(null);
    // Introduce tour v1 once per profile, including existing unpacked installs.
    // A reload is reported as an update, so this also enables a one-time preview.
    if ((reason === "install" || reason === "update") && saved.firstRunTourVersion !== 1) {
      await chrome.storage.local.set({ firstRunTour: "pending", firstRunTourVersion: 1 });
    }
    keys.push(...Object.keys(saved).filter(key => key.startsWith("art:")));
    await chrome.storage.local.remove(keys);
    await Promise.all(["ant-bg-v1", "omarchy-art-v1", "omarchy-art-pins-v1", "omarchy-displayed-background-v1"].map(name => caches.delete(name)));
  } catch (error) {
    console.warn("Could not clear retired image caches:", error);
  }
});
