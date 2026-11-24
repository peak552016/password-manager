import { useState, type FormEvent } from 'react'
import { ChevronLeft, Download, EyeOff, KeyRound, ShieldCheck, Upload } from 'lucide-react'
import { setSearchFirst, useSearchFirst } from '../lib/prefs'
import { changeMasterPassword, exportBackup, WrongPasswordError } from '../lib/vault'
import { estimateBits } from '../lib/generator'
import { Strength } from './Strength'
import { ImportBackup } from './ImportBackup'

const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

export function Settings({ onBack, onReplaced }: { onBack: () => void; onReplaced: () => void }) {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const searchFirst = useSearchFirst()

  async function doExport() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const name = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`
    // iOS: share sheet lets the user save to Files / iCloud Drive
    if (isIOS) {
      const file = new File([blob], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name })
          return
        } catch {
          /* cancelled; fall back to download */
        }
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg(`ดาวน์โหลด ${name} แล้ว`)
  }

  if (importing)
    return (
      <div className="pane-inner">
        <ImportBackup replacing onDone={onReplaced} onCancel={() => setImporting(false)} />
      </div>
    )

  return (
    <div className="pane-inner">
      <header className="pane-head">
        <button className="icon-btn back" onClick={onBack} aria-label="กลับ">
          <ChevronLeft />
        </button>
        <div>
          <p className="eyebrow">Vault</p>
          <h2>ตั้งค่า</h2>
        </div>
      </header>

      <div className="settings">
        <section className="card">
          <h3>
            <Download /> สำรองข้อมูล
          </h3>
          <p className="muted">
            ไฟล์สำรองเข้ารหัสด้วย master password ปัจจุบัน ควรเก็บไว้นอกเครื่องนี้ เพราะถ้าล้างเบราว์เซอร์หรือเปลี่ยนเครื่อง
            นี่คือทางเดียวที่จะกู้ข้อมูลคืนได้
          </p>
          <div className="row-actions">
            <button className="btn primary" onClick={doExport}>
              <Download /> ส่งออกไฟล์สำรอง
            </button>
            <button className="btn" onClick={() => setImporting(true)}>
              <Upload /> กู้คืนจากไฟล์
            </button>
          </div>
          {msg && <p className="hint ok">{msg}</p>}
        </section>

        <section className="card">
          <h3>
            <EyeOff /> ความเป็นส่วนตัว
          </h3>
          <label className="check-row">
            <input type="checkbox" checked={searchFirst} onChange={(e) => setSearchFirst(e.target.checked)} />
            <span>
              ซ่อนรายการจนกว่าจะค้นหา
              <small className="muted">เข้ามาแล้วจะไม่เห็นรายการ ต้องพิมพ์ชื่อในช่องค้นหาก่อน หรือกดเลือกหมวด / รายการโปรด</small>
            </span>
          </label>
        </section>

        <ChangePassword />

        <section className="card">
          <h3>
            <ShieldCheck /> ความปลอดภัย
          </h3>
          <ul className="facts">
            <li>
              <b>AES-256-GCM</b> เข้ารหัสทุกฟิลด์ในเครื่อง ไม่มีข้อมูลออกนอกเครื่อง
            </li>
            <li>
              <b>Argon2id</b> 64 MB × 3 รอบ สร้างกุญแจจาก master password
            </li>
            <li>
              <b>ล็อกอัตโนมัติ</b> เมื่อไม่ได้ใช้ 5 นาที หรือย่อหน้าต่างเกิน 1 นาที
            </li>
            <li>
              <b>Clipboard</b> ถูกล้างหลังคัดลอก 30 วินาที
            </li>
          </ul>
        </section>
      </div>
    </div>
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
    <form className="card" onSubmit={submit}>
      <h3>
        <KeyRound /> เปลี่ยน master password
      </h3>
      <div className="form-body tight">
        <input type="password" placeholder="รหัสปัจจุบัน" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" placeholder="รหัสใหม่ (อย่างน้อย 10 ตัว)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        {next && <Strength bits={estimateBits(next)} />}
        <input type="password" placeholder="ยืนยันรหัสใหม่" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {msg && <p className={`hint ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>}
        <div>
          <button className="btn" disabled={!valid || busy}>
            {busy ? 'กำลังเปลี่ยน…' : 'เปลี่ยนรหัส'}
          </button>
        </div>
      </div>
    </form>
  )
}
