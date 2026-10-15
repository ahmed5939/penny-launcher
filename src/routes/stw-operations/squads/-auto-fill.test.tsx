import type { DecoratedSurvivor } from './-hooks'
import type { FillPlan } from './-squad-model'
import type { ReactNode } from 'react'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/ui/dialog', () => {
  const passThrough = ({ children, className }: { children?: ReactNode; className?: string }) =>
    createElement('div', { className }, children)

  return {
    DialogDescription: passThrough,
    DialogFooter: passThrough,
    DialogHeader: passThrough,
    DialogTitle: passThrough,
  }
})

import { AutoFillReview } from './-auto-fill'

const emt = 'Squad_Attribute_Medicine_EMTSquad'

function plan(before: number, after: number): FillPlan<DecoratedSurvivor> {
  return {
    assignments: [],
    changes: [{ before, after, moved: 1, slots: new Map(), squadId: emt }],
    moved: 1,
  }
}

function review(props: Partial<Parameters<typeof AutoFillReview>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(AutoFillReview, {
      isAssigning: false,
      onApply: () => undefined,
      onCancel: () => undefined,
      plan: plan(100, 100),
      squadIds: [emt],
      squads: [],
      ...props,
    })
  )
}

describe('auto-fill review', () => {
  it('locks Cancel while the move is running', () => {
    expect(review({ isAssigning: true })).toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/)
    expect(review({ isAssigning: false })).not.toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/)
  })

  it('does not colour a zero net gain as a success', () => {
    expect(review({ plan: plan(100, 100) })).toMatch(
      /F\.O\.R\.T\.\s*<span class="[^"]*text-muted-foreground[^"]*">±0<\/span>/
    )
  })

  it('colours a net gain as a success', () => {
    expect(review({ plan: plan(100, 150) })).toMatch(
      /F\.O\.R\.T\.\s*<span class="[^"]*text-success[^"]*">\+50<\/span>/
    )
  })
})
