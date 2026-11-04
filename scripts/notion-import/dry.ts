// お試し変換：Notion を読んで変換するだけで、Supabase には何も書き込まない。
// 見本・変換できなかった値・追加される選択肢を表示し、写真は一部だけ実際に縮小して試す。
// 全件の変換結果は scripts/notion-import/out/dry.json に保存（Git には入らない）。
//   npm run import:dry

import { mkdir, writeFile } from 'node:fs/promises'
import { alignToOptions, convertPage, mergeOptions, plain, unmappedProps, type Converted, type DbKey } from './convert.ts'
import { extOf, download, shrink } from './images.ts'
import { createClient, loadEnv, mapLimit, type NotionFile } from './notion.ts'

/** The app's initial choices (same as src/lib/defaults.ts); the real import reads them from Supabase. */
const APP_OPTIONS: Record<DbKey, Record<string, string[]>> = {
  recipes: {
    category: ['おかず', '主食', '汁物', '副菜', 'デザート'],
    source: ['クラシル', 'DELISH KITCHEN', '白ごはん.com', '自作'],
  },
  goods: {
    category: ['キッチン', '収納', '家電', '日用品', '服'],
    shop: ['Amazon', '無印良品', 'ヨドバシカメラ', 'ニトリ'],
  },
  books: { language: ['日本語', 'English'] },
}

/** Screenshot fields are kept larger so text stays readable (same as the app). */
const SCREENSHOT_FIELDS = new Set(['ingShot', 'stepShot'])
const SAMPLES_PER_DB = 4 // ordinary JPEG/PNG pictures actually shrunk per DB

const env = loadEnv()
const notion = createClient(env.token)

const short = (s: string, n = 60) => {
  const one = s.replaceAll('\n', '⏎')
  return one.length > n ? one.slice(0, n) + '…' : one
}
const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB')

function show(c: Converted) {
  console.log(`  ▸ ${c.title || '（タイトルなし）'}　登録 ${c.created_at.slice(0, 10)}`)
  for (const [k, v] of Object.entries(c.data)) {
    console.log(`      ${k}: ${Array.isArray(v) ? `[${v.join(' / ')}]` : typeof v === 'string' ? short(v) : v}`)
  }
  for (const [k, files] of Object.entries(c.images)) {
    console.log(`      ${k}: 写真 ${files.length}枚（${files.map(extOf).join(', ')}）`)
  }
}

const report: Record<string, unknown> = {}
const shrinkTests: { db: string; title: string; ext: string; result: string }[] = []
let shrunkBytes = 0, shrunkCount = 0, totalImages = 0

