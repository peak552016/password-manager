import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronRight, Download, Folder, FolderOpen, Layers, Lock, Plus, Search, Settings as SettingsIcon, Share2, ShieldCheck, Star } from 'lucide-react'
import { deleteEntry, listEntries, saveEntry, type DecryptedItem, type Entry, type Session } from '../lib/vault'
import { TYPES, typeOf } from '../lib/types'
import { ENVIRONMENTS } from '../lib/env'
import { ItemEditor } from './ItemEditor'
import { ItemDetail } from './ItemDetail'
import { Settings } from './Settings'
import { TypePicker } from './TypePicker'
import { ShareExport } from './Share'
import { ImportTools } from './ImportTools'
import { EnvBadge, ItemIcon, Kbd, Toast } from './ui'
import { collectionsOf, groupRows } from '../lib/group'
import { useToast } from '../lib/useToast'
import { databaseSummary, shortHost } from '../lib/format'
import { ThemeCycle, ThemeSwitch } from './ThemeSwitch'

type Pane =
  | { kind: 'empty' }
  | { kind: 'detail'; id: string }
  | { kind: 'pick' }
  | { kind: 'new'; type: string }
  | { kind: 'edit'; id: string }
  | { kind: 'settings' }
  | { kind: 'share'; ids: string[] }
  | { kind: 'import' }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

