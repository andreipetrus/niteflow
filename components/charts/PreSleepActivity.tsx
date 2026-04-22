'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import type { NightlyAggregate } from '@/lib/analytics/aggregate'
import { colorFor } from '@/lib/taxonomy/colors'

type Props = { data: NightlyAggregate[] }

export function PreSleepActivity({ data }: Props) {
  const { rows, categories } = useMemo(() => {
    if (data.length === 0) return { rows: [], categories: [] as string[] }

    // Collect union of categories across nights, sorted by total volume
    const totals = new Map<string, number>()
    for (const night of data) {
      for (const [cat, count] of Object.entries(night.byCategory)) {
        totals.set(cat, (totals.get(cat) ?? 0) + count)
      }
    }
    const cats = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c)

    const rows = data.map((night) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = { date: night.date.slice(5) }
      for (const c of cats) row[c] = night.byCategory[c] ?? 0
      return row
    })

    return { rows, categories: cats }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
        No pre-sleep query data in this range. Sync Pi-hole on the Settings page.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {categories.map((c) => (
          <Bar key={c} dataKey={c} stackId="a" fill={colorFor(c)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
