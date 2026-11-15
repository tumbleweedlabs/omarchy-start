# Omarchy Start — product and implementation specification

**Status:** Current 0.1.4 implementation and public submission plan · 15 November 2026
**Product name:** Omarchy Start
**Purpose:** Describe the shipped behavior, known limits and future work.

## 1. The outcome

A beautiful, fast, open-source Chrome extension for new tabs, designed to work across Chromium-based browsers that feels at home on Omarchy while remaining useful on other desktops. Opening a tab reveals an immediately legible date, clock and weather, search, and the user's most useful links. It adopts the active Omarchy palette and can show its wallpaper through user-authorized browser file access. It remains functional with a theme-colored background when that access is unavailable or switched off.

The product emphasizes fast startup, useful keyboard interactions, local preferences and Omarchy's flat visual language. First-party code is MIT-licensed. It is designed by Tumbleweed Labs and is independent of Omarchy.

## 2. Current implementation

`extension/` is a Chromium Manifest V3 extension written as JavaScript modules with no application build step. `newtab.html` composes the page; `src/main.js` initializes modules; `background/sw.js` opens the page from the toolbar or shortcut and clears retired provider caches on upgrade; `src/store.js` and `src/storage.js` maintain local settings and migration; `styles/app.css` defines the visual system. Automated checks live in `tools/`.

The existing experience includes:

- A mini month calendar, local and three configurable world clocks, and Open-Meteo weather, hourly forecast, sunrise/sunset and estimated AQI. Device location is opt-in, with cached and manual fallbacks.
- Search through the browser's default engine, Omarchy Plugins, GitHub and other scopes; keyboard shortcuts, optional predictions, direct URL handling and type-to-find for quick links.
- Editable, reorderable quick links with suggested brand icons, favicons or uploaded icons; keyboard controls; contextual menus; and local backup/restore.
- An optional Omarchy desktop wallpaper, cached at its original resolution for fast subsequent tabs; a theme-colored background when wallpaper is off.
- Optional three-card RSS news, with Omarchy as the default or a user-specified HTTPS RSS/Atom feed and a two-hour refresh window.
- Light/dark/automatic appearance, density, surface transparency, background dimming and optional slow wallpaper zoom; cross-tab changes; locally stored settings; accessibility and keyboard interactions. Browser-controlled address-bar focus on a normal new tab remains a known limitation.

The [README](README.md) describes installation and use. The first-party code uses the [MIT License](LICENSE); third-party assets retain separate terms in the packaged notices.

## 3. Product scope

### Dashboard and interaction

