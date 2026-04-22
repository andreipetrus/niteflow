'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import type { NightlyDataPoint, SleepMetric } from '@/lib/analytics/correlate'
import { pearson } from '@/lib/analytics/correlate'

type Props = {
  nights: NightlyDataPoint[]
  category: string
  metric: SleepMetric
}

const METRIC_LABELS: Record<SleepMetric, string> = {
  qualityScore: 'Quality Score',
  totalMin: 'Duration (min)',
  hrvAvg: 'HRV (ms)',
  deepPct: 'Deep %',
  remPct: 'REM %',
}

type Segment = readonly [{ x: number; y: number }, { x: number; y: number }]

function computeTrendLine(xs: number[], ys: number[]): Segment | null {
  const n = xs.length
  if (n === 0) return null
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denom = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    denom += (xs[i] - meanX) ** 2
  }
  if (denom === 0) return null
  const slope = num / denom
  const intercept = meanY - slope * meanX
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  return [
    { x: xMin, y: slope * xMin + intercept },
    { x: xMax, y: slope * xMax + intercept },
  ] as const
}

export function CorrelationScatter({ nights, category, metric }: Props) {
  const { points, r, trend } = useMemo(() => {
    const pts = nights
      .filter((n) => n[metric] != null)
      .map((n) => ({
        x: n.categoryCounts[category] ?? 0,
        y: n[metric] as number,
        date: n.date,
      }))

    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const pearsonR = pts.length >= 2 ? pearson(xs, ys) : NaN
    const trendLine = computeTrendLine(xs, ys)

    return { points: pts, r: pearsonR, trend: trendLine }
  }, [nights, category, metric])

  const xLabel = `${category} — queries in pre-sleep window`
  const yLabel = METRIC_LABELS[metric]

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {category} × {yLabel}
        </h3>
        <div className="text-xs text-muted-foreground font-mono">
          n={points.length}, r={Number.isNaN(r) ? '—' : r.toFixed(3)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            fontSize={11}
            label={{ value: xLabel, position: 'bottom', offset: -5, fontSize: 11 }}
          />
          <YAxis type="number" dataKey="y" name={yLabel} fontSize={11} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            formatter={(value, name) => {
              if (name === 'y') return [typeof value === 'number' ? value.toFixed(1) : value, yLabel]
              if (name === 'x') return [value, 'Queries']
              return [value, String(name)]
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
          />
          {trend && (
            <ReferenceLine
              segment={trend}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 3"
              ifOverflow="extendDomain"
            />
          )}
          <Scatter data={points} fill="#3b82f6" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
