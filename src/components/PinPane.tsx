import { useState, type CSSProperties, type FormEvent } from 'react'
import { Eye, KeyRound, Loader2, X } from 'lucide-react'
import { clearPin, hasPin, isValidPin, PIN_MAX_TRIES, setPin, verifyPin } from '../lib/pin'
import { unlock, WrongPasswordError } from '../lib/vault'

/** Ask for (or, the first time, set) the PIN that reveals every item. */
export function PinPane({
  vaultId,
  failures,
  onFail,
  onOk,
  onCancel,
  title,
}: {
  title?: string
  vaultId: string
  failures: number
  onFail: () => void
  onOk: () => void
  onCancel: () => void
}) {
  const [creating, setCreating] = useState(() => !hasPin(vaultId))
  const [forgot, setForgot] = useState(false)
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (forgot) {
      setBusy(true)
      try {
        await unlock(pin)
        clearPin(vaultId)
        setForgot(false)
        setCreating(true)
        setPinValue('')
      } catch (err) {
        setError(err instanceof WrongPasswordError ? 'master password ไม่ถูกต้อง' : String(err))
      } finally {
        setBusy(false)
      }
      return
    }
    if (creating) {
      if (!isValidPin(pin)) return setError('PIN ต้องเป็นตัวเลข 4–8 หลัก')
      if (pin !== confirm) return setError('PIN สองช่องไม่ตรงกัน')
      setBusy(true)
      await setPin(vaultId, pin)
      return onOk()
    }
    setBusy(true)
    const ok = await verifyPin(vaultId, pin)
    setBusy(false)
    if (ok) return onOk()
    setPinValue('')
    setShake((n) => n + 1)
    const left = PIN_MAX_TRIES - failures - 1
    setError(left > 0 ? `PIN ไม่ถูกต้อง เหลืออีก ${left} ครั้ง ก่อนแอพจะล็อก` : 'PIN ผิดเกินกำหนด กำลังล็อก…')
    onFail()
  }

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  return (
    <form className="pane-inner pin-pane" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <header className="pane-head">
        <div className="head-title">
          <span className="type-icon lg" style={{ '--c': '#f5b544' } as CSSProperties}>
            {creating ? <KeyRound /> : <Eye />}
          </span>
          <div>
            <p className="eyebrow">{title ? 'ต้องใช้ PIN' : 'ดูทั้งหมด'}</p>
            <h2>{creating ? 'ตั้ง PIN ก่อน' : title ?? 'ใส่ PIN'}</h2>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="ปิด">
          <X />
        </button>
      </header>

      <div className="form-body pin-body">
        <p className="muted">
          {forgot
            ? 'ใส่ master password เพื่อลบ PIN เดิม แล้วตั้ง PIN ใหม่'
            : creating
            ? 'ครั้งแรกให้ตั้ง PIN ตัวเลข 4–8 หลัก ใช้ตอนดูรายการทั้งหมด นำเข้า ส่งออก และตั้งค่า ใส่ครั้งเดียวใช้ได้จนกว่าจะล็อกแอพ'
            : title
              ? 'หน้า นำเข้า / ส่งออก / ตั้งค่า ต้องใส่ PIN ก่อน ใส่ครั้งเดียวใช้ได้จนกว่าจะล็อกแอพ'
              : 'ใส่ PIN เพื่อแสดงรายการทั้งหมด จนกว่าจะล็อกแอพหรือกดซ่อน'}
        </p>
        <input
          key={shake}
          className={`pin-input ${shake ? 'shake' : ''} ${forgot ? 'pw' : ''}`}
          type="password"
          inputMode={forgot ? undefined : 'numeric'}
          autoComplete={forgot ? 'current-password' : 'off'}
          placeholder={forgot ? 'master password' : 'PIN'}
          value={pin}
          onChange={(e) => setPinValue(forgot ? e.target.value : digits(e.target.value))}
          autoFocus
        />
        {creating && (
          <input
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ยืนยัน PIN"
            value={confirm}
            onChange={(e) => setConfirm(digits(e.target.value))}
          />
        )}
        {error && <p className="hint error">{error}</p>}
        <div>
          <button className="btn primary" disabled={busy || (forgot ? !pin : pin.length < 4 || (creating && confirm.length < 4))}>
            {busy ? <Loader2 className="spin" /> : <Eye />} {forgot ? 'รีเซ็ต PIN' : title ? (creating ? 'ตั้ง PIN และเข้าต่อ' : 'ยืนยัน') : creating ? 'ตั้ง PIN และแสดงทั้งหมด' : 'แสดงทั้งหมด'}
          </button>
        </div>
        {!creating && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setForgot(!forgot)
              setPinValue('')
              setError('')
            }}
          >
            {forgot ? 'กลับไปใส่ PIN' : 'ลืม PIN? รีเซ็ตด้วย master password'}
          </button>
        )}
      </div>
    </form>
  )
}
