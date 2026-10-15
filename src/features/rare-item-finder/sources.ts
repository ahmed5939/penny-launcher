import type { FinderSource } from './types'

/** The four inventories the finder reads. Data-free so the renderer can import it. */
export const SOURCES: ReadonlyArray<FinderSource> = Object.freeze([
  { id: 'campaign', label: 'Inventory schematics', short: 'Inventory', schematic: true },
  { id: 'collection_book_schematics0', label: 'Collection Book schematics', short: 'Collection book', schematic: true },
  { id: 'theater0', label: 'Backpack weapons & traps', short: 'Backpack', schematic: false },
  { id: 'outpost0', label: 'Storage weapons & traps', short: 'Storage', schematic: false },
])

export const RULES_VERSION = 'Game 42.10 · 147 legacy + 301 current + 24 defender perks · 17 Sep 2026'
