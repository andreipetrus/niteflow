'use client'

import { useState, useTransition } from 'react'
import { applyCurlieTaxonomy } from '@/app/actions/taxonomy'
import type { TaxonomyStatus, ApplyTaxonomyResult } from '@/app/actions/taxonomy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = {
  initialStatus: TaxonomyStatus
  packAvailable: boolean
  packSize: number
}

function formatDate(ts: number | null): string {
  if (!ts) return 'Never'
  return new Date(ts * 1000).toLocaleString()
}

function relevanceBadgeClass(rel: 'high' | 'medium' | 'low'): string {
  return rel === 'high'
    ? 'border-red-500 text-red-600 dark:text-red-400'
    : rel === 'medium'
      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
      : 'border-muted-foreground/30 text-muted-foreground'
}

export function TaxonomyPicker({ initialStatus, packAvailable, packSize }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [result, setResult] = useState<ApplyTaxonomyResult | null>(null)
  const [isApplying, startApplying] = useTransition()

  function handleApply() {
    startApplying(async () => {
      const r = await applyCurlieTaxonomy()
      setResult(r)
      if (r.ok) {
        setStatus({
          ...status,
          loaded: true,
          domainCount: r.domainsLoaded,
          loadedAt: Math.floor(Date.now() / 1000),
          categorizedQueries: r.queriesCategorized,
          categoriesInDb: r.domainsLoaded,
        })
      }
    })
  }

  const grouped = status.iabCategories.reduce<Record<string, typeof status.iabCategories>>(
    (acc, c) => {
      const key = c.sleepRelevance
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
      return acc
    },
    {}
  )

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Content Taxonomy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Niteflow categorizes your DNS queries using the{' '}
            <span className="font-medium text-foreground">IAB Content Taxonomy v3</span>{' '}
            vocabulary, with domain mappings sourced from{' '}
            <a
              href="https://curlie.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 text-foreground"
            >
              Curlie
            </a>
            , the successor to DMOZ (human-curated, Free Use License).
          </p>
          <p>
            Hand-curated seeds are applied on top for major platforms that Curlie may miss
            or miscategorize (TikTok, Threads, streaming services, etc.). User overrides are
            preserved across reloads.
          </p>
        </div>

        <div className="flex items-center gap-3 border rounded-md p-3 bg-muted/30">
          {packAvailable ? (
            <>
              <Badge className="bg-green-600">Pack available</Badge>
              <span className="text-sm text-muted-foreground">
                {packSize.toLocaleString()} domains bundled
              </span>
            </>
          ) : (
            <>
              <Badge variant="destructive">Pack missing</Badge>
              <span className="text-sm text-muted-foreground">
                Run <code className="font-mono text-xs">npm run build:taxonomy</code> to build from Curlie
              </span>
            </>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Categories (IAB-aligned)</h3>
          {(['high', 'medium', 'low'] as const).map((rel) => {
            const cats = grouped[rel] ?? []
            if (cats.length === 0) return null
            return (
              <div key={rel} className="mb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                  {rel} sleep relevance
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c) => (
                    <Badge
                      key={c.id}
                      variant="outline"
                      className={relevanceBadgeClass(c.sleepRelevance)}
                      title={c.description}
                    >
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={handleApply} disabled={isApplying || !packAvailable}>
            {isApplying ? 'Loading…' : status.loaded ? 'Reload Taxonomy' : 'Load Curlie Taxonomy'}
          </Button>

          {status.loaded && (
            <div className="text-sm text-muted-foreground">
              Last loaded: {formatDate(status.loadedAt)} ·{' '}
              {status.categoriesInDb.toLocaleString()} domains in DB ·{' '}
              {status.categorizedQueries.toLocaleString()} queries categorized
            </div>
          )}

          {result?.ok && (
            <Badge className="bg-green-600">
              ✓ {result.domainsLoaded.toLocaleString()} domains,{' '}
              {result.queriesCategorized.toLocaleString()} queries · {(result.elapsedMs / 1000).toFixed(1)}s
            </Badge>
          )}

          {result && !result.ok && <Badge variant="destructive">{result.error}</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}
