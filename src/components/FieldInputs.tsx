import { useState } from 'react'
import { asStrings, fmtDate, hostOf, isEmpty } from '../lib/fields'
import type { FieldDef, FieldValue } from '../lib/types'
import { Stars } from './common'

/** Read-only display of one field value. */
export function FieldDisplay({ f, v }: { f: FieldDef; v: FieldValue | undefined }) {
  if (isEmpty(v)) return <span className="empty">未入力</span>
  switch (f.type) {
    case 'rating': return <Stars n={v as number} size={17} />
    case 'number': return <span className="mono">{Number(v).toLocaleString()}{f.unit ?? ''}</span>
    case 'multiselect':
      return <>{asStrings(v).map((x) => <span key={x} className="tag">{f.tag && <span className="h">#</span>}{x}</span>)}</>
    case 'date': return <span className="mono">{fmtDate(v as string)}</span>
    case 'url':
      return <a href={String(v)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c)', fontWeight: 500 }}>{hostOf(String(v))} ↗</a>
    default: return <>{String(v)}</>
  }
}

/** Tag / multi-choice input: pick from suggestions or type a new value and press Enter. */
function TagInput({ f, value, pool, onChange, onNewOption }: {
  f: FieldDef
  value: string[]
  pool: string[]
  onChange: (v: string[]) => void
  onNewOption: (opt: string) => void
}) {
  const [q, setQ] = useState('')
  const term = q.trim()
  const hits = pool.filter((t) => !value.includes(t) && t.includes(term)).slice(0, 10)
  const exact = pool.includes(term) || value.includes(term)
  const add = (t: string) => {
    if (!t || value.includes(t)) return
    onChange([...value, t])
    if (!f.tag && !(f.options ?? []).includes(t)) onNewOption(t)
    setQ('')
  }
  return (
    <div className="tagin">
      {value.length > 0 && (
        <div className="sel">
          {value.map((t) => (
            <span key={t} className="tag">
              {f.tag && <span className="h">#</span>}{t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`${t}を外す`}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="in"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(term) }
        }}
        placeholder={f.tag ? '入力して追加（過去のタグを候補表示）' : '選ぶ、または入力して追加'}
        autoComplete="off"
        enterKeyHint="done"
      />
      <div className="sugs">
        {hits.map((t) => <button key={t} type="button" onClick={() => add(t)}>{f.tag ? '#' : ''}{t}</button>)}
        {term && !exact && <button type="button" className="new" onClick={() => add(term)}>＋「{term}」を追加</button>}
      </div>
    </div>
  )
}

/** Editable input for one non-image field. */
export function FieldEditor({ f, v, pool, onChange, onNewOption }: {
  f: FieldDef
  v: FieldValue | undefined
  pool: string[]
  onChange: (v: FieldValue) => void
  onNewOption: (opt: string) => void
}) {
  const id = `ed-${f.key}`
  switch (f.type) {
    case 'text':
      return <input className="in" id={id} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'url':
      return <input className="in" id={id} type="url" inputMode="url" placeholder="https://" value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value.trim())} />
    case 'longtext':
      return <textarea className="in" id={id} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return (
        <>
          <input className="in" id={id} type="number" inputMode="decimal" style={{ maxWidth: '10em' }}
            value={typeof v === 'number' ? v : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
          {f.unit}
        </>
      )
    case 'date':
      return (
        <>
          <input className="in" id={id} type="date" style={{ maxWidth: '12em' }} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
          {!v && <button type="button" className="btn ghost small" onClick={() => {
            const d = new Date()
            onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
          }}>今日</button>}
        </>
      )
    case 'rating':
      return (
        <div className="starin">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={((v as number) ?? 0) >= n ? 'on' : ''} aria-label={`${n}つ星`}
              onClick={() => onChange(v === n ? null : n)}>★</button>
          ))}
        </div>
      )
    case 'select':
      return (
        <div className="tagin">
          <select className="in" id={id} style={{ maxWidth: '16em' }} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">未選択</option>
            {[...new Set([...(f.options ?? []), ...(v ? [v as string] : [])])].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NewOption onAdd={(o) => { onNewOption(o); onChange(o) }} />
        </div>
      )
    case 'multiselect':
      return <TagInput f={f} value={asStrings(v)} pool={pool} onChange={onChange} onNewOption={onNewOption} />
    default:
      return null
  }
}

function NewOption({ onAdd }: { onAdd: (o: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  if (!open) return <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>＋ 選択肢を追加</button>
  const submit = () => { const t = q.trim(); if (t) onAdd(t); setQ(''); setOpen(false) }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input className="in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="新しい選択肢"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
      <button type="button" className="btn small" onClick={submit}>追加</button>
    </div>
  )
}
