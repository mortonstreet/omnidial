/**
 * Backfill Coaching Script
 *
 * This script processes legacy calls that have recordings but no transcripts/coaching.
 * It finds eligible calls and generates transcripts + coaching for them.
 *
 * Usage: npx tsx backend/scripts/backfill-coaching.ts [--limit=N] [--org=ORG_ID] [--dry-run]
 *
 * Options:
 *   --limit=N     Maximum number of calls to process (default: 4)
 *   --org=ORG_ID  Only process calls for a specific organization
 *   --dry-run     Show what would be processed without making changes
 */

import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import type { DB } from '@shared/db/src'
import OpenAI, { toFile } from 'openai'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const envLocalPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true })
}

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''
const MIN_DURATION_SECONDS = 60
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// Excluded dispositions
const EXCLUDED_DISPOSITION_LABELS = [
  'no answer',
  'voicemail',
  'busy',
  'wrong number',
  'disconnected',
  'left voicemail',
]

// Parse CLI arguments
function parseArgs(): {
  limit: number
  organizationId?: string
  dryRun: boolean
} {
  const args = process.argv.slice(2)
  let limit = 4
  let organizationId: string | undefined
  let dryRun = false

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10) || 4
    } else if (arg.startsWith('--org=')) {
      organizationId = arg.split('=')[1]
    } else if (arg === '--dry-run') {
      dryRun = true
    }
  }

  return { limit, organizationId, dryRun }
}

// Initialize database connection
function createDb() {
  const dialect = new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 5,
      idleTimeoutMillis: 10000,
    }),
  })
  return new Kysely<DB>({ dialect })
}

