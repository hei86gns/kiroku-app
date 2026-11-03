import type { Collection, FieldDef, FieldType, FieldValue, ImageRef, KRecord } from './types'

export const TYPE_LABELS: Record<FieldType, string> = {
  text: 'テキスト',
  longtext: '長文',
  number: '数値',
  date: '日付',
  select: '選択（1つ）',
  multiselect: '選択（複数）',
  rating: '評価（星）',
  url: 'URL',
  image: '画像',
}

/** Longest side (px) a picture is shrunk to before saving. Screenshots stay larger so text is readable. */
export const maxSideFor = (f: FieldDef | undefined) => (f?.imageKind === 'screenshot' ? 1600 : 1280)

export const isEmpty = (v: FieldValue | undefined) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0)

export const asImages = (v: FieldValue | undefined): ImageRef[] =>
  Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' ? (v as ImageRef[]) : []

export const asStrings = (v: FieldValue | undefined): string[] =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []

export const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10).replaceAll('-', '.') : '')

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Inclusive day count between two YYYY-MM-DD dates (same day = 1). */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1

export const hostOf = (url: string) => {
  try { return new URL(url).hostname } catch { return url }
}

/** The image shown on cards: the collection's cover field first, then any image field. */
export function coverOf(c: Collection, r: KRecord): ImageRef | null {
  const fromCover = c.cover_field_key ? asImages(r.data[c.cover_field_key])[0] : undefined
  if (fromCover) return fromCover
  for (const f of c.fields) {
    if (f.type !== 'image') continue
    const first = asImages(r.data[f.key])[0]
    if (first) return first
  }
  return null
}

export const filterFieldOf = (c: Collection) =>
  c.fields.find((f) => (f.type === 'select' || f.type === 'multiselect') && !f.tag)

export const tagFieldOf = (c: Collection) => c.fields.find((f) => f.type === 'multiselect' && f.tag)

export const ratingFieldOf = (c: Collection) => c.fields.find((f) => f.type === 'rating')

/** Sort choices for a collection: newest first by created date, then each date / rating / number field. */
export function sortsOf(c: Collection): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (const f of c.fields) {
    if (f.type === 'date') out.push({ key: f.key, label: `${f.label}が新しい順` })
  }
  for (const f of c.fields) {
    if (f.type === 'rating') out.push({ key: f.key, label: `${f.label}が高い順` })
    if (f.type === 'number') out.push({ key: f.key, label: `${f.label}が高い順` })
  }
  out.push({ key: 'created', label: '登録が新しい順' })
  return out
}

export function sortRecords(list: KRecord[], sort: string): KRecord[] {
  const key = (r: KRecord): string | number => {
    if (sort === 'created') return r.created_at
    const v = r.data[sort]
    if (typeof v === 'number') return v
    if (typeof v === 'string') return v
    return ''
  }
  return [...list].sort((a, b) => {
    const x = key(a), y = key(b)
    // Empty values always sink to the bottom
    if (x === '' && y !== '') return 1
    if (y === '' && x !== '') return -1
    if (x < y) return 1
    if (x > y) return -1
    return a.created_at < b.created_at ? 1 : -1
  })
}

/** Tags used so far in a field, most used first. */
export function tagsInUse(records: KRecord[], collectionId: string, key: string): string[] {
  const freq = new Map<string, number>()
  for (const r of records) {
    if (r.collection_id !== collectionId) continue
    for (const t of asStrings(r.data[key])) freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])
}

/** The date shown on list rows: first date field with a value, else the registered date. */
export function dateOf(c: Collection, r: KRecord): string {
  if (c.meta.duration) {
    const d = r.data[c.meta.duration.finish] || r.data[c.meta.duration.start]
    if (typeof d === 'string' && d) return fmtDate(d)
  }
  for (const f of c.fields) {
    const v = r.data[f.key]
    if (f.type === 'date' && typeof v === 'string' && v) return fmtDate(v)
  }
  return fmtDate(r.created_at)
}

/** Reading status for collections with a start/finish pair (読書記録). */
export function durationOf(c: Collection, r: KRecord): { days: number; done: boolean } | null {
  const d = c.meta.duration
  if (!d) return null
  const s = r.data[d.start], f = r.data[d.finish]
  if (typeof s !== 'string' || !s) return null
  if (typeof f === 'string' && f) return { days: daysBetween(s, f), done: true }
  return { days: daysBetween(s, today()), done: false }
}

export const recordNo = (n: number) => 'No.' + String(n).padStart(3, '0')

export const newId = () => crypto.randomUUID()

export const newFieldKey = () => 'f_' + crypto.randomUUID().slice(0, 8)

/** Running number per collection, oldest = 1 (shown as No.001). */
export function numbering(c: Collection, records: KRecord[]): Map<string, number> {
  const mine = records.filter((r) => r.collection_id === c.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  return new Map(mine.map((r, i) => [r.id, i + 1]))
}
