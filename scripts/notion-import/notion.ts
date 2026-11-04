// Minimal Notion API client (read-only). Uses the built-in fetch, waits and retries on rate limits.

const API = 'https://api.notion.com/v1'
const VERSION = '2022-06-28'

export type RichText = { plain_text: string }
export type NotionFile =
  | { name: string; type: 'file'; file: { url: string; expiry_time: string } }
  | { name: string; type: 'external'; external: { url: string } }
export type Property = { id: string; type: string; [k: string]: unknown }
export type Page = {
  id: string
  url: string
  created_time: string
  last_edited_time: string
  archived?: boolean
  in_trash?: boolean
  properties: Record<string, Property>
}
export type Database = {
  id: string
  title: RichText[]
  properties: Record<string, Property>
}
export type Block = { id: string; type: string; has_children: boolean; [k: string]: unknown }

export function loadEnv() {
  process.loadEnvFile('.env.import')
  process.loadEnvFile('.env')
  const need = (k: string) => {
    const v = process.env[k]
    if (!v) throw new Error(`${k} が .env.import にありません`)
    return v
  }
  return {
    token: need('NOTION_TOKEN'),
    dbs: {
      recipes: need('NOTION_DB_RECIPES'),
      goods: need('NOTION_DB_GOODS'),
      books: need('NOTION_DB_BOOKS'),
    },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createClient(token: string) {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(API + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.ok) return (await res.json()) as T
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= 5) {
        throw new Error(`Notion ${method} ${path} → ${res.status} ${await res.text()}`)
      }
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt
      await sleep(wait)
    }
  }

  return {
    database: (id: string) => call<Database>('GET', `/databases/${id}`),

    page: (id: string) => call<Page>('GET', `/pages/${id}`),

    async queryAll(id: string): Promise<Page[]> {
      const pages: Page[] = []
      let cursor: string | undefined
      do {
        const r = await call<{ results: Page[]; next_cursor: string | null }>(
          'POST',
          `/databases/${id}/query`,
          { page_size: 100, start_cursor: cursor },
        )
        pages.push(...r.results)
        cursor = r.next_cursor ?? undefined
      } while (cursor)
      return pages
    },

    async childrenAll(id: string): Promise<Block[]> {
      const blocks: Block[] = []
      let cursor: string | undefined
      do {
        const q = new URLSearchParams({ page_size: '100' })
        if (cursor) q.set('start_cursor', cursor)
        const r = await call<{ results: Block[]; next_cursor: string | null }>(
          'GET',
          `/blocks/${id}/children?${q}`,
        )
        blocks.push(...r.results)
        cursor = r.next_cursor ?? undefined
      } while (cursor)
      return blocks
    },

    /** Page body with nested blocks attached as `children` (child pages are not opened). */
    async childrenDeep(id: string): Promise<Block[]> {
      const blocks = await this.childrenAll(id)
      for (const b of blocks) {
        if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
          b.children = await this.childrenDeep(b.id)
        }
      }
      return blocks
    },
  }
}

/** Run `fn` over items with at most `limit` in flight (Notion allows ~3 requests/sec). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
