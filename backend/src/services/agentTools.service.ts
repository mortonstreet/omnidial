/**
 * Agent Tools Service
 * Implements OmniDial tools for OpenClaw agents
 *
 * These tools allow agents to:
 * - Search and retrieve lead data
 * - Qualify and score leads
 * - Research companies via Exa.ai
 * - Draft and send emails
 * - Schedule follow-ups
 * - Log activities
 */

import { db } from '@/lib/db'
import { exaClient } from '@/clients/exa.client'
import { groqClient } from '@/clients/groq.client'
import * as leadQualificationRepo from '@/repositories/leadQualification.repository'
import * as agentMessageRepo from '@/repositories/agentMessage.repository'

// Types

export interface ToolContext {
  organizationId: string
  agentId: string
  sessionId: string
  userId?: string
}

export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Lead Search & Retrieval Tools
// ============================================

/**
 * Search leads in the organization
 */
export async function searchLeads(
  context: ToolContext,
  input: {
    query?: string
    filters?: {
      company?: string
      title?: string
    }
    limit?: number
    offset?: number
  },
): Promise<ToolResult<{ leads: unknown[]; total: number }>> {
  try {
    let query = db
      .selectFrom('lead')
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)

    // Apply filters
    if (input.filters?.company) {
      query = query.where('company', 'ilike', `%${input.filters.company}%`)
    }
    if (input.filters?.title) {
      query = query.where('title', 'ilike', `%${input.filters.title}%`)
    }

    // Text search if query provided
    if (input.query) {
      query = query.where((eb) =>
        eb.or([
          eb('firstName', 'ilike', `%${input.query}%`),
          eb('lastName', 'ilike', `%${input.query}%`),
          eb('email', 'ilike', `%${input.query}%`),
          eb('company', 'ilike', `%${input.query}%`),
        ]),
      )
    }

    const totalResult = await db
      .selectFrom('lead')
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst()

    const leads = await query
      .selectAll()
      .orderBy('createdAt', 'desc')
      .limit(input.limit ?? 10)
      .offset(input.offset ?? 0)
      .execute()

    return {
      success: true,
      data: {
        leads,
        total: Number(totalResult?.count ?? 0),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    }
  }
}

/**
 * Get detailed information about a specific lead
 */
