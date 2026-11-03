import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { newFieldKey, newId, TYPE_LABELS } from '../lib/fields'
import type { Collection, FieldDef, FieldType, ThemeKey } from '../lib/types'
import { CollectionSegs, TopLine } from '../components/common'
import { CollectionIcon } from '../components/Icons'
import { ICON_KEYS } from '../lib/defaults'

const THEMES: { key: ThemeKey; label: string }[] = [
  { key: 'recipe', label: '赤' }, { key: 'goods', label: '青' }, { key: 'books', label: '緑' },
  { key: 'all', label: '紫' }, { key: 'amber', label: '橙' }, { key: 'pink', label: '桃' },
]

function FieldEdit({ f, c, onChange, onDelete }: {
  f: FieldDef
  c: Collection
  onChange: (f: FieldDef) => void
  onDelete: () => void
}) {
  const [opt, setOpt] = useState('')
  const addOpt = () => {
    const v = opt.trim()
    if (v && !(f.options ?? []).includes(v)) onChange({ ...f, options: [...(f.options ?? []), v] })
    setOpt('')
  }
  return (
    <div className="fedit">
      <div className="twocol">
        <div>
          <label className="lbl" htmlFor={`fn-${f.key}`}>項目名</label>
          <input className="in" id={`fn-${f.key}`} value={f.label} onChange={(e) => onChange({ ...f, label: e.target.value })} />
        </div>
        <div>
          <label className="lbl" htmlFor={`ft-${f.key}`}>型</label>
          <select className="in" id={`ft-${f.key}`} value={f.type} onChange={(e) => {
            const type = e.target.value as FieldType
            onChange({ ...f, type, options: type === 'select' || type === 'multiselect' ? (f.options ?? []) : f.options, imageKind: type === 'image' ? (f.imageKind ?? 'photo') : f.imageKind })
          }}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <p className="hint" style={{ margin: 0 }}>型を変えても入力済みの値は消えませんが、表示されなくなることがあります。</p>
      {f.type === 'number' && (
        <div>
          <label className="lbl" htmlFor={`fu-${f.key}`}>単位</label>
          <input className="in" id={`fu-${f.key}`} value={f.unit ?? ''} placeholder="例：円" style={{ maxWidth: '8em' }} onChange={(e) => onChange({ ...f, unit: e.target.value })} />
        </div>
      )}
      {f.type === 'multiselect' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={!!f.tag} onChange={(e) => onChange({ ...f, tag: e.target.checked })} />
          タグ形式（選択肢を決めず、入力した値がそのまま候補になる）
        </label>
      )}
      {(f.type === 'select' || (f.type === 'multiselect' && !f.tag)) && (
        <div>
          <span className="lbl">選択肢（「{c.name}」専用のリスト）</span>
          <div className="sugs">
            {(f.options ?? []).map((o) => (
              <span key={o} className="tag">{o}
                <button type="button" style={{ background: 'none', border: 0, color: 'var(--muted)', paddingLeft: 5 }} aria-label={`${o}を削除`}
                  onClick={() => onChange({ ...f, options: (f.options ?? []).filter((x) => x !== o) })}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input className="in" value={opt} placeholder="選択肢を追加" onChange={(e) => setOpt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addOpt() }} />
            <button type="button" className="btn small" onClick={addOpt}>追加</button>
          </div>
        </div>
      )}
      {f.type === 'image' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={f.imageKind === 'screenshot'} onChange={(e) => onChange({ ...f, imageKind: e.target.checked ? 'screenshot' : 'photo' })} />
          スクショ用（文字が読めるよう長辺1600pxで保存）
        </label>
      )}
      <button type="button" className="btn ghost small" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={onDelete}>この項目を削除</button>
    </div>
  )
}

