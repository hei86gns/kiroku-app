import { useEffect, useState } from 'react'
import { signUrls } from './db'
import { getBlob, getUrls, putUrls } from './local'

// The bucket is private, so pictures are shown through signed (time-limited) URLs.
// We ask for many at once and remember them for 6 days (they are valid for 7),
// so the same URL is reused and the browser / service worker cache can hit.
const TTL = 6 * 24 * 60 * 60 * 1000

const memo = new Map<string, string>()
const waiting = new Map<string, ((url: string | undefined) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null

async function resolveBatch() {
  timer = null
  const batch = new Map(waiting)
  waiting.clear()
  const paths = [...batch.keys()]
  const found = new Map<string, string>()

  // 1) pictures still on this device (not uploaded yet)
  for (const p of paths) {
    const blob = await getBlob(p)
    if (blob) found.set(p, URL.createObjectURL(blob))
  }
  // 2) URLs signed earlier
  const rest = paths.filter((p) => !found.has(p))
  for (const [p, u] of await getUrls(rest)) found.set(p, u)
  // 3) ask Supabase for the remainder
  const missing = rest.filter((p) => !found.has(p))
  if (missing.length && navigator.onLine) {
    try {
      const signed = await signUrls(missing)
      await putUrls(signed, TTL)
      for (const [p, u] of signed) found.set(p, u)
    } catch (err) {
      console.error(err)
    }
  }
  for (const [p, cbs] of batch) {
    const url = found.get(p)
    if (url) memo.set(p, url)
    cbs.forEach((cb) => cb(url))
  }
}

function request(path: string, cb: (url: string | undefined) => void) {
  const list = waiting.get(path) ?? []
  list.push(cb)
  waiting.set(path, list)
  timer ??= setTimeout(resolveBatch, 16)
}

/** Forget a local preview so the next lookup picks up the uploaded copy. */
export const forgetUrl = (path: string) => { memo.delete(path) }

export function useImageUrl(path: string | null | undefined): string | undefined {
  const [state, setState] = useState<{ path: string; url: string | undefined } | null>(null)
  useEffect(() => {
    if (!path || memo.has(path)) return
    let alive = true
    request(path, (url) => { if (alive) setState({ path, url }) })
    return () => { alive = false }
  }, [path])
  if (!path) return undefined
  return memo.get(path) ?? (state?.path === path ? state.url : undefined)
}
