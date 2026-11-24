import { useState, type FormEvent } from 'react'
import { unpackFile } from '../lib/container'
import { FileUp, Loader2 } from 'lucide-react'
import { importBackup, type Backup, type Session } from '../lib/vault'

interface Props {
  onDone: (s: Session) => void
  onCancel: () => void
  /** shown when an existing vault will be overwritten */
  replacing?: boolean
}

export function ImportBackup({ onDone, onCancel, replacing }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file || !pw) return
    setBusy(true)
    setError('')
    try {
      const backup = (await unpackFile(file)) as Backup
      onDone(await importBackup(backup, pw))
    } catch (err) {
      setError(err instanceof SyntaxError ? 'อ่านไฟล์ไม่ได้' : err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="auth-form import">
      {replacing && (
        <>
          <h2>กู้คืนจากไฟล์สำรอง</h2>
          <p className="hint error">ข้อมูลในเครื่องตอนนี้จะถูกแทนที่ทั้งหมด</p>
        </>
      )}
      <label className="dropzone">
        <FileUp />
        <span>{file ? file.name : 'เลือกไฟล์สำรอง (.vault)'}</span>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <input
        type="password"
        placeholder="Master password ของไฟล์สำรอง"
        autoComplete="current-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      {error && <p className="hint error">{error}</p>}
      <button className="btn primary wide" disabled={!file || !pw || busy}>
        {busy ? (
          <>
            <Loader2 className="spin" /> กำลังตรวจสอบ…
          </>
        ) : (
          'กู้คืน'
        )}
      </button>
      <button type="button" className="btn ghost wide" onClick={onCancel}>
        ยกเลิก
      </button>
    </form>
  )
}
