import * as remote from './db'
import { allOps, deleteBlob, deleteBlobsUnder, deleteOp, getBlob, putOp, type Op } from './local'
import { asImages } from './fields'
import type { Collection, KRecord } from './types'

type OpInput = Op extends infer T ? (T extends Op ? Omit<T, 'at'> : never) : never

/**
 * Every save goes into the on-device outbox first, then gets sent.
 * Because each op is an upsert / delete by id, sending the same op twice is harmless.
 */
export const enqueue = (op: OpInput) => putOp({ ...op, at: Date.now() } as Op)

export const recordKey = (id: string) => `rec:${id}`
export const collectionKey = (id: string) => `col:${id}`

// Collections must exist before records point at them; collection deletes go last.
const rank = (op: Op) =>
  op.kind === 'upsertCollection' ? 0 : op.kind === 'deleteCollection' ? 2 : 1

export async function pendingOps(): Promise<Op[]> {
  return (await allOps()).sort((a, b) => rank(a) - rank(b) || a.at - b.at)
}

async function uploadPendingImages(record: KRecord) {
  for (const v of Object.values(record.data)) {
    for (const img of asImages(v)) {
      for (const path of [img.path, img.thumb]) {
        const blob = await getBlob(path)
        if (!blob) continue
        await remote.uploadImage(path, blob)
        await deleteBlob(path)
      }
    }
  }
}

async function send(userId: string, op: Op) {
  switch (op.kind) {
    case 'upsertCollection':
      return remote.upsertCollection(userId, op.collection)
    case 'deleteCollection':
      await remote.removeFiles(await remote.listFilesUnder(op.prefix))
      await deleteBlobsUnder(op.prefix)
      return remote.deleteCollection(op.id)
    case 'upsertRecord':
      await uploadPendingImages(op.record)
      return remote.upsertRecord(userId, op.record)
    case 'deleteRecord':
      await remote.removeFiles(await remote.listFilesUnder(op.prefix))
      await deleteBlobsUnder(op.prefix)
      return remote.deleteRecord(op.id)
    case 'deleteFiles':
      for (const p of op.paths) await deleteBlob(p)
      return remote.removeFiles(op.paths)
  }
}

let running: Promise<number> | null = null

/** Sends everything in the outbox, in order. Stops at the first failure and keeps the rest for later. */
export function flush(userId: string): Promise<number> {
  if (running) return running
  running = (async () => {
    let sent = 0
    for (const op of await pendingOps()) {
      await send(userId, op)
      // If the same key was overwritten while sending, keep the newer op for the next round
      const latest = (await allOps()).find((o) => o.key === op.key)
      if (latest && latest.at === op.at) await deleteOp(op.key)
      sent++
    }
    return sent
  })().finally(() => { running = null })
  return running
}

export const saveCollectionOp = (c: Collection) =>
  enqueue({ key: collectionKey(c.id), kind: 'upsertCollection', collection: c })

export const saveRecordOp = (r: KRecord) =>
  enqueue({ key: recordKey(r.id), kind: 'upsertRecord', record: r })
