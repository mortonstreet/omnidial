import { Router, Request, Response, NextFunction } from 'express'
import { createHash, randomUUID } from 'crypto'
import { VoiceResponse, setDefaultVoice } from '@/lib/texml'
import * as dialerService from '@/services/dialer.service'
import * as parallelDialerService from '@/services/parallelDialer.service'
import * as slackClickToCallService from '@/services/slackClickToCall.service'
import * as slackService from '@/services/slack.service'
import * as agentSmsService from '@/services/agentSms.service'
import * as callRepository from '@/repositories/call.repository'
import * as webhookEventReceiptRepository from '@/repositories/webhookEventReceipt.repository'
import * as telnyxConfigRepository from '@/repositories/twilioConfig.repository'
import * as organizationRepository from '@/repositories/organization.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as agentSmsConfigRepository from '@/repositories/agentSmsConfig.repository'
import * as agentMessageRepository from '@/repositories/agentMessage.repository'
import * as voicemailGreetingRepository from '@/repositories/voicemailGreeting.repository'
import * as telnyxClient from '@/clients/telnyx.client'
import {
  sendMessage,
  verifyTelnyxSignature,
  findTelephonyCredentialSipUsername,
} from '@/lib/telnyx'
import { config } from '@/config'
import { resolveCallStatusTransition } from '@/lib/callState'
import { validateAndNormalizePhone } from '@/lib/phone'
import logger from '@/lib/logger'
import * as usageTrackingService from '@/services/usageTracking.service'

// Helper to resolve organizationId from a call record
const resolveOrgIdFromCallId = async (
  callId: string,
): Promise<string | null> => {
  try {
    const call = await callRepository.findById(callId)
    if (!call) return null
    const cfg = await telnyxConfigRepository.findById(call.twilioConfigId)
    return cfg?.organizationId ?? null
  } catch {
    return null
  }
}

// Helper to record usage for a completed call
const recordCallUsage = async (callId: string, duration: number) => {
  if (duration <= 0) return
  try {
    const orgId = await resolveOrgIdFromCallId(callId)
    if (orgId) {
      await usageTrackingService.recordCallMinutes(orgId, duration)
    }
  } catch (err) {
    logger.warn({ err, callId, duration }, 'Failed to record call usage')
  }
}

const sendInboundSlackNotification = (
  organizationId: string,
  call: {
    id: string
    fromNumber: string
    toNumber: string
    leadId?: string | null
  },
) => {
  void slackService
    .sendInboundCallNotification(organizationId, call)
    .catch((error) => {
      logger.error(
        { error, organizationId, callId: call.id },
        'Failed to send inbound Slack notification',
      )
    })
}

// Every TeXML <Say> in this file speaks to a prospect, so default them all to
// the configured neural voice instead of Telnyx's robotic basic voices.
setDefaultVoice(config.telnyxTtsVoice)

const router = Router()
const WEBHOOK_PROVIDER = 'telnyx'

type TelnyxWebhookClaim = {
  eventKey: string
  duplicate: boolean
}

const compactDefined = <T extends object>(values: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }
  return undefined
}

const normalizeRecordingUrl = (value: unknown): string | null => {
  const recordingUrl = firstString(value)
  if (!recordingUrl) return null
  return recordingUrl
}

const getRawBodyString = (req: Request): string | null => {
  const rawBody = (req as Request & { rawBody?: string | Buffer }).rawBody
  if (typeof rawBody === 'string') {
    return rawBody
  }
  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString('utf8')
  }
  return null
}

const buildTelnyxEventKey = (
  routeKey: string,
  ids: Array<string | null | undefined>,
  eventState?: string | null,
): string | null => {
  const normalized = ids
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    .map((id) => encodeURIComponent(id.trim()))

  if (normalized.length === 0) {
    return null
  }

  if (eventState && eventState.trim() !== '') {
    normalized.push(encodeURIComponent(eventState.trim()))
  }

  return `${routeKey}:${normalized.join(':')}`
}

const claimTelnyxWebhookEvent = async (
  req: Request,
  options: {
    routeKey: string
    ids: Array<string | null | undefined>
    eventState?: string | null
  },
): Promise<TelnyxWebhookClaim | null> => {
  const eventKey = buildTelnyxEventKey(
    options.routeKey,
    options.ids,
    options.eventState,
  )
  if (!eventKey) {
    return null
  }

  const rawBody = getRawBodyString(req)
  const payloadHash = rawBody
    ? createHash('sha256').update(rawBody).digest('hex')
    : undefined

  try {
    const claim = await webhookEventReceiptRepository.claimForProcessing({
      provider: WEBHOOK_PROVIDER,
      eventId: eventKey,
      eventType: options.routeKey,
      hash: payloadHash,
    })

    if (
      claim.status === 'duplicate_processed' ||
      claim.status === 'duplicate_processing'
    ) {
      if (claim.hashMismatch) {
        logger.warn(
          {
            routeKey: options.routeKey,
            eventKey,
          },
          'Telnyx webhook replay had mismatched payload hash',
        )
      }
      return {
        eventKey,
        duplicate: true,
      }
    }

    return {
      eventKey,
      duplicate: false,
    }
  } catch (error) {
    logger.error(
      { error, routeKey: options.routeKey, eventKey },
      'Failed to claim Telnyx webhook receipt',
    )
    return null
  }
}

const markTelnyxWebhookProcessed = async (claim: TelnyxWebhookClaim | null) => {
  if (!claim || claim.duplicate) {
    return
  }

  try {
    await webhookEventReceiptRepository.markProcessed(
      WEBHOOK_PROVIDER,
      claim.eventKey,
    )
  } catch (error) {
    logger.error(
      { error, eventKey: claim.eventKey },
      'Failed to mark Telnyx webhook receipt as processed',
    )
  }
}

const markTelnyxWebhookFailed = async (claim: TelnyxWebhookClaim | null) => {
  if (!claim || claim.duplicate) {
    return
  }

  try {
    await webhookEventReceiptRepository.markFailed(
      WEBHOOK_PROVIDER,
      claim.eventKey,
    )
  } catch (error) {
    logger.error(
      { error, eventKey: claim.eventKey },
      'Failed to mark Telnyx webhook receipt as failed',
    )
  }
}

type CallRecord = Awaited<ReturnType<typeof callRepository.findById>>

