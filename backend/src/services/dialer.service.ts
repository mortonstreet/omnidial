import { config } from '@/config'
import logger from '@/lib/logger'
import {
  isCallTerminalStatus,
  resolveCallStatusTransition,
} from '@/lib/callState'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'
import * as phoneProvisioningRepo from '@/repositories/phoneProvisioning.repository'
import * as callRepository from '@/repositories/call.repository'
import * as voicemailDropRepository from '@/repositories/voicemailDrop.repository'
import * as voicemailGreetingRepository from '@/repositories/voicemailGreeting.repository'
import * as dispositionRepository from '@/repositories/disposition.repository'
import * as clientPhoneNumberRepository from '@/repositories/clientPhoneNumber.repository'
import * as campaignRepository from '@/repositories/campaign.repository'
import * as campaignLeadRepository from '@/repositories/campaign-lead.repository'
import * as telnyxClient from '@/clients/telnyx.client'
import * as activityService from '@/services/activity.service'
import * as callingNotificationService from '@/services/callingNotification.service'
import * as usageTrackingService from '@/services/usageTracking.service'
import {
  generateWebRTCToken,
  listVerifiedNumbers,
  encryptAuthToken,
  decryptAuthToken,
} from '@/lib/telnyx'
import { phoneNumbersMatch } from '@/lib/phone'
import { getUserById } from '@/repositories/auth.repository'
import { DBPagination } from '@shared/db/src/types'

// === Twilio Config ===

/**
 * Resolve the Twilio config for an org. If the org has no config and the user
 * is a superadmin, auto-provision the org with master Telnyx credentials.
 * This creates real DB records so all downstream code works naturally.
 *
 * For orgs that use the main account (usesMainAccount=true), ensures the
 * config always reflects the current master env vars.
 */
export const resolveOrgTwilioConfig = async (
  organizationId: string,
  userId: string,
) => {
  let existing: Awaited<
    ReturnType<typeof twilioConfigRepository.findByOrganizationId>
  > | null = null
  try {
    existing = await twilioConfigRepository.findByOrganizationId(organizationId)
  } catch (error) {
    logger.error(
      { error, organizationId },
      'resolveOrgTwilioConfig: failed to query existing config',
    )
    throw error
  }

  if (existing) {
    // For main-account orgs, keep credentials in sync with current env vars
    const provisioning =
      await phoneProvisioningRepo.findByOrganizationId(organizationId)
    if (
      provisioning?.usesMainAccount &&
      process.env.TELNYX_ACCOUNT_SID &&
      process.env.TELNYX_API_KEY
    ) {
      const storedApiKey = decryptAuthToken(existing.authTokenEncrypted)
      if (
        existing.accountSid !== process.env.TELNYX_ACCOUNT_SID ||
        storedApiKey !== process.env.TELNYX_API_KEY
      ) {
        const updated = await twilioConfigRepository.update(organizationId, {
          accountSid: process.env.TELNYX_ACCOUNT_SID,
          authTokenEncrypted: encryptAuthToken(process.env.TELNYX_API_KEY),
        })
        telnyxClient.clearClientCache(organizationId)
        return updated || existing
      }
    }
    return existing
  }

  // Auto-provision for superadmin using master Telnyx credentials
  const user = await getUserById(userId)
  if (
    user?.role !== 'superadmin' ||
    !process.env.TELNYX_ACCOUNT_SID ||
    !process.env.TELNYX_API_KEY
  ) {
    logger.info(
      {
        organizationId,
        userId,
        role: user?.role,
        hasSid: !!process.env.TELNYX_ACCOUNT_SID,
        hasToken: !!process.env.TELNYX_API_KEY,
      },
      'resolveOrgTwilioConfig: cannot auto-provision (not superadmin or missing env vars)',
    )
    return null
  }

  logger.info(
    { organizationId, userId },
    'resolveOrgTwilioConfig: auto-provisioning for superadmin',
  )

  // Create twilio_config with master credentials
  const newConfig = await twilioConfigRepository.create({
    organizationId,
    accountSid: process.env.TELNYX_ACCOUNT_SID,
    authTokenEncrypted: encryptAuthToken(process.env.TELNYX_API_KEY),
    phoneNumbers: [],
  })

  // Create phone_provisioning with usesMainAccount flag
  const existingProvisioning =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!existingProvisioning) {
    await phoneProvisioningRepo.create({
      organizationId,
      usesMainAccount: true,
      provisioningStatus: 'active',
      numberType: 'main',
    })
  } else {
    await phoneProvisioningRepo.update(organizationId, {
      usesMainAccount: true,
      provisioningStatus: 'active',
    })
  }

  // Create default dispositions for this config
  await dispositionRepository.createDefaultDispositions(newConfig.id)

  return newConfig
}