export async function getLeadDetails(
  context: ToolContext,
  input: { leadId: string },
): Promise<ToolResult<unknown>> {
  try {
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .selectAll()
      .executeTakeFirst()

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    // Get related data
    const [notes, qualifications] = await Promise.all([
      db
        .selectFrom('note')
        .where('leadId', '=', input.leadId)
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(5)
        .execute(),
      db
        .selectFrom('lead_qualification')
        .where('leadId', '=', input.leadId)
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(3)
        .execute(),
    ])

    return {
      success: true,
      data: {
        ...lead,
        recentNotes: notes,
        previousQualifications: qualifications,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get lead',
    }
  }
}

/**
 * Get SMS/email conversation history with a lead
 */
export async function getConversationHistory(
  context: ToolContext,
  input: { leadId: string; type?: 'email' | 'sms'; limit?: number },
): Promise<ToolResult<{ messages: unknown[] }>> {
  try {
    let query = db
      .selectFrom('agent_message')
      .where('leadId', '=', input.leadId)
      .where('agentId', '=', context.agentId)

    if (input.type) {
      query = query.where('messageType', '=', input.type)
    }

    const messages = await query
      .selectAll()
      .orderBy('createdAt', 'desc')
      .limit(input.limit ?? 20)
      .execute()

    return {
      success: true,
      data: { messages },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history',
    }
  }
}

// ============================================
// Qualification Tools
// ============================================

/**
 * Qualify a lead with score and category
 */
export async function qualifyLead(
  context: ToolContext,
  input: {
    leadId: string
    category: 'high_intent' | 'medium' | 'low_intent' | 'disqualified'
    score: number
    reasoning: string
    companyResearch?: Record<string, unknown>
    intentSignals?: Record<string, unknown>
  },
): Promise<ToolResult<{ qualificationId: string }>> {
  try {
    // Validate score
    if (input.score < 0 || input.score > 100) {
      return { success: false, error: 'Score must be between 0 and 100' }
    }

    // Verify lead exists
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select(['id'])
      .executeTakeFirst()

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    // Create qualification record
    const qualification = await leadQualificationRepo.create({
      organizationId: context.organizationId,
      leadId: input.leadId,
      agentId: context.agentId,
      category: input.category,
      score: input.score,
      reasoning: input.reasoning,
      companyResearch: input.companyResearch || null,
      intentSignals: input.intentSignals || null,
      reviewStatus: 'pending',
    })

    return {
      success: true,
      data: { qualificationId: qualification.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Qualification failed',
    }
  }
}

// ============================================
// Research Tools
// ============================================

/**
 * Research a company using web search
 */
export async function researchCompany(
  context: ToolContext,
  input: {
    companyName: string
    domain?: string
  },
): Promise<ToolResult<Record<string, unknown>>> {
  try {
    const research = await exaClient.researchCompany(
      input.companyName,
      input.domain,
    )

    return {
      success: true,
      data: research,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Research failed',
    }
  }
}

/**
 * Research a person/lead using web search
 */
export async function researchPerson(
  context: ToolContext,
  input: {
    name: string
    company?: string
  },
): Promise<ToolResult<Record<string, unknown>>> {
  try {
    const research = await exaClient.researchPerson(input.name, input.company)

    return {
      success: true,
      data: research,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Research failed',
    }
  }
}

// ============================================
// Outreach Tools
// ============================================

/**
 * Draft a personalized email for a lead
 */
export async function draftEmail(
  context: ToolContext,
  input: {
    leadId: string
    template?: string
    personalization?: Record<string, unknown>
  },
): Promise<ToolResult<{ subject: string; body: string }>> {
  try {
    // Get lead data
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .selectAll()
      .executeTakeFirst()

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    // Get agent config
    const agent = await db
      .selectFrom('agent')
      .where('id', '=', context.agentId)
      .select(['systemPrompt', 'name'])
      .executeTakeFirst()

    // Generate email using Groq
    const prompt = `Generate a personalized sales email for the following lead:

Name: ${lead.firstName} ${lead.lastName}
Company: ${lead.company || 'Unknown'}
Title: ${lead.title || 'Unknown'}
${input.personalization ? `Additional Context: ${JSON.stringify(input.personalization)}` : ''}
${input.template ? `Use this template as a guide: ${input.template}` : ''}

Requirements:
- Keep it concise (3-4 paragraphs max)
- Personalize based on their company and role
- Include a clear call to action
- Professional but friendly tone

Return in this exact JSON format:
{"subject": "email subject line", "body": "email body text"}`

    const response = await groqClient.complete(prompt, {
      systemPrompt:
        agent?.systemPrompt ||
        'You are a professional sales development representative.',
      temperature: 0.7,
      maxTokens: 1000,
    })

    // Parse response
    try {
      const emailData = JSON.parse(response.content)
      return {
        success: true,
        data: {
          subject: emailData.subject,
          body: emailData.body,
        },
      }
    } catch {
      return { success: false, error: 'Failed to parse generated email' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email draft failed',
    }
  }
}

/**
 * Draft an SMS message for a lead
 */
export async function draftSms(
  context: ToolContext,
  input: {
    leadId: string
    purpose?: string
  },
): Promise<ToolResult<{ message: string }>> {
  try {
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select(['firstName', 'company'])
      .executeTakeFirst()

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    const prompt = `Generate a short SMS message for ${lead.firstName} at ${lead.company || 'their company'}.
${input.purpose ? `Purpose: ${input.purpose}` : 'Purpose: Initial outreach'}

Requirements:
- Maximum 160 characters
- Casual but professional
- Include clear next step

Return only the message text, nothing else.`

    const response = await groqClient.complete(prompt, {
      maxTokens: 50,
      temperature: 0.7,
    })

    return {
      success: true,
      data: { message: response.content.slice(0, 160) },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS draft failed',
    }
  }
}

/**
 * Queue email to be sent (requires approval)
 */
export async function queueEmail(
  context: ToolContext,
  input: {
    leadId: string
    subject: string
    body: string
  },
): Promise<ToolResult<{ messageId: string }>> {
  try {
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select(['id', 'email'])
      .executeTakeFirst()

    if (!lead || !lead.email) {
      return { success: false, error: 'Lead not found or has no email' }
    }

    const message = await agentMessageRepo.create({
      agentId: context.agentId,
      leadId: input.leadId,
      messageType: 'email',
      status: 'pending_approval',
      emailSubject: input.subject,
      emailBodyHtml: input.body,
      toEmail: lead.email,
    })

    return {
      success: true,
      data: { messageId: message.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue email',
    }
  }
}

/**
 * Queue SMS to be sent
 */
export async function queueSms(
  context: ToolContext,
  input: {
    leadId: string
    message: string
  },
): Promise<ToolResult<{ messageId: string }>> {
  try {
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select(['id', 'phone', 'normalizedPhone'])
      .executeTakeFirst()

    const phone = lead?.normalizedPhone || lead?.phone
    if (!lead || !phone) {
      return { success: false, error: 'Lead not found or has no phone' }
    }

    const message = await agentMessageRepo.create({
      agentId: context.agentId,
      leadId: input.leadId,
      messageType: 'sms',
      status: 'pending_approval',
      smsBody: input.message,
      toPhone: phone,
    })

    return {
      success: true,
      data: { messageId: message.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue SMS',
    }
  }
}

// ============================================
// Task & Follow-up Tools
// ============================================

/**
 * Schedule a follow-up task
 */
export async function scheduleFollowup(
  context: ToolContext,
  input: {
    leadId: string
    title: string
    scheduledAt: string
  },
): Promise<ToolResult<{ taskId: string }>> {
  try {
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', input.leadId)
      .where('organizationId', '=', context.organizationId)
      .where('deletedAt', 'is', null)
      .select(['id', 'firstName', 'lastName', 'company'])
      .executeTakeFirst()

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    const task = await db
      .insertInto('task')
      .values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        userId: context.userId || context.agentId,
        leadId: input.leadId,
        title: input.title,
        dueAt: new Date(input.scheduledAt),
        createdAt: new Date(),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    return {
      success: true,
      data: { taskId: task.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule',
    }
  }
}

/**
 * Add a note to a lead
 */
export async function addNote(
  context: ToolContext,
  input: {
    leadId: string
    content: string
  },
): Promise<ToolResult<{ noteId: string }>> {
  try {
    const note = await db
      .insertInto('note')
      .values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        userId: context.userId || context.agentId,
        leadId: input.leadId,
        content: input.content,
        createdAt: new Date(),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    return {
      success: true,
      data: { noteId: note.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note',
    }
  }
}

// ============================================
// Additional Tool Implementations
// ============================================

/**
 * Enrich lead with additional data
 */
export async function enrichLead(
  context: ToolContext,
  input: { leadId: string; sources?: string[] },
): Promise<ToolResult> {
  const lead = await db
    .selectFrom('lead')
    .selectAll()
    .where('id', '=', input.leadId)
    .where('organizationId', '=', context.organizationId)
    .executeTakeFirst()

  if (!lead) {
    return { success: false, error: 'Lead not found' }
  }

  // Research company if we have one
  let companyData = null
  if (lead.company) {
    const companyResult = await researchCompany(context, {
      companyName: lead.company,
      domain: lead.website || undefined,
    })
    if (companyResult.success) {
      companyData = companyResult.data
    }
  }

  // Research person
  let personData = null
  const personResult = await researchPerson(context, {
    name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
    company: lead.company || undefined,
  })
  if (personResult.success) {
    personData = personResult.data
  }

  return {
    success: true,
    data: {
      leadId: input.leadId,
      company: companyData,
      person: personData,
      enrichedAt: new Date().toISOString(),
    },
  }
}

/**
 * Update lead data
 */
export async function updateLead(
  context: ToolContext,
  input: { leadId: string; updates: Record<string, unknown> },
): Promise<ToolResult> {
  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'company',
    'title',
    'website',
    'notes',
  ]

  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input.updates)) {
    if (allowedFields.includes(key)) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No valid fields to update' }
  }

  await db
    .updateTable('lead')
    .set({ ...updates, updatedAt: new Date() })
    .where('id', '=', input.leadId)
    .where('organizationId', '=', context.organizationId)
    .execute()

  return {
    success: true,
    data: { leadId: input.leadId, updated: Object.keys(updates) },
  }
}

/**
 * Get email templates
 */
export async function getEmailTemplates(
  context: ToolContext,
  input: { category?: string },
): Promise<ToolResult> {
  // Return default templates for now
  const templates = [
    {
      id: 'intro',
      name: 'Introduction',
      category: 'outreach',
      subject: 'Quick question about {{company}}',
      body: 'Hi {{firstName}},\n\nI noticed...',
    },
    {
      id: 'followup',
      name: 'Follow-up',
      category: 'followup',
      subject: 'Following up',
      body: 'Hi {{firstName}},\n\nJust wanted to follow up...',
    },
  ]

  const filtered = input.category
    ? templates.filter((t) => t.category === input.category)
    : templates

  return { success: true, data: { templates: filtered } }
}

/**
 * Score a lead
 */
export async function scoreLead(
  context: ToolContext,
  input: { leadId: string; criteria?: Record<string, unknown> },
): Promise<ToolResult> {
  const lead = await db
    .selectFrom('lead')
    .selectAll()
    .where('id', '=', input.leadId)
    .where('organizationId', '=', context.organizationId)
    .executeTakeFirst()

  if (!lead) {
    return { success: false, error: 'Lead not found' }
  }

  // Simple scoring based on data completeness and title
  let score = 0

  // Data completeness
  if (lead.email) score += 20
  if (lead.phone) score += 15
  if (lead.company) score += 15
  if (lead.title) score += 10
  if (lead.website) score += 10

  // Title scoring
  const title = (lead.title || '').toLowerCase()
  if (title.includes('ceo') || title.includes('founder')) score += 20
  else if (title.includes('vp') || title.includes('director')) score += 15
  else if (title.includes('manager') || title.includes('head')) score += 10

  // Company size signals (if available in title)
  if (title.includes('enterprise')) score += 10

  return {
    success: true,
    data: {
      leadId: input.leadId,
      score: Math.min(score, 100),
      breakdown: {
        dataCompleteness: Math.min(
          (lead.email ? 20 : 0) +
            (lead.phone ? 15 : 0) +
            (lead.company ? 15 : 0),
          50,
        ),
        titleScore: score > 50 ? score - 50 : 0,
      },
    },
  }
}

/**
 * Get campaign data
 */
export async function getCampaignData(
  context: ToolContext,
  input: { campaignId: string },
): Promise<ToolResult> {
  const campaign = await db
    .selectFrom('campaign')
    .selectAll()
    .where('id', '=', input.campaignId)
    .where('organizationId', '=', context.organizationId)
    .executeTakeFirst()

  if (!campaign) {
    return { success: false, error: 'Campaign not found' }
  }

  return { success: true, data: campaign }
}

/**
 * Get campaign leads
 */
export async function getCampaignLeads(
  context: ToolContext,
  input: { campaignId: string; status?: string; limit?: number },
): Promise<ToolResult> {
  let query = db
    .selectFrom('campaign_lead')
    .innerJoin('lead', 'lead.id', 'campaign_lead.leadId')
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.email',
      'lead.company',
      'lead.title',
      'campaign_lead.status',
      'campaign_lead.createdAt',
    ])
    .where('campaign_lead.campaignId', '=', input.campaignId)

  if (input.status) {
    query = query.where('campaign_lead.status', '=', input.status)
  }

  const leads = await query.limit(input.limit || 50).execute()

  return { success: true, data: { leads, total: leads.length } }
}

/**
 * Get agent stats
 */
export async function getAgentStats(
  context: ToolContext,
  input: { agentId?: string; dateRange?: { start: string; end: string } },
): Promise<ToolResult> {
  // Return mock stats for now
  return {
    success: true,
    data: {
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      avgDurationMs: 0,
      totalTokensUsed: 0,
      estimatedCost: 0,
    },
  }
}

/**
 * Create a campaign
 */
export async function createCampaign(
  context: ToolContext,
  input: { name: string; type: string },
): Promise<ToolResult> {
  const campaign = await db
    .insertInto('campaign')
    .values({
      id: crypto.randomUUID(),
      organizationId: context.organizationId,
      createdById: context.userId || context.agentId,
      name: input.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return { success: true, data: { campaignId: campaign.id } }
}

/**
 * Add leads to a campaign
 */
export async function addLeadsToCampaign(
  context: ToolContext,
  input: { campaignId: string; leadIds: string[] },
): Promise<ToolResult> {
  const values = input.leadIds.map((leadId) => ({
    id: crypto.randomUUID(),
    campaignId: input.campaignId,
    leadId,
    status: 'pending',
    addedAt: new Date(),
  }))

  await db.insertInto('campaign_lead').values(values).execute()

  return { success: true, data: { added: input.leadIds.length } }
}

/**
 * Log an activity
 */
export async function logActivity(
  context: ToolContext,
  input: {
    activityType: string
    description: string
    leadId?: string
    campaignId?: string
    metadata?: Record<string, unknown>
  },
): Promise<ToolResult> {
  // Log to console for now - could be stored in activity_log table
  console.log('[AgentActivity]', {
    organizationId: context.organizationId,
    agentId: context.agentId,
    ...input,
    timestamp: new Date().toISOString(),
  })

  return { success: true, data: { logged: true } }
}

// ============================================
// Tool Registry
// ============================================

type ToolHandler = (context: ToolContext, input: unknown) => Promise<ToolResult>

export const toolHandlers: Record<string, ToolHandler> = {
  // Lead tools
  search_leads: searchLeads as ToolHandler,
  searchLeads: searchLeads as ToolHandler,
  get_lead_data: getLeadDetails as ToolHandler,
  getLeadDetails: getLeadDetails as ToolHandler,
  update_lead_data: updateLead as ToolHandler,
  updateLead: updateLead as ToolHandler,
  get_conversation_history: getConversationHistory as ToolHandler,
  getConversationHistory: getConversationHistory as ToolHandler,

  // Qualification tools
  qualify_lead: qualifyLead as ToolHandler,
  qualifyLead: qualifyLead as ToolHandler,
  save_qualification: qualifyLead as ToolHandler,
  score_lead: scoreLead as ToolHandler,
  scoreLead: scoreLead as ToolHandler,

  // Research tools
  research_company: researchCompany as ToolHandler,
  researchCompany: researchCompany as ToolHandler,
  research_person: researchPerson as ToolHandler,
  researchPerson: researchPerson as ToolHandler,
  enrich_lead: enrichLead as ToolHandler,
  enrichLead: enrichLead as ToolHandler,

  // Email tools
  compose_email: draftEmail as ToolHandler,
  draftEmail: draftEmail as ToolHandler,
  send_email: queueEmail as ToolHandler,
  queueEmail: queueEmail as ToolHandler,
  get_email_templates: getEmailTemplates as ToolHandler,
  getEmailTemplates: getEmailTemplates as ToolHandler,

  // SMS tools
  compose_sms: draftSms as ToolHandler,
  draftSms: draftSms as ToolHandler,
  send_sms: queueSms as ToolHandler,
  queueSms: queueSms as ToolHandler,

  // Task tools
  schedule_followup: scheduleFollowup as ToolHandler,
  scheduleFollowup: scheduleFollowup as ToolHandler,
  add_note: addNote as ToolHandler,
  addNote: addNote as ToolHandler,

  // Campaign tools
  get_campaign_data: getCampaignData as ToolHandler,
  getCampaignData: getCampaignData as ToolHandler,
  get_campaign_leads: getCampaignLeads as ToolHandler,
  getCampaignLeads: getCampaignLeads as ToolHandler,
  create_campaign: createCampaign as ToolHandler,
  createCampaign: createCampaign as ToolHandler,
  add_leads_to_campaign: addLeadsToCampaign as ToolHandler,
  addLeadsToCampaign: addLeadsToCampaign as ToolHandler,

  // Analytics tools
  get_agent_stats: getAgentStats as ToolHandler,
  getAgentStats: getAgentStats as ToolHandler,

  // Activity tools
  log_activity: logActivity as ToolHandler,
  logActivity: logActivity as ToolHandler,
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  context: ToolContext,
  input: unknown,
): Promise<ToolResult> {
  const handler = toolHandlers[toolName]
  if (!handler) {
    return { success: false, error: `Unknown tool: ${toolName}` }
  }

  try {
    return await handler(context, input)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    }
  }
}