const applyCallUpdateWithPrecedence = async (
  currentCall: CallRecord,
  applyUpdate: (data: callRepository.UpdateCallInput) => Promise<CallRecord>,
  data: callRepository.UpdateCallInput,
): Promise<{
  call: CallRecord
  previousStatus: string | undefined
  statusChanged: boolean
}> => {
  if (!currentCall) {
    return {
      call: undefined,
      previousStatus: undefined,
      statusChanged: false,
    }
  }

  const previousStatus = currentCall.status
  const updateData = compactDefined(data) as callRepository.UpdateCallInput

  if (updateData.status) {
    const resolvedStatus = resolveCallStatusTransition(
      currentCall.status,
      updateData.status,
    )

    if (!resolvedStatus) {
      delete updateData.status
    } else {
      updateData.status = resolvedStatus
    }
  }

  if (Object.keys(updateData).length === 0) {
    return {
      call: currentCall,
      previousStatus,
      statusChanged: false,
    }
  }

  const updatedCall = await applyUpdate(updateData)

  return {
    call: updatedCall ?? currentCall,
    previousStatus,
    statusChanged: !!updatedCall && updatedCall.status !== previousStatus,
  }
}

const updateCallByIdWithPrecedence = async (
  callId: string,
  data: callRepository.UpdateCallInput,
) => {
  const currentCall = await callRepository.findById(callId)
  return applyCallUpdateWithPrecedence(
    currentCall,
    (updateData) => callRepository.update(callId, updateData),
    data,
  )
}

const updateCallBySidWithPrecedence = async (
  callSid: string,
  data: callRepository.UpdateCallInput,
) => {
  const currentCall = await callRepository.findByTwilioCallSid(callSid)
  return applyCallUpdateWithPrecedence(
    currentCall,
    (updateData) => callRepository.updateByTwilioCallSid(callSid, updateData),
    data,
  )
}

// ============================================
// TELNYX SIGNATURE VERIFICATION MIDDLEWARE
// ============================================

/**
 * Verify Telnyx webhook request signature (Ed25519).
 * Telnyx signs `${telnyx-timestamp}|${rawBody}` with the account's key;
 * we verify against the base64 public key in TELNYX_PUBLIC_KEY.
 * In production, all requests must be signed. In development,
 * verification is optional unless VERIFY_TELNYX_SIGNATURE is set.
 */
const verifyTelnyxWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (config.nodeEnv !== 'production' && !process.env.VERIFY_TELNYX_SIGNATURE) {
    return next()
  }

  const publicKey = process.env.TELNYX_PUBLIC_KEY
  if (!publicKey) {
    const correlationId = randomUUID()
    logger.error(
      {
        correlationId,
        route: req.originalUrl,
        method: req.method,
        reason: 'missing_public_key',
      },
      'Telnyx webhook signature verification failed — TELNYX_PUBLIC_KEY not configured',
    )
    return res.status(403).send('Forbidden')
  }

  const signatureHeader = req.headers['telnyx-signature-ed25519'] as
    | string
    | undefined
  const timestampHeader = req.headers['telnyx-timestamp'] as string | undefined
  const rawBody = getRawBodyString(req)

  if (!signatureHeader || !timestampHeader || rawBody === null) {
    const correlationId = randomUUID()
    logger.warn(
      {
        correlationId,
        route: req.originalUrl,
        method: req.method,
        reason: 'missing_signature',
      },
      'Telnyx webhook signature verification failed',
    )
    return res.status(403).send('Forbidden')
  }

  const isValid = verifyTelnyxSignature({
    publicKey,
    signatureHeader,
    timestampHeader,
    rawBody,
  })

  if (!isValid) {
    const correlationId = randomUUID()
    logger.warn(
      {
        correlationId,
        route: req.originalUrl,
        method: req.method,
        reason: 'invalid_signature',
      },
      'Telnyx webhook signature verification failed',
    )
    return res.status(403).send('Forbidden')
  }

  next()
}

// Apply signature verification to all routes
router.use(verifyTelnyxWebhookSignature)

/**
 * Ring org members' browser clients. WebRTC credentials live on the shared
 * credential connection, so each member is dialed at their credential's SIP
 * URI (TeXML `<Client>` only reaches clients on the TeXML app's own
 * connection). Members who never fetched a WebRTC token are skipped.
 */
const dialMembersViaSip = async (
  dial: ReturnType<VoiceResponse['dial']>,
  organizationId: string,
  members: Array<{ userId: string }>,
) => {
  const client = await telnyxClient.getClientForOrganization(organizationId)
  const credentialConnectionId = process.env.TELNYX_CREDENTIAL_CONNECTION_ID
  let targets = 0
  for (const member of members) {
    try {
      const sipUsername = await findTelephonyCredentialSipUsername(
        client.apiKey,
        member.userId,
        credentialConnectionId,
      )
      if (sipUsername) {
        dial.sip(`sip:${sipUsername}@sip.telnyx.com`)
        targets += 1
      }
    } catch (error) {
      logger.warn(
        { error, userId: member.userId },
        'Failed to resolve SIP credential for member',
      )
    }
  }
  if (targets === 0) {
    // No registered browser clients — fall back to <Client> so TeXML can
    // still attempt delivery on the app's own connection.
    for (const member of members) {
      dial.client(member.userId)
    }
  }
}

// ============================================
// WEBRTC DESTINATION PARSING
// ============================================

/**
 * Browser-originated calls encode routing intent in the dialed destination
 * (`callid-{uuid}` for outbound calls, `conf-{name}` for conference joins),
 * since TeXML applications receive the dialed destination as `To`.
 * Accepts bare values or SIP URIs (`sip:callid-xxx@sip.telnyx.com`).
 */
const parseSdkDestination = (
  to: unknown,
): { callId?: string; conferenceId?: string } => {
  if (typeof to !== 'string' || to.trim() === '') return {}

  let destination = to.trim()
  const sipMatch = destination.match(/^sips?:([^@;]+)/i)
  if (sipMatch) {
    destination = decodeURIComponent(sipMatch[1])
  }
  // TeXML webhook payloads can omit the `sip:` scheme while keeping the host.
  destination = destination.split('@')[0]?.split(';')[0]?.trim() || ''

  if (destination.startsWith('callid-')) {
    return { callId: destination.slice('callid-'.length) }
  }
  if (destination.startsWith('conf-')) {
    return { conferenceId: destination.slice('conf-'.length) }
  }
  return {}
}

// ============================================
// VOICE WEBHOOKS
// ============================================

/**
 * Voice webhook - called when a call is initiated via the Telnyx WebRTC SDK
 * (TeXML application voice URL) or arrives inbound on a TeXML number.
 */
