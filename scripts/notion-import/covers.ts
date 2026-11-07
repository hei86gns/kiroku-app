// Notion の各データベースのカバー写真を、アプリのコレクションのカバー（一覧の上の写真）にする。
// データベース自体にカバーが無いとき（表がページの中にある「買ったもの」）は、そのページのカバーを使う。
// やり直すと新しい写真に置き換わる（前のカバー写真は消す）。
//   npm run import:covers

import { createClient as createSupabase } from '@supabase/supabase-js'
import { MAPPINGS, pickDbs, plain } from './convert.ts'
import { download, shrink } from './images.ts'
import { login } from './login.ts'
import { createClient, loadEnv, type NotionFile } from './notion.ts'
import type { Collection, ImageRef } from '../../src/lib/types.ts'

const BUCKET = 'kiroku-photos'
const COVER_SIDE = 1600

const env = loadEnv()
const notion = createClient(env.token)
const supabase = createSupabase(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

type WithCover = { cover?: NotionFile | null; parent?: { type: string; page_id?: string } }

const { userId, ask } = await login(supabase)
const { data: cols, error: colError } = await supabase.from('kiroku_collections').select('id, name, meta').eq('user_id', userId)
if (colError) throw colError
const collections = cols as Pick<Collection, 'id' | 'name' | 'meta'>[]

const plans: { name: string; collection: (typeof collections)[number]; cover: NotionFile; from: string }[] = []
for (const [key, dbId] of pickDbs(env.dbs)) {
  const db = await notion.database(dbId)
  const collection = collections.find((c) => c.name === MAPPINGS[key].collection)
  if (!collection) { console.log(`  ${plain(db.title)}：アプリに「${MAPPINGS[key].collection}」が無いので飛ばします`); continue }
  let { cover, parent } = db as unknown as WithCover
  let from = 'データベース'
  if (!cover && parent?.type === 'page_id') {
    cover = ((await notion.page(parent.page_id!)) as unknown as WithCover).cover
    from = '親ページ'
  }
  if (!cover) { console.log(`  ${plain(db.title)}：カバー写真がありません`); continue }
  plans.push({ name: collection.name, collection, cover, from })
}

console.log('\nカバーにする写真：')
for (const p of plans) console.log(`  ${p.name} ← Notion の${p.from}のカバー${p.collection.meta?.cover ? '（今のカバーを置き換え）' : ''}`)
if (!plans.length) process.exit(0)
if ((await ask('\nSupabase に書き込みます。始めますか？（y / n）：')).toLowerCase() !== 'y') {
  console.log('中止しました（何も書き込んでいません）')
  process.exit(0)
}

for (const { name, collection, cover } of plans) {
  const s = await shrink(await download(cover), COVER_SIDE)
  // 毎回別の名前にする（アプリは写真の URL を数日覚えるので、同じ名前だと古い写真が出続ける）
  const name0 = `${userId}/${collection.id}/cover-${Date.now().toString(36)}`
  const ref: ImageRef = { path: `${name0}.jpg`, thumb: `${name0}.thumb.jpg`, w: s.w, h: s.h }
  for (const [path, buf] of [[ref.path, s.blob], [ref.thumb, s.thumb]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
    if (error) throw error
  }
  const { error } = await supabase
    .from('kiroku_collections')
    .update({ meta: { ...collection.meta, cover: ref }, updated_at: new Date().toISOString() })
    .eq('id', collection.id)
  if (error) throw error
  const old = collection.meta?.cover
  if (old) await supabase.storage.from(BUCKET).remove([old.path, old.thumb])
  console.log(`  ${name}：完了（${s.w}×${s.h}）`)
}
console.log('\nアプリを開き直すと表示されます')
