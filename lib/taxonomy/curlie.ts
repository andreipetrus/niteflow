import fs from 'fs'
import path from 'path'

export type DomainTaxonomy = Record<string, string>

const TAXONOMY_PATH = path.join(process.cwd(), 'data/curlie-taxonomy.json')

let cached: DomainTaxonomy | null = null

export function loadCurlieTaxonomy(): DomainTaxonomy {
  if (cached) return cached
  if (!fs.existsSync(TAXONOMY_PATH)) {
    throw new Error(
      'curlie-taxonomy.json not found. Run: npx tsx scripts/build-curlie-taxonomy.ts'
    )
  }
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf-8')
  cached = JSON.parse(raw) as DomainTaxonomy
  return cached
}

export function taxonomySize(): number {
  try {
    return Object.keys(loadCurlieTaxonomy()).length
  } catch {
    return 0
  }
}
