import type { FillPlan, SlotScore } from './-squad-model'
import type { FortStatKey } from '../../../config/constants/fortnite/fort'
import type { SquadDefinition } from '../../../config/constants/fortnite/squads'
import type {
  SquadAssignment,
  SquadSurvivor,
  SquadsPayload,
} from '../../../kernel/core/squads'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAccountResource } from '../../../components/page'

import { useAccountListStore } from '../../../state/accounts/list'
import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import {
  leadJobMatches,
  planAutoFill,
  rankCandidates,
  ratingOf,
  slotMapOf,
  slotScore,
  squadTotal,
} from './-squad-model'

import {
  squadAttributeStats,
  squadLeaderSlotIndex,
  squadSlotCount,
  survivorSquads,
} from '../../../config/constants/fortnite/squads'

import { toast } from '../../../lib/notifications'

export type DecoratedSurvivor = SquadSurvivor & {
  name: string
  /**
   * The second line on a row. For a rank-and-file survivor — whose name is
   * just "Survivor" — the name is its personality and this is its set bonus,
   * which is what the game's own squad screen tells them apart by.
   */
  caption: string | null
  /** Rating at its level, before any squad bonus. */
  power: number
}

export type SquadSlotView = {
  slotIndex: number
  survivor: DecoratedSurvivor | null
  /** What the occupant adds to F.O.R.T. here, bonus included. */
  score: SlotScore | null
  /** Support slots: whether the personality matches the lead's. Null without a lead. */
  matchesLead: boolean | null
  /** Lead slot: whether this squad is the one that doubles the lead's job. */
  matchesJob: boolean | null
}

export type SquadIssues = {
  empty: number
  /** Supports whose personality misses the lead's, so they lose its bonus. */
  mismatched: number
  /** The lead's job belongs to another squad, so it is not doubled. */
  wrongJob: boolean
}

export type SquadView = {
  id: string
  label: string
  attribute: SquadDefinition['attribute']
  stat: FortStatKey
  slots: Array<SquadSlotView>
  lead: DecoratedSurvivor | null
  /** What the squad adds to its F.O.R.T. stat. */
  total: number
  filled: number
  issues: SquadIssues
}

export function issueCount(issues: SquadIssues) {
  return issues.empty + issues.mismatched + Number(issues.wrongJob)
}

/** "Trap Durability High" → "Trap Durability": the tier is noise on a row. */
export function shortSetBonus(setBonus: string | null) {
  return setBonus?.replace(/\s+(Low|High)$/i, '') ?? null
}

/**
 * The name the game would show. Unique survivors and leads with a database
 * name keep it; generic ones are named by what distinguishes them — a lead
 * by its role ("Doctor"), a survivor by its personality ("Analytical").
 */
export function survivorLabels(
  survivor: SquadSurvivor,
  recordName: string | undefined
) {
  const generic = !recordName || /^(lead )?survivor$/i.test(recordName.trim())

  if (survivor.isLead) {
    return {
      name: generic
        ? (survivor.managerSynergy ?? 'Lead survivor')
        : (recordName as string),
      caption: survivor.personality,
    }
  }

  return generic
    ? {
        name: survivor.personality ?? 'Survivor',
        caption: shortSetBonus(survivor.setBonus),
      }
    : { name: recordName as string, caption: survivor.personality }
}

export type PendingSlot = { squadId: string; slotIndex: number }

/** How long a follow-up waits for the reply the main process sends by itself. */
const followTimeoutMs = 15_000

/** How long a move waits for its notification before the view gives up on it. */
const assignTimeoutMs = 30_000

/**
 * " (reason)" when the main process gives one. "Unknown Error" is only its
 * placeholder, so it is dropped.
 */
function failureReason(message: string | undefined) {
  return message && message !== 'Unknown Error' ? ` (${message})` : ''
}

/**
 * The squads IPC is fire-and-forget: a request goes out, the payload comes
 * back on its own channel. This turns one round trip into a promise for
 * `useAccountResource`.
 *
 * `follow` skips the request and waits for the reply the main process
 * already sends after an assignment, so a move costs one profile read rather
 * than two. If that reply never shows, it asks after all.
 */
