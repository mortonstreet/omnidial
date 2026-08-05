import * as phoneProvisioningRepo from '@/repositories/phoneProvisioning.repository'
import * as telnyxConfigRepo from '@/repositories/twilioConfig.repository'
import * as subscriptionRepo from '@/repositories/subscription.repository'
import { encrypt } from '@/lib/encryption'
import { phoneNumbersMatch } from '@/lib/phone'
import { stripeClient } from '@/lib/stripe'
import { config } from '@/config'
import logger from '@/lib/logger'
import * as telnyx from '@/lib/telnyx'

/**
 * Phone provisioning on Telnyx.
 *
 * Twilio's subaccount model is replaced with per-organization TeXML
 * applications on the main Telnyx account:
 *   - `twilioSubaccountSid` column stores the Telnyx account SID
 *   - `twimlAppSid` / `apiKeySid` columns store the org's TeXML application id
 *   - `phoneNumberSid` column stores the Telnyx phone number id
 *   - encrypted credential columns store the master Telnyx API key
 */

const TELNYX_MASTER_API_KEY = process.env.TELNYX_API_KEY
const TELNYX_ACCOUNT_SID = process.env.TELNYX_ACCOUNT_SID
const TELNYX_MESSAGING_PROFILE_ID = process.env.TELNYX_MESSAGING_PROFILE_ID
const TELNYX_OUTBOUND_VOICE_PROFILE_ID =
  process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID
const SHARED_TRIAL_AREA_CODE = process.env.SHARED_TRIAL_AREA_CODE || '415'

if (!TELNYX_MASTER_API_KEY || !TELNYX_ACCOUNT_SID) {
  logger.warn(
    'Telnyx master credentials not configured — phone provisioning will fail. Set TELNYX_API_KEY and TELNYX_ACCOUNT_SID.',
  )
}

function getMasterApiKey(): string {
  if (!TELNYX_MASTER_API_KEY) {
    throw new Error(
      'Telnyx master credentials not configured. Set TELNYX_API_KEY and TELNYX_ACCOUNT_SID environment variables.',
    )
  }
  return TELNYX_MASTER_API_KEY
}

const mergePhoneNumbers = (
  existingNumbers: string[] = [],
  numbersToAdd: string[] = [],
  previousNumber?: string | null,
): string[] => {
  const merged: string[] = []

  for (const number of [...existingNumbers, ...numbersToAdd]) {
    if (!number) continue
    if (previousNumber && phoneNumbersMatch(number, previousNumber)) continue
    if (!merged.some((stored) => phoneNumbersMatch(stored, number))) {
      merged.push(number)
    }
  }

  return merged
}

async function requirePaymentMethod(organizationId: string): Promise<void> {
  const subscription =
    await subscriptionRepo.getSubscriptionByReferenceId(organizationId)
  if (!subscription || !subscription.stripeCustomerId) {
    throw new Error(
      'No active subscription found. Please subscribe to provision a phone number.',
    )
  }

  const paymentMethods = await stripeClient.paymentMethods.list({
    customer: subscription.stripeCustomerId,
    limit: 1,
  })

  if (paymentMethods.data.length === 0) {
    throw new Error(
      'A payment method is required before provisioning a phone number. Please add a credit card in your billing settings.',
    )
  }
}

// === Public API ===

export const getProvisioningStatus = async (organizationId: string) => {
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!record) return null

  // Telnyx-owned numbers (or main-account mode) are already valid caller IDs.
  const callerIdVerified =
    record.callerIdVerified ||
    !!record.phoneNumberSid ||
    !!record.usesMainAccount

  return {
    id: record.id,
    organizationId: record.organizationId,
    phoneNumber: record.phoneNumber,
    numberType: record.numberType,
    provisioningStatus: record.provisioningStatus,
    callerIdVerified,
    usesMainAccount: record.usesMainAccount || false,
    hasInfrastructure: !!(
      record.twilioSubaccountSid &&
      record.apiKeySid &&
      record.twimlAppSid
    ),
    provisionedAt: record.provisionedAt
      ? new Date(record.provisionedAt).toISOString()
      : null,
  }
}

/**
 * Sets up the org's Telnyx voice infrastructure (a dedicated TeXML
 * application) without purchasing a phone number. Sets status to
 * 'awaiting_number'.
 */
