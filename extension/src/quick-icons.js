const BRAND_DOMAIN_ICONS = Object.freeze({
  "google.com": "google",
  "drive.google.com": "google-drive",
  "youtube.com": "youtube",
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "amazon.com": "amazon",
  "aws.amazon.com": "aws",
  "reddit.com": "reddit",
  "linkedin.com": "linkedin",
  "github.com": "github",
  "x.com": "x",
  "twitter.com": "x",
  "tiktok.com": "tiktok",
  "pinterest.com": "pinterest",
  "whatsapp.com": "whatsapp",
  "discord.com": "discord",
  "slack.com": "slack",
  "zoom.us": "zoom",
  "outlook.com": "microsoft",
  "microsoft.com": "microsoft",
  "sharepoint.com": "microsoft",
  "spotify.com": "spotify",
  "soundcloud.com": "soundcloud",
  "twitch.tv": "twitch",
  "vimeo.com": "vimeo",
  "brave.com": "brave",
  "claude.ai": "claude",
  "notion.so": "notion",
  "evernote.com": "evernote",
  "obsidian.md": "obsidian",
  "figma.com": "figma",
  "trello.com": "trello",
  "jira.com": "jira",
  "confluence.atlassian.com": "confluence",
  "gitlab.com": "gitlab",
  "stackoverflow.com": "stackoverflow",
  "npmjs.com": "npm",
  "docker.com": "docker",
  "amazonaws.com": "aws",
  "ebay.com": "ebay",
  "etsy.com": "etsy",
  "paypal.com": "paypal",
  "venmo.com": "venmo",
  "airbnb.com": "airbnb",
  "usps.com": "usps",
  "fedex.com": "fedex",
  "ups.com": "ups",
  "python.org": "python",
  "telegram.org": "telegram",
  "signal.org": "signal",
  "news.ycombinator.com": "hackernews",
  "medium.com": "medium",
  "meetup.com": "meetup",
  "salesforce.com": "salesforce",
  "lyft.com": "lyft",
  "wikipedia.org": "wikipedia",
});

export function suggestedBrandIcon(url) {
  let host;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  let bestDomain = "";
  let bestIcon = null;
  for (const [domain, iconName] of Object.entries(BRAND_DOMAIN_ICONS)) {
    if ((host === domain || host.endsWith(`.${domain}`)) && domain.length > bestDomain.length) {
      bestDomain = domain;
      bestIcon = iconName;
    }
  }
  return bestIcon;
}

export const quickBrandNames = [...new Set(Object.values(BRAND_DOMAIN_ICONS))];
