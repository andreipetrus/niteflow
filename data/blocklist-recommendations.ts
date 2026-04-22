export type Blocklist = {
  name: string
  url: string
  license: string
  description: string
}

/**
 * Pi-hole-compatible blocklists grouped by IAB category. These are
 * suggestions the Recommendations panel shows when a category shows a
 * significant negative correlation with sleep. User installs them in
 * Pi-hole's Group Management → Adlists.
 */
export const BLOCKLISTS_BY_CATEGORY: Record<string, Blocklist[]> = {
  'Social Media': [
    {
      name: 'StevenBlack — Social Media',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social-only/hosts',
      license: 'MIT',
      description: 'Curated consolidated social media domains',
    },
    {
      name: 'Hagezi — Facebook (native)',
      url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.facebook.txt',
      license: 'GPL-3.0',
      description: 'Meta / Facebook service domains (blocks the app too)',
    },
    {
      name: 'Hagezi — Instagram (native)',
      url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.instagram.txt',
      license: 'GPL-3.0',
      description: 'Instagram service domains',
    },
    {
      name: 'Hagezi — TikTok (native)',
      url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.tiktok.txt',
      license: 'GPL-3.0',
      description: 'TikTok service domains',
    },
  ],
  Gambling: [
    {
      name: 'StevenBlack — Gambling',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts',
      license: 'MIT',
      description: 'Online betting, casino, and sportsbook domains',
    },
  ],
  'Adult Content': [
    {
      name: 'StevenBlack — Adult / NSFW',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts',
      license: 'MIT',
      description: 'Consolidated adult-content domain list',
    },
  ],
  'News and Politics': [
    {
      name: 'StevenBlack — Fake News',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-only/hosts',
      license: 'MIT',
      description: 'Known fake-news and sensationalist news sources',
    },
  ],
  'Video Gaming': [
    {
      name: 'Hagezi — Steam (native)',
      url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.steam.txt',
      license: 'GPL-3.0',
      description: 'Steam gaming platform (blocks game downloads too)',
    },
  ],
  Television: [
    // TV / streaming doesn't really have sleep-friendly blocklists — users
    // tend to want these services just not after a certain hour. Flag as
    // "consider a bedtime routine" rather than block.
  ],
}

export function getBlocklistsFor(category: string): Blocklist[] {
  return BLOCKLISTS_BY_CATEGORY[category] ?? []
}
