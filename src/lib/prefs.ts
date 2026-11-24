import { useEffect, useState } from 'react'

const KEY = 'vault-search-first'
const EVENT = 'vault-prefs'

/** Hide the list until something is searched (default on). */
export function readSearchFirst(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSearchFirst(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: stays at default */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useSearchFirst(): boolean {
  const [on, setOn] = useState(readSearchFirst)
  useEffect(() => {
    const sync = () => setOn(readSearchFirst())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return on
}
