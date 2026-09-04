import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

/** Growing collections need search and an overview, rather than endless tabs. */
export function CollectionPicker({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string
  items: ReadonlyArray<{ value: string; label: string; status?: ReactNode }>
  value?: string
  onValueChange: (value: string) => void
}) {
  const { t } = useTranslation(['general'])
  const [query, setQuery] = useState('')
  const filtered = items.filter((item) =>
    item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  return (
    <div className="chrome-surface self-start rounded-xl border border-border/60 p-2">
      <p className="micro-label px-1 pb-2">{label}</p>
      {(items.length > 5 || query !== '') && (
        <Input
          className="mb-2"
          aria-label={`${t('actions.search')}: ${label}`}
          placeholder={t('actions.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <ul aria-label={label} className="max-h-72 space-y-1 overflow-y-auto">
        {filtered.map((item) => (
          <li key={item.value}>
            <button
              type="button"
              aria-pressed={value === item.value}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent/40',
                value === item.value && 'bg-accent/60 font-semibold',
              )}
              onClick={() => onValueChange(item.value)}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.status}
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="p-2 text-xs text-muted-foreground">
          {t('no-item-found')}
        </p>
      )}
    </div>
  )
}
