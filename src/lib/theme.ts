import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'vault-theme'

export function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref: ThemePref, animate = false) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-anim')
    setTimeout(() => root.classList.remove('theme-anim'), 400)
  }
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1217' : '#f6f5f1')
}

/** Theme preference shared by every toggle on the page. */
export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readTheme)
  useEffect(() => {
    const sync = (e: Event) => setPref((e as CustomEvent<ThemePref>).detail)
    window.addEventListener('vault-theme', sync)
    return () => window.removeEventListener('vault-theme', sync)
  }, [])
  const set = (p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* storage unavailable: still applies for this session */
    }
    applyTheme(p, true)
    window.dispatchEvent(new CustomEvent('vault-theme', { detail: p }))
  }
  return [pref, set]
}
