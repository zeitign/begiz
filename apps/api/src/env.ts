import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url().transform((url) => url.replace(/\/$/, '')),
  /** Only for Supabase projects still on legacy JWT keys (HS256). New projects use JWKS. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  /** Front origin in production (e.g. https://webs.pages.dev). Not needed locally. */
  CORS_ORIGIN: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('.data/uploads'),
  /** Base URL the browser downloads images from. */
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

export const env = envSchema.parse(process.env)
