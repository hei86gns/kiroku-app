import { useMemo, useState } from 'react'
import { useApp } from '../context'
import { asStrings, coverOf, ratingFieldOf, tagFieldOf, tagsInUse } from '../lib/fields'
import type { Collection, KRecord } from '../lib/types'
import { Img, TopLine } from '../components/common'
import { IcSearch } from '../components/Icons'
import { SubLine } from '../components/recordText'

/** Wraps every occurrence of `q` in <mark>. */
function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const parts = text.split(q)
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && <mark>{q}</mark>}</span>)}</>
}

/** Why a record matched (when it wasn't the title), e.g. "食材: 鶏もも肉、ねぎ". */
function matchOf(c: Collection, r: KRecord, q: string): { ok: boolean; why: string } {
  if (!q || r.title.includes(q)) return { ok: true, why: '' }
  for (const f of c.fields) {
    const v = r.data[f.key]
    if (typeof v === 'string' && f.type !== 'date' && f.type !== 'url' && v.includes(q)) {
      return { ok: true, why: `${f.label}: ${v.length > 30 ? v.slice(0, 30) + '…' : v}` }
    }
    if (f.type === 'multiselect') {
      const xs = asStrings(v)
      if (xs.some((x) => x.includes(q))) return { ok: true, why: `${f.label}: ${xs.join('、')}` }
    }
  }
  return { ok: false, why: '' }
}

export default function Search() {
  const { collections, records, openRecord } = useApp()
  const [q, setQ] = useState('')
  const [colId, setColId] = useState<string>('all')
  const [high, setHigh] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const term = q.trim()
  const byId = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections])

  const idle = !term && !high && colId === 'all' && !from && !to
  const hits = useMemo(() => {
    if (idle) return []
    const out: { r: KRecord; c: Collection; why: string }[] = []
    for (const r of records) {
      const c = byId.get(r.collection_id)
      if (!c || (colId !== 'all' && c.id !== colId)) continue
      if (high) {
        const rf = ratingFieldOf(c)
        const v = rf ? r.data[rf.key] : null
        if (typeof v !== 'number' || v < 4) continue
      }
      if (from || to) {
        // Any date field (or the registered date) inside the range
        const dates = [r.created_at.slice(0, 10), ...c.fields.filter((f) => f.type === 'date').map((f) => r.data[f.key]).filter((d): d is string => typeof d === 'string' && !!d)]
        if (!dates.some((d) => (!from || d >= from) && (!to || d <= to))) continue
      }
      const m = matchOf(c, r, term)
      if (m.ok) out.push({ r, c, why: m.why })
    }
    return out.sort((a, b) => (a.r.created_at < b.r.created_at ? 1 : -1))
  }, [idle, records, byId, colId, high, from, to, term])

  const recipe = collections.find((c) => tagFieldOf(c))
  const popular = recipe ? tagsInUse(records, recipe.id, tagFieldOf(recipe)!.key).slice(0, 10) : []

  return (
    <>
      <TopLine label="SEARCH" />
      <div className="hero-h">
        <h1>探す<span>.</span></h1>
        <div className="stats"><span>全コレクション <b>{records.length}</b> RECORDS を横断</span></div>
      </div>
      <label className="searchbox" style={{ marginTop: 14 }}>
        <IcSearch />
        <input type="search" placeholder="料理名・食材・著者・メモ…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="キーワード" enterKeyHint="search" />
      </label>
      <div className="filters" style={{ marginTop: 12 }}>
        <button type="button" className={`chip ${colId === 'all' ? 'on' : ''}`} onClick={() => setColId('all')}>すべて</button>
        {collections.map((c) => (
          <button key={c.id} type="button" className={`chip ${colId === c.id ? 'on' : ''}`} onClick={() => setColId(c.id)}>{c.name}</button>
        ))}
        <button type="button" className={`chip ${high ? 'on' : ''}`} onClick={() => setHigh(!high)}>★4以上</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <span className="chip lab">期間</span>
        <input className="in" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: '11em', background: 'var(--paper)' }} aria-label="開始日" />
        <span className="empty">〜</span>
        <input className="in" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: '11em', background: 'var(--paper)' }} aria-label="終了日" />
        {(from || to) && <button type="button" className="linkbtn" onClick={() => { setFrom(''); setTo('') }}>クリア</button>}
      </div>
      {idle ? (
        popular.length > 0 && (
          <div className="sec">
            <h3>よく使う{tagFieldOf(recipe!)!.label}タグ</h3>
            <div className="filters" style={{ flexWrap: 'wrap' }}>
              {popular.map((t) => <button key={t} type="button" className="chip" onClick={() => setQ(t)}>#{t}</button>)}
            </div>
          </div>
        )
      ) : hits.length ? (
        <>
          <p className="hint"><span className="mono">{hits.length}件</span></p>
          <div className="list">
            {hits.map(({ r, c, why }) => (
              <button key={r.id} type="button" className="row" data-c={c.theme} onClick={() => openRecord(r.id)}>
                <Img image={coverOf(c, r)} thumb fallback={r.title} />
                <div className="b">
                  <div className="t"><Hl text={r.title} q={term} /></div>
                  <div className="s">{why ? <Hl text={why} q={term} /> : <SubLine c={c} r={r} />}</div>
                </div>
                <span className="badge">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="emptybox"><b>見つかりません</b>別のことばで試してください。</div>
      )}
    </>
  )
}
