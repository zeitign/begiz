import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.ts'
import * as schema from './schema.ts'

// prepare: false keeps it compatible with Supabase's pooler in transaction mode.
const postgresClient = postgres(env.DATABASE_URL, { prepare: false })

export const db = drizzle(postgresClient, { schema })

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
