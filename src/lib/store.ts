import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCollections, fetchRecords } from './db'
import { defaultCollections } from './defaults'
import { asImages } from './fields'
import { deleteOp, loadCache, putBlob, saveCache } from './local'
import { collectionKey, enqueue, flush, pendingOps, recordKey, saveCollectionOp, saveRecordOp } from './queue'
import type { Collection, KRecord } from './types'

export interface NewImage {
  path: string
  thumb: string
  blob: Blob
  thumbBlob: Blob
}

export type SyncState = 'synced' | 'sending' | 'offline' | 'error'

const allImagePaths = (r: KRecord) =>
  Object.values(r.data).flatMap((v) => asImages(v).flatMap((i) => [i.path, i.thumb]))

/**
 * All data for the signed-in user. Screens update instantly; changes are written to
 * the on-device outbox and sent to Supabase in the background (now, or once back online).
 */
export function useKiroku(userId: string) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [records, setRecords] = useState<KRecord[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [sync, setSync] = useState<SyncState>('synced')

  // Latest values for async callbacks
  const latest = useRef({ collections, records })
  useEffect(() => { latest.current = { collections, records } }, [collections, records])

  const refreshPending = useCallback(async () => {
    const ops = await pendingOps()
    setPending(new Set(ops.map((o) => (o.kind === 'upsertRecord' ? o.record.id : o.kind === 'deleteRecord' ? o.id : o.key))))
    return ops.length
  }, [])

  const runSync = useCallback(async (): Promise<number> => {
    if (!navigator.onLine) {
      setSync('offline')
      await refreshPending()
      return 0
    }
    setSync('sending')
    let total = 0
    try {
      // Keep going while new changes arrive during a send
      for (let i = 0; i < 5; i++) {
        // flush() may hand back a send that started before the newest change was queued,
        // so check what is still waiting rather than trusting its count
        total += await flush(userId)
        if ((await refreshPending()) === 0) break
      }
      setSync('synced')
    } catch (err) {
      console.error(err)
      setSync(navigator.onLine ? 'error' : 'offline')
    }
    await refreshPending()
    return total
  }, [userId, refreshPending])

  // Load: on-device copy first (instant, works offline), then the server copy
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadCache(userId)
      if (cancelled) return
      if (cached.collections.length) {
        setCollections(cached.collections)
        setRecords(cached.records)
        setLoaded(true)
      }
      await refreshPending()
      if (!navigator.onLine) { setLoaded(true); setSync('offline'); return }
      try {
        await runSync()
        let [cols, recs] = await Promise.all([fetchCollections(userId), fetchRecords(userId)])
        if (cancelled) return
        if (cols.length === 0) {
          cols = defaultCollections()
          for (const c of cols) await saveCollectionOp(c)
          void runSync()
        }
        // Anything still waiting in the outbox wins over the server copy
        const ops = await pendingOps()
        for (const op of ops) {
          if (op.kind === 'upsertRecord') recs = [op.record, ...recs.filter((r) => r.id !== op.record.id)]
          if (op.kind === 'deleteRecord') recs = recs.filter((r) => r.id !== op.id)
          if (op.kind === 'upsertCollection') cols = [...cols.filter((c) => c.id !== op.collection.id), op.collection]
          if (op.kind === 'deleteCollection') cols = cols.filter((c) => c.id !== op.id)
        }
        cols.sort((a, b) => a.sort_order - b.sort_order)
        setCollections(cols)
        setRecords(recs)
      } catch (err) {
        console.error(err)
        setSync('error')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [userId, runSync, refreshPending])

  // Keep the on-device copy fresh
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => { void saveCache(userId, collections, records) }, 400)
    return () => clearTimeout(t)
  }, [userId, loaded, collections, records])

  // Resend when the connection comes back or the app is reopened
  useEffect(() => {
    const goOnline = () => { setOnline(true); void runSync() }
    const goOffline = () => { setOnline(false); setSync('offline') }
    const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine) void runSync() }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runSync])

  // ---- writes ----

  /** Saves a record. New pictures are kept on the device until they are uploaded. */
  const saveRecord = useCallback(async (next: KRecord, newImages: NewImage[] = []) => {
    const prev = latest.current.records.find((r) => r.id === next.id)
    const stamped = { ...next, updated_at: new Date().toISOString() }
    setRecords((rs) => (prev ? rs.map((r) => (r.id === next.id ? stamped : r)) : [stamped, ...rs]))
    setPending((p) => new Set(p).add(next.id))
    for (const img of newImages) {
      await putBlob(img.path, img.blob)
      await putBlob(img.thumb, img.thumbBlob)
    }
    if (prev) {
      const keep = new Set(allImagePaths(stamped))
      const removed = allImagePaths(prev).filter((p) => !keep.has(p))
      if (removed.length) await enqueue({ key: `files:${crypto.randomUUID()}`, kind: 'deleteFiles', paths: removed })
    }
    await saveRecordOp(stamped)
    void runSync()
  }, [runSync])

  const deleteRecord = useCallback(async (r: KRecord) => {
    setRecords((rs) => rs.filter((x) => x.id !== r.id))
    await enqueue({ key: recordKey(r.id), kind: 'deleteRecord', id: r.id, prefix: `${userId}/${r.collection_id}/${r.id}` })
    void runSync()
  }, [userId, runSync])

  const saveCollection = useCallback(async (c: Collection) => {
    setCollections((cs) => {
      const exists = cs.some((x) => x.id === c.id)
      return exists ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]
    })
    await saveCollectionOp(c)
    void runSync()
  }, [runSync])

  const deleteCollection = useCallback(async (c: Collection) => {
    setCollections((cs) => cs.filter((x) => x.id !== c.id))
    setRecords((rs) => rs.filter((r) => r.collection_id !== c.id))
    // Unsent records of this collection would only fail once it is gone, so drop them
    for (const op of await pendingOps()) {
      if (op.kind === 'upsertRecord' && op.record.collection_id === c.id) await deleteOp(op.key)
    }
    await enqueue({ key: collectionKey(c.id), kind: 'deleteCollection', id: c.id, prefix: `${userId}/${c.id}` })
    void runSync()
  }, [userId, runSync])

  return {
    collections, records, pending, loaded, online, sync,
    saveRecord, deleteRecord, saveCollection, deleteCollection, runSync,
  }
}

export type Kiroku = ReturnType<typeof useKiroku>
