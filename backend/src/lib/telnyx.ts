import { createPublicKey, verify as cryptoVerify } from 'crypto'
import { encrypt, decrypt } from '@/lib/encryption'

/**
 * Telnyx API library.
 *
 * Voice is driven through Telnyx TeXML — the Twilio-compatible programmable
 * voice layer — so call commands live under
 * `https://api.telnyx.com/v2/texml/Accounts/{accountSid}/...` and accept the
 * same parameter names Twilio's API did (To, From, Url, StatusCallback,
 * MachineDetection, ...). Everything else (numbers, messaging, credentials,
 * lookup) uses the native Telnyx v2 JSON API.
 */

export const TELNYX_API_BASE = 'https://api.telnyx.com/v2'

export interface TelnyxCredentials {
  /** TeXML account SID (the Telnyx account/organization id shown in the portal). */
  accountSid: string
  /** Telnyx V2 API key (KEY...). Stored encrypted in the database. */
  apiKey: string
}

export class TelnyxApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string, context: string) {
    super(`Telnyx API error (${context}): ${status} ${body.slice(0, 500)}`)
    this.name = 'TelnyxApiError'
    this.status = status
    this.body = body
  }
}

// ============================================
// Low-level request helpers
// ============================================

const jsonRequest = async <T = Record<string, unknown>>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  const response = await fetch(`${TELNYX_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new TelnyxApiError(response.status, text, `${method} ${path}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

type FormValue = string | number | boolean | undefined

const toFormBody = (params: Record<string, FormValue | string[]>): string => {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      // Twilio-style repeated params (e.g. StatusCallbackEvent)
      for (const item of value) form.append(key, item)
    } else {
      form.append(key, String(value))
    }
  }
  return form.toString()
}

/**
 * TeXML REST request — form-encoded like Twilio's API, Bearer-authenticated.
 */
