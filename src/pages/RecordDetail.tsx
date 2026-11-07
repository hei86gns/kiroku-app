import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { asImages, coverOf, durationOf, fmtDate, maxSideFor, numbering, recordNo, subTextOf, tagsInUse } from '../lib/fields'
import { prepareImages, toNewImages } from '../lib/image'
import { hasPointer, NO_IMAGE, pasteFromClipboard, useDropImages, usePasteImages } from '../lib/pasteDrop'
import type { FieldDef, FieldValue, ImageRef, KRecord } from '../lib/types'
import { Header, Img, Pend } from '../components/common'
import { FieldDisplay, FieldEditor } from '../components/FieldInputs'
import Lightbox from '../components/Lightbox'
import { IcClip } from '../components/Icons'

function ImageStrip({ images, editing, onZoom, onChange, onAdd }: {
  images: ImageRef[]
  editing: boolean
  onZoom: (i: number) => void
  onChange: (next: ImageRef[]) => void
  onAdd: (files: File[]) => void
}) {
  const { toast } = useApp()
  const drop = useDropImages(onAdd, editing)
  if (!images.length && !editing) return <span className="empty">なし</span>
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className={`strip ${drop.over ? 'dropping' : ''}`} {...drop.props}>
      {images.map((im, i) => (
        <div className="im" key={im.path}>
          <Img image={im} thumb onClick={() => onZoom(i)} />
          {editing && (
            <div className="ctl">
              <button type="button" onClick={() => move(i, -1)} aria-label="左へ">‹</button>
              <button type="button" className="x" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label="削除">×</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="右へ">›</button>
            </div>
          )}
        </div>
      ))}
      {editing && (
        <label className="addimg">
          ＋<br />追加
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { onAdd([...(e.target.files ?? [])]); e.target.value = '' }} />
        </label>
      )}
      {editing && hasPointer() && (
        <button type="button" className="addimg" onClick={() => void pasteFromClipboard(onAdd, toast)} title="コピーしたスクショをここに入れます（⌘V でも可）">
          <span><IcClip /><br />貼り付け</span>
        </button>
      )}
    </div>
  )
}

