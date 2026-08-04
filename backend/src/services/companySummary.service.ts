import * as leadRepo from '@/repositories/lead.repository'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const EXA_API_KEY = process.env.EXA_API_KEY || ''
const SERPER_API_KEY = process.env.SERPER_API_KEY || ''

// Provider configuration - default to openrouter
const AI_SUMMARY_PROVIDER = (process.env.AI_SUMMARY_PROVIDER ||
  'openrouter') as 'openrouter' | 'openai'

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface ExaSearchResult {
  title: string
  url: string
  text: string
  publishedDate?: string
}

interface ExaSearchResponse {
  results: ExaSearchResult[]
}

interface SerperSearchResult {
  title: string
  link: string
  snippet: string
}

interface SerperSearchResponse {
  organic: SerperSearchResult[]
  knowledgeGraph?: {
    title?: string
    type?: string
    description?: string
    attributes?: Record<string, string>
  }
}

interface LeadContext {
  company: string
  website?: string | null
  title?: string | null
  industry?: string | null
  firstName?: string | null
  lastName?: string | null
}

// Structured summary output
export interface StructuredSummary {
  companyOverview: string
  salesTalkingPoints: string[]
  businessContext: {
    founded?: string
    size?: string
    funding?: string
    recentNews?: string
    targetCustomers?: string
    products?: string[]
  }
}

/**
 * Extract domain from website URL
 */
function extractDomain(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}

/**
 * Scrape website content using OpenRouter with web search capability
 */
