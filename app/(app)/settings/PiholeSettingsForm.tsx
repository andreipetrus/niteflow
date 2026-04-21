'use client'

import { useActionState, useState, useTransition } from 'react'
import { savePiholeSettings, testPiholeConnection } from '@/app/actions/settings'
import type { SettingsFormState, ConnectionTestResult } from '@/app/actions/settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = {
  defaultUrl: string
  defaultAllowInsecure: boolean
}

const initialState: SettingsFormState = {}

export function PiholeSettingsForm({ defaultUrl, defaultAllowInsecure }: Props) {
  const [state, formAction, isPending] = useActionState(savePiholeSettings, initialState)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [isTesting, startTesting] = useTransition()

  function handleTest() {
    startTesting(async () => {
      const result = await testPiholeConnection()
      setTestResult(result)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pi-hole Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="url">Pi-hole URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="http://192.168.1.1"
              defaultValue={defaultUrl}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Admin Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Pi-hole admin password"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allowInsecure"
              name="allowInsecure"
              type="checkbox"
              defaultChecked={defaultAllowInsecure}
              className="h-4 w-4"
            />
            <Label htmlFor="allowInsecure" className="text-sm font-normal">
              Allow self-signed TLS certificate
            </Label>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && (
            <p className="text-sm text-green-600">Settings saved successfully.</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Settings'}
            </Button>
            <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>
        </form>

        {testResult && (
          <div className="mt-4">
            {testResult.ok ? (
              <Badge variant="default" className="bg-green-600">
                Connected · Pi-hole {testResult.version}
              </Badge>
            ) : (
              <Badge variant="destructive">
                Failed: {testResult.error}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
