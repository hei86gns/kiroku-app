import { openDB, type DBSchema } from 'idb'
import type { Collection, KRecord } from './types'

/** Something waiting to be sent to Supabase. Ops sharing a `key` replace each other (latest wins). */
export type Op =
  | { key: string; at: number; kind: 'upsertCollection'; collection: Collection }
  | { key: string; at: number; kind: 'deleteCollection'; id: string; prefix: string }
  | { key: string; at: number; kind: 'upsertRecord'; record: KRecord }
  | { key: string; at: number; kind: 'deleteRecord'; id: string; prefix: string }
  | { key: string; at: number; kind: 'deleteFiles'; paths: string[] }

interface KirokuDB extends DBSchema {
  /** Resized pictures not uploaded yet, keyed by their future Storage path. */
  blobs: { key: string; value: Blob }
  outbox: { key: string; value: Op }
  /** Last known collections / records per user, for offline viewing. */
  cache: { key: string; value: unknown }
  /** Signed image URLs, reused across reloads so the browser cache can hit. */
  urls: { key: string; value: { url: string; exp: number } }
}

const dbp = openDB<KirokuDB>('kiroku', 1, {
  upgrade(db) {
    db.createObjectStore('blobs')
    db.createObjectStore('outbox', { keyPath: 'key' })
    db.createObjectStore('cache')
    db.createObjectStore('urls')
  },
})

export const putBlob = async (path: string, blob: Blob) => (await dbp).put('blobs', blob, path)
export const getBlob = async (path: string) => (await dbp).get('blobs', path)
export const deleteBlob = async (path: string) => (await dbp).delete('blobs', path)

export async function deleteBlobsUnder(prefix: string) {
  const db = await dbp
  const range = IDBKeyRange.bound(prefix + '/', prefix + '/￿')
  for (const k of await db.getAllKeys('blobs', range)) await db.delete('blobs', k)
}

export const putOp = async (op: Op) => (await dbp).put('outbox', op)
export const deleteOp = async (key: string) => (await dbp).delete('outbox', key)
export const allOps = async () => (await dbp).getAll('outbox')

export async function loadCache(userId: string) {
  const db = await dbp
  const collections = (await db.get('cache', `${userId}:collections`)) as Collection[] | undefined
  const records = (await db.get('cache', `${userId}:records`)) as KRecord[] | undefined
  return { collections: collections ?? [], records: records ?? [] }
}

export async function saveCache(userId: string, collections: Collection[], records: KRecord[]) {
  const db = await dbp
  const tx = db.transaction('cache', 'readwrite')
  await Promise.all([
    tx.store.put(collections, `${userId}:collections`),
    tx.store.put(records, `${userId}:records`),
    tx.done,
  ])
}

export async function getUrls(paths: string[]) {
  const db = await dbp
  const now = Date.now()
  const out = new Map<string, string>()
  for (const p of paths) {
    const hit = await db.get('urls', p)
    if (hit && hit.exp > now) out.set(p, hit.url)
  }
  return out
}

export async function putUrls(urls: Map<string, string>, ttlMs: number) {
  const db = await dbp
  const tx = db.transaction('urls', 'readwrite')
  const exp = Date.now() + ttlMs
  await Promise.all([...[...urls].map(([p, url]) => tx.store.put({ url, exp }, p)), tx.done])
}

/** Wipe everything on logout so the next account starts clean. */
export async function clearAll() {
  const db = await dbp
  await Promise.all([db.clear('blobs'), db.clear('outbox'), db.clear('cache'), db.clear('urls')])
}
