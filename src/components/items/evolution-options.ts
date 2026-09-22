import type { ItemRecord } from '../../kernel/core/item-database'

/** Recipe order is the backend conversion index, not the display order. */
export function evolutionOptions(record: ItemRecord | null, tier: number) {
  const results = [record?.tierUpResult, record?.alternateTierUpResult]

  return results.flatMap((result, conversionIndex) => {
    if (!result) return []

    const material = /_ore_t04$/i.test(result) ? 'Obsidian'
      : /_crystal_t04$/i.test(result) ? 'Shadowshard'
        : /_ore_t05$/i.test(result) ? 'Brightcore'
          : /_crystal_t05$/i.test(result) ? 'Sunbeam' : null

    return [{
      conversionIndex,
      label: material ? `Evolve to ${material}` : `Evolve to tier ${tier + 1}`,
    }]
  }).concat(results.some(Boolean) ? [] : [{
    conversionIndex: 0,
    label: `Evolve to tier ${tier + 1}`,
  }])
}
