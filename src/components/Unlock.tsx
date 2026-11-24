import { useState, type FormEvent } from 'react'
import { unlock, WrongPasswordError, type Session } from '../lib/vault'

export function Unlock({ onUnlock }: { onUnlock: (s: Session) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    }
  }

  return (
    <main className="auth">
      <div className="logo" aria-hidden>
        🔒
      </div>
      <h1>คลังถูกล็อกอยู่</h1>
      <form onSubmit={submit} className="stack">
        <label>
          Master password
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="hint error">{error}</p>}
        <button className="primary" disabled={!pw || busy}>
          {busy ? 'กำลังปลดล็อก…' : 'ปลดล็อก'}
        </button>
      </form>
    </main>
  )
}
