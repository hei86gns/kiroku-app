// Notion ページ → 記録アプリのレコード（写真はまだ Notion の URL のまま）。dry と本番で共通に使う。
// 対応表は docs/plan-v2-notion-import.md と HANDOFF.md の「ユーザーと決めた変換方針」。

import type { Block, Database, NotionFile, Page, Property, RichText } from './notion.ts'
import type { Collection } from '../../src/lib/types.ts'

export type DbKey = 'recipes' | 'goods' | 'books' | 'music' | 'gifts'

type Rule = {
  from: string
  to: string
  as: 'title' | 'text' | 'number' | 'date' | 'url' | 'rating' | 'select' | 'multiselect' | 'tags' | 'multitags' | 'images'
}

/** A collection the import creates when the app does not have it yet (Music / もらったもの, 2026-11-07). */
export type NewCollection = Omit<Collection, 'id' | 'name' | 'sort_order'>

export interface Mapping {
  /** App collection name (kiroku_collections.name) */
  collection: string
  rules: Rule[]
  /** Notion properties intentionally left out */
  skip: string[]
  /** Page body text is appended to this field, body images to `bodyImagesTo` */
  bodyTextTo: string
  bodyImagesTo: string
  /** Extra text properties appended to `bodyTextTo` (レシピの「プロパティ」) */
  appendTo?: { from: string; to: string }[]
  /** Select values rewritten before use (trimmed first) */
  rename?: Record<string, Record<string, string>>
  /** When the title is empty, this field's text becomes the title (書名を著者欄に書いたページ) */
  titleFallback?: string
  /** Create the collection with this shape if it is missing */
  create?: NewCollection
}

