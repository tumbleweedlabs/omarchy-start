# Omarchy Start 0.1.4 browser check

Use the unpacked folder `extension/` (the folder containing `manifest.json`) or `dist/omarchy-start-0.1.4/`. Keep only one copy enabled per browser. Record browser name and version, Omarchy version if known, and the date. A screenshot proves appearance at one size; record interaction outcomes separately.

## Screenshot for the store

- Capture the actual new-tab page at **1280 × 800 px**, ideally at 100% browser zoom. Google requires at least one screenshot of the running extension at this size (or 640 × 400); the larger size is preferred.
- Show the normal dashboard with the clock, weather, search, quick links, and news visible. Use a wallpaper and links you are comfortable publishing. Check the image for private names, location, feed URLs, open dialogs, or browser notifications before sharing it.
- A second screenshot at a narrow window or increased zoom helps verify the no-scroll layout; it need not be used for the store listing.

## Core Chrome pass

1. **Fresh install:** Open a new tab after loading the extension. Record whether the first-run tour appears and ends at Settings → Background. Check Comfy density, 24-hour clock, Omarchy news, and the Omarchy quick link. A previously used profile is not a fresh-install test.
2. **Search and shortcuts:** Submit a Web search and confirm it reaches the browser's selected default engine. Search Omarchy Plugins and confirm the marketplace results are visible. Check `Alt+1` through `Alt+9`. Check `Alt+T` with only one Omarchy Start copy enabled; if unassigned, record what `chrome://extensions/shortcuts` shows.
3. **Wallpaper and theme:** Enter the Linux username, connect Omarchy, allow file URLs if prompted, and confirm the wallpaper appears. In a separate recovery check, try an incorrect username and confirm **Choose folder instead** appears only after the wallpaper read fails; select `/home/username/.local/state/omarchy` and connect. Turn **Show Omarchy wallpaper** off and confirm a solid theme color. Turn it back on; change wallpaper and theme while a tab is open, then open a new tab. Record whether each updates without manual reload. Check after browser restart and with two tabs open.
4. **Permission recovery:** Disable and re-enable the extension; check wallpaper again. Turn **Allow access to file URLs** off and back on, then reconnect if needed. Record whether the fallback and recovery work. Avoid revoking access during a screenshot intended for the store.
5. **RSS:** Confirm Omarchy stories open the correct articles. Choose a public HTTPS RSS/Atom feed, allow its host, and check its heading, cards, story links, and **All news** link. Deny permission for a second test feed and confirm the page stays usable. Turn RSS off and confirm cards disappear. Two-hour refresh and offline cache behavior need separate timed or controlled checks; a quick glance cannot prove them.
6. **Layout and input:** At 1280 × 800, a narrow window, and 150% browser zoom, check for page scrolling, clipped controls, overlapping cards, keyboard focus, and the first-run tour replay. Settings and menus may scroll internally.
7. **Offline:** After weather, RSS, and wallpaper have loaded once, go offline and open a new tab. Record which last-known content remains and whether the page is usable. Restore connectivity afterward.

## Browser matrix

Repeat the core new-tab, search, wallpaper permission, restart, and layout checks in each browser available on the target Omarchy machine. Mark browsers that are unavailable as untested, with the reason.

| Browser | Version | New tab/search | Wallpaper/theme | RSS | Layout | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome | | | | | | |
| Chromium | | | | | | |
| Brave | | | | | | |
| Edge | | | | | | |
| Omarchy default browser, if distinct | | | | | | |

For each failure, note the exact action, expected result, observed result, permission state, and whether it happens after restart. Do not include private wallpaper files, precise coordinates, or private feed URLs in public evidence.
