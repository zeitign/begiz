import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { env } from './env.ts'

export type AuthEnv = { Variables: { userId: string } }

const issuer = `${env.SUPABASE_URL}/auth/v1`
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
const legacySecret = env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  : null

async function verify(token: string): Promise<JWTPayload> {
  const options = { issuer, audience: 'authenticated' }
  const { payload } = legacySecret
    ? await jwtVerify(token, legacySecret, { ...options, algorithms: ['HS256'] })
    : await jwtVerify(token, jwks, options)
  return payload
}

/** Valida el JWT de Supabase que envía el front y deja el id de la usuaria en c.var.userId. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) throw new HTTPException(401, { message: 'Falta iniciar sesión' })

  let payload: JWTPayload
  try {
    payload = await verify(token)
  } catch {
    throw new HTTPException(401, { message: 'Sesión no válida o caducada' })
  }
  if (!payload.sub) throw new HTTPException(401, { message: 'Sesión no válida' })

  c.set('userId', payload.sub)
  await next()
})
