// Open-source content taxonomies available for sleep-relevance categorization.
// Categories follow IAB Content Taxonomy v3 naming conventions where practical.

export type TaxonomyFormat = 'hosts' | 'domains'

export type TaxonomySource = {
  id: string
  name: string
  description: string
  category: string
  url: string
  format: TaxonomyFormat
  license: string
  sleepRelevance: 'high' | 'medium' | 'low'
}

export const TAXONOMY_SOURCES: TaxonomySource[] = [
  // ——— Social Media (Steven Black + Hagezi per-service) ———
  {
    id: 'sb-social',
    name: 'StevenBlack: Social Media',
    description: 'Consolidated social network domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social-only/hosts',
    format: 'hosts',
    license: 'MIT',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-facebook',
    name: 'Hagezi: Facebook',
    description: 'Meta / Facebook service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.facebook.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-instagram',
    name: 'Hagezi: Instagram',
    description: 'Instagram service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.instagram.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-tiktok',
    name: 'Hagezi: TikTok',
    description: 'TikTok service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.tiktok.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-twitter',
    name: 'Hagezi: Twitter/X',
    description: 'X (formerly Twitter) service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.twitter.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-snapchat',
    name: 'Hagezi: Snapchat',
    description: 'Snapchat service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.snapchat.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-linkedin',
    name: 'Hagezi: LinkedIn',
    description: 'LinkedIn service domains',
    category: 'Social Media',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.linkedin.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'medium',
  },

  // ——— Video Streaming ———
  {
    id: 'hagezi-youtube',
    name: 'Hagezi: YouTube',
    description: 'YouTube service domains',
    category: 'Video Streaming',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.youtube.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-netflix',
    name: 'Hagezi: Netflix',
    description: 'Netflix streaming domains',
    category: 'Video Streaming',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.netflix.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-amazon',
    name: 'Hagezi: Amazon / Prime Video',
    description: 'Amazon + Prime Video domains',
    category: 'Video Streaming',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.amazon.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-disneyplus',
    name: 'Hagezi: Disney+',
    description: 'Disney+ streaming domains',
    category: 'Video Streaming',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.disneyplus.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'high',
  },
  {
    id: 'hagezi-apple',
    name: 'Hagezi: Apple (TV/Music)',
    description: 'Apple service domains (includes TV+, Music)',
    category: 'Video Streaming',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.apple.txt',
    format: 'domains',
    license: 'GPL-3.0',
    sleepRelevance: 'medium',
  },

  // ——— Adult Content ———
  {
    id: 'sb-porn',
    name: 'StevenBlack: Adult / NSFW',
    description: 'Adult content domains',
    category: 'Adult / NSFW',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts',
    format: 'hosts',
    license: 'MIT',
    sleepRelevance: 'high',
  },

  // ——— Gambling ———
  {
    id: 'sb-gambling',
    name: 'StevenBlack: Gambling',
    description: 'Gambling and betting domains',
    category: 'Gambling',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts',
    format: 'hosts',
    license: 'MIT',
    sleepRelevance: 'high',
  },

  // ——— News (fake/sensationalist) ———
  {
    id: 'sb-fakenews',
    name: 'StevenBlack: Fake News',
    description: 'Known fake news and sensationalist sources',
    category: 'News & Media',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-only/hosts',
    format: 'hosts',
    license: 'MIT',
    sleepRelevance: 'medium',
  },
]
