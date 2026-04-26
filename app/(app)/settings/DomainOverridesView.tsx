'use client'

import { useState, useTransition, useCallback } from 'react'
import { fetchUncategorizedDomains, saveUserDomainCategory } from '@/app/actions/queries'
import type { UncategorizedDomain } from '@/lib/db/queries/domain-overrides'
import { IAB_CATEGORIES } from '@/data/iab-categories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const LIMIT_OPTIONS = [50, 100, 250]

export function DomainOverridesView() {
  const [limit, setLimit] = useState(100)
  const [rows, setRows] = useState<UncategorizedDomain[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [isLoading, startLoading] = useTransition()

  function load(limitOverride?: number) {
    const l = limitOverride ?? limit
    startLoading(async () => {
      const result = await fetchUncategorizedDomains(l)
      setRows(result)
      setHasLoaded(true)
    })
  }

  const assignCategory = useCallback(async (domain: string, category: string) => {
    setSaving(domain)
    await saveUserDomainCategory(domain, category)
    setRows((prev) => prev.filter((r) => r.domain !== domain))
    setSaving(null)
  }, [])

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Domain Category Overrides</CardTitle>
        <p className="text-sm text-muted-foreground">
          Domains with the most queries that couldn't be categorized automatically. Assign a
          category to include them in the correlation analysis.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Show top:
            <select
              className="border rounded px-2 py-1 bg-background"
              value={limit}
              onChange={(e) => {
                const val = Number(e.target.value)
                setLimit(val)
                if (hasLoaded) load(val)
              }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <Button size="sm" onClick={() => load()} disabled={isLoading}>
            {isLoading ? 'Loading…' : hasLoaded ? 'Refresh' : 'Load uncategorized domains'}
          </Button>

          {hasLoaded && (
            <span className="text-sm text-muted-foreground">
              {rows.length.toLocaleString()} uncategorized domain{rows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {hasLoaded && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            All top domains are categorized.
          </p>
        )}

        {rows.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Domain</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Queries</th>
                  <th className="text-left px-3 py-2 font-medium w-60">Assign category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <DomainRow
                    key={row.domain}
                    row={row}
                    isSaving={saving === row.domain}
                    onAssign={assignCategory}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DomainRow({
  row,
  isSaving,
  onAssign,
}: {
  row: UncategorizedDomain
  isSaving: boolean
  onAssign: (domain: string, category: string) => Promise<void>
}) {
  const [selected, setSelected] = useState('')

  return (
    <tr className="border-t">
      <td className="px-3 py-1.5 font-mono text-xs truncate max-w-xs">{row.domain}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        <Badge variant="secondary">{row.count.toLocaleString()}</Badge>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <select
            className="flex-1 border rounded px-2 py-1 bg-background text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isSaving}
          >
            <option value="">— select category —</option>
            {IAB_CATEGORIES.filter((c) => c.id !== 'other').map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!selected || isSaving}
            onClick={() => selected && onAssign(row.domain, selected)}
          >
            {isSaving ? '…' : 'Save'}
          </Button>
        </div>
      </td>
    </tr>
  )
}
