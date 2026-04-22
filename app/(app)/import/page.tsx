import { getHealthStatus } from '@/app/actions/health'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImportForm } from './ImportForm'

export default async function ImportPage() {
  const status = await getHealthStatus()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Import Health Data</h1>
        <p className="text-muted-foreground">
          Upload your Apple Health export to derive nightly sleep sessions and quality scores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Export from Apple Health</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Open the <strong>Health</strong> app on your iPhone</li>
            <li>Tap your profile icon (top right)</li>
            <li>Scroll down and tap <strong>Export All Health Data</strong></li>
            <li>
              Wait for the export to generate (can take a few minutes), then share/save the{' '}
              <code className="font-mono text-xs">.zip</code> file
            </li>
            <li>Upload the ZIP file below — no need to unzip it first</li>
          </ol>
          <p className="text-xs text-muted-foreground pt-2">
            Only sleep + heart metrics are parsed. Your data stays on this device — nothing is
            transmitted externally.
          </p>
        </CardContent>
      </Card>

      {status.totalSessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <Badge>{status.totalSessions.toLocaleString()} nights</Badge> in DB
              {status.latestDate && ` · latest: ${status.latestDate}`}
            </p>
            {status.avgQuality != null && (
              <p className="text-muted-foreground">
                Average quality score: {status.avgQuality.toFixed(1)} / 100
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Re-importing replaces raw records and refreshes scores (idempotent).
            </p>
          </CardContent>
        </Card>
      )}

      <ImportForm />
    </div>
  )
}
