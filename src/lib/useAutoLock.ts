import { useEffect } from 'react'

const IDLE_MS = 5 * 60_000 // lock after 5 min without interaction
const HIDDEN_MS = 60_000 // or 1 min after the app goes to the background

export function useAutoLock(active: boolean, lock: () => void) {
  useEffect(() => {
    if (!active) return
    let idle = setTimeout(lock, IDLE_MS)
    let hiddenAt = 0
    const reset = () => {
      clearTimeout(idle)
      idle = setTimeout(lock, IDLE_MS)
    }
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_MS) lock()
      else reset()
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(idle)
      events.forEach((e) => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, lock])
}
