import { mkdirSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../env.ts'

/** Dónde viven las imágenes: disco local en desarrollo, R2 (o cualquier S3) en producción. */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  delete(key: string): Promise<void>
}

export const localStorageRoot = resolve(env.LOCAL_STORAGE_DIR)

function createLocalStorage(): Storage {
  mkdirSync(localStorageRoot, { recursive: true })
  return {
    async put(key, body) {
      const path = join(localStorageRoot, key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, body)
    },
    async delete(key) {
      await rm(join(localStorageRoot, key), { force: true })
    },
  }
}

function createS3Storage(): Storage {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('STORAGE_DRIVER=s3 requiere S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY')
  }
  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  })
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Las claves llevan un uuid nuevo en cada subida, así que nunca cambian de contenido.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    },
  }
}

export const storage = env.STORAGE_DRIVER === 's3' ? createS3Storage() : createLocalStorage()

export function fileUrl(key: string | null) {
  return key ? `${env.FILES_PUBLIC_URL}/${key}` : null
}

/** Borrado sin romper la petición si falla: una imagen huérfana no es grave. */
export async function deleteQuietly(...keys: (string | null)[]) {
  for (const key of keys) {
    if (!key) continue
    await storage.delete(key).catch((err) => console.warn(`No se pudo borrar ${key}`, err))
  }
}
