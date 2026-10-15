import { describe, expect, it } from 'vitest'

import { countOf } from './words'

describe('countOf', () => {
  it('uses the singular noun for one', () => {
    expect(countOf(1, 'win', 'wins')).toBe('1 win')
  })

  it('uses the plural noun for every other count', () => {
    expect(countOf(0, 'win', 'wins')).toBe('0 wins')
    expect(countOf(2, 'win', 'wins')).toBe('2 wins')
  })

  it('judges the singular by the rounded count shown', () => {
    expect(countOf(1.4, 'win', 'wins')).toBe('1 win')
  })
})
