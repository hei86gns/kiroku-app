import { useMemo } from 'react'
import { useApp } from '../context'
import {
  asStrings, coverOf, dateOf, durationOf, filterFieldOf, fmtDate, numbering, ratingFieldOf, recordNo,
  sortRecords, sortsOf, tagFieldOf, tagsInUse,
} from '../lib/fields'
import type { Collection, KRecord, SavedView, ViewMode } from '../lib/types'
import { CollectionSegs, Img, Pend, Stars, TopLine } from '../components/common'
import { IcGrid, IcList, IcTable } from '../components/Icons'
import { SubLine } from '../components/recordText'

const VIEWS: { key: ViewMode; icon: React.ReactNode; label: string }[] = [
  { key: 'gallery', icon: <IcGrid />, label: 'ギャラリー' },
  { key: 'list', icon: <IcList />, label: 'リスト' },
  { key: 'table', icon: <IcTable />, label: '表' },
]

function Stats({ c, list, all }: { c: Collection; list: KRecord[]; all: KRecord[] }) {
  const rf = ratingFieldOf(c)
  const tf = tagFieldOf(c)
  const yen = c.fields.find((f) => f.type === 'number' && f.unit === '円')
  const out: React.ReactNode[] = [<span key="n"><b>{String(list.length).padStart(2, '0')}</b> RECORDS</span>]
  if (c.meta.duration) {
    const durs = list.map((r) => durationOf(c, r)).filter((d) => d != null)
    out.push(<span key="d">読了 <b>{durs.filter((d) => d.done).length}</b></span>)
    out.push(<span key="r">読書中 <b>{durs.filter((d) => !d.done).length}</b></span>)
  } else {
    if (rf) {
      const rs = list.map((r) => r.data[rf.key]).filter((v): v is number => typeof v === 'number' && v > 0)
      if (rs.length) out.push(<span key="a">平均 <b>★{(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1)}</b></span>)
    }
    if (yen && !rf) {
      const sum = list.reduce((a, r) => a + (typeof r.data[yen.key] === 'number' ? (r.data[yen.key] as number) : 0), 0)
      out.push(<span key="s">合計 <b>¥{sum.toLocaleString()}</b></span>)
    }
    if (tf) out.push(<span key="t">{tf.label}タグ <b>{tagsInUse(all, c.id, tf.key).length}</b></span>)
  }
  const latest = list.map((r) => r.created_at).sort().pop()
  if (latest) out.push(<span key="l">最終 <b>{fmtDate(latest).slice(5)}</b></span>)
  return <div className="stats">{out}</div>
}

