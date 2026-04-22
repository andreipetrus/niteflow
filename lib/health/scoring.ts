import type { HealthRecord } from './parser'

export type Night = {
  date: string // YYYY-MM-DD (anchored to end date per SPEC)
  stageRecords: HealthRecord[] // Sleep stage records for this night
}

export type SleepSession = {
  date: string
  totalMin: number // Minutes asleep (Core + Deep + REM + legacy "Asleep")
  deepPct: number // Deep / total asleep
  remPct: number // REM / total asleep
  hrvAvg: number | null
  efficiency: number // Asleep / InBed (or range fallback)
}

function stageOf(rec: HealthRecord): string | null {
  if (!rec.value?.startsWith('HKCategoryValueSleepAnalysis')) return null
  return rec.value.slice('HKCategoryValueSleepAnalysis'.length)
}

function isSleepStage(rec: HealthRecord): boolean {
  return rec.type === 'HKCategoryTypeIdentifierSleepAnalysis' && stageOf(rec) != null
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toISOString().slice(0, 10)
}

// Gap (seconds) between two sleep records that still counts as the same
// session. Apple Watch typically emits contiguous stages back-to-back, but
// small gaps appear around wake interruptions.
const SESSION_GAP_SECONDS = 30 * 60 // 30 minutes

/**
 * Partitions sleep-stage records into nightly sessions using a session-gap
 * algorithm: records whose start is within SESSION_GAP_SECONDS of the prior
 * record's end belong to the same session.
 *
 * Each session is anchored to the date of its LAST record (wake time), per
 * SPEC §3.2 "anchored to the later date if crossing midnight".
 */
export function groupIntoNights(records: HealthRecord[]): Night[] {
  const sleepRecs = records.filter(isSleepStage).sort((a, b) => a.startTs - b.startTs)
  if (sleepRecs.length === 0) return []

  const sessions: HealthRecord[][] = []
  let current: HealthRecord[] = [sleepRecs[0]]
  let currentEnd = sleepRecs[0].endTs

  for (let i = 1; i < sleepRecs.length; i++) {
    const rec = sleepRecs[i]
    if (rec.startTs - currentEnd <= SESSION_GAP_SECONDS) {
      current.push(rec)
      currentEnd = Math.max(currentEnd, rec.endTs)
    } else {
      sessions.push(current)
      current = [rec]
      currentEnd = rec.endTs
    }
  }
  sessions.push(current)

  return sessions.map((stageRecords) => {
    const endTs = Math.max(...stageRecords.map((r) => r.endTs))
    return { date: formatDate(endTs), stageRecords }
  })
}

// Stages that count toward total sleep duration
const ASLEEP_STAGES = new Set(['AsleepCore', 'AsleepDeep', 'AsleepREM', 'Asleep'])

export function computeSleepSession(night: Night, allHrvRecords: HealthRecord[]): SleepSession {
  let totalMin = 0
  let deepMin = 0
  let remMin = 0
  let inBedMin = 0

  let sessionStart = Infinity
  let sessionEnd = -Infinity

  for (const rec of night.stageRecords) {
    const stage = stageOf(rec)
    if (!stage) continue

    const mins = (rec.endTs - rec.startTs) / 60
    if (ASLEEP_STAGES.has(stage)) {
      totalMin += mins
      sessionStart = Math.min(sessionStart, rec.startTs)
      sessionEnd = Math.max(sessionEnd, rec.endTs)
      if (stage === 'AsleepDeep') deepMin += mins
      else if (stage === 'AsleepREM') remMin += mins
    } else if (stage === 'InBed') {
      inBedMin += mins
      sessionStart = Math.min(sessionStart, rec.startTs)
      sessionEnd = Math.max(sessionEnd, rec.endTs)
    } else if (stage === 'Awake') {
      sessionStart = Math.min(sessionStart, rec.startTs)
      sessionEnd = Math.max(sessionEnd, rec.endTs)
    }
  }

  // If no explicit InBed record exists, use the total session span
  // (first asleep/awake to last asleep/awake)
  const bedFallbackMin =
    sessionEnd > sessionStart ? (sessionEnd - sessionStart) / 60 : totalMin
  const bedDenominator = inBedMin > 0 ? inBedMin : bedFallbackMin

  const efficiency = bedDenominator > 0 ? totalMin / bedDenominator : 0
  const deepPct = totalMin > 0 ? deepMin / totalMin : 0
  const remPct = totalMin > 0 ? remMin / totalMin : 0

  // Average HRV samples that fall within the sleep span
  let hrvAvg: number | null = null
  if (allHrvRecords.length > 0 && sessionEnd > sessionStart) {
    const inWindow = allHrvRecords.filter(
      (r) =>
        r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' &&
        r.startTs >= sessionStart &&
        r.startTs <= sessionEnd
    )
    if (inWindow.length > 0) {
      const sum = inWindow.reduce((acc, r) => acc + Number(r.value), 0)
      hrvAvg = sum / inWindow.length
    }
  }

  return {
    date: night.date,
    totalMin,
    deepPct,
    remPct,
    hrvAvg,
    efficiency: Math.min(1, efficiency),
  }
}

