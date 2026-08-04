import * as enrichEngineConnectionRepo from '@/repositories/enrichEngineConnection.repository'
import * as userRepository from '@/repositories/user.repository'
import {
  EnrichEngineClient,
  createEnrichEngineClient,
  validateApiKeyFormat,
} from '@/clients/enrichEngine.client'
import { encrypt, decrypt } from '@/lib/encryption'
import {
  EnrichEngineConnectionStatus,
  EnrichEngineListsResponse,
  EnrichEngineListDetailResponse,
} from '@shared/types/src'

/**
 * Connect EnrichEngine using API key
 * Validates the key by making a test request, then stores it encrypted
 */
export const connect = async (
  organizationId: string,
  userId: string,
  apiKey: string,
): Promise<{ success: boolean; message: string }> => {
  // Validate API key format
  const validation = validateApiKeyFormat(apiKey)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Test the API key by making a request to EnrichEngine
  const client = createEnrichEngineClient(apiKey)
  const testResult = await client.testConnection()

  if (!testResult.success) {
    throw new Error(testResult.message)
  }

  // Encrypt the API key for storage
  const apiKeyEncrypted = encrypt(apiKey)

  // Check if connection already exists
  const existing =
    await enrichEngineConnectionRepo.findByOrganizationId(organizationId)

  if (existing) {
    // Update existing connection with new API key
    await enrichEngineConnectionRepo.update(organizationId, {
      apiKeyEncrypted,
      isActive: true,
    })
  } else {
    // Create new connection
    await enrichEngineConnectionRepo.create({
      organizationId,
      apiKeyEncrypted,
      createdById: userId,
      isActive: true,
    })
  }

  return { success: true, message: 'Connected to EnrichEngine' }
}

/**
 * Disconnect EnrichEngine
 */
export const disconnect = async (organizationId: string): Promise<void> => {
  await enrichEngineConnectionRepo.deleteByOrganizationId(organizationId)
}

/**
 * Get connection status
 */
export const getConnectionStatus = async (
  organizationId: string,
): Promise<EnrichEngineConnectionStatus> => {
  const connection =
    await enrichEngineConnectionRepo.findByOrganizationId(organizationId)

  if (!connection) {
    return { isConnected: false }
  }

  let connectedBy = null
  if (connection.createdById) {
    const user = await userRepository.findById(connection.createdById)
    if (user) {
      connectedBy = {
        id: user.id,
        name: user.name || '',
        email: user.email,
      }
    }
  }

  return {
    isConnected: true,
    isActive: connection.isActive,
    lastSyncAt: connection.lastSyncAt?.toISOString(),
    connectedAt: connection.createdAt.toISOString(),
    connectedBy,
  }
}

/**
 * Test the connection
 */
export const testConnection = async (
  organizationId: string,
): Promise<{ success: boolean; message: string }> => {
  const client = await getClientForOrganization(organizationId)
  return client.testConnection()
}

/**
 * Get EnrichEngine client for an organization
 */
const getClientForOrganization = async (
  organizationId: string,
): Promise<EnrichEngineClient> => {
  const connection =
    await enrichEngineConnectionRepo.findByOrganizationId(organizationId)

  if (!connection) {
    throw new Error(
      'EnrichEngine not connected. Please connect with your API key.',
    )
  }

  if (!connection.isActive) {
    throw new Error('EnrichEngine connection is inactive')
  }

  // Decrypt the API key
  const apiKey = decrypt(connection.apiKeyEncrypted)

  return createEnrichEngineClient(apiKey)
}

/**
 * Fetch available lists from EnrichEngine
 */
export const getLists = async (
  organizationId: string,
  options?: { page?: number; limit?: number; search?: string },
): Promise<EnrichEngineListsResponse> => {
  const client = await getClientForOrganization(organizationId)
  return client.getLists(options)
}

/**
 * Fetch leads from a specific list
 */
export const getListWithLeads = async (
  organizationId: string,
  listId: string,
  options?: { page?: number; limit?: number },
): Promise<EnrichEngineListDetailResponse> => {
  const client = await getClientForOrganization(organizationId)
  return client.getListWithLeads(listId, options)
}

/**
 * Fetch all leads from a list (handles pagination)
 */
export const getAllLeadsFromList = async (
  organizationId: string,
  listId: string,
): Promise<EnrichEngineListDetailResponse['leads']> => {
  const client = await getClientForOrganization(organizationId)
  const result = await client.getAllLeadsFromList(listId)
  return result.leads
}

/**
 * Update last sync timestamp
 */
export const updateLastSyncAt = async (
  organizationId: string,
): Promise<void> => {
  await enrichEngineConnectionRepo.updateLastSyncAt(organizationId)
}
