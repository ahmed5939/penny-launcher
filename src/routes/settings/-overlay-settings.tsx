import type { OverlaySettings } from '../../types/settings'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { Panel, PanelBody } from '../../components/page'

import { overlaySettingsSchema } from '../../lib/validations/schemas/settings'
import { toast } from '../../lib/notifications'
import { useSettingsStore } from '../../state/settings/main'

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
    toast(t('form.submit.status.success'))
  }

  return (
    <Panel>
      <PanelBody>
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-start space-y-0">
                  <div className="pr-4">
                    <FormLabel>{t('overlay.form.enabled.label')}</FormLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('overlay.form.enabled.note')}
                    </p>
                  </div>
                  <FormControl className="ml-auto">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <fieldset className="space-y-6" disabled={!enabled}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('overlay.form.position.label')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((position) => (
                            <SelectItem key={position} value={position}>
                              {t(`overlay.form.position.options.${position}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('overlay.form.scale.label')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {['compact', 'normal', 'large'].map((scale) => (
                            <SelectItem key={scale} value={scale}>
                              {t(`overlay.form.scale.options.${scale}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <NumberField
                  control={form.control}
                  label={t('overlay.form.opacity.label')}
                  max={100}
                  min={50}
                  name="opacity"
                  suffix="%"
                />
                <NumberField
                  control={form.control}
                  label={t('overlay.form.refresh.label')}
                  max={30}
                  min={1}
                  name="refreshMinutes"
                />
                <NumberField
                  control={form.control}
                  label={t('overlay.form.players.label')}
                  max={4}
                  min={1}
                  name="maximumPlayers"
                />
                <NumberField
                  control={form.control}
                  label={t('overlay.form.quests.label')}
                  max={30}
                  min={1}
                  name="maximumQuestsPerPlayer"
                />
              </div>

              <ToggleGroup
                control={form.control}
                items={detailToggles}
                title={t('overlay.form.details.title')}
                translationPrefix="overlay.form.details.options"
              />
              <ToggleGroup
                control={form.control}
                items={questGroupToggles.map(([name, label]) => [`questGroups.${name}`, label] as const)}
                title={t('overlay.form.groups.title')}
                translationPrefix="overlay.form.groups.options"
              />
            </fieldset>

            <Button className="w-full" type="submit">
              {t('update-information', { ns: 'general' })}
            </Button>
          </form>
        </Form>
      </PanelBody>
    </Panel>
  )
}

type OverlayFieldControl = ReturnType<typeof useForm<OverlaySettings>>['control']

function NumberField({ control, label, max, min, name, suffix }: {
  control: OverlayFieldControl
  label: string
  max: number
  min: number
  name: 'opacity' | 'refreshMinutes' | 'maximumPlayers' | 'maximumQuestsPerPlayer'
  suffix?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              max={max}
              min={min}
              type="number"
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
            />
          </FormControl>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function ToggleGroup({ control, items, title, translationPrefix }: {
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
  title: string
  translationPrefix: string
}) {
  const { t } = useTranslation('settings')

  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map(([name, label]) => (
          <FormField
            control={control}
            key={name}
            name={name}
            render={({ field }) => (
              <FormItem className="flex items-center rounded-lg border border-border/60 px-3 py-2 space-y-0">
                <FormLabel>{t(`${translationPrefix}.${label}`)}</FormLabel>
                <FormControl className="ml-auto">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  )
}
