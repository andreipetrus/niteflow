'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { SleepTimelinePoint } from '@/lib/db/queries/sleep'

type Props = { data: SleepTimelinePoint[] }

type ChartRow = {
  date: string
  quality: number
  hours: number
  hrv: number | null
}

function prepareData(points: SleepTimelinePoint[]): ChartRow[] {
  return points.map((p) => ({
    date: p.date.slice(5), // MM-DD for compact axis
    quality: p.qualityScore,
    hours: Number((p.totalMin / 60).toFixed(2)),
    hrv: p.hrvAvg,
  }))
}

export function SleepTimeline({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
        No sleep sessions in this date range. Import Apple Health data on the Import page.
      </div>
    )
  }

  const rows = prepareData(data)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          fontSize={12}
          label={{ value: 'Quality', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={12}
          label={{ value: 'Hours / HRV (ms)', angle: 90, position: 'insideRight', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value, name) => {
            if (value == null) return ['—', String(name)]
            const num = typeof value === 'number' ? value : Number(value)
            if (name === 'Quality') return [num.toFixed(1), 'Quality']
            if (name === 'Hours') return [`${num.toFixed(1)}h`, 'Hours']
            if (name === 'HRV') return [`${num.toFixed(1)}ms`, 'HRV']
            return [String(value), String(name)]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="right" dataKey="hours" name="Hours" fill="#a3a3a3" opacity={0.5} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="quality"
          name="Quality"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="hrv"
          name="HRV"
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