const texmlRequest = async <T = Record<string, unknown>>(
  credentials: TelnyxCredentials,
  method: 'GET' | 'POST' | 'DELETE',
  resourcePath: string,
  params?: Record<string, FormValue | string[]>,
): Promise<T> => {
  const basePath = `/texml/Accounts/${encodeURIComponent(credentials.accountSid)}${resourcePath}`
  const isGet = method === 'GET'
  const query = isGet && params ? `?${toFormBody(params)}` : ''

  const response = await fetch(`${TELNYX_API_BASE}${basePath}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      Accept: 'application/json',
      ...(isGet || !params
        ? {}
        : { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    body: isGet || !params ? undefined : toFormBody(params),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new TelnyxApiError(response.status, text, `${method} ${basePath}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

// ============================================
// TeXML voice commands (Twilio-compatible)
// ============================================

export interface TexmlCallResource {
  sid: string
  status?: string
  to?: string
  from?: string
  duration?: string
  [key: string]: unknown
}

export interface InitiateCallParams {
  applicationSid?: string
  to: string
  from: string
  url: string
  statusCallback?: string
  statusCallbackEvent?: string[]
  timeout?: number
  record?: boolean
  recordingChannels?: 'single' | 'dual'
  recordingStatusCallback?: string
  recordingStatusCallbackEvent?: string[]
  machineDetection?: 'Enable' | 'Disable' | 'DetectMessageEnd'
  machineDetectionTimeout?: number
  asyncAmd?: boolean
  asyncAmdStatusCallback?: string
}

/**
 * Initiate an outbound call through the TeXML REST API.
 */
export const initiateCall = async (
  credentials: TelnyxCredentials,
  params: InitiateCallParams,
): Promise<TexmlCallResource> => {
  return texmlRequest<TexmlCallResource>(credentials, 'POST', '/Calls', {
    ApplicationSid: params.applicationSid,
    To: params.to,
    From: params.from,
    Url: params.url,
    Method: 'POST',
    StatusCallback: params.statusCallback,
    StatusCallbackMethod: params.statusCallback ? 'POST' : undefined,
    StatusCallbackEvent: params.statusCallbackEvent ?? [
      'initiated',
      'ringing',
      'answered',
      'completed',
    ],
    Timeout: params.timeout,
    Record: params.record ? 'true' : undefined,
    RecordingChannels: params.recordingChannels,
    RecordingStatusCallback: params.recordingStatusCallback,
    RecordingStatusCallbackMethod: params.recordingStatusCallback
      ? 'POST'
      : undefined,
    RecordingStatusCallbackEvent: params.recordingStatusCallbackEvent,
    MachineDetection: params.machineDetection,
    MachineDetectionTimeout: params.machineDetectionTimeout,
    AsyncAmd:
      params.asyncAmd === undefined ? undefined : String(params.asyncAmd),
    AsyncAmdStatusCallback: params.asyncAmdStatusCallback,
    AsyncAmdStatusCallbackMethod: params.asyncAmdStatusCallback
      ? 'POST'
      : undefined,
  })
}

export interface UpdateCallParams {
  url?: string
  method?: 'GET' | 'POST'
  status?: 'completed' | 'canceled'
  texml?: string
}

/**
 * Update a live call — redirect it to new TeXML instructions, inject
 * inline TeXML, or end it (Status=completed).
 */
export const updateCall = async (
  credentials: TelnyxCredentials,
  callSid: string,
  params: UpdateCallParams,
): Promise<TexmlCallResource> => {
  return texmlRequest<TexmlCallResource>(
    credentials,
    'POST',
    `/Calls/${encodeURIComponent(callSid)}`,
    {
      Url: params.url,
      Method: params.url ? (params.method ?? 'POST') : undefined,
      Status: params.status,
      Texml: params.texml,
    },
  )
}

/** End an active call. */
export const endCall = async (
  credentials: TelnyxCredentials,
  callSid: string,
): Promise<TexmlCallResource> => {
  return updateCall(credentials, callSid, { status: 'completed' })
}

/** Fetch call details. */
export const getCallDetails = async (
  credentials: TelnyxCredentials,
  callSid: string,
): Promise<TexmlCallResource> => {
  return texmlRequest<TexmlCallResource>(
    credentials,
    'GET',
    `/Calls/${encodeURIComponent(callSid)}`,
  )
}

/**
 * Play a recording (voicemail drop) into a live call, then hang up.
 */
export const playRecording = async (
  credentials: TelnyxCredentials,
  callSid: string,
  recordingUrl: string,
): Promise<TexmlCallResource> => {
  const escaped = recordingUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return updateCall(credentials, callSid, {
    texml: `<Response><Play>${escaped}</Play><Hangup/></Response>`,
  })
}

/**
 * Send DTMF digits on behalf of a call leg.
 *
 * The browser SDK's `call.dtmf()` injects digits into the WebRTC leg only.
 * Outbound calls here are two legs — browser → TeXML application, then
 * `<Dial>` → the callee — so digits pressed in the UI never reached the far
 * end's IVR. This Call Control action emits the tones from the given leg such
 * that the *other* end of the call hears them, which is what navigating a
 * phone tree requires.
 *
 * `callControlId` is the leg's control ID (stored on the call row as
 * `twilioCallSid`, e.g. `v3:AZKn...`), not a TeXML CallSid path segment.
 */
export const sendDtmf = async (
  apiKey: string,
  callControlId: string,
  digits: string,
): Promise<void> => {
  await jsonRequest(
    apiKey,
    'POST',
    `/calls/${encodeURIComponent(callControlId)}/actions/send_dtmf`,
    { digits },
  )
}

// ============================================
// TeXML conference participants
// ============================================

export interface ConferenceParticipant {
  callSid: string
  label?: string
  muted?: boolean
  coaching?: boolean
  [key: string]: unknown
}

interface ParticipantsListResponse {
  participants?: ConferenceParticipant[]
  [key: string]: unknown
}

export const listConferenceParticipants = async (
  credentials: TelnyxCredentials,
  conferenceSid: string,
): Promise<ConferenceParticipant[]> => {
  const result = await texmlRequest<ParticipantsListResponse>(
    credentials,
    'GET',
    `/Conferences/${encodeURIComponent(conferenceSid)}/Participants`,
  )
  return result.participants ?? []
}

export interface AddParticipantParams {
  from: string
  to: string
  label?: string
  muted?: boolean
  coaching?: boolean
  callSidToCoach?: string
  earlyMedia?: boolean
  endConferenceOnExit?: boolean
  startConferenceOnEnter?: boolean
}

export const addConferenceParticipant = async (
  credentials: TelnyxCredentials,
  conferenceSid: string,
  params: AddParticipantParams,
): Promise<ConferenceParticipant> => {
  return texmlRequest<ConferenceParticipant>(
    credentials,
    'POST',
    `/Conferences/${encodeURIComponent(conferenceSid)}/Participants`,
    {
      From: params.from,
      To: params.to,
      Label: params.label,
      Muted: params.muted,
      Coaching: params.coaching,
      CallSidToCoach: params.callSidToCoach,
      EarlyMedia: params.earlyMedia,
      EndConferenceOnExit: params.endConferenceOnExit,
      StartConferenceOnEnter: params.startConferenceOnEnter,
    },
  )
}

export const updateConferenceParticipant = async (
  credentials: TelnyxCredentials,
  conferenceSid: string,
  participantCallSid: string,
  params: { muted?: boolean; coaching?: boolean; callSidToCoach?: string },
): Promise<ConferenceParticipant> => {
  return texmlRequest<ConferenceParticipant>(
    credentials,
    'POST',
    `/Conferences/${encodeURIComponent(conferenceSid)}/Participants/${encodeURIComponent(participantCallSid)}`,
    {
      Muted: params.muted,
      Coaching: params.coaching,
      CallSidToCoach: params.callSidToCoach,
    },
  )
}

export const removeConferenceParticipant = async (
  credentials: TelnyxCredentials,
  conferenceSid: string,
  participantCallSid: string,
): Promise<void> => {
  await texmlRequest(
    credentials,
    'DELETE',
    `/Conferences/${encodeURIComponent(conferenceSid)}/Participants/${encodeURIComponent(participantCallSid)}`,
  )
}

// ============================================
// Native v2 API: phone numbers
// ============================================

export interface TelnyxPhoneNumber {
  id: string
  phone_number: string
  status?: string
  connection_id?: string | null
  messaging_profile_id?: string | null
  tags?: string[]
  [key: string]: unknown
}

interface PaginatedResponse<T> {
  data: T[]
  meta?: { total_pages?: number; page_number?: number }
}

/** List all phone numbers on the account (paginates automatically). */
export const listPhoneNumbers = async (
  apiKey: string,
): Promise<TelnyxPhoneNumber[]> => {
  const numbers: TelnyxPhoneNumber[] = []
  let page = 1
  // Telnyx caps page[size] at 250
  for (;;) {
    const result = await jsonRequest<PaginatedResponse<TelnyxPhoneNumber>>(
      apiKey,
      'GET',
      `/phone_numbers?page[size]=250&page[number]=${page}`,
    )
    numbers.push(...(result.data ?? []))
    const totalPages = result.meta?.total_pages ?? 1
    if (page >= totalPages) break
    page += 1
  }
  return numbers
}

export interface AvailableNumber {
  phone_number: string
  region_information?: Array<{ region_type: string; region_name: string }>
  features?: Array<{ name: string }>
  cost_information?: Record<string, unknown>
  [key: string]: unknown
}

/** Search purchasable numbers, optionally by US area code (NDC). */
export const searchAvailableNumbers = async (
  apiKey: string,
  options: { areaCode?: string; limit?: number; countryCode?: string },
): Promise<AvailableNumber[]> => {
  const params = new URLSearchParams()
  params.set('filter[country_code]', options.countryCode ?? 'US')
  params.set('filter[phone_number_type]', 'local')
  params.set('filter[features][]', 'voice')
  params.set('filter[limit]', String(options.limit ?? 20))
  params.set('filter[best_effort]', 'true')
  if (options.areaCode) {
    params.set('filter[national_destination_code]', options.areaCode)
  }

  const result = await jsonRequest<PaginatedResponse<AvailableNumber>>(
    apiKey,
    'GET',
    `/available_phone_numbers?${params.toString()}`,
  )
  return result.data ?? []
}

/** Purchase a specific phone number via a number order. */
export const orderPhoneNumber = async (
  apiKey: string,
  params: {
    phoneNumber: string
    connectionId?: string
    messagingProfileId?: string
  },
): Promise<Record<string, unknown>> => {
  const result = await jsonRequest<{ data: Record<string, unknown> }>(
    apiKey,
    'POST',
    '/number_orders',
    {
      phone_numbers: [{ phone_number: params.phoneNumber }],
      connection_id: params.connectionId,
      messaging_profile_id: params.messagingProfileId,
    },
  )
  return result.data
}

/** Find an owned phone number record by E.164 number. */
export const findPhoneNumber = async (
  apiKey: string,
  phoneNumber: string,
): Promise<TelnyxPhoneNumber | null> => {
  const result = await jsonRequest<PaginatedResponse<TelnyxPhoneNumber>>(
    apiKey,
    'GET',
    `/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
  )
  return result.data?.[0] ?? null
}

/** Point a number's voice traffic at a connection (e.g. a TeXML application). */
export const assignNumberToConnection = async (
  apiKey: string,
  phoneNumberId: string,
  connectionId: string,
): Promise<void> => {
  await jsonRequest(apiKey, 'PATCH', `/phone_numbers/${phoneNumberId}`, {
    connection_id: connectionId,
  })
}

/** Enable messaging on a number by assigning a messaging profile. */
export const assignNumberToMessagingProfile = async (
  apiKey: string,
  phoneNumberId: string,
  messagingProfileId: string,
): Promise<void> => {
  await jsonRequest(
    apiKey,
    'PATCH',
    `/phone_numbers/${phoneNumberId}/messaging`,
    { messaging_profile_id: messagingProfileId },
  )
}

/** Release (delete) a phone number from the account. */
export const releasePhoneNumber = async (
  apiKey: string,
  phoneNumberId: string,
): Promise<void> => {
  await jsonRequest(apiKey, 'DELETE', `/phone_numbers/${phoneNumberId}`)
}

// ============================================
// Native v2 API: TeXML applications
// ============================================

export interface TexmlApplication {
  id: string
  friendly_name?: string
  voice_url?: string
  status_callback?: string
  [key: string]: unknown
}

export const createTexmlApplication = async (
  apiKey: string,
  params: {
    friendlyName: string
    voiceUrl: string
    statusCallback?: string
    sipSubdomain?: string
    outboundVoiceProfileId?: string
  },
): Promise<TexmlApplication> => {
  const inbound =
    params.sipSubdomain !== undefined
      ? {
          sip_subdomain: params.sipSubdomain,
          sip_subdomain_receive_settings: 'only_my_connections',
        }
      : undefined
  const outbound =
    params.outboundVoiceProfileId !== undefined
      ? {
          outbound_voice_profile_id: params.outboundVoiceProfileId,
        }
      : undefined

  const result = await jsonRequest<{ data: TexmlApplication }>(
    apiKey,
    'POST',
    '/texml_applications',
    {
      friendly_name: params.friendlyName,
      voice_url: params.voiceUrl,
      voice_method: 'post',
      status_callback: params.statusCallback,
      status_callback_method: params.statusCallback ? 'post' : undefined,
      active: true,
      anchorsite_override: 'Latency',
      inbound,
      outbound,
    },
  )
  return result.data
}

// ============================================
// Native v2 API: messaging
// ============================================

export interface SendMessageParams {
  from?: string
  messagingProfileId?: string
  to: string
  text: string
  webhookUrl?: string
}

export interface TelnyxMessage {
  id: string
  [key: string]: unknown
}

export const sendMessage = async (
  apiKey: string,
  params: SendMessageParams,
): Promise<TelnyxMessage> => {
  const result = await jsonRequest<{ data: TelnyxMessage }>(
    apiKey,
    'POST',
    '/messages',
    {
      from: params.from,
      messaging_profile_id: params.messagingProfileId,
      to: params.to,
      text: params.text,
      webhook_url: params.webhookUrl,
      use_profile_webhooks: params.webhookUrl ? false : true,
    },
  )
  return result.data
}

export const createMessagingProfile = async (
  apiKey: string,
  params: { name: string; webhookUrl?: string },
): Promise<{ id: string; [key: string]: unknown }> => {
  const result = await jsonRequest<{
    data: { id: string; [key: string]: unknown }
  }>(apiKey, 'POST', '/messaging_profiles', {
    name: params.name,
    enabled: true,
    webhook_url: params.webhookUrl,
    webhook_api_version: '2',
    // Required by Telnyx — destinations SMS may be sent to
    whitelisted_destinations: ['US', 'CA'],
  })
  return result.data
}

// ============================================
// Native v2 API: number lookup
// ============================================

export interface NumberLookupResult {
  phone_number?: string
  carrier?: { name?: string; type?: string }
  portability?: Record<string, unknown>
  [key: string]: unknown
}

/** Carrier/line-type lookup (Telnyx's equivalent of Twilio Lookup v2). */
export const numberLookup = async (
  apiKey: string,
  phoneNumber: string,
): Promise<NumberLookupResult> => {
  const result = await jsonRequest<{ data: NumberLookupResult }>(
    apiKey,
    'GET',
    `/number_lookup/${encodeURIComponent(phoneNumber)}?type=carrier`,
  )
  return result.data
}

// ============================================
// Native v2 API: telephony credentials (WebRTC auth)
// ============================================

export interface TelephonyCredential {
  id: string
  name?: string
  tag?: string
  sip_username?: string
  connection_id?: string
  resource_id?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface CredentialConnection {
  id: string
  sip_uri_calling_preference?: string | null
  [key: string]: unknown
}

/**
 * Browser clients authenticated through telephony credentials must be reachable
 * through internal SIP URI dialing for inbound PSTN calls to ring in-app.
 */
export const ensureCredentialConnectionInternalSip = async (
  apiKey: string,
  connectionId: string,
): Promise<void> => {
  const existing = await jsonRequest<{ data: CredentialConnection }>(
    apiKey,
    'GET',
    `/credential_connections/${encodeURIComponent(connectionId)}`,
  )
  if (existing.data?.sip_uri_calling_preference === 'internal') {
    return
  }

  await jsonRequest<{ data: CredentialConnection }>(
    apiKey,
    'PATCH',
    `/credential_connections/${encodeURIComponent(connectionId)}`,
    { sip_uri_calling_preference: 'internal' },
  )
}

const telephonyCredentialConnectionMatches = (
  credential: TelephonyCredential,
  connectionId: string,
): boolean =>
  credential.connection_id === connectionId ||
  credential.resource_id === `connection:${connectionId}`

const telephonyCredentialTimestamp = (
  credential: TelephonyCredential,
): number => {
  const value = credential.updated_at ?? credential.created_at
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const newestTelephonyCredential = (
  credentials: TelephonyCredential[] | undefined,
  connectionId?: string,
): TelephonyCredential | undefined => {
  const matches = (credentials ?? []).filter((credential) =>
    connectionId
      ? telephonyCredentialConnectionMatches(credential, connectionId)
      : true,
  )
  return matches.sort(
    (a, b) => telephonyCredentialTimestamp(b) - telephonyCredentialTimestamp(a),
  )[0]
}

/**
 * Find or create an on-demand telephony credential for a WebRTC identity.
 * Credentials are named after the identity so TeXML `<Dial><Client>identity`
 * can ring the right browser client, and tagged for lookup on reuse.
 */
export const findOrCreateTelephonyCredential = async (
  apiKey: string,
  params: { connectionId: string; identity: string },
): Promise<TelephonyCredential> => {
  const tag = `omnidial-${params.identity}`

  const existing = await jsonRequest<PaginatedResponse<TelephonyCredential>>(
    apiKey,
    'GET',
    `/telephony_credentials?filter[tag]=${encodeURIComponent(tag)}&page[size]=10`,
  )
  const match = newestTelephonyCredential(existing.data, params.connectionId)
  if (match) {
    return match
  }

  const created = await jsonRequest<{ data: TelephonyCredential }>(
    apiKey,
    'POST',
    '/telephony_credentials',
    {
      connection_id: params.connectionId,
      name: params.identity,
      tag,
    },
  )
  return created.data
}

/**
 * Mint a login JWT for the Telnyx WebRTC SDK from a telephony credential.
 * The endpoint returns the token as plain text.
 */
export const createTelephonyCredentialToken = async (
  apiKey: string,
  credentialId: string,
): Promise<string> => {
  const response = await fetch(
    `${TELNYX_API_BASE}/telephony_credentials/${encodeURIComponent(credentialId)}/token`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  )
  const text = await response.text()
  if (!response.ok) {
    throw new TelnyxApiError(
      response.status,
      text,
      `POST /telephony_credentials/${credentialId}/token`,
    )
  }
  // Some responses arrive as a JSON-encoded string — normalize either way.
  const trimmed = text.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed)
  }
  return trimmed
}

/**
 * Look up the SIP username for a previously issued WebRTC identity.
 * Used to dial a specific browser client via `<Dial><Sip>`.
 */
export const findTelephonyCredentialSipUsername = async (
  apiKey: string,
  identity: string,
  connectionId?: string,
): Promise<string | null> => {
  const tag = `omnidial-${identity}`
  const result = await jsonRequest<PaginatedResponse<TelephonyCredential>>(
    apiKey,
    'GET',
    `/telephony_credentials?filter[tag]=${encodeURIComponent(tag)}&page[size]=10`,
  )
  const credential = newestTelephonyCredential(result.data, connectionId)
  return credential?.sip_username ?? null
}

export interface WebRTCTokenOptions {
  identity: string
  connectionId: string
}

export interface WebRTCTokenResult {
  token: string
  identity: string
  credentialId: string
}

/**
 * Generate a WebRTC login token for the browser SDK — the Telnyx
 * replacement for Twilio capability/access tokens.
 */
export const generateWebRTCToken = async (
  apiKey: string,
  options: WebRTCTokenOptions,
): Promise<WebRTCTokenResult> => {
  const credential = await findOrCreateTelephonyCredential(apiKey, {
    connectionId: options.connectionId,
    identity: options.identity,
  })
  const token = await createTelephonyCredentialToken(apiKey, credential.id)
  return { token, identity: options.identity, credentialId: credential.id }
}

// ============================================
// Native v2 API: verified numbers (external caller IDs)
// ============================================

export interface VerifiedNumber {
  phone_number: string
  record_type?: string
  verified_at?: string | null
  [key: string]: unknown
}

/** Start caller-ID verification for an external number (call or SMS code). */
export const requestNumberVerification = async (
  apiKey: string,
  phoneNumber: string,
  verificationMethod: 'call' | 'sms' = 'call',
): Promise<Record<string, unknown>> => {
  const result = await jsonRequest<{ data: Record<string, unknown> }>(
    apiKey,
    'POST',
    '/verified_numbers',
    { phone_number: phoneNumber, verification_method: verificationMethod },
  )
  return result.data
}

/** Fetch a verified number record (404 → null). */
export const getVerifiedNumber = async (
  apiKey: string,
  phoneNumber: string,
): Promise<VerifiedNumber | null> => {
  try {
    const result = await jsonRequest<{ data: VerifiedNumber }>(
      apiKey,
      'GET',
      `/verified_numbers/${encodeURIComponent(phoneNumber)}`,
    )
    return result.data
  } catch (error) {
    if (error instanceof TelnyxApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/** Submit the verification code for a pending verified number. */
export const submitNumberVerificationCode = async (
  apiKey: string,
  phoneNumber: string,
  verificationCode: string,
): Promise<VerifiedNumber> => {
  const result = await jsonRequest<{ data: VerifiedNumber }>(
    apiKey,
    'POST',
    `/verified_numbers/${encodeURIComponent(phoneNumber)}/actions/verify`,
    { verification_code: verificationCode },
  )
  return result.data
}

/** List all verified external caller-ID numbers. */
export const listVerifiedNumbers = async (
  apiKey: string,
): Promise<VerifiedNumber[]> => {
  const result = await jsonRequest<PaginatedResponse<VerifiedNumber>>(
    apiKey,
    'GET',
    '/verified_numbers?page[size]=250',
  )
  return result.data ?? []
}

// ============================================
// Recording download
// ============================================

export interface TexmlRecordingResource {
  sid: string
  media_url?: string
  uri?: string
  [key: string]: unknown
}

export const getRecordingDetails = async (
  credentials: TelnyxCredentials,
  recordingSid: string,
): Promise<TexmlRecordingResource> => {
  return texmlRequest<TexmlRecordingResource>(
    credentials,
    'GET',
    `/Recordings/${encodeURIComponent(recordingSid)}.json`,
  )
}

const fetchRecordingUrl = async (
  apiKey: string,
  recordingUrl: string,
): Promise<Response> => {
  const isTelnyxUrl = recordingUrl.includes('telnyx.com')
  return fetch(recordingUrl, {
    headers: isTelnyxUrl ? { Authorization: `Bearer ${apiKey}` } : undefined,
  })
}

/**
 * Fetch a recording's audio bytes. Telnyx callback URLs can expire, so when a
 * recording SID is available we refresh the media URL through the TeXML API.
 */
export const fetchRecordingAudio = async (
  credentials: TelnyxCredentials,
  recordingUrl: string,
  recordingSid?: string,
): Promise<Response> => {
  const directResponse = await fetchRecordingUrl(
    credentials.apiKey,
    recordingUrl,
  )

  if (directResponse.ok || !recordingSid) {
    return directResponse
  }

  try {
    const recording = await getRecordingDetails(credentials, recordingSid)
    if (recording.media_url && recording.media_url !== recordingUrl) {
      return fetchRecordingUrl(credentials.apiKey, recording.media_url)
    }
  } catch {
    // Return the original response so callers preserve the vendor status code.
  }

  return directResponse
}

// ============================================
// Webhook signature verification (Ed25519)
// ============================================

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

// Reject webhooks older than 5 minutes to prevent replay
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

/**
 * Verify a Telnyx webhook signature. Telnyx signs `${timestamp}|${rawBody}`
 * with the account's Ed25519 key; the base64 public key is shown in
 * Mission Control under Keys & Credentials → Public Key.
 */
export const verifyTelnyxSignature = (params: {
  publicKey: string
  signatureHeader: string | undefined
  timestampHeader: string | undefined
  rawBody: string
}): boolean => {
  const { publicKey, signatureHeader, timestampHeader, rawBody } = params
  if (!publicKey || !signatureHeader || !timestampHeader) {
    return false
  }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) {
    return false
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp)
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) {
    return false
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([
        ED25519_SPKI_PREFIX,
        Buffer.from(publicKey, 'base64'),
      ]),
      format: 'der',
      type: 'spki',
    })
    return cryptoVerify(
      null,
      Buffer.from(`${timestampHeader}|${rawBody}`, 'utf8'),
      key,
      Buffer.from(signatureHeader, 'base64'),
    )
  } catch {
    return false
  }
}

// ============================================
// Credential encryption (unchanged storage format)
// ============================================

/**
 * Decrypt a stored API key using AES-256-GCM. Falls back to plaintext for
 * values written before encryption was introduced.
 */
export const decryptAuthToken = (encryptedToken: string): string => {
  if (encryptedToken.length < 64 || !/^[0-9a-f]+$/i.test(encryptedToken)) {
    return encryptedToken
  }
  try {
    return decrypt(encryptedToken)
  } catch (err) {
    console.error(
      '[telnyx] Failed to decrypt API key — returning stored value as-is. ' +
        'This likely means ENCRYPTION_KEY changed since the key was stored. ' +
        'Error:',
      err instanceof Error ? err.message : err,
    )
    return encryptedToken
  }
}

/** Encrypt an API key for storage. */
export const encryptAuthToken = (token: string): string => {
  return encrypt(token)
}