for (const [key, dbId] of Object.entries(env.dbs) as [DbKey, string][]) {
  const db = await notion.database(dbId)
  const pages = (await notion.queryAll(dbId)).filter((p) => !p.archived && !p.in_trash)
  console.log(`\n══════ ${plain(db.title)}（${key}）${pages.length}件 ══════`)

  process.stdout.write('本文を読んでいます ')
  const bodies = await mapLimit(pages, 3, async (p, i) => {
    if (i % 25 === 0) process.stdout.write('.')
    return notion.childrenDeep(p.id)
  })
  process.stdout.write('\n')

  const options = mergeOptions(key, db, APP_OPTIONS[key])
  const records = pages.map((p, i) => {
    const c = convertPage(key, p, bodies[i])
    alignToOptions(c, options)
    return c
  })

  // 項目ごとの入力件数
  const filled = new Map<string, number>()
  for (const r of records) {
    for (const k of [...Object.keys(r.data), ...Object.keys(r.images)]) filled.set(k, (filled.get(k) ?? 0) + 1)
  }
  console.log('\n― 変換後の項目（入力件数） ―')
  console.log('  ' + [...filled].map(([k, n]) => `${k} ${n}`).join(' / '))

  const imgs = records.flatMap((r) => Object.entries(r.images).flatMap(([field, fs]) => fs.map((f) => ({ r, field, f }))))
  const ext = imgs.filter((x) => x.f.type === 'external').length
  totalImages += imgs.length
  console.log(`  写真：${imgs.length}枚（うち外部リンク ${ext}）`)

  // 追加される選択肢
  console.log('\n― 選択肢（アプリ初期 ＋ Notion から追加） ―')
  for (const [field, list] of Object.entries(options)) {
    const added = list.filter((o) => !(APP_OPTIONS[key][field] ?? []).includes(o))
    console.log(`  ${field}：${list.length}種（追加 ${added.length}：${added.join('、')}）`)
  }

  const unmapped = unmappedProps(key, db)
  if (unmapped.length) console.log(`\n⚠ 対応表にない Notion の項目（取り込まれません）：${unmapped.join('、')}`)

  // 変換できなかった値
  const issues = new Map<string, string[]>()
  for (const r of records) for (const m of r.issues) issues.set(m, [...(issues.get(m) ?? []), r.title])
  console.log('\n― 変換できなかった値 ―')
  if (!issues.size) console.log('  なし')
  for (const [m, titles] of issues) console.log(`  ${m}：${titles.length}件（例：${titles.slice(0, 3).join('、')}）`)

  // 見本：中身の多いものから
  const richness = (r: Converted) => Object.keys(r.data).length + Object.keys(r.images).length
  console.log('\n― 見本 ―')
  for (const r of [...records].sort((a, b) => richness(b) - richness(a)).slice(0, 2)) show(r)
  const withBody = records.find((_, i) => bodies[i].some((b) => b.type !== 'image'))
  if (withBody) {
    console.log('  （本文の文章が入ったもの）')
    show(withBody)
  }

  // 写真の縮小テスト：JPEG/PNG 以外は全部、ふつうの写真は数枚
  const common = new Set(['jpg', 'jpeg', 'png'])
  const picks = [
    ...imgs.filter((x) => !common.has(extOf(x.f))),
    ...imgs.filter((x) => common.has(extOf(x.f))).slice(0, SAMPLES_PER_DB),
  ]
  process.stdout.write(`\n写真を ${picks.length}枚 試しに縮小しています `)
  await mapLimit(picks, 3, async ({ r, field, f }) => {
    let result: string
    try {
      const s = await shrink(await download(f as NotionFile), SCREENSHOT_FIELDS.has(field) ? 1600 : 1280)
      shrunkBytes += s.blob.length + s.thumb.length
      shrunkCount++
      result = `OK ${kb(s.original)} → ${s.w}×${s.h} ${kb(s.blob.length)}＋一覧用 ${kb(s.thumb.length)}${s.viaSips ? '（sips 経由）' : ''}`
    } catch (e) {
      result = `失敗：${(e as Error).message.split('\n')[0]}`
    }
    shrinkTests.push({ db: key, title: r.title, ext: extOf(f), result })
    process.stdout.write('.')
  })
  process.stdout.write('\n')

  report[key] = { options, unmapped, issues: Object.fromEntries(issues), records }
}

console.log('\n══════ 写真の縮小テスト ══════')
for (const t of shrinkTests) console.log(`  [${t.db}] ${t.ext || '?'}　${short(t.title, 24)}　${t.result}`)
const failed = shrinkTests.filter((t) => t.result.startsWith('失敗')).length
console.log(`  成功 ${shrinkTests.length - failed} / 失敗 ${failed}`)
if (shrunkCount) {
  const avg = shrunkBytes / shrunkCount
  console.log(`  1枚あたり平均 ${kb(avg)}（本体＋一覧用）→ ${totalImages}枚で 約 ${((avg * totalImages) / 1048576).toFixed(0)} MB`)
}

await mkdir('scripts/notion-import/out', { recursive: true })
await writeFile('scripts/notion-import/out/dry.json', JSON.stringify(report, null, 2))
console.log('\n全件の変換結果：scripts/notion-import/out/dry.json')
