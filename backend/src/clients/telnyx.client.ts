import * as telnyx from '@/lib/telnyx'
import { TelnyxCredentials, decryptAuthToken } from '@/lib/telnyx'
import * as telnyxConfigRepository from '@/repositories/twilioConfig.repository'
import * as phoneProvisioningRepo from '@/repositories/phoneProvisioning.repository'

/**
 * Per-organization Telnyx client.
 *
 * Credentials are stored in the `twilio_config` table (retained name — the
 * columns now hold Telnyx values: `accountSid` = TeXML account SID,
 * `authTokenEncrypted` = encrypted Telnyx API key). Orgs flagged
 * `usesMainAccount` always resolve to the TELNYX_ACCOUNT_SID /
 * TELNYX_API_KEY environment credentials.
 */
export class OrgTelnyxClient {
  readonly credentials: TelnyxCredentials
  readonly texmlApplicationSid?: string

  constructor(credentials: TelnyxCredentials, texmlApplicationSid?: string) {
    this.credentials = credentials
    this.texmlApplicationSid = texmlApplicationSid
  }

  get apiKey(): string {
    return this.credentials.apiKey
  }

  // --- TeXML voice ---

  createCall(params: telnyx.InitiateCallParams) {
    const applicationSid = params.applicationSid ?? this.texmlApplicationSid
    if (!applicationSid) {
      throw new Error(
        'Telnyx TeXML application id not configured. Set TELNYX_TEXML_APP_ID or provision organization phone infrastructure.',
      )
    }

    return telnyx.initiateCall(this.credentials, {
      ...params,
      applicationSid,
    })
  }

  updateCall(callSid: string, params: telnyx.UpdateCallParams) {
    return telnyx.updateCall(this.credentials, callSid, params)
  }

  endCall(callSid: string) {
    return telnyx.endCall(this.credentials, callSid)
  }

  getCall(callSid: string) {
    return telnyx.getCallDetails(this.credentials, callSid)
  }

  playRecordingOnCall(callSid: string, recordingUrl: string) {
    return telnyx.playRecording(this.credentials, callSid, recordingUrl)
  }

  sendDtmfOnCall(callControlId: string, digits: string) {
    return telnyx.sendDtmf(this.credentials.apiKey, callControlId, digits)
  }

  // --- TeXML conferences ---

  listConferenceParticipants(conferenceSid: string) {
    return telnyx.listConferenceParticipants(this.credentials, conferenceSid)
  }

  addConferenceParticipant(
    conferenceSid: string,
    params: telnyx.AddParticipantParams,
  ) {
    return telnyx.addConferenceParticipant(
      this.credentials,
      conferenceSid,
      params,
    )
  }

  updateConferenceParticipant(
    conferenceSid: string,
    participantCallSid: string,
    params: { muted?: boolean; coaching?: boolean; callSidToCoach?: string },
  ) {
    return telnyx.updateConferenceParticipant(
      this.credentials,
      conferenceSid,
      participantCallSid,
      params,
    )
  }

  removeConferenceParticipant(
    conferenceSid: string,
    participantCallSid: string,
  ) {
    return telnyx.removeConferenceParticipant(
      this.credentials,
      conferenceSid,
      participantCallSid,
    )
  }

  // --- Numbers / messaging / lookup ---

  listPhoneNumbers() {
    return telnyx.listPhoneNumbers(this.apiKey)
  }

  sendMessage(params: telnyx.SendMessageParams) {
    return telnyx.sendMessage(this.apiKey, params)
  }

  numberLookup(phoneNumber: string) {
    return telnyx.numberLookup(this.apiKey, phoneNumber)
  }
}

interface CachedClient {
  client: OrgTelnyxClient
  createdAt: number
}

// Cache TTL: 5 minutes - refresh periodically to avoid stale credentials
const CACHE_TTL_MS = 5 * 60 * 1000

const clientCache = new Map<string, CachedClient>()

/**
 * Get or create a Telnyx client for an organization.
 * For orgs that use the main account (usesMainAccount=true), always uses
 * current env vars to avoid stale DB credentials.
 */
export const getClientForOrganization = async (
  organizationId: string,
): Promise<OrgTelnyxClient> => {
  const now = Date.now()

  const cached = clientCache.get(organizationId)
  if (cached && now - cached.createdAt < CACHE_TTL_MS) {
    return cached.client
  }

  if (cached) {
    clientCache.delete(organizationId)
  }

  const config =
    await telnyxConfigRepository.findByOrganizationId(organizationId)
  if (!config) {
    throw new Error(
      `No Telnyx configuration found for organization ${organizationId}`,
    )
  }

  let accountSid = config.accountSid
  let apiKey = decryptAuthToken(config.authTokenEncrypted)
  let texmlApplicationSid: string | undefined = process.env.TELNYX_TEXML_APP_ID

  // For main-account orgs, always use current env vars
  const provisioning =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (
    provisioning?.usesMainAccount &&
    process.env.TELNYX_ACCOUNT_SID &&
    process.env.TELNYX_API_KEY
  ) {
    accountSid = process.env.TELNYX_ACCOUNT_SID
    apiKey = process.env.TELNYX_API_KEY
  }
  texmlApplicationSid = provisioning?.twimlAppSid || texmlApplicationSid

  const client = new OrgTelnyxClient(
    { accountSid, apiKey },
    texmlApplicationSid,
  )
  clientCache.set(organizationId, { client, createdAt: now })

  return client
}

/**
 * Clear cached client for an organization (e.g., when credentials are updated)
 */
export const clearClientCache = (organizationId: string): void => {
  clientCache.delete(organizationId)
}

/**
 * Clear all cached clients
 */
export const clearAllClientCache = (): void => {
  clientCache.clear()
}
