import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** zValidator que responde { message } como el resto de errores de la API. */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ')
      return c.json({ message }, 400)
    }
  })
