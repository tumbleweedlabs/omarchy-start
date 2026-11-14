# Omarchy start page — outcome and implementation specification

**Status:** Draft for review · 14 November 2026
**Working name:** Omarchy Start (name and branding subject to review)
**Purpose:** Define the product, current implementation and release criteria.

## 1. The outcome

A beautiful, fast, open-source Chrome extension for new tabs, designed to work across Chromium-based browsers that feels at home on Omarchy while remaining useful on other desktops. Opening a tab reveals an immediately legible date, clock and weather, search, and the user's most useful links. It adopts the active Omarchy palette and can show its wallpaper through user-authorized browser file access. It remains functional with a theme-colored background when that access is unavailable or switched off.

The product emphasizes fast startup, useful keyboard interactions, local preferences and Omarchy's flat visual language. First-party code is MIT-licensed; final branding remains a review decision.

## 2. Current implementation

`extension/` is a Chromium Manifest V3 extension written as JavaScript modules with no application build step. `newtab.html` composes the page; `src/main.js` initializes modules; `background/sw.js` opens the page from the toolbar or shortcut and clears retired provider caches on upgrade; `src/store.js` and `src/storage.js` maintain local settings and migration; `styles/app.css` defines the visual system. Automated checks live in `tools/`.

The existing experience includes:

- A mini month calendar, local and three configurable world clocks, and Open-Meteo weather, hourly forecast, sunrise/sunset and estimated AQI. Device location is opt-in, with cached and manual fallbacks.
- Search through the browser's default engine, Omarchy Plugins, GitHub and other scopes; keyboard shortcuts, optional predictions, direct URL handling and type-to-find for quick links.
- Editable, reorderable quick links with suggested brand icons, favicons or uploaded icons; keyboard controls; contextual menus; and local backup/restore.
- An optional Omarchy desktop wallpaper, cached at its original resolution for fast subsequent tabs; a theme-colored background when wallpaper is off.
- Optional three-card RSS news, with Omarchy as the default or a user-specified HTTPS RSS/Atom feed and a two-hour refresh window.
- Light/dark/automatic appearance, density, blur and dim controls; cross-tab changes; locally stored settings; accessibility and keyboard interactions. Browser-controlled address-bar focus on a normal new tab remains a known limitation.

The [README](README.md) describes the running prototype; the [release-readiness tracker](RELEASE_READINESS.md) records remaining verification. The first-party code uses the [MIT License](LICENSE); third-party assets retain separate terms in the packaged notices.

## 3. Product scope

### Dashboard and interaction