router.post('/voice', async (req: Request, res: Response) => {
  const { To, From, Direction, CallSid } = req.body
  const parsedDestination = parseSdkDestination(To)
  const callId =
    typeof req.body.callId === 'string'
      ? req.body.callId
      : parsedDestination.callId
  const conferenceId =
    typeof req.body.conferenceId === 'string'
      ? req.body.conferenceId
      : parsedDestination.conferenceId

  logger.info(
    { callId, direction: Direction, conferenceId },
    'Voice webhook received',
  )

  const response = new VoiceResponse()
  const toParam = typeof To === 'string' ? To.trim() : ''
  const fromParam = typeof From === 'string' ? From.trim() : ''

  try {
    if (conferenceId) {
      const dial = response.dial()
      dial.conference(
        {
          startConferenceOnEnter: true,
          endConferenceOnExit: true,
          beep: 'false',
          waitUrl: '',
        },
        conferenceId,
      )
      res.type('text/xml')
      return res.send(response.toString())
    }

    const isOutboundFromSDK = typeof callId === 'string'

    if (typeof callId === 'string' && CallSid) {
      await updateCallByIdWithPrecedence(callId, {
        twilioCallSid: CallSid,
        status: 'ringing',
      })
    }

    if (isOutboundFromSDK) {
      const call = await callRepository.findById(callId)
      if (!call) {
        logger.error({ callId }, 'Call record not found')
        response.say('Call failed. Please try again.')
        response.hangup()
        res.type('text/xml')
        return res.send(response.toString())
      }

      const telnyxConfig = await telnyxConfigRepository.findById(
        call.twilioConfigId,
      )
      if (!telnyxConfig) {
        logger.error({ callId }, 'Telnyx config not found')
        response.say('Call failed. Dialer not configured.')
        response.hangup()
        res.type('text/xml')
        return res.send(response.toString())
      }

      const normalizedToNumber = validateAndNormalizePhone(call.toNumber)
      const normalizedFromNumber =
        validateAndNormalizePhone(call.fromNumber) ||
        (fromParam ? validateAndNormalizePhone(fromParam) : null)

      if (!normalizedToNumber || !normalizedFromNumber) {
        logger.error(
          {
            callId,
            callToNumber: call.toNumber,
            callFromNumber: call.fromNumber,
            toParam,
            fromParam,
          },
          'Outbound call has invalid phone number(s)',
        )
        response.say('Call failed. Invalid phone number format.')
        response.hangup()
        res.type('text/xml')
        return res.send(response.toString())
      }

      const dial = response.dial({
        callerId: normalizedFromNumber,
        timeout: 30,
        record: 'record-from-answer-dual',
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed'],
        recordingStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/recording?callId=${callId}`,
        action: `${config.backendUrl}/api/webhooks/telnyx/dial-status?callId=${callId}`,
      })
      dial.number(
        {
          statusCallback: `${config.backendUrl}/api/webhooks/telnyx/dial-events?callId=${callId}`,
          statusCallbackEvent: [
            'initiated',
            'ringing',
            'answered',
            'completed',
          ],
        },
        normalizedToNumber,
      )
    } else {
      logger.info({ direction: 'inbound' }, 'Routing inbound call')

      const telnyxConfig = await telnyxConfigRepository.findByPhoneNumber(To)

      if (!telnyxConfig) {
        logger.warn('No organization found for inbound number')
        response.say(
          'Sorry, this number is not configured to receive calls. Please try again later.',
        )
        response.hangup()
        res.type('text/xml')
        return res.send(response.toString())
      }

      const members = await organizationRepository.findMembersByOrganizationId(
        telnyxConfig.organizationId,
      )

      if (members.length === 0) {
        logger.warn(
          { orgId: telnyxConfig.organizationId },
          'No members found for org',
        )
        response.say(
          'Sorry, no one is available to take your call. Please try again later.',
        )
        response.hangup()
        res.type('text/xml')
        return res.send(response.toString())
      }

      let matchedLead = null
      try {
        matchedLead = await leadRepository.findByPhone(
          telnyxConfig.organizationId,
          From,
        )
        if (matchedLead) {
          logger.debug({ leadId: matchedLead.id }, 'Matched caller to lead')
        }
      } catch (error) {
        logger.error({ error }, 'Error matching caller to lead')
      }

      const existingCall = CallSid
        ? await callRepository.findByTwilioCallSid(CallSid)
        : null

      const callRecord =
        existingCall ??
        (await callRepository.create({
          twilioConfigId: telnyxConfig.id,
          userId: members[0].userId,
          leadId: matchedLead?.id,
          twilioCallSid: CallSid,
          fromNumber: From,
          toNumber: To,
          direction: 'inbound',
          status: 'ringing',
        }))

      logger.info(
        {
          callId: callRecord.id,
          leadId: matchedLead?.id,
          reusedExisting: !!existingCall,
        },
        'Resolved inbound call record',
      )

      if (!existingCall) {
        sendInboundSlackNotification(telnyxConfig.organizationId, {
          id: callRecord.id,
          fromNumber: callRecord.fromNumber,
          toNumber: callRecord.toNumber,
          leadId: callRecord.leadId,
        })
      }

      const dial = response.dial({
        callerId: From,
        timeout: 30,
        record: 'record-from-answer-dual',
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed'],
        recordingStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/recording?callId=${callRecord.id}`,
        action: `${config.backendUrl}/api/webhooks/telnyx/voice/inbound/status?callId=${callRecord.id}`,
      })

      await dialMembersViaSip(dial, telnyxConfig.organizationId, members)
    }
  } catch (error) {
    logger.error({ error }, 'Error handling voice webhook')
    response.say('An error occurred. Please try again later.')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Inbound call webhook - alternative endpoint for specific Telnyx numbers
 */
router.post('/voice/inbound', async (req: Request, res: Response) => {
  const { CallSid, From, To } = req.body

  logger.info({ direction: 'inbound' }, 'Inbound voice webhook received')

  const response = new VoiceResponse()

  try {
    const telnyxConfig = await telnyxConfigRepository.findByPhoneNumber(To)

    if (!telnyxConfig) {
      logger.warn('No organization found for inbound number')
      response.say(
        'Sorry, this number is not configured to receive calls. Please try again later.',
      )
      response.hangup()
      res.type('text/xml')
      return res.send(response.toString())
    }

    const members = await organizationRepository.findMembersByOrganizationId(
      telnyxConfig.organizationId,
    )

    if (members.length === 0) {
      logger.warn(
        { orgId: telnyxConfig.organizationId },
        'No members found for org',
      )
      response.say(
        'Sorry, no one is available to take your call. Please try again later.',
      )
      response.hangup()
      res.type('text/xml')
      return res.send(response.toString())
    }

    let matchedLead = null
    try {
      matchedLead = await leadRepository.findByPhone(
        telnyxConfig.organizationId,
        From,
      )
      if (matchedLead) {
        logger.debug({ leadId: matchedLead.id }, 'Matched caller to lead')
      }
    } catch (error) {
      logger.error({ error }, 'Error matching caller to lead')
    }

    const existingCall = CallSid
      ? await callRepository.findByTwilioCallSid(CallSid)
      : null

    const callRecord =
      existingCall ??
      (await callRepository.create({
        twilioConfigId: telnyxConfig.id,
        userId: members[0].userId,
        leadId: matchedLead?.id,
        twilioCallSid: CallSid,
        fromNumber: From,
        toNumber: To,
        direction: 'inbound',
        status: 'ringing',
      }))

    logger.info(
      {
        callId: callRecord.id,
        leadId: matchedLead?.id,
        reusedExisting: !!existingCall,
      },
      'Resolved inbound call record',
    )

    if (!existingCall) {
      sendInboundSlackNotification(telnyxConfig.organizationId, {
        id: callRecord.id,
        fromNumber: callRecord.fromNumber,
        toNumber: callRecord.toNumber,
        leadId: callRecord.leadId,
      })
    }

    const dial = response.dial({
      callerId: From,
      timeout: 30,
      action: `${config.backendUrl}/api/webhooks/telnyx/voice/inbound/status?callId=${callRecord.id}`,
      record: 'record-from-answer-dual',
      recordingStatusCallbackMethod: 'POST',
      recordingStatusCallbackEvent: ['completed'],
      recordingStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/recording?callId=${callRecord.id}`,
    })

    await dialMembersViaSip(dial, telnyxConfig.organizationId, members)
  } catch (error) {
    logger.error({ error }, 'Error handling inbound call')
    response.say(
      'Sorry, we cannot take your call right now. Please try again later.',
    )
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Inbound call status webhook - called after dial completes
 */
router.post('/voice/inbound/status', async (req: Request, res: Response) => {
  const { callId } = req.query
  const { CallSid, DialCallStatus, DialCallDuration } = req.body

  logger.info(
    { callId, dialCallStatus: DialCallStatus },
    'Inbound status webhook',
  )

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'voice/inbound/status',
    ids: [typeof callId === 'string' ? callId : null, CallSid],
    eventState: DialCallStatus,
  })

  if (claim?.duplicate) {
    response.hangup()
    res.type('text/xml')
    return res.send(response.toString())
  }

  try {
    const duration = DialCallDuration ? parseInt(DialCallDuration, 10) : 0

    if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy') {
      if (typeof callId === 'string') {
        await updateCallByIdWithPrecedence(callId, {
          status: 'missed',
          endedAt: new Date(),
        })
      } else if (CallSid) {
        await updateCallBySidWithPrecedence(CallSid, {
          status: 'missed',
          endedAt: new Date(),
        })
      }

      let usedCustomGreeting = false
      if (typeof callId === 'string') {
        try {
          const call = await callRepository.findById(callId)
          if (call) {
            const activeGreeting =
              await voicemailGreetingRepository.findActiveByTwilioConfigId(
                call.twilioConfigId,
              )
            if (activeGreeting) {
              response.play(activeGreeting.recordingUrl)
              usedCustomGreeting = true
            }
          }
        } catch (error) {
          logger.error({ error }, 'Error looking up voicemail greeting')
        }
      }

      if (!usedCustomGreeting) {
        response.say(
          "Hi, thanks for calling. We can't pick up right now, but leave your name, number, and a quick message after the tone and we'll get right back to you.",
        )
      }

      // `action` alone is not enough to capture a voicemail. It fires when the
      // <Record> verb ends and hands back the next TeXML, but a caller who
      // simply hangs up — the normal way people finish a voicemail — does not
      // reliably trigger it, which silently dropped recordings on the floor.
      // `recordingStatusCallback` fires when the recording becomes available
      // regardless of how it ended, so it is the durable capture path; `action`
      // stays for the "thanks, goodbye" prompt when the caller doesn't hang up.
      response.record({
        maxLength: 120,
        // End on ~5s of silence so the recording closes cleanly instead of
        // relying on the caller hanging up or waiting out maxLength.
        timeout: 5,
        playBeep: true,
        action: `${config.backendUrl}/api/webhooks/telnyx/voicemail?callId=${callId || ''}`,
        recordingStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/recording?callId=${callId || ''}&voicemail=1`,
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed'],
      })
    } else if (
      DialCallStatus === 'completed' ||
      DialCallStatus === 'answered'
    ) {
      if (typeof callId === 'string') {
        const updateResult = await updateCallByIdWithPrecedence(callId, {
          status: 'completed',
          answeredAt: new Date(),
          endedAt: new Date(),
          duration,
        })

        if (
          updateResult.statusChanged &&
          updateResult.call?.status === 'completed'
        ) {
          await recordCallUsage(callId, duration)
        }
      } else if (CallSid) {
        await updateCallBySidWithPrecedence(CallSid, {
          status: 'completed',
          answeredAt: new Date(),
          endedAt: new Date(),
          duration,
        })
      }
      response.hangup()
    } else {
      if (typeof callId === 'string') {
        await updateCallByIdWithPrecedence(callId, {
          status: 'failed',
          endedAt: new Date(),
        })
      }
      response.hangup()
    }

    await markTelnyxWebhookProcessed(claim)
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling inbound status')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Dial status webhook - called when dial verb completes (outbound calls)
 */
router.post('/dial-status', async (req: Request, res: Response) => {
  const { callId, DialCallStatus, DialCallDuration, CallSid, DialCallSid } =
    req.body

  logger.info({ callId, dialCallStatus: DialCallStatus }, 'Dial status webhook')

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'dial-status',
    ids: [callId, CallSid, DialCallSid],
    eventState: DialCallStatus,
  })

  if (claim?.duplicate) {
    response.hangup()
    res.type('text/xml')
    return res.send(response.toString())
  }

  try {
    if (typeof callId === 'string') {
      const duration = DialCallDuration ? parseInt(DialCallDuration, 10) : 0

      if (DialCallStatus === 'completed' || DialCallStatus === 'answered') {
        const updateResult = await updateCallByIdWithPrecedence(callId, {
          status: 'completed',
          answeredAt: new Date(),
          endedAt: new Date(),
          duration,
          dialCallSid: DialCallSid,
        })

        if (
          updateResult.statusChanged &&
          updateResult.call?.status === 'completed'
        ) {
          await recordCallUsage(callId, duration)
        }
      } else if (
        DialCallStatus === 'busy' ||
        DialCallStatus === 'no-answer' ||
        DialCallStatus === 'failed' ||
        DialCallStatus === 'canceled'
      ) {
        await updateCallByIdWithPrecedence(callId, {
          status: 'failed',
          endedAt: new Date(),
          dialCallSid: DialCallSid,
        })
      }
    }

    await markTelnyxWebhookProcessed(claim)
    response.hangup()
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling dial status')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Dial events webhook - called for child call (outbound leg) status changes
 */
router.post('/dial-events', async (req: Request, res: Response) => {
  const { callId, CallSid, CallStatus } = req.body

  logger.debug({ callId, callStatus: CallStatus }, 'Dial event received')
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'dial-events',
    ids: [callId, CallSid],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (typeof callId === 'string' && CallSid) {
      const updateData: callRepository.UpdateCallInput = {
        dialCallSid: CallSid,
      }
      if (CallStatus === 'ringing') {
        updateData.status = 'ringing'
      } else if (CallStatus === 'in-progress' || CallStatus === 'answered') {
        updateData.status = 'in-progress'
        updateData.answeredAt = new Date()
      }

      await updateCallByIdWithPrecedence(callId, updateData)
    }

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling dial events')
    res.status(500).send('Error')
  }
})

/**
 * Call status callback - called for each status change
 */
router.post('/status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration, Direction } = req.body

  logger.debug(
    { callStatus: CallStatus, direction: Direction },
    'Status callback',
  )
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'status',
    ids: [CallSid],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    let status = CallStatus
    if (CallStatus === 'in-progress') {
      status = 'in-progress'
    } else if (CallStatus === 'completed') {
      status = 'completed'
    } else if (
      CallStatus === 'busy' ||
      CallStatus === 'no-answer' ||
      CallStatus === 'canceled'
    ) {
      status = Direction === 'inbound' ? 'missed' : 'failed'
    } else if (CallStatus === 'failed') {
      status = 'failed'
    }

    if (CallSid) {
      await dialerService.updateCallStatus(
        CallSid,
        status,
        CallDuration ? parseInt(CallDuration, 10) : undefined,
      )
    }

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling status callback')
    res.status(500).send('Error')
  }
})

/**
 * Recording callback - called when a recording is ready
 */
router.post('/recording', async (req: Request, res: Response) => {
  const { callId } = req.query
  // Set by the voicemail <Record> verb so this handler knows the recording is a
  // voicemail rather than a recorded conversation, and flags it for the inbox.
  const isVoicemail = req.query.voicemail === '1'
  const CallSid = firstString(req.body.CallSid, req.body.call_sid)
  const ConferenceSid = firstString(
    req.body.ConferenceSid,
    req.body.conference_sid,
  )
  const RecordingSid = firstString(
    req.body.RecordingSid,
    req.body.recording_sid,
  )
  const RecordingStatus =
    firstString(req.body.RecordingStatus, req.body.recording_status) ||
    'completed'
  const recordingUrl = normalizeRecordingUrl(
    req.body.RecordingUrl ?? req.body.recording_url,
  )

  logger.info(
    { callId, recordingStatus: RecordingStatus },
    'Recording callback',
  )
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'recording',
    ids: [
      typeof callId === 'string' ? callId : null,
      CallSid,
      ConferenceSid,
      RecordingSid,
    ],
    eventState: RecordingStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (RecordingStatus === 'completed' && recordingUrl) {
      let updated = null

      // A voicemail recording also needs the inbox flag — the inbox query
      // requires both voicemailLeft AND a non-null recordingUrl, so setting
      // only one leaves the voicemail invisible in the UI.
      const voicemailFields = isVoicemail ? { voicemailLeft: true } : {}

      if (typeof callId === 'string') {
        updated = await callRepository.update(
          callId,
          compactDefined({
            recordingUrl,
            recordingSid: RecordingSid,
            ...voicemailFields,
          }) as callRepository.UpdateCallInput,
        )
      }

      if (!updated && CallSid) {
        updated = isVoicemail
          ? await callRepository.updateByTwilioCallSid(
              CallSid,
              compactDefined({
                recordingUrl,
                recordingSid: RecordingSid,
                ...voicemailFields,
              }) as callRepository.UpdateCallInput,
            )
          : await dialerService.updateCallRecording(
              CallSid,
              recordingUrl,
              RecordingSid,
            )
      }

      if (!updated && ConferenceSid) {
        updated = await callRepository.updateByConferenceSid(
          ConferenceSid,
          compactDefined({
            recordingUrl,
            recordingSid: RecordingSid,
            ...voicemailFields,
          }) as callRepository.UpdateCallInput,
        )
      }

      if (!updated) {
        logger.warn(
          { callId, conferenceSid: ConferenceSid },
          'Could not find call for recording',
        )
      }
    }

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling recording callback')
    res.status(500).send('Error')
  }
})

/**
 * Voicemail webhook - called when a voicemail is left
 */
router.post('/voicemail', async (req: Request, res: Response) => {
  const { callId } = req.query
  const CallSid = firstString(req.body.CallSid, req.body.call_sid)
  const RecordingSid = firstString(
    req.body.RecordingSid,
    req.body.recording_sid,
  )
  const RecordingDuration = firstString(
    req.body.RecordingDuration,
    req.body.recording_duration,
  )
  const recordingUrl = normalizeRecordingUrl(
    req.body.RecordingUrl ?? req.body.recording_url,
  )

  logger.info({ callId, RecordingDuration }, 'Voicemail webhook received')

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'voicemail',
    ids: [typeof callId === 'string' ? callId : null, CallSid, RecordingSid],
    eventState: RecordingDuration,
  })

  if (claim?.duplicate) {
    response.say('Thank you for your message. Goodbye.')
    response.hangup()
    res.type('text/xml')
    return res.send(response.toString())
  }

  try {
    if (recordingUrl) {
      const duration = RecordingDuration
        ? parseInt(RecordingDuration, 10)
        : undefined

      if (typeof callId === 'string') {
        await updateCallByIdWithPrecedence(
          callId,
          compactDefined({
            recordingUrl,
            recordingSid: RecordingSid,
            voicemailLeft: true,
            status: 'completed',
            duration,
            endedAt: new Date(),
          }) as callRepository.UpdateCallInput,
        )
      } else if (CallSid) {
        // Fallback: update by CallSid — still mark as voicemail
        await updateCallBySidWithPrecedence(
          CallSid,
          compactDefined({
            recordingUrl,
            recordingSid: RecordingSid,
            voicemailLeft: true,
            status: 'completed',
            duration,
            endedAt: new Date(),
          }) as callRepository.UpdateCallInput,
        )
      }
    }

    await markTelnyxWebhookProcessed(claim)
    response.say('Thank you for your message. Goodbye.')
    response.hangup()
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling voicemail')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Greeting Record webhook - Returns TeXML for recording a voicemail greeting
 */
router.post('/greeting-record', async (_req: Request, res: Response) => {
  logger.debug('Greeting record webhook received')

  const response = new VoiceResponse()

  response.say(
    'Please record your voicemail greeting after the beep. Press the pound key when finished.',
  )
  response.record({
    maxLength: 120,
    finishOnKey: '#',
    action: `${config.backendUrl}/api/webhooks/telnyx/greeting-recorded`,
    playBeep: true,
  })

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Greeting Recorded webhook - Called after a greeting recording is completed
 */
router.post('/greeting-recorded', async (req: Request, res: Response) => {
  const { RecordingUrl } = req.body

  logger.info({ hasRecording: !!RecordingUrl }, 'Greeting recorded webhook')

  const response = new VoiceResponse()

  try {
    if (RecordingUrl) {
      response.say('Your greeting has been recorded. Goodbye.')
    } else {
      response.say('No recording was received. Please try again.')
    }
    response.hangup()
  } catch (error) {
    logger.error({ error }, 'Error handling greeting recorded')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

// ============================================
// PARALLEL DIAL WEBHOOKS
// ============================================

/**
 * Parallel Dial Answered webhook
 */
router.post('/parallel-dial-answered', async (req: Request, res: Response) => {
  const { attemptId, sessionId } = req.query
  const { CallSid, CallStatus } = req.body

  logger.info({ attemptId, callStatus: CallStatus }, 'Parallel dial answered')

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'parallel-dial-answered',
    ids: [
      typeof attemptId === 'string' ? attemptId : null,
      typeof sessionId === 'string' ? sessionId : null,
      CallSid,
    ],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    if (typeof sessionId === 'string') {
      const session = await parallelDialerService.getSession(sessionId)
      if (session?.conferenceId) {
        const dial = response.dial()
        dial.conference(
          {
            startConferenceOnEnter: true,
            endConferenceOnExit: false,
            beep: 'false',
            waitUrl: '',
          },
          session.conferenceId,
        )
      } else {
        response.hangup()
      }
    } else {
      response.hangup()
    }
    res.type('text/xml')
    return res.send(response.toString())
  }

  try {
    if (!attemptId || typeof attemptId !== 'string') {
      logger.error('Missing attemptId in parallel dial answered webhook')
      response.say('Call failed due to system error.')
      response.hangup()
      await markTelnyxWebhookProcessed(claim)
      res.type('text/xml')
      return res.send(response.toString())
    }

    const result = await parallelDialerService.handleCallAnswered(
      attemptId,
      CallSid,
    )

    logger.info(
      {
        conferenceId: result.conferenceId,
        abandonedCount: result.abandonedCount,
      },
      'Lead connected to conference',
    )

    const dial = response.dial()
    dial.conference(
      {
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
        beep: 'false',
        waitUrl: '',
        record: 'record-from-start',
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed'],
        recordingStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/recording`,
      },
      result.conferenceId,
    )

    await markTelnyxWebhookProcessed(claim)
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling parallel dial answered webhook')
    response.say('An error occurred connecting your call.')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Parallel Dial Abandoned webhook
 */
router.post(
  '/parallel-dial-abandoned',
  async (_req: Request, res: Response) => {
    logger.debug('Parallel dial abandoned webhook')

    const response = new VoiceResponse()

    try {
      response.say(
        { voice: 'Polly.Joanna' },
        'Thank you for your patience. We will call you back shortly.',
      )
      response.hangup()
    } catch (error) {
      logger.error({ error }, 'Error handling parallel dial abandoned webhook')
      response.hangup()
    }

    res.type('text/xml')
    res.send(response.toString())
  },
)

/**
 * Parallel Dial AMD webhook
 */
router.post('/parallel-dial-amd', async (req: Request, res: Response) => {
  const { attemptId } = req.query
  const { CallSid, AnsweredBy } = req.body

  logger.info({ attemptId, answeredBy: AnsweredBy }, 'Parallel dial AMD')
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'parallel-dial-amd',
    ids: [typeof attemptId === 'string' ? attemptId : null, CallSid],
    eventState: AnsweredBy,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (!attemptId || typeof attemptId !== 'string') {
      logger.error('Missing attemptId in parallel dial AMD webhook')
      await markTelnyxWebhookProcessed(claim)
      return res.status(200).send('OK')
    }

    await parallelDialerService.handleAmdResult(attemptId, CallSid, AnsweredBy)

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling parallel dial AMD webhook')
    res.status(500).send('Error')
  }
})

/**
 * Parallel Dial Status webhook
 */
router.post('/parallel-dial-status', async (req: Request, res: Response) => {
  const { attemptId } = req.query
  const { CallSid, CallStatus } = req.body

  logger.debug({ attemptId, callStatus: CallStatus }, 'Parallel dial status')
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'parallel-dial-status',
    ids: [typeof attemptId === 'string' ? attemptId : null, CallSid],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (!attemptId || typeof attemptId !== 'string') {
      logger.error('Missing attemptId in parallel dial status webhook')
      await markTelnyxWebhookProcessed(claim)
      return res.status(200).send('OK')
    }

    await parallelDialerService.handleCallStatusUpdate(attemptId, CallStatus)

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling parallel dial status webhook')
    res.status(500).send('Error')
  }
})

/**
 * Parallel Dial Join Conference webhook
 */
router.post('/parallel-dial-join', async (req: Request, res: Response) => {
  const parsedDestination = parseSdkDestination(req.body.To)
  const conferenceId = req.body.conferenceId || parsedDestination.conferenceId

  logger.debug({ conferenceId }, 'Parallel dial join conference')

  const response = new VoiceResponse()

  try {
    if (!conferenceId) {
      logger.error('Missing conferenceId in parallel dial join webhook')
      response.say('Unable to join conference. Missing conference ID.')
      response.hangup()
      res.type('text/xml')
      return res.send(response.toString())
    }

    const dial = response.dial()
    dial.conference(
      {
        startConferenceOnEnter: true,
        endConferenceOnExit: true,
        beep: 'false',
        waitUrl: '',
      },
      conferenceId,
    )
  } catch (error) {
    logger.error({ error }, 'Error handling parallel dial join webhook')
    response.say('An error occurred joining the conference.')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Single Call Bridge webhook - lead answers conference-based outbound call
 */
router.post('/single-call-bridge', async (req: Request, res: Response) => {
  const { callId, conferenceId } = req.query
  const { CallSid } = req.body

  logger.info({ callId, conferenceId }, 'Single call bridge webhook')

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'single-call-bridge',
    ids: [
      typeof callId === 'string' ? callId : null,
      CallSid,
      typeof conferenceId === 'string' ? conferenceId : null,
    ],
  })
  const shouldApplySideEffects = !claim?.duplicate

  try {
    if (!conferenceId || typeof conferenceId !== 'string') {
      logger.error('Missing conferenceId in single call bridge webhook')
      response.say('Call failed due to system error.')
      response.hangup()
      await markTelnyxWebhookProcessed(claim)
      res.type('text/xml')
      return res.send(response.toString())
    }

    if (shouldApplySideEffects && callId && typeof callId === 'string') {
      await updateCallByIdWithPrecedence(callId, {
        dialCallSid: CallSid,
        status: 'in-progress',
        answeredAt: new Date(),
      })
    }

    const dial = response.dial()
    dial.conference(
      {
        startConferenceOnEnter: false,
        endConferenceOnExit: false,
        beep: 'false',
        waitUrl: '',
      },
      conferenceId,
    )

    if (shouldApplySideEffects) {
      await markTelnyxWebhookProcessed(claim)
    }
  } catch (error) {
    if (shouldApplySideEffects) {
      await markTelnyxWebhookFailed(claim)
    }
    logger.error({ error }, 'Error handling single call bridge webhook')
    response.say('An error occurred connecting your call.')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Conference Status webhook - captures conferenceSid for manager listen
 */
router.post('/conference-status', async (req: Request, res: Response) => {
  const { callId } = req.query
  const { ConferenceSid, StatusCallbackEvent } = req.body

  logger.debug(
    { callId, event: StatusCallbackEvent },
    'Conference status webhook',
  )
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'conference-status',
    ids: [typeof callId === 'string' ? callId : null, ConferenceSid],
    eventState: StatusCallbackEvent,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (callId && typeof callId === 'string' && ConferenceSid) {
      if (StatusCallbackEvent === 'conference-start') {
        await callRepository.update(callId, {
          conferenceSid: ConferenceSid,
        })
      }
    }

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling conference status webhook')
    res.status(500).send('Error')
  }
})

/**
 * Conference End webhook - rep leaves conference
 */
router.post('/conference-end', async (req: Request, res: Response) => {
  const { callId } = req.query
  const { DialCallStatus, DialCallDuration } = req.body

  logger.info(
    { callId, dialCallStatus: DialCallStatus },
    'Conference end webhook',
  )

  const response = new VoiceResponse()
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'conference-end',
    ids: [typeof callId === 'string' ? callId : null],
    eventState: DialCallStatus,
  })

  if (claim?.duplicate) {
    response.hangup()
    res.type('text/xml')
    return res.send(response.toString())
  }

  try {
    if (callId && typeof callId === 'string') {
      const duration = DialCallDuration ? parseInt(DialCallDuration, 10) : 0

      const updateResult = await updateCallByIdWithPrecedence(callId, {
        status: 'completed',
        endedAt: new Date(),
        duration,
      })

      if (
        updateResult.statusChanged &&
        updateResult.call?.status === 'completed'
      ) {
        await recordCallUsage(callId, duration)
      }
    }

    await markTelnyxWebhookProcessed(claim)
    response.hangup()
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling conference end webhook')
    response.hangup()
  }

  res.type('text/xml')
  res.send(response.toString())
})

/**
 * Ringback tone webhook
 */
router.get('/ringback', async (_req: Request, res: Response) => {
  const response = new VoiceResponse()

  response.play(
    { loop: 0 },
    `${config.backendUrl}/static/audio/us-ringback.ogg`,
  )

  res.type('text/xml')
  res.send(response.toString())
})

router.post('/ringback', async (_req: Request, res: Response) => {
  const response = new VoiceResponse()

  response.play(
    { loop: 0 },
    `${config.backendUrl}/static/audio/us-ringback.ogg`,
  )

  res.type('text/xml')
  res.send(response.toString())
})

// ============================================
// SLACK CLICK-TO-CALL WEBHOOKS
// ============================================

router.post('/slack-call-rep-answered', async (req: Request, res: Response) => {
  const { callId, leadPhone, fromNumber, conferenceId } = req.query

  logger.info({ callId, conferenceId }, 'Slack click-to-call: rep answered')

  try {
    const texmlResponse = await slackClickToCallService.handleRepAnswered({
      callId: callId as string,
      leadPhone: leadPhone as string,
      fromNumber: fromNumber as string,
      conferenceId: conferenceId as string,
    })

    res.type('text/xml')
    res.send(texmlResponse)
  } catch (error) {
    logger.error({ error }, 'Error handling Slack rep answered webhook')

    const response = new VoiceResponse()
    response.say('Sorry, there was an error connecting your call.')
    response.hangup()

    res.type('text/xml')
    res.send(response.toString())
  }
})

router.post('/slack-call-bridge', async (req: Request, res: Response) => {
  const { callId, conferenceId } = req.query
  const { CallSid } = req.body

  logger.info({ callId, conferenceId }, 'Slack click-to-call: bridge lead')

  try {
    if (callId && typeof callId === 'string') {
      await callRepository.update(callId, {
        dialCallSid: CallSid,
      })
    }

    const response = new VoiceResponse()
    const dial = response.dial()
    dial.conference(
      {
        startConferenceOnEnter: false,
        endConferenceOnExit: false,
        beep: 'false',
        waitUrl: '',
      },
      conferenceId as string,
    )

    res.type('text/xml')
    res.send(response.toString())
  } catch (error) {
    logger.error({ error }, 'Error handling Slack bridge webhook')

    const response = new VoiceResponse()
    response.say('Sorry, there was an error connecting your call.')
    response.hangup()

    res.type('text/xml')
    res.send(response.toString())
  }
})

router.post('/slack-call-status', async (req: Request, res: Response) => {
  const { callId } = req.query
  const { CallStatus, CallDuration } = req.body

  logger.debug({ callId, callStatus: CallStatus }, 'Slack call status')
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'slack-call-status',
    ids: [typeof callId === 'string' ? callId : null],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    await slackClickToCallService.handleCallStatusUpdate({
      callId: callId as string,
      callStatus: CallStatus,
      callDuration: CallDuration ? parseInt(CallDuration, 10) : undefined,
    })

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling Slack call status webhook')
    res.status(500).send('Error')
  }
})

router.post('/slack-call-lead-status', async (req: Request, res: Response) => {
  const { callId } = req.query
  const { CallStatus } = req.body

  logger.debug({ callId, callStatus: CallStatus }, 'Slack lead status')
  const claim = await claimTelnyxWebhookEvent(req, {
    routeKey: 'slack-call-lead-status',
    ids: [typeof callId === 'string' ? callId : null],
    eventState: CallStatus,
  })

  if (claim?.duplicate) {
    return res.status(200).send('OK')
  }

  try {
    if (callId && typeof callId === 'string') {
      if (CallStatus === 'answered' || CallStatus === 'in-progress') {
        await slackClickToCallService.handleCallStatusUpdate({
          callId,
          callStatus: 'in-progress',
        })
      } else if (
        CallStatus === 'busy' ||
        CallStatus === 'no-answer' ||
        CallStatus === 'failed' ||
        CallStatus === 'canceled'
      ) {
        await slackClickToCallService.handleCallStatusUpdate({
          callId,
          callStatus: CallStatus,
        })
      }
    }

    await markTelnyxWebhookProcessed(claim)
    res.status(200).send('OK')
  } catch (error) {
    await markTelnyxWebhookFailed(claim)
    logger.error({ error }, 'Error handling Slack lead status webhook')
    res.status(500).send('Error')
  }
})

// ============================================
// AGENT SMS WEBHOOKS (Telnyx native JSON events)
// ============================================

interface TelnyxMessagePayload {
  id?: string
  from?: { phone_number?: string }
  to?: Array<{ phone_number?: string; status?: string }>
  text?: string
  errors?: Array<{ code?: string; title?: string; detail?: string }>
  [key: string]: unknown
}

const extractMessageEvent = (
  body: unknown,
): { eventType: string | null; payload: TelnyxMessagePayload } => {
  const data = (body as { data?: Record<string, unknown> } | undefined)?.data
  if (!data) {
    return { eventType: null, payload: {} }
  }
  return {
    eventType: (data.event_type as string) ?? null,
    payload: (data.payload as TelnyxMessagePayload) ?? {},
  }
}

/**
 * Inbound SMS webhook — Telnyx `message.received` event.
 */
router.post('/sms/inbound', async (req: Request, res: Response) => {
  const { eventType, payload } = extractMessageEvent(req.body)

  if (eventType && eventType !== 'message.received') {
    // Profile-level webhooks can deliver status events here too — ignore them.
    return res.status(200).send('OK')
  }

  const From = payload.from?.phone_number
  const To = payload.to?.[0]?.phone_number
  const Body = payload.text ?? ''
  const MessageSid = payload.id

  logger.info({ messageSid: MessageSid }, 'Agent SMS inbound webhook')

  try {
    if (!From || !To || !MessageSid) {
      logger.warn({ eventType }, 'Inbound SMS event missing required fields')
      return res.status(200).send('OK')
    }

    const smsConfig = await agentSmsConfigRepository.findByPhoneNumber(To)
    if (!smsConfig) {
      logger.debug('No agent SMS config found for phone number')
      return res.status(200).send('OK')
    }

    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
    if (optOutKeywords.includes(Body.toUpperCase().trim())) {
      logger.info({ agentId: smsConfig.agentId }, 'SMS opt-out request')
      if (process.env.TELNYX_API_KEY) {
        try {
          await sendMessage(process.env.TELNYX_API_KEY, {
            from: To,
            to: From,
            text: 'You have been unsubscribed and will no longer receive messages from this number.',
          })
        } catch (error) {
          logger.error({ error }, 'Failed to send opt-out confirmation SMS')
        }
      }
      return res.status(200).send('OK')
    }

    const { leadId } = await agentSmsService.findOrCreateLeadByPhone(
      smsConfig.agentId,
      From,
    )

    await agentMessageRepository.createInbound({
      agentId: smsConfig.agentId,
      fromPhone: From,
      toPhone: To,
      smsBody: Body,
      twilioMessageSid: MessageSid,
      leadId,
    })

    const result = await agentSmsService.processInboundAndReply(
      smsConfig.agentId,
      From,
      Body,
      MessageSid,
      leadId,
    )

    if (result.autoSent) {
      logger.debug({ agentId: smsConfig.agentId }, 'Auto-reply sent')
    }

    res.status(200).send('OK')
  } catch (error) {
    logger.error({ error }, 'Error handling inbound SMS')
    res.status(200).send('OK')
  }
})

/**
 * SMS delivery status webhook — Telnyx `message.sent` / `message.finalized`
 * events carry per-recipient delivery statuses.
 */
router.post('/sms/status', async (req: Request, res: Response) => {
  const { eventType, payload } = extractMessageEvent(req.body)

  if (eventType === 'message.received') {
    // Not a status event — ignore.
    return res.status(200).send('OK')
  }

  const MessageSid = payload.id
  const recipientStatus = payload.to?.[0]?.status
  const firstError = payload.errors?.[0]

  logger.debug(
    { messageSid: MessageSid, messageStatus: recipientStatus, eventType },
    'SMS status callback',
  )

  try {
    if (!MessageSid) {
      return res.status(200).send('OK')
    }

    const message =
      await agentMessageRepository.findByTwilioMessageSid(MessageSid)
    if (!message) {
      return res.status(200).send('OK')
    }

    let status = message.status
    switch (recipientStatus) {
      case 'queued':
      case 'sending':
        status = 'sending'
        break
      case 'sent':
        status = 'sent'
        break
      case 'delivered':
        status = 'delivered'
        break
      case 'failed':
      case 'sending_failed':
      case 'delivery_failed':
      case 'delivery_unconfirmed':
      case 'expired':
        status = 'failed'
        break
    }

    const updateData: Parameters<typeof agentMessageRepository.update>[1] = {
      status,
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date()
    } else if (status === 'failed' && firstError) {
      updateData.failureReason = `${firstError.code ?? 'unknown'}: ${
        firstError.detail ?? firstError.title ?? 'delivery failed'
      }`
    }

    await agentMessageRepository.update(message.id, updateData)

    res.status(200).send('OK')
  } catch (error) {
    logger.error({ error }, 'Error handling SMS status callback')
    res.status(500).send('Error')
  }
})

export default router
