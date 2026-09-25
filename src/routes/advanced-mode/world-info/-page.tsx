import type { WorldInfoFileData } from '../../../types/data/advanced-mode/world-info'

import {
  Eye,
  FileJson,
  FileWarning,
  Globe,
  LoaderCircle,
  Save,
  Share,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LoadWorldInfoFiles } from '../../../bootstrap/components/advanced-mode/load-world-info-files'
import { LoadWorldInfoData } from '../../../bootstrap/components/advanced-mode/load-world-info'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { GoToTop } from '../../../components/go-to-top'
import {
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  PanelHeader,
  RefreshButton,
  SearchField,
  StatusDot,
} from '../../../components/page'
import {
  useCurrentActions,
  useData,
  useItemData,
  useSearch,
} from './-hooks'

import {
  getDateWithFormat,
  getShortDateFormat,
  relativeTime,
} from '../../../lib/dates'
import { cn } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'advanced-mode'])

  return (
    <>
      <LoadWorldInfoData />
      <PageHeader
        description={t('advanced-mode:world-info.description')}
        icon={Globe}
        section={t('sidebar:advanced-mode.title')}
        title={t('sidebar:advanced-mode.options.world-info')}
      />

      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['advanced-mode', 'general'])

  const { currentData, files, isFetching, isSaving } = useData()
  const { handleRefetch, handleSave } = useCurrentActions()
  const {
    filteredFiles,
    searchValue,
    onChangeSearchValue,
  } = useSearch({
    files,
  })

  const loaded = !isFetching && Boolean(currentData.value)

  return (
    <>
      <LoadWorldInfoFiles />

      {/*
        The live snapshot: what state it is in and its two actions on one
        line, so the page opens on the thing you came to do.
      */}
      <Panel
        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
        id="form-current-world-info-container"
      >
        <Globe className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-title font-semibold leading-tight">
            {t('world-info.current.title')}
          </p>
          <p
            className={cn(
              'mt-1 flex items-center gap-2 text-xs',
              loaded ? 'text-success' : 'text-muted-foreground'
            )}
          >
            <StatusDot
              pulse={isFetching}
              tone={loaded ? 'active' : isFetching ? 'warning' : 'idle'}
            />
            {isFetching
              ? t('world-info.current.fetching')
              : currentData.value
                ? t('world-info.current.loaded', { date: currentData.date })
                : t('world-info.current.empty')}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <RefreshButton
            disabled={isSaving}
            label={t('world-info.form.refetch')}
            loading={isFetching}
            onClick={handleRefetch}
          />
          <Button
            type="button"
            onClick={handleSave(currentData.date)}
            disabled={isFetching || !currentData.value || isSaving}
          >
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t('world-info.form.save')}
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          actions={
            files.length > 0 ? (
              <span className="figure text-xs text-muted-foreground">
                {files.length}
              </span>
            ) : undefined
          }
          compact
          title={t('world-info.files.title')}
        />
        {files.length > 1 && (
          <FilterBar>
            <SearchField
              className="max-w-md"
              label="Search saved files"
              onChange={onChangeSearchValue}
              placeholder={t('world-info.search.input.placeholder', {
                total: files.length,
              })}
              value={searchValue}
            />
          </FilterBar>
        )}
        {filteredFiles.length > 0 ? (
          <ul className="divide-y divide-border/30">
            {filteredFiles.map((data) => (
              <Item
                data={data}
                key={data.id}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            icon={FileWarning}
            title={t('world-info.search.no-files')}
          />
        )}
      </Panel>

      <GoToTop containerId="form-current-world-info-container" />
    </>
  )
}

/**
 * One saved snapshot: its name, editable in place, with when it was taken
 * under it and the file actions at the end of the line.
 */
function Item({ data }: { data: WorldInfoFileData }) {
  const { t } = useTranslation(['advanced-mode', 'general'])

  const {
    handleDeleteFile,
    handleExportFile,
    handleOpenFile,
    handleUpdateName,
    name,
    onSubmit,
    validName,
  } = useItemData({ data })

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <FileJson className="size-5 shrink-0 text-muted-foreground" />
      <form
        className="flex min-w-0 flex-1 basis-72 items-center gap-2"
        onSubmit={onSubmit}
      >
        <div className="min-w-0 flex-1">
          <Input
            aria-label="File name"
            className="h-8 border-transparent bg-transparent px-2 text-ui font-medium hover:border-input focus-visible:border-input"
            placeholder={t('world-info.file.input.placeholder', {
              filename: getDateWithFormat(
                data.date,
                'YYYY-MM-DD HH[h] m[m] s[s]'
              ),
            })}
            value={name}
            onChange={handleUpdateName}
          />
          <p className="px-2 text-xs text-muted-foreground">
            {getShortDateFormat(data.date)} · {relativeTime(data.createdAt)}
          </p>
        </div>
        <Button
          className="shrink-0"
          size="sm"
          type="submit"
          variant="secondary"
        >
          {validName
            ? t('actions.update', {
                ns: 'general',
              })
            : t('actions.revert', {
                ns: 'general',
              })}
        </Button>
      </form>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          aria-label="Open file"
          className="size-8"
          onClick={handleOpenFile}
          size="icon"
          title="Open"
          type="button"
          variant="ghost"
        >
          <Eye className="size-4" />
        </Button>
        <Button
          aria-label="Export file"
          className="size-8"
          onClick={handleExportFile}
          size="icon"
          title="Export"
          type="button"
          variant="ghost"
        >
          <Share className="size-4" />
        </Button>
        <Button
          aria-label="Delete file"
          className="size-8 text-destructive/70 hover:text-destructive"
          onClick={handleDeleteFile}
          size="icon"
          title="Delete"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
