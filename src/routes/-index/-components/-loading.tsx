import { Skeleton } from '../../../components/ui/skeleton'

import { missionCardClassName, missionFrameClassName } from './-missions'

import { cn } from '../../../lib/utils'

const defaultTotal = 3

export function LoadingMissions({
  section,
  showTitle,
  total = defaultTotal,
}: {
  section?: boolean
  showTitle?: boolean
  total?: number
}) {
  if (!section) {
    return (
      <div className="grid grid-cols-1 gap-1.5">
        <MissionSkeleton total={total} />
      </div>
    )
  }

  return (
    <div>
      {/*
        The heading's own silhouette, not a lozenge: a taller placeholder pops
        the whole list up by a few pixels the moment the real heading arrives.
      */}
      {showTitle && (
        <div className="flex items-center gap-2.5 py-2.5">
          <Skeleton className="h-3 w-24 rounded-full" />
          <span
            aria-hidden
            className="h-px flex-1 bg-border/40"
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5">
        <MissionSkeleton total={total} />
      </div>
    </div>
  )
}

/**
 * The brief's geometry with nothing in it. Built from the row's own two class
 * constants and its six columns, so a resolved page lands exactly where the
 * ghost was standing.
 */
function MissionSkeleton({ total = defaultTotal }: { total?: number }) {
  return Array.from({ length: total > 0 ? total : defaultTotal }).map(
    (_, index) => (
      /*
       * 80ms is the app's control-transition unit; the delay cascades into the
       * descendant Skeletons' own pulse, which is the entire stagger.
       */
      <div
        className={missionFrameClassName}
        key={index}
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <span aria-hidden />

        <div className={cn(missionCardClassName, 'bg-card/50')}>
          <div
            aria-hidden
            className="h-full w-full bg-muted"
          />
          <div className="flex items-center justify-center border-r border-border/50">
            <Skeleton className="size-5 rounded" />
          </div>
          <div className="flex min-w-0 items-center gap-3 overflow-hidden py-2.5 pl-3 pr-2 compact:gap-2 compact:pl-2">
            <Skeleton className="size-9 shrink-0 rounded-lg compact:size-8" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-40 max-w-full rounded" />
              <Skeleton className="h-2.5 w-28 max-w-full rounded" />
            </div>
          </div>
          <div className="flex flex-col items-end justify-center gap-1.5 border-l border-border/40 px-3 compact:px-1.5">
            <Skeleton className="h-5 w-8 rounded" />
            <Skeleton className="h-[2px] w-9 rounded-full" />
          </div>
          {/*
            Never tinted: the bay's alert colour and a reward's rarity are both
            facts about data that has not arrived yet.

            The text bars go where the real bay's name and rarity caption go,
            so they leave with them on a compact shell.
          */}
          <div className="flex items-center gap-2.5 border-l border-border/40 bg-muted/20 px-2.5 compact:px-2">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 compact:hidden">
              <Skeleton className="h-4 w-10 rounded" />
              <Skeleton className="h-2.5 w-full rounded" />
            </div>
          </div>
          <span aria-hidden />
        </div>

        <span aria-hidden />
      </div>
    )
  )
}

/** The totals ledger's ghost, so the summary panel holds its space during a fetch. */
export function LoadingRewardsSummary({ total = 6 }: { total?: number }) {
  return (
    <div className="panel overflow-hidden">
      <ul className="grid grid-cols-1 gap-x-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: total }).map((_, index) => (
          <li
            className="flex items-center gap-3 border-b border-border/40 py-2 last:border-b-0"
            key={index}
          >
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <Skeleton className="h-3 w-32 max-w-full rounded" />
            <Skeleton className="ml-auto h-3 w-10 shrink-0 rounded" />
          </li>
        ))}
      </ul>
    </div>
  )
}