export function computeHrvBaseline(hrvRecords: HealthRecord[]): number | null {
  const vals = hrvRecords
    .filter((r) => r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN')
    .map((r) => Number(r.value))
    .filter((v) => Number.isFinite(v))

  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/**
 * Composite 0–100 quality score per SPEC §3.2.
 * Weights: duration 25% · deep 25% · REM 20% · HRV 20% · efficiency 10%
 *
 * Each component maps to [0,1] via clamped scoring targets:
 *   duration: 1.0 at 480min (8h), linearly down to 0 at 120min
 *   deep:     1.0 at 23% of sleep (healthy adult target), 0 at 0%
 *   REM:      1.0 at 22% of sleep, 0 at 0%
 *   HRV:      1.0 at ≥1.2× baseline, 0 at ≤0.5× baseline (linear between)
 *   efficiency: 1.0 at ≥95%, 0 at ≤50%
 *
 * When HRV is missing, its weight is redistributed proportionally across
 * the remaining components.
 */
export function scoreNight(
  session: Pick<SleepSession, 'totalMin' | 'deepPct' | 'remPct' | 'hrvAvg' | 'efficiency'>,
  hrvBaseline: number | null
): number {
  const durationScore = clamp01((session.totalMin - 120) / (480 - 120))
  const deepScore = clamp01(session.deepPct / 0.23)
  const remScore = clamp01(session.remPct / 0.22)
  const efficiencyScore = clamp01((session.efficiency - 0.5) / (0.95 - 0.5))

  const hrvAvailable = session.hrvAvg != null && hrvBaseline != null && hrvBaseline > 0
  const hrvScore = hrvAvailable
    ? clamp01((session.hrvAvg! / hrvBaseline! - 0.5) / (1.2 - 0.5))
    : 0

  const baseWeights = {
    duration: 0.25,
    deep: 0.25,
    rem: 0.2,
    hrv: 0.2,
    efficiency: 0.1,
  }

  // Redistribute HRV weight if missing
  const weights = { ...baseWeights }
  if (!hrvAvailable) {
    const nonHrvTotal = weights.duration + weights.deep + weights.rem + weights.efficiency
    const hrvWeight = weights.hrv
    weights.duration += (weights.duration / nonHrvTotal) * hrvWeight
    weights.deep += (weights.deep / nonHrvTotal) * hrvWeight
    weights.rem += (weights.rem / nonHrvTotal) * hrvWeight
    weights.efficiency += (weights.efficiency / nonHrvTotal) * hrvWeight
    weights.hrv = 0
  }

  const score =
    durationScore * weights.duration +
    deepScore * weights.deep +
    remScore * weights.rem +
    hrvScore * weights.hrv +
    efficiencyScore * weights.efficiency

  return Math.round(score * 100 * 10) / 10
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}
