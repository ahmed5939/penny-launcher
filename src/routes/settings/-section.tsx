import type { ReactNode } from 'react'

import { useTranslation } from 'react-i18next'

import {
  FieldGroup,
  Panel,
  PanelBody,
  PanelHeader,
  StatusDot,
} from '../../components/page'
import { Button } from '../../components/ui/button'

import { cn } from '../../lib/utils'

/**
 * One group of settings rows under a short title, the way a game client's
 * options screen groups Video, Audio and Controls: a fill, a name, then
 * label-left / control-right rows sharing dividers.
 */
export function SettingsSection({
  actions,
  children,
  className,
  description,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  className?: string
  description?: ReactNode
  title: ReactNode
}) {
  return (
    <Panel className={className}>
      <PanelHeader
        actions={actions}
        compact
        description={description}
        title={title}
      />
      <PanelBody>
        <FieldGroup>{children}</FieldGroup>
      </PanelBody>
    </Panel>
  )
}

/**
 * The form's one commit, pinned to the foot of the pane so it is in reach
 * from any row, and saying whether there is anything to commit.
 */
export function SaveBar({
  children,
  dirty,
}: {
  children: ReactNode
  dirty: boolean
}) {
  const { t } = useTranslation(['settings'])

  return (
    <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg bg-card/95 px-5 py-3 shadow-lg backdrop-blur-sm">
      <p
        className={cn(
          'flex flex-1 items-center gap-2 text-ui',
          dirty ? 'text-warning' : 'text-muted-foreground'
        )}
        role="status"
      >
        <StatusDot tone={dirty ? 'warning' : 'idle'} />
        {dirty
          ? t('app-settings.form.save.dirty')
          : t('app-settings.form.save.clean')}
      </p>
      <Button type="submit">{children}</Button>
    </div>
  )
}
