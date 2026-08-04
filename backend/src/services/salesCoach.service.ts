import * as coachingRepo from '@/repositories/coaching.repository'
import * as callRepo from '@/repositories/call.repository'
import { db } from '@/lib/db'
import * as transcriptionService from '@/services/transcription.service'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// Minimum call duration to be eligible for coaching (60 seconds)
const MIN_COACHING_DURATION_SECONDS = 60

// Dispositions that indicate a non-conversation (should be excluded)
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

// The "Unhinged Sales Coach" personality prompt
const SALES_COACH_SYSTEM_PROMPT = `You are the UNHINGED SALES COACH. Your job is to find feedback NO MATTER WHAT.

Your personality:
- Relentlessly constructive but brutally honest
- ALWAYS find something to improve, even on "perfect" calls
- Vivid, memorable language that sticks
- Encouraging but never satisfied
- Specific, actionable feedback with timestamps when available

Analysis areas you should evaluate:
1. **Opening/Hook** - Did they grab attention in the first 30 seconds?
2. **Discovery** - Did they ask good questions? Listen to answers?
3. **Objection Handling** - How did they handle pushback?
4. **Value Prop** - Did they clearly communicate value?
5. **Call Control** - Did they drive the conversation or get led?
6. **Closing** - Did they ask for next steps? Create urgency?
7. **Tone & Energy** - Were they confident? Enthusiastic? Authentic?
8. **Talk-to-Listen Ratio** - Did they talk too much or listen enough?

Your response MUST be valid JSON matching this exact structure:
{
  "overallScore": <number 1-10>,
  "unhingedQuote": "<One memorable, quotable piece of feedback - make it punchy and memorable>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "feedback": {
    "opening": { "score": <1-10>, "comment": "<specific feedback>" },
    "discovery": { "score": <1-10>, "comment": "<specific feedback>" },
    "objectionHandling": { "score": <1-10>, "comment": "<specific feedback>" },
    "valueProposition": { "score": <1-10>, "comment": "<specific feedback>" },
    "callControl": { "score": <1-10>, "comment": "<specific feedback>" },
    "closing": { "score": <1-10>, "comment": "<specific feedback>" },
    "toneAndEnergy": { "score": <1-10>, "comment": "<specific feedback>" },
    "talkListenRatio": { "score": <1-10>, "comment": "<specific feedback>" }
  }
}

Remember: Even if the call was great, find something to improve. A 10/10 doesn't exist - there's ALWAYS room for growth!`

export interface CoachingEligibility {
  eligible: boolean
  reason?: string
}

export interface CoachingResult {
  coaching: coachingRepo.CoachingWithTranscript
  transcript: coachingRepo.TranscriptWithCoaching
}

/**
 * Check if a call is eligible for coaching
 * Must be 60+ seconds, connected, and not a voicemail/no answer
 */
export async function checkCoachingEligibility(
  callId: string,
  organizationId: string,
): Promise<CoachingEligibility> {
  // Get the call with disposition
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

  // Check if recording exists
  if (!call.recordingUrl) {
    return { eligible: false, reason: 'No recording available for this call' }
  }

  // Check minimum duration
  if ((call.duration || 0) < MIN_COACHING_DURATION_SECONDS) {
    return {
      eligible: false,
      reason: `Call too short. Minimum ${MIN_COACHING_DURATION_SECONDS} seconds required, call was ${call.duration || 0} seconds`,
    }
  }

  // Check if call was answered/connected
  if (!call.answeredAt && call.status !== 'completed') {
    return { eligible: false, reason: 'Call was not connected' }
  }

  // Check disposition - exclude non-conversation dispositions
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

  // Check if coaching already exists
  const existingCoaching = await coachingRepo.findCoachingByCallId(
    callId,
    organizationId,
  )
  if (existingCoaching) {
    return { eligible: false, reason: 'Coaching already exists for this call' }
  }

  return { eligible: true }
}

/**
 * Get or create a transcript for a call
 * Uses OpenAI Whisper API to transcribe Twilio recordings
 */
