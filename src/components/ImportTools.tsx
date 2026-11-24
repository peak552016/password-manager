import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, Database, Download, FileUp, FolderOpen, Loader2, Send, Share2, X } from 'lucide-react'
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
  isPostmanDump,
  isPostmanV1Collection,
  importPostmanV1Collection,
  linkEnvironments,
  type DbeaverCreds,
} from '../lib/importers'
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js'
import { ItemPicker } from './ItemPicker'
import { CollectionPicker } from './CollectionPicker'
import { collectionsOf } from '../lib/group'
import { databaseSummary } from '../lib/format'
import { ShareImport } from './Share'
import { CopyButton } from './ui'

type Source = 'dbeaver' | 'postman' | 'share'

const DBEAVER_PATH = '%APPDATA%\\DBeaverData\\workspace6'

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
    { id: 'share', label: 'ไฟล์ Vault (.vault / .vshare)', Icon: Share2, color: '#5a6cf6' },
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
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [envIdx, setEnvIdx] = useState(-1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  // DBeaver: one batch per project (files picked together / one .dbeaver folder)
  const [batches, setBatches] = useState<DbBatch[]>([])

  const existingKeys = useMemo(() => new Set(existing.map(dupKey)), [existing])

  async function run(fn: () => Promise<Parsed>) {
    setError('')
    setBusy(true)
    try {
      setParsed(await fn())
      setEnvIdx(-1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function readFiles(list: FileList | null) {
    if (!list?.length) return
    const files = [...list]
    if (source === 'postman') return run(() => parsePostman(files))
    const next = [...batches, ...groupDbeaverFiles(files, batches.length)]
    if (next.length === batches.length) {
      setError('ไม่พบ data-sources.json ในที่ที่เลือก')
      return
    }
    await run(async () => {
      const res = await parseDbeaver(next)
      setBatches(next)
      return res
    })
  }

  async function removeBatch(i: number) {
    const next = batches.filter((_, j) => j !== i)
    setBatches(next)
    if (next.length) await run(() => parseDbeaver(next))
    else setParsed(null)
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
            โฟลเดอร์ของ DBeaver อยู่ที่ (วางในช่อง address ของ File Explorer ได้)
            <span className="path">
              <code>{DBEAVER_PATH}</code>
              <CopyButton value={DBEAVER_PATH} label="path" onCopied={toast} />
            </span>
          </li>
          <li>
            <b>ง่ายสุด:</b> กด “เลือกโฟลเดอร์ workspace6” แล้วเลือกโฟลเดอร์ <code>workspace6</code> ระบบจะดึง<b>ทุกโปรเจกต์</b> (General, TLI DB, …) ให้เอง
          </li>
          <li>
            หรือเลือกไฟล์ทีละโปรเจกต์: แต่ละโปรเจกต์อยู่ที่ <code>workspace6\ชื่อโปรเจกต์\.dbeaver</code> เลือก <b>data-sources.json</b> + <b>credentials-config.json</b> พร้อมกัน แล้วกดเพิ่มโปรเจกต์ถัดไปได้เรื่อยๆ
          </li>
          <li>ไฟล์ credentials เก็บ user/password ไว้ ถ้าไม่มีจะได้แค่ host/port/database</li>
        </ol>
      ) : (
        <ol className="howto">
          <li>
            <b>Collection:</b> คลิก <code>…</code> ข้างชื่อ collection → <b>Export</b> → เลือก <b>Collection v2.1</b>
          </li>
          <li>
            <b>Environment:</b> คลิก <code>…</code> ข้างชื่อ environment → <b>Export</b>
          </li>
          <li>
            <b>เอาทั้งหมดทีเดียว:</b> Postman → <b>Settings → Data → Export data</b> ได้ไฟล์ <code>.zip</code> (ทางอีเมล) เลือกไฟล์ zip นั้นได้เลย ไม่ต้องแตก
          </li>
          <li>เลือกไฟล์ทั้งหมดพร้อมกันได้ ทั้ง collection, environment และ zip · environment ที่ชื่อตรงกับ collection จะเข้าหมวดเดียวกันให้</li>
          <li className="warn">
            <AlertTriangle />
            <span>
              Postman ส่งออกเฉพาะ <b>Initial value</b> ถ้า token อยู่แค่ใน Current value ให้กด “Persist all” ในหน้า environment ก่อน export
            </span>
          </li>
        </ol>
      )}

      <div className="drop-row">
        {source === 'dbeaver' && (
          <label className="dropzone primary">
            {busy ? <Loader2 className="spin" /> : <FolderOpen />}
            <span>เลือกโฟลเดอร์ workspace6 (ทุกโปรเจกต์)</span>
            <input
              type="file"
              {...{ webkitdirectory: '', directory: '' }}
              onChange={(e) => {
                void readFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
        <label className="dropzone">
          {busy ? <Loader2 className="spin" /> : <FileUp />}
          <span>
            {source === 'dbeaver'
              ? batches.length
                ? '+ เพิ่มไฟล์จากโปรเจกต์อื่น'
                : 'เลือกไฟล์ data-sources.json + credentials-config.json'
              : 'เลือกไฟล์ .json หรือ .zip ที่ export จาก Postman'}
          </span>
          <input
            type="file"
            multiple
            accept=".json,.zip,application/json,application/zip"
            onChange={(e) => {
              void readFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {source === 'dbeaver' && batches.length > 0 && (
        <div className="batches">
          {batches.map((b, i) => (
            <span key={i} className="batch">
              <Database /> {b.label} · {b.count ?? '…'} connection{b.creds ? '' : ' (ไม่มีรหัสผ่าน)'}
              <button className="icon-btn" aria-label={`เอา ${b.label} ออก`} onClick={() => removeBatch(i)}>
                <X />
              </button>
            </span>
          ))}
        </div>
      )}
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
            <span className="form-label">เก็บไว้ในหมวด</span>
            <CollectionPicker
              value={target}
              onChange={setTarget}
              options={collectionsOf(existing)}
              auto={{
                label: source === 'dbeaver' ? 'ตามโปรเจกต์ DBeaver' : 'ตามชื่อ Collection',
                detail: collectionsOf(finalEntries).join(', ') || 'ไม่มีชื่อ',
              }}
            />
          </div>

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
                  ? [databaseSummary(e.values), e.values.username, e.values.password ? '🔑' : ''].filter(Boolean).join(' · ')
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
                await onImport(
                  finalEntries.filter((_, i) => selected.has(String(i))).map((e) => (target === null ? e : { ...e, collection: target })),
                )
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

type Parsed = { entries: Entry[]; envs: Entry[]; notes: string[] }

interface DbBatch {
  label: string
  dataSources: File[]
  creds?: File
  count?: number
}

/**
 * Split picked files into DBeaver projects. With a folder pick, files carry
 * paths like "workspace6/TLI DB/.dbeaver/data-sources.json"; with a plain file
 * pick, everything picked together is one project.
 */
function groupDbeaverFiles(files: File[], existing: number): DbBatch[] {
  const relevant = files.filter((f) => /^(data-sources.*\.json|credentials-config\.json)$/i.test(f.name))
  const groups = new Map<string, File[]>()
  for (const f of relevant) {
    const rel = f.webkitRelativePath
    if (rel && !/(^|\/)\.dbeaver\//.test(rel)) continue
    const dir = rel ? rel.slice(0, rel.lastIndexOf('/')) : ''
    groups.set(dir, [...(groups.get(dir) ?? []), f])
  }
  const out: DbBatch[] = []
  for (const [dir, fs] of groups) {
    const dataSources = fs.filter((f) => /^data-sources/i.test(f.name))
    if (!dataSources.length) continue
    const parts = dir.split('/')
    const project = dir ? parts[parts.indexOf('.dbeaver') - 1] || parts[0] : ''
    out.push({
      label: project || `โปรเจกต์ที่ ${existing + out.length + 1}`,
      dataSources,
      creds: fs.find((f) => /credentials-config/i.test(f.name)),
    })
  }
  return out
}

async function parseDbeaver(batches: DbBatch[]): Promise<Parsed> {
  const entries: Entry[] = []
  const notes: string[] = []
  for (const b of batches) {
    let creds: DbeaverCreds = {}
    if (b.creds) {
      try {
        creds = await decryptDbeaverCredentials(await b.creds.arrayBuffer())
      } catch (e) {
        throw new Error(`${b.label}: ${e instanceof Error ? e.message : e}`)
      }
    }
    const before = entries.length
    for (const f of b.dataSources) {
      const json = await readJson(f)
      if (!isDbeaverDataSources(json)) throw new Error(`${b.label}: ${f.name} ไม่ใช่ไฟล์ data-sources ของ DBeaver`)
      entries.push(...importDbeaver(json, creds, b.label.startsWith('โปรเจกต์ที่') ? '' : b.label))
    }
    b.count = entries.length - before
  }
  notes.push(`${batches.length} โปรเจกต์`, `พบ ${entries.length} connection`)
  return { entries, envs: [], notes }
}

async function parsePostman(files: File[]): Promise<Parsed> {
  const entries: Entry[] = []
  const envs: Entry[] = []
  let cols = 0
  const take = (json: unknown, name: string, strict: boolean) => {
    if (isPostmanCollection(json)) {
      cols++
      const items = importPostmanCollection(json)
      entries.push(...items.filter((i) => i.type === 'curl'))
      envs.push(...items.filter((i) => i.type === 'env'))
    } else if (isPostmanV1Collection(json)) {
      cols++
      entries.push(...importPostmanV1Collection(json))
    } else if (isPostmanEnvironment(json)) envs.push(importPostmanEnvironment(json))
    else if (isPostmanDump(json)) {
      for (const c of json.collections ?? []) take(c, name, false)
      for (const e of json.environments ?? []) take(e, name, false)
    } else if (strict) throw new Error(`${name} ไม่ใช่ไฟล์ collection หรือ environment ของ Postman`)
  }
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      // Postman Settings → Data → Export data: a zip of collection / environment JSON files
      const zip = new ZipReader(new BlobReader(f), { useWebWorkers: false })
      for (const z of await zip.getEntries()) {
        if (z.directory || !/\.json$/i.test(z.filename)) continue
        try {
          take(JSON.parse(await z.getData(new TextWriter())), z.filename, false)
        } catch {
          /* not JSON we understand: skip */
        }
      }
      await zip.close()
    } else take(await readJson(f), f.name, true)
  }
  if (!cols && !envs.length) throw new Error('ไม่พบ collection หรือ environment ของ Postman ในไฟล์ที่เลือก')
  const names = [...new Set(entries.map((e) => e.collection).filter(Boolean))]
  // with a single collection, its environments belong to it; otherwise match by name
  if (names.length === 1) for (const e of envs) if (!e.collection) e.collection = names[0]
  linkEnvironments(envs, names)
  const notes = [`${cols} collection`, `${entries.length} request`, `${envs.length} environment`]
  return { entries, envs, notes }
}
