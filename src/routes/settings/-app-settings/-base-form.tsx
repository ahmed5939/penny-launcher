import type { ReactNode } from 'react'

import { FolderOpen, ScanSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  claimingRewardsDelayRange,
  defaultClaimingRewardsDelay,
} from '../../../config/constants/mcp'
import {
  defaultMissionInterval,
  missionIntervalRange,
} from '../../../config/constants/automation'

import { FieldRow, StatusDot } from '../../../components/page'
import { Button } from '../../../components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../../components/ui/form'
import { Input } from '../../../components/ui/input'
import { Switch } from '../../../components/ui/switch'

import { useGameInstall } from '../../../hooks/game-install'
import { useSetupForm } from '../-hooks'
import { SaveBar, SettingsSection } from '../-section'

import { cn } from '../../../lib/utils'

/**
 * The saved app settings: where the game lives, how automation paces itself,
 * and how the window behaves. Theme and language apply as you pick them;
 * everything here is written together by the save bar at the foot.
 */
export function AppSettingsBaseForm() {
  const { t } = useTranslation(['settings', 'general'])

  const { form, onChooseFolder, onDetectPath, onSubmit } = useSetupForm()
  const { status } = useGameInstall()
  const isDirty = form.formState.isDirty
  const path = form.watch('path')
  const pathChecked = status !== null && status.configuredPath === path

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <SettingsSection title={t('app-settings.form.sections.game')}>
          <FormField
            control={form.control}
            name="path"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.path.note')}
                label={t('app-settings.form.path.label')}
                stacked
              >
                <FormItem className="space-y-1.5">
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={t('app-settings.form.path.label')}
                        className="min-w-0 flex-1"
                        id="path"
                        spellCheck={false}
                      />
                    </FormControl>
                    <Button
                      onClick={onDetectPath}
                      type="button"
                      variant="secondary"
                    >
                      <ScanSearch className="size-4" />
                      {t('general:actions.detect')}
                    </Button>
                    <Button
                      onClick={onChooseFolder}
                      type="button"
                      variant="secondary"
                    >
                      <FolderOpen className="size-4" />
                      {t('app-settings.form.path.browse')}
                    </Button>
                  </div>
                  {pathChecked && (
                    <p
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        status.configuredPathValid
                          ? 'text-success'
                          : 'text-warning'
                      )}
                    >
                      <StatusDot
                        tone={status.configuredPathValid ? 'active' : 'warning'}
                      />
                      {status.configuredPathValid
                        ? t('app-settings.form.path.found')
                        : t('app-settings.form.path.missing')}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              </FieldRow>
            )}
          />
          <FormField
            control={form.control}
            name="customProcess"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.custom-process.note')}
                label={t('app-settings.form.custom-process.label')}
              >
                <RowControl>
                  <FormControl>
                    <Input
                      {...field}
                      aria-label={t('app-settings.form.custom-process.label')}
                      className="w-64"
                      spellCheck={false}
                    />
                  </FormControl>
                </RowControl>
              </FieldRow>
            )}
          />
          <FormField
            control={form.control}
            name="userAgent"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.user-agent.note')}
                label={t('app-settings.form.user-agent.label')}
                stacked
              >
                <FormItem className="space-y-1.5">
                  <FormControl>
                    <Input
                      {...field}
                      aria-label={t('app-settings.form.user-agent.label')}
                      className="font-mono text-xs"
                      spellCheck={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FieldRow>
            )}
          />
        </SettingsSection>

        <SettingsSection title={t('app-settings.form.sections.automation')}>
          <FormField
            control={form.control}
            name="missionInterval"
            render={({ field }) => (
              <FieldRow
                hint={
                  <>
                    {t('app-settings.form.mission-interval.note1')}{' '}
                    {t('app-settings.form.mission-interval.note2', {
                      min: missionIntervalRange.min,
                      max: missionIntervalRange.max,
                      default: defaultMissionInterval,
                    })}
                  </>
                }
                label={t('app-settings.form.mission-interval.label')}
              >
                <RowControl>
                  <SecondsInput>
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={t('app-settings.form.mission-interval.label')}
                        className="figure w-20 pr-7 text-right"
                        inputMode="numeric"
                        placeholder={t(
                          'app-settings.form.mission-interval.input.placeholder',
                        )}
                        onChange={(event) => {
                          form.setValue(
                            'missionInterval',
                            event.target.value.replace(/[^0-9]+/gi, ''),
                            { shouldDirty: true },
                          )
                        }}
                      />
                    </FormControl>
                  </SecondsInput>
                </RowControl>
              </FieldRow>
            )}
          />
          <FormField
            control={form.control}
            name="claimingRewards"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.claiming-rewards.note', {
                  min: claimingRewardsDelayRange.min,
                  max: claimingRewardsDelayRange.max,
                  default: defaultClaimingRewardsDelay,
                })}
                label={t('app-settings.form.claiming-rewards.label')}
              >
                <RowControl>
                  <SecondsInput>
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={t('app-settings.form.claiming-rewards.label')}
                        className="figure w-20 pr-7 text-right"
                        inputMode="decimal"
                        placeholder={t(
                          'app-settings.form.claiming-rewards.input.placeholder',
                        )}
                        onChange={(event) => {
                          form.setValue(
                            'claimingRewards',
                            event.target.value.replace(/[^0-9.]+/gi, ''),
                            { shouldDirty: true },
                          )
                        }}
                      />
                    </FormControl>
                  </SecondsInput>
                </RowControl>
              </FieldRow>
            )}
          />
        </SettingsSection>

        <SettingsSection title={t('app-settings.form.sections.window')}>
          <FormField
            control={form.control}
            name="systemTray"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.tray.note')}
                label={t('app-settings.form.tray.label')}
              >
                <FormItem>
                  <FormControl>
                    <Switch
                      aria-label={t('app-settings.form.tray.label')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              </FieldRow>
            )}
          />
          <FormField
            control={form.control}
            name="discordRichPresence"
            render={({ field }) => (
              <FieldRow
                hint={t('app-settings.form.discord-rpc.note')}
                label={t('app-settings.form.discord-rpc.label')}
              >
                <FormItem>
                  <FormControl>
                    <Switch
                      aria-label={t('app-settings.form.discord-rpc.label')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              </FieldRow>
            )}
          />
        </SettingsSection>

        <SaveBar dirty={isDirty}>
          {t('app-settings.form.save.submit')}
        </SaveBar>
      </form>
    </Form>
  )
}

/** The right-hand control with its validation message under it. */
function RowControl({ children }: { children: ReactNode }) {
  return (
    <FormItem className="flex flex-col items-end space-y-1">
      {children}
      <FormMessage className="max-w-64 text-right" />
    </FormItem>
  )
}

/** A short number input with its unit inside the right edge. */
function SecondsInput({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
      >
        s
      </span>
    </div>
  )
}