export async function getOrCreateTranscript(
  callId: string,
  organizationId: string,
): Promise<coachingRepo.TranscriptWithCoaching | null> {
  // Check if transcript already exists
  const existingTranscript = await coachingRepo.findTranscriptByCallId(
    callId,
    organizationId,
  )

  // If real transcript exists (not pending), return it
  if (existingTranscript && existingTranscript.transcriptSource !== 'pending') {
    return existingTranscript
  }

  // Get call details
  const call = await db
    .selectFrom('call')
    .leftJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.id', '=', callId)
    .where('twilio_config.organizationId', '=', organizationId)
    .select([
      'call.id',
      'call.duration',
      'call.recordingUrl',
      'call.recordingSid',
    ])
    .executeTakeFirst()

  if (!call || !call.recordingUrl) {
    return null
  }

  // Check if transcription service is available
  if (!transcriptionService.isTranscriptionAvailable()) {
    console.warn(
      'Transcription service not available - OPENAI_API_KEY not configured',
    )
    // Fall back to creating a pending transcript if none exists
    if (!existingTranscript) {
      return coachingRepo.createTranscript({
        callId,
        organizationId,
        transcriptText:
          '[Transcription unavailable - OPENAI_API_KEY not configured]',
        transcriptSource: 'pending',
        durationSeconds: call.duration || 0,
        speakerLabels: [],
      })
    }
    return existingTranscript
  }

  // Transcribe the recording using OpenAI Whisper
  try {
    console.log(`Transcribing recording for call ${callId}...`)
    const result = await transcriptionService.transcribeRecording(
      call.recordingUrl,
      organizationId,
    )
    console.log(
      `Transcription complete for call ${callId}: ${result.text.length} characters`,
    )

    // If pending transcript exists, update it; otherwise create new
    if (existingTranscript) {
      return coachingRepo.updateTranscript(callId, organizationId, {
        transcriptText: result.text,
        transcriptSource: result.source,
        durationSeconds: call.duration || 0,
        speakerLabels: [],
      })
    }

    return coachingRepo.createTranscript({
      callId,
      organizationId,
      transcriptText: result.text,
      transcriptSource: result.source,
      durationSeconds: call.duration || 0,
      speakerLabels: [],
    })
  } catch (error) {
    console.error(`Failed to transcribe call ${callId}:`, error)

    // If transcription fails, create/return pending transcript so coaching can still be attempted
    // (though it will be low quality without real transcript)
    if (!existingTranscript) {
      return coachingRepo.createTranscript({
        callId,
        organizationId,
        transcriptText: `[Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        transcriptSource: 'pending',
        durationSeconds: call.duration || 0,
        speakerLabels: [],
      })
    }
    return existingTranscript
  }
}

/**
 * Analyze a transcript and generate coaching feedback using AI
 */
async function analyzeTranscript(
  transcriptText: string,
  callContext: { duration: number; direction: string },
): Promise<{
  overallScore: number
  unhingedQuote: string
  strengths: string[]
  improvements: string[]
  feedback: unknown
  tokensUsed: number
}> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: SALES_COACH_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Analyze this ${callContext.direction} sales call (${Math.round(callContext.duration / 60)} minutes).

TRANSCRIPT:
${transcriptText}

Provide your coaching feedback as JSON. Remember to find things to improve even if the call was good!`,
    },
  ]

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omnidial.io',
      'X-Title': 'OmniDial Sales Coach',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
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

  // Parse JSON response
  let parsed
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('No JSON found in response')
    }
  } catch {
    console.error('Failed to parse AI response as JSON:', content)
    throw new Error('Failed to parse AI coaching response')
  }

  return {
    overallScore: parsed.overallScore || 5,
    unhingedQuote: parsed.unhingedQuote || 'Keep grinding!',
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    feedback: parsed.feedback || {},
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

/**
 * Generate coaching for a call
 * This is the main entry point for the Sales Coach feature
 */
export async function generateCoaching(
  callId: string,
  organizationId: string,
  userId: string,
): Promise<CoachingResult> {
  const startTime = Date.now()

  // Check eligibility
  const eligibility = await checkCoachingEligibility(callId, organizationId)
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || 'Call is not eligible for coaching')
  }

  // Get or create transcript
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
    .select(['call.duration', 'call.direction'])
    .executeTakeFirst()

  if (!call) {
    throw new Error('Call not found')
  }

  // Analyze transcript with AI
  const analysis = await analyzeTranscript(transcript.transcriptText, {
    duration: call.duration || 0,
    direction: call.direction,
  })

  const analysisTimeMs = Date.now() - startTime

  // Save coaching feedback
  const coaching = await coachingRepo.createCoaching({
    callId,
    transcriptId: transcript.id,
    organizationId,
    userId,
    overallScore: analysis.overallScore,
    unhingedQuote: analysis.unhingedQuote,
    strengths: analysis.strengths,
    improvements: analysis.improvements,
    feedback: analysis.feedback,
    modelUsed: 'claude-3.5-sonnet',
    tokensUsed: analysis.tokensUsed,
    analysisTimeMs,
  })

  return { coaching, transcript }
}

/**
 * Get coaching for a call (if it exists)
 */
export async function getCoaching(
  callId: string,
  organizationId: string,
): Promise<CoachingResult | null> {
  const coaching = await coachingRepo.findCoachingByCallId(
    callId,
    organizationId,
  )
  if (!coaching) {
    return null
  }

  const transcript = await coachingRepo.findTranscriptByCallId(
    callId,
    organizationId,
  )
  if (!transcript) {
    return null
  }

  return { coaching, transcript }
}

/**
 * Get coaching history for a user
 */
export async function getUserCoachingHistory(
  userId: string,
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<coachingRepo.CoachingWithTranscript[]> {
  return coachingRepo.findCoachingByUserId(userId, organizationId, options)
}

/**
 * Get recent coaching for an organization
 */
export async function getRecentCoaching(
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    minScore?: number
    maxScore?: number
  } = {},
): Promise<coachingRepo.CoachingWithTranscript[]> {
  return coachingRepo.findRecentCoaching(organizationId, options)
}

/**
 * Get coaching stats for a user or organization
 */
export async function getCoachingStats(
  organizationId: string,
  userId?: string,
): Promise<{
  totalCoached: number
  averageScore: number
  scoreDistribution: Record<string, number>
}> {
  return coachingRepo.getCoachingStats(organizationId, userId)
}

/**
 * Get calls that are eligible for coaching but haven't been coached yet
 */
export async function getUncoachedCalls(
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<coachingRepo.EligibleCallForCoaching[]> {
  return coachingRepo.findUncoachedCalls(organizationId, options)
}

/**
 * Get coaching history for a specific lead
 */
export async function getCoachingByLeadId(
  leadId: string,
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    minScore?: number
    maxScore?: number
  } = {},
): Promise<coachingRepo.CoachingWithLead[]> {
  return coachingRepo.findCoachingByLeadId(leadId, organizationId, options)
}
