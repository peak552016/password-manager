import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
import { TYPES } from '../lib/types'

export function TypePicker({ onPick, onCancel }: { onPick: (type: string) => void; onCancel: () => void }) {
  return (
    <div className="pane-inner">
      <header className="pane-head">
        <div>
          <p className="eyebrow">รายการใหม่</p>
          <h2>จะเก็บอะไร?</h2>
        </div>
        <button className="icon-btn" onClick={onCancel} aria-label="ปิด">
          <X />
        </button>
      </header>
      <div className="type-grid">
        {TYPES.map((t, i) => (
          <button
            key={t.id}
            className="type-card"
            style={{ '--c': t.color, '--i': i } as CSSProperties}
            onClick={() => onPick(t.id)}
          >
            <span className="type-icon lg" aria-hidden>
              <t.Icon strokeWidth={1.8} />
            </span>
            <strong>{t.label}</strong>
            <small>{t.hint}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
