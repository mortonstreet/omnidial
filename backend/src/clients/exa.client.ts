/**
 * Exa.ai API Client
 * Web search and content extraction for company/lead research.
 *
 * @see https://docs.exa.ai/
 */

const EXA_BASE_URL = 'https://api.exa.ai'
const REQUEST_TIMEOUT = 30000 // 30 seconds

export type ExaSearchType = 'neural' | 'keyword' | 'auto'

export interface ExaSearchOptions {
  query: string
  type?: ExaSearchType
  useAutoprompt?: boolean
  numResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  startCrawlDate?: string // ISO date string
  endCrawlDate?: string // ISO date string
  startPublishedDate?: string
  endPublishedDate?: string
  category?: 'company' | 'research paper' | 'news' | 'blog' | 'github' | 'tweet'
}

export interface ExaContentsOptions {
  text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean }
  highlights?: boolean | { numSentences?: number; highlightsPerUrl?: number }
  summary?: boolean | { query?: string }
}

export interface ExaSearchResult {
  id: string
  url: string
  title: string
  score: number
  publishedDate?: string
  author?: string
  text?: string
  highlights?: string[]
  highlightScores?: number[]
  summary?: string
}

export interface ExaSearchResponse {
  requestId: string
  autopromptString?: string
  resolvedSearchType: ExaSearchType
  results: ExaSearchResult[]
}

export interface ExaFindSimilarOptions {
  url: string
  numResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  startCrawlDate?: string
  endCrawlDate?: string
  category?: string
}

class ExaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string,
  ) {
    super(message)
    this.name = 'ExaApiError'
  }
}

