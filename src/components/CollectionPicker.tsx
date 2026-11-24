import { useState } from 'react'
import { FolderPlus, Folder, Check } from 'lucide-react'

/**
 * Pick one "หมวด" (collection) from the existing ones, or type a new one.
 * `auto` adds a first chip meaning "keep what the source file says".
 */
export function CollectionPicker({
  value,
  onChange,
  options,
  auto,
}: {
  value: string | null
  onChange: (v: string | null) => void
  options: string[]
  auto?: { label: string; detail?: string }
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const all = value && !options.includes(value) ? [...options, value] : options

  const commit = () => {
    const v = draft.trim()
    if (v) onChange(v)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="coll-picker">
      {auto && (
        <button type="button" className="coll-opt" aria-pressed={value === null} onClick={() => onChange(null)} title={auto.detail}>
          {value === null && <Check />} {auto.label}
          {auto.detail && <small>{auto.detail}</small>}
        </button>
      )}
      <button type="button" className="coll-opt" aria-pressed={value === ''} onClick={() => onChange('')}>
        {value === '' && <Check />} ไม่มีหมวด
      </button>
      {all.map((c) => (
        <button key={c} type="button" className="coll-opt" aria-pressed={value === c} onClick={() => onChange(c)}>
          {value === c ? <Check /> : <Folder />} {c}
        </button>
      ))}
      {adding ? (
        <input
          className="coll-new"
          autoFocus
          value={draft}
          placeholder="ชื่อหมวดใหม่ แล้วกด Enter"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setAdding(false)
            }
          }}
        />
      ) : (
        <button type="button" className="coll-opt add" onClick={() => setAdding(true)}>
          <FolderPlus /> หมวดใหม่
        </button>
      )}
    </div>
  )
}

