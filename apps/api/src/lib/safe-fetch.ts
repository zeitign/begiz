import { lookup, type LookupAddress } from 'node:dns'
import { isIP, type LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { Agent, fetch } from 'undici'

// SSRF protection: the server opens URLs typed by the user, so it must not be able
// to reach internal addresses (localhost, private networks, cloud metadata…).

const MAX_REDIRECTS = 5
const TIMEOUT_MS = 8000
const USER_AGENT = 'Mozilla/5.0 (compatible; WebsArchive/1.0; +preview)'

export class BlockedAddressError extends Error {}

function isPublicAddress(ip: string) {
  // process() turns ::ffff:127.0.0.1 into 127.0.0.1 before classifying it.
  return ipaddr.process(ip).range() === 'unicast'
}

// The IP is checked when connecting (not before), so a DNS answer that changes
// between the check and the connection cannot slip through.
const publicOnlyLookup = ((hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0)
    const blockedAddress = addresses.find((resolved) => !isPublicAddress(resolved.address))
    if (blockedAddress || addresses.length === 0) {
      return callback(new BlockedAddressError(`Address not allowed: ${hostname}`), '', 0)
    }
    if (options.all) return (callback as (error: null, addresses: LookupAddress[]) => void)(null, addresses)
    const firstAddress = addresses[0]!
    callback(null, firstAddress.address, firstAddress.family)
  })
}) as LookupFunction

const publicOnlyAgent = new Agent({ connect: { lookup: publicOnlyLookup } })

function assertAllowedUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedAddressError(`Protocol not allowed: ${url.protocol}`)
  }
  // Literal IPs skip the DNS lookup, so they are checked here.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !isPublicAddress(host)) {
    throw new BlockedAddressError(`Address not allowed: ${host}`)
  }
}

async function readWithSizeLimit(body: AsyncIterable<Uint8Array> | null, maxBytes: number) {
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  if (body) {
    for await (const chunk of body) {
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) throw new Error(`Response too large (> ${maxBytes} bytes)`)
      chunks.push(chunk)
    }
  }
  return Buffer.concat(chunks)
}

export async function safeFetch(input: string, { maxBytes, accept }: { maxBytes: number; accept: string }) {
  let url = new URL(input)
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    assertAllowedUrl(url)
    const response = await fetch(url, {
      dispatcher: publicOnlyAgent,
      redirect: 'manual',
      signal,
      headers: { 'user-agent': USER_AGENT, accept },
    })

    const redirectLocation = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && redirectLocation) {
      await response.body?.cancel()
      url = new URL(redirectLocation, url)
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`HTTP ${response.status} while downloading ${url}`)
    }

    return {
      url,
      contentType: response.headers.get('content-type') ?? '',
      body: await readWithSizeLimit(response.body, maxBytes),
    }
  }
  throw new Error('Too many redirects')
}