export function VaultView({ session, onLock }: { session: Session; onLock: () => void }) {
  const [items, setItems] = useState<DecryptedItem[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [envFilter, setEnvFilter] = useState('')
  /** null = every หมวด, '' = items without one */
  const [collFilter, setCollFilter] = useState<string | null>(null)
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map())
  const [listW, setListW] = useState(readListWidth)
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

  const collections = useMemo(() => collectionsOf(items ?? []), [items])
  const collCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const i of items ?? []) c[i.collection] = (c[i.collection] ?? 0) + 1
    return c
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? [])
      // searching always looks through every หมวด
      .filter((i) => q || collFilter === null || i.collection === collFilter)
      .filter((i) => typeFilter === 'all' || (typeFilter === 'fav' ? i.favorite : i.type === typeFilter))
      .filter((i) => !envFilter || i.environment === envFilter)
      .filter((i) => {
        if (!q) return true
        // names and non-secret fields only
        const t = typeOf(i.type)
        const plain = t.fields
          .filter((f) => f.kind === 'text' || f.kind === 'mono' || f.kind === 'url')
          .map((f) => i.values[f.key] ?? '')
        return [i.title, i.collection, i.environment, i.knowledgeUrl, i.notes, t.label, ...plain, ...i.fields.map((f) => f.label)].some((s) =>
          s.toLowerCase().includes(q),
        )
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite))
  }, [items, query, typeFilter, envFilter, collFilter])

  const toggle = (key: string, isOpen: boolean) => setToggled((m) => new Map(m).set(key, !isOpen))

  const renderRow = (i: DecryptedItem, idx: number) => (
    <li key={i.id} style={{ '--i': idx } as CSSProperties}>
      <button className="list-item" aria-current={selectedId === i.id} onClick={() => setPane({ kind: 'detail', id: i.id })}>
        <ItemIcon item={i} />
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
  )

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
      paneContent = (
        <ItemEditor
          key={`new-${pane.type}`}
          type={pane.type}
          collections={collections}
          defaultCollection={collFilter ?? ''}
          onSave={(e) => onSave(e)}
          onCancel={() => setPane({ kind: 'pick' })}
        />
      )
      break
    case 'edit':
      paneContent = selected && (
        <ItemEditor
          key={`edit-${selected.id}`}
          type={selected.type}
          initial={selected}
          collections={collections}
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
          onShare={() => setPane({ kind: 'share', ids: [selected.id] })}
          toast={setToast}
        />
      )
      break
    case 'share':
      paneContent = (
        <ShareExport key={pane.ids.join()} items={items ?? []} preselected={pane.ids} onClose={() => setPane({ kind: 'empty' })} toast={setToast} />
      )
      break
    case 'import':
      paneContent = (
        <ImportTools
          toast={setToast}
          existing={items ?? []}
          onClose={() => setPane({ kind: 'empty' })}
          onImport={async (entries) => {
            for (const e of entries) await saveEntry(session, e)
            await reload()
            setPane({ kind: 'empty' })
            setToast(`เพิ่ม ${entries.length} รายการลงคลังแล้ว`)
          }}
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
    <div className={`shell ${pane.kind !== 'empty' ? 'has-pane' : ''}`} style={{ '--list-w': `${listW}px` } as CSSProperties}>
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
              aria-current={typeFilter === n.id && (n.id !== 'all' || collFilter === null)}
              onClick={() => {
                setTypeFilter(n.id)
                if (n.id === 'all') setCollFilter(null)
              }}
              style={{ '--c': n.color } as CSSProperties}
            >
              <n.Icon className="nav-ic" />
              <span>{n.label}</span>
              <em>{counts[n.id] || ''}</em>
            </button>
          ))}
          {collections.length > 0 && (
            <>
              <p className="nav-heading">หมวด</p>
              {[...collections, ...(collCounts[''] ? [''] : [])].map((c) => (
                <button
                  key={c || '(none)'}
                  className="nav-item coll"
                  aria-current={collFilter === c}
                  onClick={() => setCollFilter(collFilter === c ? null : c)}
                  title={c || 'ไม่มีหมวด'}
                  style={{ '--c': 'var(--accent)' } as CSSProperties}
                >
                  {collFilter === c ? <FolderOpen className="nav-ic" /> : <Folder className="nav-ic" />}
                  <span>{c || 'ไม่มีหมวด'}</span>
                  <em>{collCounts[c] || ''}</em>
                </button>
              ))}
            </>
          )}
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
          <ThemeSwitch />
          <button
            className="nav-item"
            aria-current={pane.kind === 'share'}
            onClick={() =>
              setPane({ kind: 'share', ids: typeFilter === 'all' && !envFilter && !query && collFilter === null ? [] : filtered.map((i) => i.id) })
            }
          >
            <Share2 className="nav-ic" />
            <span>ส่งออกเพื่อแชร์</span>
          </button>
          <button className="nav-item" aria-current={pane.kind === 'import'} onClick={() => setPane({ kind: 'import' })}>
            <Download className="nav-ic" />
            <span>นำเข้า</span>
          </button>
          <ThemeCycle />
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
        <ResizeHandle width={listW} onChange={setListW} />
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
          <ul className="list" key={`${typeFilter}|${envFilter}|${collFilter}`}>
            {query.trim() && collections.length > 0 && <li className="list-note">ค้นหาจากทุกหมวด · พบ {filtered.length} รายการ</li>}
            {sections(filtered, !query.trim() && collFilter === null && collections.length > 0).map((sec) => {
              const secKey = `s:${sec.name}`
              const secOpen = toggled.get(secKey) ?? true
              let n = 0
              return (
                <li key={secKey} className="list-section" style={{ '--i': 0 } as CSSProperties}>
                  {sec.header && (
                    <button className="section-head" aria-expanded={secOpen} onClick={() => toggle(secKey, secOpen)}>
                      <ChevronRight className="chev" />
                      <Folder />
                      <span>{sec.name || 'ไม่มีหมวด'}</span>
                      <em>{sec.items.length}</em>
                    </button>
                  )}
                  {secOpen && (
                    <ul>
                      {groupRows(sec.items).map((row) => {
                        const idx = Math.min(n++, 12)
                        if (row.kind === 'item') return renderRow(row.item, idx)
                        const key = `${secKey}|${row.key}`
                        const hasSel = row.items.some((i) => i.id === selectedId)
                        const open = toggled.get(key) ?? (!!query.trim() || hasSel)
                        return (
                          <li key={key} className={`group ${open ? 'open' : ''}`} style={{ '--i': idx } as CSSProperties}>
                            <button className="list-item group-head" aria-expanded={open} aria-current={!open && hasSel} onClick={() => toggle(key, open)}>
                              <ItemIcon item={row.items[0]} />
                              <span className="li-meta">
                                <strong>
                                  {row.name}
                                  <span className="g-count">{row.items.length}</span>
                                </strong>
                                <span className="g-envs">
                                  {row.items.map((i) => (i.environment ? <EnvBadge key={i.id} env={i.environment} /> : null))}
                                </span>
                              </span>
                              <ChevronRight className="chev" />
                            </button>
                            {open && (
                              <ul className="group-items">
                                {row.items.map((i) => (
                                  <li key={i.id}>
                                    <button className="list-item child" aria-current={selectedId === i.id} onClick={() => setPane({ kind: 'detail', id: i.id })}>
                                      {i.environment ? <EnvBadge env={i.environment} /> : <span className="env">—</span>}
                                      <span className="li-meta">
                                        <strong>
                                          {subtitle(i)}
                                          {i.favorite && <Star className="li-star" />}
                                        </strong>
                                        <small>{i.title}</small>
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
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
  if (i.type === 'database' || i.type === 'server') {
    const s = i.type === 'database' ? databaseSummary(i.values) : [i.values.username, i.values.host && shortHost(i.values.host)].filter(Boolean).join('@')
    if (s) return s
  }
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

/** Split the list by หมวด (named ones first, then "no หมวด") when browsing everything. */
function sections(items: DecryptedItem[], byCollection: boolean) {
  if (!byCollection) return [{ name: '', header: false, items }]
  const map = new Map<string, DecryptedItem[]>()
  for (const i of items) map.set(i.collection, [...(map.get(i.collection) ?? []), i])
  return [...map.keys()]
    .sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b, 'th')))
    .map((name) => ({ name, header: true, items: map.get(name)! }))
}

const LIST_W_KEY = 'vault-list-w'
const LIST_W_DEFAULT = 340
const clampListW = (w: number) => Math.round(Math.max(260, Math.min(w, 720, window.innerWidth - 420)))

function readListWidth(): number {
  try {
    const v = Number(localStorage.getItem(LIST_W_KEY))
    return v ? clampListW(v) : LIST_W_DEFAULT
  } catch {
    return LIST_W_DEFAULT
  }
}

/** Drag the right edge of the list column; double-click resets. Width is remembered. */
function ResizeHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const save = (w: number) => {
    onChange(w)
    try {
      localStorage.setItem(LIST_W_KEY, String(w))
    } catch {
      /* private mode */
    }
  }
  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="ปรับความกว้างรายการ"
      aria-valuenow={width}
      tabIndex={0}
      title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิกเพื่อคืนค่าเดิม"
      onDoubleClick={() => save(LIST_W_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') save(clampListW(width - 20))
        if (e.key === 'ArrowRight') save(clampListW(width + 20))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        const el = e.currentTarget
        const left = el.parentElement!.getBoundingClientRect().left
        el.setPointerCapture(e.pointerId)
        document.body.classList.add('resizing')
        let last = width
        const move = (ev: PointerEvent) => {
          last = clampListW(ev.clientX - left)
          onChange(last)
        }
        const up = () => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerup', up)
          el.removeEventListener('pointercancel', up)
          document.body.classList.remove('resizing')
          save(last)
        }
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerup', up)
        el.addEventListener('pointercancel', up)
      }}
    />
  )
}
