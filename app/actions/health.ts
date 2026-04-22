'use server'

import { getLatestImportSummary } from '@/lib/health/import'

export async function getHealthStatus() {
  return getLatestImportSummary()
}
