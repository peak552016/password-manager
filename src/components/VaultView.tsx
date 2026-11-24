import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteEntry, listEntries, saveEntry, type DecryptedItem, type Entry, type Session } from '../lib/vault'
import { ItemEditor } from './ItemEditor'
import { ItemDetail } from './ItemDetail'
import { Settings } from './Settings'

type View =
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id?: string }
  | { kind: 'settings' }

export function VaultView({ session, onLock }: { session: Session; onLock: () => void }) {
  const [items, setItems] = useState<DecryptedItem[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>({ kind: 'list' })

  const reload = useCallback(
    () =>
      listEntries(session)
        .then(setItems)
        .catch((e) => setError(`ถอดรหัสข้อมูลไม่สำเร็จ: ${e}`)),
    [session],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!items || !q) return items ?? []
    return items.filter((i) => [i.title, i.username, i.url].some((f) => f.toLowerCase().includes(q)))
  }, [items, query])

  const current = 'id' in view && view.id ? items?.find((i) => i.id === view.id) : undefined

  async function onSave(entry: Entry, id?: string) {
    const saved = await saveEntry(session, entry, id)
    await reload()
    setView({ kind: 'detail', id: saved.id })
  }

  async function onDelete(id: string) {
    await deleteEntry(id)
    await reload()
    setView({ kind: 'list' })
  }

  if (view.kind === 'edit')
    return <ItemEditor initial={current} onSave={(e) => onSave(e, current?.id)} onCancel={() => setView(current ? { kind: 'detail', id: current.id } : { kind: 'list' })} />
  if (view.kind === 'detail' && current)
    return (
      <ItemDetail
        item={current}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'edit', id: current.id })}
        onDelete={() => onDelete(current.id)}
      />
    )
  if (view.kind === 'settings') return <Settings onBack={() => setView({ kind: 'list' })} onReplaced={() => onLock()} />

  return (
    <main className="vault">
      <header className="bar">
        <h1>รหัสผ่าน</h1>
        <div className="actions">
          <button className="icon" onClick={() => setView({ kind: 'settings' })} aria-label="ตั้งค่า">
            ⚙︎
          </button>
          <button className="icon" onClick={onLock} aria-label="ล็อก">
            🔒
          </button>
        </div>
      </header>
      <input
        className="search"
        type="search"
        placeholder="ค้นหา"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {error && <p className="hint error">{error}</p>}
      {items === null ? (
        <p className="muted center">กำลังถอดรหัส…</p>
      ) : filtered.length === 0 ? (
        <p className="muted center">{items.length ? 'ไม่พบรายการ' : 'ยังไม่มีรหัสผ่าน กด + เพื่อเพิ่ม'}</p>
      ) : (
        <ul className="list">
          {filtered.map((i) => (
            <li key={i.id}>
              <button onClick={() => setView({ kind: 'detail', id: i.id })}>
                <span className="avatar" aria-hidden>
                  {(i.title || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="meta">
                  <strong>{i.title || '(ไม่มีชื่อ)'}</strong>
                  <small className="muted">{i.username || hostOf(i.url)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="fab" onClick={() => setView({ kind: 'edit' })} aria-label="เพิ่มรหัสผ่าน">
        +
      </button>
    </main>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname
  } catch {
    return url
  }
}