export const setupSubaccountInfrastructure = async (organizationId: string) => {
  await requirePaymentMethod(organizationId)

  const existing =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)

  // If infrastructure already exists, return current status
  if (
    existing &&
    existing.twilioSubaccountSid &&
    existing.apiKeySid &&
    existing.twimlAppSid
  ) {
    return getProvisioningStatus(organizationId)
  }

  // If already has an active number, skip
  if (
    existing &&
    existing.provisioningStatus === 'active' &&
    existing.phoneNumber
  ) {
    return getProvisioningStatus(organizationId)
  }

  let record = existing
  if (!record) {
    record = await phoneProvisioningRepo.create({
      organizationId,
      provisioningStatus: 'setup_pending',
      numberType: 'trial',
    })
  } else {
    await phoneProvisioningRepo.update(organizationId, {
      provisioningStatus: 'setup_pending',
    })
  }

  try {
    const apiKey = getMasterApiKey()
    const backendUrl = config.backendUrl

    // Create a dedicated TeXML application for the org
    logger.info('Infrastructure: creating TeXML application', {
      organizationId,
    })
    const texmlApp = await telnyx.createTexmlApplication(apiKey, {
      friendlyName: `RevCenter Dialer - ${organizationId.slice(0, 8)}`,
      voiceUrl: `${backendUrl}/api/webhooks/telnyx/voice`,
      statusCallback: `${backendUrl}/api/webhooks/telnyx/status`,
      outboundVoiceProfileId: TELNYX_OUTBOUND_VOICE_PROFILE_ID,
    })

    // Store infrastructure in PhoneProvisioning table.
    // apiKeySid doubles as the TeXML app marker for hasInfrastructure checks.
    await phoneProvisioningRepo.update(organizationId, {
      twilioSubaccountSid: TELNYX_ACCOUNT_SID,
      twilioAuthTokenEncrypted: encrypt(apiKey),
      apiKeySid: texmlApp.id,
      apiKeySecretEncrypted: encrypt(apiKey),
      twimlAppSid: texmlApp.id,
      provisioningStatus: 'awaiting_number',
    })

    logger.info('Telnyx infrastructure setup complete', {
      organizationId,
      texmlAppId: texmlApp.id,
    })
    return getProvisioningStatus(organizationId)
  } catch (error) {
    logger.error('Failed to setup Telnyx infrastructure', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    await phoneProvisioningRepo.update(organizationId, {
      provisioningStatus: 'failed',
    })
    throw error
  }
}

/**
 * Provisions a user-selected phone number onto the org's TeXML application.
 * Requires infrastructure to already be set up.
 */
