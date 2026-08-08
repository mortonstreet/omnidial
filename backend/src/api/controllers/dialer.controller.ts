import * as dialerService from '@/services/dialer.service'
import * as activeDialerSessionService from '@/services/activeDialerSession.service'
import * as dispositionSuggestionService from '@/services/dispositionSuggestion.service'
import { doesMemberHaveRole } from '@/services/organization.service'
import { decryptAuthToken, fetchRecordingAudio } from '@/lib/telnyx'
import { validateAndNormalizePhone } from '@/lib/phone'
import {
  GetTwilioConfigRequest,
  CreateTwilioConfigRequest,
  UpdateTwilioConfigRequest,
  InitiateCallRequest,
  GetCallRequest,
  ListCallsRequest,
  UpdateCallDispositionRequest,
  DropVoicemailRequest,
  SendDtmfRequest,
  GetVoicemailDropRequest,
  ListVoicemailDropsRequest,
  CreateVoicemailDropRequest,
  DeleteVoicemailDropRequest,
  GetDispositionRequest,
  ListDispositionsRequest,
  CreateDispositionRequest,
  UpdateDispositionRequest,
  DeleteDispositionRequest,
  GetCapabilityTokenRequest,
  ListPhoneNumberAssignmentsRequest,
  GetClientPhoneNumbersRequest,
  AssignPhoneNumberRequest,
  UnassignPhoneNumberRequest,
  GetDialablePhoneNumbersRequest,
  StartDialerSessionRequest,
  EndDialerSessionRequest,
  GetActiveSessionsRequest,
  SuggestDispositionRequest,
  ListVoicemailGreetingsRequest,
  CreateVoicemailGreetingRequest,
  SetActiveVoicemailGreetingRequest,
  DeleteVoicemailGreetingRequest,
  ListVoicemailsRequest,
  MarkVoicemailReadRequest,
  MarkAllVoicemailsReadRequest,
} from '@shared/types/src'
import { AuthRequestHandler } from '@/types/handlers'

const getOrganizationId = (session: any): string | null => {
  return session?.session?.activeOrganizationId || null
}

// === Twilio Config Controllers ===

export const getTwilioConfig: AuthRequestHandler<
  GetTwilioConfigRequest
> = async (req, res) => {
  try {
    const { organizationId } = req.validated
    const config = await dialerService.getTwilioConfig(
      organizationId,
      req.user.id,
    )

    // Check if user is admin/owner to return full config
    const isAdmin = await doesMemberHaveRole(req.user.id, organizationId, [
      'owner',
      'admin',
    ])

    if (!config) {
      res.json({ data: null, isAdmin })
      return
    }

    // For non-admins, only return limited info (just that it's configured)
    if (!isAdmin) {
      res.json({
        data: {
          id: config.id,
          isConfigured: true,
          phoneNumbers: config.phoneNumbers,
        },
        isAdmin: false,
      })
      return
    }

    // For admins, return full config (minus sensitive data which service already filters)
    res.json({ data: config, isAdmin: true })
  } catch (error) {
    console.error('Failed to get dialer config:', error)
    res.status(500).json({ error: 'Failed to get dialer configuration' })
  }
}

// === Phone Numbers Controller ===

export const listPhoneNumbers: AuthRequestHandler<
  GetTwilioConfigRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  try {
    const phoneNumbers = await dialerService.listPhoneNumbers(organizationId)
    res.json({ data: phoneNumbers })
  } catch (error) {
    // Return empty array if Telnyx is not configured or credentials are invalid
    res.json({ data: [] })
  }
}

// === Client Phone Number Assignment Controllers ===

export const listPhoneNumbersWithAssignments: AuthRequestHandler<
  ListPhoneNumberAssignmentsRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  try {
    const phoneNumbers =
      await dialerService.listPhoneNumbersWithAssignments(organizationId)
    res.json({ data: phoneNumbers })
  } catch (error) {
    // Return empty array if Telnyx is not configured
    res.json({ data: [] })
  }
}

