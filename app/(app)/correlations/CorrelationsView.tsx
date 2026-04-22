'use client'

import { useState } from 'react'
import type { CorrelationSnapshot } from '@/app/actions/correlations'
import type { SleepMetric } from '@/lib/analytics/correlate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CorrelationMatrix } from '@/components/charts/CorrelationMatrix'
import { CorrelationScatter } from '@/components/charts/CorrelationScatter'
import { Recommendations } from './Recommendations'

type Props = { snapshot: CorrelationSnapshot }

export function CorrelationsView({ snapshot }: Props) {
  const [selected, setSelected] = useState<{ category: string; metric: SleepMetric } | null>(
    snapshot.categories.length > 0
      ? { category: snapshot.categories[0], metric: 'qualityScore' }
      : null
  )

  const insufficient = snapshot.nightsWithQueries < 7

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correlation Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pearson r between pre-sleep query volume per category and five sleep metrics.
            Positive r suggests more of that category correlates with better sleep; negative,
            worse.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline">
              {snapshot.totalNights.toLocaleString()} total nights
            </Badge>
            <Badge variant={snapshot.nightsWithQueries >= 7 ? 'default' : 'destructive'}>
              {snapshot.nightsWithQueries} with paired queries
            </Badge>
            <Badge variant="outline">
              {snapshot.results.length} correlation pairs computed
            </Badge>
          </div>

          {insufficient ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <p className="font-medium">Not enough overlapping data yet.</p>
              <p className="text-muted-foreground mt-1">
                Correlations require at least 7 nights where both sleep sessions and pre-sleep
                Pi-hole queries exist. Currently {snapshot.nightsWithQueries} night
                {snapshot.nightsWithQueries === 1 ? '' : 's'} qualify.
                {' '}Either wait for Pi-hole to accumulate more days (check FTL retention in your
                Pi-hole settings) or re-import fresh Apple Health data if yours is stale.
              </p>
            </div>
          ) : (
            <CorrelationMatrix
              results={snapshot.results}
              categories={snapshot.categories}
              metrics={snapshot.metrics}
              onCellClick={(category, metric) => setSelected({ category, metric })}
              selectedCell={selected}
            />
          )}
        </CardContent>
      </Card>

      {!insufficient && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Scatter</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrelationScatter
              nights={snapshot.nightlyData}
              category={selected.category}
              metric={selected.metric}
            />
          </CardContent>
        </Card>
      )}

      {!insufficient && <Recommendations results={snapshot.results} />}
    </div>
  )
}
