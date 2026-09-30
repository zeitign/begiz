import { HTTPException } from 'hono/http-exception'
import { parse } from 'node-html-parser'
import sharp from 'sharp'
import { safeFetch } from './safe-fetch.ts'

const MAX_HTML_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const THUMB_WIDTH = 800
/** Las capturas de página completa se recortan por arriba para la miniatura. */
const THUMB_MAX_HEIGHT = 1200

export type PageMeta = {
  siteTitle: string | null
  faviconUrl: string | null
  imageUrl: string | null
}

/** Lee título, favicon y og:image de una página. */
export async function fetchPageMeta(pageUrl: string): Promise<PageMeta> {
  const { url, contentType, body } = await safeFetch(pageUrl, {
    maxBytes: MAX_HTML_BYTES,
    accept: 'text/html,application/xhtml+xml',
  })
  if (!contentType.includes('html')) return { siteTitle: null, faviconUrl: null, imageUrl: null }

  const root = parse(body.toString('utf8'))
  const meta = (selector: string) =>
    root.querySelector(selector)?.getAttribute('content')?.trim() || undefined
  const absolute = (href: string | undefined) => {
    if (!href) return null
    try {
      const resolved = new URL(href, url)
      return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null
    } catch {
      return null
    }
  }

  const iconHref = root
    .querySelectorAll('link[rel]')
    .find((link) => link.getAttribute('rel')?.toLowerCase().split(/\s+/).includes('icon'))
    ?.getAttribute('href')

  return {
    siteTitle:
      meta('meta[property="og:title"]') ?? (root.querySelector('title')?.text.trim() || null),
    faviconUrl: absolute(iconHref ?? '/favicon.ico'),
    imageUrl: absolute(
      meta('meta[property="og:image"]') ??
        meta('meta[property="og:image:url"]') ??
        meta('meta[name="twitter:image"]') ??
        meta('meta[property="twitter:image"]'),
    ),
  }
}

export async function downloadImage(imageUrl: string) {
  const { body } = await safeFetch(imageUrl, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*' })
  return body
}

/** Miniatura WebP de 800 px de ancho, recortada por arriba si es muy alta. */
export async function makeThumb(input: Buffer) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })

  const image = sharp(data)
  if (info.height > THUMB_MAX_HEIGHT) {
    image.extract({ left: 0, top: 0, width: info.width, height: THUMB_MAX_HEIGHT })
  }
  return image.webp({ quality: 80 }).toBuffer()
}

const UPLOAD_FORMATS: Record<string, { ext: string; type: string }> = {
  png: { ext: 'png', type: 'image/png' },
  jpeg: { ext: 'jpg', type: 'image/jpeg' },
  webp: { ext: 'webp', type: 'image/webp' },
  gif: { ext: 'gif', type: 'image/gif' },
  avif: { ext: 'avif', type: 'image/avif' },
}

/** Valida una imagen subida a mano y devuelve su formato real (no el que dice el navegador). */
export async function inspectUpload(input: Buffer) {
  let format: string | undefined
  try {
    format = (await sharp(input).metadata()).format
  } catch {
    // no es una imagen legible
  }
  const known = format ? UPLOAD_FORMATS[format] : undefined
  if (!known) {
    throw new HTTPException(400, { message: 'El archivo no es una imagen válida (PNG, JPG, WebP, GIF o AVIF)' })
  }
  return known
}
