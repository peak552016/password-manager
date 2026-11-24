import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ThemeSwitch } from './ThemeSwitch'

/** Shared frame for setup / unlock / restore screens. */
export function AuthShell({ title, subtitle, children, shake }: { title: string; subtitle?: ReactNode; children: ReactNode; shake?: number }) {
  return (
    <main className="auth">
      <div className="auth-bg" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="grid" />
      </div>
      <ThemeSwitch className="auth-theme" />
      <div className="auth-card" key={shake} data-shake={shake ? '' : undefined}>
        <div className="auth-mark">
          <ShieldCheck strokeWidth={1.6} />
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
      <p className="auth-foot">เข้ารหัสในเครื่อง · AES-256-GCM · Argon2id</p>
    </main>
  )
}
