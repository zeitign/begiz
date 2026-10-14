import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// A fake S3 endpoint that records what the storage driver sends to it.
const receivedRequests: IncomingMessage[] = []
const fakeS3 = createServer((request, response) => {
  receivedRequests.push(request)
  request.resume().on('end', () => {
    response.statusCode = request.method === 'DELETE' ? 204 : 200
    response.end()
  })
})

async function loadS3Storage() {
  const { port } = fakeS3.address() as AddressInfo
  vi.stubEnv('STORAGE_DRIVER', 's3')
  vi.stubEnv('S3_ENDPOINT', `http://localhost:${port}`)
  vi.stubEnv('S3_REGION', 'eu-west-1')
  vi.stubEnv('S3_BUCKET', 'begiz-images')
  vi.stubEnv('S3_ACCESS_KEY_ID', 'test-access-key')
  vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test-secret-key')
  vi.resetModules()
  return (await import('../src/storage/index.ts')).storage
}

beforeAll(() => new Promise<void>((resolve) => fakeS3.listen(0, '127.0.0.1', resolve)))
afterAll(() => {
  vi.unstubAllEnvs()
  fakeS3.close()
})

describe('S3 storage', () => {
  // Supabase Storage only accepts the bucket in the path, not as a subdomain.
  it('uploads to /<bucket>/<key> with the content type and an immutable cache', async () => {
    const storage = await loadS3Storage()

    await storage.put('previews/web-1.webp', Buffer.from('image bytes'), 'image/webp')

    const upload = receivedRequests.at(-1)!
    expect(upload.method).toBe('PUT')
    expect(upload.url).toMatch(/^\/begiz-images\/previews\/web-1\.webp(\?|$)/)
    expect(upload.headers.host).toMatch(/^localhost:/)
    expect(upload.headers['content-type']).toBe('image/webp')
    expect(upload.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('deletes from /<bucket>/<key>', async () => {
    const storage = await loadS3Storage()

    await storage.delete('previews/web-1.webp')

    const deletion = receivedRequests.at(-1)!
    expect(deletion.method).toBe('DELETE')
    expect(deletion.url).toMatch(/^\/begiz-images\/previews\/web-1\.webp(\?|$)/)
  })
})
