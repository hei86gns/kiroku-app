import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { clearAll } from './lib/local'
import { useKiroku } from './lib/store'
import type { Tab } from './lib/types'
import { Ctx, type AppCtx } from './context'
import Login from './pages/Login'
import CollectionView from './pages/CollectionView'
import RecordDetail from './pages/RecordDetail'
import Search from './pages/Search'
import Settings from './pages/Settings'
import CaptureSheet from './components/CaptureSheet'
import { IcGear, IcHome, IcPlus, IcSearch } from './components/Icons'

type Theme = 'light' | 'dark'

const loadTheme = (): Theme => {
  try { return localStorage.getItem('kiroku-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export default function App() {
  const [user, setUser]           = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  // Auth listener — only tracks who's logged in; data is loaded inside <Main>
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="centered">読み込み中…</div>
  if (!user) return <Login />
  return <Main key={user.id} userId={user.id} />
}

function NavBtn({ t, icon, label, current, onGo }: { t: Tab; icon: React.ReactNode; label: string; current: Tab; onGo: (t: Tab) => void }) {
  return (
    <button type="button" className={current === t ? 'on' : ''} onClick={() => onGo(t)} aria-label={label}>
      {icon}<span className="lb">{label}</span>
    </button>
  )
}

interface Detail { id: string; editing: boolean; justSaved: boolean }

function Main({ userId }: { userId: string }) {
  const kiroku = useKiroku(userId)
  const { collections, loaded, pending } = kiroku
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [tab, setTab] = useState<Tab>('list')
  const [prevTab, setPrevTab] = useState<Tab>('list')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [currentId, setCurrentIdState] = useState<string>(() => {
    try { return localStorage.getItem('kiroku-collection') ?? '' } catch { return '' }
  })
  const [capture, setCapture] = useState<{ ask: boolean } | null>(null)
  const [message, setMessage] = useState('')

  const current = collections.find((c) => c.id === currentId) ?? collections[0]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('kiroku-theme', theme) } catch { /* private mode */ }
  }, [theme])

  // Auto-dismiss toast
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 2400)
    return () => clearTimeout(t)
  }, [message])

  // The whole screen takes the color of the collection being looked at
  const detailCol = detail ? collections.find((c) => c.id === kiroku.records.find((r) => r.id === detail.id)?.collection_id) : undefined
  const tint = tab === 'detail' ? detailCol?.theme : tab === 'search' ? 'all' : current?.theme
  useEffect(() => { document.body.dataset.c = tint ?? 'all' }, [tint])

  const setCurrentId = (id: string) => {
    setCurrentIdState(id)
    try { localStorage.setItem('kiroku-collection', id) } catch { /* private mode */ }
  }

  const goTab = (t: Tab) => {
    setTab(t)
    setDetail(null)
    window.scrollTo(0, 0)
  }

  const ctx: AppCtx = {
    ...kiroku,
    userId,
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    toast: setMessage,
    currentId: current?.id ?? '',
    setCurrentId,
    openRecord: (id, opts) => {
      if (tab !== 'detail') setPrevTab(tab)
      setDetail({ id, editing: !!opts?.editing, justSaved: !!opts?.justSaved })
      setTab('detail')
      window.scrollTo(0, 0)
    },
    goTab,
    // From the list or settings the collection is already chosen; elsewhere ask first
    openCapture: () => setCapture({ ask: tab === 'search' }),
    logout: async () => {
      const warn = pending.size ? `\n未送信の変更が ${pending.size}件あります。ログアウトすると失われます。` : ''
      if (!window.confirm(`ログアウトしますか？${warn}`)) return
      await clearAll()
      await supabase.auth.signOut()
    },
  }

  if (!loaded) return <div className="centered">読み込み中…</div>

  const navTab = tab === 'detail' ? prevTab : tab
  const navProps = { current: navTab, onGo: goTab }

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        {tab === 'detail' && detail ? (
          <RecordDetail
            key={detail.id}
            recordId={detail.id}
            startEditing={detail.editing}
            justSaved={detail.justSaved}
            onBack={() => goTab(prevTab)}
          />
        ) : tab === 'search' ? <Search />
          : tab === 'settings' ? <Settings />
          : <CollectionView />}
      </div>
      <nav className="tabs">
        <div className="in2">
          <NavBtn {...navProps} t="list" icon={<IcHome />} label="一覧" />
          <NavBtn {...navProps} t="search" icon={<IcSearch />} label="検索" />
          <button type="button" className="plus" onClick={ctx.openCapture} aria-label="登録"><span><IcPlus /></span></button>
          <NavBtn {...navProps} t="settings" icon={<IcGear />} label="設定" />
        </div>
      </nav>
      {capture && <CaptureSheet askCollection={capture.ask} onClose={() => setCapture(null)} />}
      {message && <div className="toast" role="status" onClick={() => setMessage('')}>{message}</div>}
    </Ctx.Provider>
  )
}
