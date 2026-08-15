import OpenAI from 'openai'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'
import * as phoneProvisioningRepository from '@/repositories/phoneProvisioning.repository'
import { transcribeAudioBuffer } from '@/lib/audioTranscription'
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
  source: 'openai-whisper' | 'openai-whisper-chunked'
  chunkCount: number
  audioBytes: number
  chunkBytes: number[]
}

interface FetchedRecordingAudio {
  buffer: Buffer
  contentType?: string | null
}

/**
 * Fetch a recording from Telnyx (Bearer-authenticated for Telnyx-hosted URLs)
 */
async function fetchTelnyxRecording(
  recordingUrl: string,
  accountSid: string,
  apiKey: string,
  recordingSid?: string,
): Promise<FetchedRecordingAudio> {
  // The recording SID matters: stored recording URLs are pre-signed S3 links
  // that expire ten minutes after the call, so anything transcribed later gets
  // a 403. `fetchRecordingAudio` re-requests a fresh media URL, but only when
  // it is given the SID — without it the expired 403 is returned as-is.
  const response = await fetchRecordingAudio(
    { accountSid, apiKey },
    recordingUrl,
    recordingSid,
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch recording from Telnyx: ${response.status} ${response.statusText}`,
    )
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type'),
  }
}

/**
 * Transcribe a recording using OpenAI Whisper API
 */
export async function transcribeRecording(
  recordingUrl: string,
  organizationId: string,
  recordingSid?: string,
): Promise<TranscriptionResult> {
  const openai = getOpenAIClient()

  // Get Telnyx config for this organization
  const telnyxConfig =
    await twilioConfigRepository.findByOrganizationId(organizationId)
  if (!telnyxConfig) {
    throw new Error(`No Telnyx configuration found for organization`)
  }

  const provisioning =
    await phoneProvisioningRepository.findByOrganizationId(organizationId)
  const accountSid =
    provisioning?.usesMainAccount && process.env.TELNYX_ACCOUNT_SID
      ? process.env.TELNYX_ACCOUNT_SID
      : telnyxConfig.accountSid
  const apiKey =
    provisioning?.usesMainAccount && process.env.TELNYX_API_KEY
      ? process.env.TELNYX_API_KEY
      : decryptAuthToken(telnyxConfig.authTokenEncrypted)

  // Fetch the recording from Telnyx
  const audio = await fetchTelnyxRecording(
    recordingUrl,
    accountSid,
    apiKey,
    recordingSid,
  )

  return transcribeAudioBuffer(openai, audio.buffer, {
    contentType: audio.contentType,
    filename: recordingSid ? `recording-${recordingSid}` : 'recording',
    recordingUrl,
  })
}

/**
 * Check if transcription is available (OPENAI_API_KEY is configured)
 */
export function isTranscriptionAvailable(): boolean {
  return Boolean(OPENAI_API_KEY)
}
