import type { ImageRef } from './types'

export interface Resized {
  blob: Blob
  thumb: Blob
  w: number
  h: number
  /** Human-readable before → after size, shown under the preview. */
  info: string
}

const THUMB_SIDE = 480

const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB')

function draw(bmp: ImageBitmap, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  return { cv, w, h }
}

const toJpeg = (cv: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  )

/**
 * Shrinks a picture on the device before it is saved.
 * `imageOrientation: 'from-image'` applies the EXIF rotation so portrait photos stay upright.
 */
export async function resizeImage(file: Blob, maxSide: number): Promise<Resized> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const main = draw(bmp, maxSide)
    const blob = await toJpeg(main.cv, 0.8)
    const small = draw(bmp, THUMB_SIDE)
    const thumb = await toJpeg(small.cv, 0.75)
    return {
      blob,
      thumb,
      w: main.w,
      h: main.h,
      info: `${bmp.width}×${bmp.height} ${kb(file.size)} → ${main.w}×${main.h} ${kb(blob.size)}`,
    }
  } finally {
    bmp.close()
  }
}

export interface PreparedImage {
  ref: ImageRef
  blob: Blob
  thumbBlob: Blob
  info: string
}

/** Resizes picked files and gives each its Storage path: {user}/{collection}/{record}/{uuid}.jpg */
export async function prepareImages(
  files: Iterable<File>, maxSide: number, folder: string,
): Promise<{ images: PreparedImage[]; failed: number }> {
  const images: PreparedImage[] = []
  let failed = 0
  for (const file of files) {
    try {
      const r = await resizeImage(file, maxSide)
      const id = crypto.randomUUID()
      images.push({
        ref: { path: `${folder}/${id}.jpg`, thumb: `${folder}/${id}.thumb.jpg`, w: r.w, h: r.h },
        blob: r.blob,
        thumbBlob: r.thumb,
        info: r.info,
      })
    } catch (err) {
      console.error(err)
      failed++
    }
  }
  return { images, failed }
}

export const toNewImages = (images: PreparedImage[]) =>
  images.map((i) => ({ path: i.ref.path, thumb: i.ref.thumb, blob: i.blob, thumbBlob: i.thumbBlob }))