export default function CollectionView() {
  const { collections, records, currentId, saveCollection, openRecord, pending } = useApp()
  const c = collections.find((x) => x.id === currentId) ?? collections[0]
  const v: Required<SavedView> = {
    view: c?.saved_view.view ?? c?.default_view ?? 'gallery',
    sort: c?.saved_view.sort ?? 'created',
    filter: c?.saved_view.filter ?? null,
    tag: c?.saved_view.tag ?? null,
  }
  const setView = (patch: SavedView) => c && saveCollection({ ...c, saved_view: { ...v, ...patch } })

  const mine = useMemo(() => (c ? records.filter((r) => r.collection_id === c.id) : []), [records, c])
  const nos = useMemo(() => (c ? numbering(c, records) : new Map<string, number>()), [c, records])
  if (!c) return <div className="centered">コレクションがありません</div>

  const ff = filterFieldOf(c)
  const tf = tagFieldOf(c)
  let list = mine
  if (ff && v.filter) list = list.filter((r) => { const x = r.data[ff.key]; return Array.isArray(x) ? asStrings(x).includes(v.filter!) : x === v.filter })
  if (tf && v.tag) list = list.filter((r) => asStrings(r.data[tf.key]).includes(v.tag!))
  const sorts = sortsOf(c)
  const sortKey = sorts.some((s) => s.key === v.sort) ? v.sort : 'created'
  list = sortRecords(list, sortKey)
  const no = (r: KRecord) => recordNo(nos.get(r.id) ?? 0)

  let body: React.ReactNode
  if (!list.length) {
    body = mine.length
      ? <div className="emptybox"><b>該当なし</b>条件をゆるめるか、＋から登録してください。</div>
      : <div className="emptybox"><b>まだ記録がありません</b>下の＋から、写真とタイトルだけで登録できます。</div>
  } else if (v.view === 'gallery') {
    body = (
      <div className="grid">
        {list.map((r, i) => {
          const cover = coverOf(c, r)
          if (i === 0 && list.length > 2) {
            return (
              <button key={r.id} type="button" className="card feature" onClick={() => openRecord(r.id)}>
                <div className="imgw">
                  <Img image={cover} fallback={r.title} />
                  <div className="ov">
                    <span className="k">{no(r)} · {dateOf(c, r)}</span>
                    <span className="t">{r.title}</span>
                    <span className="s"><SubLine c={c} r={r} /></span>
                  </div>
                </div>
                {pending.has(r.id) && <Pend />}
              </button>
            )
          }
          return (
            <button key={r.id} type="button" className="card" onClick={() => openRecord(r.id)}>
              <div className="imgw"><Img image={cover} thumb fallback={r.title} /><span className="no">{no(r)}</span></div>
              <div className="t">{r.title}</div>
              <div className="s"><SubLine c={c} r={r} /></div>
              {pending.has(r.id) && <Pend />}
            </button>
          )
        })}
      </div>
    )
  } else if (v.view === 'list') {
    body = (
      <div className="list">
        {list.map((r) => (
          <button key={r.id} type="button" className="row" onClick={() => openRecord(r.id)}>
            <Img image={coverOf(c, r)} thumb fallback={r.title} />
            <div className="b">
              <div className="t">{r.title}</div>
              <div className="s"><SubLine c={c} r={r} /></div>
              {pending.has(r.id) && <Pend />}
            </div>
            <div className="d">{dateOf(c, r)}</div>
          </button>
        ))}
      </div>
    )
  } else {
    const cols = c.fields.filter((f) => !['image', 'longtext', 'url'].includes(f.type)).slice(0, 5)
    body = (
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{c.title_label}</th>
              {cols.map((f) => <th key={f.key}>{f.label}</th>)}
              {c.meta.duration && <th>日数</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const dur = durationOf(c, r)
              return (
                <tr key={r.id} onClick={() => openRecord(r.id)}>
                  <td className="first">{r.title}</td>
                  {cols.map((f) => {
                    const x = r.data[f.key]
                    const num = f.type === 'number' || f.type === 'date'
                    let txt: React.ReactNode = ''
                    if (x != null && x !== '') {
                      if (f.type === 'rating') txt = <Stars n={x as number} />
                      else if (f.type === 'multiselect') txt = asStrings(x).join('、')
                      else if (f.type === 'number') txt = Number(x).toLocaleString() + (f.unit ?? '')
                      else if (f.type === 'date') txt = fmtDate(x as string)
                      else txt = String(x)
                    }
                    return <td key={f.key} className={num ? 'num' : ''}>{txt}</td>
                  })}
                  {c.meta.duration && <td className="num">{dur?.done ? `${dur.days}日` : ''}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <TopLine label={c.en_name || c.name} />
      <div className={`hero-h ${c.meta.cover ? 'withcover' : ''}`}>
        {c.meta.cover && <Img image={c.meta.cover} className="ccover" />}
        <h1>{c.name}<span>.</span></h1>
        <Stats c={c} list={mine} all={records} />
      </div>
      <CollectionSegs />
      <div className="toolbar">
        <div className="viewsw">
          {VIEWS.map((x) => (
            <button key={x.key} type="button" className={v.view === x.key ? 'on' : ''} onClick={() => setView({ view: x.key })} aria-label={x.label} title={x.label}>
              {x.icon}{v.view === x.key ? x.label : ''}
            </button>
          ))}
        </div>
        <div className="sortwrap">
          <select className="sortsel" aria-label="並べ替え" value={sortKey} onChange={(e) => setView({ sort: e.target.value })}>
            {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {ff && (ff.options?.length ?? 0) > 0 && (
        <div className="filters">
          <button type="button" className={`chip ${!v.filter ? 'on' : ''}`} onClick={() => setView({ filter: null })}>すべて</button>
          {ff.options!.map((o) => (
            <button key={o} type="button" className={`chip ${v.filter === o ? 'on' : ''}`} onClick={() => setView({ filter: o })}>{o}</button>
          ))}
        </div>
      )}
      {tf && tagsInUse(records, c.id, tf.key).length > 0 && (
        <div className="filters" style={{ marginTop: 8 }}>
          <span className="chip lab">{tf.label}</span>
          {tagsInUse(records, c.id, tf.key).slice(0, 12).map((t) => (
            <button key={t} type="button" className={`chip ${v.tag === t ? 'on' : ''}`} onClick={() => setView({ tag: v.tag === t ? null : t })}>#{t}</button>
          ))}
        </div>
      )}
      <p className="hint"><span className="mono">{list.length}件</span> · 表示方法・並べ替え・絞り込みは「{c.name}」ごとに保存されます</p>
      {body}
    </>
  )
}