export const MAPPINGS: Record<DbKey, Mapping> = {
  recipes: {
    collection: 'レシピ',
    rules: [
      { from: '名前', to: 'title', as: 'title' },
      { from: 'カテゴリ', to: 'category', as: 'multiselect' },
      { from: '出典', to: 'source', as: 'select' },
      { from: '評価', to: 'rating', as: 'rating' },
      { from: 'URL', to: 'url', as: 'url' },
      { from: '自分の料理画像', to: 'myPhoto', as: 'images' },
      { from: '料理日', to: 'cookedOn', as: 'date' },
      { from: '食材', to: 'ingredients', as: 'tags' },
      { from: '調味料等', to: 'seasonings', as: 'tags' },
      { from: 'Notes', to: 'notes', as: 'text' },
    ],
    skip: [],
    bodyTextTo: 'notes',
    bodyImagesTo: 'stepShot',
    appendTo: [{ from: 'プロパティ', to: 'notes' }],
  },
  goods: {
    collection: '買ったもの',
    rules: [
      { from: '名前', to: 'title', as: 'title' },
      { from: 'カテゴリー', to: 'category', as: 'multiselect' },
      { from: '購入日', to: 'boughtOn', as: 'date' },
      { from: '型番', to: 'model', as: 'text' },
      { from: '画像', to: 'photo', as: 'images' },
      { from: '購入店', to: 'shop', as: 'select' },
      { from: '備考', to: 'note', as: 'text' },
      { from: 'URL', to: 'url', as: 'url' },
      { from: '価格', to: 'price', as: 'number' },
    ],
    skip: [],
    bodyTextTo: 'note',
    bodyImagesTo: 'photo',
  },
  books: {
    collection: '読書記録',
    rules: [
      { from: 'Title', to: 'title', as: 'title' },
      { from: 'Auther', to: 'author', as: 'text' },
      { from: 'Language', to: 'language', as: 'select' },
      { from: 'Start Reading', to: 'start', as: 'date' },
      { from: 'Finish Reading', to: 'finish', as: 'date' },
      { from: '評価', to: 'rating', as: 'rating' },
      { from: 'Price', to: 'price', as: 'number' },
      { from: 'メモ', to: 'memo', as: 'text' },
      { from: 'カバー', to: 'cover', as: 'images' },
      { from: '内容・感想', to: 'review', as: 'text' },
      { from: 'Place', to: 'place', as: 'text' },
    ],
    skip: ['Duration', '関数'],
    bodyTextTo: 'review',
    bodyImagesTo: 'cover',
    rename: { language: { Japanese: '日本語' } },
    titleFallback: 'author',
  },
  music: {
    collection: 'Music',
    rules: [
      { from: '名前', to: 'title', as: 'title' },
      { from: 'Artist', to: 'artist', as: 'multitags' },
      { from: '購入日', to: 'boughtOn', as: 'date' },
      { from: 'Price', to: 'price', as: 'number' },
    ],
    skip: [],
    bodyTextTo: 'memo',
    bodyImagesTo: 'jacket',
    create: {
      en_name: 'MUSIC',
      theme: 'amber',
      icon: 'music',
      title_label: '曲名',
      sub_field_key: 'artist',
      cover_field_key: 'jacket',
      default_view: 'list',
      saved_view: { view: 'list', sort: 'boughtOn' },
      meta: {},
      fields: [
        { key: 'artist', label: 'アーティスト', type: 'multiselect', tag: true },
        { key: 'boughtOn', label: '購入日', type: 'date' },
        { key: 'price', label: '価格', type: 'number', unit: '円' },
        { key: 'jacket', label: 'ジャケット画像', type: 'image', imageKind: 'photo' },
        { key: 'memo', label: 'メモ', type: 'longtext' },
      ],
    },
  },
  gifts: {
    collection: 'もらったもの',
    rules: [
      { from: 'Name', to: 'title', as: 'title' },
      { from: 'Files & media', to: 'photo', as: 'images' },
      { from: '誰から？', to: 'from', as: 'text' },
      { from: 'Date', to: 'receivedOn', as: 'date' },
      { from: 'なんのプレゼント', to: 'what', as: 'text' },
      { from: 'Tags', to: 'occasion', as: 'multiselect' },
      { from: 'メモ', to: 'memo', as: 'text' },
    ],
    skip: [],
    bodyTextTo: 'memo',
    bodyImagesTo: 'photo',
    create: {
      en_name: 'GIFTS',
      theme: 'pink',
      icon: 'gift',
      title_label: '名前',
      sub_field_key: 'from',
      cover_field_key: 'photo',
      default_view: 'gallery',
      saved_view: { view: 'gallery', sort: 'receivedOn' },
      meta: {},
      fields: [
        { key: 'photo', label: '写真', type: 'image', imageKind: 'photo' },
        { key: 'from', label: '誰から', type: 'text' },
        { key: 'receivedOn', label: 'もらった日', type: 'date' },
        { key: 'what', label: 'なんのプレゼント', type: 'text' },
        { key: 'occasion', label: 'きっかけ', type: 'multiselect', options: [] },
        { key: 'memo', label: 'メモ', type: 'longtext' },
      ],
    },
  },
}

/**
 * Databases to work on: the keys given on the command line (npm run import -- music gifts), or all.
 * Keeps a run to the new databases so pages added since the first import are not pulled in by accident.
 */
export function pickDbs(dbs: Record<DbKey, string>): [DbKey, string][] {
  const all = Object.entries(dbs) as [DbKey, string][]
  const want = process.argv.slice(2)
  if (!want.length) return all
  const bad = want.filter((k) => !(k in dbs))
  if (bad.length) throw new Error(`知らないデータベース：${bad.join(', ')}（使えるのは ${Object.keys(dbs).join(' / ')}）`)
  return all.filter(([k]) => want.includes(k))
}

/** Nearly empty pages the user chose not to import (2026-11-04). Notion page ids without dashes. */
export const SKIP_PAGES = new Set([
  '3a36579a5c2481ebad7ce8e713fdaf54', // Recipe「ゆりあTOEIC」：ファイル添付だけ
  '3636579a5c2480928b73d0bdcdfd041b', // 買ったもの：名前なし、カテゴリーだけ
  '2b56579a5c2480829546f7e77ba2031c', // 買ったもの：空
  '1096579a5c2480f19160e48aef5fe3c5', // もらったもの：空（2026-11-07）
])
export const isSkipped = (pageId: string) => SKIP_PAGES.has(pageId.replaceAll('-', ''))

export type Value = string | number | string[]

