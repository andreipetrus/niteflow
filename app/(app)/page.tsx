import { getSleepTimeline } from '@/lib/db/queries/sleep'
import { fetchPreSleepActivity } from '@/app/actions/dashboard'
import { DashboardView } from './DashboardView'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const from = isoDate(thirtyDaysAgo)
  const to = isoDate(today)
  const [data, activity] = await Promise.all([
    Promise.resolve(getSleepTimeline(from, to)),
    fetchPreSleepActivity(from, to, 3),
  ])

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your sleep timeline. Import Apple Health data and sync Pi-hole to unlock correlations.
        </p>
      </div>
      <DashboardView
        initialData={data}
        initialActivity={activity}
        initialFrom={from}
        initialTo={to}
      />
    </div>
  )
}
