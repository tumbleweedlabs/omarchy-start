# Omarchy Start privacy policy

**Last updated:** 14 November 2026
**Applies to:** Omarchy Start 0.1.2 test build

Omarchy Start replaces the browser's new-tab page with a dashboard. It has no account, advertising, analytics, or developer-operated data collection endpoint. Settings, quick links, uploaded icons, feed stories, weather results, and a cached wallpaper are stored in the browser profile on your device. The developer does not receive those records through the extension.

## Data used by the dashboard

- **Weather and places.** The extension sends the selected place's latitude and longitude to Open-Meteo for weather, air quality, and time-zone data. Searching for a place sends the text you type to Open-Meteo's geocoding service. The default place is Seattle until you change it. If you turn on automatic device location, the browser asks for location access; the extension rounds coordinates to three decimal places and sends them to Open-Meteo for a time zone and to BigDataCloud for a place name. The latest approximate location and its update time are stored locally. You can turn automatic location off and use a manually selected place.
- **RSS news.** Omarchy news is on by default, so the extension requests the feed from `omarchy.org`. If you choose a different HTTPS RSS or Atom feed, the extension asks for access to that feed's host and requests only the selected feed. Recent stories from successful requests are stored locally for offline display. Opening a story or the feed's website visits that destination in your browser.
- **Search.** A search you submit goes to your browser's chosen search engine by default, or to the specific search site you select. Search predictions are off by default. If you enable them and grant access to a provider, partial search text is sent to that provider as you type. The Internet Archive search feature sends the URL you enter to the Internet Archive Availability API. Omarchy Start does not send search queries to the developer.
- **Quick links and icons.** Link names and addresses and uploaded icons are stored locally. For website icons, the extension uses the browser's favicon service; the browser may retrieve icons according to its own settings and policies. Opening a link visits its destination.
- **Omarchy wallpaper and theme.** If you connect Omarchy and grant file access, the extension reads the current wallpaper and theme colors from Omarchy's local state. The original wallpaper image is cached in the browser profile for quicker new tabs. The selected folder handle and home path are stored locally. The wallpaper and local file contents are not uploaded by the extension. Chromium's file-URL permission covers more than the Omarchy files that this extension's code reads. You can deny that access and use a solid-color background.

These network requests expose your IP address and ordinary request metadata to the service you choose or use. Those services process requests under their own privacy policies: [Open-Meteo](https://open-meteo.com/en/terms), [BigDataCloud](https://www.bigdatacloud.com/privacy), [Omarchy](https://omarchy.org/), your selected RSS host, search provider, link destination, and [Internet Archive](https://archive.org/about/terms.php). Omarchy Start does not control their retention practices.

## Storage and control

Preferences and cached results remain in your browser profile until you change or clear them, remove the extension, or clear browser data. Weather and location results are refreshed periodically; RSS stories refresh after two hours. You can turn off RSS, weather, automatic location, predictions, and the wallpaper in Settings. The Settings export contains settings, quick links, uploaded icons, and legacy link groups; it does not include the cached wallpaper or device-location fix. Handle exported files according to their contents. Removing the extension or clearing its site data removes its local records subject to your browser's behavior.

Omarchy Start uses the information it accesses only to provide the new-tab features described here. It does not sell user data, use it for advertising or credit decisions, or make it available to the developer for human review. Information received from Google APIs is used in accordance with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including its Limited Use requirements.

For general support, use the [project's GitHub issues](https://github.com/tumbleweedlabs/omarchy-start/issues). Do not post private feed URLs, coordinates, or wallpaper files in a public issue. The Chrome Web Store listing also displays the developer's verified contact email to extension users.
