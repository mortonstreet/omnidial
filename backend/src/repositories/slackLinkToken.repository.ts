import { db } from '@/lib/db'
import { withId } from './utils'
import crypto from 'crypto'

const TOKEN_EXPIRY_HOURS = 1
const MAX_TOKENS_PER_WORKSPACE = 10

export interface CreateSlackLinkTokenInput {
  workspaceId: string
  slackUserId: string
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create a new link token for a workspace
 * Automatically cleans up old tokens to prevent accumulation
 */
export const create = async (data: CreateSlackLinkTokenInput) => {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  // Clean up any expired tokens for this workspace first
  await deleteExpiredByWorkspace(data.workspaceId)

  const record = withId({
    ...data,
    token,
    expiresAt,
    createdAt: new Date(),
  })

  return db
    .insertInto('slack_link_token')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Find a valid (unexpired, unused) token
 */
export const findByToken = async (token: string) => {
  return db
    .selectFrom('slack_link_token')
    .selectAll()
    .where('token', '=', token)
    .where('expiresAt', '>', new Date())
    .where('usedAt', 'is', null)
    .executeTakeFirst()
}

/**
 * Find or create a link token for a workspace/user combination
 * Returns existing valid token if one exists, otherwise creates new one
 */
export const findOrCreate = async (
  workspaceId: string,
  slackUserId: string,
) => {
  // Look for an existing valid token for this workspace+user
  const existing = await db
    .selectFrom('slack_link_token')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('slackUserId', '=', slackUserId)
    .where('expiresAt', '>', new Date())
    .where('usedAt', 'is', null)
    .executeTakeFirst()

  if (existing) {
    return existing
  }

  // Create a new token
  return create({ workspaceId, slackUserId })
}

/**
 * Mark a token as used
 */
export const markUsed = async (id: string) => {
  return db
    .updateTable('slack_link_token')
    .set({ usedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

/**
 * Delete expired tokens for a specific workspace
 */
export const deleteExpiredByWorkspace = async (workspaceId: string) => {
  return db
    .deleteFrom('slack_link_token')
    .where('workspaceId', '=', workspaceId)
    .where((eb) =>
      eb.or([eb('expiresAt', '<=', new Date()), eb('usedAt', 'is not', null)]),
    )
    .execute()
}

/**
 * Delete all expired tokens (for cleanup job)
 */
export const deleteExpired = async () => {
  return db
    .deleteFrom('slack_link_token')
    .where((eb) =>
      eb.or([eb('expiresAt', '<=', new Date()), eb('usedAt', 'is not', null)]),
    )
    .execute()
}

/**
 * Count active tokens for a workspace (for rate limiting)
 */
export const countByWorkspace = async (workspaceId: string) => {
  const result = await db
    .selectFrom('slack_link_token')
    .select(db.fn.count('id').as('count'))
    .where('workspaceId', '=', workspaceId)
    .where('expiresAt', '>', new Date())
    .where('usedAt', 'is', null)
    .executeTakeFirst()

  return Number(result?.count || 0)
}

/**
 * Check if workspace has reached token rate limit
 */
export const isRateLimited = async (workspaceId: string): Promise<boolean> => {
  const count = await countByWorkspace(workspaceId)
  return count >= MAX_TOKENS_PER_WORKSPACE
}

/**
 * Delete a token by ID
 */
export const deleteById = async (id: string) => {
  return db.deleteFrom('slack_link_token').where('id', '=', id).execute()
}
