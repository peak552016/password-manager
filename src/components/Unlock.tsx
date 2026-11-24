import { useState, type FormEvent } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { unlock, WrongPasswordError, type Session } from '../lib/vault'
import { AuthShell } from './AuthShell'

export function Unlock({ onUnlock }: { onUnlock: (s: Session) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setError('')
    try {
      onUnlock(await unlock(pw))
    } catch (err) {
      setError(err instanceof WrongPasswordError ? err.message : String(err))
      setBusy(false)
      setPw('')
      setShake((s) => s + 1)
    }
  }

  return (
    <AuthShell title="ยินดีต้อนรับกลับ" subtitle="ใส่ master password เพื่อปลดล็อกคลัง" shake={shake}>
      <form onSubmit={submit} className="auth-form">
        <div className="unlock-field">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Master password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            aria-label="Master password"
          />
          <button className="btn primary icon-only" disabled={!pw || busy} aria-label="ปลดล็อก">
            {busy ? <Loader2 className="spin" /> : <ArrowRight />}
          </button>
        </div>
        {error && <p className="hint error">{error}</p>}
      </form>
    </AuthShell>
  )
}
