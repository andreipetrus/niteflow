/**
 * Consistent color palette for IAB content categories across all charts.
 * Colors chosen with accessibility in mind — enough contrast for stacked
 * visualizations in both light and dark modes.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  'Social Media': '#ec4899', // pink-500
  Television: '#8b5cf6', // violet-500
  Movies: '#a855f7', // purple-500
  'News and Politics': '#ef4444', // red-500
  'Video Gaming': '#f97316', // orange-500
  'Adult Content': '#be185d', // pink-700 (darker, serious)
  Gambling: '#dc2626', // red-600
  Shopping: '#f59e0b', // amber-500
  'Music and Audio': '#06b6d4', // cyan-500
  Sports: '#84cc16', // lime-500
  'Technology & Computing': '#3b82f6', // blue-500
  'Business and Finance': '#0ea5e9', // sky-500
  'Books and Literature': '#14b8a6', // teal-500
  Travel: '#10b981', // emerald-500
  'Food and Drink': '#22c55e', // green-500
  'Home and Garden': '#4ade80', // green-400
  'Medical Health': '#059669', // emerald-600
  'Style and Fashion': '#d946ef', // fuchsia-500
  'Religion and Spirituality': '#6366f1', // indigo-500
  'Hobbies and Interests': '#64748b', // slate-500
  Education: '#0891b2', // cyan-600
  Other: '#94a3b8', // slate-400
  Uncategorized: '#cbd5e1', // slate-300
}

export function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
}
