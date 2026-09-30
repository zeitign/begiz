import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url().transform((url) => url.replace(/\/$/, '')),
  /** Solo para proyectos de Supabase con claves JWT antiguas (HS256). Los nuevos usan JWKS. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  /** Origen del front en producción (p. ej. https://webs.pages.dev). En local no hace falta. */
  CORS_ORIGIN: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('.data/uploads'),
  /** URL base desde la que el navegador descarga las imágenes. */
  FILES_PUBLIC_URL: z
    .string()
    .default('/files')
    .transform((url) => url.replace(/\/$/, '')),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
})

export const env = schema.parse(process.env)