export default function RecordDetail({ recordId, startEditing, justSaved, onBack }: {
  recordId: string
  startEditing: boolean
  justSaved: boolean
  onBack: () => void
}) {
  const { collections, records, saveRecord, deleteRecord, saveCollection, toast, userId, pending } = useApp()
  const record = records.find((r) => r.id === recordId)
  const c = collections.find((x) => x.id === record?.collection_id)
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState<KRecord | null>(startEditing && record ? record : null)
  const [zoom, setZoom] = useState<{ images: ImageRef[]; i: number } | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const pan = useRef<{ px: number; py: number; x: number; y: number; ox: number; oy: number } | null>(null)
  const nos = useMemo(() => (c ? numbering(c, records) : new Map<string, number>()), [c, records])

  /** Shrinks and adds pictures to a field. Works outside edit mode too (paste / drop on the photo). */
  const addImages = async (f: FieldDef, files: File[]) => {
    const base = editing && draft ? draft : record
    if (!base || !c || !files.length) return
    setBusy(true)
    const { images, failed } = await prepareImages(files, maxSideFor(f), `${userId}/${c.id}/${base.id}`)
    setBusy(false)
    if (failed) toast('読み込めない画像がありました。JPEG か PNG で試してください。')
    if (!images.length) return
    const next = { ...base, data: { ...base.data, [f.key]: [...asImages(base.data[f.key]), ...images.map((i) => i.ref)] } }
    if (editing) setDraft(next)
    await saveRecord(next, toNewImages(images))
    toast(`${f.label}に${images.length}枚追加しました`)
  }

  // ⌘V / drop on the big photo → the cover field (読書記録ならカバー)
  const coverField = c && (c.fields.find((x) => x.key === c.cover_field_key && x.type === 'image') ?? c.fields.find((x) => x.type === 'image'))
  const addToCover = (files: File[]) => { if (coverField) void addImages(coverField, files) }
  usePasteImages((files) => (files.length ? addToCover(files) : toast(NO_IMAGE)), !!coverField)
  const heroDrop = useDropImages(addToCover, !!coverField)

  // Autosave edits shortly after typing stops
  const savedRef = useRef(record)
  useEffect(() => { savedRef.current = record }, [record])
  useEffect(() => {
    if (!draft || !savedRef.current || draft === savedRef.current) return
    const t = setTimeout(() => {
      if (draft.title.trim()) void saveRecord(draft)
    }, 700)
    return () => clearTimeout(t)
  }, [draft, saveRecord])

  if (!record || !c) {
    return <><Header title="" onBack={onBack} /><div className="emptybox"><b>見つかりません</b>この記録は削除されました。</div></>
  }

  const r = editing && draft ? draft : record
  const set = (key: string, v: FieldValue) => setDraft((d) => (d ? { ...d, data: { ...d.data, [key]: v } } : d))

  const startEdit = () => { setDraft(record); setEditing(true) }
  const finish = async () => {
    if (draft && draft !== record) {
      if (!draft.title.trim()) { toast(`${c.title_label}を入力してください`); return }
      await saveRecord(draft)
    }
    setEditing(false)
    setDraft(null)
    toast(navigator.onLine ? '保存しました' : '端末に保存しました（未送信）')
  }

  const addOption = (f: FieldDef, opt: string) => {
    saveCollection({ ...c, fields: c.fields.map((x) => (x.key === f.key ? { ...x, options: [...(x.options ?? []), opt] } : x)) })
  }

  const cover = coverOf(c, r)
  /** Where the cover picture lives: its field, that field's pictures and its index. */
  const coverAt = () => {
    for (const f of [c.fields.find((x) => x.key === c.cover_field_key), ...c.fields]) {
      if (f?.type !== 'image') continue
      const imgs = asImages(r.data[f.key])
      const i = imgs.findIndex((x) => x.path === cover?.path)
      if (i >= 0) return { f, imgs, i }
    }
    return null
  }
  const zoomCover = () => {
    const at = coverAt()
    if (at) setZoom({ images: at.imgs, i: at.i })
  }
  const setCoverPos = (x: number | undefined, y: number | undefined) => {
    const at = coverAt()
    if (at) set(at.f.key, at.imgs.map((im, k) => (k === at.i ? { ...im, x, y } : im)))
  }

  // Edit mode: drag the big photo to choose which part shows when it is cropped
  const onPanStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const img = e.currentTarget.querySelector('img')
    if (!editing || !cover || !img || !img.naturalWidth) return
    const s = Math.max(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
    e.currentTarget.setPointerCapture(e.pointerId)
    pan.current = {
      px: e.clientX, py: e.clientY, x: cover.x ?? 50, y: cover.y ?? 50,
      ox: img.naturalWidth * s - img.clientWidth, oy: img.naturalHeight * s - img.clientHeight,
    }
  }
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current
    if (!p) return
    // Moving the finger right shows more of the left side → smaller %
    const to = (v: number, d: number, over: number) => (over > 1 ? Math.round(Math.min(100, Math.max(0, v - (d / over) * 100))) : 50)
    setCoverPos(to(p.x, e.clientX - p.px, p.ox), to(p.y, e.clientY - p.py, p.oy))
  }
  const onPanEnd = () => { pan.current = null }
  const panning = editing && !!cover
  const sub = subTextOf(c, r)

  const rows = c.fields.map((f) => {
    const v = r.data[f.key]
    const isImg = f.type === 'image'
    const imgs = asImages(v)
    const stack = isImg || f.type === 'longtext' || (editing && f.type === 'multiselect')
    let val: React.ReactNode
    if (isImg) {
      val = <ImageStrip images={imgs} editing={editing} onZoom={(i) => setZoom({ images: imgs, i })}
        onChange={(next) => set(f.key, next)} onAdd={(files) => addImages(f, files)} />
    } else if (!editing) {
      val = <FieldDisplay f={f} v={v} />
    } else {
      const pool = f.tag ? tagsInUse(records, c.id, f.key) : (f.options ?? [])
      val = <FieldEditor f={f} v={v} pool={pool} onChange={(nv) => set(f.key, nv)} onNewOption={(o) => addOption(f, o)} />
    }
    const out = [
      <div key={f.key} className={`f ${stack ? 'stack' : ''}`}>
        <div className="l">
          {f.label}
          {c.cover_field_key === f.key && <span className="cover-b">COVER</span>}
          {isImg && imgs.length > 0 && <span className="cnt">{imgs.length}枚</span>}
        </div>
        <div className={`v ${f.type === 'longtext' && !editing ? 'pre' : ''}`}>{val}</div>
      </div>,
    ]
    if (c.meta.duration?.finish === f.key) {
      const d = durationOf(c, r)
      out.push(
        <div key="duration" className="f">
          <div className="l">Duration</div>
          <div className="v">
            {d ? <><span className="calc">{d.days}日{d.done ? '' : '目'}</span><span className="empty">{d.done ? '開始日と終了日から自動計算' : '読書中'}</span></> : <span className="empty">—</span>}
          </div>
        </div>,
      )
    }
    return out
  })

  return (
    <>
      <Header
        title={editing ? '編集中' : c.name}
        onBack={async () => { if (editing) await finish(); onBack() }}
        right={<button type="button" className={`btn small ${editing ? '' : 'ink'}`} onClick={editing ? finish : startEdit}>{editing ? '完了' : '編集'}</button>}
      />
      {justSaved && editing && (
        <div className="banner">
          <b>保存しました。</b>{navigator.onLine ? '' : 'オフラインのため、つながったら自動で送信します。'}残りの項目は今でも後からでも入力できます。
        </div>
      )}
      <div className="dlay">
        <div className="dleft">
          <div className={`dhero ${heroDrop.over ? 'dropping' : ''} ${panning ? 'pan' : ''}`} {...heroDrop.props}
            onPointerDown={onPanStart} onPointerMove={onPanMove} onPointerUp={onPanEnd} onPointerCancel={onPanEnd}>
            <Img image={cover} className="hero" fallback={r.title} onClick={cover && !editing ? zoomCover : undefined} />
            {cover && !editing && <span className="zoomhint">TAP TO ZOOM</span>}
            {panning && <span className="zoomhint">ドラッグで表示位置を調整</span>}
            {panning && (cover.x != null || cover.y != null) && (
              <button type="button" className="panreset" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCoverPos(undefined, undefined)}>中央に戻す</button>
            )}
          </div>
        </div>
        <div className="dright">
          <div className="dmeta">
            <span className="cdot" />{c.en_name || c.name} · {recordNo(nos.get(r.id) ?? 0)} · {fmtDate(r.created_at)}
            {pending.has(r.id) && <> · <Pend /></>}
          </div>
          {editing ? (
            <div style={{ marginTop: 10 }}>
              <label className="lbl" htmlFor="ed-title">{c.title_label}</label>
              <input className="in" id="ed-title" value={r.title} style={{ fontSize: 19, fontWeight: 700 }}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))} />
            </div>
          ) : (
            <>
              <h2 className="dtitle">{r.title}</h2>
              {sub && <p className="dsub">{sub}</p>}
            </>
          )}
          {busy && <p className="hint">縮小しています…</p>}
          {editing && coverField && hasPointer() && (
            <p className="hint">コピーしたスクショは各画像項目の「貼り付け」で入れられます（⌘V だけなら「{coverField.label}」へ）。ファイルはドラッグでも追加できます。</p>
          )}
          <div className="fields">{rows}</div>
          {editing && (
            <>
              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={finish}>完了</button>
                <button type="button" className="btn ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => setConfirmDel(true)}>この記録を削除</button>
              </div>
              {confirmDel && (
                <div className="banner" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--danger)' }}>
                  <span style={{ flex: 1, minWidth: '12em' }}>「{record.title}」を削除します。写真も消え、元に戻せません。</span>
                  <button type="button" className="btn small danger" onClick={async () => {
                    setEditing(false); setDraft(null)
                    await deleteRecord(record)
                    toast('削除しました')
                    onBack()
                  }}>削除する</button>
                  <button type="button" className="btn ghost small" onClick={() => setConfirmDel(false)}>やめる</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {zoom && <Lightbox images={zoom.images} start={zoom.i} onClose={() => setZoom(null)} />}
    </>
  )
}

