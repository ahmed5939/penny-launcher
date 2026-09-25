import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn with the named type scale', () => {
  it('keeps a colour class beside a named size', () => {
    expect(cn('text-ui text-muted-foreground')).toBe('text-ui text-muted-foreground')
    expect(cn('text-caption', 'text-destructive')).toBe('text-caption text-destructive')
  })

  it('lets a later size replace an earlier one', () => {
    expect(cn('text-sm', 'text-ui')).toBe('text-ui')
    expect(cn('text-2xs', 'text-display-lg')).toBe('text-display-lg')
  })
})
