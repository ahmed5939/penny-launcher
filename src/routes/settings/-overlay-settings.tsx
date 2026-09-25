import type { OverlaySettings } from '../../types/settings'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { FieldRow, Kbd, Segmented } from '../../components/page'

import { overlaySettingsSchema } from '../../lib/validations/schemas/settings'
import { toast } from '../../lib/notifications'
import { cn } from '../../lib/utils'
import { useSettingsStore } from '../../state/settings/main'

import { SaveBar, SettingsSection } from './-section'

const detailToggles = [
  ['includeSquadMembers', 'squad-members'],
  ['showMission', 'mission'],
  ['showVentures', 'ventures-level'],
  ['showQuestDescriptions', 'descriptions'],
  ['showQuestProgress', 'progress'],
] as const

const questGroupToggles = [
  ['daily', 'daily'],
  ['ventures', 'ventures'],
  ['weekly', 'weekly'],
  ['stormShield', 'storm-shield'],
  ['wargames', 'wargames'],
  ['dungeons', 'dungeons'],
  ['endurance', 'endurance'],
  ['active', 'active'],
] as const

const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const scales = ['compact', 'normal', 'large'] as const

export function OverlaySettingsForm() {
  const { t } = useTranslation(['settings', 'general'])
  const overlay = useSettingsStore((state) => state.overlay)
  const form = useForm<OverlaySettings>({
    resolver: zodResolver(overlaySettingsSchema),
    values: overlay,
  })
  const enabled = form.watch('enabled')

  const onSubmit = (nextOverlay: OverlaySettings) => {
    const current = useSettingsStore.getState()

    window.electronAPI.updateSettings({
      autoDailyQuests: current.autoDailyQuests,
      claimingRewards: current.claimingRewards,
      customProcess: current.customProcess,
      missionInterval: current.missionInterval,
      path: current.path,
      systemTray: current.systemTray,
      discordRichPresence: current.discordRichPresence,
      overlay: nextOverlay,
      userAgent: current.userAgent,
    })
    toast.success(t('form.submit.status.success'))
  }

  return (
    <Form {...form}>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <SettingsSection title={t('overlay.title')}>
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FieldRow
                hint={
                  <>
                    {t('overlay.form.enabled.note')}{' '}
                    <span className="whitespace-nowrap">
                      <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd> <Kbd>Q</Kbd>.
                    </span>
                  </>
                }
                label={t('overlay.form.enabled.label')}
              >
                <FormItem>
                  <FormControl>
                    <Switch
                      aria-label={t('overlay.form.enabled.label')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              </FieldRow>
            )}
          />
        </SettingsSection>

        {/*
          Everything below only matters with the overlay on; it stays visible
          so the choices can be made first, but reads as parked.
        */}
        <fieldset
          className={cn('space-y-5 transition-opacity', !enabled && 'opacity-60')}
          disabled={!enabled}
        >
          <SettingsSection title={t('overlay.form.sections.look')}>
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FieldRow label={t('overlay.form.position.label')}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger
                        aria-label={t('overlay.form.position.label')}
                        className="w-44"
                      >
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {positions.map((position) => (
                        <SelectItem key={position} value={position}>
                          {t(`overlay.form.position.options.${position}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}
            />
            <FormField
              control={form.control}
              name="scale"
              render={({ field }) => (
                <FieldRow label={t('overlay.form.scale.label')}>
                  <Segmented
                    onChange={field.onChange}
                    options={scales.map((scale) => ({
                      disabled: !enabled,
                      label: t(`overlay.form.scale.options.${scale}`),
                      value: scale,
                    }))}
                    value={field.value}
                  />
                </FieldRow>
              )}
            />
            <NumberRow
              control={form.control}
              hint="50–100"
              label={t('overlay.form.opacity.label')}
              max={100}
              min={50}
              name="opacity"
              unit="%"
            />
          </SettingsSection>

          <SettingsSection title={t('overlay.form.sections.content')}>
            <NumberRow
              control={form.control}
              hint={t('overlay.form.refresh.note')}
              label={t('overlay.form.refresh.label')}
              max={30}
              min={1}
              name="refreshMinutes"
              unit="min"
            />
            <NumberRow
              control={form.control}
              hint="1–4"
              label={t('overlay.form.players.label')}
              max={4}
              min={1}
              name="maximumPlayers"
            />
            <NumberRow
              control={form.control}
              hint="1–30"
              label={t('overlay.form.quests.label')}
              max={30}
              min={1}
              name="maximumQuestsPerPlayer"
            />
            <FieldRow label={t('overlay.form.details.title')} stacked>
              <ToggleGrid
                control={form.control}
                items={detailToggles}
                translationPrefix="overlay.form.details.options"
              />
            </FieldRow>
            <FieldRow label={t('overlay.form.groups.title')} stacked>
              <ToggleGrid
                control={form.control}
                items={questGroupToggles.map(([name, label]) => [`questGroups.${name}`, label] as const)}
                translationPrefix="overlay.form.groups.options"
              />
            </FieldRow>
          </SettingsSection>
        </fieldset>

        <SaveBar dirty={form.formState.isDirty}>
          {t('app-settings.form.save.submit')}
        </SaveBar>
      </form>
    </Form>
  )
}

type OverlayFieldControl = ReturnType<typeof useForm<OverlaySettings>>['control']

function NumberRow({ control, hint, label, max, min, name, unit }: {
  control: OverlayFieldControl
  hint?: string
  label: string
  max: number
  min: number
  name: 'opacity' | 'refreshMinutes' | 'maximumPlayers' | 'maximumQuestsPerPlayer'
  unit?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FieldRow hint={hint} label={label}>
          <FormItem className="flex flex-col items-end space-y-1">
            <div className="relative">
              <FormControl>
                <Input
                  aria-label={label}
                  className={cn('figure w-24 text-right', unit && 'pr-10')}
                  max={max}
                  min={min}
                  type="number"
                  value={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
                />
              </FormControl>
              {unit && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                >
                  {unit}
                </span>
              )}
            </div>
            <FormMessage className="max-w-64 text-right" />
          </FormItem>
        </FieldRow>
      )}
    />
  )
}

/** Switches in two columns, each a label-left / switch-right line. */
function ToggleGrid({ control, items, translationPrefix }: {
  control: OverlayFieldControl
  items: ReadonlyArray<readonly [
    | 'includeSquadMembers'
    | 'showMission'
    | 'showVentures'
    | 'showQuestDescriptions'
    | 'showQuestProgress'
    | `questGroups.${keyof OverlaySettings['questGroups']}`,
    string,
  ]>
  translationPrefix: string
}) {
  const { t } = useTranslation('settings')

  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      {items.map(([name, label]) => (
        <FormField
          control={control}
          key={name}
          name={name}
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-3 space-y-0 border-b border-border/30 py-2">
              <span className="text-ui text-muted-foreground">
                {t(`${translationPrefix}.${label}`)}
              </span>
              <FormControl>
                <Switch
                  aria-label={t(`${translationPrefix}.${label}`)}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      ))}
    </div>
  )
}
