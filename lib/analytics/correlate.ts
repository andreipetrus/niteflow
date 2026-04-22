export type SleepMetric = 'qualityScore' | 'totalMin' | 'hrvAvg' | 'deepPct' | 'remPct'

export type NightlyDataPoint = {
  date: string
  qualityScore: number
  totalMin: number
  deepPct: number
  remPct: number
  hrvAvg: number | null
  efficiency: number
  categoryCounts: Record<string, number>
}

export type CorrelationResult = {
  category: string
  metric: SleepMetric
  r: number
  n: number
  significant: boolean
}

export const SLEEP_METRICS: SleepMetric[] = [
  'qualityScore',
  'totalMin',
  'hrvAvg',
  'deepPct',
  'remPct',
]

const MIN_N = 7
const SIGNIFICANCE_THRESHOLD = 0.3 // |r| above this is considered meaningful

/**
 * Pearson correlation coefficient. Returns NaN when either series has no
 * variance (constant) or lengths don't match.
 */
export function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) return NaN
  const n = xs.length

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  if (denomX === 0 || denomY === 0) return NaN
  return num / Math.sqrt(denomX * denomY)
}

/**
 * Correlates a single category's nightly query count against one sleep
 * metric. Returns null if fewer than MIN_N paired (non-null) nights.
 */
export function correlateCategory(
  category: string,
  metric: SleepMetric,
  nights: NightlyDataPoint[]
): CorrelationResult | null {
  const xs: number[] = []
  const ys: number[] = []

  for (const night of nights) {
    const metricValue = night[metric]
    if (metricValue == null) continue // skip null HRV nights
    xs.push(night.categoryCounts[category] ?? 0)
    ys.push(metricValue)
  }

  if (xs.length < MIN_N) return null

  const r = pearson(xs, ys)
  if (Number.isNaN(r)) return null

  return {
    category,
    metric,
    r,
    n: xs.length,
    significant: Math.abs(r) >= SIGNIFICANCE_THRESHOLD,
  }
}

/**
 * Full correlation matrix across all categories × all sleep metrics.
 * Categories without ≥MIN_N paired nights are excluded.
 */
export function computeAllCorrelations(nights: NightlyDataPoint[]): CorrelationResult[] {
  const categories = new Set<string>()
  for (const n of nights) {
    for (const c of Object.keys(n.categoryCounts)) categories.add(c)
  }

  const results: CorrelationResult[] = []
  for (const category of categories) {
    for (const metric of SLEEP_METRICS) {
      const r = correlateCategory(category, metric, nights)
      if (r) results.push(r)
    }
  }
  return results
}
