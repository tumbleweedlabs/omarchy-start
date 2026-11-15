# Omarchy Start

**A quieter place to begin.**

Omarchy Start is an opinionated browser start page for Omarchy users. It brings your clock, calendar, weather, search and favorite places together in a flat, keyboard-friendly Chromium extension. The current 0.1.4 build can be installed manually while its public Chrome Web Store listing is prepared.

The [specification](SPECIFICATION.md) describes current behavior and future work. The extension reads Omarchy's current palette and wallpaper when connected. It uses generic CSS `monospace`; on the development machine, fontconfig resolves that family to the selected Omarchy font. Browser rendering and later font changes are not explicitly synchronized.

## What works in the current build

- **A useful glance:** a month calendar, local and world clocks, weather and estimated air quality, with optional device location and manual fallbacks.
- **Search that stays yours:** use the browser's default search engine, GitHub, the Omarchy Plugin Marketplace, images, video, Wikipedia and other scopes. Omarchy plugin queries open the marketplace's own filtered results. Optional search predictions are off by default.
- **Keyboard search:** `Alt+1` through `Alt+9` select search scopes in picker order: Web first, Omarchy plugins second, GitHub third. **Settings → Shortcuts** shows the full, current mapping.
- **Your links, close at hand:** Omarchy's website is the initial quick link, shown with a theme-colored Omarchy mark. Add and reorder links; choose a suggested brand mark, favicon or uploaded icon. Type a link's name in search to find it with its icon. The former link-group cards have been removed from the page.
- **RSS:** Omarchy news is enabled initially. Turn it off under **Enable RSS**, or choose **User specified** and enter an HTTPS RSS or Atom URL. The three most recent stories show headlines and opening text in clickable cards. The heading and “All news” link follow the selected feed. Custom feeds request access to their host; the last successful stories are cached and refreshed every two hours. News code is not loaded when RSS is off.
- **A little movement:** the slow wallpaper zoom is enabled by default. Reduced-motion preferences are respected.
- **Local preferences:** settings and quick links live in the browser profile, with a settings export and import. Existing link-group data stays stored and remains in exports so removing the page cards does not discard it.
- **First-run tour:** the first new tab after installation—or after the one-time tour update—points out the glance widgets, search and quick links, then opens **Settings → Background** to connect Omarchy. Replay it from **Settings → Shortcuts → Replay tour**. New profiles start with Comfy density, 24-hour time, Omarchy RSS and one Omarchy quick link; saved preferences are retained on update.

**Show Omarchy wallpaper** is on by default in **Settings → Background**. Turn it off for a solid color from the selected Omarchy theme, or from the extension's light/dark palette when Omarchy is unavailable. There are no remote background-image providers.

The [privacy policy](PRIVACY.md) describes local storage, optional permissions, and requests to weather, RSS, search, and location services.

To connect the wallpaper, enter your Linux username under **Settings → Background** and click **Connect Omarchy**. Enable **Allow access to file URLs** on the extension’s `chrome://extensions` details page if prompted, then connect again. If the wallpaper cannot be read and the browser supports folder selection, **Choose folder instead** appears; select `/home/username/.local/state/omarchy` (use **Ctrl+H** to reveal `.local`). Chromium's file permission covers local files broadly, although Omarchy Start requests only the current wallpaper and theme colors. The last displayed original image is cached locally and loaded early on new tabs. With live watching unavailable, the page checks for changes when opened or brought back into focus; no background polling is used. Still images up to 20 MB are supported. Weather and geocoding use external services; optional device location sends coordinates to those providers. See the privacy policy for the full data-flow description.

## Install the current build

Build the current ZIP with `python3 tools/build-test-package.py`; `dist/` is generated locally and is not committed. The script names the ZIP `dist/omarchy-start-<version>.zip` using the manifest version. Extract it into a folder, then select that folder with **Load unpacked**. The ZIP also has `manifest.json` at its root for Chrome Web Store upload. Its [included setup README](extension/README.md) covers permissions, known limitations and useful bug-report details. The archive contains runtime files and notices; it excludes tests and project planning documents.

1. Open `chrome://extensions` in Chrome or the equivalent extensions page in your Chromium-based browser.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select the [`extension`](extension/) directory in this checkout, or the extracted test-build folder.
4. Open a new tab. The first-run tour ends at **Settings → Background**, where you can enter your Linux username and connect Omarchy. On an existing installation that has already seen the tour, use **Settings → Shortcuts → Replay tour**.
5. If Chromium shows a footer with **Omarchy Start** and **Customize Chromium**, right-click the footer and choose **Hide footer on New Tab page**. Alternatively, open **Customize Chromium → Footer** and turn off **Show footer on New Tab page**. This footer is added by the browser.
6. After changing extension files, reload the extension on the extensions page and open another new tab.

`Alt+T` is a suggested browser shortcut, so two installed copies can conflict. If it does not work, open `chrome://extensions/shortcuts` and assign it to the enabled copy. Settings → Shortcuts reports the active assignment.

Loading the extension overrides the browser's new-tab page; disable it to return to the previous page. The browser can keep focus in the address bar on Ctrl+T, regardless of the page's autofocus request. Browser behavior may differ around file access and live folder watching. Reports should include the browser/version, steps to reproduce, observed behavior and permission state; screenshots help with layout problems.

## Design direction

Omarchy Start follows the spirit of the desktop: flat surfaces, considered typography, restrained color and room for the background to breathe. The extension follows the current Omarchy wallpaper through optional Chromium file access. The current theme palette is applied when available. CSS `monospace` may use the selected desktop font through fontconfig, but the extension does not read the font choice or explicitly refresh existing tabs when it changes.

## Development

The extension uses Manifest V3, HTML, CSS and JavaScript modules. There is no application build step. Source is in `extension/src`, styling in `extension/styles`, and the service worker in `extension/background`.

Run the automated checks with:

```sh
cd extension
node --test tools/*.test.cjs
```

Rebuild from the runtime files with `python3 tools/build-test-package.py` at the project root. The script takes the version from `extension/manifest.json`, keeps only that version's folder and ZIP in `dist/`, and produces the same ZIP bytes from the same source files.

A successful unit run does not replace testing the extension in a real browser. Review interaction, accessibility, layout, permission recovery and desktop integration when changing these features; see the [specification](SPECIFICATION.md).

The [Chrome Web Store submission copy](STORE_SUBMISSION.md) keeps listing text, permission explanations, and the remaining submission gates together.

## Credits and licensing

Designed by Tumbleweed Labs. First-party code is licensed under the [MIT License](LICENSE). Bundled assets and data have separate terms in the [third-party notices](extension/LICENSES.md); both files are included in the package. Omarchy is a separate project, and this extension does not claim official affiliation.
