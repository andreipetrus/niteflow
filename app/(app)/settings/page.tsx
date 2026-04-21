import { loadPiholeSettings } from '@/app/actions/settings'
import { PiholeSettingsForm } from './PiholeSettingsForm'

export default async function SettingsPage() {
  const saved = await loadPiholeSettings()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <PiholeSettingsForm defaultUrl={saved.url} defaultAllowInsecure={saved.allowInsecure} />
    </div>
  )
}
