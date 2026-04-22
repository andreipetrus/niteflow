import type { TaxonomySource } from '@/data/taxonomy-sources'

// Parse a hosts file (lines like "0.0.0.0 domain.com") or a plain domains file.
export function parseTaxonomyFile(content: string, format: 'hosts' | 'domains'): string[] {
  const domains: string[] = []

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    let domain: string | null = null

    if (format === 'hosts') {
      // Formats: "0.0.0.0 domain.com", "127.0.0.1 domain.com"
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        domain = parts[1]
      }
    } else {
      // Plain domains file: "domain.com" (maybe with leading "||" or trailing "^")
      domain = line.replace(/^\|\|/, '').replace(/\^$/, '')
    }

    if (!domain) continue
    // Strip inline comments
    domain = domain.split('#')[0].trim().toLowerCase()
    if (!domain) continue
    // Skip loopback
    if (domain === 'localhost' || domain === 'local' || domain === 'broadcasthost') continue
    // Basic sanity check: must contain a dot
    if (!domain.includes('.')) continue

    domains.push(domain)
  }

  return [...new Set(domains)] // dedupe within a single source
}

export async function fetchTaxonomySource(source: TaxonomySource): Promise<string[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Niteflow/0.1 (local content categorization)' },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.name}: HTTP ${res.status}`)
  }

  const text = await res.text()
  return parseTaxonomyFile(text, source.format)
}
