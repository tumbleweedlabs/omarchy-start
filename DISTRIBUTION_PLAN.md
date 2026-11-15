# Omarchy Start distribution plan

**Status:** Chrome Web Store preparation, 14 November 2026. The public source repository is live at https://github.com/tumbleweedlabs/omarchy-start; no store item has been published. The owner approved the [privacy policy](PRIVACY.md) and [submission copy](STORE_SUBMISSION.md).

## Recommended route

Publish the browser extension in the Chrome Web Store. Keep the source in a separate public GitHub repository, but use the store for normal installation and browser-managed updates. This avoids an Omarchy core PR, a Quickshell wrapper, a user-level browser-flags installer, and an Omarchy `post-update` hook. Users install the extension in their browser; we upload each new version to the store and it reaches users after review and the browser's update check. A GitHub push alone does not publish a browser update.

The current Omarchy Plugin Marketplace accepts Quickshell plugins, not standalone Chromium extensions. We can link to the store from our repository and other documentation, but should not submit this browser-only project to that marketplace under a fake shell-plugin manifest.

## Work before submission

1. **Prepare the public source.** Keep `extension/` as the runtime and retain the MIT license and third-party asset notices. Audit image/icon/font rights, Omarchy branding, permissions, and privacy claims. Keep generated `dist/` packages out of Git, publish reviewed source under the `tumbleweedlabs/omarchy-start` repository, and tag each store release.

2. **Make a store-ready package.** Package only the extension runtime, license, notices, and required assets. Confirm the Manifest V3 ZIP loads cleanly, has no remote executable code, and matches the tagged source. Bump the manifest version for each upload. Prepare listing icon, screenshots, description, support contact, and a public privacy policy describing local wallpaper reads, weather/location, RSS, search suggestions, and any outside requests.

3. **Review the product against store policy.** Document the single purpose as an Omarchy-oriented new-tab page. Justify each requested permission and narrow any unnecessary host access. Verify that default web search respects the browser's chosen engine and that alternate search scopes are clearly user-selected. The broad optional `https://*/*` RSS permission and `file:///*` wallpaper permission deserve explicit review and clear user-facing explanation; approval is not guaranteed simply because the extension works when side-loaded.

4. **Preserve the wallpaper experience honestly.** A store install cannot silently discover `$HOME` or grant local-file access. The user enters a Linux username and enables Chromium **Allow access to file URLs**; folder selection appears as a recovery option when a wallpaper read fails and the browser supports it. A native-messaging host would require a separate OS-side installation, defeating the simple one-install store route; do not make it a prerequisite for the first store version. Without local access, the theme-color background is the fallback.

5. **Test the release candidate.** Verify fresh store-style installation in Chrome and Omarchy's default Chromium, plus Brave and Edge before claiming support. Test new-tab replacement, first-run tour, Alt+T (including shortcut conflicts), wallpaper/theme connection, RSS permissions, search, cache, update, and removal. A store-installed extension has a different ID from the side-loaded test copy, so settings and permissions should not be assumed to migrate automatically; document export/import or provide a tested migration path.

6. **Publish in stages.** Register a Chrome Web Store developer account (one-time fee), upload the ZIP, complete privacy and listing fields, and submit for review. Use **unlisted** visibility for a small tester group, then switch to **public** once verified. Unlisted items undergo the same policy review as public items. Subsequent versions are uploaded and reviewed before Chrome's normal extension-update mechanism delivers them. Browser-specific compatibility and update behavior outside Chrome still need real testing.

## Current preparation

- 14 Nov 2026: Rechecked the 0.1.2 package structure and manifest. The runtime ZIP contains a root-level manifest and a 128 × 128 PNG icon. Its source and build process are in this repository.
- 14 Nov 2026: Drafted the privacy policy and listing/permission text from the current implementation. The owner approved the documents and reported that the developer account is set up with a suitable contact email. Final package and live browser checks remain before submission.
- 14 Nov 2026: Published the approved policy, listing copy, and two screenshot assets to the public repository. The privacy policy page returned HTTP 200 without a signed-in session.
- 14 Nov 2026: Confirmed from Chrome's current documentation that a 128 × 128 store icon and at least one 1280 × 800 screenshot are required. The icon exists; two owner-approved, exact crop/resize listing screenshots are in [`store-assets/`](store-assets/README.md). Chrome documents `https://*/*` as the pattern for a host chosen at runtime, and says `geolocation` cannot be an optional manifest permission. Broad permission scope still requires review.
- Browser Use refused the installed `chrome-extension://` page because its URL policy allows only HTTP(S), and explicitly forbade using another computer or browser surface to reach it. This is a tool access limit, not an extension test result. Obtain live interaction evidence from the owner or after a policy change outside this task; do not mark those checks complete from source inspection.

## Decisions to settle

1. The public source repository is `tumbleweedlabs/omarchy-start`.
2. Confirm the developer dashboard shows the owner's account email as verified and 2-Step Verification enabled before submission.
3. Are we comfortable keeping the current one-time wallpaper permission flow for the first store release, with the theme-color fallback if a user declines?

## Sources checked

- [Chrome Web Store developer registration](https://developer.chrome.com/docs/webstore/register/)
- [Chrome Web Store visibility and review](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Chrome extension update lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle)
- [Chrome Web Store privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Chrome guidance on local-file access](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome Web Store single-purpose troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting/)
