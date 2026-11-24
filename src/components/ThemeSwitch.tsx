import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePref } from '../lib/theme'

const OPTIONS: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'โหมดสว่าง', Icon: Sun },
  { id: 'dark', label: 'โหมดมืด', Icon: Moon },
  { id: 'system', label: 'ตามระบบ', Icon: Monitor },
]

/** Three-way segmented switch. */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const [pref, setPref] = useTheme()
  return (
    <div className={`theme-switch ${className}`} role="group" aria-label="ธีม">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" aria-pressed={pref === o.id} title={o.label} aria-label={o.label} onClick={() => setPref(o.id)}>
          <o.Icon />
        </button>
      ))}
    </div>
  )
}

/** Single button that cycles light → dark → system (for the collapsed sidebar). */
export function ThemeCycle() {
  const [pref, setPref] = useTheme()
  const i = OPTIONS.findIndex((o) => o.id === pref)
  const cur = OPTIONS[i]
  const next = OPTIONS[(i + 1) % OPTIONS.length]
  return (
    <button className="nav-item theme-cycle" title={`${cur.label} (กดเพื่อเปลี่ยนเป็น${next.label})`} onClick={() => setPref(next.id)}>
      <cur.Icon className="nav-ic" />
      <span>{cur.label}</span>
    </button>
  )
}
