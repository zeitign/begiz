import { HTTPException } from 'hono/http-exception'
import { parse } from 'node-html-parser'
import sharp from 'sharp'
import { safeFetch } from './safe-fetch.ts'

const MAX_HTML_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const THUMBNAIL_WIDTH = 800
/** Full-page screenshots are cropped to their top part in the thumbnail. */
const THUMBNAIL_MAX_HEIGHT = 1200

export type PageMeta = {
  siteTitle: string | null
  faviconUrl: string | null
  imageUrl: string | null
}

/** Reads the title, favicon and og:image of a page. */
export async function fetchPageMeta(pageUrl: string): Promise<PageMeta> {
  const { url, contentType, body } = await safeFetch(pageUrl, {
    maxBytes: MAX_HTML_BYTES,
    accept: 'text/html,application/xhtml+xml',
  })
  if (!contentType.includes('html')) return { siteTitle: null, faviconUrl: null, imageUrl: null }

  const document = parse(body.toString('utf8'))
  const readMetaContent = (selector: string) =>
    document.querySelector(selector)?.getAttribute('content')?.trim() || undefined
  const toAbsoluteHttpUrl = (href: string | undefined) => {
    if (!href) return null
    try {
      const resolvedUrl = new URL(href, url)
      return resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:' ? resolvedUrl.href : null
    } catch {
      return null
    }
  }

  const iconHref = document
    .querySelectorAll('link[rel]')
    .find((link) => link.getAttribute('rel')?.toLowerCase().split(/\s+/).includes('icon'))
    ?.getAttribute('href')

  return {
    siteTitle:
      readMetaContent('meta[property="og:title"]') ?? (document.querySelector('title')?.text.trim() || null),
    faviconUrl: toAbsoluteHttpUrl(iconHref ?? '/favicon.ico'),
    imageUrl: toAbsoluteHttpUrl(
      readMetaContent('meta[property="og:image"]') ??
        readMetaContent('meta[property="og:image:url"]') ??
        readMetaContent('meta[name="twitter:image"]') ??
        readMetaContent('meta[property="twitter:image"]'),
    ),
  }
}

export async function downloadImage(imageUrl: string) {
  const { body } = await safeFetch(imageUrl, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*' })
  return body
}

/** 800px wide WebP thumbnail, cropped from the top when the image is very tall. */
export async function createThumbnail(image: Buffer) {
  const { data: resizedImage, info: resizedSize } = await sharp(image)
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })

  const thumbnail = sharp(resizedImage)
  if (resizedSize.height > THUMBNAIL_MAX_HEIGHT) {
    thumbnail.extract({ left: 0, top: 0, width: resizedSize.width, height: THUMBNAIL_MAX_HEIGHT })
  }
  return thumbnail.webp({ quality: 80 }).toBuffer()
}

const UPLOAD_FORMATS: Record<string, { extension: string; mimeType: string }> = {
  png: { extension: 'png', mimeType: 'image/png' },
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  webp: { extension: 'webp', mimeType: 'image/webp' },
  gif: { extension: 'gif', mimeType: 'image/gif' },
  avif: { extension: 'avif', mimeType: 'image/avif' },
}

/** Validates an uploaded image and returns its real format (not the one the browser claims). */
export async function detectUploadFormat(image: Buffer) {
  let detectedFormat: string | undefined
  try {
    detectedFormat = (await sharp(image).metadata()).format
  } catch {
    // Unreadable as an image: rejected below.
  }
  const uploadFormat = detectedFormat ? UPLOAD_FORMATS[detectedFormat] : undefined
  if (!uploadFormat) {
    throw new HTTPException(400, { message: 'The file is not a valid image (PNG, JPG, WebP, GIF or AVIF)' })
  }
  return uploadFormat
}
