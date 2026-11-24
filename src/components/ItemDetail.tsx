import { useState } from 'react'
import type { DecryptedItem } from '../lib/vault'
import { copySecret } from '../lib/clipboard'

interface Props {
  item: DecryptedItem
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ItemDetail({ item, onBack, onEdit, onDelete }: Props) {
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function copy(label: string, value: string) {
    try {
      await copySecret(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      setCopied('คัดลอกไม่สำเร็จ')
    }
  }

  const href = item.url && (item.url.includes('://') ? item.url : `https://${item.url}`)

  return (
    <main className="page">
      <header className="bar">
        <button className="link" onClick={onBack}>
          ‹ กลับ
        </button>
        <button className="link" onClick={onEdit}>
          แก้ไข
        </button>
      </header>
      <h1>{item.title || '(ไม่มีชื่อ)'}</h1>

      <dl className="fields">
        {item.username && (
          <Field label="ชื่อผู้ใช้">
            <span className="value">{item.username}</span>
            <button onClick={() => copy('ชื่อผู้ใช้', item.username)}>คัดลอก</button>
          </Field>
        )}
        <Field label="รหัสผ่าน">
          <span className="value mono">{reveal ? item.password : '••••••••••••'}</span>
          <button onClick={() => setReveal((r) => !r)}>{reveal ? 'ซ่อน' : 'แสดง'}</button>
          <button onClick={() => copy('รหัสผ่าน', item.password)}>คัดลอก</button>
        </Field>
        {item.url && (
          <Field label="เว็บไซต์">
            <a className="value" href={href} target="_blank" rel="noopener noreferrer">
              {item.url}
            </a>
          </Field>
        )}
        {item.notes && (
          <Field label="โน้ต">
            <span className="value pre">{item.notes}</span>
          </Field>
        )}
      </dl>
      {copied && <div className="toast">{copied.includes('ไม่') ? copied : `คัดลอก${copied}แล้ว (ล้างใน 30 วิ)`}</div>}

      <p className="muted small">แก้ไขล่าสุด {new Date(item.updatedAt).toLocaleString('th-TH')}</p>

      {confirmDelete ? (
        <div className="stack">
          <p>ลบ “{item.title}” ถาวร?</p>
          <button className="danger" onClick={onDelete}>
            ยืนยันลบ
          </button>
          <button className="link" onClick={() => setConfirmDelete(false)}>
            ยกเลิก
          </button>
        </div>
      ) : (
        <button className="danger ghost" onClick={() => setConfirmDelete(true)}>
          ลบรายการนี้
        </button>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
