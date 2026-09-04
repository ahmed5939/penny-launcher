import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

/** Peer page sections. Use Segmented for filters, and a selector for growing
 * collections. Explicit activation keeps arrow navigation out of history. */
export function PageTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  children,
  label,
}: {
  tabs: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>
  value: T
  onValueChange: (value: T) => void
  children: ReactNode
  label: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const previousValue = useRef(value)
  useEffect(() => {
    if (previousValue.current === value) return
    previousValue.current = value
    const root = rootRef.current
    const scroller = root?.closest('.main-wrapper-content')
    if (root && scroller) {
      const top =
        scroller.scrollTop +
        root.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top
      if (scroller.scrollTop > top) scroller.scrollTo({ top })
    }
  }, [value])
  return (
    <Tabs
      ref={rootRef}
      value={value}
      activationMode="manual"
      className="min-w-0 space-y-4"
      onValueChange={(next) => {
        if (tabs.some((tab) => tab.value === next && !tab.disabled))
          onValueChange(next as T)
      }}
    >
      <div className="chrome-surface sticky top-0 z-10 overflow-x-auto border-b border-border/60">
        <TabsList
          aria-label={label}
          className="h-auto justify-start gap-2 rounded-none bg-transparent p-0"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className="h-auto rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:ring-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  )
}

/** Keep form state mounted while explicitly removing inactive panels from
 * layout, keyboard navigation and the accessibility tree. */
export function PageTabPanel({
  value,
  activeValue,
  children,
}: {
  value: string
  activeValue: string
  children: ReactNode
}) {
  const active = value === activeValue
  const [visited, setVisited] = useState(active)
  useEffect(() => {
    if (active) setVisited(true)
  }, [active])
  return (
    <TabsContent
      value={value}
      forceMount
      hidden={value !== activeValue}
      className="space-y-4 data-[state=inactive]:hidden"
    >
      {(active || visited) && children}
    </TabsContent>
  )
}
