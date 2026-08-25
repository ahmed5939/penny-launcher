import { Users } from 'lucide-react'

import { PageHeader } from '../../components/page'

import { AccountHub } from '../-index/-account-hub'

/**
 * Epic account hub as its own page: everything that belongs to the Epic
 * account rather than to Save the World itself. Kept out of the home tabs
 * so the home screen stays about missions; reachable from the titlebar.
 */

export function AccountRoute() {
  return (
    <>
      <PageHeader
        icon={Users}
        title="Epic account"
        description="Everything tied to your Epic accounts — linking, devices, V-Bucks, codes and settings."
      />

      <AccountHub />
    </>
  )
}