export const assignPhoneNumber: AuthRequestHandler<
  AssignPhoneNumberRequest
> = async (req, res) => {
  const { organizationId, userId, phoneNumber, friendlyName } = req.validated
  try {
    const assignment = await dialerService.assignPhoneNumberToUser(
      organizationId,
      userId,
      phoneNumber,
      friendlyName,
    )
    res.status(201).json({ data: assignment })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to assign phone number' })
    }
  }
}

export const unassignPhoneNumber: AuthRequestHandler<
  UnassignPhoneNumberRequest
> = async (req, res) => {
  const { organizationId, phoneNumber } = req.validated
  await dialerService.unassignPhoneNumber(organizationId, phoneNumber)
  res.json({ success: true })
}

export const getDialablePhoneNumbers: AuthRequestHandler<
  GetDialablePhoneNumbersRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  try {
    // The rep's own numbers — taken from the session, never from the request,
    // so a caller can't ask for someone else's dialable set.
    const phoneNumbers = await dialerService.getDialablePhoneNumbers(
      organizationId,
      req.user.id,
    )
    res.json({ data: phoneNumbers })
  } catch (error) {
    // Return empty array if Telnyx is not configured
    res.json({ data: [] })
  }
}

export const createTwilioConfig: AuthRequestHandler<
  CreateTwilioConfigRequest
> = async (req, res) => {
  const { organizationId, accountSid, authToken, phoneNumbers } = req.validated
  const config = await dialerService.createTwilioConfig(
    organizationId,
    accountSid,
    authToken,
    phoneNumbers,
  )
  res.status(201).json({ data: config })
}

export const updateTwilioConfig: AuthRequestHandler<
  UpdateTwilioConfigRequest
> = async (req, res) => {
  const { organizationId, ...data } = req.validated
  const config = await dialerService.updateTwilioConfig(organizationId, data)
  res.json({ data: config })
}

// === Capability Token Controller ===

export const getCapabilityToken: AuthRequestHandler<
  GetCapabilityTokenRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { identity } = req.validated
  try {
    const token = await dialerService.getCapabilityToken(
      organizationId,
      req.user.id,
      identity,
    )
    res.json({ data: token })
  } catch (error) {
    console.error('Failed to get capability token:', error)
    if (error instanceof Error) {
      // Check for specific Telnyx configuration errors
      if (
        error.message.includes('TELNYX_API_KEY') ||
        error.message.includes('TELNYX_TEXML_APP_ID') ||
        error.message.includes('TELNYX_CREDENTIAL_CONNECTION_ID') ||
        error.message.includes('TELNYX_SIP_SUBDOMAIN')
      ) {
        return res.status(500).json({
          error:
            'Telnyx browser calling is not configured. Please contact your administrator.',
        })
      }
      if (
        error.message.includes('not found') ||
        error.message.includes('not configured')
      ) {
        return res.status(400).json({ error: error.message })
      }
      return res
        .status(500)
        .json({ error: 'Failed to generate capability token' })
    }
    return res
      .status(500)
      .json({ error: 'Failed to generate capability token' })
  }
}

// === Call Controllers ===

