/**
 * Rules that map Curlie category paths to Niteflow/IAB category names.
 *
 * Rules are evaluated top-to-bottom; the first prefix match wins. More
 * specific paths must come BEFORE broader ones (e.g. `Arts/Movies` before
 * `Arts`). Paths are matched against the Curlie "Full Path" column, which
 * starts with the top-level category name (Top, Arts, Business, etc.).
 */

export type MappingRule = {
  prefix: string
  category: string
}

export const CURLIE_TO_IAB: MappingRule[] = [
  // ——— Adult ———
  { prefix: 'Adult', category: 'Adult Content' },

  // ——— News & Politics ———
  { prefix: 'News', category: 'News and Politics' },
  { prefix: 'Society/Politics', category: 'News and Politics' },
  { prefix: 'Society/Issues', category: 'News and Politics' },
  { prefix: 'Society/Activism', category: 'News and Politics' },
  { prefix: 'Society/Government', category: 'News and Politics' },
  { prefix: 'Society/Law', category: 'News and Politics' },
  { prefix: 'Society/History', category: 'News and Politics' },

  // ——— Religion ———
  { prefix: 'Society/Religion_and_Spirituality', category: 'Religion and Spirituality' },

  // ——— Society fallback (families, people, folklore, etc.) ———
  { prefix: 'Society', category: 'Hobbies and Interests' },

  // ——— Arts (most specific first) ———
  { prefix: 'Arts/Movies', category: 'Movies' },
  { prefix: 'Arts/Television', category: 'Television' },
  { prefix: 'Arts/Animation', category: 'Television' },
  { prefix: 'Arts/Video', category: 'Television' },
  { prefix: 'Arts/Music', category: 'Music and Audio' },
  { prefix: 'Arts/Radio', category: 'Music and Audio' },
  { prefix: 'Arts/Literature', category: 'Books and Literature' },
  { prefix: 'Arts/Comics', category: 'Books and Literature' },
  { prefix: 'Arts/Writers_Resources', category: 'Books and Literature' },
  { prefix: 'Arts/Performing_Arts', category: 'Hobbies and Interests' },
  { prefix: 'Arts/Design', category: 'Hobbies and Interests' },
  { prefix: 'Arts/Photography', category: 'Hobbies and Interests' },
  { prefix: 'Arts/Architecture', category: 'Hobbies and Interests' },
  { prefix: 'Arts', category: 'Hobbies and Interests' },

  // ——— Shopping ———
  { prefix: 'Shopping', category: 'Shopping' },
  { prefix: 'Business/Consumer_Goods_and_Services', category: 'Shopping' },
  { prefix: 'Business/Retail', category: 'Shopping' },
  { prefix: 'Business/E-Commerce', category: 'Shopping' },

  // ——— Gambling (explicit before games fallback) ———
  { prefix: 'Games/Gambling', category: 'Gambling' },
  { prefix: 'Recreation/Gambling', category: 'Gambling' },

  // ——— Video Gaming ———
  { prefix: 'Games/Video_Games', category: 'Video Gaming' },
  { prefix: 'Games/Online', category: 'Video Gaming' },
  { prefix: 'Games/Console_Platforms', category: 'Video Gaming' },
  { prefix: 'Games/Roleplaying', category: 'Video Gaming' },
  { prefix: 'Games', category: 'Video Gaming' },
  { prefix: 'Computers/Games', category: 'Video Gaming' },

  // ——— Social Media (Curlie path) ———
  {
    prefix: 'Computers/Internet/On_the_Web/Online_Communities/Social_Networking',
    category: 'Social Media',
  },
  { prefix: 'Computers/Internet/On_the_Web/Weblogs', category: 'Social Media' },
  {
    prefix: 'Computers/Internet/On_the_Web/Online_Communities/Microblogging',
    category: 'Social Media',
  },
  { prefix: 'Computers/Internet/On_the_Web/Online_Communities', category: 'Social Media' },

  // ——— Technology & Computing ———
  { prefix: 'Computers', category: 'Technology & Computing' },
  { prefix: 'Science', category: 'Technology & Computing' },
  { prefix: 'Reference/Education', category: 'Education' },
  { prefix: 'Reference', category: 'Technology & Computing' },

  // ——— Business & Finance ———
  { prefix: 'Business/Financial_Services', category: 'Business and Finance' },
  { prefix: 'Business/Investing', category: 'Business and Finance' },
  { prefix: 'Business', category: 'Business and Finance' },

  // ——— Sports ———
  { prefix: 'Sports', category: 'Sports' },
  { prefix: 'Recreation/Sports', category: 'Sports' },

  // ——— Travel ———
  { prefix: 'Recreation/Travel', category: 'Travel' },
  { prefix: 'Regional/.+/Travel', category: 'Travel' },

  // ——— Food & Drink ———
  { prefix: 'Home/Cooking', category: 'Food and Drink' },
  { prefix: 'Home/Food', category: 'Food and Drink' },
  { prefix: 'Recreation/Food', category: 'Food and Drink' },

  // ——— Home & Garden ———
  { prefix: 'Home/Gardening', category: 'Home and Garden' },
  { prefix: 'Home', category: 'Home and Garden' },

  // ——— Health ———
  { prefix: 'Health', category: 'Medical Health' },

  // ——— Style & Fashion ———
  { prefix: 'Shopping/Clothing', category: 'Style and Fashion' },
  { prefix: 'Shopping/Beauty', category: 'Style and Fashion' },

  // ——— Education ———
  { prefix: 'Kids_and_Teens/School_Time', category: 'Education' },
  { prefix: 'Kids_and_Teens', category: 'Hobbies and Interests' },

  // ——— Hobbies catch-alls ———
  { prefix: 'Recreation', category: 'Hobbies and Interests' },
  { prefix: 'Top', category: 'Other' }, // lose signal at the root level

  // ——— Geographic directories (fall through to Other) ———
  { prefix: 'Regional', category: 'Other' },
  { prefix: 'World', category: 'Other' },
]

