import { useState, type FormEvent } from 'react'
import { Plus, RefreshCw, X, Lock, Unlock as UnlockIcon } from 'lucide-react'
import { EMPTY_ENTRY, type CustomField, type Entry } from '../lib/vault'
import { DEFAULT_GEN, estimateBits, generatePassword, type GenOptions } from '../lib/generator'
import { typeOf, type FieldDef } from '../lib/types'
import { ENVIRONMENTS } from '../lib/env'
import { Strength } from './Strength'
import { RevealButton, TypeIcon } from './ui'

interface Props {
  initial?: Entry
  /** type for a new entry */
  type: string
  onSave: (e: Entry) => Promise<void>
  onCancel: () => void
}

const NO_AUTOFILL = { autoCapitalize: 'off', autoCorrect: 'off', autoComplete: 'off', spellCheck: false } as const

export function ItemEditor({ initial, type, onSave, onCancel }: Props) {
  const t = typeOf(initial?.type ?? type)
  const [entry, setEntry] = useState<Entry>(() => {
    if (initial) return structuredClone(initial)
    const values: Record<string, string> = {}
    // new logins start with a strong generated password
    if (t.id === 'login') values.password = generatePassword(DEFAULT_GEN)
    return { ...EMPTY_ENTRY, type: t.id, values }
  })
  const [busy, setBusy] = useState(false)

  const patch = (p: Partial<Entry>) => setEntry((e) => ({ ...e, ...p }))
  const setValue = (k: string, v: string) => setEntry((e) => ({ ...e, values: { ...e.values, [k]: v } }))
  const setField = (i: number, p: Partial<CustomField>) =>
    patch({ fields: entry.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!entry.title.trim()) return
    setBusy(true)
    const values = Object.fromEntries(Object.entries(entry.values).filter(([, v]) => v !== ''))
    await onSave({ ...entry, title: entry.title.trim(), values, fields: entry.fields.filter((f) => f.label.trim() || f.value) })
  }

  return (
    <form className="pane-inner editor" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <header className="pane-head">
        <div className="head-title">
          <TypeIcon type={t.id} size="lg" />
          <div>
            <p className="eyebrow">{initial ? 'แก้ไข' : 'ใหม่'} · {t.label}</p>
            <input
              className="title-input"
              value={entry.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="ตั้งชื่อรายการ"
              autoFocus
              required
            />
          </div>
        </div>
        <div className="head-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="btn primary" disabled={busy || !entry.title.trim()}>
            บันทึก
          </button>
        </div>
      </header>

      <div className="form-body">
        {t.technical && (
          <div className="form-row">
            <span className="form-label">Environment</span>
            <div className="env-picker">
              {ENVIRONMENTS.map((env) => (
                <button
                  key={env}
                  type="button"
                  className={`env-opt env-${env.toLowerCase()}`}
                  aria-pressed={entry.environment === env}
                  onClick={() => patch({ environment: entry.environment === env ? '' : env })}
                >
                  {env}
                </button>
              ))}
              <input
                className="env-custom"
                value={ENVIRONMENTS.includes(entry.environment) ? '' : entry.environment}
                onChange={(e) => patch({ environment: e.target.value.toUpperCase() })}
                placeholder="อื่นๆ"
                {...NO_AUTOFILL}
              />
            </div>
          </div>
        )}

        {t.fields.map((f) => (
          <FieldInput key={f.key} def={f} value={entry.values[f.key] ?? ''} onChange={(v) => setValue(f.key, v)} isNew={!initial} />
        ))}

        {t.technical && (
          <label className="form-row">
            <span className="form-label">Link Knowledge</span>
            <input
              value={entry.knowledgeUrl}
              onChange={(e) => patch({ knowledgeUrl: e.target.value })}
              type="text"
              inputMode="url"
              placeholder="ลิงก์เอกสาร / Confluence / Wiki"
              {...NO_AUTOFILL}
            />
          </label>
        )}

        <div className="form-row">
          <span className="form-label">ฟิลด์เพิ่มเติม</span>
          <div className="custom-fields">
            {entry.fields.map((f, i) => (
              <div key={i} className="custom-field">
                <input
                  className="cf-label"
                  placeholder="ชื่อฟิลด์"
                  value={f.label}
                  onChange={(e) => setField(i, { label: e.target.value })}
                  {...NO_AUTOFILL}
                />
                <input
                  className="cf-value mono"
                  placeholder="ค่า"
                  type={f.secret ? 'password' : 'text'}
                  value={f.value}
                  onChange={(e) => setField(i, { value: e.target.value })}
                  {...NO_AUTOFILL}
                />
                <button
                  type="button"
                  className={`icon-btn ${f.secret ? 'on' : ''}`}
                  title={f.secret ? 'เป็นความลับ (ซ่อน)' : 'ไม่ใช่ความลับ'}
                  onClick={() => setField(i, { secret: !f.secret })}
                >
                  {f.secret ? <Lock /> : <UnlockIcon />}
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="ลบฟิลด์"
                  onClick={() => patch({ fields: entry.fields.filter((_, j) => j !== i) })}
                >
                  <X />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn dashed"
              onClick={() => patch({ fields: [...entry.fields, { label: '', value: '', secret: true }] })}
            >
              <Plus /> เพิ่มฟิลด์
            </button>
          </div>
        </div>

        <label className="form-row">
          <span className="form-label">โน้ต</span>
          <textarea value={entry.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} />
        </label>
      </div>
    </form>
  )
}

function FieldInput({ def, value, onChange, isNew }: { def: FieldDef; value: string; onChange: (v: string) => void; isNew: boolean }) {
  const [shown, setShown] = useState(def.kind === 'password' && isNew)
  const [gen, setGen] = useState<GenOptions | null>(null)

  const label = <span className="form-label">{def.label}</span>

  switch (def.kind) {
    case 'secretBlock':
      return (
        <div className="form-row">
          {label}
          <div className="block-input">
            <textarea
              className={`mono ${shown ? '' : 'masked'}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={def.placeholder}
              rows={5}
              {...NO_AUTOFILL}
            />
            <div className="block-tools">
              <RevealButton shown={shown} onToggle={() => setShown((s) => !s)} />
            </div>
          </div>
        </div>
      )
    case 'multiline':
      return (
        <label className="form-row">
          {label}
          <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} rows={3} />
        </label>
      )
    case 'secret':
    case 'password':
      return (
        <div className="form-row">
          {label}
          <div className="input-group">
            <input
              className="mono"
              type={shown ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={def.placeholder}
              {...NO_AUTOFILL}
            />
            <RevealButton shown={shown} onToggle={() => setShown((s) => !s)} />
            {def.kind === 'password' && (
              <button
                type="button"
                className={`icon-btn ${gen ? 'on' : ''}`}
                title="สร้างรหัสผ่านแบบสุ่ม"
                onClick={() => {
                  setGen((g) => (g ? null : DEFAULT_GEN))
                  if (!gen) {
                    onChange(generatePassword(DEFAULT_GEN))
                    setShown(true)
                  }
                }}
              >
                <RefreshCw />
              </button>
            )}
          </div>
          {def.kind === 'password' && value && <Strength bits={estimateBits(value)} />}
          {def.kind === 'password' && gen && <Generator opts={gen} setOpts={setGen} onGenerate={onChange} />}
        </div>
      )
    default:
      return (
        <label className="form-row">
          {label}
          <input
            className={def.kind === 'mono' ? 'mono' : ''}
            type={def.kind === 'date' ? 'date' : 'text'}
            inputMode={def.kind === 'url' ? 'url' : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.placeholder}
            {...NO_AUTOFILL}
          />
        </label>
      )
  }
}

function Generator({
  opts,
  setOpts,
  onGenerate,
}: {
  opts: GenOptions
  setOpts: (o: GenOptions) => void
  onGenerate: (pw: string) => void
}) {
  function update(p: Partial<GenOptions>) {
    const next = { ...opts, ...p }
    setOpts(next)
    try {
      onGenerate(generatePassword(next))
    } catch {
      /* no set selected */
    }
  }
  return (
    <div className="generator">
      <div className="gen-len">
        <span>ความยาว</span>
        <input type="range" min={8} max={64} value={opts.length} onChange={(e) => update({ length: +e.target.value })} />
        <output>{opts.length}</output>
      </div>
      <div className="gen-opts">
        {(
          [
            ['lower', 'a-z'],
            ['upper', 'A-Z'],
            ['digits', '0-9'],
            ['symbols', '!@#'],
            ['avoidAmbiguous', 'ตัด 0/O 1/l'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className="toggle" aria-pressed={opts[k]} onClick={() => update({ [k]: !opts[k] })}>
            {l}
          </button>
        ))}
        <button type="button" className="icon-btn" title="สุ่มใหม่" onClick={() => update({})}>
          <RefreshCw />
        </button>
      </div>
    </div>
  )
}
