import { useState, type ReactNode } from 'react'
import { BookOpen, ChevronLeft, Clock, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react'
import type { DecryptedItem } from '../lib/vault'
import { isSecretKind, typeOf, type FieldKind } from '../lib/types'
import { CopyButton, EnvBadge, RevealButton, TypeIcon } from './ui'

interface Props {
  item: DecryptedItem
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  toast: (m: string) => void
}

const toHref = (url: string) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`)

export function ItemDetail({ item, onBack, onEdit, onDelete, onToggleFavorite, toast }: Props) {
  const t = typeOf(item.type)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const expires = item.values.expiresAt ? new Date(item.values.expiresAt) : null
  const [now] = useState(() => Date.now())
  const daysLeft = expires ? Math.ceil((expires.getTime() - now) / 86_400_000) : null

  return (
    <div className="pane-inner detail" key={item.id}>
      <header className="pane-head">
        <button className="icon-btn back" onClick={onBack} aria-label="กลับ">
          <ChevronLeft />
        </button>
        <div className="head-title">
          <TypeIcon type={item.type} size="lg" />
          <div>
            <p className="eyebrow">{t.label}</p>
            <h2>
              {item.title || '(ไม่มีชื่อ)'} {item.environment && <EnvBadge env={item.environment} />}
            </h2>
          </div>
        </div>
        <div className="head-actions">
          <button
            className={`icon-btn star ${item.favorite ? 'on' : ''}`}
            onClick={onToggleFavorite}
            title={item.favorite ? 'เอาออกจากรายการโปรด' : 'ปักเป็นรายการโปรด'}
          >
            <Star />
          </button>
          <button className="btn" onClick={onEdit}>
            <Pencil /> แก้ไข
          </button>
        </div>
      </header>

      {daysLeft !== null && (
        <div className={`banner ${daysLeft < 0 ? 'bad' : daysLeft <= 14 ? 'warn' : 'ok'}`}>
          <Clock />
          {daysLeft < 0
            ? `Token หมดอายุแล้วเมื่อ ${expires!.toLocaleDateString('th-TH')}`
            : `หมดอายุในอีก ${daysLeft} วัน (${expires!.toLocaleDateString('th-TH')})`}
        </div>
      )}

      <div className="field-list">
        {t.fields.map((f, i) => {
          const v = item.values[f.key]
          if (!v) return null
          return <FieldRow key={f.key} i={i} label={f.label} value={v} kind={f.kind} toast={toast} />
        })}
        {item.knowledgeUrl && (
          <Row i={t.fields.length} label="Link Knowledge">
            <a className="knowledge" href={toHref(item.knowledgeUrl)} target="_blank" rel="noopener noreferrer">
              <BookOpen /> <span>{item.knowledgeUrl}</span> <ExternalLink className="ext" />
            </a>
          </Row>
        )}
        {item.fields.map((f, i) => (
          <FieldRow
            key={`cf${i}`}
            i={t.fields.length + 1 + i}
            label={f.label || `ฟิลด์ ${i + 1}`}
            value={f.value}
            kind={f.secret ? 'secret' : 'mono'}
            toast={toast}
          />
        ))}
        {item.notes && (
          <Row i={99} label="โน้ต">
            <p className="notes">{item.notes}</p>
          </Row>
        )}
      </div>

      <footer className="detail-foot">
        <span className="muted">แก้ไขล่าสุด {new Date(item.updatedAt).toLocaleString('th-TH')}</span>
        {confirmDelete ? (
          <span className="confirm">
            ลบถาวร?
            <button className="btn danger" onClick={onDelete}>
              ลบเลย
            </button>
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
              ไม่
            </button>
          </span>
        ) : (
          <button className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> ลบ
          </button>
        )}
      </footer>
    </div>
  )
}

function Row({ label, i, children }: { label: string; i: number; children: ReactNode }) {
  return (
    <div className="field-row" style={{ '--i': i } as React.CSSProperties}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}

function FieldRow({ label, value, kind, i, toast }: { label: string; value: string; kind: FieldKind; i: number; toast: (m: string) => void }) {
  const secret = isSecretKind(kind)
  const [shown, setShown] = useState(!secret)
  const block = kind === 'secretBlock' || kind === 'multiline'
  const isUrl = kind === 'url'

  return (
    <Row label={label} i={i}>
      <div className={`field-value ${block ? 'block' : ''}`}>
        {isUrl ? (
          <a href={toHref(value)} target="_blank" rel="noopener noreferrer" className="val link">
            {value} <ExternalLink className="ext" />
          </a>
        ) : block ? (
          <pre className={`val mono ${shown ? '' : 'concealed'}`}>{shown ? value : '•'.repeat(Math.min(value.length, 64))}</pre>
        ) : (
          <span className={`val ${kind === 'text' ? '' : 'mono'} ${shown ? '' : 'concealed'}`}>{shown ? value : '••••••••••••'}</span>
        )}
        <div className="val-actions">
          {secret && <RevealButton shown={shown} onToggle={() => setShown((s) => !s)} />}
          <CopyButton value={value} label={label} onCopied={toast} />
        </div>
      </div>
    </Row>
  )
}