async function scrapeWebsiteWithAI(website: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null

  const domain = extractDomain(website)

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omnidial.io',
        'X-Title': 'OmniDial',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar',
        messages: [
          {
            role: 'user',
            content: `Research the company website ${domain}. Visit and analyze their website to extract:
1. What products or services do they offer?
2. Who are their target customers/market?
3. What industry are they in?
4. Any recent news, funding, or notable developments?
5. Company size, founding date, headquarters if available

Provide detailed, factual information only. Do not make assumptions.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      console.error('OpenRouter web scrape error:', response.status)
      return null
    }

    const data = (await response.json()) as AIResponse

    if (!data.choices || data.choices.length === 0) {
      return null
    }

    return `=== WEBSITE RESEARCH (${domain}) ===\n${data.choices[0].message.content.trim()}`
  } catch (error) {
    console.error('Website scrape error:', error)
    return null
  }
}

/**
 * Search for company information using Exa.ai
 */
async function searchWithExa(
  domain: string,
  companyName?: string | null,
): Promise<string | null> {
  if (!EXA_API_KEY) return null

  try {
    // Focus on domain-based search
    const query = `site:${domain} about products services`

    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EXA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        type: 'neural',
        useAutoprompt: true,
        contents: {
          text: { maxCharacters: 1500 },
        },
      }),
    })

    if (!response.ok) {
      console.error('Exa API error:', response.status)
      return null
    }

    const data = (await response.json()) as ExaSearchResponse

    if (!data.results || data.results.length === 0) {
      return null
    }

    // Combine top results into context
    const searchContext = data.results
      .slice(0, 4)
      .map((r) => `Source: ${r.title} (${r.url})\n${r.text}`)
      .join('\n\n')

    return `=== WEBSITE CONTENT ===\n${searchContext}`
  } catch (error) {
    console.error('Exa search error:', error)
    return null
  }
}

/**
 * Search for company information using Serper.dev with domain-focused queries
 */
async function searchWithSerper(
  domain: string,
  companyName?: string | null,
): Promise<string | null> {
  if (!SERPER_API_KEY) return null

  // Build domain-focused search queries for company intelligence
  const queries = [
    // Primary - scrape from the company's own website
    `site:${domain} about products services`,
    // Company overview from their site
    `site:${domain} "about us" OR "what we do" OR "our company"`,
    // Products and services from their site
    `site:${domain} products OR services OR solutions OR platform`,
    // External info about the company (news, funding)
    companyName
      ? `"${companyName}" ${domain} company news funding 2024 2025`
      : `${domain} company news funding 2024 2025`,
  ]

  try {
    // Execute searches in parallel for speed
    const searchPromises = queries.map((q) =>
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q,
          num: 8,
        }),
      }).then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<SerperSearchResponse>
      }),
    )

    const results = await Promise.all(searchPromises)
    const parts: string[] = []
    const seenSnippets = new Set<string>()

    // Process each search result
    for (let i = 0; i < results.length; i++) {
      const data = results[i]
      if (!data) continue

      const queryType = [
        'WEBSITE CONTENT',
        'ABOUT THE COMPANY',
        'PRODUCTS & SERVICES',
        'NEWS & FUNDING',
      ][i]

      // Extract knowledge graph (usually from first query)
      if (i === 0 && data.knowledgeGraph) {
        const kg = data.knowledgeGraph
        const kgParts: string[] = []

        if (kg.title) kgParts.push(`Company: ${kg.title}`)
        if (kg.type) kgParts.push(`Type: ${kg.type}`)
        if (kg.description) kgParts.push(`Description: ${kg.description}`)

        if (kg.attributes) {
          const relevantAttrs = [
            'Founded',
            'Headquarters',
            'CEO',
            'Founder',
            'Founders',
            'Number of employees',
            'Employees',
            'Revenue',
            'Industry',
            'Parent organization',
            'Subsidiaries',
            'Stock price',
            'Products',
            'Services',
          ]

          for (const attr of relevantAttrs) {
            const value = kg.attributes[attr]
            if (value) kgParts.push(`${attr}: ${value}`)
          }
        }

        if (kgParts.length > 0) {
          parts.push(`=== KNOWLEDGE GRAPH ===\n${kgParts.join('\n')}`)
        }
      }

      // Extract organic results with deduplication
      if (data.organic && data.organic.length > 0) {
        const snippets: string[] = []

        for (const result of data.organic.slice(0, 5)) {
          // Skip if we've seen similar content (dedup by first 50 chars)
          const snippetKey = result.snippet?.slice(0, 50).toLowerCase()
          if (!snippetKey || seenSnippets.has(snippetKey)) continue
          seenSnippets.add(snippetKey)

          // Prioritize results from company's own website
          const isOwnSite = result.link?.includes(domain)

          const prefix = isOwnSite ? '[Official] ' : ''
          snippets.push(`${prefix}${result.title}\n${result.snippet}`)
        }

        if (snippets.length > 0) {
          parts.push(`=== ${queryType} ===\n${snippets.join('\n\n')}`)
        }
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : null
  } catch (error) {
    console.error('Serper search error:', error)
    return null
  }
}

/**
 * Get web search context for a company - REQUIRES a website/domain
 * Prioritizes scraping the actual website over generic search
 */
async function getWebSearchContext(
  website: string,
  companyName?: string | null,
): Promise<string | null> {
  const domain = extractDomain(website)
  const results: string[] = []

  // Try AI-powered website scraping first (most accurate)
  const aiScrapeResult = await scrapeWebsiteWithAI(website)
  if (aiScrapeResult) {
    results.push(aiScrapeResult)
  }

  // Also try Serper for additional context from the domain
  const serperResult = await searchWithSerper(domain, companyName)
  if (serperResult) {
    results.push(serperResult)
  }

  // Fall back to Exa if we still need more context
  if (results.length === 0) {
    const exaResult = await searchWithExa(domain, companyName)
    if (exaResult) {
      results.push(exaResult)
    }
  }

  return results.length > 0 ? results.join('\n\n') : null
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(messages: AIMessage[]): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omnidial.io',
      'X-Title': 'OmniDial',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-haiku',
      messages,
      max_tokens: 800,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenRouter API error:', error)
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = (await response.json()) as AIResponse

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter')
  }

  return data.choices[0].message.content.trim()
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages: AIMessage[]): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = (await response.json()) as AIResponse

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenAI')
  }

  return data.choices[0].message.content.trim()
}

/**
 * Call the configured AI provider
 */
async function callAIProvider(
  messages: AIMessage[],
  provider: 'openrouter' | 'openai' = AI_SUMMARY_PROVIDER,
): Promise<string> {
  if (provider === 'openai') {
    return callOpenAI(messages)
  }
  return callOpenRouter(messages)
}

/**
 * Generate a structured company summary using AI
 */
async function generateStructuredSummary(
  lead: LeadContext,
  webSearchContext: string | null,
): Promise<{ structured: StructuredSummary; markdown: string } | null> {
  // Build context from lead data
  const leadContextParts: string[] = []
  if (lead.website) leadContextParts.push(`Website: ${lead.website}`)
  if (lead.industry) leadContextParts.push(`Industry: ${lead.industry}`)
  if (lead.title) leadContextParts.push(`Contact's Title: ${lead.title}`)
  if (lead.firstName || lead.lastName) {
    leadContextParts.push(
      `Contact: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}`,
    )
  }

  const leadDataSection =
    leadContextParts.length > 0
      ? `\n\nKnown information about this lead:\n${leadContextParts.join('\n')}`
      : ''

  const webSearchSection = webSearchContext
    ? `\n\nWeb research results:\n${webSearchContext}`
    : ''

  const hasContext = leadContextParts.length > 0 || webSearchContext

  const systemPrompt = `You are a sales intelligence analyst. Your job is to analyze a COMPANY (not a person) based on their website/domain research.

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown code blocks):
{
  "companyOverview": "2-3 sentences about what the COMPANY does, their core business, and value proposition",
  "salesTalkingPoints": [
    "Specific conversation starter based on their business",
    "Value hook related to their products/services",
    "Relevant industry talking point"
  ],
  "businessContext": {
    "founded": "year or null",
    "size": "employee count or range, or null",
    "funding": "funding info or null",
    "recentNews": "notable recent development or null",
    "targetCustomers": "who they sell to - specific industries, company sizes, or personas",
    "products": ["product/service 1", "product/service 2", "product/service 3"]
  }
}

CRITICAL RULES:
1. This is about the COMPANY, not about individual people
2. Extract information from the website research provided - focus on what the company DOES
3. Products/services should be specific offerings from their website
4. Target customers should be who THEY sell to (their customers), not generic descriptions
5. NEVER fabricate - only use data from the research provided
6. Use null for fields with no reliable data
7. If the research doesn't contain useful company information, respond with EXACTLY: NO_INFO_AVAILABLE
8. Prioritize information from [Official] sources (their own website)
9. Sales talking points should help a sales rep start a conversation about the prospect's business`

  const userPrompt = hasContext
    ? `Generate a company briefing based on website research for domain: ${lead.website || 'unknown'}.

Company name (if known): ${lead.company || 'Unknown'}
${leadDataSection}
${webSearchSection}

Remember: Focus on the COMPANY and their business, not individual people.`
    : `No website research available for this lead. Respond with NO_INFO_AVAILABLE.`

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await callAIProvider(messages)

  // Check for no info response
  if (response.trim() === 'NO_INFO_AVAILABLE') {
    return null
  }

  // Parse JSON response
  try {
    // Clean up response - remove markdown code blocks if present
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const structured = JSON.parse(jsonStr) as StructuredSummary

    // Generate markdown for backward compatibility
    const markdown = convertToMarkdown(structured)

    return { structured, markdown }
  } catch (parseError) {
    console.error('Failed to parse AI response as JSON:', parseError)
    console.error('Raw response:', response)

    // Fall back to treating the response as markdown
    return {
      structured: {
        companyOverview: response,
        salesTalkingPoints: [],
        businessContext: {},
      },
      markdown: response,
    }
  }
}

/**
 * Convert structured summary to markdown for backward compatibility
 */
function convertToMarkdown(structured: StructuredSummary): string {
  const parts: string[] = []

  if (structured.companyOverview) {
    parts.push(`**COMPANY OVERVIEW**\n${structured.companyOverview}`)
  }

  const ctx = structured.businessContext
  if (ctx && Object.keys(ctx).length > 0) {
    const contextLines: string[] = []
    if (ctx.products && ctx.products.length > 0) {
      parts.push(
        `**KEY PRODUCTS/SERVICES**\n${ctx.products.map((p) => `• ${p}`).join('\n')}`,
      )
    }
    if (ctx.targetCustomers) {
      parts.push(`**TARGET CUSTOMERS**\n• ${ctx.targetCustomers}`)
    }
    if (ctx.founded) contextLines.push(`• Founded: ${ctx.founded}`)
    if (ctx.size) contextLines.push(`• Size: ${ctx.size}`)
    if (ctx.funding) contextLines.push(`• Funding: ${ctx.funding}`)
    if (ctx.recentNews) contextLines.push(`• Recent News: ${ctx.recentNews}`)
    if (contextLines.length > 0) {
      parts.push(`**BUSINESS CONTEXT**\n${contextLines.join('\n')}`)
    }
  }

  if (
    structured.salesTalkingPoints &&
    structured.salesTalkingPoints.length > 0
  ) {
    const talkingPointsFormatted = structured.salesTalkingPoints
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n')
    parts.push(`**SALES TALKING POINTS**\n${talkingPointsFormatted}`)
  }

  return parts.join('\n\n')
}

export interface GenerateCompanySummaryParams {
  leadId: string
  organizationId: string
  forceRegenerate?: boolean
}

export interface GenerateCompanySummaryResult {
  summary: string
  cached: boolean
  noInfoAvailable?: boolean
  structured?: StructuredSummary
  provider?: string
}

/**
 * Generate and cache an AI company summary for a lead
 * Uses web search (Exa.ai or Serper) + lead data for intelligent summaries
 * Caches the result in both structured fields and aiCompanySummary for backward compatibility
 */
/**
 * Extract company name from a website domain using AI
 * Used to auto-fill missing company name when only website is available
 */
export interface ExtractCompanyInfoResult {
  companyName: string | null
  industry?: string | null
  description?: string | null
}

export const extractCompanyInfoFromWebsite = async (
  website: string,
): Promise<ExtractCompanyInfoResult> => {
  if (!OPENROUTER_API_KEY && !OPENAI_API_KEY) {
    return { companyName: null }
  }

  const domain = extractDomain(website)

  try {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a company research assistant. Given a website domain, extract the company name.

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown code blocks):
{
  "companyName": "Official company name",
  "industry": "Industry/sector or null",
  "description": "One sentence description or null"
}

RULES:
1. Extract the OFFICIAL company name as it appears on their website
2. Do NOT just format the domain name - find the actual company name
3. If you cannot determine the company name with confidence, return {"companyName": null}
4. Be precise - "Telhio Credit Union" not just "Telhio"`,
      },
      {
        role: 'user',
        content: `What is the company name for the website: ${domain}`,
      },
    ]

    // Use perplexity/sonar for web research capability if available via OpenRouter
    let response: string
    if (OPENROUTER_API_KEY) {
      const apiResponse = await fetch(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://omnidial.io',
            'X-Title': 'OmniDial',
          },
          body: JSON.stringify({
            model: 'perplexity/sonar',
            messages,
            max_tokens: 200,
            temperature: 0.1,
          }),
        },
      )

      if (!apiResponse.ok) {
        console.error('Failed to extract company info:', apiResponse.status)
        return { companyName: null }
      }

      const data = (await apiResponse.json()) as AIResponse
      response = data.choices?.[0]?.message?.content?.trim() || ''
    } else {
      response = await callOpenAI(messages)
    }

    // Parse the JSON response
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7)
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3)
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3)
    jsonStr = jsonStr.trim()

    const result = JSON.parse(jsonStr) as ExtractCompanyInfoResult
    return result
  } catch (error) {
    console.error('Error extracting company info:', error)
    return { companyName: null }
  }
}

/**
 * Auto-enrich a lead with missing company info from their website
 * Returns the extracted info and optionally updates the lead
 */
export interface EnrichLeadFromWebsiteParams {
  leadId: string
  organizationId: string
  autoUpdate?: boolean // If true, automatically update the lead record
}

export interface EnrichLeadFromWebsiteResult {
  extracted: ExtractCompanyInfoResult
  updated: boolean
  lead?: {
    company: string | null
  }
}

export const enrichLeadFromWebsite = async (
  params: EnrichLeadFromWebsiteParams,
): Promise<EnrichLeadFromWebsiteResult> => {
  const { leadId, organizationId, autoUpdate = false } = params

  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Only enrich if website exists and company is missing
  if (!lead.website) {
    return {
      extracted: { companyName: null },
      updated: false,
    }
  }

  // If company already exists, return it
  if (lead.company) {
    return {
      extracted: { companyName: lead.company },
      updated: false,
      lead: { company: lead.company },
    }
  }

  // Extract company info from website
  const extracted = await extractCompanyInfoFromWebsite(lead.website)

  if (!extracted.companyName) {
    return {
      extracted,
      updated: false,
    }
  }

  // Optionally auto-update the lead
  if (autoUpdate) {
    const { db } = await import('@/lib/db')
    await db
      .updateTable('lead')
      .set({
        company: extracted.companyName,
        updatedAt: new Date(),
      })
      .where('id', '=', leadId)
      .where('organizationId', '=', organizationId)
      .execute()

    return {
      extracted,
      updated: true,
      lead: { company: extracted.companyName },
    }
  }

  return {
    extracted,
    updated: false,
  }
}

export const generateCompanySummary = async (
  params: GenerateCompanySummaryParams,
): Promise<GenerateCompanySummaryResult> => {
  const { leadId, organizationId, forceRegenerate = false } = params

  // Get the lead
  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Return cached summary if available and not forcing regeneration
  if (lead.aiCompanySummary && !forceRegenerate) {
    const isNoInfo = lead.aiCompanySummary === 'NO_INFO_AVAILABLE'

    // Return structured data if available
    const structured: StructuredSummary | undefined = lead.aiCompanyOverview
      ? {
          companyOverview: lead.aiCompanyOverview,
          salesTalkingPoints: (lead.aiSalesTalkingPoints as string[]) || [],
          businessContext:
            (lead.aiBusinessContext as StructuredSummary['businessContext']) ||
            {},
        }
      : undefined

    return {
      summary: lead.aiCompanySummary,
      cached: true,
      noInfoAvailable: isNoInfo,
      structured,
      provider: lead.aiSummaryProvider || undefined,
    }
  }

  // REQUIRE a website/domain for company research
  // We focus on the company domain, not the person's name
  if (!lead.website) {
    return {
      summary: 'NO_INFO_AVAILABLE',
      cached: false,
      noInfoAvailable: true,
      structured: undefined,
      provider: AI_SUMMARY_PROVIDER,
    }
  }

  // Get web search context from the company's website/domain
  const webSearchContext = await getWebSearchContext(lead.website, lead.company)

  // Build lead context focused on company, not person
  const leadContext: LeadContext = {
    company: lead.company || extractDomain(lead.website),
    website: lead.website,
    title: lead.title,
    firstName: lead.firstName,
    lastName: lead.lastName,
    // Industry might be in customFields or enrichment data
    industry: (lead.customFields as Record<string, unknown>)?.industry as
      | string
      | undefined,
  }

  // Generate the summary
  const result = await generateStructuredSummary(leadContext, webSearchContext)

  const isNoInfo = result === null
  const summary = isNoInfo ? 'NO_INFO_AVAILABLE' : result.markdown
  const structured = isNoInfo ? undefined : result.structured

  // Cache the summary in the lead record
  const { db } = await import('@/lib/db')

  const updateData: Record<string, unknown> = {
    aiCompanySummary: summary,
    aiSummaryGeneratedAt: new Date(),
    aiSummaryProvider: AI_SUMMARY_PROVIDER,
    updatedAt: new Date(),
  }

  // Store structured data if available
  if (structured) {
    updateData.aiCompanyOverview = structured.companyOverview
    updateData.aiSalesTalkingPoints = JSON.stringify(
      structured.salesTalkingPoints,
    )
    updateData.aiBusinessContext = JSON.stringify(structured.businessContext)
  }

  await db
    .updateTable('lead')
    .set(updateData)
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .execute()

  return {
    summary,
    cached: false,
    noInfoAvailable: isNoInfo,
    structured,
    provider: AI_SUMMARY_PROVIDER,
  }
}
