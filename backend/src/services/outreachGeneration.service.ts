/**
 * Outreach Generation Service
 * Generates personalized email and SMS content for leads
 */

import { GroqClient, createGroqClient } from '@/clients/groq.client'

export interface EmailContent {
  subject: string
  body: string
}

export interface OutreachContent {
  email: EmailContent | null
  sms: string | null
}

export interface OutreachTemplate {
  name: string
  type: 'email' | 'sms' | 'both'
  emailSubjectTemplate?: string
  emailBodyTemplate?: string
  smsTemplate?: string
  variables: string[]
}

let groqClient: GroqClient | null = null

function getGroqClient(): GroqClient {
  if (!groqClient) {
    groqClient = createGroqClient()
  }
  return groqClient
}

/**
 * Generate personalized email content
 */
export async function generateEmail(
  lead: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    title?: string | null
  },
  context: {
    companyInfo?: string
    valueProposition: string
    callToAction?: string
    senderName?: string
    senderTitle?: string
  },
  options?: {
    tone?: 'professional' | 'casual' | 'direct'
    maxWords?: number
  },
): Promise<EmailContent> {
  const client = getGroqClient()

  const result = await client.generateEmail(
    {
      firstName: lead.firstName || undefined,
      lastName: lead.lastName || undefined,
      company: lead.company || undefined,
      title: lead.title || undefined,
    },
    context.companyInfo || `${lead.company || 'their company'}`,
    context.valueProposition,
    options?.tone || 'professional',
  )

  return {
    subject: result.subject,
    body: result.body,
  }
}

/**
 * Generate personalized SMS content
 */
export async function generateSms(
  lead: {
    firstName?: string | null
    company?: string | null
  },
  context: {
    purpose: string
    callToAction?: string
  },
  options?: {
    maxChars?: number
  },
): Promise<string> {
  const client = getGroqClient()

  const result = await client.generateSms(
    {
      firstName: lead.firstName || undefined,
      company: lead.company || undefined,
    },
    `${context.purpose}${context.callToAction ? `. CTA: ${context.callToAction}` : ''}`,
    options?.maxChars || 160,
  )

  return result.message
}

/**
 * Generate both email and SMS content
 */
export async function generateOutreach(
  lead: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    title?: string | null
  },
  context: {
    companyInfo?: string
    valueProposition: string
    callToAction?: string
    senderName?: string
    senderTitle?: string
  },
  options?: {
    includeEmail?: boolean
    includeSms?: boolean
    emailTone?: 'professional' | 'casual' | 'direct'
  },
): Promise<OutreachContent> {
  const result: OutreachContent = { email: null, sms: null }
  const tasks: Promise<void>[] = []

  if (options?.includeEmail !== false) {
    tasks.push(
      generateEmail(lead, context, { tone: options?.emailTone })
        .then((email) => {
          result.email = email
        })
        .catch((error) => {
          console.error('Email generation failed:', error)
        }),
    )
  }

  if (options?.includeSms === true) {
    tasks.push(
      generateSms(lead, {
        purpose: context.valueProposition,
        callToAction: context.callToAction,
      })
        .then((sms) => {
          result.sms = sms
        })
        .catch((error) => {
          console.error('SMS generation failed:', error)
        }),
    )
  }

  await Promise.all(tasks)
  return result
}

/**
 * Generate follow-up email based on previous outreach
 */
export async function generateFollowUp(
  lead: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    title?: string | null
  },
  previousOutreach: {
    subject: string
    body: string
    sentAt: Date
  },
  context: {
    valueProposition: string
    daysSinceLast: number
  },
): Promise<EmailContent> {
  const client = getGroqClient()

  const systemPrompt = `You are an expert sales copywriter writing follow-up emails.
The recipient was sent an email ${context.daysSinceLast} days ago.
Write a brief, friendly follow-up that:
- References the previous email naturally
- Provides additional value or a new angle
- Has a clear but soft CTA
- Is under 100 words

Return JSON with:
- subject: follow-up subject line
- body: email body text`

  const prompt = `Write a follow-up email for:

RECIPIENT:
- Name: ${lead.firstName} ${lead.lastName || ''}
- Title: ${lead.title || 'Unknown'}
- Company: ${lead.company || 'Unknown'}

PREVIOUS EMAIL:
Subject: ${previousOutreach.subject}
Body: ${previousOutreach.body.slice(0, 300)}...

VALUE PROPOSITION:
${context.valueProposition}

Return JSON only.`

  const response = await client.complete(prompt, {
    model: 'llama-3.3-70b-versatile',
    systemPrompt,
    temperature: 0.7,
    maxTokens: 512,
    jsonMode: true,
  })

  const parsed = JSON.parse(response.content)

  return {
    subject: parsed.subject,
    body: parsed.body,
  }
}

/**
 * Generate a response to an inbound message (for SMS AI agent)
 */
export async function generateSmsResponse(
  lead: {
    firstName?: string | null
    company?: string | null
  },
  conversation: Array<{
    role: 'lead' | 'agent'
    content: string
    timestamp: Date
  }>,
  context: {
    agentSystemPrompt: string
    valueProposition: string
    maxChars?: number
  },
): Promise<string> {
  const client = getGroqClient()

  // Build conversation context
  const conversationText = conversation
    .map((msg) => `${msg.role === 'lead' ? 'Lead' : 'Agent'}: ${msg.content}`)
    .join('\n')

  const systemPrompt = `You are an AI sales assistant responding to SMS messages.
${context.agentSystemPrompt}

Keep responses:
- Under ${context.maxChars || 160} characters
- Conversational but professional
- Helpful and engaging
- Move toward scheduling a call when appropriate

Your value proposition: ${context.valueProposition}`

  const prompt = `Conversation with ${lead.firstName || 'the lead'} from ${lead.company || 'their company'}:

${conversationText}

Lead's latest message: ${conversation[conversation.length - 1]?.content || ''}

Respond as the AI agent. Return only the response text, no JSON.`

  const response = await client.complete(prompt, {
    model: 'llama-3.1-8b-instant', // Fast model for real-time responses
    systemPrompt,
    temperature: 0.8,
    maxTokens: 100,
  })

  // Ensure response fits SMS character limit
  return response.content.slice(0, context.maxChars || 160)
}

/**
 * Apply a template with variable substitution
 */
export function applyTemplate(
  template: string,
  variables: Record<string, string | undefined | null>,
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value || '')
  }

  // Clean up any remaining template variables
  result = result.replace(/\{\{[^}]+\}\}/g, '')

  return result.trim()
}

/**
 * Parse template to extract required variables
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []

  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
}
