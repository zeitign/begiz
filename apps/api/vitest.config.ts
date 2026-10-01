import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The real .env is never loaded: tests must not reach the Supabase project.
    env: {
      DATABASE_URL: 'postgres://unused-in-tests',
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_JWT_SECRET: 'test-jwt-secret-with-enough-length-for-hs256',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: join(tmpdir(), 'begiz-test-uploads'),
      FILES_PUBLIC_URL: '/files',
    },
    setupFiles: ['./test/setup.ts'],
  },
})