- Keep date/calendar, clock and weather at the top, configurable individually. Calendar is a date/month view with an optional user-selected calendar URL; no account access or event integration is implied. Keep local and world clocks, units, manual location, optional device location and meaningful stale/offline states.
- Keep browser-default web search, direct URLs, optional predictions and keyboard access. **Omarchy Plugins** opens the [Omarchy Plugin Marketplace](https://plugins.omarchy.org/) with its own filtered results anchored to the catalog; **GitHub** searches repositories. Both appear in the search picker, support keyboard selection and encoded queries, and honor the open-in-new-tab preference. Predictions stay off by default and disclose the provider and what is sent. Preserve the distinction between page focus and browser address-bar focus.
- Keep user-managed quick links: add, edit, remove, reorder by keyboard and pointer, select icons, and open in a new tab. Review the current 12-link limit after layout testing. Provide a useful empty state.
- **Current product decision (13 November 2026):** remove the experimental link-group cards. Keep the compact quick-access links and their type-to-find suggestions. Preserve previously saved group data in storage and exports to avoid silent data loss, but do not render or load the group UI.
- Searching for a quick-access link shows its configured name and icon as a local suggestion. Match names and useful URL text, rank exact/prefix matches, support arrow keys and Enter, and update after edits. Enter with no selected suggestion performs the chosen search normally.
- Keep the new-tab page within the viewport without page scrolling. Condense spacing and cards when height is limited; settings and menus may scroll within their own surfaces.
- On the first new tab after installation or the one-time introduction of the tour to an existing profile, show a short guide anchored to the glance widgets, search, quick links and Settings gear. It ends by opening Settings at Background for Omarchy folder connection, including when skipped on first run. Later updates do not repeat it; offer Replay tour in Settings. The tour changes no user settings or permissions.
- Settings, backup/restore, reduced motion, focus visibility, responsive layouts and sensible contrast are first-class.

### Visual direction

Use Omarchy’s flat aesthetic: its current palette, crisp edges, restrained borders and accent color; let the wallpaper breathe when enabled. Match the selected Omarchy system monospace font with sensible fallbacks and test actual rendering, including font changes. The installed `omarchy-font-current` resolves the selected monospace family via fontconfig; test whether CSS `monospace` follows it across target browsers. Maintain hierarchy and legibility on bright, dark and busy wallpapers with a configurable scrim and palette-derived surfaces. Offer compact and spacious layouts; respect reduced-motion settings. Design should feel intentional on ultrawide and laptop screens and still work at narrow sizes and browser zoom. Validate with actual screenshots and keyboard use, not just a palette mapping.

Use neutral product branding until permission for any official Omarchy name/logo use is established; do not imply endorsement. A non-Omarchy user gets a curated default palette plus manual light/dark selection.

## 4. Background behavior

**Show Omarchy wallpaper** is the only image setting. It is enabled by default. When disabled, show a solid color from the selected Omarchy palette, or the extension's light/dark palette if no desktop palette is available. When enabled, use the user-authorized current desktop wallpaper and retain the original image bytes in a local cache for early paint in new tabs. Check for changes on opening or refocusing a tab; use a directory watcher where the browser supports it. Keep optional slow wallpaper zoom and respect reduced motion. The current animation scales from 1 to 1.045 over 50 seconds with ease-out; tune by visual review. Remote image providers and their image-specific controls are outside the release scope.

## 5. Icons: packs, selection and storage

Offer a global preferred icon style plus an explicit per-link override. Suggested starting choices:

1. **Simple Icons:** monochrome brand marks that can follow the palette; broad website coverage. Its collection is CC0, but individual mark licenses and trademark rules still require review. [Disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md).
2. **Font Awesome Free Brands:** familiar monochrome alternative; a curated subset is bundled under CC BY 4.0. Include required attribution and verify each release's current terms.
3. **Dashboard Icons:** colorful service/self-hosted marks and some light/dark variants; an alternative visual style, not guaranteed coverage for every brand. The repository has an Apache-2.0 license, but assess individual artwork and trademarks before redistribution. [Project](https://github.com/homarr-labs/dashboard-icons).
4. **Phosphor:** coherent generic symbols in multiple weights, useful when a site has no brand mark. The extension includes MIT-licensed Phosphor icons. [Project](https://github.com/phosphor-icons/core).

**Recommendation:** bundle a version-pinned, reviewed subset of commonly used icons and an offline-searchable index in the extension, with full notices. Offer additional reviewed, version-pinned pack assets on demand only if rights and a durable hosting source are confirmed; cache selected icons locally, not by re-fetching on every tab. Iconify's hosted or self-hosted API is a possible transport and catalog, but each set retains its own license; using its API does not clear the underlying artwork. [Iconify API](https://iconify.design/docs/api/).

A link editor searches by name and suggests based on an explicit domain-to-icon map, with preview and choice of pack, website favicon, upload or monogram. Never infer arbitrary icon URLs from a user's private URL and send them to a third party without explaining it. Pack download and favicon lookups must be opt-in or clearly disclosed; display works offline after selection. Sanitize or rasterize untrusted uploads and remote SVGs, enforce byte/dimension limits, and never execute SVG scripts or external references. Store pack ID, version, icon ID, license/credit metadata and locally cached asset; distinguish evictable pack cache from user uploads that must survive eviction and export. Pack updates must not silently override explicit choices.

## 6. Omarchy synchronization

The extension reads the current palette and wallpaper through user-authorized Chromium file access. The installed machine exposes `~/.local/state/omarchy/current/theme/colors.toml`, `theme.name` and a `current/background` symlink. These paths are observations of the current installation and still need compatibility testing on supported Omarchy versions. File access should remain limited in code to the current theme and wallpaper, with clear errors when permissions are missing or files change during a read.

On supported browsers, a `FileSystemObserver` watches the selected Omarchy folder. New tabs and tabs returning to focus also recheck the palette and wallpaper. Test symlink replacement, browser restart, permission revocation, independent wallpaper changes and theme changes across open tabs. The selected system font remains unresolved and is tracked separately. A solid palette color is the background fallback when wallpaper access is unavailable.

### Extension language and Quickshell

Keep the browser extension in HTML, CSS and modern JavaScript ES modules. That is Chromium’s native extension platform. Adopt TypeScript or a framework only if growing complexity demonstrates a concrete benefit; neither is required for performance or Omarchy compatibility. Refactor modules and tests around providers and reusable data models as needed.

QML and Qt Quick run in Quickshell/Qt, not in a Chromium extension page; rewriting the start page in QML would create a separate desktop application rather than a portable new-tab extension. A Quickshell plugin could optionally serve desktop-side integration or offer a companion experience for a separate desktop experience, but the extension itself does not require Quickshell.

## 7. Omarchy news

**Enable RSS** is on initially, with **Omarchy news** as the source. Users may turn it off or choose **User specified** with an HTTPS RSS or Atom URL. At most three cards show headline, opening body text, date and direct story link. The heading and “All news” link follow the chosen source. Omarchy feed access is bundled at installation; a custom host is requested at runtime. A bounded, per-feed last-successful-result cache refreshes every two hours. No news request or module load happens while disabled. Cards render remote text as text and accept only validated HTTPS links; the official feed additionally restricts links to `omarchy.org/news/`. The user has verified Omarchy story click-through in the installed extension; custom feeds and the taller layout still need browser review.

## 8. Privacy, accessibility and reliability

- Local settings, links, uploads, wallpaper cache and desktop data stay on the device by default. Export/import includes explicit user settings and uploaded icons; cache and device location are excluded by default and described clearly. Validate imported data and preserve existing settings on failure.
- Request the least browser permissions practical. Omarchy RSS is enabled by default and has a required site permission; custom RSS, optional icon downloads and predictions use provider-specific disclosures and runtime permissions where supported. Device location remains opt-in. Weather and geocoding send location to their providers; document data flows and retention. No analytics or account required.
- Render remote data defensively; enforce CSP, HTTPS and resource limits. Keep extension code packaged rather than downloading executable code. Document each provider's license and update policy.
- Meet WCAG 2.2 AA where applicable: keyboard operation, labels, visible focus, contrast, no color-only state and reduced motion. Settings and dialogs must work without a mouse.
- Show the last usable data or an honest unavailable state on offline, revoked permission, corrupt cache, quota exhaustion and network timeout. Multiple tabs must agree on settings and pins without lost updates. Clear-cache and reset actions explain what they remove.

## 9. Delivery and acceptance

**Browser target:** a Chrome extension built on Chromium Manifest V3, intended for Chromium-based browsers. Establish a named release test matrix covering Chrome, Chromium, Edge, Brave and the Omarchy default browser where distinct and available; document versions tested and browser-specific differences. Other Chromium derivatives are intended to work but cannot be guaranteed without testing. Verify new-tab overrides, `chrome.search`, favicon handling, optional permissions separately in each tested browser; provide graceful alternatives when an API or browser policy differs. Firefox is outside this initial target.

**Phase 0 — rights and feasibility.** Audit bundled asset and branding rights; validate direct authorized file access on the Chromium-family targets, including font, live theme and wallpaper changes. No public release until these gates pass.

**Phase 1 — working baseline.** Set up the MV3 extension with dashboard, search and quick-link behaviors, local settings and backup, keyboard access and offline fallback. Define the contribution/release process; the code license is MIT.

**Phase 2 — visual identity.** Design responsive Omarchy layouts, a semantic palette system, curated icon packs and a link editor. Review actual layouts against contrasting wallpapers, theme colors and viewport sizes.

**Phase 3 — desktop integration.** Ship the validated least-invasive integration, with connection diagnostics. Test a live theme change and an independent wallpaper cycle with multiple open tabs and after browser restart. Provide a theme-colored fallback.

**Phase 4 — optional news and release.** Add news only after endpoint and policy validation; test permissions, privacy disclosures, packaging, installation and upgrade. Document provider dependencies, licensing and known limitations.

Acceptance for the first public release:

- A clean installation opens a usable new tab without an account, helper or location permission. Omarchy Plugins and GitHub are available as distinct search scopes; submitted queries reach the intended results, including special characters, and respect the new-tab setting.
- Date, clocks, weather, search and configurable links work; each optional feature can be disabled and handles offline or denied access without blocking the page. Backup restores links, choices and user assets as documented.
- The Omarchy wallpaper switch selects between the current desktop wallpaper and a theme-colored background. The cached original wallpaper appears promptly across restarts and multiple tabs.
- At least two reviewed icon styles plus favicon/upload fallback are selectable; selected icons remain visible offline; attribution and license notices are packaged.
- On a supported Omarchy system with the selected integration enabled, changing theme and font updates the page and cycling wallpaper updates the page without reinstalling; unavailable integration falls back clearly. Unsupported wallpaper formats fall back to the theme color.
- Keyboard-only use, reduced motion, no-scroll responsive layouts and contrast pass documented checks. Automated tests cover RSS parsing, settings migration/import, wallpaper caching and security validation; end-to-end checks cover installation and core behavior in the named Chromium-family test matrix, permissions, offline, multiple tabs and live desktop integration. Publish tested browser versions and any limitations.
- Reproducible package, open-source license, source and third-party notices are reviewed; no unresolved rights question or credential is included in the release.

## 10. Decisions for review

1. Does a direct, user-authorized browser approach reliably support live palette and wallpaper synchronization across the target browsers? Document any browser-specific limits.
2. Does the no-scroll layout remain usable at common laptop heights, narrow windows and browser zoom levels?
3. Does the wallpaper switch and theme-colored fallback work clearly across light and dark Omarchy palettes?
4. Is the bundled reviewed icon subset plus optional on-demand packs the right balance of offline reliability, package size and choice?
5. Does the custom RSS/Atom feed flow remain clear and reliable across target browsers?
6. Which distribution channels should be supported first, and are there Chromium-based browsers beyond the proposed test matrix that must be explicitly tested?
7. Is Omarchy Start the final product name for public release?
