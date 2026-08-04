import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps } from './utils'

export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('phone_provisioning')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (data: {
  organizationId: string
  twilioSubaccountSid?: string
  twilioAuthTokenEncrypted?: string
  apiKeySid?: string
  apiKeySecretEncrypted?: string
  twimlAppSid?: string
  phoneNumber?: string
  phoneNumberSid?: string
  numberType?: string
  provisioningStatus?: string
  usesMainAccount?: boolean
  callerIdVerified?: boolean
}) => {
  const record = withIdAndTimestamps(data, true)
  return db
    .insertInto('phone_provisioning')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  organizationId: string,
  data: {
    twilioSubaccountSid?: string | null
    twilioAuthTokenEncrypted?: string | null
    apiKeySid?: string | null
    apiKeySecretEncrypted?: string | null
    twimlAppSid?: string | null
    phoneNumber?: string | null
    phoneNumberSid?: string | null
    numberType?: string
    provisioningStatus?: string
    usesMainAccount?: boolean
    callerIdVerified?: boolean
    provisionedAt?: Date | null
  },
) => {
  const record = withTimestamps(data)
  return db
    .updateTable('phone_provisioning')
    .set(record)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

export const findAll = async () => {
  return db
    .selectFrom('phone_provisioning')
    .selectAll()
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findAllWithOrganizations = async () => {
  return db
    .selectFrom('organization')
    .leftJoin(
      'phone_provisioning',
      'phone_provisioning.organizationId',
      'organization.id',
    )
    .select([
      'organization.id as organizationId',
      'organization.name as organizationName',
      'organization.managedBySuperadmin',
      'phone_provisioning.id',
      'phone_provisioning.twilioSubaccountSid',
      'phone_provisioning.phoneNumber',
      'phone_provisioning.numberType',
      'phone_provisioning.provisioningStatus',
      'phone_provisioning.usesMainAccount',
      'phone_provisioning.callerIdVerified',
      'phone_provisioning.provisionedAt',
      'phone_provisioning.createdAt',
    ])
    .orderBy('organization.createdAt', 'desc')
    .execute()
}
