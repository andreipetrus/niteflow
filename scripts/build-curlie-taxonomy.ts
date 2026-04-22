/**
 * Build-time script: parses Curlie TSV dumps into a compact domain → category
 * JSON for runtime lookup. Run with: npx tsx scripts/build-curlie-taxonomy.ts
 *
 * Prereq: Curlie archive already extracted to data/curlie/curlie-rdf/
 * (download from https://curlie.org/directory-dl, ~169MB tar.gz).
 *
 * Output: data/curlie-taxonomy.json with shape:
 *   { "netflix.com": "Television", "instagram.com": "Social Media", ... }
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import {
  CURLIE_TO_IAB,
  SEED_SOCIAL_MEDIA_DOMAINS,
  SEED_VIDEO_STREAMING_DOMAINS,
  SEED_MUSIC_DOMAINS,
} from '../data/curlie-to-iab-mapping'

const CURLIE_DIR = path.join(process.cwd(), 'data/curlie/curlie-rdf')
const OUTPUT_PATH = path.join(process.cwd(), 'data/curlie-taxonomy.json')

// Source files: English-language English-content directories.
// Skip KT (Kids and Teens), Regional, World, and non-English mirrors.
const STRUCTURE_FILES = [
  'rdf-Top-s.tsv',
  'rdf-Arts-s.tsv',
  'rdf-Business-s.tsv',
  'rdf-Society-s.tsv',
  'rdf-Adult-s.tsv',
]
const CONTENT_FILES = [
  'rdf-Top-c.tsv',
  'rdf-Arts-c.tsv',
  'rdf-Business-c.tsv',
  'rdf-Society-c.tsv',
  'rdf-Adult-c.tsv',
]

function mapPathToCategory(fullPath: string): string {
  for (const rule of CURLIE_TO_IAB) {
    // Simple prefix match with boundary check so "Arts" doesn't match "Artsy"
    if (fullPath === rule.prefix || fullPath.startsWith(rule.prefix + '/')) {
      return rule.category
    }
  }
  return 'Other'
}

// Extract hostname from a URL and normalize: lowercase, strip leading www.,
// strip trailing dot, strip port. Returns null for unusable entries.
function extractDomain(urlStr: string): string | null {
  try {
    const u = new URL(urlStr)
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    if (host.endsWith('.')) host = host.slice(0, -1)
    if (!host.includes('.') || host === 'localhost') return null
    return host
  } catch {
    return null
  }
}

async function readTsvLines(filePath: string): Promise<AsyncIterable<string>> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  return readline.createInterface({ input: stream, crlfDelay: Infinity })
}

async function main() {
  if (!fs.existsSync(CURLIE_DIR)) {
    console.error(`Curlie directory not found: ${CURLIE_DIR}`)
    console.error('Download + extract first:')
    console.error('  cd data/curlie && curl -LO https://curlie.org/directory-dl && tar -xzf curlie-rdf-all.tar.gz')
    process.exit(1)
  }

  // Step 1: Load categoryId → fullPath from structure files
  console.log('[1/3] Loading Curlie category structure…')
  const idToPath = new Map<string, string>()
  for (const file of STRUCTURE_FILES) {
    const filePath = path.join(CURLIE_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.warn(`  skip missing: ${file}`)
      continue
    }
    const lines = await readTsvLines(filePath)
    let count = 0
    for await (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 2) continue
      const [id, fullPath] = parts
      if (id && fullPath) {
        idToPath.set(id, fullPath)
        count++
      }
    }
    console.log(`  ${file}: ${count.toLocaleString()} categories`)
  }
  console.log(`  → ${idToPath.size.toLocaleString()} total categories`)

  // Step 2: Walk content files, mapping each URL to its category path → IAB
  console.log('[2/3] Mapping sites to categories…')
  const domainCategory = new Map<string, string>()
  let seen = 0
  let mapped = 0
  let skipped = 0

  for (const file of CONTENT_FILES) {
    const filePath = path.join(CURLIE_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.warn(`  skip missing: ${file}`)
      continue
    }
    const lines = await readTsvLines(filePath)
    for await (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 4) continue
      const url = parts[0]
      const categoryId = parts[parts.length - 1].trim()
      seen++

      const fullPath = idToPath.get(categoryId)
      if (!fullPath) {
        skipped++
        continue
      }

      const domain = extractDomain(url)
      if (!domain) {
        skipped++
        continue
      }

      const category = mapPathToCategory(fullPath)
      if (category === 'Other') {
        // Still record it so we don't leave obvious entries unmapped —
        // but only if no better mapping already exists for this domain.
        if (!domainCategory.has(domain)) {
          domainCategory.set(domain, 'Other')
        }
        continue
      }

      // Prefer non-Other when multiple URLs map to the same domain
      const existing = domainCategory.get(domain)
      if (!existing || existing === 'Other') {
        domainCategory.set(domain, category)
        mapped++
      }
    }
    console.log(`  ${file}: cumulative mapped=${mapped.toLocaleString()} skipped=${skipped.toLocaleString()}`)
  }

  // Step 3: Apply seed domain lists (social, streaming, music) — these
  // override Curlie's data for major platforms that Curlie may miss or
  // classify imprecisely (e.g. TikTok under Business/Consumer_Goods).
  console.log('[3/3] Applying hand-curated seeds…')
  for (const d of SEED_SOCIAL_MEDIA_DOMAINS) domainCategory.set(d, 'Social Media')
  for (const d of SEED_VIDEO_STREAMING_DOMAINS) domainCategory.set(d, 'Television')
  for (const d of SEED_MUSIC_DOMAINS) domainCategory.set(d, 'Music and Audio')

  // Sort and dump
  const sorted = Object.fromEntries([...domainCategory.entries()].sort())
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sorted))

  const stats = fs.statSync(OUTPUT_PATH)
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`)
  console.log(`  ${domainCategory.size.toLocaleString()} domains, ${(stats.size / 1024).toFixed(1)} KB`)

  // Category distribution
  const dist = new Map<string, number>()
  for (const cat of domainCategory.values()) {
    dist.set(cat, (dist.get(cat) ?? 0) + 1)
  }
  console.log('\nCategory distribution:')
  const sortedDist = [...dist.entries()].sort((a, b) => b[1] - a[1])
  for (const [cat, count] of sortedDist) {
    console.log(`  ${count.toString().padStart(7).toLocaleString()}  ${cat}`)
  }

  console.log(`\nSummary: ${seen.toLocaleString()} rows seen, ${mapped.toLocaleString()} new mappings, ${skipped.toLocaleString()} skipped (unresolvable)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
