import type { CSSProperties } from 'react'
import type { Entry } from '../lib/vault'
import { typeOf } from '../lib/types'
import { EnvBadge, TypeIcon } from './ui'

export function ItemPicker({
  items,
  selected,
  onToggle,
  dupIds,
  subtitle,
}: {
  items: (Entry & { id: string })[]
  selected: Set<string>
  onToggle: (id: string) => void
  dupIds?: Set<string>
  subtitle?: (i: Entry) => string
}) {
  return (
    <ul className="picker">
      {items.map((i, idx) => (
        <li key={i.id} style={{ '--i': Math.min(idx, 12) } as CSSProperties}>
          <label className={`pick ${selected.has(i.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={selected.has(i.id)} onChange={() => onToggle(i.id)} />
            <TypeIcon type={i.type} size="sm" />
            <span className="pick-title">
              {i.title || '(ไม่มีชื่อ)'}
              <small>{subtitle?.(i) ?? typeOf(i.type).label}</small>
            </span>
            {dupIds?.has(i.id) && <span className="dup">มีอยู่แล้ว</span>}
            {i.environment && <EnvBadge env={i.environment} />}
          </label>
        </li>
      ))}
    </ul>
  )
}
