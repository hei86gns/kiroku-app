import type { ReactNode } from 'react'
import { useApp } from '../context'
import { useImageUrl } from '../lib/imageUrl'
import type { ImageRef } from '../lib/types'
import { IcBack, IcMoon, IcSun } from './Icons'

/** A stored picture. Shows the first letter of `fallback` while loading or when there is none. */
export function Img({ image, thumb, fallback, className, onClick, alt = '' }: {
  image: ImageRef | null
  thumb?: boolean
  fallback?: string
  className?: string
  onClick?: () => void
  alt?: string
}) {
  const url = useImageUrl(image ? (thumb ? image.thumb : image.path) : null)
  if (!url) return <div className={`ph ${className ?? ''}`} onClick={onClick}>{fallback?.slice(0, 1)}</div>
  return <img src={url} alt={alt} className={className} onClick={onClick} crossOrigin="anonymous" loading="lazy" decoding="async" />
}

export const Stars = ({ n, size }: { n: number | null | undefined; size?: number }) => {
  if (!n) return null
  return (
    <span className="stars" style={size ? { fontSize: size } : undefined}>
      {'★'.repeat(n)}<span className="off">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export function TopActions() {
  const { theme, toggleTheme, sync, pending, runSync, toast } = useApp()
  const n = pending.size
  const label =
    sync === 'offline' ? `オフライン${n ? ` · 未送信${n}` : ''}`
    : sync === 'error' ? `送信エラー${n ? ` · 未送信${n}` : ''}`
    : sync === 'sending' || n ? '送信中…'
    : '同期済み'
  const onSync = async () => {
    if (!navigator.onLine) { toast('オフラインです。つながったら自動で送信します'); return }
    const sent = await runSync()
    toast(sent ? `${sent}件を送信しました` : '最新の状態です')
  }
  return (
    <>
      <button type="button" className="themebtn" onClick={toggleTheme}
        aria-label={theme === 'dark' ? '明るい画面にする' : '暗い画面にする'} title={theme === 'dark' ? '明るい画面にする' : '暗い画面にする'}>
        {theme === 'dark' ? <IcSun /> : <IcMoon />}
      </button>
      <button type="button" className={`sync ${sync === 'offline' ? 'off' : sync === 'error' ? 'err' : ''}`} onClick={onSync} title="タップで今すぐ送信">
        <i />{label}
      </button>
    </>
  )
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="top">
      {onBack && <button type="button" className="iconbtn" onClick={onBack} aria-label="戻る"><IcBack /></button>}
      <h1>{title}</h1>
      {right}
      <TopActions />
    </header>
  )
}

export const TopLine = ({ label }: { label: string }) => (
  <div className="topline">
    <span className="brand">KIROKU <b>/ {label}</b></span>
    <TopActions />
  </div>
)

export function CollectionSegs({ extra }: { extra?: ReactNode }) {
  const { collections, records, currentId, setCurrentId } = useApp()
  return (
    <div className="segs">
      {collections.map((c) => (
        <button key={c.id} type="button" className={`seg ${c.id === currentId ? 'on' : ''}`} data-c={c.theme} onClick={() => setCurrentId(c.id)}>
          {c.name}<small>{records.filter((r) => r.collection_id === c.id).length}</small>
        </button>
      ))}
      {extra}
    </div>
  )
}

export const Pend = () => <span className="pend">未送信</span>

