import type { PlayService } from './-hooks'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
} from '../../components/page'
import { useAutomationServices } from './-hooks'

const labels: Record<PlayService['key'], string> = {
  'auto-kick': 'sidebar:stw-operations.options.auto-kick',
  'auto-llamas': 'sidebar:stw-operations.options.auto-llamas',
}

export function AutomationChips() {
  const { t } = useTranslation(['general', 'sidebar'])
  const { services } = useAutomationServices()
  return (
    <Panel>
      <PanelHeader compact title={t('home.services.title')} />
      <PanelBody className="py-1">
        <ul className="divide-y divide-border/60">
          {services.map((service) => (
            <ListRow
              key={service.key}
              name={
                <Link
                  to={service.to}
                  className="hover:text-primary hover:underline"
                >
                  {t(labels[service.key])} →
                </Link>
              }
              caption={
                service.accounts > 0
                  ? t('sidebar:service-accounts', { count: service.accounts })
                  : undefined
              }
              figure={
                <StatusPill
                  tone={
                    service.status === 'running'
                      ? 'active'
                      : service.status === 'issue'
                        ? 'warning'
                        : 'idle'
                  }
                >
                  {t(`home.services.${service.status}`)}
                </StatusPill>
              }
            />
          ))}
        </ul>
      </PanelBody>
    </Panel>
  )
}
