/**
 * Firecrawl API Client
 * https://docs.firecrawl.dev/
 *
 * Firecrawl provides web scraping with LLM-powered structured data extraction.
 */

import Firecrawl from '@mendable/firecrawl-js'
import logger from '@/lib/logger'

// === Public Result Types ===

export interface FirecrawlScrapeResult {
  success: boolean
  url: string
  markdown?: string
  title?: string
  description?: string
  errorMessage?: string
}

export interface FirecrawlExtractResult {
  success: boolean
  url: string
  extractedData: Record<string, unknown>
  markdown?: string
  errorMessage?: string
}

// === Extraction Schema Types (JSON Schema format) ===

export interface ExtractionField {
  name: string
  description: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
}

export interface ExtractionSchema {
  name: string
  description: string
  fields: ExtractionField[]
}

/**
 * Convert ExtractionSchema fields to JSON Schema format
 */
function toJsonSchema(fields: ExtractionField[]): object {
  const properties: Record<string, object> = {}
  const required: string[] = []

  for (const field of fields) {
    properties[field.name] = {
      type: field.type,
      description: field.description,
    }
    if (field.required) {
      required.push(field.name)
    }
  }

  return {
    type: 'object',
    properties,
    required,
  }
}

// === URL Validation (SSRF protection) ===

function validateUrl(url: string): void {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) {
    throw new Error('Local addresses are not allowed')
  }
  const ipParts = hostname.split('.').map(Number)
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p))) {
    if (ipParts[0] === 10) throw new Error('Private IP not allowed')
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31)
      throw new Error('Private IP not allowed')
    if (ipParts[0] === 192 && ipParts[1] === 168)
      throw new Error('Private IP not allowed')
    if (ipParts[0] === 169 && ipParts[1] === 254)
      throw new Error('Link-local not allowed')
  }
}

// === API Functions ===

/**
 * Scrape a URL and return its content as markdown
 */
export async function scrape(
  apiKey: string,
  url: string,
  options?: {
    timeout?: number
  },
): Promise<FirecrawlScrapeResult> {
  try {
    validateUrl(url)
    const firecrawl = new Firecrawl({ apiKey })

    const result = await firecrawl.scrape(url, {
      formats: ['markdown'],
      timeout: options?.timeout ?? 30000,
    })

    if (!('markdown' in result)) {
      return {
        success: false,
        url,
        errorMessage:
          'error' in result ? String(result.error) : 'Scrape failed',
      }
    }

    return {
      success: true,
      url,
      markdown: result.markdown,
      title: result.metadata?.title,
      description: result.metadata?.description,
    }
  } catch (error) {
    logger.error({ error, url }, 'Firecrawl scrape error')
    return {
      success: false,
      url,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Scrape a URL and extract structured data using JSON schema
 */
export async function extract(
  apiKey: string,
  url: string,
  schema: ExtractionSchema,
  options?: {
    prompt?: string
    timeout?: number
  },
): Promise<FirecrawlExtractResult> {
  try {
    validateUrl(url)
    const firecrawl = new Firecrawl({ apiKey })

    const jsonSchema = toJsonSchema(schema.fields)

    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'json'],
      jsonOptions: {
        prompt:
          options?.prompt ?? schema.description ?? 'Extract the requested data',
        schema: jsonSchema,
      },
      timeout: options?.timeout ?? 60000,
    })

    if (!('markdown' in result)) {
      return {
        success: false,
        url,
        extractedData: {},
        errorMessage:
          'error' in result ? String(result.error) : 'Extraction failed',
      }
    }

    return {
      success: true,
      url,
      extractedData:
        result.json != null ? (result.json as Record<string, unknown>) : {},
      markdown: result.markdown,
    }
  } catch (error) {
    logger.error({ error, url }, 'Firecrawl extract error')
    return {
      success: false,
      url,
      extractedData: {},
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Test the API connection
 */
export async function testConnection(apiKey: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    const firecrawl = new Firecrawl({ apiKey })

    // Attempt a simple scrape to verify the API key works
    const result = await firecrawl.scrape('https://example.com', {
      formats: ['markdown'],
      timeout: 10000,
    })

    if ('markdown' in result) {
      return {
        success: true,
        message: 'Firecrawl connection successful',
      }
    }

    return {
      success: false,
      message:
        'error' in result ? String(result.error) : 'Connection test failed',
    }
  } catch (error) {
    logger.error({ error }, 'Firecrawl test connection error')
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}
