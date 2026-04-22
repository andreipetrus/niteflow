'use client'

import { useState } from 'react'
import type { CorrelationResult } from '@/lib/analytics/correlate'
import { getBlocklistsFor } from '@/data/blocklist-recommendations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = { results: CorrelationResult[] }

export function Recommendations({ results }: Props) {
  // Focus on the quality-score metric for top-level recommendations;
  // that's the single composite number users care about most.
  const qualityResults = results
    .filter((r) => r.metric === 'qualityScore' && r.significant)
    .sort((a, b) => a.r - b.r) // most negative first

  const harmful = qualityResults.filter((r) => r.r < 0)
  const beneficial = qualityResults.filter((r) => r.r > 0)

  if (qualityResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No significant correlations detected yet. Once categories cross |r| ≥ 0.3 with a
            7+ night sample, we'll surface them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Based on your overnight sleep quality vs pre-sleep activity. We only consider
          categories with |r| ≥ 0.3 on ≥ 7 nights.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {harmful.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Categories associated with worse sleep
            </h3>
            {harmful.map((r) => (
              <HarmfulCategory key={r.category} result={r} />
            ))}
          </div>
        )}

        {beneficial.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Categories associated with better sleep
            </h3>
            <div className="flex flex-wrap gap-2">
              {beneficial.map((r) => (
                <Badge key={r.category} variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                  {r.category} · r={r.r.toFixed(2)}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Correlation ≠ causation — these may just be coincident with the nights where
              other things went well.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HarmfulCategory({ result }: { result: CorrelationResult }) {
  const blocklists = getBlocklistsFor(result.category)
  const [copied, setCopied] = useState<string | null>(null)

  function copy(url: string) {
    void navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{result.category}</div>
          <div className="text-xs text-muted-foreground">
            Pearson r = <span className="font-mono">{result.r.toFixed(2)}</span> across{' '}
            {result.n} nights
          </div>
        </div>
        <Badge variant="destructive">
          {result.r <= -0.5 ? 'strong' : 'moderate'} negative correlation
        </Badge>
      </div>

      {blocklists.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Suggested Pi-hole blocklists (Group Management → Adlists, paste the URL):
          </p>
          {blocklists.map((bl) => (
            <div
              key={bl.url}
              className="flex items-center justify-between gap-3 border rounded-sm p-2 bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  {bl.name}
                  <Badge variant="outline" className="text-xs">{bl.license}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{bl.description}</div>
                <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                  {bl.url}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => copy(bl.url)}>
                {copied === bl.url ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No DNS-level blocklist suggestion for this category. Consider a scheduled bedtime
          restriction in your router or on your phone instead.
        </p>
      )}
    </div>
  )
}
