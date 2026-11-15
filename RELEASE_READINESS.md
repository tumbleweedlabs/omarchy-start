# Omarchy Start release readiness

**Status:** Working prototype, not yet ready for public distribution
**Last reviewed:** 15 November 2026

This is the working checklist for a first public release. A missing verification is not a confirmed defect. Keep the evidence and decision beside each item as it is closed. The [README](README.md) describes the current build; the [specification](SPECIFICATION.md) describes the intended product, but some proposed integration approaches there predate the direct-file implementation.

**Tracking rule:** When an item is complete, mark its box `[x]`, strike through the item text, and append a short dated status update with the result and a link to evidence when available. For example: `- [x] ~~Verify source X in Chromium.~~ 13 Nov 2026: Image, credit and cache worked in Chromium 131; see test notes.` If a source is deferred, record the release decision and strike through its verification item only after that source is removed from the release build. Keep open items unstruck and update **Last reviewed** whenever this tracker changes.

The owner approved the [privacy policy](PRIVACY.md) and [store submission copy](STORE_SUBMISSION.md) and reported that the developer account has a suitable email. Two owner-approved 1280 × 800 [listing screenshots](store-assets/README.md) are prepared. Live browser checks remain open.

Use the [0.1.4 browser check](BROWSER_TEST_CHECKLIST.md) to record browser versions, visible results, and failures. A screenshot alone does not verify interactions or permission recovery.

## Current iteration

- [x] ~~Credit Tumbleweed Labs in Settings.~~ 15 Nov 2026: Added a small credit at the bottom of Settings linking to the project repository. The owner tested the unpacked 0.1.4 change locally and confirmed that it works and looks good.
- [x] ~~Remove the development archive and stale identifiers.~~ 14 Nov 2026: Deleted the unused archive, removed its links from product docs, and renamed the remaining source identifiers.
- [x] ~~Remove the experimental link-group cards and their startup code.~~ 13 Nov 2026: Removed the UI and unused group/catalog modules; stored legacy groups remain available in exports.
- [x] ~~Remove Pomodoro from the release scope.~~ 13 Nov 2026: Removed the timer UI, settings, modules and test; legacy timer state is cleared on startup.
- [x] ~~Keep the start page within the viewport.~~ 13 Nov 2026: Disabled page scrolling and made news cards use remaining height, with tighter widgets, spacing and cards on short or narrow windows. Browser visual review remains open below.
- [x] ~~Route Omarchy plugin searches to the catalog anchor.~~ 13 Nov 2026: Searches now end in `#catalog`, the marketplace's own results-section anchor; URL test passes.
- [x] ~~Give quick access more room above the bottom frame.~~ 13 Nov 2026: Increased footer bottom padding by 10 px.
- [x] ~~Add an optional three-card Omarchy news section.~~ 13 Nov 2026: Added official RSS headlines with direct story links, an opt-in site permission and a six-hour refresh window; no news startup code or request when disabled. Feed normalization and parsing tests passed. The refresh window changed to two hours on 14 Nov 2026.
- [x] ~~Show opening body text beneath each news headline.~~ 13 Nov 2026: Cards use the RSS article body, capped at 520 characters and ten display lines, with a distinct headline style. They match the top widgets' column spacing and shrink with available viewport height. The cache version forces a refresh of old short excerpts.
- [x] ~~Defer recent-plugin cards to keep the page lean.~~ 13 Nov 2026: Omarchy Plugins remains a search scope; no extra registry feed or page cards were added.
- [ ] Visually verify the no-scroll layout, news cards, catalog scroll position and footer spacing in the installed extension, including narrow windows and browser zoom. Browser Use blocked access to the `chrome-extension://` page during this pass; source and automated checks are available. 14 Nov 2026: Owner screenshots at 740 × 1044 and 1657 × 1088 show all three news cards and bottom controls without visible clipping. At 740 px, the weather location and search hint truncate; browser zoom, catalog scroll position, and interactive behavior remain unverified.
- [x] ~~Verify the Omarchy RSS cards and story click-through in an unpacked Chromium extension.~~ 13 Nov 2026: The user confirmed the stories populated and click-through worked in the installed extension. The new taller body-text layout still needs visual review.
- [x] ~~Add selectable Omarchy or user-specified RSS/Atom feeds.~~ 14 Nov 2026: The Enable RSS control offers Omarchy news or an HTTPS feed URL, requests access to its host, uses separate last-successful caches and refreshes after two hours. RSS/Atom parser tests pass.
- [x] ~~Remove remote image providers and simplify Background.~~ 14 Nov 2026: The only image source is the current Omarchy wallpaper. Turning it off shows the selected theme color. Retired provider modules, cache data and host permissions were removed; wallpaper cache tests pass.
- [x] ~~Add a first-run guide to the main controls.~~ 14 Nov 2026: A skippable four-step tour points to widgets, search, quick links and Settings on the first new tab after installation or its one-time introduction to an existing profile; Replay tour is available under Shortcuts. It requests no extra permissions.
- [x] ~~Set first-install defaults and end setup at Omarchy connection.~~ 14 Nov 2026: Fresh profiles use Comfy density, 24-hour time, Omarchy RSS and one Omarchy website quick link with a theme-colored mark. The first-run tour opens Settings at Background even when skipped; existing profiles retain saved choices. Store tests pass; the owner confirmed the guided file-access setup worked in the browser on 14 Nov 2026.
- [x] ~~Prepare a limited test package and tester guide.~~ 15 Nov 2026: Rebuilt the load-unpacked folder and ZIP from runtime files, with MIT and third-party notices plus setup, permission, known-limit and feedback guidance. The current candidate is `dist/omarchy-start-0.1.4.zip`. The ZIP has `manifest.json` at its root; the deterministic builder removes older `dist/` versions.
- [ ] Retest the 0.1.4 candidate in Chromium: Alt+T assignment with only one copy enabled, username-first connection and folder recovery, file URL access after disable/re-enable, and wallpaper refresh. `chrome.commands.getAll()` now reports an unassigned shortcut in Settings and after the first-run tour; the browser's shortcut manager remains the place to resolve conflicts. 14 Nov 2026: The owner confirmed guided connection and file access worked in the browser. A sequential permission-recovery test (deny → grant → enable file URLs → retry) and all 10 Node test files pass. 15 Nov 2026: The owner reports having run the browser checks; browser versions and individual outcomes have not been recorded in this tracker.
- [ ] Verify a user-specified RSS/Atom feed, source heading, All news link, two-hour refresh and permission denial in an unpacked Chromium extension.
- [ ] Visually verify the first-run tour and replay at short/narrow viewport sizes, keyboard-only, and browser zoom.
- [ ] Check the 0.1.4 fresh-install defaults, Omarchy icon contrast, required Omarchy RSS permission, and tour-to-Background connection in an unpacked Chromium browser.

