import { strengthLabel } from '../lib/generator'

export function Strength({ bits }: { bits: number }) {
  const { label, level } = strengthLabel(bits)
  return (
    <div className={`strength s${level}`}>
      <div className="bar">
        <span style={{ width: `${Math.min(100, (bits / 100) * 100)}%` }} />
      </div>
      <small>
        {label} · ~{bits} bits
      </small>
    </div>
  )
}
