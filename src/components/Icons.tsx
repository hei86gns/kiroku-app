import type { ReactNode } from 'react'

const S = ({ size = 20, w = 2.2, children }: { size?: number; w?: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} aria-hidden="true">
    {children}
  </svg>
)

export const IcGrid = () => <S size={16}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></S>
export const IcList = () => <S size={16}><rect x="3" y="4" width="5" height="5" rx="1.5" /><rect x="3" y="15" width="5" height="5" rx="1.5" /><path d="M11 6.5h10M11 17.5h10" /></S>
export const IcTable = () => <S size={16}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 10h18M3 15h18M9 4v16" /></S>
export const IcSearch = () => <S><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>
export const IcHome = () => <S><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /></S>
export const IcGear = () => <S><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></S>
export const IcPlus = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
export const IcBack = () => <S><path d="m15 18-6-6 6-6" /></S>
export const IcCam = () => <S size={22} w={2}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></S>
export const IcClip = () => <S size={20} w={2}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5M9 11h6M9 15h4" /></S>
export const IcSun = () => <S size={16}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>
export const IcMoon = () => <S size={16}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></S>

const COLLECTION_ICONS: Record<string, ReactNode> = {
  recipe: <><path d="M3 12h18a9 9 0 0 1-18 0Z" /><path d="M8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" /></>,
  goods: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  books: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21a2 2 0 0 1 2-2h13v2z" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  place: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8C10 4 6.5 4.5 7 7c.3 1 2 1 5 1Zm0 0c2-4 5.5-3.5 5-1-.3 1-2 1-5 1Z" /></>,
}

export const CollectionIcon = ({ name, size = 26 }: { name: string; size?: number }) => (
  <S size={size} w={1.9}>{COLLECTION_ICONS[name] ?? COLLECTION_ICONS.note}</S>
)
