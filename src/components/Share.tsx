import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2, Database, Download, FileArchive, FileJson, FileSpreadsheet, FileUp, Loader2, Lock, RefreshCw, Send, Share2, Upload, X } from 'lucide-react'
import type { DecryptedItem, Entry } from '../lib/vault'
import { passwordZip } from '../lib/zip'
import { packFile, unpackFile } from '../lib/container'
import { toDbeaver, toPlainCsv, toPlainJson, toPostmanEnvironment, type ExportFile } from '../lib/exporters'
import { createShare, generateSharePassword, openShare, isShareFile, type ShareFile } from '../lib/share'
import { CopyButton } from './ui'
import { ItemPicker } from './ItemPicker'
import { CollectionPicker } from './CollectionPicker'
import { collectionsOf } from '../lib/group'

function toEntry(i: DecryptedItem): Entry {
  const e: Partial<DecryptedItem> = { ...i }
  delete e.id
  delete e.updatedAt
  return e as Entry
}

function stripDup(i: Entry & { dup: boolean }): Entry {
  const e: Partial<Entry & { dup: boolean }> = { ...i }
  delete e.dup
  return e as Entry
}

const slug = (s: string) =>
  s
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'items'

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

type Mode = 'vault' | 'plain'
type Format = 'dbeaver' | 'postman' | 'csv' | 'json'

const FORMATS: { id: Format; label: string; hint: string; Icon: typeof Lock; color: string; accepts?: string[] }[] = [
  { id: 'dbeaver', label: 'DBeaver', hint: 'CSV สำหรับ Import connection', Icon: Database, color: '#16a34a', accepts: ['database'] },
  { id: 'postman', label: 'Postman', hint: 'Environment จาก .env / API / Token', Icon: Send, color: '#ff6c37', accepts: ['env', 'api', 'token'] },
  { id: 'csv', label: 'CSV', hint: 'เปิดใน Excel', Icon: FileSpreadsheet, color: '#22a06b' },
  { id: 'json', label: 'JSON', hint: 'ข้อมูลดิบทุกฟิลด์', Icon: FileJson, color: '#a78bfa' },
]