export interface Converted {
  pageId: string
  notionUrl: string
  title: string
  data: Record<string, Value>
  /** Field key → pictures still on Notion, in order */
  images: Record<string, NotionFile[]>
  created_at: string
  updated_at: string
  /** Things that could not be converted cleanly (shown in the dry-run report) */
  issues: string[]
}

export const plain = (rt: unknown) => ((rt as RichText[] | undefined) ?? []).map((t) => t.plain_text).join('')

/** 「牛肉、にんじん、」→ ['牛肉', 'にんじん'] (also accepts , ， and line breaks) */
export const splitTags = (s: string) => [...new Set(s.split(/[、,，\n]/).map((t) => t.trim()).filter(Boolean))]

const propText = (p: Property): string => {
  const v = p[p.type]
  if (p.type === 'title' || p.type === 'rich_text') return plain(v).trim()
  if (p.type === 'select') return ((v as { name: string } | null)?.name ?? '').trim()
  if (p.type === 'number') return v == null ? '' : String(v)
  if (p.type === 'url') return ((v as string | null) ?? '').trim()
  return ''
}

const BODY_TEXT_TYPES: Record<string, (n: number) => string> = {
  paragraph: () => '',
  heading_1: () => '■ ',
  heading_2: () => '■ ',
  heading_3: () => '■ ',
  bulleted_list_item: () => '・',
  numbered_list_item: (n) => `${n}. `,
  to_do: () => '',
  quote: () => '> ',
  callout: () => '',
  toggle: () => '▸ ',
  code: () => '',
}

/**
 * Page body → text lines and images. Nested blocks are already attached as `children`
 * (see loadBody). Returns issues for block types we cannot carry over.
 */
export function readBody(blocks: Block[], depth = 0): { lines: string[]; images: NotionFile[]; issues: string[] } {
  const out = { lines: [] as string[], images: [] as NotionFile[], issues: [] as string[] }
  let n = 0
  for (const b of blocks) {
    n = b.type === 'numbered_list_item' ? n + 1 : 0
    const body = b[b.type] as { rich_text?: RichText[]; checked?: boolean; url?: string } | undefined
    const indent = '  '.repeat(depth)
    if (b.type in BODY_TEXT_TYPES) {
      const check = b.type === 'to_do' ? (body?.checked ? '☑ ' : '☐ ') : ''
      const t = plain(body?.rich_text)
      if (t || b.type === 'to_do') out.lines.push(indent + BODY_TEXT_TYPES[b.type](n) + check + t)
      else out.lines.push('')
    } else if (b.type === 'image') {
      out.images.push(b.image as NotionFile)
    } else if (b.type === 'bookmark' || b.type === 'link_preview' || b.type === 'embed' || b.type === 'video') {
      const url = body?.url ?? ((b[b.type] as { external?: { url: string } })?.external?.url ?? '')
      if (url) out.lines.push(indent + url)
    } else if (b.type !== 'divider') {
      out.issues.push(`本文の「${b.type}」は取り込めません`)
    }
    const kids = b.children as Block[] | undefined
    if (kids?.length) {
      const sub = readBody(kids, depth + 1)
      out.lines.push(...sub.lines)
      out.images.push(...sub.images)
      out.issues.push(...sub.issues)
    }
  }
  return out
}

/** Join paragraphs, dropping empty ones and blank lines at either end. */
const joinText = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join('\n\n')

