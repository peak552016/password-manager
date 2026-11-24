import { strengthLabel } from '../lib/generator'

export function Strength({ bits }: { bits: number }) {
  const { label, level } = strengthLabel(bits)
  return (
    <div className={`strength s${level}`}>
      <div className="meter">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= level ? 'on' : ''} />
        ))}
      </div>
      <small>
        {label} · ~{bits} bits
      </small>
    </div>
  )
}
