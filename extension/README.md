# Omarchy Start test copy

An opinionated browser start page for Omarchy users. This is an early test build, not an official Omarchy installation.

## Install

1. Extract the archive and open `chrome://extensions` (or your Chromium browser's extensions page).
2. Turn on **Developer mode**, choose **Load unpacked**, and select this folder, the one containing `manifest.json`.
3. Open a new tab. The tour ends at **Settings → Background**. **Settings → Shortcuts → Replay tour** runs it again. Fresh profiles start with Comfy density, 24-hour time, Omarchy RSS and an Omarchy website quick link.
4. To show the Omarchy wallpaper, choose **Connect Omarchy** under **Settings → Background**. Select `/home/username/.local/state/omarchy` in the folder picker; use **Ctrl+H** to reveal `.local`. The extension reads Omarchy state to infer your username. If that state entry is unavailable, enter the username shown in Settings. Enable **Allow access to file URLs** in the extension's details when prompted, then click **Connect Omarchy** again if needed.
5. If Chromium adds its own footer, right-click it and choose **Hide footer on New Tab page**.

The extension replaces the browser's new-tab page while enabled. Disable it on the extensions page to restore the previous page. Its settings and cached wallpaper remain in your browser profile unless you remove the extension or clear that data.

## Please test

- Open a new tab, use search and `Alt+1`–`Alt+9`, then add and open a quick link.
- Connect the wallpaper, change your Omarchy wallpaper and theme, and check an already open tab plus a new tab. Restart the browser and check again.
- Confirm Omarchy news appears by default, then try an HTTPS RSS/Atom URL of your choice. Check story links, the feed heading and offline display.
- Check a narrow window and browser zoom. The start page should not require scrolling or hide controls.

Known limitation: the selected Omarchy system font is not yet followed. Browser compatibility beyond the browser and version you test is still being checked. The first-run tour can be skipped.

**Alt+T** is a suggested browser shortcut. If another copy of Omarchy Start has it, Chromium may leave this copy unassigned, even after switching copies. Open `chrome://extensions/shortcuts` and assign **Alt+T** to the enabled copy. Settings → Shortcuts shows whether its shortcut is active. On other Chromium browsers, use that browser's extensions shortcuts page.

## Permissions and feedback

The wallpaper connection asks for local file access to read Omarchy's current wallpaper and theme; Chromium's file URL permission is broader than that path. A custom RSS feed asks for access to its host. Search predictions, when enabled, contact the selected provider. Automatic location may send coordinates to weather and location services. The extension stores settings, links, feed stories and the last wallpaper image in the browser profile.

When reporting an issue, include your browser and version, Omarchy version if known, the steps to reproduce, what appeared instead, and whether wallpaper/RSS permissions were granted. A screenshot helps for layout problems. Please avoid sending private feed URLs, location details or your wallpaper file unless you intend to share them.

First-party code: [MIT License](LICENSE). Bundled assets and data: [third-party notices](LICENSES.md). This test build is not affiliated with or endorsed by Omarchy.