export const getTwilioConfig = async (
  organizationId: string,
  userId?: string,
) => {
  const configData = userId
    ? await resolveOrgTwilioConfig(organizationId, userId)
    : await twilioConfigRepository.findByOrganizationId(organizationId)
  if (!configData) {
    return null
  }
  // Don't return the encrypted token
  const { authTokenEncrypted, ...rest } = configData
  return rest
}

export const createTwilioConfig = async (
  organizationId: string,
  accountSid: string,
  authToken: string,
  phoneNumbers: string[] = [],
) => {
  const existing =
    await twilioConfigRepository.findByOrganizationId(organizationId)
  if (existing) {
    throw new Error('Twilio configuration already exists for this organization')
  }

  const configData = await twilioConfigRepository.create({
    organizationId,
    accountSid,
    authTokenEncrypted: encryptAuthToken(authToken),
    phoneNumbers,
  })

  // Create default dispositions
  await dispositionRepository.createDefaultDispositions(configData.id)

  const { authTokenEncrypted, ...rest } = configData
  return rest
}

export const updateTwilioConfig = async (
  organizationId: string,
  data: {
    accountSid?: string
    authToken?: string
    phoneNumbers?: string[]
  },
) => {
  const updateData: twilioConfigRepository.UpdateTwilioConfigInput = {}

  if (data.accountSid) {
    updateData.accountSid = data.accountSid
  }
  if (data.authToken) {
    updateData.authTokenEncrypted = encryptAuthToken(data.authToken)
  }
  if (data.phoneNumbers) {
    updateData.phoneNumbers = data.phoneNumbers
  }

  // Clear the client cache when credentials are updated
  telnyxClient.clearClientCache(organizationId)

  const updated = await twilioConfigRepository.update(
    organizationId,
    updateData,
  )
  if (!updated) {
    throw new Error('Telnyx configuration not found')
  }

  const { authTokenEncrypted, ...rest } = updated
  return rest
}

// === Phone Numbers ===

export const listPhoneNumbers = async (organizationId: string) => {
  const client = await telnyxClient.getClientForOrganization(organizationId)
  const [configData, provisioning] = await Promise.all([
    twilioConfigRepository.findByOrganizationId(organizationId),
    phoneProvisioningRepo.findByOrganizationId(organizationId),
  ])

  // Fetch owned numbers and externally verified caller IDs in parallel
  const [ownedNumbers, verifiedNumbers] = await Promise.all([
    client.listPhoneNumbers(),
    listVerifiedNumbers(client.apiKey).catch(() => []),
  ])

  // Create a set of verified caller ID phone numbers for quick lookup
  const verifiedCallerIds = new Set(
    verifiedNumbers.map((verified) => verified.phone_number),
  )
  const scopedNumbers = new Set<string>()
  if (!provisioning?.usesMainAccount && provisioning?.phoneNumber) {
    scopedNumbers.add(provisioning.phoneNumber)
  } else if (!provisioning?.usesMainAccount) {
    for (const phoneNumber of configData?.phoneNumbers || []) {
      scopedNumbers.add(phoneNumber)
    }
  }

  const shouldListAllOwnedNumbers =
    provisioning?.usesMainAccount || (!provisioning && scopedNumbers.size === 0)
  const scopedOwnedNumbers = shouldListAllOwnedNumbers
    ? ownedNumbers
    : ownedNumbers.filter((phone) =>
        [...scopedNumbers].some((scoped) =>
          phoneNumbersMatch(scoped, phone.phone_number),
        ),
      )

  const phoneNumberList = scopedOwnedNumbers.map((phone) => {
    // Owned numbers are valid caller IDs.
    const isOwnedNumber = typeof phone.id === 'string' && phone.id.length > 0
    const isVerifiedCallerId =
      isOwnedNumber || verifiedCallerIds.has(phone.phone_number)

    return {
      phoneNumber: phone.phone_number,
      friendlyName:
        (phone.customer_reference as string | null) || phone.phone_number,
      locality: null as string | null,
      region: null as string | null,
      capabilities: {
        voice: true,
        sms: !!phone.messaging_profile_id,
        mms: !!phone.messaging_profile_id,
      },
      callerIdVerified: isVerifiedCallerId,
    }
  })

  // Auto-sync phone numbers to twilio_config for inbound call routing
  // This ensures findByPhoneNumber can match inbound calls to the correct org
  try {
    const phoneNumbers = phoneNumberList.map((p) => p.phoneNumber)
    await twilioConfigRepository.update(organizationId, { phoneNumbers })
    console.log(
      `Synced ${phoneNumbers.length} phone numbers to config for org ${organizationId}`,
    )
  } catch (error) {
    console.error('Failed to sync phone numbers to config:', error)
    // Don't fail the request if sync fails - just log it
  }

  return phoneNumberList
}

