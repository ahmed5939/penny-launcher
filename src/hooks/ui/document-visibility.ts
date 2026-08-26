import { useEffect, useState } from 'react'

/** Avoids spending renderer time on clocks and polling while hidden to tray. */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => !document.hidden)

  useEffect(() => {
    const update = () => setVisible(!document.hidden)

    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return visible
}
