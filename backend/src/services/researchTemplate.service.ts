/**
 * Research Template Service
 *
 * Manages research templates including CRUD operations and system templates.
 */

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { ResearchTemplateResponse } from '@shared/types/src/requests/research'

// === Template CRUD ===

export async function createTemplate(
  organizationId: string | null,
  createdById: string,
  data: {
    name: string
    description?: string
    prompt: string
    targetUrls?: string[]
    extractionSchema?: Record<string, unknown>
    fieldMappings?: Record<string, string>
    isSystemTemplate?: boolean
  },
): Promise<ResearchTemplateResponse> {
  const template = await db
    .insertInto('research_template')
    .values({
      id: uuidv4(),
      organizationId: data.isSystemTemplate ? null : organizationId,
      name: data.name,
      description: data.description ?? null,
      prompt: data.prompt,
      targetUrls: data.targetUrls ?? [],
      extractionSchema: JSON.stringify(data.extractionSchema ?? {}),
      fieldMappings: JSON.stringify(data.fieldMappings ?? {}),
      isSystemTemplate: data.isSystemTemplate ?? false,
      isActive: true,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformTemplate(template)
}

export async function updateTemplate(
  templateId: string,
  organizationId: string,
  data: {
    name?: string
    description?: string | null
    prompt?: string
    targetUrls?: string[]
    extractionSchema?: Record<string, unknown>
    fieldMappings?: Record<string, string>
    isActive?: boolean
  },
): Promise<ResearchTemplateResponse> {
  // Verify ownership (can't edit system templates unless you're admin)
  const existing = await db
    .selectFrom('research_template')
    .where('id', '=', templateId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) {
    throw new Error('Template not found')
  }

  if (existing.isSystemTemplate) {
    throw new Error('Cannot edit system templates')
  }

  if (existing.organizationId !== organizationId) {
    throw new Error('Template not found')
  }

  const updateData: any = { updatedAt: new Date() }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.prompt !== undefined) updateData.prompt = data.prompt
  if (data.targetUrls !== undefined) updateData.targetUrls = data.targetUrls
  if (data.extractionSchema !== undefined)
    updateData.extractionSchema = JSON.stringify(data.extractionSchema)
  if (data.fieldMappings !== undefined)
    updateData.fieldMappings = JSON.stringify(data.fieldMappings)
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const updated = await db
    .updateTable('research_template')
    .set(updateData)
    .where('id', '=', templateId)
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformTemplate(updated)
}

export async function deleteTemplate(
  templateId: string,
  organizationId: string,
): Promise<void> {
  const existing = await db
    .selectFrom('research_template')
    .where('id', '=', templateId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) {
    throw new Error('Template not found')
  }

  if (existing.isSystemTemplate) {
    throw new Error('Cannot delete system templates')
  }

  if (existing.organizationId !== organizationId) {
    throw new Error('Template not found')
  }

  await db
    .deleteFrom('research_template')
    .where('id', '=', templateId)
    .execute()
}

export async function listTemplates(
  organizationId: string,
  filters: {
    isActive?: boolean
    includeSystem?: boolean
  },
): Promise<ResearchTemplateResponse[]> {
  let query = db.selectFrom('research_template')

  // Include organization templates and optionally system templates
  if (filters.includeSystem !== false) {
    query = query.where((eb) =>
      eb.or([
        eb('organizationId', '=', organizationId),
        eb('isSystemTemplate', '=', true),
      ]),
    )
  } else {
    query = query.where('organizationId', '=', organizationId)
  }

  if (filters.isActive !== undefined) {
    query = query.where('isActive', '=', filters.isActive)
  }

  const templates = await query
    .selectAll()
    .orderBy('isSystemTemplate', 'desc')
    .orderBy('name', 'asc')
    .execute()

  return templates.map(transformTemplate)
}

export async function getTemplate(
  templateId: string,
  organizationId: string,
): Promise<ResearchTemplateResponse> {
  const template = await db
    .selectFrom('research_template')
    .where('id', '=', templateId)
    .where((eb) =>
      eb.or([
        eb('organizationId', '=', organizationId),
        eb('isSystemTemplate', '=', true),
      ]),
    )
    .selectAll()
    .executeTakeFirst()

  if (!template) {
    throw new Error('Template not found')
  }

  return transformTemplate(template)
}

// === System Templates ===

export const SYSTEM_TEMPLATES = [
  {
    name: 'Company Funding Research',
    description:
      'Research funding history, investors, and financial information',
    prompt:
      'Extract information about company funding, including funding rounds, total funding amount, notable investors, and valuation if available.',
    targetUrls: [
      'https://www.crunchbase.com/organization/{company}',
      '{company_website}/about',
    ],
    extractionSchema: {
      total_funding: {
        description: 'Total funding amount raised',
        type: 'string',
      },
      last_round: {
        description: 'Most recent funding round type and amount',
        type: 'string',
      },
      investors: {
        description: 'List of notable investors',
        type: 'array',
      },
      valuation: {
        description: 'Company valuation if publicly known',
        type: 'string',
      },
      funding_date: {
        description: 'Date of most recent funding',
        type: 'string',
      },
    },
    fieldMappings: {
      total_funding: 'funding_total',
      last_round: 'funding_last_round',
      investors: 'funding_investors',
      valuation: 'company_valuation',
    },
  },
  {
    name: 'Technology Stack Research',
    description: 'Discover the technology stack used by the company',
    prompt:
      'Identify the technologies, tools, and platforms used by this company including programming languages, frameworks, cloud providers, and major tools.',
    targetUrls: ['https://builtwith.com/{company}', '{company_website}'],
    extractionSchema: {
      technologies: {
        description: 'List of technologies used',
        type: 'array',
      },
      cloud_provider: {
        description: 'Primary cloud provider (AWS, GCP, Azure, etc.)',
        type: 'string',
      },
      tech_stack_summary: {
        description: 'Summary of the tech stack',
        type: 'string',
      },
    },
    fieldMappings: {
      technologies: 'tech_stack',
      cloud_provider: 'cloud_provider',
      tech_stack_summary: 'tech_summary',
    },
  },
  {
    name: 'Company News & Updates',
    description: 'Find recent news, press releases, and company updates',
    prompt:
      'Find recent news articles, press releases, product launches, and significant company announcements from the past 6 months.',
    targetUrls: [
      'https://news.google.com/search?q={company}',
      '{company_website}/blog',
      '{company_website}/news',
    ],
    extractionSchema: {
      recent_news: {
        description: 'List of recent news headlines',
        type: 'array',
      },
      product_launches: {
        description: 'Recent product announcements',
        type: 'array',
      },
      company_milestones: {
        description: 'Recent milestones or achievements',
        type: 'array',
      },
    },
    fieldMappings: {
      recent_news: 'recent_news',
      product_launches: 'product_updates',
      company_milestones: 'milestones',
    },
  },
  {
    name: 'Competitor Analysis',
    description: 'Research competitive landscape and market position',
    prompt:
      'Identify key competitors, market position, and competitive advantages of this company.',
    targetUrls: [
      'https://www.g2.com/products/{company}/competitors/alternatives',
      '{company_website}',
    ],
    extractionSchema: {
      competitors: {
        description: 'List of main competitors',
        type: 'array',
      },
      market_position: {
        description: 'Market position or ranking',
        type: 'string',
      },
      competitive_advantages: {
        description: 'Key differentiators',
        type: 'array',
      },
    },
    fieldMappings: {
      competitors: 'competitors',
      market_position: 'market_position',
      competitive_advantages: 'differentiators',
    },
  },
  {
    name: 'Contact Verification',
    description: 'Verify and enhance contact information',
    prompt:
      "Verify the person's current role, company, and gather additional professional information.",
    targetUrls: [
      '{linkedin_url}',
      '{company_website}/team',
      '{company_website}/about',
    ],
    extractionSchema: {
      current_title: {
        description: 'Current job title',
        type: 'string',
      },
      current_company: {
        description: 'Current employer',
        type: 'string',
      },
      tenure: {
        description: 'How long in current role',
        type: 'string',
      },
      previous_companies: {
        description: 'Previous employers',
        type: 'array',
      },
    },
    fieldMappings: {
      current_title: 'verified_title',
      current_company: 'verified_company',
      tenure: 'role_tenure',
    },
  },
]

export async function seedSystemTemplates(): Promise<number> {
  let created = 0

  for (const template of SYSTEM_TEMPLATES) {
    // Check if already exists
    const existing = await db
      .selectFrom('research_template')
      .where('name', '=', template.name)
      .where('isSystemTemplate', '=', true)
      .selectAll()
      .executeTakeFirst()

    if (!existing) {
      await db
        .insertInto('research_template')
        .values({
          id: uuidv4(),
          organizationId: null,
          name: template.name,
          description: template.description,
          prompt: template.prompt,
          targetUrls: template.targetUrls,
          extractionSchema: JSON.stringify(template.extractionSchema),
          fieldMappings: JSON.stringify(template.fieldMappings),
          isSystemTemplate: true,
          isActive: true,
          createdById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute()
      created++
    }
  }

  return created
}

// === Helper Functions ===

function transformTemplate(template: any): ResearchTemplateResponse {
  let extractionSchema = {}
  let fieldMappings = {}

  try {
    extractionSchema =
      typeof template.extractionSchema === 'string'
        ? JSON.parse(template.extractionSchema)
        : (template.extractionSchema ?? {})
  } catch {
    extractionSchema = {}
  }

  try {
    fieldMappings =
      typeof template.fieldMappings === 'string'
        ? JSON.parse(template.fieldMappings)
        : (template.fieldMappings ?? {})
  } catch {
    fieldMappings = {}
  }

  return {
    id: template.id,
    organizationId: template.organizationId,
    name: template.name,
    description: template.description,
    prompt: template.prompt,
    targetUrls: template.targetUrls ?? [],
    extractionSchema,
    fieldMappings,
    isSystemTemplate: template.isSystemTemplate,
    isActive: template.isActive,
    createdById: template.createdById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}