export const initiateCall: AuthRequestHandler<InitiateCallRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res
      .status(400)
      .json({ error: 'Telnyx not configured for this organization' })
  }

  const { toNumber, fromNumber, leadId, campaignId } = req.validated

  // Validate required fields
  if (!toNumber) {
    return res.status(400).json({ error: 'Phone number is required' })
  }

  const normalizedToNumber = validateAndNormalizePhone(toNumber)
  if (!normalizedToNumber) {
    return res.status(400).json({
      error:
        'Invalid destination phone number. Enter a valid phone number (for example, +14155551234).',
    })
  }

  const normalizedFromNumber = validateAndNormalizePhone(fromNumber)
  if (!normalizedFromNumber) {
    return res.status(400).json({
      error:
        'Invalid caller ID. Select a valid caller ID before placing a call.',
    })
  }

  try {
    const call = await dialerService.initiateOutboundCall(
      twilioConfig.id,
      req.user.id,
      normalizedToNumber,
      normalizedFromNumber,
      leadId,
      campaignId,
    )
    res.status(201).json({ data: call })
  } catch (error) {
    const err = error as Error & {
      code?: string
      guardResult?: {
        retryable?: boolean
        httpStatus?: number
        correlationId?: string
      }
    }
    const guardCodes: Record<string, number> = {
      NO_ACTIVE_SUBSCRIPTION: 402,
      ACCOUNT_SUSPENDED: 403,
      ACCOUNT_CANCELED: 403,
      OVERAGE_CAP_HIT: 402,
      DAILY_LIMIT_REACHED: 429,
      BILLING_GUARD_UNAVAILABLE: 503,
    }
    const status =
      err.guardResult?.httpStatus || (err.code && guardCodes[err.code]) || 500
    if (status === 500) {
      console.error('Failed to initiate call:', error)
    }
    return res.status(status).json({
      error: err.message || 'Failed to initiate call',
      code: err.code,
      retryable: err.guardResult?.retryable,
      correlationId: err.guardResult?.correlationId,
    })
  }
}

export const endCall: AuthRequestHandler<GetCallRequest> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  try {
    const call = await dialerService.endActiveCallForOrg(id, organizationId)
    if (!call) {
      return res.status(404).json({ error: 'Call not found' })
    }
    res.json({ data: call })
  } catch (error) {
    console.error('Failed to end call:', error)
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message })
      }
      return res.status(500).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Failed to end call' })
  }
}

export const getCall: AuthRequestHandler<GetCallRequest> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  const call = await dialerService.getCallForOrg(id, organizationId)
  if (!call) {
    return res.status(404).json({ error: 'Call not found' })
  }
  res.json({ data: call })
}

export const listCalls: AuthRequestHandler<ListCallsRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const {
    page,
    limit,
    direction,
    status,
    leadId,
    campaignId,
    userId,
    dispositionId,
    startDate,
    endDate,
  } = req.validated

  // Convert dispositionId: 'null' string to actual null for "No Status" filtering
  const parsedDispositionId = dispositionId === 'null' ? null : dispositionId

  const result = await dialerService.listCalls(
    twilioConfig.id,
    {
      direction,
      status,
      leadId,
      campaignId,
      userId,
      dispositionId: parsedDispositionId,
      startDate,
      endDate,
    },
    { page, limit, offset: (page - 1) * limit },
  )

  res.json({
    data: result.data,
    total: result.total,
    page,
    limit,
  })
}

export const setCallDisposition: AuthRequestHandler<
  UpdateCallDispositionRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, dispositionId } = req.validated
  const call = await dialerService.setCallDispositionForOrg(
    id,
    dispositionId,
    organizationId,
  )
  if (!call) {
    return res.status(404).json({ error: 'Call or disposition not found' })
  }
  res.json({ data: call })
}

export const sendDtmf: AuthRequestHandler<SendDtmfRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, digits } = req.validated
  try {
    await dialerService.sendDtmfDigits(id, organizationId, digits)
    res.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message })
      }
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: 'Failed to send digits' })
  }
}

export const dropVoicemail: AuthRequestHandler<DropVoicemailRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { callId, voicemailDropId } = req.validated
  try {
    const call = await dialerService.dropVoicemailForOrg(
      callId,
      voicemailDropId,
      organizationId,
    )
    res.json({ data: call })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message })
      }
      return res.status(400).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Failed to drop voicemail' })
  }
}

// === Voicemail Drop Controllers ===

export const listVoicemailDrops: AuthRequestHandler<
  ListVoicemailDropsRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { page, limit } = req.validated
  const result = await dialerService.listVoicemailDrops(
    twilioConfig.id,
    req.user.id,
    { page, limit, offset: (page - 1) * limit },
  )

  res.json({
    data: result.data,
    total: result.total,
    page,
    limit,
  })
}

