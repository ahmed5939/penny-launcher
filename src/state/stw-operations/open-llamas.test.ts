import { describe, expect, it } from 'vitest'

import { buildPreview, includedTypeIds } from '../../features/open-llamas/model'
import { defaultChoices, toggleExcluded, useOpenLlamasStore } from './open-llamas'

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