// === Client Phone Number Assignments ===

export const listPhoneNumbersWithAssignments = async (
  organizationId: string,
) => {
  // Get phone numbers from Telnyx
  const twilioNumbers = await listPhoneNumbers(organizationId)

  // Get all assignments for this org
  const assignments =
    await clientPhoneNumberRepository.findByOrganizationWithClient(
      organizationId,
    )

  // Map phone numbers to include assignment info
  return twilioNumbers.map((phone) => {
    const assignment = assignments.find(
      (a) => a.phoneNumber === phone.phoneNumber,
    )
    return {
      ...phone,
      assignedToClient: assignment
        ? {
            id: assignment.clientId,
            name: assignment.clientName,
            color: assignment.clientColor,
          }
        : null,
    }
  })
}

export const getClientPhoneNumbers = async (
  organizationId: string,
  clientId: string,
) => {
  return clientPhoneNumberRepository.findByClient(organizationId, clientId)
}

export const assignPhoneNumberToClient = async (
  organizationId: string,
  clientId: string,
  phoneNumber: string,
  friendlyName?: string,
) => {
  // Check if already assigned
  const existing = await clientPhoneNumberRepository.findByPhoneNumber(
    organizationId,
    phoneNumber,
  )
  if (existing) {
    throw new Error(
      `Phone number ${phoneNumber} is already assigned to a client`,
    )
  }

  return clientPhoneNumberRepository.create({
    organizationId,
    clientId,
    phoneNumber,
    friendlyName,
  })
}

export const unassignPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  return clientPhoneNumberRepository.deleteByPhoneNumber(
    organizationId,
    phoneNumber,
  )
}

export const getDialablePhoneNumbers = async (
  organizationId: string,
  clientId: string,
) => {
  // Get assignments for this client
  const assignments = await clientPhoneNumberRepository.findByClient(
    organizationId,
    clientId,
  )

  if (assignments.length === 0) {
    // Client has no assigned numbers - return empty array
    return []
  }

  // Get full phone number details from Telnyx
  const twilioNumbers = await listPhoneNumbers(organizationId)
  const assignedPhoneNumbers = new Set(assignments.map((a) => a.phoneNumber))

  return twilioNumbers.filter((phone) =>
    assignedPhoneNumbers.has(phone.phoneNumber),
  )
}

// === WebRTC Login Token ===

/**
 * Generate a Telnyx WebRTC login token for the browser SDK — the
 * replacement for Twilio capability tokens. A telephony credential named
 * after the identity is created (or reused) on the org's TeXML application
 * connection, so TeXML `<Dial><Client>identity` can ring this browser.
 */
