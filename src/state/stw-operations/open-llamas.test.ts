import { describe, expect, it } from 'vitest'

import { buildPreview, includedTypeIds } from '../../features/open-llamas/model'
import { defaultChoices, runSummary, toggleExcluded, useOpenLlamasStore } from './open-llamas'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)

describe('Open Llamas choices', () => {
  it('keeps choices for types on other pages or hidden by a filter', () => {
    const preview = buildPreview(A, 'p', Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`g${i}`, { templateId: `CardPack:type_${String(i).padStart(2, '0')}`, quantity: 1 }])))
    const ids = preview.types.map((type) => type.templateId)
    const { updateChoices } = useOpenLlamasStore.getState()
    const excluded = () => useOpenLlamasStore.getState().choices[A]?.excluded ?? []

    // Page 1 (types 0–9): exclude type 3. Page 3 (types 20–24): exclude type 22.
    updateChoices(A, { excluded: toggleExcluded(excluded(), ids[3], false) })
    updateChoices(A, { excluded: toggleExcluded(excluded(), ids[22], false) })
    // A filter showing only type 22: include it again. Type 3 is hidden and stays excluded.
    updateChoices(A, { excluded: toggleExcluded(excluded(), ids[22], true) })
    updateChoices(A, { count: '7' })

    const included = includedTypeIds(preview, new Set(excluded()))
    expect(included).toHaveLength(24)
    expect(included).not.toContain(ids[3])
    expect(included).toContain(ids[22])
    expect(useOpenLlamasStore.getState().choices[A]).toEqual({ excluded: [ids[3]], count: '7', recycle: 'none' })
  })

  it('keeps each account to itself and starts with nothing recycled', () => {
    useOpenLlamasStore.getState().updateChoices(B, { recycle: 'below-epic' })
    expect(useOpenLlamasStore.getState().choices[B]).toEqual({ ...defaultChoices, recycle: 'below-epic' })
    expect(useOpenLlamasStore.getState().choices[A]?.recycle).toBe('none')
    expect(defaultChoices.recycle).toBe('none')
  })

  it('does not dismiss a run that is still going', () => {
    const run = { accountId: A, status: 'running', target: 1, opened: 0, recycled: 0, kept: 0, packsLeft: 1, recycle: 'none', message: null, uncertain: null, cancelRequested: false } as const
    const store = useOpenLlamasStore.getState()
    store.updateRun(run)
    store.dismissRun(A)
    expect(useOpenLlamasStore.getState().runs[A]).toBeDefined()
    store.updateRun({ ...run, status: 'done', opened: 1 })
    store.dismissRun(A)
    expect(useOpenLlamasStore.getState().runs[A]).toBeUndefined()
  })
})

describe('Open Llamas run summary', () => {
  it('names the account when it has one', () => {
    expect(runSummary({ status: 'done', opened: 30 }, 'Vexbolt')).toEqual({ tone: 'success', text: 'Opened 30 llamas on Vexbolt' })
    expect(runSummary({ status: 'cancelled', opened: 1 }, 'Vexbolt')).toEqual({ tone: 'info', text: 'Stopped after opening 1 llama on Vexbolt' })
    expect(runSummary({ status: 'failed', opened: 12 }, 'Vexbolt')).toEqual({
      tone: 'warning',
      text: 'Opening llamas on Vexbolt stopped after 12 llamas. Switch to Vexbolt and open Open llamas for why.',
    })
  })

  it('leaves the account out when it cannot be named', () => {
    expect(runSummary({ status: 'done', opened: 30 }, null)).toEqual({ tone: 'success', text: 'Opened 30 llamas' })
    expect(runSummary({ status: 'cancelled', opened: 0 }, null)).toEqual({ tone: 'info', text: 'Stopped after opening 0 llamas' })
    expect(runSummary({ status: 'failed', opened: 12 }, null)).toEqual({
      tone: 'warning',
      text: 'Opening llamas stopped after 12 llamas. See Open llamas for why.',
    })
  })
})
