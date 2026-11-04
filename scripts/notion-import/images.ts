// 写真のダウンロードと縮小（アプリの src/lib/image.ts と同じ設定）。
// sharp で読めない iPhone の HEIC は、Mac 標準の sips で JPEG にしてから縮小する。

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import type { NotionFile } from './notion.ts'

const THUMB_SIDE = 480

export const urlOf = (f: NotionFile) => (f.type === 'file' ? f.file.url : f.external.url)

export const extOf = (f: NotionFile) =>
  (new URL(urlOf(f)).pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()

export interface Shrunk {
  blob: Buffer
  thumb: Buffer
  w: number
  h: number
  /** Original size in bytes */
  original: number
  viaSips: boolean
}

export async function download(f: NotionFile): Promise<Buffer> {
  const res = await fetch(urlOf(f), { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`ダウンロード失敗 ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function sipsToJpeg(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'kiroku-'))
  try {
    const src = join(dir, 'in'), dst = join(dir, 'out.jpg')
    await writeFile(src, input)
    await promisify(execFile)('sips', ['-s', 'format', 'jpeg', src, '--out', dst])
    return await readFile(dst)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const encode = (input: Buffer, side: number, quality: number) =>
  sharp(input)
    .rotate() // EXIF の向きを反映（縦向き写真が横倒しにならない）
    .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // 透過 PNG のスクショを白背景に
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })

export async function shrink(input: Buffer, maxSide: number): Promise<Shrunk> {
  let src = input
  let viaSips = false
  // HEIC は読み込み情報は取れても中身を開けないことがあるので、実際に縮小してみて判定する
  let main = await encode(src, maxSide, 80).catch(() => null)
  if (!main) {
    src = await sipsToJpeg(input)
    viaSips = true
    main = await encode(src, maxSide, 80)
  }
  const small = await encode(src, THUMB_SIDE, 75)
  return {
    blob: main.data,
    thumb: small.data,
    w: main.info.width,
    h: main.info.height,
    original: input.length,
    viaSips,
  }
}
