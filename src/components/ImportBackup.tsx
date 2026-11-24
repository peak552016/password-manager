import { useState, type FormEvent } from 'react'
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
      const backup = JSON.parse(await file.text()) as Backup
      onDone(await importBackup(backup, pw))
    } catch (err) {
      setError(err instanceof SyntaxError ? 'อ่านไฟล์ไม่ได้' : err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <h1>กู้คืนจากไฟล์สำรอง</h1>
      {replacing && <p className="hint error">ข้อมูลในเครื่องตอนนี้จะถูกแทนที่ทั้งหมด</p>}
      <form onSubmit={submit} className="stack">
        <label>
          ไฟล์สำรอง (.json)
          <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Master password ของไฟล์สำรอง
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {error && <p className="hint error">{error}</p>}
        <button className="primary" disabled={!file || !pw || busy}>
          {busy ? 'กำลังตรวจสอบ…' : 'กู้คืน'}
        </button>
        <button type="button" className="link" onClick={onCancel}>
          ยกเลิก
        </button>
      </form>
    </main>
  )
}
