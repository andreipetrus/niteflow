/**
 * Niteflow content categories, aligned with IAB Content Taxonomy v3 Tier 1
 * where practical. "Social Media" is a Niteflow extension (IAB treats it as
 * audience/platform metadata rather than content) because it's central to
 * pre-sleep scroll behavior. "Gambling" is elevated from IAB's
 * "Hobbies & Interests > Gambling" because it warrants its own bucket for
 * sleep analysis.
 */

export type CategoryRelevance = 'high' | 'medium' | 'low'

export type IabCategory = {
  id: string
  name: string
  // How strongly this category is believed to affect sleep when consumed
  // before bed. Used for UI grouping and recommendation ranking.
  sleepRelevance: CategoryRelevance
  description: string
}

export const IAB_CATEGORIES: IabCategory[] = [
  // — High sleep-relevance (arousal / screen engagement pre-bed) —
  {
    id: 'social-media',
    name: 'Social Media',
    sleepRelevance: 'high',
    description: 'Social networks, microblogging, short-form video platforms',
  },
  {
    id: 'video-streaming',
    name: 'Television',
    sleepRelevance: 'high',
    description: 'TV, streaming video, episodic entertainment (Netflix, YouTube, Twitch)',
  },
  {
    id: 'movies',
    name: 'Movies',
    sleepRelevance: 'high',
    description: 'Feature films, trailers, cinema content',
  },
  {
    id: 'news-politics',
    name: 'News and Politics',
    sleepRelevance: 'high',
    description: 'News, current events, political commentary',
  },
  {
    id: 'video-gaming',
    name: 'Video Gaming',
    sleepRelevance: 'high',
    description: 'Games, gaming communities, game streaming',
  },
  {
    id: 'adult',
    name: 'Adult Content',
    sleepRelevance: 'high',
    description: 'Adult / NSFW content',
  },
  {
    id: 'gambling',
    name: 'Gambling',
    sleepRelevance: 'high',
    description: 'Online gambling, betting, casino sites',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    sleepRelevance: 'high',
    description: 'E-commerce, retail, consumer goods',
  },

  // — Medium sleep-relevance —
  {
    id: 'music-audio',
    name: 'Music and Audio',
    sleepRelevance: 'medium',
    description: 'Music streaming, podcasts, audio content',
  },
  {
    id: 'sports',
    name: 'Sports',
    sleepRelevance: 'medium',
    description: 'Sports news, live scores, fantasy leagues',
  },
  {
    id: 'technology',
    name: 'Technology & Computing',
    sleepRelevance: 'medium',
    description: 'Tech news, software, developer tools, hardware',
  },
  {
    id: 'business-finance',
    name: 'Business and Finance',
    sleepRelevance: 'medium',
    description: 'Business news, investing, personal finance',
  },
  {
    id: 'books-literature',
    name: 'Books and Literature',
    sleepRelevance: 'medium',
    description: 'Books, reading, literary content',
  },

  // — Low sleep-relevance (typically benign) —
  {
    id: 'travel',
    name: 'Travel',
    sleepRelevance: 'low',
    description: 'Travel planning, booking, destination content',
  },
  {
    id: 'food-drink',
    name: 'Food and Drink',
    sleepRelevance: 'low',
    description: 'Recipes, restaurants, cooking content',
  },
  {
    id: 'home-garden',
    name: 'Home and Garden',
    sleepRelevance: 'low',
    description: 'Home improvement, gardening, DIY',
  },
  {
    id: 'health',
    name: 'Medical Health',
    sleepRelevance: 'low',
    description: 'Health information, medical resources',
  },
  {
    id: 'style-fashion',
    name: 'Style and Fashion',
    sleepRelevance: 'low',
    description: 'Fashion, beauty, personal style',
  },
  {
    id: 'religion',
    name: 'Religion and Spirituality',
    sleepRelevance: 'low',
    description: 'Religion, spirituality, meditation',
  },
  {
    id: 'hobbies',
    name: 'Hobbies and Interests',
    sleepRelevance: 'low',
    description: 'General hobbies, crafts, niche interests',
  },
  {
    id: 'education',
    name: 'Education',
    sleepRelevance: 'low',
    description: 'Learning, courses, reference material',
  },

  // — Fallback —
  {
    id: 'other',
    name: 'Other',
    sleepRelevance: 'low',
    description: 'Uncategorized or not mapped',
  },
]

export const IAB_CATEGORY_BY_ID: Record<string, IabCategory> = Object.fromEntries(
  IAB_CATEGORIES.map((c) => [c.id, c])
)

export const IAB_CATEGORY_BY_NAME: Record<string, IabCategory> = Object.fromEntries(
  IAB_CATEGORIES.map((c) => [c.name, c])
)