export class ExaClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = EXA_BASE_URL) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Make an authenticated request to Exa API
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
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')

        if (response.status === 401) {
          throw new ExaApiError(
            'Invalid API key. Please check your Exa API key.',
            401,
            errorText,
          )
        }

        if (response.status === 429) {
          throw new ExaApiError(
            'Rate limited. Please try again later.',
            429,
            errorText,
          )
        }

        if (response.status === 400) {
          throw new ExaApiError(`Invalid request: ${errorText}`, 400, errorText)
        }

        throw new ExaApiError(
          `Exa API error: ${errorText}`,
          response.status,
          errorText,
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof ExaApiError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ExaApiError('Request timeout', 408)
      }

      throw new ExaApiError(
        error instanceof Error ? error.message : 'Unknown error',
        500,
      )
    }
  }

  /**
   * Search the web using Exa's neural search
   */
  async search(
    options: ExaSearchOptions,
    contents?: ExaContentsOptions,
  ): Promise<ExaSearchResponse> {
    const body: Record<string, unknown> = {
      query: options.query,
      type: options.type || 'auto',
      useAutoprompt: options.useAutoprompt ?? true,
      numResults: options.numResults || 10,
    }

    if (options.includeDomains) body.includeDomains = options.includeDomains
    if (options.excludeDomains) body.excludeDomains = options.excludeDomains
    if (options.startCrawlDate) body.startCrawlDate = options.startCrawlDate
    if (options.endCrawlDate) body.endCrawlDate = options.endCrawlDate
    if (options.startPublishedDate)
      body.startPublishedDate = options.startPublishedDate
    if (options.endPublishedDate)
      body.endPublishedDate = options.endPublishedDate
    if (options.category) body.category = options.category

    if (contents) {
      body.contents = contents
    }

    return this.request<ExaSearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Find similar pages to a given URL
   */
  async findSimilar(
    options: ExaFindSimilarOptions,
    contents?: ExaContentsOptions,
  ): Promise<ExaSearchResponse> {
    const body: Record<string, unknown> = {
      url: options.url,
      numResults: options.numResults || 10,
    }

    if (options.includeDomains) body.includeDomains = options.includeDomains
    if (options.excludeDomains) body.excludeDomains = options.excludeDomains
    if (options.startCrawlDate) body.startCrawlDate = options.startCrawlDate
    if (options.endCrawlDate) body.endCrawlDate = options.endCrawlDate
    if (options.category) body.category = options.category

    if (contents) {
      body.contents = contents
    }

    return this.request<ExaSearchResponse>('/findSimilar', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Get contents for specific URLs
   */
  async getContents(
    urls: string[],
    options?: ExaContentsOptions,
  ): Promise<ExaSearchResponse> {
    const body: Record<string, unknown> = {
      ids: urls,
    }

    if (options) {
      if (options.text !== undefined) body.text = options.text
      if (options.highlights !== undefined) body.highlights = options.highlights
      if (options.summary !== undefined) body.summary = options.summary
    }

    return this.request<ExaSearchResponse>('/contents', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Research a company by name or domain
   */
  async researchCompany(
    companyName: string,
    domain?: string,
  ): Promise<{
    companyInfo: ExaSearchResult[]
    news: ExaSearchResult[]
    funding: ExaSearchResult[]
    techStack: ExaSearchResult[]
  }> {
    const includeDomains = domain ? [domain] : undefined

    // Run multiple searches in parallel
    const [companyInfo, news, funding, techStack] = await Promise.all([
      // Company overview
      this.search(
        {
          query: `${companyName} company overview about us what we do`,
          type: 'neural',
          numResults: 5,
          includeDomains,
          category: 'company',
        },
        { text: { maxCharacters: 2000 }, summary: true },
      ),

      // Recent news
      this.search(
        {
          query: `${companyName} news announcement`,
          type: 'neural',
          numResults: 5,
          category: 'news',
          startPublishedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0], // Last 90 days
        },
        { text: { maxCharacters: 1000 }, highlights: { numSentences: 3 } },
      ),

      // Funding/investment info
      this.search(
        {
          query: `${companyName} funding round investment raised series`,
          type: 'neural',
          numResults: 3,
          includeDomains: ['crunchbase.com', 'techcrunch.com', 'pitchbook.com'],
        },
        { text: { maxCharacters: 1500 }, summary: true },
      ),

      // Tech stack / engineering
      this.search(
        {
          query: `${companyName} tech stack engineering technology tools`,
          type: 'neural',
          numResults: 3,
          includeDomains: domain
            ? [domain, 'stackshare.io', 'builtwith.com']
            : ['stackshare.io', 'builtwith.com'],
        },
        { text: { maxCharacters: 1000 } },
      ),
    ])

    return {
      companyInfo: companyInfo.results,
      news: news.results,
      funding: funding.results,
      techStack: techStack.results,
    }
  }

  /**
   * Research a person by name and company
   */
  async researchPerson(
    personName: string,
    companyName?: string,
  ): Promise<{
    linkedIn: ExaSearchResult[]
    mentions: ExaSearchResult[]
    articles: ExaSearchResult[]
  }> {
    const query = companyName ? `${personName} ${companyName}` : personName

    const [linkedIn, mentions, articles] = await Promise.all([
      // LinkedIn profile
      this.search(
        {
          query: `${query} LinkedIn profile`,
          type: 'neural',
          numResults: 3,
          includeDomains: ['linkedin.com'],
        },
        { text: { maxCharacters: 1500 } },
      ),

      // General mentions
      this.search(
        {
          query: query,
          type: 'neural',
          numResults: 5,
          excludeDomains: ['linkedin.com', 'facebook.com', 'twitter.com'],
        },
        { text: { maxCharacters: 1000 }, highlights: { numSentences: 2 } },
      ),

      // Authored articles
      this.search(
        {
          query: `author:${personName}`,
          type: 'neural',
          numResults: 3,
          category: 'blog',
        },
        { text: { maxCharacters: 800 }, summary: true },
      ),
    ])

    return {
      linkedIn: linkedIn.results,
      mentions: mentions.results,
      articles: articles.results,
    }
  }

  /**
   * Quick company lookup - minimal research for fast qualification
   */
  async quickCompanyLookup(companyName: string): Promise<{
    summary: string
    website?: string
    recentActivity: string[]
  }> {
    const response = await this.search(
      {
        query: `${companyName} company about`,
        type: 'auto',
        numResults: 3,
        category: 'company',
      },
      { summary: true, text: { maxCharacters: 500 } },
    )

    const summary =
      response.results[0]?.summary ||
      response.results[0]?.text ||
      'No information found'
    const website = response.results.find((r) =>
      r.url.includes(companyName.toLowerCase().replace(/\s+/g, '')),
    )?.url

    const recentActivity = response.results
      .filter((r) => r.publishedDate)
      .map((r) => r.title)
      .slice(0, 3)

    return {
      summary,
      website,
      recentActivity,
    }
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.search({
        query: 'test',
        numResults: 1,
      })
      return { success: true, message: 'Connected to Exa.ai' }
    } catch (error) {
      if (error instanceof ExaApiError) {
        return { success: false, message: error.message }
      }
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to connect to Exa.ai',
      }
    }
  }
}

/**
 * Create an Exa client instance from environment
 */
export function createExaClient(apiKey?: string): ExaClient {
  const key = apiKey || process.env.EXA_API_KEY
  if (!key) {
    throw new Error('EXA_API_KEY environment variable is required')
  }
  return new ExaClient(key)
}

/**
 * Validate Exa API key format
 */
export function validateExaApiKey(apiKey: string): {
  valid: boolean
  error?: string
} {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  // Exa keys are UUIDs or similar format
  if (apiKey.length < 20) {
    return {
      valid: false,
      error: 'API key appears too short',
    }
  }

  return { valid: true }
}

// Singleton instance - lazily created when first accessed
let _exaClient: ExaClient | null = null

/**
 * Get the singleton Exa client instance
 */
export const exaClient = {
  get instance(): ExaClient {
    if (!_exaClient) {
      const key = process.env.EXA_API_KEY
      if (!key) {
        throw new Error('EXA_API_KEY environment variable is required')
      }
      _exaClient = new ExaClient(key)
    }
    return _exaClient
  },
  search: (...args: Parameters<ExaClient['search']>) =>
    exaClient.instance.search(...args),
  findSimilar: (...args: Parameters<ExaClient['findSimilar']>) =>
    exaClient.instance.findSimilar(...args),
  getContents: (...args: Parameters<ExaClient['getContents']>) =>
    exaClient.instance.getContents(...args),
  researchCompany: (...args: Parameters<ExaClient['researchCompany']>) =>
    exaClient.instance.researchCompany(...args),
  researchPerson: (...args: Parameters<ExaClient['researchPerson']>) =>
    exaClient.instance.researchPerson(...args),
  quickCompanyLookup: (...args: Parameters<ExaClient['quickCompanyLookup']>) =>
    exaClient.instance.quickCompanyLookup(...args),
}
