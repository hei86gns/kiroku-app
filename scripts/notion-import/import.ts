// 本番の取り込み：Notion の3つのデータベースを記録アプリ（Supabase）へ移す。
// ユーザー本人としてログインして書き込む（RLS のまま、管理者用の鍵は使わない）。
// 取り込み済みのページ（notion_page_id）は飛ばすので、途中で止まっても再実行すれば続きから。
//   npm run import

import { mkdir, writeFile } from 'node:fs/promises'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { alignToOptions, convertPage, isSkipped, MAPPINGS, mergeOptions, plain, type DbKey } from './convert.ts'
import { download, extOf, shrink } from './images.ts'
import { login } from './login.ts'
import { createClient, loadEnv, mapLimit, type Page } from './notion.ts'
import type { Collection, FieldValue, ImageRef } from '../../src/lib/types.ts'

const BUCKET = 'kiroku-photos'
const PAGES_AT_ONCE = 2 // 1ページで Notion を数回呼ぶので、同時は2ページまで

const env = loadEnv()
const notion = createClient(env.token)
const supabase = createSupabase(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

// ---------- ログイン ----------
const { userId, ask } = await login(supabase)

// ---------- 準備：コレクションと取り込み済みのページ ----------
const { data: cols, error: colError } = await supabase
  .from('kiroku_collections')
  .select('id, name, fields, cover_field_key')
  .eq('user_id', userId)
if (colError) throw colError
const collections = cols as Pick<Collection, 'id' | 'name' | 'fields' | 'cover_field_key'>[]

const done = new Set<string>()
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('kiroku_records')
    .select('notion_page_id')
    .eq('user_id', userId)
    .not('notion_page_id', 'is', null)
    .range(from, from + 999)
  if (error) throw error
  for (const r of data) done.add(r.notion_page_id as string)
  if (data.length < 1000) break
}

interface Plan {
  key: DbKey
  dbTitle: string
  collection: (typeof collections)[number]
  options: Record<string, string[]>
  addedOptions: number
  todo: Page[]
}

const plans: Plan[] = []
for (const [key, dbId] of Object.entries(env.dbs) as [DbKey, string][]) {
  const m = MAPPINGS[key]
  const collection = collections.find((c) => c.name === m.collection)
  if (!collection) throw new Error(`アプリにコレクション「${m.collection}」がありません`)

  // 変換先の項目がアプリ側にそろっているか（ユーザーが項目を消していたら止める）
  const keys = new Set(collection.fields.map((f) => f.key))
  const targets = [...m.rules.map((r) => r.to), m.bodyTextTo, m.bodyImagesTo].filter((k) => k !== 'title')
  const missing = [...new Set(targets)].filter((k) => !keys.has(k))
  if (missing.length) throw new Error(`「${m.collection}」に項目がありません：${missing.join(', ')}`)

  const db = await notion.database(dbId)
  const appOptions = Object.fromEntries(collection.fields.filter((f) => f.options).map((f) => [f.key, f.options!]))
  const options = mergeOptions(key, db, appOptions)
  const addedOptions = Object.entries(options).reduce((n, [k, list]) => n + list.length - (appOptions[k]?.length ?? 0), 0)
  const pages = (await notion.queryAll(dbId)).filter((p) => !p.archived && !p.in_trash && !isSkipped(p.id))
  const todo = pages.filter((p) => !done.has(p.id))
  plans.push({ key, dbTitle: plain(db.title), collection, options, addedOptions, todo })
}

console.log('\n取り込む内容：')
for (const p of plans) {
  console.log(`  ${p.dbTitle} → ${p.collection.name}：${p.todo.length}件（選択肢の追加 ${p.addedOptions}）`)
}
if (done.size) console.log(`  取り込み済みで飛ばすページ：${done.size}件`)
if (plans.every((p) => p.todo.length === 0)) {
  console.log('取り込むページはありません')
  process.exit(0)
}
if ((await ask('\nSupabase に書き込みます。始めますか？（y / n）：')).toLowerCase() !== 'y') {
  console.log('中止しました（何も書き込んでいません）')
  process.exit(0)
}

