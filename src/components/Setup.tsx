import { useState, type FormEvent } from 'react'
import { createAccount, type Session } from '../lib/vault'
import { estimateBits } from '../lib/generator'
import { Strength } from './Strength'
import { ImportBackup } from './ImportBackup'

const MIN_LENGTH = 10

export function Setup({ onDone }: { onDone: (s: Session) => void }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const tooShort = pw.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && pw !== confirm
  const canSubmit = !tooShort && pw === confirm && ack && !busy

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      onDone(await createAccount(pw))
    } catch (err) {
      setError(String(err))
      setBusy(false)
    }
  }

  if (importing) return <ImportBackup onDone={onDone} onCancel={() => setImporting(false)} />

  return (
    <main className="auth">
      <div className="logo" aria-hidden>
        🔐
      </div>
      <h1>สร้างคลังรหัสผ่าน</h1>
      <p className="muted">ตั้ง master password สำหรับปลดล็อกคลัง ข้อมูลทั้งหมดจะเข้ารหัสอยู่ในเครื่องนี้เท่านั้น</p>
      <form onSubmit={submit} className="stack">
        <label>
          Master password
          <input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
        </label>
        {pw && <Strength bits={estimateBits(pw)} />}
        {pw && tooShort && <p className="hint">ต้องยาวอย่างน้อย {MIN_LENGTH} ตัวอักษร</p>}
        <label>
          ยืนยัน master password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {mismatch && <p className="hint error">รหัสผ่านไม่ตรงกัน</p>}
        <label className="check">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>เข้าใจแล้วว่าถ้าลืม master password จะกู้ข้อมูลคืนไม่ได้</span>
        </label>
        {error && <p className="hint error">{error}</p>}
        <button className="primary" disabled={!canSubmit}>
          {busy ? 'กำลังสร้างกุญแจ…' : 'สร้างคลัง'}
        </button>
        <button type="button" className="link" onClick={() => setImporting(true)}>
          กู้คืนจากไฟล์สำรอง
        </button>
      </form>
    </main>
  )
}
