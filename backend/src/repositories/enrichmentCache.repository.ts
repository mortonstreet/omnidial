import { db } from '@/lib/db'
import { sql } from 'kysely'
import { v4 as uuidv4 } from 'uuid'

const CACHE_TTL_DAYS = 90

export interface EnrichmentCacheEntry {
  id: string
  lookupKey: string
  lookupType: string
  provider: string
  rawResponse: unknown
  normalizedData: unknown
  expiresAt: Date
  hitCount: number
  lastHitAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertCacheInput {
  lookupKey: string
  lookupType: 'linkedin' | 'identity_hash'
  provider: string
  rawResponse: unknown
  normalizedData: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    phoneNumbers?: string[]
    company?: string
    title?: string
  }
}

/**
 * Find all non-expired cache entries for a lookup key.
 */
export const findValidByLookupKey = async (
  lookupKey: string,
): Promise<EnrichmentCacheEntry[]> => {
  return db
    .selectFrom('enrichment_cache')
    .where('lookupKey', '=', lookupKey)
    .where('expiresAt', '>', new Date())
    .selectAll()
    .orderBy('createdAt', 'desc')
    .execute() as Promise<EnrichmentCacheEntry[]>
}

/**
 * Find a non-expired cache entry for a specific lookup key + provider.
 */
export const findValidByLookupKeyAndProvider = async (
  lookupKey: string,
  provider: string,
): Promise<EnrichmentCacheEntry | undefined> => {
  return db
    .selectFrom('enrichment_cache')
    .where('lookupKey', '=', lookupKey)
    .where('provider', '=', provider)
    .where('expiresAt', '>', new Date())
    .selectAll()
    .executeTakeFirst() as Promise<EnrichmentCacheEntry | undefined>
}

/**
 * Insert or update a cache entry using atomic ON CONFLICT upsert.
 * Uses the unique constraint on (lookupKey, provider) for conflict detection.
 */
export const upsert = async (data: UpsertCacheInput): Promise<void> => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS)
  const now = new Date()

  await db
    .insertInto('enrichment_cache')
    .values({
      id: uuidv4(),
      lookupKey: data.lookupKey,
      lookupType: data.lookupType,
      provider: data.provider,
      rawResponse: JSON.stringify(data.rawResponse),
      normalizedData: JSON.stringify(data.normalizedData),
      expiresAt,
      hitCount: 0,
      lastHitAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['lookupKey', 'provider']).doUpdateSet({
        rawResponse: JSON.stringify(data.rawResponse),
        normalizedData: JSON.stringify(data.normalizedData),
        expiresAt,
        updatedAt: now,
      }),
    )
    .execute()
}

/**
 * Increment hit count and set lastHitAt for a cache entry.
 */
export const recordHit = async (id: string): Promise<void> => {
  await db
    .updateTable('enrichment_cache')
    .set({
      hitCount: sql`"hitCount" + 1`,
      lastHitAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where('id', '=', id)
    .execute()
}

/**
 * Bulk delete expired cache entries.
 */
export const deleteExpired = async (): Promise<number> => {
  const result = await db
    .deleteFrom('enrichment_cache')
    .where('expiresAt', '<', new Date())
    .executeTakeFirst()

  return Number(result.numDeletedRows)
}