// Decrypt auth token (matching the backend implementation)
function decryptAuthToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required for decryption')
  }
  const [ivHex, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', keyBuffer, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Fetch a call recording (Bearer-authenticated for Telnyx-hosted URLs)
async function fetchCallRecording(
  recordingUrl: string,
  _accountSid: string,
  apiKey: string,
): Promise<ArrayBuffer> {
  const isTelnyxUrl = recordingUrl.includes('telnyx.com')

  const response = await fetch(recordingUrl, {
    headers: isTelnyxUrl ? { Authorization: `Bearer ${apiKey}` } : undefined,
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch recording: ${response.status} ${response.statusText}`,
    )
  }

  return response.arrayBuffer()
}

// Transcribe recording with OpenAI Whisper
async function transcribeRecording(
  recordingUrl: string,
  accountSid: string,
  authToken: string,
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for transcription')
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  const audioBuffer = await fetchCallRecording(
    recordingUrl,
    accountSid,
    authToken,
  )
  const audioFile = await toFile(Buffer.from(audioBuffer), 'recording.mp3', {
    type: 'audio/mpeg',
  })

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  })

  return transcription
}

// Generate coaching analysis
async function analyzeTranscript(
  transcriptText: string,
  duration: number,
  direction: string,
): Promise<{
  overallScore: number
  unhingedQuote: string
  strengths: string[]
  improvements: string[]
  feedback: unknown
  tokensUsed: number
}> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for coaching analysis')
  }

  const systemPrompt = `You are the UNHINGED SALES COACH. Your job is to find feedback NO MATTER WHAT.

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

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omnidial.io',
      'X-Title': 'OmniDial Sales Coach Backfill',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this ${direction} sales call (${Math.round(duration / 60)} minutes).

TRANSCRIPT:
${transcriptText}

Provide your coaching feedback as JSON. Remember to find things to improve even if the call was good!`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('No response from OpenRouter')
  }

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    overallScore: parsed.overallScore || 5,
    unhingedQuote: parsed.unhingedQuote || 'Keep grinding!',
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    feedback: parsed.feedback || {},
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

// Main backfill function
async function backfillCoaching() {
  const { limit, organizationId, dryRun } = parseArgs()
  const db = createDb()

  console.log('🚀 Starting coaching backfill...')
  console.log(`   Limit: ${limit} calls`)
  console.log(`   Organization: ${organizationId || 'All'}`)
  console.log(`   Dry run: ${dryRun}`)
  console.log('')

  try {
    // Get all call IDs that already have transcripts
    const existingTranscripts = await db
      .selectFrom('call_transcript')
      .select('callId')
      .execute()
    const transcribedCallIds = new Set(existingTranscripts.map((t) => t.callId))

    // Build query for eligible calls
    let query = db
      .selectFrom('call')
      .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
      .leftJoin('lead', 'lead.id', 'call.leadId')
      .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
      .where('call.recordingUrl', 'is not', null)
      .where('call.duration', '>=', MIN_DURATION_SECONDS)
      .where((eb) =>
        eb.or([
          eb('call.answeredAt', 'is not', null),
          eb('call.status', '=', 'completed'),
        ]),
      )
      .orderBy('call.createdAt', 'desc')
      .limit(limit + 50) // Get extra to filter
      .select([
        'call.id',
        'call.duration',
        'call.direction',
        'call.recordingUrl',
        'call.createdAt',
        'call.userId',
        'twilio_config.organizationId',
        'twilio_config.accountSid',
        'twilio_config.authTokenEncrypted',
        'lead.firstName as leadFirstName',
        'lead.lastName as leadLastName',
        'lead.company as leadCompany',
        'disposition.label as dispositionLabel',
      ])

    if (organizationId) {
      query = query.where('twilio_config.organizationId', '=', organizationId)
    }

    const calls = await query.execute()

    // Filter eligible calls
    const eligibleCalls = calls
      .filter((call) => {
        // Skip if already has transcript
        if (transcribedCallIds.has(call.id)) return false

        // Skip excluded dispositions
        if (call.dispositionLabel) {
          const normalizedLabel = call.dispositionLabel.toLowerCase().trim()
          if (
            EXCLUDED_DISPOSITION_LABELS.some((excluded) =>
              normalizedLabel.includes(excluded),
            )
          ) {
            return false
          }
        }

        return true
      })
      .slice(0, limit)

    console.log(`📋 Found ${eligibleCalls.length} eligible calls to process`)
    console.log('')

    if (eligibleCalls.length === 0) {
      console.log('✅ No calls to process. All caught up!')
      process.exit(0)
    }

    if (dryRun) {
      console.log('📝 DRY RUN - Would process these calls:')
      for (const call of eligibleCalls) {
        const leadName =
          call.leadFirstName || call.leadLastName
            ? `${call.leadFirstName || ''} ${call.leadLastName || ''}`.trim()
            : 'Unknown'
        console.log(
          `   - ${call.id} | ${leadName} | ${Math.round((call.duration || 0) / 60)}min | ${new Date(call.createdAt!).toLocaleDateString()}`,
        )
      }
      process.exit(0)
    }

    // Process each call
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < eligibleCalls.length; i++) {
      const call = eligibleCalls[i]
      const leadName =
        call.leadFirstName || call.leadLastName
          ? `${call.leadFirstName || ''} ${call.leadLastName || ''}`.trim()
          : 'Unknown'

      console.log(`[${i + 1}/${eligibleCalls.length}] Processing: ${call.id}`)
      console.log(`   Lead: ${leadName}`)
      console.log(
        `   Duration: ${Math.round((call.duration || 0) / 60)} minutes`,
      )

      try {
        const startTime = Date.now()

        // Decrypt auth token
        const authToken = decryptAuthToken(call.authTokenEncrypted)

        // Step 1: Transcribe
        console.log('   📝 Transcribing...')
        const transcriptText = await transcribeRecording(
          call.recordingUrl!,
          call.accountSid,
          authToken,
        )
        console.log(`   ✓ Transcribed (${transcriptText.length} chars)`)

        // Step 2: Create transcript record
        const transcriptId = randomUUID()
        await db
          .insertInto('call_transcript')
          .values({
            id: transcriptId,
            callId: call.id,
            organizationId: call.organizationId,
            transcriptText,
            transcriptSource: 'openai-whisper',
            speakerLabels: JSON.stringify([]),
            durationSeconds: call.duration || 0,
            language: 'en-US',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .execute()
        console.log('   ✓ Transcript saved')

        // Step 3: Generate coaching
        console.log('   🎯 Analyzing...')
        const analysis = await analyzeTranscript(
          transcriptText,
          call.duration || 0,
          call.direction,
        )
        console.log(`   ✓ Analyzed (score: ${analysis.overallScore}/10)`)

        const analysisTimeMs = Date.now() - startTime

        // Step 4: Save coaching
        await db
          .insertInto('call_coaching')
          .values({
            id: randomUUID(),
            callId: call.id,
            transcriptId,
            organizationId: call.organizationId,
            userId: call.userId,
            overallScore: analysis.overallScore,
            unhingedQuote: analysis.unhingedQuote,
            strengths: analysis.strengths,
            improvements: analysis.improvements,
            feedback: JSON.stringify(analysis.feedback),
            modelUsed: 'claude-3.5-sonnet',
            tokensUsed: analysis.tokensUsed,
            analysisTimeMs,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .execute()
        console.log('   ✓ Coaching saved')
        console.log(`   ✅ Complete (${Math.round(analysisTimeMs / 1000)}s)`)
        console.log('')

        successCount++
      } catch (error) {
        console.error(
          `   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        console.log('')
        errorCount++
      }

      // Add a small delay between calls to avoid rate limiting
      if (i < eligibleCalls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log('📊 Summary:')
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Failed: ${errorCount}`)
    console.log('')
    console.log('🎉 Backfill complete!')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

// Run the script
backfillCoaching()
