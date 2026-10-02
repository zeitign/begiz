import { randomUUID } from 'node:crypto'
import { SignJWT } from 'jose'
import { app } from '../src/app.ts'

/** Signs a token the same way Supabase does, so requests go through the real auth middleware. */
export async function signSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(`${process.env.SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET))
}

/** API client logged in as a brand-new user, so every test starts with an empty account. */
export async function createUserClient() {
  const userId = randomUUID()
  const authorization = `Bearer ${await signSessionToken(userId)}`

  const sendJson = (method: string, path: string, body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { authorization, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  return {
    userId,
    get: (path: string) => sendJson('GET', path),
    post: (path: string, body: unknown) => sendJson('POST', path, body),
    patch: (path: string, body: unknown) => sendJson('PATCH', path, body),
    put: (path: string, body: unknown) => sendJson('PUT', path, body),
    delete: (path: string) => sendJson('DELETE', path),
    uploadImage: (path: string, image: Blob) => {
      const form = new FormData()
      form.append('image', image, 'upload')
      return app.request(`/api${path}`, { method: 'PUT', headers: { authorization }, body: form })
    },
  }
}

export type UserClient = Awaited<ReturnType<typeof createUserClient>>
