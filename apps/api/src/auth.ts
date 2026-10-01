import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { env } from './env.ts'

export type AuthEnv = { Variables: { userId: string } }

const issuer = `${env.SUPABASE_URL}/auth/v1`
const supabaseSigningKeys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
const legacyJwtSecret = env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  : null

async function verifySessionToken(token: string): Promise<JWTPayload> {
  const options = { issuer, audience: 'authenticated' }
  const { payload } = legacyJwtSecret
    ? await jwtVerify(token, legacyJwtSecret, { ...options, algorithms: ['HS256'] })
    : await jwtVerify(token, supabaseSigningKeys, options)
  return payload
}

/** Validates the Supabase JWT sent by the front and exposes the user id as context.var.userId. */
export const requireAuth = createMiddleware<AuthEnv>(async (context, next) => {
  const authorizationHeader = context.req.header('Authorization')
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : undefined
  if (!token) throw new HTTPException(401, { message: 'Not signed in' })

  let payload: JWTPayload
  try {
    payload = await verifySessionToken(token)
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired session' })
  }
  if (!payload.sub) throw new HTTPException(401, { message: 'Invalid session' })

  context.set('userId', payload.sub)
  await next()
})
