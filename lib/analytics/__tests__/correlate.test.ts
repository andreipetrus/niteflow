import { describe, it, expect } from 'vitest'
import { pearson, correlateCategory, computeAllCorrelations } from '../correlate'
import type { NightlyDataPoint } from '../correlate'

describe('pearson', () => {
  it('returns 1.0 for perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 6)
  })

  it('returns -1.0 for perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1, 6)
  })

  it('returns ~0 for uncorrelated series', () => {
    const r = pearson([1, 2, 3, 4, 5], [3, 1, 4, 1, 5])
    expect(Math.abs(r)).toBeLessThan(0.5)
  })

  it('returns NaN for constant y (no variance)', () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNaN()
  })

  it('returns NaN for constant x', () => {
    expect(pearson([2, 2, 2], [1, 2, 3])).toBeNaN()
  })

  it('returns NaN for mismatched lengths', () => {
    expect(pearson([1, 2], [1, 2, 3])).toBeNaN()
  })

  it('matches reference value to 4 decimal places (benchmark)', () => {
    // Hand-computed from mean-centered products:
    //   mean(x) = 11, mean(y) = 18.2857
    //   sum((x-xbar)(y-ybar)) = -54
    //   sum((x-xbar)^2) = 112, sum((y-ybar)^2) ≈ 61.4286
    //   r = -54 / sqrt(112 * 61.4286) ≈ -0.6510
    const r = pearson([5, 7, 9, 11, 13, 15, 17], [23, 17, 19, 21, 15, 19, 14])
    expect(r).toBeCloseTo(-0.6510, 4)
  })
})

function mkNight(
  date: string,
  qualityScore: number,
  totalMin: number,
  hrv: number | null,
  categories: Record<string, number>
): NightlyDataPoint {
  return {
    date,
    qualityScore,
    totalMin,
    deepPct: 0.2,
    remPct: 0.2,
    hrvAvg: hrv,
    efficiency: 0.9,
    categoryCounts: categories,
  }
}

describe('correlateCategory', () => {
  it('returns null when fewer than 7 paired nights', () => {
    const nights = Array.from({ length: 6 }, (_, i) =>
      mkNight(`2024-01-${10 + i}`, 70 + i, 400, 50, { 'Social Media': 100 - i * 10 })
    )
    expect(correlateCategory('Social Media', 'qualityScore', nights)).toBeNull()
  })

  it('returns result with r, n, significant=true for n=7 and |r|>0.3', () => {
    const nights = Array.from({ length: 7 }, (_, i) =>
      mkNight(`2024-01-${10 + i}`, 90 - i * 5, 400, 50, { 'Social Media': i * 20 })
    )
    const result = correlateCategory('Social Media', 'qualityScore', nights)
    expect(result).not.toBeNull()
    expect(result!.n).toBe(7)
    expect(result!.r).toBeCloseTo(-1, 5)
    expect(result!.significant).toBe(true)
  })

  it('marks low-correlation results as not significant', () => {
    const nights = Array.from({ length: 10 }, (_, i) =>
      mkNight(`2024-01-${10 + i}`, 70 + (i % 2), 400, 50, { 'Social Media': 50 + (i % 3) })
    )
    const result = correlateCategory('Social Media', 'qualityScore', nights)
    expect(result).not.toBeNull()
    expect(Math.abs(result!.r)).toBeLessThan(0.3)
    expect(result!.significant).toBe(false)
  })

  it('skips nights missing the requested metric (null hrvAvg)', () => {
    const nights = [
      ...Array.from({ length: 7 }, (_, i) =>
        mkNight(`2024-01-${10 + i}`, 70, 400, 50 + i * 2, { 'Social Media': i * 10 })
      ),
      mkNight('2024-01-17', 70, 400, null, { 'Social Media': 999 }), // skipped
    ]
    const result = correlateCategory('Social Media', 'hrvAvg', nights)
    expect(result).not.toBeNull()
    expect(result!.n).toBe(7)
  })

  it('treats missing category (undefined) as zero queries', () => {
    const nights = Array.from({ length: 7 }, (_, i) =>
      mkNight(`2024-01-${10 + i}`, 70 + i, 400, 50, i === 0 ? {} : { 'Social Media': i * 10 })
    )
    const result = correlateCategory('Social Media', 'qualityScore', nights)
    expect(result).not.toBeNull()
    expect(result!.n).toBe(7)
  })
})

describe('computeAllCorrelations', () => {
  it('returns a result per (category, metric) pair', () => {
    const nights = Array.from({ length: 10 }, (_, i) => ({
      date: `2024-01-${10 + i}`,
      qualityScore: 90 - i * 5,
      totalMin: 400 + i * 10,
      deepPct: 0.2,
      remPct: 0.2,
      hrvAvg: 50 + i,
      efficiency: 0.9,
      categoryCounts: { 'Social Media': i * 20, Television: 50 - i * 3 },
    }))

    const matrix = computeAllCorrelations(nights)

    const socialQuality = matrix.find(
      (m) => m.category === 'Social Media' && m.metric === 'qualityScore'
    )
    expect(socialQuality).toBeDefined()
    expect(socialQuality!.r).toBeCloseTo(-1, 5) // perfect negative correlation
  })

  it('excludes categories/metrics that never accumulate ≥7 nights', () => {
    const nights = Array.from({ length: 5 }, (_, i) => ({
      date: `2024-01-${10 + i}`,
      qualityScore: 70 + i,
      totalMin: 400,
      deepPct: 0.2,
      remPct: 0.2,
      hrvAvg: 50,
      efficiency: 0.9,
      categoryCounts: { 'Social Media': i },
    }))
    const matrix = computeAllCorrelations(nights)
    expect(matrix).toHaveLength(0)
  })

  it('completes in under 100ms for 90 nights of data (perf gate)', () => {
    const nights = Array.from({ length: 90 }, (_, i) => ({
      date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      qualityScore: 60 + (i % 20),
      totalMin: 360 + (i % 60) * 2,
      deepPct: 0.1 + (i % 5) * 0.03,
      remPct: 0.15 + (i % 4) * 0.02,
      hrvAvg: 40 + (i % 30),
      efficiency: 0.85 + (i % 10) * 0.015,
      categoryCounts: {
        'Social Media': i * 2,
        Television: 90 - i,
        Gaming: (i * 7) % 50,
        News: i % 15,
        Music: (i * 3) % 40,
      },
    }))

    const start = Date.now()
    computeAllCorrelations(nights)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100)
  })
})