/**
 * Known social platforms that Curlie may miss or miscategorize (newer
 * services, or placed in Business/Computers categories). These seed
 * mappings are applied AFTER Curlie data is loaded, taking precedence over
 * the Curlie-derived category for that specific domain.
 */
export const SEED_SOCIAL_MEDIA_DOMAINS = [
  'tiktok.com',
  'tiktokv.com',
  'bytedance.com',
  'threads.net',
  'mastodon.social',
  'bsky.app',
  'instagram.com',
  'facebook.com',
  'fbcdn.net',
  'twitter.com',
  'x.com',
  't.co',
  'snapchat.com',
  'sc-static.net',
  'pinterest.com',
  'reddit.com',
  'redd.it',
  'redditstatic.com',
  'discord.com',
  'discordapp.com',
  'linkedin.com',
  'licdn.com',
  'whatsapp.com',
  'whatsapp.net',
  'telegram.org',
  'telegram.me',
  't.me',
]

export const SEED_VIDEO_STREAMING_DOMAINS = [
  'netflix.com',
  'nflxvideo.net',
  'nflxext.com',
  'youtube.com',
  'youtu.be',
  'ytimg.com',
  'googlevideo.com',
  'twitch.tv',
  'ttvnw.net',
  'primevideo.com',
  'disneyplus.com',
  'bamgrid.com',
  'disney-plus.net',
  'hulu.com',
  'hulustream.com',
  'hbomax.com',
  'max.com',
  'paramountplus.com',
  'peacocktv.com',
  'tv.apple.com',
  'vimeo.com',
]

export const SEED_MUSIC_DOMAINS = [
  'spotify.com',
  'scdn.co',
  'pscdn.co',
  'soundcloud.com',
  'music.apple.com',
  'music.youtube.com',
  'pandora.com',
  'tidal.com',
  'deezer.com',
]
