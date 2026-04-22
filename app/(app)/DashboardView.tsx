'use client'

import { useState, useTransition, useEffect } from 'react'
import { fetchSleepTimeline, fetchPreSleepActivity } from '@/app/actions/dashboard'
import type { SleepTimelinePoint } from '@/lib/db/queries/sleep'
import type { NightlyAggregate } from '@/lib/analytics/aggregate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SleepTimeline } from '@/components/charts/SleepTimeline'
import { PreSleepActivity } from '@/components/charts/PreSleepActivity'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

type Props = {
  initialData: SleepTimelinePoint[]
  initialActivity: NightlyAggregate[]
  initialFrom: string
  initialTo: string
}

export function DashboardView({ initialData, initialActivity, initialFrom, initialTo }: Props) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [data, setData] = useState(initialData)
  const [activity, setActivity] = useState(initialActivity)
  const [isLoading, startLoading] = useTransition()

  function refresh(f: string, t: string) {
    startLoading(async () => {
      const [timeline, act] = await Promise.all([
        fetchSleepTimeline(f, t),
        fetchPreSleepActivity(f, t, 3),
      ])
      setData(timeline)
      setActivity(act)
    })
  }

  function setPreset(days: number) {
    const newFrom = daysAgo(days)
    const newTo = isoDate(new Date())
    setFrom(newFrom)
    setTo(newTo)
    refresh(newFrom, newTo)
  }

  useEffect(() => {
    if (from !== initialFrom || to !== initialTo) refresh(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = computeStats(data)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Sleep Timeline</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Quality score, duration, and HRV across the selected range.
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setPreset(7)}>7d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(30)}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(90)}>90d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(365)}>1y</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div>
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-auto"
              />
            </div>
            <div>
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button size="sm" onClick={() => refresh(from, to)} disabled={isLoading}>
              {isLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

          <SleepTimeline data={data} />

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
              <Stat label="Nights" value={stats.nights.toString()} />
              <Stat label="Avg Quality" value={stats.avgQuality.toFixed(1)} />
              <Stat label="Avg Duration" value={`${stats.avgHours.toFixed(1)}h`} />
              <Stat label="Avg HRV" value={stats.avgHrv != null ? `${stats.avgHrv.toFixed(1)}ms` : '—'} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-Sleep Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            DNS queries in the 3-hour window before sleep, broken down by content category.
          </p>
        </CardHeader>
        <CardContent>
          <PreSleepActivity data={activity} />
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </div>
  )
}

function computeStats(data: SleepTimelinePoint[]) {
  if (data.length === 0) return null
  const totals = data.reduce(
    (acc, d) => {
      acc.quality += d.qualityScore
      acc.hours += d.totalMin / 60
      if (d.hrvAvg != null) {
        acc.hrv += d.hrvAvg
        acc.hrvCount++
      }
      return acc
    },
    { quality: 0, hours: 0, hrv: 0, hrvCount: 0 }
  )
  return {
    nights: data.length,
    avgQuality: totals.quality / data.length,
    avgHours: totals.hours / data.length,
    avgHrv: totals.hrvCount > 0 ? totals.hrv / totals.hrvCount : null,
  }
}
