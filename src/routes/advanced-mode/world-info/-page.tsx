import type { WorldInfoFileData } from '../../../types/data/advanced-mode/world-info'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  CloudDownload,
  Eye,
  FileJson,
  FileSearch2,
  FileWarning,
  Globe,
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
  PageHeader,
  Panel,
} from '../../../components/page'

import { useInputPaddingButton } from '../../../hooks/ui/inputs'
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

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'advanced-mode',
  })

  return (
    <>
      <LoadWorldInfoData />
      <PageHeader
        icon={Globe}
        section={t('title')}
        title={t('options.world-info')}
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
    // includeFileData,
    searchValue,
    onChangeSearchValue,
    // setIncludeFileData,
  } = useSearch({
    files,
  })

  const StatusIcon =
    !isFetching && currentData.value
      ? FileJson
      : isFetching
        ? FileSearch2
        : FileWarning

  return (
    <>
      <LoadWorldInfoFiles />

      {/*
        The current snapshot used to be a 20rem two-column box centred on the
        page. As a full-width bar it puts the state and its two actions on
        one line and stops competing with the file list for attention.
      */}
      <Panel
        className="flex flex-wrap items-center gap-4 p-4"
        id="form-current-world-info-container"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
          <StatusIcon size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('current', {
              ns: 'general',
            })}
          </p>
          <p className="mt-0.5 text-base font-bold leading-tight">
            {currentData.value ? currentData.date : 'N/A'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={handleSave(currentData.date)}
            disabled={isFetching || !currentData.value || isSaving}
          >
            {isSaving ? (
              <UpdateIcon className="animate-spin h-4" />
            ) : (
              <>
                <Save size={16} />
                {t('world-info.form.save')}
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={handleRefetch}
            disabled={isFetching || isSaving}
          >
            {isFetching ? (
              <UpdateIcon className="animate-spin h-4" />
            ) : (
              <>
                <CloudDownload size={16} />
                {t('world-info.form.refetch')}
              </>
            )}
          </Button>
        </div>
      </Panel>

      {files.length > 0 ? (
        <>
          {files.length > 1 && (
            <Input
              className="max-w-md"
              placeholder={t('world-info.search.input.placeholder', {
                total: files.length,
              })}
              value={searchValue}
              onChange={onChangeSearchValue}
            />
          )}

          {filteredFiles.length > 0 ? (
            <div className="grid gap-2">
              {filteredFiles.map((data) => (
                <Item
                  data={data}
                  key={data.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileWarning}
              title={t('world-info.search.no-files')}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={FileWarning}
          title={t('world-info.search.no-files')}
        />
      )}

      <GoToTop containerId="form-current-world-info-container" />
    </>
  )
}

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

  const [$updateInput, $updateButton] = useInputPaddingButton({
    deps: [validName],
  })

  return (
    <Panel>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileJson
          className="shrink-0 stroke-muted-foreground"
          size={22}
        />
        <form
          className="relative flex flex-grow items-center"
          onSubmit={onSubmit}
        >
          <Input
            className="h-9 pl-3 pr-[var(--pr-button-width)]"
            placeholder={t('world-info.file.input.placeholder', {
              filename: getDateWithFormat(
                data.date,
                'YYYY-MM-DD HH[h] m[m] s[s]'
              ),
            })}
            value={name}
            onChange={handleUpdateName}
            ref={$updateInput}
          />
          <Button
            type="submit"
            variant="secondary"
            className="absolute right-1 h-7 w-auto px-2 py-0.5 text-xs"
            ref={$updateButton}
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
      </div>

      <footer className="flex items-center gap-2 border-t border-border/60 bg-surface/60 px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          {getShortDateFormat(data.date)}
          <span className="ml-1 italic">
            ({relativeTime(data.createdAt)})
          </span>
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={handleOpenFile}
          >
            <Eye size={16} />
            <span className="sr-only">open file</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={handleExportFile}
          >
            <Share size={16} />
            <span className="sr-only">export file</span>
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-destructive/60 hover:text-destructive"
            onClick={handleDeleteFile}
          >
            <Trash2 size={16} />
            <span className="sr-only">remove file</span>
          </Button>
        </div>
      </footer>
    </Panel>
  )
}
