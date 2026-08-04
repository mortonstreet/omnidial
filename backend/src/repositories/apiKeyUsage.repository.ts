import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'
import { sql } from 'kysely'

export interface CreateUsageInput {
  apiKeyId: string
  endpoint: string
  method: string
  statusCode: number
}

export const create = async (data: CreateUsageInput) => {
  const record = withId(withTimestamps(data, true))
  return db.insertInto('api_key_usage').values(record).execute()
}

export const getUsageStats = async (
  apiKeyId: string,
  startDate?: Date,
  endDate?: Date,
) => {
  let baseQuery = db
    .selectFrom('api_key_usage')
    .where('apiKeyId', '=', apiKeyId)

  if (startDate) {
    baseQuery = baseQuery.where('createdAt', '>=', startDate)
  }
  if (endDate) {
    baseQuery = baseQuery.where('createdAt', '<=', endDate)
  }

  const [totalResult, byEndpoint, byDay] = await Promise.all([
    baseQuery.select((eb) => eb.fn.countAll().as('count')).executeTakeFirst(),
    db
      .selectFrom('api_key_usage')
      .where('apiKeyId', '=', apiKeyId)
      .select(['endpoint', (eb) => eb.fn.countAll().as('count')])
      .groupBy('endpoint')
      .orderBy('count', 'desc')
      .execute(),
    db
      .selectFrom('api_key_usage')
      .where('apiKeyId', '=', apiKeyId)
      .select([
        sql<string>`DATE(created_at)`.as('date'),
        (eb) => eb.fn.countAll().as('count'),
      ])
      .groupBy(sql`DATE(created_at)`)
      .orderBy('date', 'desc')
      .limit(30)
      .execute(),
  ])

  return {
    totalRequests: Number(totalResult?.count || 0),
    requestsByEndpoint: byEndpoint.map((r) => ({
      endpoint: r.endpoint,
      count: Number(r.count),
    })),
    requestsByDay: byDay.map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    })),
  }
}
