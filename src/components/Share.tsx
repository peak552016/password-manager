import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, RefreshCw, Share2, Upload, X } from 'lucide-react'
import type { DecryptedItem, Entry } from '../lib/vault'
import { createShare, generateSharePassword, openShare, isShareFile, type ShareFile } from '../lib/share'
import { CopyButton } from './ui'
import { ItemPicker } from './ItemPicker'

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
  const [done, setDone] = useState<{ file: string; count: number } | null>(null)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function doExport() {
    setBusy(true)
    try {
      const chosen = items.filter((i) => selected.has(i.id)).map(toEntry)
      const share = await createShare(chosen, password, name.trim())
      const file = `vault-share-${slug(name)}-${new Date().toISOString().slice(0, 10)}.json`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(share)], { type: 'application/json' }))
      a.download = file
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      setDone({ file, count: chosen.length })
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
            <CopyButton value={password} label="รหัสแชร์" onCopied={toast} />
          </div>
          <p className="share-tip">
            <AlertTriangle /> ส่งไฟล์กับรหัสแชร์คนละช่องทาง เช่น ไฟล์ทางอีเมล รหัสทาง LINE หรือบอกปากเปล่า
          </p>
          <button className="btn" onClick={onClose}>
            เสร็จแล้ว
          </button>
        </div>
      </div>
    )

  return (
    <div className="pane-inner">
      <header className="pane-head">
        <div className="head-title">
          <span className="type-icon lg" style={{ '--c': 'var(--accent)' } as CSSProperties}>
            <Share2 />
          </span>
          <div>
            <p className="eyebrow">ส่งออกเพื่อแชร์</p>
            <h2>เลือกรายการที่จะแชร์</h2>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
      </header>

      <div className="form-body">
        <label className="form-row">
          <span className="form-label">ชื่อชุด (ผู้รับจะเห็น)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Claim API – UAT" autoFocus />
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
          <span className="form-label">รหัสแชร์ (ผู้รับต้องใช้เปิดไฟล์)</span>
          <div className="input-group">
            <input className="mono" value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} autoComplete="off" />
            <button className="icon-btn" title="สุ่มใหม่" onClick={() => setPassword(generateSharePassword())}>
              <RefreshCw />
            </button>
            <CopyButton value={password} label="รหัสแชร์" onCopied={toast} />
          </div>
          <p className="hint">รหัสนี้แยกจาก master password ของคุณ ผู้รับจะไม่รู้ master password และเปิดคลังของคุณไม่ได้</p>
        </div>

        <div>
          <button className="btn primary" disabled={!selected.size || password.length < 8 || busy} onClick={doExport}>
            {busy ? <Loader2 className="spin" /> : <Download />} ส่งออก {selected.size || ''} รายการ
          </button>
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

  const existingKeys = useMemo(() => new Set(existing.map((e) => `${e.type}|${e.title.toLowerCase()}|${e.environment}`)), [existing])

  async function open() {
    if (!file || !pw) return
    setBusy(true)
    setError('')
    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
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
    await onImport(opened.entries.filter((_, i) => selected.has(String(i))).map(stripDup))
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
            <span>{file ? file.name : 'เลือกไฟล์ vault-share-….json'}</span>
            <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
