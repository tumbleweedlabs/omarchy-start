# Chrome Web Store submission

**Updated:** 15 November 2026

**Candidate:** 0.1.4 package for public submission. Verify these fields against the ZIP uploaded to the developer dashboard.

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
> On Omarchy, you can connect the current desktop wallpaper and theme colors by entering your Linux username and allowing local file access in your browser. If you skip that step, the page uses a solid-color background. Omarchy news is enabled initially; you can turn it off or choose your own HTTPS RSS or Atom feed. Search predictions and automatic device location are optional.
>
> Settings and cached content stay in your browser profile. No account, analytics, or developer-operated sync service is required. Designed by Tumbleweed Labs, this independent project is not affiliated with or endorsed by Omarchy.

**Single purpose for Privacy practices:** Omarchy Start turns the browser's new-tab page into a dashboard with clocks, weather, search, quick links, news feeds, and optional Omarchy wallpaper and theme colors.

## Privacy practices: permission justifications

| Manifest entry | Justification |
| --- | --- |
| `favicon` | Quick links can display the destination site's browser-provided icon so saved links are easier to recognize. Users can also choose a bundled icon or upload their own. |
| `geolocation` | When a user enables automatic location, Omarchy Start uses the browser's location result for nearby weather and the local time zone. Users can enter a location manually. |
| `search` | A submitted Web search goes to the browser's configured default search engine. The user can choose other search destinations in the search picker. |
| `storage` | Dashboard preferences, quick links, uploaded icons, recent results, and first-run state are saved in the user's browser profile so their choices persist. |
| Host permissions | Omarchy Start fetches the default Omarchy news feed. For a custom HTTPS RSS or Atom feed, it requests access to the selected feed's host before fetching it. If search predictions are enabled, it requests access to the chosen provider and sends typed search text there. Connecting Omarchy requests local file access to read the current wallpaper and theme colors. The extension does not inject scripts into visited pages. |

The required `https://omarchy.org/*` permission supports the default news feed. The six named optional hosts support predictions only for the selected provider. The optional `https://*/*` declaration accommodates a user-selected feed host that cannot be known when the extension is packaged; the runtime request is for that host. Chromium's `file:///*` grant is broad, while the extension's implemented reads target Omarchy's current wallpaper and theme-color files. There are no content scripts, tab-history reads, or remote executable scripts in the 0.1.4 package. The geolocation manifest permission is present, but automatic location remains off until the user enables it and grants browser access.

## Assets and submission gates

- [x] 128 × 128 PNG store icon exists at `extension/assets/icons/omarchy-start-128.png`.
- [x] Listing screenshots from the owner's actual dashboard and Settings captures were prepared by exact pixel crop/resize. Two 1280 × 800 PNGs are in [`store-assets/`](store-assets/README.md). Originals were not changed.
- [x] The owner-approved privacy policy URL returned 200 without sign-in on 14 November 2026.
- [x] The owner reports the developer account is set up with a suitable email.
- [x] The owner confirmed the new Settings credit works and looks good, and reports completing browser checks. Browser versions and individual outcomes are not recorded here.
- [x] The owner confirms the uploaded ZIP is the 0.1.4 candidate they tested.
- [x] The owner confirms the developer dashboard shows a verified contact email and 2-Step Verification, and the package and permission explanations were reviewed in the final submission form.
- [x] The owner confirms the ZIP was uploaded, the Privacy practices text was entered, and public visibility was selected for the initial listing.