export const getCapabilityToken = async (
  organizationId: string,
  userId: string,
  identity?: string,
) => {
  // Use resolveOrgTwilioConfig to auto-provision for superadmin if needed
  const configData = await resolveOrgTwilioConfig(organizationId, userId)
  if (!configData) {
    throw new Error('Telnyx configuration not found')
  }

  // Try to get the TeXML application (connection) from PhoneProvisioning first
  const provisioning =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)

  let apiKey = decryptAuthToken(configData.authTokenEncrypted)

  if (provisioning?.usesMainAccount && process.env.TELNYX_API_KEY) {
    // Superadmin-run orgs use master Telnyx credentials from env vars directly
    apiKey = process.env.TELNYX_API_KEY
  } else if (!provisioning?.twimlAppSid && process.env.TELNYX_API_KEY) {
    // No org-level infrastructure — fall back to master credentials
    apiKey = process.env.TELNYX_API_KEY
  }

  // WebRTC clients register on the shared credential connection; TeXML
  // applications cannot hold telephony credentials.
  const credentialConnectionId = process.env.TELNYX_CREDENTIAL_CONNECTION_ID
  if (!credentialConnectionId) {
    throw new Error('TELNYX_CREDENTIAL_CONNECTION_ID not configured')
  }
  if (!apiKey || apiKey.length < 10) {
    logger.error(
      { organizationId, keyLength: apiKey?.length },
      'getCapabilityToken: API key missing or suspiciously short (decryption may have failed)',
    )
    throw new Error('Invalid Telnyx API key — check ENCRYPTION_KEY')
  }

  logger.info(
    {
      organizationId,
      connectionId: credentialConnectionId.slice(0, 8) + '...',
      source: provisioning?.usesMainAccount ? 'main-account' : 'org-app',
    },
    'getCapabilityToken: generating Telnyx WebRTC token',
  )

  const result = await generateWebRTCToken(apiKey, {
    identity: identity || userId,
    connectionId: credentialConnectionId,
  })

  return {
    token: result.token,
    identity: result.identity,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    // Browser-originated calls dial the TeXML app's SIP subdomain so the
    // voice webhook can route them (e.g. sip:callid-<id>@<subdomain>)
    sipDomain: process.env.TELNYX_SIP_SUBDOMAIN || null,
  }
}

// === Calls ===

export const initiateOutboundCall = async (
  twilioConfigId: string,
  userId: string,
  toNumber: string,
  fromNumber: string,
  leadId?: string,
  campaignId?: string,
) => {
  // Get config to find organization
  const configData = await twilioConfigRepository.findById(twilioConfigId)
  if (!configData) {
    throw new Error('Telnyx configuration not found')
  }

  // Check billing guard before allowing the call
  const { canMakeCall } = await import('@/services/usageGuard.service')
  const guard = await canMakeCall(configData.organizationId, userId)
  if (!guard.allowed) {
    const error = new Error(`Call blocked: ${guard.reason}`) as Error & {
      code: string
      guardResult: typeof guard
      statusCode?: number
    }
    error.code = guard.reason
    error.guardResult = guard
    if (guard.httpStatus) {
      error.statusCode = guard.httpStatus
    }
    throw error
  }

  // Record daily call count (non-critical, don't block call if this fails)
  try {
    await usageTrackingService.recordDailyCall(
      configData.organizationId,
      userId,
    )
  } catch (err) {
    logger.error(
      { err, orgId: configData.organizationId, userId },
      'Failed to record daily call count, continuing',
    )
  }

  // Create call record - the actual call is initiated via the Telnyx WebRTC SDK
  // The frontend passes the callId to device.connect(), which triggers the TeXML application
  const callRecord = await callRepository.create({
    twilioConfigId,
    userId,
    leadId,
    campaignId,
    fromNumber,
    toNumber,
    direction: 'outbound',
    status: 'initiated',
  })

  // Update campaign's lastCalledAt to reflect calling activity (used for active/inactive status)
  if (campaignId) {
    try {
      await campaignRepository.updateLastCalledAt(campaignId)
    } catch (error) {
      // Don't fail the call if campaign update fails - just log it
      console.error('Failed to update campaign lastCalledAt:', error)
    }
  }

  // Notify organization owners of calling activity (has 15-min cooldown per user)
  setImmediate(() => {
    callingNotificationService.notifyOwnersOfCallingSession({
      organizationId: configData.organizationId,
      userId,
      campaignId,
      dialerType: 'manual',
    })
  })

  return callRecord
}

