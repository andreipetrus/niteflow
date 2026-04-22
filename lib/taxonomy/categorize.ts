import { loadCurlieTaxonomy } from './curlie'

/**
 * Look up a domain's category with progressive subdomain fallback.
 * Tries in order:
 *   1. Exact match (`music.apple.com` → "Music and Audio" if curated)
 *   2. Strip `www.` prefix (`www.google.com` → `google.com`)
 *   3. Strip leading subdomain labels one at a time (`app.m.reddit.com`
 *      → `m.reddit.com` → `reddit.com`)
 *
 * Returns null if no match at any level.
 */
export function categorizeDomain(
  domain: string,
  taxonomy?: Record<string, string>
): string | null {
  const map = taxonomy ?? loadCurlieTaxonomy()
  const lowered = domain.toLowerCase().replace(/\.$/, '')

  // Candidate walk: start from exact, then iteratively strip one leading label
  const candidates: string[] = []
  candidates.push(lowered)
  if (lowered.startsWith('www.')) candidates.push(lowered.slice(4))

  // Strip leading labels until only registered-domain-ish remains (2 labels)
  let current = lowered.startsWith('www.') ? lowered.slice(4) : lowered
  while (current.split('.').length > 2) {
    const next = current.slice(current.indexOf('.') + 1)
    candidates.push(next)
    current = next
  }

  for (const c of candidates) {
    const hit = map[c]
    if (hit) return hit
  }
  return null
}
