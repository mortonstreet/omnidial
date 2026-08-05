import { db } from '@/lib/db'
import { phoneNumbersMatch } from '@/lib/phone'
import { withIdAndTimestamps, withTimestamps } from './utils'

export interface CreateTwilioConfigInput {
  organizationId: string
  accountSid: string
  authTokenEncrypted: string
  phoneNumbers?: string[]
}

export interface UpdateTwilioConfigInput {
  accountSid?: string
  authTokenEncrypted?: string
  phoneNumbers?: string[]
}

export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('twilio_config')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('twilio_config')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (data: CreateTwilioConfigInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      phoneNumbers: data.phoneNumbers || [],
    },
    true,
  )

  return db
    .insertInto('twilio_config')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  organizationId: string,
  data: UpdateTwilioConfigInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('twilio_config')
    .set(record)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

export const deleteByOrganizationId = async (organizationId: string) => {
  return db
    .deleteFrom('twilio_config')
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

/**
 * Find a Twilio config by phone number
 * Used to route inbound calls to the correct organization
 */
export const findByPhoneNumber = async (phoneNumber: string) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null
  }

  // Prefer the authoritative provisioning record. Config phone number arrays
  // can become stale or duplicated across orgs when a shared Telnyx account is
  // used, but a provisioned number belongs to exactly one org.
  const provisioningRecords = await db
    .selectFrom('phone_provisioning')
    .select([
      'organizationId',
      'phoneNumber',
      'twilioSubaccountSid',
      'twilioAuthTokenEncrypted',
      'usesMainAccount',
    ])
    .where('phoneNumber', 'is not', null)
    .execute()

  const matchedProvisioning = provisioningRecords.find(
    (record) =>
      typeof record.phoneNumber === 'string' &&
      phoneNumbersMatch(record.phoneNumber, phoneNumber),
  )

  if (!matchedProvisioning || !matchedProvisioning.phoneNumber) {
    const configs = await db.selectFrom('twilio_config').selectAll().execute()
    const configMatches = configs.filter((config) =>
      (config.phoneNumbers || []).some((stored) =>
        phoneNumbersMatch(stored, phoneNumber),
      ),
    )

    if (configMatches.length === 0) {
      return null
    }

    if (configMatches.length === 1) {
      return configMatches[0]
    }

    const provisioningByOrg = new Map(
      provisioningRecords.map((record) => [record.organizationId, record]),
    )
    const mainAccountConfig = configMatches.find(
      (config) => provisioningByOrg.get(config.organizationId)?.usesMainAccount,
    )
    if (mainAccountConfig) {
      return mainAccountConfig
    }

    console.warn(
      `Multiple Telnyx configs match inbound number ${phoneNumber}; using first match`,
      configMatches.map((config) => config.organizationId),
    )
    return configMatches[0]
  }

  const matchedPhoneNumber = matchedProvisioning.phoneNumber

  const existingConfig = await findByOrganizationId(
    matchedProvisioning.organizationId,
  )
  if (existingConfig) {
    const existingNumbers = existingConfig.phoneNumbers || []
    const hasPhoneNumber = existingNumbers.some((stored) =>
      phoneNumbersMatch(stored, matchedPhoneNumber),
    )

    if (!hasPhoneNumber) {
      const updated = await update(matchedProvisioning.organizationId, {
        phoneNumbers: [...existingNumbers, matchedPhoneNumber],
      })
      return updated || existingConfig
    }

    return existingConfig
  }

  // Self-heal: create twilio_config from provisioning credentials when possible.
  if (
    matchedProvisioning.twilioSubaccountSid &&
    matchedProvisioning.twilioAuthTokenEncrypted
  ) {
    try {
      return await create({
        organizationId: matchedProvisioning.organizationId,
        accountSid: matchedProvisioning.twilioSubaccountSid,
        authTokenEncrypted: matchedProvisioning.twilioAuthTokenEncrypted,
        phoneNumbers: [matchedPhoneNumber],
      })
    } catch {
      return findByOrganizationId(matchedProvisioning.organizationId)
    }
  }

  return null
}