export const endActiveCall = async (callId: string) => {
  const call = await callRepository.findById(callId)
  if (!call) {
    throw new Error('Call not found')
  }

  // Try to end the call via the Telnyx API if we have the SID
  if (call.twilioCallSid) {
    try {
      const configData = await twilioConfigRepository.findById(
        call.twilioConfigId,
      )
      if (configData) {
        const client = await telnyxClient.getClientForOrganization(
          configData.organizationId,
        )
        await client.endCall(call.twilioCallSid)
      }
    } catch (error) {
      // Log but don't fail - the call may have already ended
      console.error('Error ending call via Telnyx:', error)
    }
  }

  // Always update the call record
  const updatedCall = await callRepository.update(callId, {
    status: 'completed',
    endedAt: new Date(),
  })

  return updatedCall
}

export const endActiveCallForOrg = async (callId: string, orgId: string) => {
  const call = await callRepository.findByIdForOrg(callId, orgId)
  if (!call) {
    return null
  }

  // Try to end the call via the Telnyx API if we have the SID
  if (call.twilioCallSid) {
    try {
      const client = await telnyxClient.getClientForOrganization(orgId)
      await client.endCall(call.twilioCallSid)
    } catch (error) {
      // Log but don't fail - the call may have already ended
      console.error('Error ending call via Telnyx:', error)
    }
  }

  return callRepository.updateForOrg(callId, orgId, {
    status: 'completed',
    endedAt: new Date(),
  })
}

export const updateCallStatus = async (
  twilioCallSid: string,
  status: string,
  duration?: number,
) => {
  const existingCall = await callRepository.findByTwilioCallSid(twilioCallSid)
  if (!existingCall) {
    return null
  }

  const resolvedStatus = resolveCallStatusTransition(
    existingCall.status,
    status,
  )
  if (!resolvedStatus) {
    return existingCall
  }

  const updateData: callRepository.UpdateCallInput = { status: resolvedStatus }

  if (resolvedStatus === 'in-progress') {
    updateData.answeredAt = new Date()
  } else if (resolvedStatus === 'completed' || resolvedStatus === 'failed') {
    updateData.endedAt = new Date()
    if (duration !== undefined) {
      updateData.duration = duration
    }
  }

  const updatedCall = await callRepository.updateByTwilioCallSid(
    twilioCallSid,
    updateData,
  )

  const transitionedToTerminal =
    !!updatedCall &&
    !isCallTerminalStatus(existingCall.status) &&
    isCallTerminalStatus(resolvedStatus)

  // Process post-call updates when call is completed
  if (
    transitionedToTerminal &&
    (resolvedStatus === 'completed' || resolvedStatus === 'failed')
  ) {
    // Get organization ID from telnyx config
    const configData = await twilioConfigRepository.findById(
      updatedCall.twilioConfigId,
    )

    // Record usage for billing
    if (configData && duration && duration > 0) {
      usageTrackingService
        .recordCallMinutes(configData.organizationId, duration)
        .catch((err) => {
          // Non-blocking - don't fail the webhook
          console.warn('Failed to record call usage:', err)
        })
    }

    // Update campaign_lead status and campaign counts
    if (updatedCall.campaignId && updatedCall.leadId && configData) {
      try {
        // Determine if call was connected (answered)
        const wasConnected = !!updatedCall.answeredAt
        const newStatus = wasConnected ? 'completed' : 'dialed'

        // Update campaign_lead status
        await campaignLeadRepository.updateStatusByLeadAndCampaign(
          updatedCall.campaignId,
          updatedCall.leadId,
          newStatus,
        )

        // Update campaign counts (dialedCount, connectedCount)
        await campaignRepository.updateCounts(
          updatedCall.campaignId,
          configData.organizationId,
        )
      } catch (error) {
        // Don't fail the call update if campaign stats update fails
        console.error('Failed to update campaign stats:', error)
      }
    }

    // Log activity when call is completed
    if (configData && resolvedStatus === 'completed') {
      try {
        await activityService.logCallActivity({
          organizationId: configData.organizationId,
          userId: updatedCall.userId,
          leadId: updatedCall.leadId ?? undefined,
          direction: updatedCall.direction as 'outbound' | 'inbound',
          duration: duration ?? updatedCall.duration ?? 0,
        })
      } catch (error) {
        // Don't fail the call update if activity logging fails
        console.error('Failed to log call activity:', error)
      }
    }
  }

  return updatedCall
}

