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

const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)

  const res = await fetch(input, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(res.status, body?.message ?? `Error ${res.status}`)
  }
  return res
}

export const api = hc<AppType>(`${import.meta.env.VITE_API_URL ?? ''}/api`, { fetch: authedFetch })

type Ok<R> =
  R extends ClientResponse<infer T, infer S, string>
    ? S extends 200 | 201
      ? T
      : S extends 204
        ? undefined
        : never
    : never

/** Espera la respuesta y devuelve el cuerpo ya tipado (los errores los lanza authedFetch). */
export async function call<R extends ClientResponse<unknown, number, string>>(
  request: Promise<R>,
): Promise<Ok<R>> {
  const res = await request
  if (res.status === 204) return undefined as Ok<R>
  return (await res.json()) as Ok<R>
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Algo ha fallado'
}

export type WebCard = InferResponseType<typeof api.webs.$get, 200>[number]
export type WebDetail = InferResponseType<(typeof api.webs)[':id']['$get'], 200>
export type Collection = InferResponseType<typeof api.collections.$get, 200>[number]
export type Tag = InferResponseType<typeof api.tags.$get, 200>[number]
