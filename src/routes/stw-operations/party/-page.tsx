import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Callout, PageHeader } from '../../../components/page'

import { KickAllPartyCard } from './-kick-all-party'
import { ClaimRewardsCard } from './-claim-rewards'
import { LeavePartyCard } from './-leave-party'

import { useClaimedRewardsNotifications } from './-hooks'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  useClaimedRewardsNotifications()

  return (
    <>
      <PageHeader
        icon={Users}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.party')}
      />

      {/*
        Three independent commands, so three equal panels rather than the
        stacked column this page used to be — you can see all of them without
        scrolling and pick one.
      */}
      <div className="grid gap-4 lg:grid-cols-3">
        <KickAllPartyCard />
        <LeavePartyCard />
        <ClaimRewardsCard />
      </div>

      <Callout
        tone="info"
        title="Note"
      >
        If you get some bug/issues with these features you can report in the
        Discord Server. Or you can consider contributing if you like.
      </Callout>
    </>
  )
}
