import { getCorrelationSnapshot } from '@/app/actions/correlations'
import { CorrelationsView } from './CorrelationsView'

export default async function CorrelationsPage() {
  const snapshot = await getCorrelationSnapshot(3)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Correlations</h1>
        <p className="text-muted-foreground text-sm">
          Explore how pre-sleep content categories relate to your sleep quality metrics.
        </p>
      </div>
      <CorrelationsView snapshot={snapshot} />
    </div>
  )
}
