import { loadPiholeSettings } from '@/app/actions/settings'
import { getSelectedDeviceIps, getSelectedDevices } from '@/app/actions/sync'
import { getTaxonomyState } from '@/app/actions/taxonomy'
import { PiholeSettingsForm } from './PiholeSettingsForm'
import { DeviceSelector } from './DeviceSelector'
import { DnsQueriesView } from './DnsQueriesView'
import { TaxonomyPicker } from './TaxonomyPicker'

export default async function SettingsPage() {
  const saved = await loadPiholeSettings()
  const selectedIps = await getSelectedDeviceIps()
  const selectedDevices = await getSelectedDevices()
  const taxonomyState = await getTaxonomyState()

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <PiholeSettingsForm defaultUrl={saved.url} defaultAllowInsecure={saved.allowInsecure} />
      <DeviceSelector initialSelectedIps={selectedIps} />
      <DnsQueriesView availableDevices={selectedDevices} />
      <TaxonomyPicker initialState={taxonomyState} />
    </div>
  )
}