function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function ShareExport({
  items,
  preselected,
  onClose,
  toast,
}: {
  items: DecryptedItem[]
  preselected: string[]
  onClose: () => void
  toast: (m: string) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected))
  const [name, setName] = useState('')
  const [password, setPassword] = useState(generateSharePassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('vault')
  const [formats, setFormats] = useState<Set<Format>>(() => new Set(['dbeaver']))
  const [winZip, setWinZip] = useState(false)
  const [done, setDone] = useState<{ file: string; count: number; files?: ExportFile[] } | null>(null)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleFormat = (f: Format) =>
    setFormats((s) => {
      const n = new Set(s)
      if (n.has(f)) n.delete(f)
      else n.add(f)
      return n
    })

  const chosen = items.filter((i) => selected.has(i.id))

  async function doExport() {
    const stamp = new Date().toISOString().slice(0, 10)
    setBusy(true)
    setError('')
    try {
      const entries = chosen.map(toEntry)
      if (mode === 'vault') {
        const share = await createShare(entries, password, name.trim())
        const file = `vault-share-${slug(name)}-${stamp}.vshare`
        save(await packFile(share), file)
        setDone({ file, count: entries.length })
        return
      }
      const base = `vault-${slug(name)}-${stamp}`
      const files = [...formats].flatMap((f) =>
        f === 'dbeaver'
          ? toDbeaver(entries, base)
          : f === 'postman'
            ? toPostmanEnvironment(entries, name.trim() || 'Vault')
            : f === 'csv'
              ? toPlainCsv(entries, base)
              : toPlainJson(entries, base),
      )
      if (!files.length) throw new Error('รายการที่เลือกไม่มีข้อมูลสำหรับรูปแบบที่เลือก')
      const file = `${base}.zip`
      save(await passwordZip(files, password, winZip), file)
      setDone({ file, count: entries.length, files })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <div className="pane-inner">
        <div className="share-done">
          <CheckCircle2 className="big-check" />
          <h2>ส่งออก {done.count} รายการแล้ว</h2>
          <p className="muted">
            ไฟล์ <code>{done.file}</code> อยู่ในโฟลเดอร์ Downloads
          </p>
          <div className="share-pass big">
            <span className="mono">{password}</span>
            <CopyButton value={password} label={done.files ? 'รหัส ZIP' : 'รหัสแชร์'} onCopied={toast} />
          </div>
          {done.files && (
            <>
              <p className="muted">
                แตกไฟล์ด้วย{winZip ? ' Windows (คลิกขวา → Extract All) หรือ 7-Zip' : ' 7-Zip หรือ WinRAR'} แล้วใส่รหัสด้านบน ในนั้นมี
              </p>
              <ul className="export-files">
                {done.files.map((f) => (
                  <li key={f.name}>
                    <code>{f.name}</code>
                    {f.note && <small>{f.note}</small>}
                  </li>
                ))}
              </ul>
              {done.files.some((f) => f.name.includes('-dbeaver-')) && (
                <ol className="howto">
                  <li>
                    เปิด DBeaver → <b>File → Import</b> → หมวด DBeaver เลือก <b>Custom (CSV/XML)</b>
                  </li>
                  <li>เลือก driver ให้ตรงกับไฟล์ (เช่น PostgreSQL) แล้วเลือกไฟล์ CSV ที่แตกออกมา</li>
                  <li>ติ๊ก connection ที่ต้องการแล้วกด Finish (ถ้ามีหลายไฟล์ ทำทีละไฟล์)</li>
                </ol>
              )}
              <p className="share-tip">
                <AlertTriangle />
                <span>ไฟล์ที่แตกออกมาไม่มีรหัสแล้ว นำเข้าเสร็จให้ลบทิ้ง (และล้างถังขยะ)</span>
              </p>
            </>
          )}
          <p className="share-tip">
            <AlertTriangle />
            <span>ถ้าส่งให้คนอื่น ส่งไฟล์กับรหัสคนละช่องทาง เช่น ไฟล์ทางอีเมล รหัสทาง LINE หรือบอกปากเปล่า</span>
          </p>
          <button className="btn" onClick={onClose}>
            เสร็จแล้ว
          </button>
        </div>
      </div>
    )

  const plainCount = mode === 'plain' ? chosen.filter((i) => [...formats].some((f) => !FORMATS.find((x) => x.id === f)!.accepts || FORMATS.find((x) => x.id === f)!.accepts!.includes(i.type))).length : 0
  const canExport = chosen.length > 0 && password.length >= 8 && !busy && (mode === 'vault' || (formats.size > 0 && plainCount > 0))

  return (
    <div className="pane-inner">
      <header className="pane-head">
        <div className="head-title">
          <span className="type-icon lg" style={{ '--c': 'var(--accent)' } as CSSProperties}>
            <Share2 />
          </span>
          <div>
            <p className="eyebrow">ส่งออก</p>
            <h2>{mode === 'vault' ? 'ไฟล์แชร์ Vault' : 'ไฟล์ใช้งานได้เลย'}</h2>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
      </header>

      <div className="form-body">
        <div className="mode-grid">
          <button type="button" className="mode-opt" aria-pressed={mode === 'vault'} onClick={() => setMode('vault')} style={{ '--c': 'var(--accent)' } as CSSProperties}>
            <Lock />
            <strong>ไฟล์แชร์ Vault</strong>
            <small>ผู้รับเปิดในแอพนี้ด้วยรหัสแชร์ เพิ่มเข้าคลังได้ทันที</small>
          </button>
          <button type="button" className="mode-opt" aria-pressed={mode === 'plain'} onClick={() => setMode('plain')} style={{ '--c': '#f59e0b' } as CSSProperties}>
            <FileArchive />
            <strong>ไฟล์ใช้งานได้เลย</strong>
            <small>DBeaver / Postman / CSV / JSON ใส่ใน ZIP ที่ล็อกด้วยรหัส</small>
          </button>
        </div>

        {mode === 'plain' && (
          <div className="form-row">
            <span className="form-label">ใส่อะไรใน ZIP (เลือกได้หลายอย่าง)</span>
            <div className="format-grid">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="format-opt"
                  aria-pressed={formats.has(f.id)}
                  onClick={() => toggleFormat(f.id)}
                  style={{ '--c': f.color } as CSSProperties}
                >
                  <f.Icon />
                  <strong>{f.label}</strong>
                  <small>{f.hint}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="form-row">
          <span className="form-label">{mode === 'vault' ? 'ชื่อชุด (ผู้รับจะเห็น)' : 'ชื่อไฟล์ / ชื่อ environment'}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Claim API – UAT" />
        </label>

        <div className="form-row">
          <div className="pick-head">
            <span className="form-label">
              รายการ · เลือกแล้ว {selected.size} จาก {items.length}
            </span>
            <span>
              <button className="btn ghost sm" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
                เลือกทั้งหมด
              </button>
              <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                ล้าง
              </button>
            </span>
          </div>
          <ItemPicker items={items} selected={selected} onToggle={toggle} />
        </div>

        <div className="form-row">
          <span className="form-label">{mode === 'vault' ? 'รหัสแชร์ (ผู้รับต้องใช้เปิดไฟล์)' : 'รหัส ZIP (ต้องใช้ตอนแตกไฟล์)'}</span>
          <div className="input-group">
            <input className="mono" value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} autoComplete="off" />
            <button className="icon-btn" title="สุ่มใหม่" onClick={() => setPassword(generateSharePassword())}>
              <RefreshCw />
            </button>
            <CopyButton value={password} label="รหัส" onCopied={toast} />
          </div>
          {mode === 'vault' ? (
            <p className="hint">รหัสนี้แยกจาก master password ของคุณ ผู้รับจะไม่รู้ master password และเปิดคลังของคุณไม่ได้</p>
          ) : (
            <label className="check-row zip-compat">
              <input type="checkbox" checked={winZip} onChange={(e) => setWinZip(e.target.checked)} />
              <span>
                ให้เปิดด้วย Windows ได้โดยไม่ต้องลงโปรแกรม
                <small className="muted">
                  ปกติใช้ AES-256 ซึ่งต้องเปิดด้วย 7-Zip / WinRAR ถ้าติ๊กจะใช้ ZipCrypto ที่ Windows เปิดเองได้ แต่ล็อกได้อ่อนกว่ามาก
                </small>
              </span>
            </label>
          )}
        </div>

        {error && <p className="hint error">{error}</p>}
        <div>
          <button className="btn primary" disabled={!canExport} onClick={doExport}>
            {busy ? <Loader2 className="spin" /> : <Download />} ส่งออก {(mode === 'vault' ? selected.size : plainCount) || ''} รายการ
          </button>
          {mode === 'plain' && plainCount < selected.size && (
            <p className="hint">บางรายการไม่เข้ากับรูปแบบที่เลือก (DBeaver ใช้ได้กับ Database, Postman ใช้ได้กับ .env / API / Token)</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type Opened = { name: string; entries: (Entry & { dup: boolean })[] }

export function ShareImport({
  existing,
  onImport,
  onClose,
  embedded,
}: {
  existing: DecryptedItem[]
  onImport: (entries: Entry[]) => Promise<void>
  onClose: () => void
  /** rendered inside the import tabs: no own frame/header */
  embedded?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [opened, setOpened] = useState<Opened | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<string | null>(null)

  const existingKeys = useMemo(() => new Set(existing.map((e) => `${e.type}|${e.title.toLowerCase()}|${e.environment}`)), [existing])

  async function open() {
    if (!file || !pw) return
    setBusy(true)
    setError('')
    try {
      let parsed: unknown
      try {
        parsed = await unpackFile(file)
      } catch {
        throw new Error('อ่านไฟล์ไม่ได้')
      }
      if (!isShareFile(parsed)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์แชร์ของ Vault (ถ้าเป็นไฟล์สำรองทั้งคลัง ให้กู้คืนจากหน้าตั้งค่า)')
      const res = await openShare(parsed as ShareFile, pw)
      const entries = res.entries.map((e) => ({ ...e, dup: existingKeys.has(`${e.type}|${e.title.toLowerCase()}|${e.environment}`) }))
      setOpened({ name: res.name, entries })
      setSelected(new Set(entries.flatMap((e, i) => (e.dup ? [] : [String(i)]))))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function doImport() {
    if (!opened) return
    setBusy(true)
    await onImport(
      opened.entries
        .filter((_, i) => selected.has(String(i)))
        .map(stripDup)
        .map((e) => ({ ...e, collection: target ?? (e.collection || opened.name) })),
    )
  }

  const pickerItems = opened?.entries.map((e, i) => ({ ...e, id: String(i), updatedAt: 0 })) ?? []

  return (
    <div className={embedded ? '' : 'pane-inner'}>
      {embedded ? (
        opened && <h3 className="embedded-title">{opened.name || 'ชุดที่ได้รับ'}</h3>
      ) : (
      <header className="pane-head">
        <div className="head-title">
          <span className="type-icon lg" style={{ '--c': '#5a6cf6' } as CSSProperties}>
            <Upload />
          </span>
          <div>
            <p className="eyebrow">นำเข้าไฟล์แชร์</p>
            <h2>{opened ? opened.name || 'ชุดที่ได้รับ' : 'เปิดไฟล์ที่ได้รับ'}</h2>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
      </header>
      )}

      {!opened ? (
        <div className="form-body">
          <label className="dropzone">
            <FileUp />
            <span>{file ? file.name : 'เลือกไฟล์ vault-share-….vshare'}</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <input
            className="mono"
            placeholder="รหัสแชร์ เช่น k7Fq-29xM-pR4t-Wz8n"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && open()}
            spellCheck={false}
            autoComplete="off"
          />
          {error && <p className="hint error">{error}</p>}
          <div>
            <button className="btn primary" disabled={!file || !pw || busy} onClick={open}>
              {busy ? <Loader2 className="spin" /> : null} เปิดไฟล์
            </button>
          </div>
        </div>
      ) : (
        <div className="form-body">
          <div className="form-row">
            <span className="form-label">เก็บไว้ในหมวด</span>
            <CollectionPicker
              value={target}
              onChange={setTarget}
              options={collectionsOf(existing)}
              auto={{ label: 'ตามไฟล์ที่ได้รับ', detail: collectionsOf(opened.entries.map((e) => ({ collection: e.collection || opened.name }))).join(', ') }}
            />
          </div>
          <div className="form-row">
            <span className="form-label">
              เลือกรายการที่จะเพิ่มลงคลัง · {selected.size} จาก {opened.entries.length}
            </span>
            <ItemPicker
              items={pickerItems}
              selected={selected}
              onToggle={(id) =>
                setSelected((s) => {
                  const n = new Set(s)
                  if (n.has(id)) n.delete(id)
                  else n.add(id)
                  return n
                })
              }
              dupIds={new Set(opened.entries.flatMap((e, i) => (e.dup ? [String(i)] : [])))}
            />
          </div>
          <div>
            <button className="btn primary" disabled={!selected.size || busy} onClick={doImport}>
              {busy ? <Loader2 className="spin" /> : <Download />} เพิ่ม {selected.size} รายการลงคลัง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
