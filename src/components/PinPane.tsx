import { useState, type CSSProperties, type FormEvent } from 'react'
import { Eye, KeyRound, Loader2, X } from 'lucide-react'
import { hasPin, isValidPin, PIN_MAX_TRIES, setPin, verifyPin } from '../lib/pin'

/** Ask for (or, the first time, set) the PIN that reveals every item. */
export function PinPane({
  vaultId,
  failures,
  onFail,
  onOk,
  onCancel,
}: {
  vaultId: string
  failures: number
  onFail: () => void
  onOk: () => void
  onCancel: () => void
}) {
  const [creating] = useState(() => !hasPin(vaultId))
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
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
            <p className="eyebrow">ดูทั้งหมด</p>
            <h2>{creating ? 'ตั้ง PIN ก่อน' : 'ใส่ PIN'}</h2>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="ปิด">
          <X />
        </button>
      </header>

      <div className="form-body pin-body">
        <p className="muted">
          {creating
            ? 'ครั้งแรกให้ตั้ง PIN ตัวเลข 4–8 หลัก ใช้ทุกครั้งที่จะเปิดดูรายการทั้งหมด ล็อกแอพเมื่อไหร่ก็กลับไปซ่อนเหมือนเดิม'
            : 'ใส่ PIN เพื่อแสดงรายการทั้งหมด จนกว่าจะล็อกแอพหรือกดซ่อน'}
        </p>
        <input
          key={shake}
          className={`pin-input ${shake ? 'shake' : ''}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPinValue(digits(e.target.value))}
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
          <button className="btn primary" disabled={busy || pin.length < 4 || (creating && confirm.length < 4)}>
            {busy ? <Loader2 className="spin" /> : <Eye />} {creating ? 'ตั้ง PIN และแสดงทั้งหมด' : 'แสดงทั้งหมด'}
          </button>
        </div>
        {!creating && <p className="hint">ลืม PIN? ไปที่ ตั้งค่า → ความเป็นส่วนตัว แล้วรีเซ็ตด้วย master password</p>}
      </div>
    </form>
  )
}
