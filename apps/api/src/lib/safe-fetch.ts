import { lookup, type LookupAddress } from 'node:dns'
import { isIP, type LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { Agent, fetch } from 'undici'

// Protección SSRF: el servidor abre URLs que escribe la usuaria, así que no debe
// poder alcanzar direcciones internas (localhost, red privada, metadatos del cloud…).

const MAX_REDIRECTS = 5
const TIMEOUT_MS = 8000
const USER_AGENT = 'Mozilla/5.0 (compatible; WebsArchive/1.0; +preview)'

export class BlockedAddressError extends Error {}

function isPublicAddress(ip: string) {
  // process() convierte ::ffff:127.0.0.1 en 127.0.0.1 antes de clasificar.
  return ipaddr.process(ip).range() === 'unicast'
}

// Se comprueba la IP en el momento de conectar (no antes), para que un DNS que
// cambie de respuesta entre la comprobación y la conexión no pueda colarse.
const guardedLookup = ((hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, '', 0)
    const blocked = addresses.find((a) => !isPublicAddress(a.address))
    if (blocked || addresses.length === 0) {
      return callback(new BlockedAddressError(`Dirección no permitida: ${hostname}`), '', 0)
    }
    if (options.all) return (callback as (e: null, a: LookupAddress[]) => void)(null, addresses)
    const first = addresses[0]!
    callback(null, first.address, first.family)
  })
}) as LookupFunction

const agent = new Agent({ connect: { lookup: guardedLookup } })

function assertAllowedUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedAddressError(`Protocolo no permitido: ${url.protocol}`)
  }
  // Las IPs escritas tal cual no pasan por el lookup, así que se comprueban aquí.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !isPublicAddress(host)) {
    throw new BlockedAddressError(`Dirección no permitida: ${host}`)
  }
}

async function readLimited(body: AsyncIterable<Uint8Array> | null, maxBytes: number) {
  const chunks: Uint8Array[] = []
  let size = 0
  if (body) {
    for await (const chunk of body) {
      size += chunk.byteLength
      if (size > maxBytes) throw new Error(`Respuesta demasiado grande (> ${maxBytes} bytes)`)
      chunks.push(chunk)
    }
  }
  return Buffer.concat(chunks)
}

export async function safeFetch(input: string, { maxBytes, accept }: { maxBytes: number; accept: string }) {
  let url = new URL(input)
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(url)
    const res = await fetch(url, {
      dispatcher: agent,
      redirect: 'manual',
      signal,
      headers: { 'user-agent': USER_AGENT, accept },
    })

    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel()
      url = new URL(location, url)
      continue
    }
    if (!res.ok) {
      await res.body?.cancel()
      throw new Error(`HTTP ${res.status} al descargar ${url}`)
    }

    return {
      url,
      contentType: res.headers.get('content-type') ?? '',
      body: await readLimited(res.body, maxBytes),
    }
  }
  throw new Error('Demasiadas redirecciones')
}
