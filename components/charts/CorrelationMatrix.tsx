'use client'

import { useMemo } from 'react'
import type { CorrelationResult, SleepMetric } from '@/lib/analytics/correlate'

type Props = {
  results: CorrelationResult[]
  categories: string[]
  metrics: SleepMetric[]
  onCellClick: (category: string, metric: SleepMetric) => void
  selectedCell?: { category: string; metric: SleepMetric } | null
}

const METRIC_LABELS: Record<SleepMetric, string> = {
  qualityScore: 'Quality',
  totalMin: 'Duration',
  hrvAvg: 'HRV',
  deepPct: 'Deep %',
  remPct: 'REM %',
}

// Map [-1, 1] to a color; opacity reflects |r| and significance.
function cellStyle(r: number, significant: boolean): React.CSSProperties {
  const abs = Math.abs(r)
  const opacity = (significant ? 1 : 0.35) * Math.max(0.12, abs)
  const hue = r >= 0 ? 140 : 0 // green for positive, red for negative
  const lightness = 50 - Math.round(abs * 12)
  return {
    backgroundColor: `hsl(${hue}, 70%, ${lightness}%, ${opacity})`,
    color: abs > 0.55 ? 'white' : 'inherit',
  }
}

export function CorrelationMatrix({
  results,
  categories,
  metrics,
  onCellClick,
  selectedCell,
}: Props) {
  const lookup = useMemo(() => {
    const m = new Map<string, CorrelationResult>()
    for (const r of results) m.set(`${r.category}|${r.metric}`, r)
    return m
  }, [results])

  if (categories.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
        No correlations yet. Need ≥7 nights of paired Pi-hole + sleep data.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 text-xs"
        style={{ gridTemplateColumns: `minmax(140px, auto) repeat(${metrics.length}, minmax(70px, 1fr))` }}
      >
        <div />
        {metrics.map((m) => (
          <div key={m} className="font-medium text-center px-2 py-1">
            {METRIC_LABELS[m]}
          </div>
        ))}

        {categories.map((cat) => (
          <div key={cat} className="contents">
            <div className="font-medium truncate pr-3 py-2">{cat}</div>
            {metrics.map((metric) => {
              const r = lookup.get(`${cat}|${metric}`)
              const isSelected =
                selectedCell?.category === cat && selectedCell?.metric === metric
              return (
                <button
                  key={metric}
                  onClick={() => r && onCellClick(cat, metric)}
                  disabled={!r}
                  className={`h-10 rounded-sm flex items-center justify-center font-mono font-medium border transition-all ${
                    isSelected ? 'ring-2 ring-primary border-primary' : 'border-transparent'
                  } ${r ? 'cursor-pointer hover:scale-105' : 'cursor-default opacity-20'}`}
                  style={r ? cellStyle(r.r, r.significant) : undefined}
                  title={
                    r
                      ? `${cat} × ${METRIC_LABELS[metric]}: r=${r.r.toFixed(2)}, n=${r.n}${r.significant ? ' (significant)' : ''}`
                      : 'insufficient data'
                  }
                >
                  {r ? r.r.toFixed(2) : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm" style={{ background: 'hsl(0, 70%, 38%)' }} />
          <span>Negative (hurts sleep)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm" style={{ background: 'hsl(140, 70%, 38%)' }} />
          <span>Positive (helps sleep)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm opacity-30 border" />
          <span>Not significant (|r| &lt; 0.3)</span>
        </div>
        <span>Click a cell for scatter detail.</span>
      </div>
    </div>
  )
}
