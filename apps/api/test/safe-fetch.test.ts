import { describe, expect, it, vi } from 'vitest'

const { safeFetch, BlockedAddressError } =
  await vi.importActual<typeof import('../src/lib/safe-fetch.ts')>('../src/lib/safe-fetch.ts')

/** undici wraps errors raised while connecting, so the guard's error can arrive as the cause. */
async function fetchError(url: string) {
  try {
    await safeFetch(url, { maxBytes: 1024, accept: '*/*' })
  } catch (error) {
    return error instanceof BlockedAddressError ? error : (error as Error).cause
  }
  throw new Error(`${url} was not blocked`)
}

describe('SSRF protection', () => {
  it.each([
    'http://127.0.0.1:8787/api/webs',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://0.0.0.0/',
  ])('blocks the private address %s', async (url) => {
    expect(await fetchError(url)).toBeInstanceOf(BlockedAddressError)
  })

  it('blocks host names that resolve to a private address', async () => {
    expect(await fetchError('http://localhost:8787/')).toBeInstanceOf(BlockedAddressError)
  })

  it.each(['file:///etc/passwd', 'ftp://example.com/', 'data:text/html,hello'])(
    'blocks the protocol of %s',
    async (url) => {
      expect(await fetchError(url)).toBeInstanceOf(BlockedAddressError)
    },
  )
})
