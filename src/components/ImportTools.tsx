import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, Database, Download, FileUp, Loader2, Send, Share2, X } from 'lucide-react'
import type { DecryptedItem, Entry } from '../lib/vault'
import {
  applyEnvironment,
  decryptDbeaverCredentials,
  importDbeaver,
  importPostmanCollection,
  importPostmanEnvironment,
  isDbeaverDataSources,
  isPostmanCollection,
  isPostmanEnvironment,
  type DbeaverCreds,
} from '../lib/importers'
import { ItemPicker } from './ItemPicker'
import { ShareImport } from './Share'
import { CopyButton } from './ui'

type Source = 'dbeaver' | 'postman' | 'share'

const DBEAVER_PATH = '%APPDATA%\\DBeaverData\\workspace6\\General\\.dbeaver'

const dupKey = (e: Entry) => `${e.type}|${e.title.toLowerCase()}|${e.environment}`

export function ImportTools({
  existing,
  onImport,
  onClose,
  toast,
}: {
  existing: DecryptedItem[]
  onImport: (entries: Entry[]) => Promise<void>
  onClose: () => void
  toast: (m: string) => void
}) {
  const [source, setSource] = useState<Source>('dbeaver')

  const tabs: { id: Source; label: string; Icon: typeof Database; color: string }[] = [
    { id: 'dbeaver', label: 'DBeaver', Icon: Database, color: '#16a34a' },
    { id: 'postman', label: 'Postman', Icon: Send, color: '#ff6c37' },
    { id: 'share', label: 'ไฟล์แชร์ Vault', Icon: Share2, color: '#5a6cf6' },
  ]

  return (
    <div className="pane-inner">
      <header className="pane-head">
        <div>
          <p className="eyebrow">นำเข้า</p>
          <h2>ดึงข้อมูลจากโปรแกรมอื่น</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
      </header>

      <div className="src-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={source === t.id}
            style={{ '--c': t.color } as CSSProperties}
            onClick={() => setSource(t.id)}
          >
            <t.Icon /> {t.label}
          </button>
        ))}
      </div>

      {source === 'share' ? (
        <ShareImport existing={existing} onImport={onImport} onClose={onClose} embedded />
      ) : (
        <ToolImport key={source} source={source} existing={existing} onImport={onImport} toast={toast} />
      )}
    </div>
  )
}

