import { useState, type FormEvent } from 'react'
import { changeMasterPassword, exportBackup, WrongPasswordError } from '../lib/vault'
import { estimateBits } from '../lib/generator'
import { Strength } from './Strength'
import { ImportBackup } from './ImportBackup'

export function Settings({ onBack, onReplaced }: { onBack: () => void; onReplaced: () => void }) {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  async function doExport() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const name = `password-backup-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([blob], name, { type: 'application/json' })
    // iOS: share sheet lets the user save to Files / iCloud Drive
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return
      } catch {
        /* cancelled; fall back to download */
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg('ส่งออกไฟล์สำรองแล้ว')
  }

  if (importing) return <ImportBackup replacing onDone={onReplaced} onCancel={() => setImporting(false)} />

  return (
    <main className="page">
      <header className="bar">
        <button className="link" onClick={onBack}>
          ‹ กลับ
        </button>
        <strong>ตั้งค่า</strong>
        <span />
      </header>

      <section className="card stack">
        <h2>สำรองข้อมูล</h2>
        <p className="muted small">
          ไฟล์สำรองถูกเข้ารหัสด้วย master password เดิม เก็บไว้ใน iCloud Drive หรือที่ปลอดภัย เพราะถ้าเครื่องหายหรือ Safari
          ล้างข้อมูล นี่คือทางเดียวที่จะกู้คืนได้
        </p>
        <button onClick={doExport}>ส่งออกไฟล์สำรอง</button>
        <button className="ghost" onClick={() => setImporting(true)}>
          กู้คืนจากไฟล์สำรอง
        </button>
        {msg && <p className="hint">{msg}</p>}
      </section>

      <ChangePassword />

      <section className="card stack">
        <h2>เกี่ยวกับความปลอดภัย</h2>
        <ul className="muted small bullets">
          <li>ข้อมูลเข้ารหัสด้วย AES-256-GCM ในเครื่อง ไม่มีการส่งออกไปที่ไหน</li>
          <li>กุญแจสร้างจาก master password ด้วย Argon2id (64 MB, 3 รอบ)</li>
          <li>ล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน 5 นาที หรือออกจากแอพเกิน 1 นาที</li>
        </ul>
      </section>
    </main>
  )
}

function ChangePassword() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const valid = cur && next.length >= 10 && next === confirm

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setMsg(null)
    try {
      await changeMasterPassword(cur, next)
      setMsg({ ok: true, text: 'เปลี่ยน master password แล้ว อย่าลืมส่งออกไฟล์สำรองใหม่' })
      setCur('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setMsg({ ok: false, text: err instanceof WrongPasswordError ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>เปลี่ยน master password</h2>
      <input type="password" placeholder="รหัสปัจจุบัน" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <input type="password" placeholder="รหัสใหม่ (อย่างน้อย 10 ตัว)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      {next && <Strength bits={estimateBits(next)} />}
      <input type="password" placeholder="ยืนยันรหัสใหม่" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {msg && <p className={`hint ${msg.ok ? '' : 'error'}`}>{msg.text}</p>}
      <button disabled={!valid || busy}>{busy ? 'กำลังเปลี่ยน…' : 'เปลี่ยนรหัส'}</button>
    </form>
  )
}
