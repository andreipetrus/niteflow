'use client'

import { useState, useTransition } from 'react'
import { toggleTaxonomy, applyTaxonomies } from '@/app/actions/taxonomy'
import type { TaxonomyState, ApplyResult } from '@/app/actions/taxonomy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = { initialState: TaxonomyState[] }

function formatDate(ts: number | null): string {
  if (!ts) return 'Never'
  return new Date(ts * 1000).toLocaleString()
}

export function TaxonomyPicker({ initialState }: Props) {
  const [state, setState] = useState(initialState)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)
  const [isApplying, startApplying] = useTransition()

  const grouped = state.reduce<Record<string, TaxonomyState[]>>((acc, s) => {
    const key = s.source.category
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  async function handleToggle(id: string, enabled: boolean) {
    await toggleTaxonomy(id, enabled)
    setState((prev) => prev.map((s) => (s.source.id === id ? { ...s, enabled } : s)))
  }

  function handleApply() {
    startApplying(async () => {
      const result = await applyTaxonomies()
      setApplyResult(result)

      const byId = new Map(result.summary.map((s) => [s.sourceId, s]))
      const now = Math.floor(Date.now() / 1000)
      setState((prev) =>
        prev.map((s) => {
          const hit = byId.get(s.source.id)
          if (!hit || hit.error) return s
          return { ...s, lastLoadedAt: now, domainCount: hit.domainCount }
        })
      )
    })
  }

  const enabledCount = state.filter((s) => s.enabled).length

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Content Taxonomies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Select open-source taxonomies to categorize the domains you access. Sources are
          downloaded on demand and stored locally. User-assigned categories are never overwritten.
        </p>

        {Object.entries(grouped).map(([category, sources]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {category}
            </h3>
            <div className="grid gap-2">
              {sources.map(({ source, enabled, lastLoadedAt, domainCount }) => (
                <label
                  key={source.id}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    enabled ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={enabled}
                    onChange={(e) => handleToggle(source.id, e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{source.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {source.license}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          source.sleepRelevance === 'high'
                            ? 'border-red-500 text-red-600 dark:text-red-400'
                            : source.sleepRelevance === 'medium'
                              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                              : ''
                        }`}
                      >
                        {source.sleepRelevance} sleep relevance
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last loaded: {formatDate(lastLoadedAt)}
                      {domainCount > 0 && ` · ${domainCount.toLocaleString()} domains`}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 border-t pt-4">
          <Button onClick={handleApply} disabled={isApplying || enabledCount === 0}>
            {isApplying
              ? 'Loading taxonomies…'
              : `Apply ${enabledCount} selected source${enabledCount === 1 ? '' : 's'}`}
          </Button>

          {applyResult && (
            <div className="flex-1 text-sm">
              <Badge className="bg-green-600">
                {applyResult.queriesRecategorized.toLocaleString()} queries categorized
              </Badge>
              {applyResult.summary.some((s) => s.error) && (
                <div className="mt-2 text-xs text-destructive">
                  {applyResult.summary
                    .filter((s) => s.error)
                    .map((s) => `${s.name}: ${s.error}`)
                    .join('; ')}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
