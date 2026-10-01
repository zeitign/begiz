import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

type FakeResponse = { contentType: string; body: Buffer }

/** Pages and images the API can "download" in tests. Any other URL behaves as unreachable. */
export const fakeInternet = new Map<string, FakeResponse>()

/** Drop-in replacement for safeFetch, so tests never depend on real websites. */
export async function fakeSafeFetch(input: string) {
  const response = fakeInternet.get(input)
  if (!response) throw new Error(`Unreachable in tests: ${input}`)
  return { url: new URL(input), ...response }
}

export function publishHtmlPage(url: string, headHtml: string) {
  fakeInternet.set(url, {
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(`<!doctype html><html><head>${headHtml}</head><body></body></html>`),
  })
}

export async function publishImage(url: string, width = 1200, height = 630) {
  fakeInternet.set(url, { contentType: 'image/png', body: await createPngImage(width, height) })
}

export function createPngImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#3355ff' } })
    .png()
    .toBuffer()
}

/** Turns a public file URL ("/files/<key>") into its path in the test storage folder. */
export function storedFilePath(fileUrl: string) {
  return join(process.env.LOCAL_STORAGE_DIR!, fileUrl.replace(/^\/files\//, ''))
}

export const isStored = (fileUrl: string) => existsSync(storedFilePath(fileUrl))
