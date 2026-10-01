import type { AppType } from '@webs/api'
import { hc, type ClientResponse, type InferResponseType } from 'hono/client'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const fetchWithSession: typeof fetch = async (input, init) => {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)

  const response = await fetch(input, { ...init, headers })
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
