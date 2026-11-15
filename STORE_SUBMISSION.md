# Chrome Web Store submission draft

**Prepared:** 14 November 2026

**Candidate:** 0.1.2 test build. Owner-approved copy; verify against the final tagged ZIP before entering these fields.

## Listing

- **Name:** Omarchy Start
- **Category:** Productivity
- **Language:** English
- **Homepage:** https://github.com/tumbleweedlabs/omarchy-start
- **Support:** https://github.com/tumbleweedlabs/omarchy-start/issues
- **Privacy policy:** https://github.com/tumbleweedlabs/omarchy-start/blob/main/PRIVACY.md

**Detailed description:**

> Omarchy Start turns a new tab into a calm dashboard with a clock, calendar, weather, search, quick links, and optional RSS news.
>
> Search with your browser's default engine, or choose Omarchy Plugins, GitHub, images, video, and other scopes. Keep favorite links close and find them by name from the search box. Adjust the layout, colors, and motion in Settings.
>
> On Omarchy, you can connect the current desktop wallpaper and theme colors. This requires choosing the Omarchy state folder and allowing local file access in your browser. If you skip that step, the page uses a solid-color background. Omarchy news is enabled initially; you can turn it off or choose your own HTTPS RSS or Atom feed. Search predictions and automatic device location are optional.
>
> Settings and cached content stay in your browser profile. No account, analytics, or developer-operated sync service is required. This independent project is not affiliated with or endorsed by Omarchy.

**Single purpose for Privacy practices:** Replace the browser's new-tab page with an Omarchy-inspired dashboard that combines at-a-glance information, search, links, and optional desktop wallpaper and RSS integration.

## Permission explanations

| Manifest entry | Purpose and scope |
| --- | --- |
| `storage` | Save dashboard settings, links, uploaded icons, fetched results, and first-run state in the browser profile. |
| `search` | Send submitted Web searches to the browser's configured default search engine. Other search scopes are selected by the user. |
| `favicon` | Show browser-provided site icons for quick links when a custom or bundled icon is not selected. |
| `geolocation` | Support the optional automatic-location setting for weather and the local clock. Chrome does not allow this manifest permission to be optional; the feature remains off until the user enables it and the browser grants location access. |
| `https://omarchy.org/*` | Fetch the default Omarchy RSS news feed. RSS can be turned off. |
| Six named optional search-prediction hosts | Request access only to the selected provider when the user enables predictions. Send typed search text to that provider. |
| `https://*/*` (optional) | Permit a user-selected HTTPS RSS/Atom host that cannot be known when the package is built. The extension requests access to the selected feed's host at runtime and fetches only that feed. |
| `file:///*` (optional) | Read the Omarchy current wallpaper and theme color file after the user connects the folder and allows file URLs. Chromium's grant is broad, though the implemented reads target Omarchy state. |

The `https://*/*` and `file:///*` declarations need particular review because their potential scope is broader than the normal requests. There are no content scripts, tab-history reads, or remote executable scripts in the 0.1.2 package.

## Assets and submission gates

- [x] 128 × 128 PNG store icon exists at `extension/assets/icons/omarchy-start-128.png`.
- [x] ~~Prepare listing screenshots from the owner's actual dashboard and Settings captures.~~ 14 Nov 2026: The owner approved exact pixel crop/resize. Two 1280 × 800 PNGs are in [`store-assets/`](store-assets/README.md), made from the actual 1657 × 1088 dashboard and 1656 × 1087 Settings captures. Both were visually inspected for private data; they show public Omarchy content and the owner's accepted Settings appearance. Originals are untouched.
- [x] ~~Confirm the owner-approved privacy policy URL is reachable without sign-in.~~ 14 Nov 2026: An unauthenticated HTTP request returned 200 and the page rendered the policy title.
- [x] ~~Choose the developer account and a suitable email.~~ 14 Nov 2026: Owner reports the account is set up with a good email. Confirm the dashboard's verification and 2-Step Verification indicators before submission.
- [ ] Finish the [browser check](BROWSER_TEST_CHECKLIST.md) and permission checks in `RELEASE_READINESS.md`, then tag and rebuild the release candidate.
- [ ] Upload the ZIP and fill the Privacy practices and distribution fields. Start with unlisted visibility for a limited tester group.