export const provisionSelectedNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!record) {
    throw new Error('No phone provisioning record found.')
  }

  if (!record.twilioSubaccountSid || !record.twilioAuthTokenEncrypted) {
    throw new Error('Telnyx infrastructure not set up yet.')
  }

  if (!record.twimlAppSid) {
    throw new Error('TeXML application not configured yet.')
  }

  await requirePaymentMethod(organizationId)

  const apiKey = getMasterApiKey()
  const texmlAppId = record.twimlAppSid

  try {
    await phoneProvisioningRepo.update(organizationId, {
      provisioningStatus: 'provisioning',
    })

    // Release existing number if one exists
    if (record.phoneNumberSid) {
      try {
        await telnyx.releasePhoneNumber(apiKey, record.phoneNumberSid)
      } catch (error) {
        logger.warn('Failed to release previous number, continuing', {
          organizationId,
          phoneNumberId: record.phoneNumberSid,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Purchase the selected number, attached to the org's TeXML app
    await telnyx.orderPhoneNumber(apiKey, {
      phoneNumber,
      connectionId: texmlAppId,
      messagingProfileId: TELNYX_MESSAGING_PROFILE_ID,
    })

    // Number orders are asynchronous — wait for the number to appear on the
    // account so we can capture its id and finish configuration.
    const purchased = await waitForOwnedNumber(apiKey, phoneNumber)

    // Ensure voice traffic is routed to the org's TeXML application
    if (purchased.connection_id !== texmlAppId) {
      await telnyx.assignNumberToConnection(apiKey, purchased.id, texmlAppId)
    }

    // Enable messaging when a messaging profile is configured
    if (TELNYX_MESSAGING_PROFILE_ID && !purchased.messaging_profile_id) {
      try {
        await telnyx.assignNumberToMessagingProfile(
          apiKey,
          purchased.id,
          TELNYX_MESSAGING_PROFILE_ID,
        )
      } catch (error) {
        logger.warn('Failed to assign messaging profile to number', {
          organizationId,
          phoneNumber,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Update PhoneProvisioning record
    await phoneProvisioningRepo.update(organizationId, {
      phoneNumber: purchased.phone_number,
      phoneNumberSid: purchased.id,
      numberType: 'dedicated',
      provisioningStatus: 'active',
      callerIdVerified: true,
      provisionedAt: new Date(),
    })

    // Sync the dialer config so calling works
    await ensureTelnyxConfig(
      organizationId,
      purchased.phone_number,
      record.phoneNumber &&
        !phoneNumbersMatch(record.phoneNumber, purchased.phone_number)
        ? record.phoneNumber
        : undefined,
    )

    logger.info('Phone number provisioned', {
      organizationId,
      phoneNumber: purchased.phone_number,
    })

    return getProvisioningStatus(organizationId)
  } catch (error) {
    logger.error('Failed to provision selected number', {
      organizationId,
      phoneNumber,
      error: error instanceof Error ? error.message : String(error),
    })
    await phoneProvisioningRepo.update(organizationId, {
      provisioningStatus: 'failed',
    })
    throw error
  }
}

/**
 * Quick-setup: searches for a random available number and provisions it.
 * Sets up infrastructure if it doesn't exist yet.
 */
export const provisionQuickNumber = async (organizationId: string) => {
  await requirePaymentMethod(organizationId)

  // Ensure infrastructure exists
  const existing =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (
    !existing ||
    !existing.twilioSubaccountSid ||
    !existing.apiKeySid ||
    !existing.twimlAppSid
  ) {
    await setupSubaccountInfrastructure(organizationId)
  }

  // Search for an available number
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (
    !record ||
    !record.twilioSubaccountSid ||
    !record.twilioAuthTokenEncrypted
  ) {
    throw new Error('Failed to setup infrastructure for quick provisioning')
  }

  const available = await telnyx.searchAvailableNumbers(getMasterApiKey(), {
    areaCode: SHARED_TRIAL_AREA_CODE,
    limit: 1,
  })

  if (available.length === 0) {
    throw new Error('No phone numbers available for quick setup')
  }

  return provisionSelectedNumber(organizationId, available[0].phone_number)
}

export const searchAvailableNumbers = async (areaCode: string) => {
  const numbers = await telnyx.searchAvailableNumbers(getMasterApiKey(), {
    areaCode,
    limit: 20,
  })

  return numbers.map((n) => {
    const regionInfo = n.region_information || []
    const locality =
      regionInfo.find((r) => r.region_type === 'location')?.region_name || ''
    const region =
      regionInfo.find((r) => r.region_type === 'state')?.region_name || ''
    const country =
      regionInfo.find((r) => r.region_type === 'country_code')?.region_name ||
      'US'

    return {
      phoneNumber: n.phone_number,
      friendlyName: n.phone_number,
      locality,
      region,
      isoCountry: country,
    }
  })
}

export const verifyCallerId = async (organizationId: string) => {
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!record || !record.phoneNumber) {
    throw new Error('No phone number provisioned')
  }

  // Telnyx-owned numbers are already valid caller IDs — nothing to verify.
  if (record.phoneNumberSid || record.usesMainAccount) {
    await phoneProvisioningRepo.update(organizationId, {
      callerIdVerified: true,
    })
    return { validationCode: null, callSid: null }
  }

  // External numbers go through Telnyx verified-numbers (call with a code)
  const verification = await telnyx.requestNumberVerification(
    getMasterApiKey(),
    record.phoneNumber,
    'call',
  )

  return {
    validationCode:
      (verification.verification_code as string | undefined) ?? null,
    callSid: null,
  }
}

export const checkCallerIdVerification = async (organizationId: string) => {
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!record || !record.phoneNumber) {
    return { callerIdVerified: false }
  }

  // Telnyx-owned numbers (or main-account mode) are already verified.
  if (record.phoneNumberSid || record.usesMainAccount) {
    if (!record.callerIdVerified) {
      await phoneProvisioningRepo.update(organizationId, {
        callerIdVerified: true,
      })
    }
    return { callerIdVerified: true }
  }

  // Check the Telnyx verified-numbers registry for external numbers
  try {
    const verified = await telnyx.getVerifiedNumber(
      getMasterApiKey(),
      record.phoneNumber,
    )
    const isVerified = !!verified?.verified_at

    if (isVerified && !record.callerIdVerified) {
      await phoneProvisioningRepo.update(organizationId, {
        callerIdVerified: true,
      })
    }

    return { callerIdVerified: isVerified }
  } catch {
    return { callerIdVerified: false }
  }
}

// === Admin ===

export const getAllProvisioningRecords = async () => {
  return phoneProvisioningRepo.findAllWithOrganizations()
}

export const adminReleaseNumber = async (organizationId: string) => {
  const record =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)
  if (!record) {
    throw new Error('No phone provisioning record found for this organization.')
  }

  if (record.usesMainAccount) {
    throw new Error('Cannot release a number for a main account organization.')
  }

  if (!record.phoneNumber) {
    throw new Error('No phone number to release.')
  }

  // Release the number from Telnyx
  if (record.phoneNumberSid) {
    try {
      await telnyx.releasePhoneNumber(getMasterApiKey(), record.phoneNumberSid)
    } catch (error) {
      logger.warn('Failed to release number from Telnyx', {
        organizationId,
        phoneNumberId: record.phoneNumberSid,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Null out phone-specific fields, keep infrastructure intact
  await phoneProvisioningRepo.update(organizationId, {
    phoneNumber: null,
    phoneNumberSid: null,
    provisionedAt: null,
    callerIdVerified: false,
    provisioningStatus: 'awaiting_number',
  })

  // Delete the dialer config so it doesn't try to use a stale number
  await telnyxConfigRepo.deleteByOrganizationId(organizationId)

  logger.info('Admin released phone number', {
    organizationId,
    releasedNumber: record.phoneNumber,
  })

  return { success: true }
}

export const markAsMainAccount = async (organizationId: string) => {
  if (!TELNYX_MASTER_API_KEY || !TELNYX_ACCOUNT_SID) {
    throw new Error('Master Telnyx credentials not configured')
  }

  // Fetch all phone numbers from the master Telnyx account
  const ownedNumbers = await telnyx.listPhoneNumbers(TELNYX_MASTER_API_KEY)
  const phoneNumbers = ownedNumbers.map((n) => n.phone_number)

  const primaryNumber = phoneNumbers[0] ?? undefined

  const existing =
    await phoneProvisioningRepo.findByOrganizationId(organizationId)

  if (existing) {
    await phoneProvisioningRepo.update(organizationId, {
      usesMainAccount: true,
      provisioningStatus: 'active',
      phoneNumber: primaryNumber,
      callerIdVerified: true,
    })
  } else {
    await phoneProvisioningRepo.create({
      organizationId,
      usesMainAccount: true,
      provisioningStatus: 'active',
      numberType: 'main',
      phoneNumber: primaryNumber,
      callerIdVerified: true,
    })
  }

  // Ensure the dialer config exists so WebRTC tokens can be generated
  const existingConfig =
    await telnyxConfigRepo.findByOrganizationId(organizationId)
  if (existingConfig) {
    await telnyxConfigRepo.update(organizationId, {
      accountSid: TELNYX_ACCOUNT_SID,
      authTokenEncrypted: encrypt(TELNYX_MASTER_API_KEY),
      phoneNumbers,
    })
  } else {
    await telnyxConfigRepo.create({
      organizationId,
      accountSid: TELNYX_ACCOUNT_SID,
      authTokenEncrypted: encrypt(TELNYX_MASTER_API_KEY),
      phoneNumbers,
    })
  }

  logger.info('Marked org as main account', {
    organizationId,
    phoneNumberCount: phoneNumbers.length,
    phoneNumbers,
  })

  return { success: true }
}

// === Telnyx API Helpers ===

/**
 * Number orders are asynchronous — poll until the purchased number shows up
 * on the account (usually within a few seconds for US local numbers).
 */
async function waitForOwnedNumber(
  apiKey: string,
  phoneNumber: string,
  maxAttempts = 10,
  delayMs = 2000,
): Promise<telnyx.TelnyxPhoneNumber> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const owned = await telnyx.findPhoneNumber(apiKey, phoneNumber)
    if (owned) {
      return owned
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(
    `Number order for ${phoneNumber} did not complete in time — check the order status in the Telnyx portal.`,
  )
}

async function ensureTelnyxConfig(
  organizationId: string,
  phoneNumber: string,
  previousPhoneNumber?: string | null,
) {
  if (!TELNYX_ACCOUNT_SID) {
    throw new Error('TELNYX_ACCOUNT_SID not configured')
  }
  const apiKey = getMasterApiKey()
  const existing = await telnyxConfigRepo.findByOrganizationId(organizationId)
  if (existing) {
    await telnyxConfigRepo.update(organizationId, {
      accountSid: TELNYX_ACCOUNT_SID,
      authTokenEncrypted: encrypt(apiKey),
      phoneNumbers: mergePhoneNumbers(
        existing.phoneNumbers || [],
        [phoneNumber],
        previousPhoneNumber,
      ),
    })
  } else {
    await telnyxConfigRepo.create({
      organizationId,
      accountSid: TELNYX_ACCOUNT_SID,
      authTokenEncrypted: encrypt(apiKey),
      phoneNumbers: [phoneNumber],
    })
  }
}
