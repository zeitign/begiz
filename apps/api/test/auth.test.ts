import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.ts'
import { createUserClient } from './api-client.ts'

const requestWebsWithHeader = (authorization?: string) =>
  app.request('/api/webs', { headers: authorization ? { authorization } : {} })

describe('authentication', () => {
  it('rejects requests without a session', async () => {
    const response = await requestWebsWithHeader()
    expect(response.status).toBe(401)
  })

  it('rejects malformed tokens', async () => {
    const response = await requestWebsWithHeader('Bearer not-a-jwt')
    expect(response.status).toBe(401)
  })

  it('rejects tokens signed with another secret', async () => {
    const forgedToken = await new SignJWT({ sub: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(`${process.env.SUPABASE_URL}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-different-secret-of-sufficient-length'))

    const response = await requestWebsWithHeader(`Bearer ${forgedToken}`)
    expect(response.status).toBe(401)
  })

  it('accepts a valid Supabase session', async () => {
    const user = await createUserClient()
    const response = await user.get('/webs')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
