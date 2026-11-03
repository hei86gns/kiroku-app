import { useEffect, useState } from 'react'
import { useImageUrl } from '../lib/imageUrl'
import type { ImageRef } from '../lib/types'

/** Full-screen picture viewer. Tap the background to close; arrows / swipe to move between pictures. */
export default function Lightbox({ images, start, onClose }: { images: ImageRef[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [touchX, setTouchX] = useState<number | null>(null)
  const n = images.length
  const go = (d: number) => setI((x) => (x + d + n) % n)
  const url = useImageUrl(images[i]?.path)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n)
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [n, onClose])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-label="拡大画像"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null || n < 2) return
        const dx = e.changedTouches[0].clientX - touchX
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        setTouchX(null)
      }}
    >
      {url && <img src={url} alt="拡大画像" crossOrigin="anonymous" />}
      {n > 1 && <>
        <button type="button" className="nav l" onClick={() => go(-1)} aria-label="前の画像">‹</button>
        <button type="button" className="nav r" onClick={() => go(1)} aria-label="次の画像">›</button>
      </>}
      <div className="cap">{i + 1} / {n} · 背景をタップで閉じる</div>
    </div>
  )
}
