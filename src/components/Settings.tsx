import { useState, type FormEvent } from 'react'
import { ChevronLeft, Download, EyeOff, KeyRound, ShieldCheck, Upload } from 'lucide-react'
import { setSearchFirst, useSearchFirst } from '../lib/prefs'
import { changeMasterPassword, exportBackup, unlock, WrongPasswordError } from '../lib/vault'
import { clearPin, hasPin, verifyPin } from '../lib/pin'
import { estimateBits } from '../lib/generator'
import { Strength } from './Strength'
import { ImportBackup } from './ImportBackup'

const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

export function Settings({ vaultId, onBack, onReplaced }: { vaultId: string; onBack: () => void; onReplaced: () => void }) {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

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

        <PrivacyCard vaultId={vaultId} />

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

function PrivacyCard({ vaultId }: { vaultId: string }) {
  const searchFirst = useSearchFirst()
  const [pinSet, setPinSet] = useState(() => hasPin(vaultId))
  const [ask, setAsk] = useState<'off' | 'reset' | null>(null)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setAsk(null)
    setValue('')
    setErr('')
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      if (ask === 'off') {
        if (!(await verifyPin(vaultId, value))) throw new Error('PIN ไม่ถูกต้อง')
        setSearchFirst(false)
      } else {
        await unlock(value)
        clearPin(vaultId)
        setPinSet(false)
      }
      close()
    } catch (e) {
      setErr(e instanceof WrongPasswordError ? 'master password ไม่ถูกต้อง' : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>
        <EyeOff /> ความเป็นส่วนตัว
      </h3>
      <label className="check-row">
        <input
          type="checkbox"
          checked={searchFirst}
          onChange={(e) => {
            // turning the protection off needs the PIN, otherwise it would bypass it
            if (e.target.checked) setSearchFirst(true)
            else if (pinSet) setAsk('off')
            else setSearchFirst(false)
          }}
        />
        <span>
          ซ่อนรายการจนกว่าจะค้นหา
          <small className="muted">เข้ามาแล้วจะไม่เห็นรายการ ต้องค้นหาก่อน หรือกด “ดูทั้งหมด” แล้วใส่ PIN</small>
        </span>
      </label>
      <p className="muted pin-status">
        PIN ดูทั้งหมด: {pinSet ? <b>ตั้งไว้แล้ว</b> : 'ยังไม่ได้ตั้ง (จะให้ตั้งตอนกด “ดูทั้งหมด” ครั้งแรก)'}
        {pinSet && ask === null && (
          <button className="btn ghost sm" onClick={() => setAsk('reset')}>
            ลืม PIN / รีเซ็ต
          </button>
        )}
      </p>
      {ask && (
        <form className="inline-confirm" onSubmit={confirm}>
          <input
            type="password"
            inputMode={ask === 'off' ? 'numeric' : undefined}
            autoComplete={ask === 'off' ? 'off' : 'current-password'}
            placeholder={ask === 'off' ? 'ใส่ PIN เพื่อปิดการซ่อน' : 'ใส่ master password เพื่อลบ PIN'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button className="btn primary" disabled={!value || busy}>
            ยืนยัน
          </button>
          <button type="button" className="btn ghost" onClick={close}>
            ยกเลิก
          </button>
          {err && <p className="hint error">{err}</p>}
        </form>
      )}
    </section>
  )
}