export function convertPage(key: DbKey, page: Page, body: Block[]): Converted {
  const m = MAPPINGS[key]
  const c: Converted = {
    pageId: page.id,
    notionUrl: page.url,
    title: '',
    data: {},
    images: {},
    created_at: page.created_time,
    updated_at: page.last_edited_time,
    issues: [],
  }
  const addImages = (to: string, files: NotionFile[]) => {
    if (files.length) c.images[to] = [...(c.images[to] ?? []), ...files]
  }

  for (const r of m.rules) {
    const p = page.properties[r.from]
    if (!p) {
      c.issues.push(`項目「${r.from}」が Notion にありません`)
      continue
    }
    const s = propText(p)
    switch (r.as) {
      case 'title':
        c.title = s
        break
      case 'text':
      case 'url':
        if (s) c.data[r.to] = s
        break
      case 'number': {
        if (!s) break
        const n = Number(s.replace(/[,，円¥\s]/g, ''))
        if (Number.isFinite(n)) c.data[r.to] = n
        else c.issues.push(`${r.from}「${s}」を数値にできません`)
        break
      }
      case 'date': {
        const d = p.date as { start: string; end: string | null } | null
        if (!d) break
        c.data[r.to] = d.start.slice(0, 10)
        if (d.end) c.issues.push(`${r.from} の終了日（${d.end.slice(0, 10)}）は取り込めません`)
        break
      }
      case 'rating': {
        if (!s) break
        const stars = (s.match(/⭐/g) ?? []).length || Number(s.match(/\d/)?.[0] ?? 0)
        if (stars >= 1 && stars <= 5) c.data[r.to] = stars
        else c.issues.push(`${r.from}「${s}」を星の数にできません`)
        break
      }
      case 'select': {
        if (!s) break
        c.data[r.to] = m.rename?.[r.to]?.[s] ?? s
        break
      }
      case 'multiselect':
      case 'multitags': {
        const names = (p.multi_select as { name: string }[]).map((o) => o.name.trim()).filter(Boolean)
        if (names.length) c.data[r.to] = names
        break
      }
      case 'tags': {
        const tags = splitTags(s)
        if (tags.length) c.data[r.to] = tags
        break
      }
      case 'images': {
        const files = p.files as NotionFile[]
        addImages(r.to, files)
        break
      }
    }
  }

  for (const a of m.appendTo ?? []) {
    const p = page.properties[a.from]
    const s = p ? propText(p) : ''
    if (s) c.data[a.to] = joinText(String(c.data[a.to] ?? ''), s)
  }

  const b = readBody(body)
  const bodyText = b.lines.join('\n')
  if (bodyText.trim()) c.data[m.bodyTextTo] = joinText(String(c.data[m.bodyTextTo] ?? ''), bodyText)
  addImages(m.bodyImagesTo, b.images)
  c.issues.push(...new Set(b.issues))

  const fb = m.titleFallback
  if (!c.title && fb && typeof c.data[fb] === 'string') {
    c.title = c.data[fb]
    delete c.data[fb]
    c.issues.push(`タイトルが空のため「${fb}」の値をタイトルにしました`)
  }
  if (!c.title) c.issues.push('タイトルが空です')
  return c
}

/** Notion properties that have values but no rule (so nothing is silently dropped). */
export function unmappedProps(key: DbKey, db: Database): string[] {
  const m = MAPPINGS[key]
  const known = new Set([...m.rules.map((r) => r.from), ...m.skip, ...(m.appendTo ?? []).map((a) => a.from)])
  return Object.keys(db.properties).filter((n) => !known.has(n))
}

/**
 * Choice lists after import: the app's current options first, then Notion's options
 * (in Notion's order) that are not there yet. Same name ignoring case/spaces counts as the same.
 */
export function mergeOptions(key: DbKey, db: Database, appOptions: Record<string, string[]>): Record<string, string[]> {
  const m = MAPPINGS[key]
  const out: Record<string, string[]> = {}
  const norm = (s: string) => s.trim().toLowerCase()
  for (const r of m.rules) {
    if (r.as !== 'select' && r.as !== 'multiselect') continue
    const def = db.properties[r.from]
    const notion = ((def?.[def.type] as { options?: { name: string }[] })?.options ?? []).map((o) => {
      const s = o.name.trim()
      return m.rename?.[r.to]?.[s] ?? s
    })
    const list = [...(appOptions[r.to] ?? [])]
    for (const o of notion) if (o && !list.some((x) => norm(x) === norm(o))) list.push(o)
    out[r.to] = list
  }
  return out
}

/** Uses the app's spelling when Notion differs only by case/spaces (amazon → Amazon). */
export function alignToOptions(c: Converted, options: Record<string, string[]>) {
  const norm = (s: string) => s.trim().toLowerCase()
  for (const [field, list] of Object.entries(options)) {
    const fix = (v: string) => list.find((o) => norm(o) === norm(v)) ?? v
    const v = c.data[field]
    if (typeof v === 'string') c.data[field] = fix(v)
    else if (Array.isArray(v)) c.data[field] = [...new Set(v.map(fix))]
  }
}
