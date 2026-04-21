import { loadPiholeSettings } from '@/app/actions/settings'
import { getSelectedDeviceIps } from '@/app/actions/sync'
import { PiholeSettingsForm } from './PiholeSettingsForm'
import { DeviceSelector } from './DeviceSelector'

export default async function SettingsPage() {
  const saved = await loadPiholeSettings()
  const selectedIps = await getSelectedDeviceIps()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <PiholeSettingsForm defaultUrl={saved.url} defaultAllowInsecure={saved.allowInsecure} />
      <DeviceSelector initialSelectedIps={selectedIps} />
    </div>
  )
}
