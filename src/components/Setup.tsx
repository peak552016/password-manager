import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { createAccount, type Session } from '../lib/vault'
import { estimateBits } from '../lib/generator'
import { Strength } from './Strength'
import { ImportBackup } from './ImportBackup'
import { AuthShell } from './AuthShell'

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

  if (importing)
    return (
      <AuthShell title="กู้คืนจากไฟล์สำรอง">
        <ImportBackup onDone={onDone} onCancel={() => setImporting(false)} />
      </AuthShell>
    )

  return (
    <AuthShell title="สร้างคลังของคุณ" subtitle="ตั้ง master password หนึ่งตัว ใช้ปลดล็อกทุกอย่าง ข้อมูลเข้ารหัสอยู่ในเครื่องนี้เท่านั้น">
      <form onSubmit={submit} className="auth-form">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Master password"
          aria-label="Master password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {pw && <Strength bits={estimateBits(pw)} />}
        {pw && tooShort && <p className="hint">ต้องยาวอย่างน้อย {MIN_LENGTH} ตัวอักษร ลองใช้วลี 4–5 คำต่อกัน</p>}
        <input
          type="password"
          autoComplete="new-password"
          placeholder="ยืนยัน master password"
          aria-label="ยืนยัน master password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <p className="hint error">รหัสผ่านไม่ตรงกัน</p>}
        <label className="check">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>เข้าใจแล้วว่าถ้าลืม master password จะไม่มีใครกู้ข้อมูลคืนได้</span>
        </label>
        {error && <p className="hint error">{error}</p>}
        <button className="btn primary wide" disabled={!canSubmit}>
          {busy ? (
            <>
              <Loader2 className="spin" /> กำลังสร้างกุญแจ…
            </>
          ) : (
            'สร้างคลัง'
          )}
        </button>
        <button type="button" className="btn ghost wide" onClick={() => setImporting(true)}>
          มีไฟล์สำรองอยู่แล้ว? กู้คืน
        </button>
      </form>
    </AuthShell>
  )
}
