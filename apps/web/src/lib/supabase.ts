import { createClient, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { ref } from 'vue'
import { showAppError } from './appError'

// Supabase is only used to sign in. Data always comes from our API.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const session = ref<Session | null>(null)

// getSession refreshes an expired token over the network, which can hang if Supabase never answers.
const AUTH_STARTUP_TIMEOUT_MS = 10_000

function rejectAfterTimeout(milliseconds: number) {
  return new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error('Auth startup timed out')), milliseconds),
  )
}

/**
 * Never throws: if Supabase cannot be reached, the app shows the sign-in error page.
 * Any other error (e.g. a revoked refresh token) just means there is no session: the user signs in.
 */
async function initAuth() {
  try {
    const { data, error } = await Promise.race([
      supabase.auth.getSession(),
      rejectAfterTimeout(AUTH_STARTUP_TIMEOUT_MS),
    ])
    if (error && isAuthRetryableFetchError(error)) throw error
    session.value = data.session
  } catch {
    showAppError('sign-in')
    return
  }
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
  })
}

export const isAuthReady = ref(false)

/** Settles once the saved session, or its absence, is known. The router waits for it. */
export const authReady = initAuth().finally(() => {
  isAuthReady.value = true
})
