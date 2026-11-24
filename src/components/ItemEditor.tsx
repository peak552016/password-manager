import { useState, type FormEvent } from 'react'
import type { Entry } from '../lib/vault'
import { DEFAULT_GEN, estimateBits, generatePassword, type GenOptions } from '../lib/generator'
import { Strength } from './Strength'

interface Props {
  initial?: Entry
  onSave: (e: Entry) => Promise<void>
  onCancel: () => void
}

const EMPTY: Entry = { title: '', username: '', password: '', url: '', notes: '' }

export function ItemEditor({ initial, onSave, onCancel }: Props) {
  const [entry, setEntry] = useState<Entry>(() => ({ ...EMPTY, ...pick(initial) }))
  const [showGen, setShowGen] = useState(!initial)
  const [gen, setGen] = useState<GenOptions>(DEFAULT_GEN)
  const [reveal, setReveal] = useState(!initial)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof Entry) => (e: { target: { value: string } }) => setEntry((p) => ({ ...p, [k]: e.target.value }))

  function regenerate(o = gen) {
    try {
      setEntry((p) => ({ ...p, password: generatePassword(o) }))
    } catch {
      /* no char set selected */
    }
  }

  function updateGen(patch: Partial<GenOptions>) {
    const next = { ...gen, ...patch }
    setGen(next)
    regenerate(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await onSave(entry)
  }

  return (
    <main className="page">
      <form onSubmit={submit} className="stack">
        <header className="bar">
          <button type="button" className="link" onClick={onCancel}>
            ยกเลิก
          </button>
          <strong>{initial ? 'แก้ไข' : 'เพิ่มรหัสผ่าน'}</strong>
          <button className="link strong" disabled={busy || !entry.title.trim()}>
            บันทึก
          </button>
        </header>
        <label>
          ชื่อ
          <input value={entry.title} onChange={set('title')} placeholder="เช่น Gmail" autoFocus={!initial} required />
        </label>
        <label>
          ชื่อผู้ใช้ / อีเมล
          <input value={entry.username} onChange={set('username')} autoCapitalize="off" autoCorrect="off" autoComplete="off" />
        </label>
        <label>
          รหัสผ่าน
          <div className="row">
            <input
              className="mono"
              type={reveal ? 'text' : 'password'}
              value={entry.password}
              onChange={set('password')}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'ซ่อน' : 'แสดง'}
            </button>
          </div>
        </label>
        {entry.password && <Strength bits={estimateBits(entry.password)} />}

        <button type="button" className="link" onClick={() => setShowGen((s) => !s)}>
          {showGen ? 'ซ่อนตัวสร้างรหัสผ่าน' : 'สร้างรหัสผ่านแบบสุ่ม'}
        </button>
        {showGen && (
          <fieldset className="gen">
            <label>
              ความยาว: {gen.length}
              <input type="range" min={8} max={64} value={gen.length} onChange={(e) => updateGen({ length: +e.target.value })} />
            </label>
            <div className="chips">
              {(
                [
                  ['lower', 'a-z'],
                  ['upper', 'A-Z'],
                  ['digits', '0-9'],
                  ['symbols', '!@#'],
                  ['avoidAmbiguous', 'ไม่ใช้ 0/O 1/l'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="chip">
                  <input type="checkbox" checked={gen[k]} onChange={(e) => updateGen({ [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => regenerate()}>
              ↻ สุ่มใหม่
            </button>
          </fieldset>
        )}

        <label>
          เว็บไซต์
          <input value={entry.url} onChange={set('url')} type="url" inputMode="url" placeholder="https://" autoCapitalize="off" />
        </label>
        <label>
          โน้ต
          <textarea value={entry.notes} onChange={set('notes')} rows={3} />
        </label>
      </form>
    </main>
  )
}

function pick(e?: Entry): Partial<Entry> {
  if (!e) return { password: generatePassword(DEFAULT_GEN) }
  const { title, username, password, url, notes } = e
  return { title, username, password, url, notes }
}
