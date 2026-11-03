import type { Collection, KRecord } from '../lib/types'
import { asStrings, durationOf, filterFieldOf, ratingFieldOf } from '../lib/fields'
import { Stars } from './common'

/** The short line under a title on cards and rows. */
export function SubLine({ c, r }: { c: Collection; r: KRecord }) {
  if (c.sub_field_key) {
    const v = r.data[c.sub_field_key]
    const dur = durationOf(c, r)
    return <>{typeof v === 'string' ? v : ''}{dur && !dur.done ? ' · 読書中' : ''}</>
  }
  const rf = ratingFieldOf(c)
  const rating = rf ? r.data[rf.key] : null
  const num = c.fields.find((f) => f.type === 'number')
  const numV = num ? r.data[num.key] : null
  const ff = filterFieldOf(c)
  const label = ff ? asStrings(ff.type === 'select' ? [r.data[ff.key] as string] : r.data[ff.key]).join('・') : ''
  return (
    <>
      {typeof rating === 'number' && rating > 0 && <><Stars n={rating} />{' '}</>}
      {typeof numV === 'number' && (
        <span className="mono">{num?.unit === '円' ? `¥${numV.toLocaleString()}` : `${numV.toLocaleString()}${num?.unit ?? ''}`}</span>
      )}
      {typeof numV === 'number' && label ? ' · ' : ''}
      {label}
    </>
  )
}
