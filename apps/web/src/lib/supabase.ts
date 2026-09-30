import { createClient, type Session } from '@supabase/supabase-js'
import { ref } from 'vue'

// Supabase solo se usa para el login. Los datos se piden siempre a nuestra API.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const session = ref<Session | null>(null)

export async function initAuth() {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
  })
}
