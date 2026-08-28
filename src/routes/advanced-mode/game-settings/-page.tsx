import type { ReactNode } from 'react'

import { Monitor, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  frameRateLimitRange,
  resolutionQualityRange,
  resolutionRange,
} from '../../../config/fortnite/game-settings'

import { Button } from '../../../components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../components/ui/form'
import { Input } from '../../../components/ui/input'
import { Skeleton } from '../../../components/ui/skeleton'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  Chip,
  FieldGroup,
  FieldRow,
  KeyValue,
  PageHeader,
  Panel,
  PanelBody,
  PanelSectionHeader,
  Segmented,
  StatusPill,
} from '../../../components/page'

import { useDisplayResolution, useGameUserSettings } from './-hooks'

import { cn } from '../../../lib/utils'

const resolutionPresets = [
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
] as const

/** 0 keeps the game uncapped, which is what its own "unlimited" writes. */
const frameRatePresets = [0, 30, 60, 120, 144, 240] as const

const digitsOnly = (value: string) => value.replace(/[^0-9]+/g, '')

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}

function aspectRatio(width: number, height: number) {
  if (!width || !height) {
    return null
  }

  const divisor = greatestCommonDivisor(width, height)
  const ratio = `${width / divisor}:${height / divisor}`

  // 1366×768 reduces to 683:384, which tells nobody anything.
  return ratio.length > 7 ? `${(width / height).toFixed(2)}:1` : ratio
}

/**
 * A preset that fills in a field rather than saving anything. Reads as a
 * suggestion, not a control with its own state — pressed, it just types into
 * the input beside it.
 */
