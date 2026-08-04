import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const create = async (
  organizationId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) => {
  return await db
    .insertInto('billing_event')
    .values({
      id: uuidv4(),
      organizationId,
      eventType,
      metadata: JSON.stringify(metadata),
      createdAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}
