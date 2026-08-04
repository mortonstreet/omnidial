import { randomBytes, createHash } from 'crypto'
import * as apiKeyRepository from '@/repositories/apiKey.repository'
import * as apiKeyUsageRepository from '@/repositories/apiKeyUsage.repository'
import * as userRepository from '@/repositories/user.repository'
import { DBPagination } from '@shared/db/src/types'

const KEY_PREFIX = 'sk_live_'

// Generate a secure random API key
const generateApiKey = (): string => {
  const randomPart = randomBytes(32).toString('base64url')
  return `${KEY_PREFIX}${randomPart}`
}

// Hash API key using SHA-256 (sufficient for high-entropy keys)
const hashApiKey = (key: string): string => {
  return createHash('sha256').update(key).digest('hex')
}

// Create display prefix (first 8 + last 4 chars)
const createKeyPrefix = (key: string): string => {
  const withoutPrefix = key.replace(KEY_PREFIX, '')
  const first4 = withoutPrefix.slice(0, 4)
  const last4 = withoutPrefix.slice(-4)
  return `${KEY_PREFIX}${first4}****${last4}`
}

export const createApiKey = async (
  organizationId: string,
  createdById: string,
  name: string,
  scopes: string[],
  expiresInDays?: number | null,
) => {
  const fullKey = generateApiKey()
  const keyHash = hashApiKey(fullKey)
  const keyPrefix = createKeyPrefix(fullKey)

  let expiresAt: Date | null = null
  if (expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  }

  const apiKey = await apiKeyRepository.create({
    organizationId,
    name,
    keyHash,
    keyPrefix,
    scopes,
    expiresAt,
    createdById,
  })

  return {
    id: apiKey.id,
    key: fullKey,
    name: apiKey.name,
    scopes: apiKey.scopes,
    expiresAt: apiKey.expiresAt?.toISOString() || null,
  }
}

export const listApiKeys = async (
  organizationId: string,
  pagination: DBPagination,
) => {
  const result = await apiKeyRepository.findMany({ organizationId }, pagination)

  const keysWithCreator = await Promise.all(
    result.data.map(async (key) => {
      const creator = await userRepository.findById(key.createdById)
      return {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt?.toISOString() || null,
        lastUsedAt: key.lastUsedAt?.toISOString() || null,
        createdAt: key.createdAt.toISOString(),
        createdBy: creator
          ? { id: creator.id, name: creator.name || '', email: creator.email }
          : null,
      }
    }),
  )

  return {
    data: keysWithCreator,
    total: result.total,
  }
}

export const getApiKeyById = async (id: string) => {
  const key = await apiKeyRepository.findById(id)
  if (!key) return null

  const creator = await userRepository.findById(key.createdById)
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    expiresAt: key.expiresAt?.toISOString() || null,
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    createdAt: key.createdAt.toISOString(),
    createdBy: creator
      ? { id: creator.id, name: creator.name || '', email: creator.email }
      : null,
  }
}

export const revokeApiKey = async (id: string) => {
  return apiKeyRepository.revoke(id)
}

export const getApiKeyUsage = async (
  id: string,
  startDate?: string,
  endDate?: string,
) => {
  return apiKeyUsageRepository.getUsageStats(
    id,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined,
  )
}

// Validate API key for authentication
export const validateApiKey = async (key: string) => {
  if (!key.startsWith(KEY_PREFIX)) {
    return null
  }

  const keyHash = hashApiKey(key)
  const apiKey = await apiKeyRepository.findByKeyHash(keyHash)

  if (!apiKey) {
    return null
  }

  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return null
  }

  // Update last used
  await apiKeyRepository.updateLastUsed(apiKey.id)
  return apiKey
}

export const logApiKeyUsage = async (
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
) => {
  return apiKeyUsageRepository.create({
    apiKeyId,
    endpoint,
    method,
    statusCode,
  })
}
