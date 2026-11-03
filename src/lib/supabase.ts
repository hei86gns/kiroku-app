import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase の接続情報がありません。.env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Several apps (Kakeibo, tangocho, HealthDashboard, …) share this Supabase
    // project and are all hosted under the same GitHub Pages origin
    // (hei86gns.github.io), so localStorage is shared between them by
    // default. Without a unique key here, logging into one app can
    // silently overwrite another's session in the same browser.
    storageKey: 'sb-kiroku-auth-token',
  },
})
