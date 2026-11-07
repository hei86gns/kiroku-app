// 記録アプリの本人としてログインする（メールとパスワードはどこにも保存しない）

import { createInterface } from 'node:readline/promises'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) {
    // 入力した文字を画面に出さない
    const out = rl as unknown as { _writeToOutput: (s: string) => void }
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(question)
    }
  }
  const answer = await rl.question(question)
  rl.close()
  if (hidden) process.stdout.write('\n')
  return answer.trim()
}

export async function login(supabase: SupabaseClient) {
  const email = await ask('記録アプリのメールアドレス：')
  const password = await ask('パスワード（入力しても表示されません）：', true)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(`ログインできませんでした：${error?.message}`)
  console.log('ログインしました')
  return { userId: data.user.id, ask }
}
