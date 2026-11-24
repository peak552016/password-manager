import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Layers, Lock, Plus, Search, Settings as SettingsIcon, ShieldCheck, Star } from 'lucide-react'
import { deleteEntry, listEntries, saveEntry, type DecryptedItem, type Entry, type Session } from '../lib/vault'
import { TYPES, typeOf } from '../lib/types'
import { ENVIRONMENTS } from '../lib/env'
import { ItemEditor } from './ItemEditor'
import { ItemDetail } from './ItemDetail'
import { Settings } from './Settings'
import { TypePicker } from './TypePicker'
import { EnvBadge, Kbd, Toast, TypeIcon } from './ui'
import { useToast } from '../lib/useToast'

type Pane =
  | { kind: 'empty' }
  | { kind: 'detail'; id: string }
  | { kind: 'pick' }
  | { kind: 'new'; type: string }
  | { kind: 'edit'; id: string }
  | { kind: 'settings' }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

export function VaultView({ session, onLock }: { session: Session; onLock: () => void }) {
  const [items, setItems] = useState<DecryptedItem[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [envFilter, setEnvFilter] = useState('')
  const [pane, setPane] = useState<Pane>({ kind: 'empty' })
  const [toast, setToast] = useToast()
  const searchRef = useRef<HTMLInputElement>(null)

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

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (mod && k === 'n') {
        e.preventDefault()
        setPane({ kind: 'pick' })
      } else if (mod && k === 'l') {
        e.preventDefault()
        onLock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onLock])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0, fav: 0 }
    for (const i of items ?? []) {
      c[i.type] = (c[i.type] ?? 0) + 1
      if (i.favorite) c.fav++
    }
    return c
  }, [items])

  const envs = useMemo(() => {
    const used = new Set((items ?? []).map((i) => i.environment).filter(Boolean))
    return [...ENVIRONMENTS.filter((e) => used.has(e)), ...[...used].filter((e) => !ENVIRONMENTS.includes(e)).sort()]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? [])
      .filter((i) => typeFilter === 'all' || (typeFilter === 'fav' ? i.favorite : i.type === typeFilter))
      .filter((i) => !envFilter || i.environment === envFilter)
      .filter((i) => {
        if (!q) return true
        // names and non-secret fields only
        const t = typeOf(i.type)
        const plain = t.fields
          .filter((f) => f.kind === 'text' || f.kind === 'mono' || f.kind === 'url')
          .map((f) => i.values[f.key] ?? '')
        return [i.title, i.environment, i.knowledgeUrl, i.notes, t.label, ...plain, ...i.fields.map((f) => f.label)].some((s) =>
          s.toLowerCase().includes(q),
        )
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite))
  }, [items, query, typeFilter, envFilter])

  const selectedId = pane.kind === 'detail' || pane.kind === 'edit' ? pane.id : null
  const selected = selectedId ? items?.find((i) => i.id === selectedId) : undefined

  async function onSave(entry: Entry, id?: string) {
    const saved = await saveEntry(session, entry, id)
    await reload()
    setPane({ kind: 'detail', id: saved.id })
    setToast(id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว')
  }

  async function onDelete(id: string) {
    await deleteEntry(id)
    await reload()
    setPane({ kind: 'empty' })
    setToast('ลบรายการแล้ว')
  }

  async function toggleFavorite(item: DecryptedItem) {
    const { id, updatedAt, ...entry } = item
    void updatedAt
    await saveEntry(session, { ...entry, favorite: !item.favorite }, id)
    await reload()
  }

  const nav = [
    { id: 'all', label: 'ทั้งหมด', Icon: Layers, color: 'var(--accent)' },
    { id: 'fav', label: 'รายการโปรด', Icon: Star, color: '#f5b544' },
  ]

  let paneContent
  switch (pane.kind) {
    case 'pick':
      paneContent = <TypePicker onPick={(type) => setPane({ kind: 'new', type })} onCancel={() => setPane({ kind: 'empty' })} />
      break
    case 'new':
      paneContent = <ItemEditor key={`new-${pane.type}`} type={pane.type} onSave={(e) => onSave(e)} onCancel={() => setPane({ kind: 'pick' })} />
      break
    case 'edit':
      paneContent = selected && (
        <ItemEditor
          key={`edit-${selected.id}`}
          type={selected.type}
          initial={selected}
          onSave={(e) => onSave(e, selected.id)}
          onCancel={() => setPane({ kind: 'detail', id: selected.id })}
        />
      )
      break
    case 'detail':
      paneContent = selected && (
        <ItemDetail
          key={selected.id}
          item={selected}
          onBack={() => setPane({ kind: 'empty' })}
          onEdit={() => setPane({ kind: 'edit', id: selected.id })}
          onDelete={() => onDelete(selected.id)}
          onToggleFavorite={() => toggleFavorite(selected)}
          toast={setToast}
        />
      )
      break
    case 'settings':
      paneContent = <Settings onBack={() => setPane({ kind: 'empty' })} onReplaced={onLock} />
      break
    default:
      paneContent = <EmptyPane total={counts.all} onNew={() => setPane({ kind: 'pick' })} />
  }

  return (
    <div className={`shell ${pane.kind !== 'empty' ? 'has-pane' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck strokeWidth={2} />
          </span>
          <span>Vault</span>
        </div>

        <nav className="nav">
          {nav.map((n) => (
            <button
              key={n.id}
              className="nav-item"
              aria-current={typeFilter === n.id}
              onClick={() => setTypeFilter(n.id)}
              style={{ '--c': n.color } as CSSProperties}
            >
              <n.Icon className="nav-ic" />
              <span>{n.label}</span>
              <em>{counts[n.id] || ''}</em>
            </button>
          ))}
          <p className="nav-heading">ประเภท</p>
          {TYPES.map((t) => (
            <button
              key={t.id}
              className="nav-item"
              aria-current={typeFilter === t.id}
              onClick={() => setTypeFilter(t.id)}
              style={{ '--c': t.color } as CSSProperties}
            >
              <t.Icon className="nav-ic" />
              <span>{t.label}</span>
              <em>{counts[t.id] || ''}</em>
            </button>
          ))}
          {envs.length > 0 && (
            <>
              <p className="nav-heading">Environment</p>
              <div className="env-filter">
                {envs.map((e) => (
                  <button key={e} className="env-chip" aria-pressed={envFilter === e} onClick={() => setEnvFilter(envFilter === e ? '' : e)}>
                    <EnvBadge env={e} />
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <button className="nav-item" aria-current={pane.kind === 'settings'} onClick={() => setPane({ kind: 'settings' })}>
            <SettingsIcon className="nav-ic" />
            <span>ตั้งค่า</span>
          </button>
          <button className="nav-item" onClick={onLock}>
            <Lock className="nav-ic" />
            <span>ล็อก</span>
            <Kbd>{MOD} L</Kbd>
          </button>
        </div>
      </aside>

      <section className="listpane">
        <div className="list-head">
          <div className="search">
            <Search />
            <input
              ref={searchRef}
              type="search"
              placeholder="ค้นหา"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) setPane({ kind: 'detail', id: filtered[0].id })
                if (e.key === 'Escape') setQuery('')
              }}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <Kbd>{MOD} K</Kbd>
          </div>
          <button className="btn primary new-btn" onClick={() => setPane({ kind: 'pick' })} title={`รายการใหม่ (${MOD} N)`}>
            <Plus /> <span>ใหม่</span>
          </button>
        </div>

        {error && <p className="hint error">{error}</p>}
        {items === null ? (
          <div className="list-skeleton">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="list-empty">{items.length ? 'ไม่พบรายการที่ตรงกัน' : 'ยังไม่มีรายการ'}</p>
        ) : (
          <ul className="list" key={`${typeFilter}|${envFilter}`}>
            {filtered.map((i, idx) => (
              <li key={i.id} style={{ '--i': Math.min(idx, 12) } as CSSProperties}>
                <button className="list-item" aria-current={selectedId === i.id} onClick={() => setPane({ kind: 'detail', id: i.id })}>
                  <TypeIcon type={i.type} />
                  <span className="li-meta">
                    <strong>
                      {i.title || '(ไม่มีชื่อ)'}
                      {i.favorite && <Star className="li-star" />}
                    </strong>
                    <small>{subtitle(i)}</small>
                  </span>
                  {i.environment && <EnvBadge env={i.environment} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detailpane">{paneContent}</section>
      <Toast message={toast} />
    </div>
  )
}

function EmptyPane({ total, onNew }: { total: number; onNew: () => void }) {
  return (
    <div className="empty-pane">
      <div className="orb" aria-hidden>
        <ShieldCheck strokeWidth={1.4} />
      </div>
      <h2>{total ? 'เลือกรายการทางซ้าย' : 'คลังของคุณพร้อมแล้ว'}</h2>
      <p className="muted">
        {total ? `มีทั้งหมด ${total} รายการ เข้ารหัสอยู่ในเครื่องนี้` : 'เริ่มเก็บรหัสผ่าน API key, token หรือ cURL แรกของคุณ'}
      </p>
      <button className="btn primary" onClick={onNew}>
        <Plus /> สร้างรายการใหม่
      </button>
      <p className="shortcuts muted">
        <Kbd>{MOD} K</Kbd> ค้นหา · <Kbd>{MOD} N</Kbd> ใหม่ · <Kbd>{MOD} L</Kbd> ล็อก
      </p>
    </div>
  )
}

function subtitle(i: DecryptedItem): string {
  const t = typeOf(i.type)
  for (const f of t.fields) if (f.subtitle && i.values[f.key]) return i.values[f.key]
  const url = i.values.url
  if (url) {
    try {
      return new URL(url.includes('://') ? url : `https://${url}`).hostname
    } catch {
      return url
    }
  }
  return t.label
}
