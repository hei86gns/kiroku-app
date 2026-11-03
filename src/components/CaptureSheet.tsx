import { useState } from 'react'
import { useApp } from '../context'
import { maxSideFor, newId } from '../lib/fields'
import { prepareImages, toNewImages, type PreparedImage } from '../lib/image'
import type { Collection, KRecord } from '../lib/types'
import { CollectionIcon, IcCam } from './Icons'

const defaultField = (c: Collection) => c.cover_field_key ?? c.fields.find((f) => f.type === 'image')?.key ?? null

/**
 * Bottom sheet for adding a record: pick a collection → pick photos → title → save.
 * The record id is decided up front so photos can be stored under its folder right away.
 */
export default function CaptureSheet({ askCollection, onClose }: { askCollection: boolean; onClose: () => void }) {
  const { collections, currentId, saveRecord, openRecord, setCurrentId, toast, userId } = useApp()
  const [colId, setColId] = useState<string | null>(askCollection ? null : currentId)
  const c = collections.find((x) => x.id === colId)
  const [field, setField] = useState<string | null>(c ? defaultField(c) : null)
  const [files, setFiles] = useState<PreparedImage[]>([])
  const [previews, setPreviews] = useState<Map<string, string>>(new Map())
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [recordId] = useState(newId)

  const close = () => {
    previews.forEach((u) => URL.revokeObjectURL(u))
    onClose()
  }

  const pick = async (list: File[]) => {
    if (!c || !list.length) return
    setBusy(true)
    const f = c.fields.find((x) => x.key === field)
    const { images, failed } = await prepareImages(list, maxSideFor(f), `${userId}/${c.id}/${recordId}`)
    setBusy(false)
    if (failed) toast('読み込めない画像がありました。JPEG か PNG で試してください。')
    setFiles((xs) => [...xs, ...images])
    setPreviews((m) => {
      const next = new Map(m)
      for (const i of images) next.set(i.ref.path, URL.createObjectURL(i.thumbBlob))
      return next
    })
  }

  const save = async () => {
    if (!c || !title.trim()) return
    const now = new Date().toISOString()
    const r: KRecord = {
      id: recordId,
      collection_id: c.id,
      title: title.trim(),
      data: files.length && field ? { [field]: files.map((x) => x.ref) } : {},
      cover_image_key: files[0]?.ref.path ?? null,
      created_at: now,
      updated_at: now,
    }
    await saveRecord(r, toNewImages(files))
    setCurrentId(c.id)
    close()
    openRecord(r.id, { editing: true, justSaved: true })
    toast(navigator.onLine ? '保存しました' : '端末に保存しました（未送信）')
  }

  let inner: React.ReactNode
  if (!c) {
    inner = (
      <>
        <h2>どこに<span>登録</span>しますか？</h2>
        <div className="colpick">
          {collections.map((x) => (
            <button key={x.id} type="button" data-c={x.theme} onClick={() => { setColId(x.id); setField(defaultField(x)) }}>
              <span className="ico"><CollectionIcon name={x.icon} /></span>
              {x.name}<small>{x.en_name}</small>
            </button>
          ))}
        </div>
      </>
    )
  } else {
    const imageFields = c.fields.filter((x) => x.type === 'image')
    inner = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ flex: 1 }}><span>{c.name}</span>に登録</h2>
          <button type="button" className="btn ghost small" onClick={() => setColId(null)} disabled={files.length > 0}
            title={files.length ? '写真を外すと変更できます' : undefined}>変更</button>
        </div>
        {imageFields.length > 0 && (
          <>
            <label className="pickbtn">
              <IcCam />撮影 / 写真を選ぶ
              <input type="file" accept="image/*" multiple onChange={(e) => { void pick([...(e.target.files ?? [])]); e.target.value = '' }} />
            </label>
            {busy && <p className="hint" style={{ margin: 0 }}>縮小しています…</p>}
            {files.length ? (
              <div className="strip">
                {files.map((x) => (
                  <div className="im" key={x.ref.path}>
                    {/* The × sits on the photo itself, not over the size note below it */}
                    <div style={{ position: 'relative' }}>
                      <img src={previews.get(x.ref.path)} alt="" />
                      <div className="ctl" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="x" aria-label="外す" onClick={() => setFiles((xs) => xs.filter((y) => y !== x))}>×</button>
                      </div>
                    </div>
                    <div className="resinfo">{x.info}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: '-4px 0 0' }}>複数枚まとめて選べます。選んだ写真はこの場で自動的に縮小されます。</p>
            )}
            <div>
              <label className="lbl" htmlFor="capfield">写真を入れる項目</label>
              <select className="in" id="capfield" value={field ?? ''} onChange={(e) => setField(e.target.value)} disabled={files.length > 0}>
                {imageFields.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}{x.imageKind === 'screenshot' ? '（スクショ・長辺1600px）' : '（写真・長辺1280px）'}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="lbl" htmlFor="captitle">{c.title_label}</label>
          <input className="in" id="captitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${c.title_label}を入力`} style={{ fontSize: 17 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void save() }} />
        </div>
        <button type="button" className="btn" onClick={save} disabled={!title.trim() || busy} style={{ padding: 15 }}>保存して詳細へ</button>
        <p className="hint" style={{ margin: '-8px 0 0', textAlign: 'center' }}>写真とタイトルだけで保存できます。ほかの項目は後から。</p>
      </>
    )
  }

  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="sheet" role="dialog" aria-label="登録" data-c={c?.theme ?? 'all'}>
        <div className="grab" />
        {inner}
      </div>
    </div>
  )
}