export const createVoicemailDrop: AuthRequestHandler<
  CreateVoicemailDropRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { name, recordingUrl, duration } = req.validated
  const voicemailDrop = await dialerService.createVoicemailDrop(
    twilioConfig.id,
    req.user.id,
    name,
    recordingUrl,
    duration,
  )

  res.status(201).json({ data: voicemailDrop })
}

export const deleteVoicemailDrop: AuthRequestHandler<
  DeleteVoicemailDropRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  const deleted = await dialerService.deleteVoicemailDropForOrg(
    id,
    organizationId,
  )
  if (!deleted) {
    return res.status(404).json({ error: 'Voicemail drop not found' })
  }
  res.json({ success: true })
}

// === Disposition Controllers ===

export const listDispositions: AuthRequestHandler<
  ListDispositionsRequest
> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }

    const twilioConfig = await dialerService.resolveOrgTwilioConfig(
      organizationId,
      req.user.id,
    )
    if (!twilioConfig) {
      return res.status(400).json({ error: 'Telnyx not configured' })
    }

    const { page, limit } = req.validated
    const result = await dialerService.listDispositions(twilioConfig.id, {
      page,
      limit,
      offset: (page - 1) * limit,
    })

    res.json({
      data: result.data,
      total: result.total,
      page,
      limit,
    })
  } catch (error) {
    console.error('Failed to list dispositions:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: `Failed to list dispositions: ${message}` })
  }
}

export const createDisposition: AuthRequestHandler<
  CreateDispositionRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { label, color, sortOrder, isDefault } = req.validated
  const disposition = await dialerService.createDisposition(
    twilioConfig.id,
    label,
    color,
    sortOrder,
    isDefault,
  )

  res.status(201).json({ data: disposition })
}

export const updateDisposition: AuthRequestHandler<
  UpdateDispositionRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, ...data } = req.validated
  const disposition = await dialerService.updateDispositionForOrg(
    id,
    data,
    organizationId,
  )
  if (!disposition) {
    return res.status(404).json({ error: 'Disposition not found' })
  }
  res.json({ data: disposition })
}

export const deleteDisposition: AuthRequestHandler<
  DeleteDispositionRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  const deleted = await dialerService.deleteDispositionForOrg(
    id,
    organizationId,
  )
  if (!deleted) {
    return res.status(404).json({ error: 'Disposition not found' })
  }
  res.json({ success: true })
}

export const getCallRecording: AuthRequestHandler<GetCallRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(401).json({ error: 'No organization found' })
  }

  const { id } = req.validated
  const call = await dialerService.getCallForOrg(id, organizationId)
  if (!call) {
    return res.status(404).json({ error: 'Call not found' })
  }
  if (!call.recordingUrl) {
    return res
      .status(404)
      .json({ error: 'No recording available for this call' })
  }

  // Get Telnyx config to authenticate the recording request
  const telnyxConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!telnyxConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  try {
    // Proxy the recording from Telnyx with proper authentication
    // The API key is stored encrypted, so we need to decrypt it
    const apiKey = decryptAuthToken(telnyxConfig.authTokenEncrypted)

    const response = await fetchRecordingAudio(
      { accountSid: telnyxConfig.accountSid, apiKey },
      call.recordingUrl,
      call.recordingSid ?? undefined,
    )

    if (!response.ok) {
      console.error(
        `Failed to fetch recording: ${response.status} ${response.statusText}`,
      )
      return res.status(response.status).json({
        error: 'Failed to fetch recording from Telnyx',
      })
    }

    // Stream the recording to the client
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') || 'audio/mpeg',
    )
    res.setHeader(
      'Content-Disposition',
      `inline; filename="recording-${call.recordingSid || call.id}.mp3"`,
    )

    const arrayBuffer = await response.arrayBuffer()
    res.send(Buffer.from(arrayBuffer))
  } catch (error) {
    console.error('Error proxying recording:', error)
    return res.status(500).json({ error: 'Failed to fetch recording' })
  }
}

// === Active Dialer Session Controllers ===

export const startDialerSession: AuthRequestHandler<
  StartDialerSessionRequest