function PresetButton({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-border/70 text-muted-foreground hover:text-foreground'
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'advanced-mode'])

  return (
    <>
      <PageHeader
        description={t('advanced-mode:game-settings.description')}
        icon={Monitor}
        section={t('sidebar:advanced-mode.title')}
        title={t('sidebar:advanced-mode.options.game-settings')}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['advanced-mode'], {
    keyPrefix: 'game-settings',
  })

  const display = useDisplayResolution()
  const {
    backup,
    error,
    form,
    gameRunning,
    iniPath,
    loading,
    onRestore,
    onSubmit,
    reload,
    saving,
  } = useGameUserSettings()

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (error) {
    return (
      <Panel>
        <PanelBody className="space-y-4">
          <Callout
            title={t('missing.title')}
            tone="warning"
          >
            <p>{error}</p>
            <p className="mt-1">{t('missing.note')}</p>
          </Callout>
          <Button
            onClick={() => void reload()}
            type="button"
            variant="outline"
          >
            {t('actions.reload')}
          </Button>
        </PanelBody>
      </Panel>
    )
  }

  const values = form.watch()
  const ratio = aspectRatio(
    Number(values.resolutionX),
    Number(values.resolutionY)
  )
  const isDirty = form.formState.isDirty

  const setResolution = (width: number, height: number) => {
    form.setValue('resolutionX', `${width}`, { shouldDirty: true })
    form.setValue('resolutionY', `${height}`, { shouldDirty: true })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {gameRunning && (
          <Callout
            className="mb-4"
            title={t('running.title')}
            tone="warning"
          >
            {t('running.note')}
          </Callout>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel>
              <PanelSectionHeader
                actions={ratio && <Chip>{ratio}</Chip>}
                title={t('sections.display')}
              />
              <PanelBody>
                <FieldGroup>
                  <FieldRow
                    hint={t('form.resolution.note', {
                      min: resolutionRange.min,
                      max: resolutionRange.max,
                    })}
                    label={t('form.resolution.label')}
                    stacked
                  >
                    <div className="flex items-start gap-2">
                      <FormField
                        control={form.control}
                        name="resolutionX"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input
                                {...field}
                                aria-label={t('form.resolution.width')}
                                className="w-24"
                                inputMode="numeric"
                                onChange={(event) =>
                                  field.onChange(digitsOnly(event.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <span className="pt-2 text-xs text-muted-foreground">
                        &times;
                      </span>
                      <FormField
                        control={form.control}
                        name="resolutionY"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input
                                {...field}
                                aria-label={t('form.resolution.height')}
                                className="w-24"
                                inputMode="numeric"
                                onChange={(event) =>
                                  field.onChange(digitsOnly(event.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <PresetButton
                        active={
                          values.resolutionX === `${display.width}` &&
                          values.resolutionY === `${display.height}`
                        }
                        onClick={() =>
                          setResolution(display.width, display.height)
                        }
                      >
                        {t('form.resolution.display-preset')} &middot;{' '}
                        {display.width}&times;{display.height}
                      </PresetButton>
                      {resolutionPresets.map((preset) => (
                        <PresetButton
                          active={
                            values.resolutionX === `${preset.width}` &&
                            values.resolutionY === `${preset.height}`
                          }
                          key={`${preset.width}x${preset.height}`}
                          onClick={() =>
                            setResolution(preset.width, preset.height)
                          }
                        >
                          {preset.width}&times;{preset.height}
                        </PresetButton>
                      ))}
                    </div>
                  </FieldRow>

                  <FormField
                    control={form.control}
                    name="fullscreenMode"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FieldRow
                          hint={t('form.fullscreen-mode.note')}
                          label={
                            <FormLabel>
                              {t('form.fullscreen-mode.label')}
                            </FormLabel>
                          }
                        >
                          <Segmented
                            onChange={field.onChange}
                            options={[
                              {
                                label: t('form.fullscreen-mode.options.0'),
                                value: '0',
                              },
                              {
                                label: t('form.fullscreen-mode.options.1'),
                                value: '1',
                              },
                              {
                                label: t('form.fullscreen-mode.options.2'),
                                value: '2',
                              },
                            ]}
                            value={field.value}
                          />
                        </FieldRow>
                      </FormItem>
                    )}
                  />
                </FieldGroup>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelSectionHeader title={t('sections.performance')} />
              <PanelBody>
                <FieldGroup>
                  <FormField
                    control={form.control}
                    name="vsync"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FieldRow
                          hint={t('form.vsync.note')}
                          label={<FormLabel>{t('form.vsync.label')}</FormLabel>}
                        >
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FieldRow>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="frameRateLimit"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FieldRow
                          hint={t('form.frame-rate-limit.note', {
                            max: frameRateLimitRange.max,
                          })}
                          label={
                            <FormLabel>
                              {t('form.frame-rate-limit.label')}
                            </FormLabel>
                          }
                          stacked
                        >
                          <div className="flex flex-wrap items-start gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                className="w-24"
                                inputMode="numeric"
                                onChange={(event) =>
                                  field.onChange(digitsOnly(event.target.value))
                                }
                              />
                            </FormControl>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {frameRatePresets.map((preset) => (
                                <PresetButton
                                  active={field.value === `${preset}`}
                                  key={preset}
                                  onClick={() =>
                                    field.onChange(`${preset}`)
                                  }
                                >
                                  {preset === 0
                                    ? t('form.frame-rate-limit.unlimited')
                                    : preset}
                                </PresetButton>
                              ))}
                            </div>
                          </div>
                          <FormMessage />
                        </FieldRow>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="resolutionQuality"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FieldRow
                          hint={t('form.resolution-quality.note', {
                            value: field.value || resolutionQualityRange.max,
                          })}
                          label={
                            <FormLabel>
                              {t('form.resolution-quality.label')}
                            </FormLabel>
                          }
                          stacked
                        >
                          <div className="flex items-center gap-3">
                            <FormControl>
                              <input
                                className="flex-1 cursor-pointer accent-primary"
                                max={resolutionQualityRange.max}
                                min={resolutionQualityRange.min}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                step={1}
                                type="range"
                                value={
                                  field.value || `${resolutionQualityRange.max}`
                                }
                              />
                            </FormControl>
                            <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                              {field.value || resolutionQualityRange.max}%
                            </span>
                          </div>
                          <FormMessage />
                        </FieldRow>
                      </FormItem>
                    )}
                  />
                </FieldGroup>
              </PanelBody>
            </Panel>
          </div>

          <Panel className="h-fit">
            <PanelSectionHeader title={t('sections.file')} />
            <PanelBody className="space-y-4">
              <KeyValue
                copyable
                label={t('file.path')}
                value={
                  <span className="break-all font-mono text-xs">
                    {iniPath}
                  </span>
                }
              />
              <KeyValue
                label={t('file.backup.label')}
                value={
                  backup?.exists && backup.savedAt
                    ? t('file.backup.exists', {
                        date: new Date(backup.savedAt).toLocaleString(),
                      })
                    : t('file.backup.empty')
                }
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('file.backup.note')}
              </p>
              <Button
                className="w-full"
                disabled={saving || !backup?.exists}
                onClick={() => void onRestore()}
                type="button"
                variant="outline"
              >
                <RotateCcw className="mr-2 size-3.5" />
                {t('actions.restore')}
              </Button>
            </PanelBody>
          </Panel>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface/60 px-5 py-3.5">
          <Button
            disabled={saving || !isDirty}
            type="submit"
          >
            {t('actions.save')}
          </Button>
          <Button
            disabled={saving || !isDirty}
            onClick={() => form.reset()}
            type="button"
            variant="ghost"
          >
            {t('actions.discard')}
          </Button>
          {isDirty && (
            <StatusPill tone="warning">{t('dirty')}</StatusPill>
          )}
          <Button
            className="ml-auto"
            disabled={saving}
            onClick={() => void reload()}
            type="button"
            variant="ghost"
          >
            {t('actions.reload')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
