// 下見：Notion の3つのデータベースを読むだけで、何も書き込まない。
// 項目の名前・種類・入力件数・選択肢・写真の枚数と推定容量、ページ本文の中身を数えて表示する。
//   npm run import:inspect

import { createClient, loadEnv, mapLimit, type NotionFile, type Page, type Property, type RichText } from './notion.ts'

const KB_PER_IMAGE = 230 // 本体＋一覧用の縮小後の目安（HANDOFF.md）

const env = loadEnv()
const notion = createClient(env.token)

const text = (rt: unknown) => ((rt as RichText[] | undefined) ?? []).map((t) => t.plain_text).join('')

/** A property's value as a short string list (empty = 未入力). */
function values(p: Property): string[] {
  const v = p[p.type] as never
  switch (p.type) {
    case 'title':
    case 'rich_text': {
      const s = text(v)
      return s ? [s] : []
    }
    case 'number':
      return v == null ? [] : [String(v)]
    case 'select':
    case 'status':
      return v ? [(v as { name: string }).name] : []
    case 'multi_select':
      return (v as { name: string }[]).map((o) => o.name)
    case 'date':
      return v ? [(v as { start: string; end: string | null }).start + ((v as { end: string | null }).end ? ` → ${(v as { end: string }).end}` : '')] : []
    case 'url':
    case 'email':
    case 'phone_number':
      return v ? [v] : []
    case 'checkbox':
      return v ? ['✓'] : []
    case 'files':
      return (v as NotionFile[]).map((f) => f.name)
    case 'formula': {
      const f = v as { type: string; [k: string]: unknown }
      const r = f[f.type]
      return r == null || r === '' ? [] : [typeof r === 'object' ? JSON.stringify(r) : String(r)]
    }
    default:
      return []
  }
}

const ext = (f: NotionFile) => {
  const url = f.type === 'file' ? f.file.url : f.external.url
  const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)
  return (m?.[1] ?? '?').toLowerCase()
}

const countBy = (xs: string[]) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}
const fmt = (entries: [string, number][], max = 12) =>
  entries.slice(0, max).map(([k, n]) => `${k}(${n})`).join(', ') + (entries.length > max ? ` …ほか${entries.length - max}種` : '')
const short = (s: string, n = 40) => (s.length > n ? s.slice(0, n) + '…' : s)

let grandImages = 0

for (const [key, dbId] of Object.entries(env.dbs)) {
  const db = await notion.database(dbId)
  const pages = (await notion.queryAll(dbId)).filter((p) => !p.archived && !p.in_trash)
  const created = pages.map((p) => p.created_time).sort()

  console.log(`\n══════ ${text(db.title)}（${key}） ══════`)
  console.log(`ページ数：${pages.length}　作成日：${created[0]?.slice(0, 10)} 〜 ${created.at(-1)?.slice(0, 10)}`)
  console.log('\n― 項目 ―')

  let propImages = 0
  const propExts: string[] = []
  let external = 0

  for (const [name, def] of Object.entries(db.properties)) {
    const vals = pages.map((p) => values(p.properties[name]))
    const filled = vals.filter((v) => v.length).length
    let detail = ''
    if (def.type === 'select' || def.type === 'multi_select' || def.type === 'status') {
      const defined = ((def[def.type] as { options: { name: string }[] }).options ?? []).length
      detail = `選択肢 ${defined}種：${fmt(countBy(vals.flat()))}`
    } else if (def.type === 'files') {
      const files = pages.flatMap((p) => p.properties[name].files as NotionFile[])
      propImages += files.filter((f) => f.type === 'file').length
      external += files.filter((f) => f.type === 'external').length
      propExts.push(...files.map(ext))
      const max = Math.max(0, ...vals.map((v) => v.length))
      detail = `ファイル ${files.length}枚（1ページ最大${max}枚、外部リンク${files.filter((f) => f.type === 'external').length}）`
    } else {
      const samples = [...new Set(vals.flat())].slice(0, 3).map((s) => `「${short(s)}」`)
      detail = samples.length ? `例：${samples.join(' ')}` : ''
    }
    console.log(`・${name} [${def.type}] 入力 ${filled}/${pages.length}　${detail}`)
  }

  // ページ本文（ブロック）の中身。1ページ1回ずつ読むので少し時間がかかる。
  process.stdout.write('\n― ページ本文を読んでいます ')
  const bodies = await mapLimit(pages, 3, async (p: Page, i) => {
    if (i % 25 === 0) process.stdout.write('.')
    return notion.childrenAll(p.id)
  })
  process.stdout.write('\n')
  const withBody = bodies.filter((b) => b.length).length
  const blockTypes = countBy(bodies.flat().map((b) => b.type))
  const bodyFiles = bodies.flat().filter((b) => b.type === 'image').map((b) => b.image as NotionFile)
  const nested = bodies.flat().filter((b) => b.has_children).length
  const bodyImages = bodyFiles.filter((f) => f.type === 'file').length
  external += bodyFiles.filter((f) => f.type === 'external').length

  console.log(`本文があるページ：${withBody}/${pages.length}　ブロック種類：${fmt(blockTypes) || 'なし'}`)
  if (nested) console.log(`入れ子のブロック（中にさらに中身がある）：${nested}個 ※今回は1段目だけ数えています`)
  console.log(`本文中の画像：${bodyFiles.length}枚`)

  const images = propImages + bodyImages
  grandImages += images
  console.log('\n― 写真 ―')
  console.log(`Notion にアップロードされた画像：${images}枚（項目 ${propImages} ＋ 本文 ${bodyImages}）　外部リンク：${external}枚`)
  console.log(`拡張子：${fmt(countBy([...propExts, ...bodyFiles.map(ext)])) || 'なし'}`)
  console.log(`推定容量：約 ${((images * KB_PER_IMAGE) / 1024).toFixed(0)} MB`)
}

console.log(`\n══════ 合計 ══════`)
console.log(`画像 ${grandImages}枚 → 推定 約 ${((grandImages * KB_PER_IMAGE) / 1024).toFixed(0)} MB（無料枠 1GB はほかのアプリと共有）`)