function readSquads(accountId: string, follow: boolean) {
  const account = useAccountListStore.getState().accounts[accountId]

  if (!account) {
    return Promise.reject(
      new Error('This account is no longer in the launcher. Choose another.')
    )
  }

  return new Promise<SquadsPayload>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = window.electronAPI.responseSquads(async (response) => {
      if (response.accountId !== accountId) {
        return
      }

      clearTimeout(timer)
      listener.removeListener()

      if (response.errorMessage) {
        reject(
          new Error(
            `Could not read the squads${failureReason(response.errorMessage)}. Check the account is signed in, then try Refresh.`
          )
        )
      } else {
        resolve(response)
      }
    })

    if (follow) {
      timer = setTimeout(
        () => window.electronAPI.requestSquads(account),
        followTimeoutMs
      )
    } else {
      window.electronAPI.requestSquads(account)
    }
  })
}

export function useSquadsResource() {
  const followNext = useRef(false)
  const resource = useAccountResource(
    (accountId) => {
      const follow = followNext.current
      followNext.current = false

      return readSquads(accountId, follow)
    },
    {
      cacheKey: 'stw.squads',
      fallbackError: 'Could not read the squads. Try Refresh.',
      owner: (result) => result.accountId,
    }
  )
  const { refresh } = resource

  /** Pick up the fresh squads the main process sends after an assignment. */
  const followUp = useCallback(() => {
    followNext.current = true
    refresh()
  }, [refresh])

  return { followUp, resource }
}

/**
 * Everything the squads view does with one account's payload. Lives in the
 * child keyed by account id, so the open picker and the busy flag reset on
 * an account switch without any reset code.
 */