> = async (req, res) => {
  const { organizationId, campaignId, listId } = req.validated
  try {
    const session = await activeDialerSessionService.startSession(
      organizationId,
      req.user.id,
      campaignId,
      listId,
    )
    res.status(201).json({ data: session })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to start dialer session' })
    }
  }
}

export const endDialerSession: AuthRequestHandler<
  EndDialerSessionRequest
> = async (req, res) => {
  const { sessionId } = req.validated
  try {
    const session = await activeDialerSessionService.endSession(sessionId)
    res.json({ data: session })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to end dialer session' })
    }
  }
}

export const getActiveSessions: AuthRequestHandler<
  GetActiveSessionsRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  try {
    const sessions =
      await activeDialerSessionService.getActiveSessions(organizationId)
    res.json({ data: sessions })
  } catch (error) {
    res.json({ data: [] })
  }
}

export const getMyActiveSession: AuthRequestHandler<{}> = async (req, res) => {
  try {
    const session = await activeDialerSessionService.getActiveSession(
      req.user.id,
    )
    res.json({ data: session })
  } catch (error) {
    res.json({ data: null })
  }
}

// === AI Disposition Suggestion Controllers ===

export const suggestDisposition: AuthRequestHandler<
  SuggestDispositionRequest
> = async (req, res) => {
  const { id, organizationId, transcript } = req.validated

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  try {
    const result = await dispositionSuggestionService.suggestDispositions(
      id,
      organizationId,
      twilioConfig.id,
      transcript,
    )
    res.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to get disposition suggestions' })
    }
  }
}

// === Voicemail Greeting Controllers ===

export const listVoicemailGreetings: AuthRequestHandler<
  ListVoicemailGreetingsRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const greetings = await dialerService.listVoicemailGreetings(twilioConfig.id)
  res.json({ data: greetings, total: greetings.length })
}

export const createVoicemailGreeting: AuthRequestHandler<
  CreateVoicemailGreetingRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { name, recordingUrl, duration, recordingSid } = req.validated
  const greeting = await dialerService.createVoicemailGreeting(
    twilioConfig.id,
    name,
    recordingUrl,
    duration,
    recordingSid,
  )

  res.status(201).json({ data: greeting })
}

export const setActiveVoicemailGreeting: AuthRequestHandler<
  SetActiveVoicemailGreetingRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { id } = req.validated
  const greeting = await dialerService.setActiveVoicemailGreetingForOrg(
    id,
    twilioConfig.id,
    organizationId,
  )
  if (!greeting) {
    return res.status(404).json({ error: 'Voicemail greeting not found' })
  }
  res.json({ data: greeting })
}

export const deleteVoicemailGreeting: AuthRequestHandler<
  DeleteVoicemailGreetingRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  const deleted = await dialerService.deleteVoicemailGreetingForOrg(
    id,
    organizationId,
  )
  if (!deleted) {
    return res.status(404).json({ error: 'Voicemail greeting not found' })
  }
  res.json({ success: true })
}

// === Voicemail Inbox Controllers ===

export const listVoicemails: AuthRequestHandler<ListVoicemailsRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const { page, limit, unreadOnly } = req.validated
  const result = await dialerService.listVoicemails(
    twilioConfig.id,
    { unreadOnly },
    { page, limit, offset: (page - 1) * limit },
  )

  res.json({
    data: result.data,
    total: result.total,
    unreadCount: result.unreadCount,
    page,
    limit,
  })
}

export const markVoicemailRead: AuthRequestHandler<
  MarkVoicemailReadRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated
  const call = await dialerService.markVoicemailReadForOrg(id, organizationId)
  if (!call) {
    return res.status(404).json({ error: 'Voicemail not found' })
  }
  res.json({ data: call })
}

export const markAllVoicemailsRead: AuthRequestHandler<
  MarkAllVoicemailsReadRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    req.user.id,
  )
  if (!twilioConfig) {
    return res.status(400).json({ error: 'Telnyx not configured' })
  }

  const count = await dialerService.markAllVoicemailsRead(twilioConfig.id)
  res.json({ success: true, count })
}
