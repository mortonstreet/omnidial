import * as intelligenceRepo from '@/repositories/callIntelligence.repository'
import { getOrCreateTranscript } from '@/services/salesCoach.service'
import { db } from '@/lib/db'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// Minimum call duration for intelligence extraction (30 seconds)
const MIN_INTEL_DURATION_SECONDS = 30

// Dispositions that indicate a non-conversation
const EXCLUDED_DISPOSITION_LABELS = [
  'no answer',
  'voicemail',
  'busy',
  'wrong number',
  'disconnected',
  'left voicemail',
]

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    total_tokens: number
  }
}

const INTELLIGENCE_SYSTEM_PROMPT = `You are a B2B Sales Intelligence Analyst. Extract actionable business intelligence from this cold call transcript.

Extract:
1. Decision Maker - name, title, role (decision_maker/influencer/gatekeeper/end_user/unknown), notes
2. Current Strategies - what approaches/tools they currently use
3. Pain Points - problems, frustrations, unmet needs expressed or implied
4. Tech Stack - technologies, platforms, software, vendors mentioned
5. Key Talking Points - important topics, interests, hooks for follow-up
6. Summary - 2-3 sentence executive summary of the call and key takeaways

Return valid JSON matching this exact structure:
{
  "decisionMaker": { "name": "<string or null>", "title": "<string or null>", "role": "<decision_maker|influencer|gatekeeper|end_user|unknown>", "notes": "<string or null>" },
  "currentStrategies": ["<strategy 1>", "<strategy 2>"],
  "painPoints": ["<pain point 1>", "<pain point 2>"],
  "techStack": ["<tech 1>", "<tech 2>"],
  "talkingPoints": ["<talking point 1>", "<talking point 2>"],
  "summary": "<2-3 sentence executive summary>"
}

If information is not mentioned or unclear, use empty arrays or null values. Focus on what IS present in the transcript.`

export interface IntelligenceEligibility {
  eligible: boolean
  reason?: string
  hasExisting?: boolean
}

/**
 * Check if a call is eligible for intelligence extraction
 */
export async function checkEligibility(
  callId: string,
  organizationId: string,
): Promise<IntelligenceEligibility> {
  const call = await db
    .selectFrom('call')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .leftJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.id', '=', callId)
    .where('twilio_config.organizationId', '=', organizationId)
    .select([
      'call.id',
      'call.duration',
      'call.status',
      'call.answeredAt',
      'call.recordingUrl',
      'disposition.label as dispositionLabel',
    ])
    .executeTakeFirst()

  if (!call) {
    return { eligible: false, reason: 'Call not found' }
  }

  if (!call.recordingUrl) {
    return { eligible: false, reason: 'No recording available for this call' }
  }

  if ((call.duration || 0) < MIN_INTEL_DURATION_SECONDS) {
    return {
      eligible: false,
      reason: `Call too short. Minimum ${MIN_INTEL_DURATION_SECONDS} seconds required, call was ${call.duration || 0} seconds`,
    }
  }

  if (!call.answeredAt && call.status !== 'completed') {
    return { eligible: false, reason: 'Call was not connected' }
  }

  if (call.dispositionLabel) {
    const normalizedLabel = call.dispositionLabel.toLowerCase().trim()
    if (
      EXCLUDED_DISPOSITION_LABELS.some((excluded) =>
        normalizedLabel.includes(excluded),
      )
    ) {
      return {
        eligible: false,
        reason: `Disposition "${call.dispositionLabel}" indicates no real conversation occurred`,
      }
    }
  }

  // Check if intelligence already exists
  const existing = await intelligenceRepo.findByCallId(callId, organizationId)
  if (existing) {
    return {
      eligible: false,
      reason: 'Intelligence already exists for this call',
      hasExisting: true,
    }
  }

  return { eligible: true }
}

/**
 * Analyze transcript for business intelligence using OpenRouter
 */
async function analyzeForIntelligence(
  transcriptText: string,
  callContext: { duration: number; direction: string },
): Promise<{
  decisionMaker: unknown
  currentStrategies: string[]
  painPoints: string[]
  techStack: string[]
  talkingPoints: string[]
  summary: string
  tokensUsed: number
}> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: INTELLIGENCE_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Analyze this ${callContext.direction} sales call (${Math.round(callContext.duration / 60)} minutes) and extract business intelligence.

TRANSCRIPT:
${transcriptText}

Return your analysis as JSON.`,
    },
  ]

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omnidial.io',
      'X-Title': 'OmniDial Call Intelligence',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenRouter API error:', error)
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = (await response.json()) as OpenRouterResponse

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter')
  }

  const content = data.choices[0].message.content.trim()

  let parsed
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('No JSON found in response')
    }
  } catch {
    console.error('Failed to parse AI response as JSON:', content)
    throw new Error('Failed to parse AI intelligence response')
  }

  return {
    decisionMaker: parsed.decisionMaker || {
      name: null,
      title: null,
      role: 'unknown',
      notes: null,
    },
    currentStrategies: parsed.currentStrategies || [],
    painPoints: parsed.painPoints || [],
    techStack: parsed.techStack || [],
    talkingPoints: parsed.talkingPoints || [],
    summary: parsed.summary || '',
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

/**
 * Generate intelligence for a call - main entry point
 */
export async function generateIntelligence(
  callId: string,
  organizationId: string,
  userId: string,
): Promise<intelligenceRepo.IntelligenceRecord> {
  const startTime = Date.now()

  // Check eligibility
  const eligibility = await checkEligibility(callId, organizationId)
  if (!eligibility.eligible) {
    throw new Error(
      eligibility.reason || 'Call is not eligible for intelligence extraction',
    )
  }

  // Get or create transcript (reused from salesCoach)
  const transcript = await getOrCreateTranscript(callId, organizationId)
  if (!transcript) {
    throw new Error('Could not create transcript for call')
  }

  // Get call details for context
  const call = await db
    .selectFrom('call')
    .leftJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.id', '=', callId)
    .where('twilio_config.organizationId', '=', organizationId)
    .select(['call.duration', 'call.direction', 'call.leadId'])
    .executeTakeFirst()

  if (!call) {
    throw new Error('Call not found')
  }

  // Analyze transcript with AI
  const analysis = await analyzeForIntelligence(transcript.transcriptText, {
    duration: call.duration || 0,
    direction: call.direction,
  })

  const analysisTimeMs = Date.now() - startTime

  // Save intelligence
  const intelligence = await intelligenceRepo.createIntelligence({
    callId,
    transcriptId: transcript.id,
    organizationId,
    userId,
    leadId: call.leadId,
    decisionMaker: analysis.decisionMaker,
    currentStrategies: analysis.currentStrategies,
    painPoints: analysis.painPoints,
    techStack: analysis.techStack,
    talkingPoints: analysis.talkingPoints,
    summary: analysis.summary,
    modelUsed: 'claude-3.5-sonnet',
    tokensUsed: analysis.tokensUsed,
    analysisTimeMs,
  })

  return intelligence
}

/**
 * Get intelligence for a call (if it exists)
 */
export async function getIntelligence(
  callId: string,
  organizationId: string,
): Promise<intelligenceRepo.IntelligenceRecord | null> {
  return intelligenceRepo.findByCallId(callId, organizationId)
}

/**
 * Get intelligence history for a specific lead
 */
export async function getLeadIntelligence(
  leadId: string,
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<intelligenceRepo.IntelligenceWithLead[]> {
  return intelligenceRepo.findByLeadId(leadId, organizationId, options)
}
