import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'

const EXIT = 550

/** Intro shown each time the app opens; stays until the user taps "เข้าสู่ระบบ" (or presses a key). */
export function Splash({ ready, onLeave, onDone }: { ready: boolean; onLeave: () => void; onDone: () => void }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const enter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') setEntered(true)
    }
    window.addEventListener('keydown', enter)
    return () => window.removeEventListener('keydown', enter)
  }, [])

  const leaving = ready && entered

  useEffect(() => {
    if (!leaving) return
    onLeave()
    const t = setTimeout(onDone, EXIT)
    return () => clearTimeout(t)
  }, [leaving, onDone, onLeave])

  const word = 'Password Manager'

  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} onClick={() => setEntered(true)} role="presentation">
      <div className="splash-glow" aria-hidden />
      <div className="splash-content">
        <div className="splash-mark">
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="core">
            <ShieldCheck strokeWidth={1.7} />
          </span>
        </div>
        <p className="splash-eyebrow">Welcome to</p>
        <h1 className="splash-title" aria-label={word}>
          {[...word].map((ch, i) => (
            <span key={i} style={{ animationDelay: `${700 + i * 38}ms` }} aria-hidden>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        <p className="splash-sub">ที่เก็บรหัสผ่าน · API key · token ของคุณ เข้ารหัสอยู่ในเครื่องนี้</p>
        <button className="splash-enter" onClick={() => setEntered(true)} autoFocus>
          เข้าสู่ระบบ <ArrowRight />
        </button>
      </div>
      <p className="splash-skip">แตะที่ไหนก็ได้ หรือกด Enter</p>
    </div>
  )
}
