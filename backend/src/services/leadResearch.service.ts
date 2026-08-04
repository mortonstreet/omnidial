/**
 * Lead Research Service
 * Performs company and person research using Exa.ai
 */

import { ExaClient, createExaClient } from '@/clients/exa.client'

export interface CompanyResearchResult {
  summary: string
  website: string | null
  techStack: string[]
  recentNews: string[]
  funding: {
    amount: string | null
    stage: string | null
    date: string | null
  } | null
  employees: string | null
  industry: string | null
  raw: Record<string, unknown>
}

export interface PersonResearchResult {
  linkedInSummary: string | null
  recentActivity: string[]
  authoredContent: string[]
  raw: Record<string, unknown>
}

let exaClient: ExaClient | null = null

function getExaClient(): ExaClient {
  if (!exaClient) {
    exaClient = createExaClient()
  }
  return exaClient
}

/**
 * Research a company and return structured data
 */
export async function researchCompany(
  companyName: string,
  domain?: string,
): Promise<CompanyResearchResult> {
  const client = getExaClient()

  try {
    const research = await client.researchCompany(companyName, domain)

    // Extract summary from company info
    const summary =
      research.companyInfo[0]?.summary ||
      research.companyInfo[0]?.text?.slice(0, 500) ||
      'No company information found'

    // Extract website
    const website =
      research.companyInfo.find((r) =>
        r.url
          .toLowerCase()
          .includes(companyName.toLowerCase().replace(/\s+/g, '')),
      )?.url || null

    // Extract tech stack from tech results
    const techStack: string[] = []
    for (const result of research.techStack) {
      if (result.text) {
        // Try to extract technology names from the text
        const techMatches = result.text.match(
          /(?:using|uses|built with|powered by)\s+([A-Za-z0-9\s,]+)/gi,
        )
        if (techMatches) {
          techStack.push(
            ...techMatches.map((m) =>
              m.replace(/^(using|uses|built with|powered by)\s+/i, ''),
            ),
          )
        }
      }
    }

    // Extract recent news
    const recentNews = research.news
      .filter((n) => n.title)
      .map((n) => n.title)
      .slice(0, 5)

    // Extract funding info
    let funding: CompanyResearchResult['funding'] = null
    for (const result of research.funding) {
      if (result.text) {
        const amountMatch = result.text.match(/\$[\d.]+[MBK]?/i)
        const stageMatch = result.text.match(/Series [A-Z]|Seed|Pre-Seed|IPO/i)
        if (amountMatch || stageMatch) {
          funding = {
            amount: amountMatch?.[0] || null,
            stage: stageMatch?.[0] || null,
            date: result.publishedDate || null,
          }
          break
        }
      }
    }

    return {
      summary,
      website,
      techStack: [...new Set(techStack)].slice(0, 10),
      recentNews,
      funding,
      employees: null, // Would need specific extraction
      industry: null, // Would need specific extraction
      raw: {
        companyInfo: research.companyInfo,
        news: research.news,
        funding: research.funding,
        techStack: research.techStack,
      },
    }
  } catch (error) {
    console.error('Company research failed:', error)
    return {
      summary: 'Research failed',
      website: null,
      techStack: [],
      recentNews: [],
      funding: null,
      employees: null,
      industry: null,
      raw: { error: error instanceof Error ? error.message : 'Unknown error' },
    }
  }
}

/**
 * Research a person and return structured data
 */
export async function researchPerson(
  personName: string,
  companyName?: string,
): Promise<PersonResearchResult> {
  const client = getExaClient()

  try {
    const research = await client.researchPerson(personName, companyName)

    // Extract LinkedIn summary
    const linkedInResult = research.linkedIn[0]
    const linkedInSummary = linkedInResult?.text?.slice(0, 1000) || null

    // Extract recent activity from mentions
    const recentActivity = research.mentions
      .filter((m) => m.title)
      .map((m) => m.title)
      .slice(0, 5)

    // Extract authored content
    const authoredContent = research.articles
      .filter((a) => a.title)
      .map((a) => a.title)
      .slice(0, 5)

    return {
      linkedInSummary,
      recentActivity,
      authoredContent,
      raw: {
        linkedIn: research.linkedIn,
        mentions: research.mentions,
        articles: research.articles,
      },
    }
  } catch (error) {
    console.error('Person research failed:', error)
    return {
      linkedInSummary: null,
      recentActivity: [],
      authoredContent: [],
      raw: { error: error instanceof Error ? error.message : 'Unknown error' },
    }
  }
}

/**
 * Quick company lookup for fast qualification
 */
export async function quickCompanyLookup(
  companyName: string,
): Promise<{ summary: string; website: string | null }> {
  const client = getExaClient()

  try {
    const result = await client.quickCompanyLookup(companyName)
    return {
      summary: result.summary,
      website: result.website || null,
    }
  } catch (error) {
    return {
      summary: 'Lookup failed',
      website: null,
    }
  }
}

/**
 * Perform full lead research combining person and company data
 */
export async function researchLead(lead: {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  linkedInUrl?: string | null
  website?: string | null
}): Promise<{
  companyResearch: CompanyResearchResult | null
  personResearch: PersonResearchResult | null
  researchSummary: string
}> {
  const tasks: Promise<unknown>[] = []

  // Research company if available
  let companyResearchPromise: Promise<CompanyResearchResult> | null = null
  if (lead.company) {
    const domain = lead.website
      ? new URL(lead.website).hostname.replace('www.', '')
      : undefined
    companyResearchPromise = researchCompany(lead.company, domain)
    tasks.push(companyResearchPromise)
  }

  // Research person if name available
  let personResearchPromise: Promise<PersonResearchResult> | null = null
  if (lead.firstName || lead.lastName) {
    const personName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
    personResearchPromise = researchPerson(
      personName,
      lead.company || undefined,
    )
    tasks.push(personResearchPromise)
  }

  // Wait for all research to complete
  await Promise.allSettled(tasks)

  const companyResearch = companyResearchPromise
    ? await companyResearchPromise.catch(() => null)
    : null
  const personResearch = personResearchPromise
    ? await personResearchPromise.catch(() => null)
    : null

  // Build research summary
  const summaryParts: string[] = []
  if (companyResearch) {
    summaryParts.push(`Company: ${companyResearch.summary}`)
    if (companyResearch.techStack.length > 0) {
      summaryParts.push(`Tech Stack: ${companyResearch.techStack.join(', ')}`)
    }
    if (companyResearch.funding) {
      summaryParts.push(
        `Funding: ${companyResearch.funding.amount || 'Unknown amount'} (${companyResearch.funding.stage || 'Unknown stage'})`,
      )
    }
  }
  if (personResearch?.linkedInSummary) {
    summaryParts.push(
      `Person: ${personResearch.linkedInSummary.slice(0, 200)}...`,
    )
  }

  return {
    companyResearch,
    personResearch,
    researchSummary: summaryParts.join('\n\n') || 'No research data available',
  }
}