export const setCallDisposition = async (
  callId: string,
  dispositionId: string,
) => {
  return callRepository.update(callId, { dispositionId })
}

export const setCallDispositionForOrg = async (
  callId: string,
  dispositionId: string,
  orgId: string,
) => {
  const disposition = await dispositionRepository.findByIdForOrg(
    dispositionId,
    orgId,
  )
  if (!disposition) {
    return null
  }

  return callRepository.updateForOrg(callId, orgId, { dispositionId })
}

export const dropVoicemail = async (
  callId: string,
  voicemailDropId: string,
) => {
  const call = await callRepository.findById(callId)
  if (!call) {
    throw new Error('Call not found')
  }

  // For browser SDK calls, use dialCallSid (child call to destination)
  // Fall back to twilioCallSid for direct API-initiated calls
  const callSidToUpdate = call.dialCallSid || call.twilioCallSid
  if (!callSidToUpdate) {
    throw new Error(
      'Call has no call SID - please wait until the call is answered before dropping voicemail',
    )
  }

  const voicemailDrop = await voicemailDropRepository.findById(voicemailDropId)
  if (!voicemailDrop) {
    throw new Error('Voicemail drop not found')
  }

  const configData = await twilioConfigRepository.findById(call.twilioConfigId)
  if (!configData) {
    throw new Error('Telnyx configuration not found')
  }

  const client = await telnyxClient.getClientForOrganization(
    configData.organizationId,
  )

  console.log(
    `Dropping voicemail on call ${callSidToUpdate} (dialCallSid: ${call.dialCallSid}, twilioCallSid: ${call.twilioCallSid})`,
  )

  // Play the voicemail recording on the child call (actual call to destination)
  await client.playRecordingOnCall(callSidToUpdate, voicemailDrop.recordingUrl)

  const updatedCall = await callRepository.update(callId, {
    voicemailDropped: true,
    status: 'completed',
    endedAt: new Date(),
  })

  return updatedCall
}

export const dropVoicemailForOrg = async (
  callId: string,
  voicemailDropId: string,
  orgId: string,
) => {
  const call = await callRepository.findByIdForOrg(callId, orgId)
  if (!call) {
    throw new Error('Call not found')
  }

  // For browser SDK calls, use dialCallSid (child call to destination)
  // Fall back to twilioCallSid for direct API-initiated calls
  const callSidToUpdate = call.dialCallSid || call.twilioCallSid
  if (!callSidToUpdate) {
    throw new Error(
      'Call has no call SID - please wait until the call is answered before dropping voicemail',
    )
  }

  const voicemailDrop = await voicemailDropRepository.findByIdForOrg(
    voicemailDropId,
    orgId,
  )
  if (!voicemailDrop) {
    throw new Error('Voicemail drop not found')
  }

  const client = await telnyxClient.getClientForOrganization(orgId)

  console.log(
    `Dropping voicemail on call ${callSidToUpdate} (dialCallSid: ${call.dialCallSid}, twilioCallSid: ${call.twilioCallSid})`,
  )

  // Play the voicemail recording on the child call (actual call to destination)
  await client.playRecordingOnCall(callSidToUpdate, voicemailDrop.recordingUrl)

  return callRepository.updateForOrg(callId, orgId, {
    voicemailDropped: true,
    status: 'completed',
    endedAt: new Date(),
  })
}

export const getCall = async (callId: string) => {
  return callRepository.findById(callId)
}

export const getCallForOrg = async (callId: string, orgId: string) => {
  return callRepository.findByIdForOrg(callId, orgId)
}

export const listCalls = async (
  twilioConfigId: string,
  filters: {
    userId?: string
    leadId?: string
    campaignId?: string
    direction?: string
    status?: string
    dispositionId?: string | null
    startDate?: string
    endDate?: string
  },
  pagination: DBPagination,
) => {
  return callRepository.findMany(
    {
      twilioConfigId,
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    },
    pagination,
  )
}

// === Voicemail Drops ===

export const createVoicemailDrop = async (
  twilioConfigId: string,
  userId: string,
  name: string,
  recordingUrl: string,
  duration: number,
) => {
  return voicemailDropRepository.create({
    twilioConfigId,
    userId,
    name,
    recordingUrl,
    duration,
  })
}