## 1. Code license and bundled asset rights

The first-party code is now MIT-licensed. Bundled icons and fonts retain their own terms, listed in [third-party notices](extension/LICENSES.md). The user's Omarchy wallpaper is the only background image; no remote image provider ships.

- [x] ~~Select and add the project license at the repository root; confirm it covers the first-party code.~~ 14 Nov 2026: Added the MIT License for first-party code and included it in the test extension package.
- [x] ~~Review bundled assets and package all required notices.~~ 14 Nov 2026: Reviewed Phosphor, Lucide, Font Awesome, Geist and Open-Meteo notices; the test package includes `LICENSES.md` and Geist's OFL text.
- [x] ~~Remove image sources with unresolved rights or browser delivery.~~ 14 Nov 2026: Removed all remote image providers and their runtime code; only the user-authorized desktop wallpaper remains.
- [ ] Verify the wallpaper permission, refresh and original-image cache behavior in each supported browser.

**Done when:** the public package has an explicit code license and notices, and the wallpaper path is verified in supported browsers.

## 2. Omarchy theme, font and wallpaper

The extension already reads the current Omarchy palette and wallpaper through optional local-file access. It checks for changes when a tab opens or regains focus. Live updates in an already open tab use `FileSystemObserver` when the browser supports it and the selected folder remains authorized; this is not yet proven across the target browsers. The page currently bundles **Geist** as its main font, so following Omarchy's selected system font is genuinely unfinished. See the [watcher](extension/src/omarchy-watch.js), [theme code](extension/src/theme.js) and [font CSS](extension/styles/app.css).

- [ ] Implement the selected Omarchy system font with a tested fallback when it cannot be resolved.
- [ ] Test a theme change, font change and independent wallpaper change while a tab is open.
- [ ] Repeat after browser restart, with multiple tabs, and after permission is revoked and restored.
- [ ] Document the live-update behavior in browsers without `FileSystemObserver`; keep the existing open/focus refresh reliable.

**Done when:** the page visibly follows a theme, font and wallpaper change under the supported permission flow, or states a tested browser-specific limitation. This work does not assume a separate helper application.

## 3. RSS and browser verification

The owner confirmed Omarchy news stories and click-through in an unpacked Chromium extension. The new custom-feed option, two-hour refresh and browser matrix still need live checks. Automated parser, settings and wallpaper-cache tests pass.

- [ ] Test Omarchy and user-specified RSS/Atom feeds in an unpacked extension, including feed title, All news link, per-feed cache, permission denial, offline display and refresh timing.
- [ ] Test clean installation and normal new-tab use in Chrome, Chromium, Brave and Edge, recording versions and Omarchy's default browser where distinct.
- [ ] In each supported browser, check local-file permission, wallpaper/theme refresh, search, original-image caching, restart and offline fallback.
- [x] ~~Run the project tests after simplifying RSS and backgrounds.~~ 14 Nov 2026: All 10 current Node test files passed, including the first-run marker check; retired provider tests were removed with their implementations.

**Done when:** both RSS choices and the wallpaper path work in real target browsers, with tested versions and limitations documented. An untested browser is not automatically a failed browser.

## Release decision

The first limited test copy includes the code license, asset notices and a tester guide. Before a public release, finish font/theme synchronization, verify both RSS modes and the wallpaper path, then complete the browser matrix. Update this file as test results become concrete.