export function useSquads(payload: SquadsPayload, onAssigned: () => void) {
  const { selected } = useGetSelectedAccount()

  const records = useItemDatabaseStore((state) => state.records)

  const [isAssigning, setAssigning] = useState(false)
  const assignWatchdog = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  /** The slot waiting for a survivor to be picked for it. */
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null)
  /** An auto-fill shown for approval before anything moves. */
  const [fill, setFill] = useState<{
    squadIds: Array<string>
    plan: FillPlan<DecoratedSurvivor>
  } | null>(null)

  useEffect(() => {
    const listener = window.electronAPI.notificationSquadsAssign(
      async (response) => {
        if (response.accountId !== payload.accountId) {
          return
        }

        clearTimeout(assignWatchdog.current)
        setAssigning(false)
        setPendingSlot(null)
        setFill(null)

        toast[response.errorMessage ? 'error' : 'success'](
          response.errorMessage
            ? `Could not move survivors${failureReason(response.errorMessage)}. Refresh to see where they are, then try again.`
            : 'Squads updated'
        )

        onAssigned()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [onAssigned, payload.accountId])

  useEffect(() => {
    return () => {
      clearTimeout(assignWatchdog.current)
    }
  }, [])

  const decorated: Array<DecoratedSurvivor> = useMemo(
    () =>
      payload.survivors.map((survivor) => ({
        ...survivor,
        ...survivorLabels(
          survivor,
          getItemRecord(records, survivor.templateId)?.name
        ),
        power: ratingOf(survivor),
      })),
    [payload, records]
  )

  const squads: Array<SquadView> = useMemo(
    () =>
      survivorSquads.map((squad) => {
        const members = slotMapOf(decorated, squad.id)
        const lead = members.get(squadLeaderSlotIndex) ?? null

        const slots: Array<SquadSlotView> = Array.from(
          { length: squadSlotCount },
          (_, slotIndex) => {
            const survivor = members.get(slotIndex) ?? null
            const isLeadSlot = slotIndex === squadLeaderSlotIndex

            return {
              slotIndex,
              survivor,
              score: survivor
                ? slotScore(survivor, slotIndex, squad.id, lead)
                : null,
              matchesLead:
                isLeadSlot || !survivor || !lead?.personality
                  ? null
                  : survivor.personality === lead.personality,
              matchesJob:
                isLeadSlot && survivor
                  ? leadJobMatches(survivor, squad.id)
                  : null,
            }
          }
        )

        return {
          id: squad.id,
          label: squad.label,
          attribute: squad.attribute,
          stat: squadAttributeStats[squad.attribute],
          slots,
          lead,
          total: squadTotal(members, squad.id),
          filled: members.size,
          issues: {
            empty: squadSlotCount - members.size,
            mismatched: slots.filter((slot) => slot.matchesLead === false)
              .length,
            wrongJob: slots[squadLeaderSlotIndex].matchesJob === false,
          },
        }
      }),
    [decorated]
  )

  const fort = useMemo(() => {
    const totals: Record<FortStatKey, number> = {
      fortitude: 0,
      offense: 0,
      resistance: 0,
      technology: 0,
    }

    squads.forEach((squad) => {
      totals[squad.stat] += squad.total
    })

    return totals
  }, [squads])

  /** Who can take the pending slot, the biggest gain first. */
  const candidates = useMemo(
    () =>
      pendingSlot
        ? rankCandidates(decorated, pendingSlot.squadId, pendingSlot.slotIndex)
        : [],
    [decorated, pendingSlot]
  )

  /** Whoever currently holds the pending slot, for the picker's header. */
  const occupant = useMemo(
    () =>
      pendingSlot
        ? (squads
            .find((squad) => squad.id === pendingSlot.squadId)
            ?.slots[pendingSlot.slotIndex] ?? null)
        : null,
    [pendingSlot, squads]
  )

  const totalFilled = squads.reduce(
    (accumulator, squad) => accumulator + squad.filled,
    0
  )

  const send = (assignments: Array<SquadAssignment>) => {
    if (!selected || isAssigning || assignments.length === 0) {
      return
    }

    setAssigning(true)
    window.electronAPI.assignSquadSurvivors(selected, assignments)

    clearTimeout(assignWatchdog.current)
    assignWatchdog.current = setTimeout(() => {
      setAssigning(false)
      toast.error(
        'No answer about the move. Refresh to see where survivors are.'
      )
      onAssigned()
    }, assignTimeoutMs)
  }

  const handleAssignTo = (characterId: string, target: PendingSlot) => {
    const assignments: Array<SquadAssignment> = [
      {
        characterId,
        squadId: target.squadId,
        slotIndex: target.slotIndex,
      },
    ]
    const current = decorated.find(
      (survivor) =>
        survivor.squadId === target.squadId &&
        survivor.slotIndex === target.slotIndex
    )

    /**
     * Moving someone who is already slotted would leave them in two places,
     * so whoever currently holds the target slot is pushed out first — one
     * batch, so the profile only takes a single revision.
     */
    if (current && current.itemId !== characterId) {
      assignments.unshift({
        characterId: current.itemId,
        squadId: '',
        slotIndex: -1,
      })
    }

    send(assignments)
  }

  const handleAssign = (characterId: string) => {
    if (pendingSlot) {
      handleAssignTo(characterId, pendingSlot)
    }
  }

  const handleClearSlot = (squadId: string, slotIndex: number) => {
    const current = decorated.find(
      (survivor) =>
        survivor.squadId === squadId && survivor.slotIndex === slotIndex
    )

    if (current) {
      send([{ characterId: current.itemId, squadId: '', slotIndex: -1 }])
    }
  }

  /** Works out an auto-fill and shows it; nothing moves until it is applied. */
  const previewFill = (squadIds: Array<string>) => {
    setFill({ squadIds, plan: planAutoFill(decorated, squadIds) })
  }

  const applyFill = () => {
    if (fill) {
      send(fill.plan.assignments)
    }
  }

  return {
    candidates,
    fill,
    fort,
    isAssigning,
    occupant,
    pendingSlot,
    records,
    squads,
    survivors: decorated,
    totalFilled,

    applyFill,
    cancelFill: () => setFill(null),
    handleAssign,
    handleAssignTo,
    handleClearSlot,
    previewFill,
    setPendingSlot,
  }
}
