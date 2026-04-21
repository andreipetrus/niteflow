'use client'

import { useState, useTransition } from 'react'
import { loadDevices, saveDevices, runPiholeSync } from '@/app/actions/sync'
import type { DevicesResult, SyncActionResult } from '@/app/actions/sync'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = {
  initialSelectedIps: string[]
}

export function DeviceSelector({ initialSelectedIps }: Props) {
  const [devicesResult, setDevicesResult] = useState<DevicesResult | null>(null)
  const [selectedIps, setSelectedIps] = useState<string[]>(initialSelectedIps)
  const [syncResult, setSyncResult] = useState<SyncActionResult | null>(null)
  const [isLoading, startLoading] = useTransition()
  const [isSyncing, startSyncing] = useTransition()

  function handleLoadDevices() {
    startLoading(async () => {
      const result = await loadDevices()
      setDevicesResult(result)
    })
  }

  function toggleDevice(ip: string) {
    setSelectedIps((prev) =>
      prev.includes(ip) ? prev.filter((x) => x !== ip) : [...prev, ip]
    )
  }

  function handleSave() {
    saveDevices(selectedIps)
  }

  function handleSync() {
    startSyncing(async () => {
      const result = await runPiholeSync(30)
      setSyncResult(result)
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Monitored Devices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select the devices whose DNS queries should be correlated with your sleep data.
        </p>

        <Button variant="outline" onClick={handleLoadDevices} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load Devices from Pi-hole'}
        </Button>

        {devicesResult && !devicesResult.ok && (
          <p className="text-sm text-destructive">{devicesResult.error}</p>
        )}

        {devicesResult?.ok && (
          <div className="space-y-2">
            {devicesResult.devices.length === 0 && (
              <p className="text-sm text-muted-foreground">No devices found in Pi-hole.</p>
            )}
            {devicesResult.devices.map((device) => (
              <label key={device.ip} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedIps.includes(device.ip)}
                  onChange={() => toggleDevice(device.ip)}
                />
                <span className="text-sm font-medium">{device.name}</span>
                <span className="text-xs text-muted-foreground">{device.ip}</span>
              </label>
            ))}

            <div className="flex gap-3 pt-2">
              <Button size="sm" onClick={handleSave}>
                Save Device Selection ({selectedIps.length} selected)
              </Button>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? 'Syncing…' : 'Sync Pi-hole Queries (last 30 days)'}
          </Button>
          {syncResult && (
            <div className="mt-2">
              {syncResult.ok ? (
                <Badge className="bg-green-600">
                  Synced: {syncResult.inserted} new, {syncResult.skipped} skipped
                </Badge>
              ) : (
                <Badge variant="destructive">{syncResult.error}</Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
