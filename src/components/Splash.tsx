import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

const DURATION = 2300
const EXIT = 550

/** Intro shown once each time the app opens. Click or any key skips it. */
export function Splash({ ready, onLeave, onDone }: { ready: boolean; onLeave: () => void; onDone: () => void }) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setMinElapsed(true), reduced ? 400 : DURATION)
    const skip = () => setSkipped(true)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  const leaving = ready && (minElapsed || skipped)

  useEffect(() => {
    if (!leaving) return
    onLeave()
    const t = setTimeout(onDone, EXIT)
    return () => clearTimeout(t)
  }, [leaving, onDone, onLeave])

  const word = 'Password Manager'

  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} onClick={() => setSkipped(true)} role="presentation">
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
        <div className="splash-bar" aria-hidden>
          <span />
        </div>
      </div>
      <p className="splash-skip">คลิกหรือกดปุ่มใดก็ได้เพื่อข้าม</p>
    </div>
  )
}
