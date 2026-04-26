'use server'

import { getTopDomainsByDevice } from '@/lib/db/queries/dns-queries'
import type { DomainCount } from '@/lib/db/queries/dns-queries'
import { getUncategorizedDomainsDefault, saveUserDomainOverrideDefault } from '@/lib/db/queries/domain-overrides'
import type { UncategorizedDomain } from '@/lib/db/queries/domain-overrides'

export async function fetchTopDomains(
  deviceIps: string[],
  limit = 50,
  includeNoise = false
): Promise<DomainCount[]> {
  return getTopDomainsByDevice(deviceIps, limit, includeNoise)
}

export async function fetchUncategorizedDomains(limit = 100): Promise<UncategorizedDomain[]> {
  return getUncategorizedDomainsDefault(limit)
}

export async function saveUserDomainCategory(domain: string, category: string): Promise<void> {
  saveUserDomainOverrideDefault(domain, category)
}