/** Edits one collection. Changes show at once and are saved shortly after you stop typing. */
function CollectionSettings({ initial }: { initial: Collection }) {
  const { saveCollection, deleteCollection, collections, records, setCurrentId, toast } = useApp()
  const [c, setC] = useState(initial)
  const [open, setOpen] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => { void saveCollection(c) }, 600)
    return () => clearTimeout(t)
  }, [c, saveCollection])

  const setField = (key: string, next: FieldDef) => setC((x) => ({ ...x, fields: x.fields.map((f) => (f.key === key ? next : f)) }))
  const move = (i: number, d: number) => setC((x) => {
    const fs = [...x.fields]
    ;[fs[i], fs[i + d]] = [fs[i + d], fs[i]]
    return { ...x, fields: fs }
  })
  const removeField = (f: FieldDef) => {
    if (c.cover_field_key === f.key) { toast('カバーに使っている項目は、カバーを変えてから削除できます'); return }
    if (!window.confirm(`項目「${f.label}」を削除しますか？\n（入力済みの値は画面に出なくなります）`)) return
    setC((x) => ({ ...x, fields: x.fields.filter((y) => y.key !== f.key), sub_field_key: x.sub_field_key === f.key ? null : x.sub_field_key }))
    setOpen(null)
  }
  const addField = () => {
    const label = newName.trim()
    if (!label) { toast('項目名を入力してください'); return }
    const f: FieldDef = { key: newFieldKey(), label, type: newType }
    if (newType === 'select' || newType === 'multiselect') f.options = []
    if (newType === 'image') f.imageKind = 'photo'
    setC((x) => ({ ...x, fields: [...x.fields, f], cover_field_key: x.cover_field_key ?? (newType === 'image' ? f.key : null) }))
    setOpen(f.key)
    setNewName('')
    toast(`「${label}」を追加しました`)
  }
  const removeCollection = async () => {
    const n = records.filter((r) => r.collection_id === c.id).length
    if (collections.length <= 1) { toast('最後のコレクションは削除できません'); return }
    if (!window.confirm(`コレクション「${c.name}」を削除しますか？\n中の記録 ${n}件と写真もすべて消え、元に戻せません。`)) return
    const rest = collections.filter((x) => x.id !== c.id)
    setCurrentId(rest[0].id)
    await deleteCollection(c)
    toast('コレクションを削除しました')
  }

  const images = c.fields.filter((f) => f.type === 'image')
  const texts = c.fields.filter((f) => f.type === 'text')

  return (
    <>
      <div className="sec">
        <div className="panel pad twocol">
          <div>
            <label className="lbl" htmlFor="cname">コレクション名</label>
            <input className="in" id="cname" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          </div>
          <div>
            <label className="lbl" htmlFor="cen">英語の見出し（上部に小さく表示）</label>
            <input className="in" id="cen" value={c.en_name} onChange={(e) => setC({ ...c, en_name: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="lbl" htmlFor="titlelabel">タイトルの呼び方</label>
            <input className="in" id="titlelabel" value={c.title_label} onChange={(e) => setC({ ...c, title_label: e.target.value })} />
          </div>
          <div>
            <label className="lbl" htmlFor="coversel">ギャラリーのカバーに使う画像</label>
            <select className="in" id="coversel" value={c.cover_field_key ?? ''} onChange={(e) => setC({ ...c, cover_field_key: e.target.value || null })}>
              {!images.length && <option value="">（画像の項目がありません）</option>}
              {images.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="subsel">タイトルの下に出す項目</label>
            <select className="in" id="subsel" value={c.sub_field_key ?? ''} onChange={(e) => setC({ ...c, sub_field_key: e.target.value || null })}>
              <option value="">なし（評価・カテゴリなどを自動で表示）</option>
              {texts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <span className="lbl">色</span>
            <div className="themepick">
              {THEMES.map((t) => (
                <button key={t.key} type="button" data-c={t.key} className={c.theme === t.key ? 'on' : ''} aria-label={t.label} title={t.label} onClick={() => setC({ ...c, theme: t.key })} />
              ))}
            </div>
          </div>
          <div>
            <span className="lbl">アイコン</span>
            <div className="iconpick">
              {ICON_KEYS.map((k) => (
                <button key={k} type="button" className={c.icon === k ? 'on' : ''} aria-label={k} onClick={() => setC({ ...c, icon: k })}><CollectionIcon name={k} size={22} /></button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="sec">
        <h3>FIELDS · {c.fields.length} · ↑↓ で並べ替え</h3>
        <div className="panel">
          {c.fields.map((f, i) => (
            <div key={f.key}>
              <div className="frow">
                <div className="mv">
                  <button type="button" aria-label="上へ" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" aria-label="下へ" disabled={i === c.fields.length - 1} onClick={() => move(i, 1)}>↓</button>
                </div>
                <div className="n">
                  {f.label}
                  {c.cover_field_key === f.key && <span className="cover-b">COVER</span>}
                  <span className="ty">{TYPE_LABELS[f.type]}{f.tag ? '・タグ' : ''}{f.unit ? ` ${f.unit}` : ''}{f.imageKind === 'screenshot' ? '・スクショ' : ''}</span>
                </div>
                <button type="button" className="btn ghost small" onClick={() => setOpen(open === f.key ? null : f.key)}>{open === f.key ? '閉じる' : '編集'}</button>
              </div>
              {open === f.key && <FieldEdit f={f} c={c} onChange={(nf) => setField(f.key, nf)} onDelete={() => removeField(f)} />}
            </div>
          ))}
        </div>
        <div className="addf">
          <input className="in" placeholder="新しい項目名" style={{ background: 'var(--paper)' }} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="in" style={{ background: 'var(--paper)' }} value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="button" className="btn small" onClick={addField}>追加</button>
        </div>
      </div>
      <div className="sec">
        <button type="button" className="btn ghost small" style={{ color: 'var(--danger)' }} onClick={removeCollection}>コレクション「{c.name}」を削除</button>
      </div>
    </>
  )
}

export default function Settings() {
  const { collections, currentId, setCurrentId, saveCollection, logout, pending } = useApp()
  const c = collections.find((x) => x.id === currentId) ?? collections[0]

  const addCollection = async () => {
    const name = window.prompt('新しいコレクションの名前（例：映画）')?.trim()
    if (!name) return
    const nc: Collection = {
      id: newId(), name, en_name: '', theme: 'all', icon: 'note', title_label: 'タイトル', sub_field_key: null,
      fields: [
        { key: 'photo', label: '画像', type: 'image', imageKind: 'photo' },
        { key: 'date', label: '日付', type: 'date' },
        { key: 'rating', label: '評価', type: 'rating' },
        { key: 'memo', label: 'メモ', type: 'longtext' },
      ],
      cover_field_key: 'photo', default_view: 'gallery', saved_view: { view: 'gallery', sort: 'created' }, meta: {},
      sort_order: Math.max(0, ...collections.map((x) => x.sort_order)) + 1,
    }
    await saveCollection(nc)
    setCurrentId(nc.id)
  }

  return (
    <>
      <TopLine label="SETTINGS" />
      <div className="hero-h">
        <h1>項目設定<span>.</span></h1>
        <div className="stats"><span>コードを触らずに項目を追加・変更・並べ替え</span></div>
      </div>
      <CollectionSegs extra={<button type="button" className="seg dashed" onClick={addCollection}>＋ 新しいコレクション</button>} />
      {c && <CollectionSettings key={c.id} initial={c} />}
      <div className="sec">
        <h3>ACCOUNT</h3>
        <div className="panel pad" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{pending.size ? `未送信が ${pending.size}件あります` : 'すべて送信済みです'}</span>
          <button type="button" className="btn ghost small" onClick={logout}>ログアウト</button>
        </div>
      </div>
      <p className="ver">KIROKU · {__APP_VERSION__}</p>
    </>
  )
}
