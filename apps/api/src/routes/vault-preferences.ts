import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { defaultVaultPreferences, vaultPreferencesUpdate, type VaultPreferences } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultPreferences } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'

export const vaultPreferencesRoutes = new Hono<AuthEnv>()
  .get('/', async (context) => {
    const [saved] = await db
      .select({
        order: vaultPreferences.order,
        direction: vaultPreferences.direction,
        view: vaultPreferences.view,
      })
      .from(vaultPreferences)
      .where(eq(vaultPreferences.userId, context.get('userId')))
    // The columns only ever hold values validated on the way in.
    return context.json((saved as VaultPreferences | undefined) ?? defaultVaultPreferences)
  })

  .put('/', validate('json', vaultPreferencesUpdate), async (context) => {
    const preferences = context.req.valid('json')
    await db
      .insert(vaultPreferences)
      .values({ userId: context.get('userId'), ...preferences })
      .onConflictDoUpdate({
        target: vaultPreferences.userId,
        set: { ...preferences, updatedAt: new Date() },
      })
    return context.json(preferences)
  })
