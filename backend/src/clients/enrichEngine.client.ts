import {
  EnrichEngineList,
  EnrichEngineLead,
  EnrichEngineListsResponse,
  EnrichEngineListDetailResponse,
  EnrichEnginePagination,
} from '@shared/types/src'

const ENRICHENGINE_BASE_URL = 'https://api.enrichengine.xyz/api/external'
const REQUEST_TIMEOUT = 30000 // 30 seconds

interface EnrichEngineClientOptions {
  page?: number
  limit?: number
  search?: string
}

class EnrichEngineApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string,
  ) {
    super(message)
    this.name = 'EnrichEngineApiError'
  }
}

/**
 * EnrichEngine API Client
 * Uses API Key authentication (X-API-Key header)
 */
export class EnrichEngineClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = ENRICHENGINE_BASE_URL) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Make an authenticated request to EnrichEngine API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')

        if (response.status === 401) {
          throw new EnrichEngineApiError(
            'Invalid API key. Please check your key and try again.',
            401,
            errorText,
          )
        }

        if (response.status === 403) {
          throw new EnrichEngineApiError(
            'Missing required scope. Ensure your API key has "lists:read" permission.',
            403,
            errorText,
          )
        }

        if (response.status === 404) {
          throw new EnrichEngineApiError('Resource not found', 404, errorText)
        }

        if (response.status === 429) {
          throw new EnrichEngineApiError(
            'Rate limited. Please try again later.',
            429,
            errorText,
          )
        }

        throw new EnrichEngineApiError(
          `EnrichEngine API error: ${errorText}`,
          response.status,
          errorText,
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof EnrichEngineApiError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new EnrichEngineApiError('Request timeout', 408)
      }

      throw new EnrichEngineApiError(
        error instanceof Error ? error.message : 'Unknown error',
        500,
      )
    }
  }

  /**
   * Test the connection by fetching lists
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getLists({ limit: 1 })
      return { success: true, message: 'Connected to EnrichEngine' }
    } catch (error) {
      console.error('EnrichEngine testConnection error:', {
        error: error instanceof Error ? error.message : error,
        statusCode:
          error instanceof EnrichEngineApiError ? error.statusCode : undefined,
        response:
          error instanceof EnrichEngineApiError ? error.response : undefined,
      })
      if (error instanceof EnrichEngineApiError) {
        return { success: false, message: error.message }
      }
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to connect to EnrichEngine',
      }
    }
  }

  /**
   * Fetch available lists from EnrichEngine
   */
  async getLists(
    options?: EnrichEngineClientOptions,
  ): Promise<EnrichEngineListsResponse> {
    const params = new URLSearchParams()
    if (options?.page) params.set('page', options.page.toString())
    if (options?.limit) params.set('limit', options.limit.toString())
    if (options?.search) params.set('search', options.search)

    const query = params.toString()
    const endpoint = query ? `/lists?${query}` : '/lists'

    return this.request<EnrichEngineListsResponse>(endpoint)
  }

  /**
   * Fetch a specific list with its leads (paginated)
   */
  async getListWithLeads(
    listId: string,
    options?: { page?: number; limit?: number },
  ): Promise<EnrichEngineListDetailResponse> {
    const params = new URLSearchParams()
    if (options?.page) params.set('page', options.page.toString())
    if (options?.limit) params.set('limit', options.limit.toString())

    const query = params.toString()
    const endpoint = query ? `/lists/${listId}?${query}` : `/lists/${listId}`

    return this.request<EnrichEngineListDetailResponse>(endpoint)
  }

  /**
   * Fetch all leads from a list (handles pagination automatically)
   */
  async getAllLeadsFromList(listId: string): Promise<{
    list: EnrichEngineList
    leads: EnrichEngineLead[]
  }> {
    const allLeads: EnrichEngineLead[] = []
    let page = 1
    const limit = 500 // Max allowed per request
    let list: EnrichEngineList | null = null

    while (true) {
      const response = await this.getListWithLeads(listId, { page, limit })

      if (!list) {
        list = response.list
      }

      allLeads.push(...response.leads)

      if (page >= response.pagination.totalPages) {
        break
      }
      page++
    }

    return { list: list!, leads: allLeads }
  }
}

/**
 * Validate EnrichEngine API key format
 */
export function validateApiKeyFormat(apiKey: string): {
  valid: boolean
  error?: string
} {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  if (!apiKey.startsWith('ee_')) {
    return {
      valid: false,
      error: 'Invalid API key format. Key should start with "ee_"',
    }
  }

  if (apiKey.length < 40) {
    return {
      valid: false,
      error: 'API key appears too short. Please check and try again.',
    }
  }

  return { valid: true }
}

/**
 * Create an EnrichEngine client instance
 */
export function createEnrichEngineClient(apiKey: string): EnrichEngineClient {
  return new EnrichEngineClient(apiKey)
}