- Keep date/calendar, clock and weather at the top, configurable individually. Calendar is a date/month view with an optional user-selected calendar URL; no account access or event integration is implied. Keep local and world clocks, units, manual location, optional device location and meaningful stale/offline states.
- Keep browser-default web search, direct URLs, optional predictions and keyboard access. **Omarchy Plugins** opens the [Omarchy Plugin Marketplace](https://plugins.omarchy.org/) with its own filtered results anchored to the catalog; **GitHub** searches repositories. Both appear in the search picker, support keyboard selection and encoded queries, and honor the open-in-new-tab preference. Predictions stay off by default and disclose the provider and what is sent. Preserve the distinction between page focus and browser address-bar focus.
- Keep user-managed quick links: add, edit, remove, reorder by keyboard and pointer, select icons, and open in a new tab. Review the current 12-link limit after layout testing. Provide a useful empty state.
- **Current product decision (13 November 2026):** remove the experimental link-group cards. Keep the compact quick-access links and their type-to-find suggestions. Preserve previously saved group data in storage and exports to avoid silent data loss, but do not render or load the group UI.
- Searching for a quick-access link shows its configured name and icon as a local suggestion. Match names and useful URL text, rank exact/prefix matches, support arrow keys and Enter, and update after edits. Enter with no selected suggestion performs the chosen search normally.
- Keep the new-tab page within the viewport without page scrolling. Condense spacing and cards when height is limited; settings and menus may scroll within their own surfaces.
- On the first new tab after installation or the one-time introduction of the tour to an existing profile, show a short guide anchored to the glance widgets, search, quick links and Settings gear. It ends by opening Settings at Background for the username-first Omarchy connection, including when skipped on first run. Later updates do not repeat it; offer Replay tour in Settings. The tour changes no user settings or permissions.
- Settings, backup/restore, reduced motion, focus visibility, responsive layouts and sensible contrast are first-class.

### Visual direction

Use Omarchy’s flat aesthetic: its current palette, crisp edges, restrained borders and accent color; let the wallpaper breathe when enabled. The current CSS uses generic `monospace`; fontconfig resolves it to the selected Omarchy font on the development machine, though browser rendering has not been verified in this check. The extension does not explicitly read the selected font or guarantee that a font change updates existing tabs across browsers. Maintain hierarchy and legibility on bright, dark and busy wallpapers with configurable dimming and palette-derived surfaces. Offer compact and spacious layouts; respect reduced-motion settings. Design should feel intentional on ultrawide and laptop screens and still work at narrow sizes and browser zoom. Validate with actual screenshots and keyboard use, not just a palette mapping.

Credit Tumbleweed Labs as the designer and link to the source repository in Settings. Omarchy is a separate project; do not imply affiliation or endorsement. A non-Omarchy user gets a default palette plus manual light/dark selection.

## 4. Background behavior

**Show Omarchy wallpaper** is the only image setting. It is enabled by default. When disabled, show a solid color from the selected Omarchy palette, or the extension's light/dark palette if no desktop palette is available. When enabled, use the user-authorized current desktop wallpaper and retain the original image bytes in a local cache for early paint in new tabs. Check for changes on opening or refocusing a tab; use a directory watcher where the browser supports it. Keep optional slow wallpaper zoom and respect reduced motion. The current animation scales from 1 to 1.045 over 50 seconds with ease-out; tune by visual review. Remote image providers and their image-specific controls are outside the release scope.

## 5. Icons

The current link editor offers a curated set of bundled Font Awesome Free Brands marks, generic Phosphor symbols, browser-provided site favicons, user-uploaded icons and a monogram fallback. The default Omarchy link uses its theme-colored mark. User uploads are stored locally and included in settings export. Third-party licenses and attribution are included in the package. There is no global icon-pack selector or on-demand pack download in 0.1.4.

Future icon choices may include [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md), [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) or an [Iconify API](https://iconify.design/docs/api/) catalog. Any added marks need individual rights review, a durable source, offline behavior and clear attribution. [Phosphor](https://github.com/phosphor-icons/core) already supplies generic bundled symbols.

## 6. Omarchy synchronization

The user enters a Linux username to connect Omarchy. The extension then requests Chromium file access and reads `~/.local/state/omarchy/current/theme/colors.toml` and `~/.local/state/omarchy/current/background`. If a read fails and the browser supports folder selection, Settings offers a folder picker as recovery. These paths are observations of the current installation and may differ on other Omarchy versions. The browser's file grant is broad, but the implemented reads target these files.

New tabs and tabs returning to focus recheck the palette and wallpaper. On browsers that support it, a `FileSystemObserver` also watches the selected Omarchy folder when the user has connected through the folder picker. Username-only connection does not establish that watcher. A solid palette color is the background fallback when wallpaper access is unavailable. Generic CSS `monospace` may resolve to the selected system font through fontconfig; explicit font synchronization and cross-browser font-change behavior remain future work.

### Extension language and Quickshell

Keep the browser extension in HTML, CSS and modern JavaScript ES modules. That is Chromium’s native extension platform. Adopt TypeScript or a framework only if growing complexity demonstrates a concrete benefit; neither is required for performance or Omarchy compatibility. Refactor modules and tests around providers and reusable data models as needed.

QML and Qt Quick run in Quickshell/Qt, not in a Chromium extension page; rewriting the start page in QML would create a separate desktop application rather than a portable new-tab extension. A Quickshell plugin could optionally serve desktop-side integration or offer a companion experience for a separate desktop experience, but the extension itself does not require Quickshell.

## 7. Omarchy news

**Enable RSS** is on initially, with **Omarchy news** as the source. Users may turn it off or choose **User specified** with an HTTPS RSS or Atom URL. At most three cards show headline, opening body text, date and direct story link. The heading and “All news” link follow the chosen source. Omarchy feed access is bundled at installation; a custom host is requested at runtime. A bounded, per-feed last-successful-result cache refreshes every two hours. No news request or module load happens while disabled. Cards render remote text as text and accept only validated HTTPS links; the official feed additionally restricts links to `omarchy.org/news/`.

## 8. Privacy, accessibility and reliability

- Local settings, links, uploads, wallpaper cache and desktop data stay on the device by default. Export/import includes explicit user settings and uploaded icons; cache and device location are excluded by default and described clearly. Validate imported data and preserve existing settings on failure.
- Request the least browser permissions practical. Omarchy RSS is enabled by default and has a required site permission; custom RSS and predictions use runtime permissions for the selected hosts. Device location remains opt-in. Weather and geocoding send location to their providers; document data flows and retention. No analytics or account required.
- Render remote data defensively; enforce CSP, HTTPS and resource limits. Keep extension code packaged rather than downloading executable code. Document each provider's license and update policy.
- Meet WCAG 2.2 AA where applicable: keyboard operation, labels, visible focus, contrast, no color-only state and reduced motion. Settings and dialogs must work without a mouse.
- Show the last usable data or an honest unavailable state on offline, revoked permission, corrupt cache, quota exhaustion and network timeout. Multiple tabs must agree on settings and pins without lost updates. Clear-cache and reset actions explain what they remove.

## 9. Delivery and acceptance

**Browser target:** a Chrome extension built on Chromium Manifest V3, intended for Chromium-based browsers. Establish a named release test matrix covering Chrome, Chromium, Edge, Brave and the Omarchy default browser where distinct and available; document versions tested and browser-specific differences. Other Chromium derivatives are intended to work but cannot be guaranteed without testing. Verify new-tab overrides, `chrome.search`, favicon handling, optional permissions separately in each tested browser; provide graceful alternatives when an API or browser policy differs. Firefox is outside this initial target.

**Current release scope:** The 0.1.4 package contains the dashboard, search, quick links, local settings and backup, optional news, Omarchy palette and wallpaper connection, keyboard controls, bundled and user-selected icons, privacy policy and third-party notices. It is the candidate for a public Chrome Web Store listing. The owner reports completing browser checks; versions and individual results have not been recorded in this repository.

Acceptance for public submission:

- A clean installation opens a usable new tab without an account, helper or location permission. Search scopes, quick links, weather and clocks work without Omarchy file access.
- Optional permissions are explained at the point of use. A denied or revoked permission leaves the page usable; the connection flow explains recovery.
- Wallpaper and palette connection work through the username-first flow on the tested browser. Folder selection is available as recovery where supported. Disabling wallpaper produces a solid background.
- The layout stays within the page viewport at the reviewed sizes and zoom settings; keyboard access and reduced-motion behavior are checked in a real browser.
- The submitted ZIP has a root manifest, matches the tested source version and includes the license and third-party notices. Store description, permission explanations and privacy policy match the package.

## 10. Future work and verification

- Verify whether generic CSS `monospace` follows later Omarchy font changes in each browser; consider explicit synchronization only if a supported browser integration is needed.
- Record tested browser versions and browser-specific behavior for Chrome, Chromium, Brave, Edge and the Omarchy default browser when available. Confirm permission recovery, multiple-tab refresh, symlink replacement and browser restart behavior.
- Continue visual and accessibility review at small heights, narrow widths, high zoom and contrasting wallpapers. Track any remaining WCAG 2.2 AA gaps with reproducible evidence.
- Consider further icon choices only after rights, package size and offline behavior are reviewed. Add other distribution channels when their packaging and support path are defined.
