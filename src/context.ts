import { createContext, useContext } from 'react'
import type { Kiroku } from './lib/store'
import type { Tab } from './lib/types'

export interface AppCtx extends Kiroku {
  userId: string
  theme: 'light' | 'dark'
  toggleTheme: () => void
  toast: (msg: string) => void
  /** Collection shown on the list screen (and preselected when adding). */
  currentId: string
  setCurrentId: (id: string) => void
  openRecord: (id: string, opts?: { editing?: boolean; justSaved?: boolean }) => void
  goTab: (tab: Tab) => void
  openCapture: () => void
  logout: () => void
}

export const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}
