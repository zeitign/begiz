import type { AppType } from '@webs/api'
import { hc, type ClientResponse, type InferResponseType } from 'hono/client'
import { showAppError } from './appError'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// What a proxy in front of the API (Vite in development, the host in production) answers when it is down.
const API_UNREACHABLE_STATUSES = new Set([502, 503, 504])

function serverUnreachable(): never {
  showAppError('server')
  throw new ApiError(0, 'Could not connect to the server')
}

const fetchWithSession: typeof fetch = async (input, init) => {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)

  let response: Response
  try {
    response = await fetch(input, { ...init, headers })
  } catch (error) {
    // fetch only throws when the request never reached the API (or was cancelled on purpose).
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    serverUnreachable()
  }
  if (API_UNREACHABLE_STATUSES.has(response.status)) serverUnreachable()
  // The API rejected the session (expired or revoked): drop it so the app goes back to sign in.
  if (response.status === 401) await supabase.auth.signOut({ scope: 'local' })
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(response.status, errorBody?.message ?? `Error ${response.status}`)
  }
  return response
}

export const api = hc<AppType>(`${import.meta.env.VITE_API_URL ?? ''}/api`, { fetch: fetchWithSession })

type SuccessBody<Response> =
  Response extends ClientResponse<infer Body, infer Status, string>
    ? Status extends 200 | 201
      ? Body
      : Status extends 204
        ? undefined
        : never
    : never

/** Awaits an API request and returns its typed body. Errors are already thrown by fetchWithSession. */
export async function responseBody<Response extends ClientResponse<unknown, number, string>>(
  request: Promise<Response>,
): Promise<SuccessBody<Response>> {
  const response = await request
  if (response.status === 204) return undefined as SuccessBody<Response>
  return (await response.json()) as SuccessBody<Response>
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export type WebCard = InferResponseType<typeof api.webs.$get, 200>[number]
export type WebDetail = InferResponseType<(typeof api.webs)[':id']['$get'], 200>
export type Collection = InferResponseType<typeof api.collections.$get, 200>[number]
export type Tag = InferResponseType<typeof api.tags.$get, 200>[number]
