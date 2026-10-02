import type { NotificationRules } from '../../../state/settings/notification-rules'

import { FieldRow } from '../../../components/page'
import { Switch } from '../../../components/ui/switch'
import { useNotificationRulesStore } from '../../../state/settings/notification-rules'

const rules: Array<{ hint?: string; key: keyof NotificationRules; label: string }> = [
  {
    hint: 'Checked every few minutes while the launcher is open.',
    key: 'serverDown',
    label: 'Fortnite goes down',
  },
  { key: 'serverRecovered', label: 'Fortnite comes back up' },
  { key: 'friendRequests', label: 'A friend request arrives' },
]

/** Desktop notifications. They apply as soon as they are switched. */
export function NotificationSettings() {
  const current = useNotificationRulesStore((state) => state.rules)
  const setRule = useNotificationRulesStore((state) => state.setRule)

  return (
    <>
      {rules.map((rule) => (
        <FieldRow
          hint={rule.hint}
          key={rule.key}
          label={rule.label}
        >
          <Switch
            aria-label={rule.label}
            checked={current[rule.key]}
            onCheckedChange={(value) => setRule(rule.key, value)}
          />
        </FieldRow>
      ))}
    </>
  )
}
