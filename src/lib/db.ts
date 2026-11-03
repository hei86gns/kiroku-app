import { supabase } from './supabase'
import type { Collection, KRecord } from './types'

const COLLECTIONS_TABLE = 'kiroku_collections'
const RECORDS_TABLE     = 'kiroku_records'
export const BUCKET     = 'kiroku-photos'

const COLLECTION_COLS =
  'id, name, en_name, theme, icon, title_label, sub_field_key, fields, cover_field_key, default_view, saved_view, meta, sort_order'
const RECORD_COLS = 'id, collection_id, title, data, cover_image_key, created_at, updated_at'

export const fetchCollections = async (userId: string): Promise<Collection[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .select(COLLECTION_COLS)
    .eq('user_id', userId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as Collection[]
}

export const fetchRecords = async (userId: string): Promise<KRecord[]> => {
  // PostgREST returns at most 1000 rows per request, so page through everything
  const PAGE = 1000
  const out: KRecord[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(RECORDS_TABLE)
      .select(RECORD_COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as KRecord[]))
    if (!data || data.length < PAGE) return out
  }
}

export const upsertCollection = async (userId: string, c: Collection): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS_TABLE)
    .upsert({ ...c, user_id: userId, updated_at: new Date().toISOString() })
  if (error) throw error
}

export const deleteCollection = async (id: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS_TABLE).delete().eq('id', id)
  if (error) throw error
}

export const upsertRecord = async (userId: string, r: KRecord): Promise<void> => {
  const { error } = await supabase.from(RECORDS_TABLE).upsert({ ...r, user_id: userId })
  if (error) throw error
}

export const deleteRecord = async (id: string): Promise<void> => {
  const { error } = await supabase.from(RECORDS_TABLE).delete().eq('id', id)
  if (error) throw error
}

export const uploadImage = async (path: string, blob: Blob): Promise<void> => {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
  if (error) throw error
}

export const removeFiles = async (paths: string[]): Promise<void> => {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** Every file under a folder, walking into subfolders (folders come back with a null id). */
export const listFilesUnder = async (prefix: string): Promise<string[]> => {
  const out: string[] = []
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`
    if (item.id) out.push(path)
    else out.push(...(await listFilesUnder(path)))
  }
  return out
}

export const signUrls = async (paths: string[]): Promise<Map<string, string>> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7)
  if (error) throw error
  const out = new Map<string, string>()
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl)
  return out
}