export const listVoicemailDrops = async (
  twilioConfigId: string,
  userId: string,
  pagination: DBPagination,
) => {
  return voicemailDropRepository.findByUserId(
    userId,
    twilioConfigId,
    pagination,
  )
}

export const deleteVoicemailDrop = async (voicemailDropId: string) => {
  return voicemailDropRepository.deleteById(voicemailDropId)
}

export const deleteVoicemailDropForOrg = async (
  voicemailDropId: string,
  orgId: string,
) => {
  return voicemailDropRepository.deleteByIdForOrg(voicemailDropId, orgId)
}

// === Dispositions ===

export const listDispositions = async (
  twilioConfigId: string,
  pagination: DBPagination,
) => {
  return dispositionRepository.findByTwilioConfigId(twilioConfigId, pagination)
}

export const createDisposition = async (
  twilioConfigId: string,
  label: string,
  color?: string,
  sortOrder?: number,
  isDefault?: boolean,
) => {
  return dispositionRepository.create({
    twilioConfigId,
    label,
    color,
    sortOrder,
    isDefault,
  })
}

export const updateDisposition = async (
  dispositionId: string,
  data: dispositionRepository.UpdateDispositionInput,
) => {
  return dispositionRepository.update(dispositionId, data)
}

export const updateDispositionForOrg = async (
  dispositionId: string,
  data: dispositionRepository.UpdateDispositionInput,
  orgId: string,
) => {
  return dispositionRepository.updateForOrg(dispositionId, orgId, data)
}

export const deleteDisposition = async (dispositionId: string) => {
  return dispositionRepository.deleteById(dispositionId)
}

export const deleteDispositionForOrg = async (
  dispositionId: string,
  orgId: string,
) => {
  return dispositionRepository.deleteByIdForOrg(dispositionId, orgId)
}

// === Recording Updates (from webhook) ===

export const updateCallRecording = async (
  twilioCallSid: string,
  recordingUrl: string,
  recordingSid?: string,
) => {
  const updateData: callRepository.UpdateCallInput = {
    recordingUrl,
  }
  if (recordingSid) {
    updateData.recordingSid = recordingSid
  }
  return callRepository.updateByTwilioCallSid(twilioCallSid, updateData)
}

// === Voicemail Greetings ===

export const listVoicemailGreetings = async (twilioConfigId: string) => {
  return voicemailGreetingRepository.findByTwilioConfigId(twilioConfigId)
}

export const getActiveVoicemailGreeting = async (twilioConfigId: string) => {
  return voicemailGreetingRepository.findActiveByTwilioConfigId(twilioConfigId)
}

export const createVoicemailGreeting = async (
  twilioConfigId: string,
  name: string,
  recordingUrl: string,
  duration: number,
  recordingSid?: string,
) => {
  return voicemailGreetingRepository.create({
    twilioConfigId,
    name,
    recordingUrl,
    recordingSid,
    duration,
  })
}

export const setActiveVoicemailGreeting = async (
  id: string,
  twilioConfigId: string,
) => {
  return voicemailGreetingRepository.setActive(id, twilioConfigId)
}

export const setActiveVoicemailGreetingForOrg = async (
  id: string,
  twilioConfigId: string,
  orgId: string,
) => {
  return voicemailGreetingRepository.setActiveForOrg(id, twilioConfigId, orgId)
}

export const deleteVoicemailGreeting = async (id: string) => {
  return voicemailGreetingRepository.deleteById(id)
}

export const deleteVoicemailGreetingForOrg = async (
  id: string,
  orgId: string,
) => {
  return voicemailGreetingRepository.deleteByIdForOrg(id, orgId)
}

// === Voicemail Inbox ===

export const listVoicemails = async (
  twilioConfigId: string,
  filters: { unreadOnly?: boolean },
  pagination: DBPagination,
) => {
  return callRepository.findVoicemails(twilioConfigId, filters, pagination)
}

export const markVoicemailRead = async (id: string) => {
  return callRepository.markVoicemailRead(id)
}

export const markVoicemailReadForOrg = async (id: string, orgId: string) => {
  return callRepository.markVoicemailReadForOrg(id, orgId)
}

export const markAllVoicemailsRead = async (twilioConfigId: string) => {
  return callRepository.markAllVoicemailsRead(twilioConfigId)
}
