import { describe, it, expect } from 'vitest'
import { groupIntoNights, computeSleepSession, scoreNight, computeHrvBaseline } from '../scoring'
import type { HealthRecord } from '../parser'

function sleep(
  start: string,
  end: string,
  stage: 'InBed' | 'AsleepCore' | 'AsleepDeep' | 'AsleepREM' | 'Awake' | 'Asleep'
): HealthRecord {
  return {
    type: 'HKCategoryTypeIdentifierSleepAnalysis',
    startTs: Math.floor(new Date(start).getTime() / 1000),
    endTs: Math.floor(new Date(end).getTime() / 1000),
    value: `HKCategoryValueSleepAnalysis${stage}`,
    unit: null,
    source: 'Test',
  }
}

function hrv(at: string, value: number): HealthRecord {
  const ts = Math.floor(new Date(at).getTime() / 1000)
  return {
    type: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    startTs: ts,
    endTs: ts,
    value: String(value),
    unit: 'ms',
    source: 'Test',
  }
}

describe('groupIntoNights', () => {
  it('anchors a sleep session that crosses midnight to the end date', () => {
    const records = [
      sleep('2024-01-15T22:30:00Z', '2024-01-16T06:30:00Z', 'AsleepCore'),
    ]
    const nights = groupIntoNights(records)
    expect(nights.map((n) => n.date)).toEqual(['2024-01-16'])
  })

  it('groups stages from the same night into a single session', () => {
    const records = [
      sleep('2024-01-15T22:30:00Z', '2024-01-15T23:30:00Z', 'AsleepCore'),
      sleep('2024-01-15T23:30:00Z', '2024-01-16T00:30:00Z', 'AsleepDeep'),
      sleep('2024-01-16T00:30:00Z', '2024-01-16T01:30:00Z', 'AsleepREM'),
      sleep('2024-01-16T01:30:00Z', '2024-01-16T06:00:00Z', 'AsleepCore'),
    ]
    const nights = groupIntoNights(records)
    expect(nights).toHaveLength(1)
    expect(nights[0].date).toBe('2024-01-16')
    expect(nights[0].stageRecords).toHaveLength(4)
  })

  it('separates distinct nights', () => {
    const records = [
      sleep('2024-01-15T22:00:00Z', '2024-01-16T06:00:00Z', 'AsleepCore'),
      sleep('2024-01-16T22:00:00Z', '2024-01-17T06:00:00Z', 'AsleepCore'),
    ]
    const nights = groupIntoNights(records)
    expect(nights.map((n) => n.date)).toEqual(['2024-01-16', '2024-01-17'])
  })

  it('treats naps (sleep sessions during daytime) as their own night', () => {
    const records = [
      sleep('2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z', 'AsleepCore'),
    ]
    const nights = groupIntoNights(records)
    expect(nights).toHaveLength(1)
  })

  it('ignores non-sleep records', () => {
    const records = [
      hrv('2024-01-16T02:00:00Z', 50),
      sleep('2024-01-15T22:00:00Z', '2024-01-16T06:00:00Z', 'AsleepCore'),
    ]
    const nights = groupIntoNights(records)
    expect(nights).toHaveLength(1)
  })
})

describe('computeSleepSession', () => {
  it('sums asleep stages and computes deep/rem percentages', () => {
    const records = [
      sleep('2024-01-15T22:00:00Z', '2024-01-16T06:00:00Z', 'InBed'), // 8h
      sleep('2024-01-15T22:15:00Z', '2024-01-15T23:15:00Z', 'AsleepCore'), // 60m
      sleep('2024-01-15T23:15:00Z', '2024-01-16T01:15:00Z', 'AsleepDeep'), // 120m
      sleep('2024-01-16T01:15:00Z', '2024-01-16T02:15:00Z', 'AsleepREM'), // 60m
      sleep('2024-01-16T02:15:00Z', '2024-01-16T05:45:00Z', 'AsleepCore'), // 210m
      sleep('2024-01-16T05:45:00Z', '2024-01-16T05:55:00Z', 'Awake'),
    ]
    const nights = groupIntoNights(records)
    const session = computeSleepSession(nights[0], [])

    // Total asleep = 60 + 120 + 60 + 210 = 450m
    expect(session.totalMin).toBe(450)
    // Deep % = 120/450
    expect(session.deepPct).toBeCloseTo(120 / 450, 3)
    // REM % = 60/450
    expect(session.remPct).toBeCloseTo(60 / 450, 3)
    // Efficiency = 450m asleep / 480m in bed
    expect(session.efficiency).toBeCloseTo(450 / 480, 3)
  })

  it('treats legacy "Asleep" as core sleep', () => {
    const records = [
      sleep('2024-01-15T22:00:00Z', '2024-01-16T06:00:00Z', 'Asleep'), // legacy, treated as AsleepCore
    ]
    const nights = groupIntoNights(records)
    const session = computeSleepSession(nights[0], [])
    expect(session.totalMin).toBe(480)
    expect(session.deepPct).toBe(0)
    expect(session.remPct).toBe(0)
  })

  it('averages HRV samples that fall within the sleep window', () => {
    const records = [
      sleep('2024-01-15T22:00:00Z', '2024-01-16T06:00:00Z', 'AsleepCore'),
    ]
    const hrvs = [
      hrv('2024-01-16T02:00:00Z', 40),
      hrv('2024-01-16T04:00:00Z', 60),
      hrv('2024-01-16T10:00:00Z', 100), // outside sleep window, ignored
    ]
    const nights = groupIntoNights(records)
    const session = computeSleepSession(nights[0], hrvs)
    expect(session.hrvAvg).toBe(50)
  })
})

describe('computeHrvBaseline', () => {
  it('returns 30-day rolling mean across all provided HRV samples', () => {
    const samples = [
      hrv('2024-01-15T00:00:00Z', 40),
      hrv('2024-01-15T00:00:00Z', 50),
      hrv('2024-01-15T00:00:00Z', 60),
    ]
    expect(computeHrvBaseline(samples)).toBe(50)
  })

  it('returns null when no samples', () => {
    expect(computeHrvBaseline([])).toBeNull()
  })
})

describe('scoreNight', () => {
  // Reference scoring: per SPEC §3.2, weights are
  //   duration 25% · deep 25% · REM 20% · HRV 20% · efficiency 10%

  it('scores a perfect night near 100', () => {
    const session = {
      date: '2024-01-16',
      totalMin: 480, // 8h target
      deepPct: 0.25, // deep "good" ~25%
      remPct: 0.25, // REM "good" ~25%
      hrvAvg: 60, // 1.2× baseline
      efficiency: 1.0,
    }
    const score = scoreNight(session, 50)
    expect(score).toBeGreaterThan(90)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('scores a terrible night near 0', () => {
    const session = {
      date: '2024-01-16',
      totalMin: 120, // 2h — bad
      deepPct: 0.02, // almost no deep
      remPct: 0.02,
      hrvAvg: 20, // 0.4× baseline
      efficiency: 0.4,
    }
    const score = scoreNight(session, 50)
    expect(score).toBeLessThan(35)
  })

  it('handles missing HRV (redistributes weight)', () => {
    const session = {
      date: '2024-01-16',
      totalMin: 480,
      deepPct: 0.2,
      remPct: 0.2,
      hrvAvg: null,
      efficiency: 0.95,
    }
    const score = scoreNight(session, null)
    expect(score).toBeGreaterThan(80)
  })
})
