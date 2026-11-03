import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError('メールアドレスまたはパスワードが正しくありません。')
  }

  const handleResetPassword = async () => {
    if (!email) { setError('メールアドレスを入力してからリセットしてください。'); return }
    setLoading(true)
    const redirectTo = `${window.location.origin}/kiroku-app/`
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    setResetSent(true)
  }

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && email && password) void handleLogin() }

  return (
    <div className="login">
      <div className="card2">
        <span className="brand">KIROKU <b>/ LOGIN</b></span>
        <h1>記録<span>.</span></h1>
        {resetSent ? (
          <p className="banner" style={{ margin: 0 }}>パスワードリセットのメールを送信しました。メールを確認してください。</p>
        ) : (
          <>
            <div>
              <label className="lbl" htmlFor="email">メールアドレス</label>
              <input id="email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" autoComplete="email" onKeyDown={onEnter} />
            </div>
            <div>
              <label className="lbl" htmlFor="password">パスワード</label>
              <input id="password" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード" autoComplete="current-password" onKeyDown={onEnter} />
            </div>
            {error && <p className="err">{error}</p>}
            <button type="button" className="btn" onClick={handleLogin} disabled={loading || !email || !password}>
              {loading ? 'ログイン中…' : 'ログイン'}
            </button>
            <button type="button" className="linkbtn" onClick={handleResetPassword} disabled={loading}>
              パスワードを忘れた場合はこちら
            </button>
          </>
        )}
      </div>
    </div>
  )
}
