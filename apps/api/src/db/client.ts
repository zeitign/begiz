import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.ts'
import * as schema from './schema.ts'

// prepare: false → compatible con el pooler de Supabase en modo transacción.
const client = postgres(env.DATABASE_URL, { prepare: false })

export const db = drizzle(client, { schema })

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
