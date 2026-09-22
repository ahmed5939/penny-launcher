export type BookItem = {
  id: string
  templateId: string
  level: number
  portrait: string | null
  personality: string | null
  teamBonus: string | null
  alterations: string[]
}
export type CollectionBookData = {
  accountId: string
  fetchedAt: string
  slotted: BookItem[]
  inventory: BookItem[]
  resources: Record<string, number>
  highestLevel: number | null
}