function ToolImport({
  source,
  existing,
  onImport,
  toast,
}: {
  source: 'dbeaver' | 'postman'
  existing: DecryptedItem[]
  onImport: (entries: Entry[]) => Promise<void>
  toast: (m: string) => void
}) {
  const [parsed, setParsed] = useState<{ entries: Entry[]; envs: Entry[]; notes: string[] } | null>(null)
  const [envIdx, setEnvIdx] = useState(-1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const existingKeys = useMemo(() => new Set(existing.map(dupKey)), [existing])

  async function readFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setBusy(true)
    try {
      const res = source === 'dbeaver' ? await parseDbeaver([...files]) : await parsePostman([...files])
      setParsed(res)
      setEnvIdx(-1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setParsed(null)
    } finally {
      setBusy(false)
    }
  }

  // what will actually be imported, after optional env substitution
  const finalEntries = useMemo(() => {
    if (!parsed) return []
    const base = envIdx >= 0 ? applyEnvironment(parsed.entries, parsed.envs[envIdx]) : parsed.entries
    return [...base, ...parsed.envs]
  }, [parsed, envIdx])

  const dupIds = useMemo(
    () => new Set(finalEntries.flatMap((e, i) => (existingKeys.has(dupKey(e)) ? [String(i)] : []))),
    [finalEntries, existingKeys],
  )

  // reselect whenever the list changes
  const listKey = finalEntries.map(dupKey).join('\n')
  const [lastKey, setLastKey] = useState('')
  if (listKey !== lastKey) {
    setLastKey(listKey)
    setSelected(new Set(finalEntries.flatMap((_, i) => (dupIds.has(String(i)) ? [] : [String(i)]))))
  }

  const withPw = finalEntries.filter((e) => e.type === 'database' && e.values.password).length

  return (
    <div className="form-body">
      {source === 'dbeaver' ? (
        <ol className="howto">
          <li>
            เปิดโฟลเดอร์นี้ใน File Explorer (วางในช่อง address แล้วกด Enter)
            <span className="path">
              <code>{DBEAVER_PATH}</code>
              <CopyButton value={DBEAVER_PATH} label="path" onCopied={toast} />
            </span>
          </li>
          <li>
            เลือก <b>data-sources.json</b> และ <b>credentials-config.json</b> พร้อมกัน (กด Ctrl ค้างแล้วคลิกทั้งสองไฟล์)
          </li>
          <li>ไฟล์ credentials เก็บ user/password ไว้ ถ้าไม่เลือกมาจะได้แค่ host/port/database</li>
        </ol>
      ) : (
        <ol className="howto">
          <li>
            <b>Collection:</b> คลิก <code>…</code> ข้างชื่อ collection → <b>Export</b> → เลือก <b>Collection v2.1</b>
          </li>
          <li>
            <b>Environment:</b> คลิก <code>…</code> ข้างชื่อ environment → <b>Export</b>
          </li>
          <li>เลือกไฟล์ทั้งหมดพร้อมกันได้ ทั้ง collection และ environment</li>
          <li className="warn">
            <AlertTriangle />
            <span>
              Postman ส่งออกเฉพาะ <b>Initial value</b> ถ้า token อยู่แค่ใน Current value ให้กด “Persist all” ในหน้า environment ก่อน export
            </span>
          </li>
        </ol>
      )}

      <label className="dropzone">
        {busy ? <Loader2 className="spin" /> : <FileUp />}
        <span>{source === 'dbeaver' ? 'เลือก data-sources.json + credentials-config.json' : 'เลือกไฟล์ .json ที่ export จาก Postman'}</span>
        <input type="file" multiple accept=".json,application/json" onChange={(e) => readFiles(e.target.files)} />
      </label>
      {error && <p className="hint error">{error}</p>}

      {parsed && (
        <>
          <div className="import-summary">
            {parsed.notes.map((n) => (
              <span key={n}>{n}</span>
            ))}
            {source === 'dbeaver' && <span>มีรหัสผ่าน {withPw} รายการ</span>}
          </div>

          {source === 'postman' && parsed.envs.length > 0 && parsed.entries.some((e) => e.type === 'curl') && (
            <label className="form-row">
              <span className="form-label">แทนค่า {'{{ตัวแปร}}'} ในคำสั่ง cURL ด้วย Environment</span>
              <select value={envIdx} onChange={(e) => setEnvIdx(+e.target.value)}>
                <option value={-1}>ไม่แทน (เก็บเป็น {'{{ตัวแปร}}'})</option>
                {parsed.envs.map((e, i) => (
                  <option key={i} value={i}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="form-row">
            <div className="pick-head">
              <span className="form-label">
                เลือกแล้ว {selected.size} จาก {finalEntries.length}
              </span>
              <span>
                <button className="btn ghost sm" onClick={() => setSelected(new Set(finalEntries.map((_, i) => String(i))))}>
                  เลือกทั้งหมด
                </button>
                <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                  ล้าง
                </button>
              </span>
            </div>
            <ItemPicker
              items={finalEntries.map((e, i) => ({ ...e, id: String(i) }))}
              selected={selected}
              dupIds={dupIds}
              subtitle={(e) =>
                e.type === 'database'
                  ? [e.values.host && `${e.values.host}${e.values.port ? ':' + e.values.port : ''}`, e.values.username, e.values.password ? '🔑' : '']
                      .filter(Boolean)
                      .join(' · ')
                  : e.values.description || e.values.project || ''
              }
              onToggle={(id) =>
                setSelected((s) => {
                  const n = new Set(s)
                  if (n.has(id)) n.delete(id)
                  else n.add(id)
                  return n
                })
              }
            />
          </div>

          <div>
            <button
              className="btn primary"
              disabled={!selected.size || busy}
              onClick={async () => {
                setBusy(true)
                await onImport(finalEntries.filter((_, i) => selected.has(String(i))))
              }}
            >
              <Download /> เพิ่ม {selected.size} รายการลงคลัง
            </button>
          </div>
        </>
      )}
    </div>
  )
}

async function readJson(f: File): Promise<unknown> {
  try {
    return JSON.parse(await f.text())
  } catch {
    throw new Error(`อ่าน ${f.name} ไม่ได้ (ไม่ใช่ JSON)`)
  }
}

async function parseDbeaver(files: File[]) {
  const credFile = files.find((f) => /credentials-config/i.test(f.name))
  const dsFiles = files.filter((f) => f !== credFile)
  if (!dsFiles.length) throw new Error('ต้องเลือก data-sources.json ด้วย')
  let creds: DbeaverCreds = {}
  const notes: string[] = []
  if (credFile) {
    creds = await decryptDbeaverCredentials(await credFile.arrayBuffer())
    notes.push('ถอดรหัส credentials แล้ว')
  } else notes.push('ไม่มี credentials-config.json จะไม่มี user/password')
  const entries: Entry[] = []
  for (const f of dsFiles) {
    const json = await readJson(f)
    if (!isDbeaverDataSources(json)) throw new Error(`${f.name} ไม่ใช่ไฟล์ data-sources ของ DBeaver`)
    entries.push(...importDbeaver(json, creds))
  }
  notes.unshift(`พบ ${entries.length} connection`)
  return { entries, envs: [], notes }
}

async function parsePostman(files: File[]) {
  const entries: Entry[] = []
  const envs: Entry[] = []
  let cols = 0
  for (const f of files) {
    const json = await readJson(f)
    if (isPostmanCollection(json)) {
      cols++
      const items = importPostmanCollection(json)
      entries.push(...items.filter((i) => i.type === 'curl'))
      envs.push(...items.filter((i) => i.type === 'env'))
    } else if (isPostmanEnvironment(json)) envs.push(importPostmanEnvironment(json))
    else throw new Error(`${f.name} ไม่ใช่ไฟล์ collection หรือ environment ของ Postman`)
  }
  const notes = [`${cols} collection`, `${entries.length} request`, `${envs.length} environment`]
  return { entries, envs, notes }
}
