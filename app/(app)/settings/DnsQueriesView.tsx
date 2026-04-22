'use client'

import { useState, useTransition, useEffect } from 'react'
import { fetchTopDomains } from '@/app/actions/queries'
import type { DomainCount } from '@/lib/db/queries/dns-queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  availableDevices: { ip: string; name: string }[]
}

export function DnsQueriesView({ availableDevices }: Props) {
  const [selectedIps, setSelectedIps] = useState<string[]>(
    availableDevices.map((d) => d.ip)
  )
  const [includeNoise, setIncludeNoise] = useState(false)
  const [limit, setLimit] = useState(50)
  const [rows, setRows] = useState<DomainCount[]>([])
  const [isLoading, startLoading] = useTransition()
  const [hasLoaded, setHasLoaded] = useState(false)

  function toggle(ip: string) {
    setSelectedIps((prev) =>
      prev.includes(ip) ? prev.filter((x) => x !== ip) : [...prev, ip]
    )
  }

  function refresh() {
    startLoading(async () => {
      const result = await fetchTopDomains(selectedIps, limit, includeNoise)
      setRows(result)
      setHasLoaded(true)
    })
  }

  useEffect(() => {
    if (selectedIps.length > 0 && availableDevices.length > 0) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (availableDevices.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>DNS Queries by Device</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select devices and sync Pi-hole queries first.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>DNS Queries by Device</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Devices</p>
          <div className="flex flex-wrap gap-2">
            {availableDevices.map((d) => (
              <label
                key={d.ip}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm ${
                  selectedIps.includes(d.ip)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedIps.includes(d.ip)}
                  onChange={() => toggle(d.ip)}
                />
                <span className="font-medium">{d.name}</span>
                <span className="opacity-75 text-xs">{d.ip}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeNoise}
              onChange={(e) => setIncludeNoise(e.target.checked)}
            />
            Include noise (mDNS, reverse DNS, service discovery)
          </label>

          <label className="flex items-center gap-2 text-sm">
            Limit:
            <select
              className="border rounded px-2 py-1 bg-background"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </label>

          <Button size="sm" onClick={refresh} disabled={isLoading || selectedIps.length === 0}>
            {isLoading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {hasLoaded && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No queries found. Run Pi-hole sync first.
          </p>
        )}

        {rows.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Domain</th>
                  <th className="text-right px-3 py-2 font-medium w-20">Total</th>
                  {selectedIps.map((ip) => {
                    const device = availableDevices.find((d) => d.ip === ip)
                    return (
                      <th key={ip} className="text-right px-3 py-2 font-medium w-24">
                        {device?.name ?? ip}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.domain} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs truncate max-w-md">
                      {row.domain}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{row.total}</td>
                    {selectedIps.map((ip) => (
                      <td key={ip} className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {row.byDevice[ip] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