// ---------- 取り込み ----------
const failures: { db: string; title: string; notionUrl: string; problem: string }[] = []

for (const plan of plans) {
  const { key, collection, options } = plan

  // 選択肢を先に足す（項目の定義のうち options だけを書き換える）
  if (plan.addedOptions) {
    const fields = collection.fields.map((f) => (options[f.key] ? { ...f, options: options[f.key] } : f))
    const { error } = await supabase
      .from('kiroku_collections')
      .update({ fields, updated_at: new Date().toISOString() })
      .eq('id', collection.id)
    if (error) throw error
  }

  console.log(`\n${plan.dbTitle}：${plan.todo.length}件`)
  let finished = 0
  await mapLimit(plan.todo, PAGES_AT_ONCE, async (listed) => {
    try {
      // 写真の URL は1時間で切れるので、取り込む直前に読み直す
      const page = await notion.page(listed.id)
      const c = convertPage(key, page, await notion.childrenDeep(page.id))
      alignToOptions(c, options)
      for (const issue of c.issues) failures.push({ db: key, title: c.title, notionUrl: c.notionUrl, problem: issue })

      const recordId = page.id // Notion のページ ID をそのままレコードの ID にする（やり直しても同じ）
      const folder = `${userId}/${collection.id}/${recordId}`
      const data: Record<string, FieldValue> = { ...c.data }
      for (const [field, files] of Object.entries(c.images)) {
        const def = collection.fields.find((f) => f.key === field)
        const maxSide = def?.imageKind === 'screenshot' ? 1600 : 1280
        const refs: ImageRef[] = []
        for (const [i, f] of files.entries()) {
          try {
            const s = await shrink(await download(f), maxSide)
            const name = `${field}-${i + 1}`
            const ref = { path: `${folder}/${name}.jpg`, thumb: `${folder}/${name}.thumb.jpg`, w: s.w, h: s.h }
            for (const [path, buf] of [[ref.path, s.blob], [ref.thumb, s.thumb]] as const) {
              const { error } = await supabase.storage
                .from(BUCKET)
                .upload(path, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
              if (error) throw error
            }
            refs.push(ref)
          } catch (e) {
            failures.push({
              db: key, title: c.title, notionUrl: c.notionUrl,
              problem: `写真（${field} ${i + 1}枚目 .${extOf(f)}）：${(e as Error).message.split('\n')[0]}`,
            })
          }
        }
        if (refs.length) data[field] = refs
      }

      const firstImage = (k: string | null) => (k ? (data[k] as ImageRef[] | undefined)?.[0]?.path : undefined)
      const cover =
        firstImage(collection.cover_field_key) ??
        collection.fields.filter((f) => f.type === 'image').map((f) => firstImage(f.key)).find(Boolean) ??
        null

      const { error } = await supabase.from('kiroku_records').upsert({
        id: recordId,
        user_id: userId,
        collection_id: collection.id,
        title: c.title,
        data,
        cover_image_key: cover,
        notion_page_id: page.id,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })
      if (error) throw error
    } catch (e) {
      failures.push({ db: key, title: plain(Object.values(listed.properties).find((p) => p.type === 'title')?.title), notionUrl: listed.url, problem: `ページごと失敗（再実行で続きから）：${(e as Error).message.split('\n')[0]}` })
    }
    finished++
    if (finished % 10 === 0 || finished === plan.todo.length) process.stdout.write(`\r  ${finished} / ${plan.todo.length}`)
  })
  process.stdout.write('\n')
}

await mkdir('scripts/notion-import/out', { recursive: true })
await writeFile('scripts/notion-import/out/import-log.json', JSON.stringify(failures, null, 2))
console.log(`\n完了。注意・失敗：${failures.length}件`)
for (const f of failures) console.log(`  [${f.db}] ${f.title}：${f.problem}`)
if (failures.length) console.log('一覧：scripts/notion-import/out/import-log.json')
await supabase.auth.signOut()
