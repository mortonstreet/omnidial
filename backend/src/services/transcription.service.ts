import OpenAI, { toFile } from 'openai'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'
import { decryptAuthToken, fetchRecordingAudio } from '@/lib/telnyx'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

// Initialize OpenAI client lazily
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required for transcription',
    )
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY })
  }
  return openaiClient
}

export interface TranscriptionResult {
  text: string
  source: 'openai-whisper'
}

/**
 * Fetch a recording from Telnyx (Bearer-authenticated for Telnyx-hosted URLs)
 */
async function fetchTelnyxRecording(
  recordingUrl: string,
  apiKey: string,
): Promise<ArrayBuffer> {
  const response = await fetchRecordingAudio(apiKey, recordingUrl)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch recording from Telnyx: ${response.status} ${response.statusText}`,
    )
  }

  return response.arrayBuffer()
}

/**
 * Transcribe a recording using OpenAI Whisper API
 */
export async function transcribeRecording(
  recordingUrl: string,
  organizationId: string,
): Promise<TranscriptionResult> {
  const openai = getOpenAIClient()

  // Get Telnyx config for this organization
  const telnyxConfig =
    await twilioConfigRepository.findByOrganizationId(organizationId)
  if (!telnyxConfig) {
    throw new Error(`No Telnyx configuration found for organization`)
  }

  const apiKey = decryptAuthToken(telnyxConfig.authTokenEncrypted)

  // Fetch the recording from Telnyx
  const audioBuffer = await fetchTelnyxRecording(recordingUrl, apiKey)

  // Convert to File object for OpenAI SDK
  const audioFile = await toFile(Buffer.from(audioBuffer), 'recording.mp3', {
    type: 'audio/mpeg',
  })

  // Send to OpenAI Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  })

  return {
    text: transcription,
    source: 'openai-whisper',
  }
}

/**
 * Check if transcription is available (OPENAI_API_KEY is configured)
 */
export function isTranscriptionAvailable(): boolean {
  return Boolean(OPENAI_API_KEY)
}
