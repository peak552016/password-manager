import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { copySecret } from '../lib/clipboard'
import { typeOf } from '../lib/types'
import { envSlug } from '../lib/env'
import { dbEngine } from '../lib/format'

export function TypeIcon({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' | 'lg' }) {
  const t = typeOf(type)
  return (
    <span className={`type-icon ${size}`} style={{ '--c': t.color } as CSSProperties} aria-hidden>
      <t.Icon strokeWidth={1.8} />
    </span>
  )
}

/** Same icon as the sidebar type; for databases the engine name is the tooltip. */
export function ItemIcon({ item, size = 'md' }: { item: { type: string; values: Record<string, string> }; size?: 'sm' | 'md' | 'lg' }) {
  const eng = item.type === 'database' ? dbEngine(item.values) : null
  const t = typeOf(item.type)
  return (
    <span className={`type-icon ${size}`} style={{ '--c': t.color } as CSSProperties} title={eng ? `${t.label} · ${eng.label}` : t.label}>
      <t.Icon strokeWidth={1.8} />
    </span>
  )
}

export function EnvBadge({ env }: { env: string }) {
  return <span className={`env env-${envSlug(env)}`}>{env}</span>
}

/** Copy with a short check-mark animation; clipboard is wiped after 30 s. */
export function CopyButton({ value, label, onCopied }: { value: string; label: string; onCopied?: (msg: string) => void }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1400)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      className={`icon-btn copy ${done ? 'done' : ''}`}
      title={`คัดลอก ${label}`}
      aria-label={`คัดลอก ${label}`}
      onClick={async () => {
        try {
          await copySecret(value)
          setDone(true)
          onCopied?.(`คัดลอก ${label} แล้ว · ล้างอัตโนมัติใน 30 วิ`)
        } catch {
          onCopied?.('คัดลอกไม่สำเร็จ')
        }
      }}
    >
      <span className="swap">
        <Copy className="a" />
        <Check className="b" />
      </span>
    </button>
  )
}

export function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onToggle} title={shown ? 'ซ่อน' : 'แสดง'} aria-label={shown ? 'ซ่อน' : 'แสดง'}>
      {shown ? <EyeOff /> : <Eye />}
    </button>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div className={`toast ${message ? 'show' : ''}`} role="status">
      {message}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
