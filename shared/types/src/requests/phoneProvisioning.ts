import { z } from 'zod'

// === Get Phone Provisioning Status ===
export const GetPhoneProvisioningStatusRequestSchema = z.object({})
export type GetPhoneProvisioningStatusRequest = z.infer<
  typeof GetPhoneProvisioningStatusRequestSchema
>

export type PhoneProvisioningStatusResponse = {
  data: {
    id: string
    organizationId: string
    phoneNumber: string | null
    numberType: string
    provisioningStatus: string
    callerIdVerified: boolean
    usesMainAccount: boolean
    hasInfrastructure: boolean
    provisionedAt: string | null
    // Only populated for search result context
    city?: string
    state?: string
  } | null
}

// === Setup Infrastructure ===
export const SetupInfrastructureRequestSchema = z.object({})
export type SetupInfrastructureRequest = z.infer<
  typeof SetupInfrastructureRequestSchema
>

// === Search Available Numbers ===
export const SearchAvailableNumbersRequestSchema = z.object({
  areaCode: z.string().length(3).regex(/^\d{3}$/),
})
export type SearchAvailableNumbersRequest = z.infer<
  typeof SearchAvailableNumbersRequestSchema
>

export type AvailablePhoneNumber = {
  phoneNumber: string
  friendlyName: string
  locality: string
  region: string
  isoCountry: string
}

export type SearchAvailableNumbersResponse = {
  data: AvailablePhoneNumber[]
}

// === Provision Phone Number (dedicated) ===
export const ProvisionPhoneNumberRequestSchema = z.object({
  phoneNumber: z.string().startsWith('+'),
})
export type ProvisionPhoneNumberRequest = z.infer<
  typeof ProvisionPhoneNumberRequestSchema
>

export type ProvisionPhoneNumberResponse = {
  data: {
    phoneNumber: string
    numberType: string
    provisioningStatus: string
  }
}

// === Provision Trial Number ===
export const ProvisionTrialNumberRequestSchema = z.object({})
export type ProvisionTrialNumberRequest = z.infer<
  typeof ProvisionTrialNumberRequestSchema
>

// === Verify Caller ID ===
export const VerifyCallerIdRequestSchema = z.object({})
export type VerifyCallerIdRequest = z.infer<typeof VerifyCallerIdRequestSchema>

export type VerifyCallerIdResponse = {
  data: {
    validationCode: string
    callSid: string
  }
}

// === Check Caller ID Verification Status ===
export const CheckCallerIdVerificationRequestSchema = z.object({})
export type CheckCallerIdVerificationRequest = z.infer<
  typeof CheckCallerIdVerificationRequestSchema
>

export type CheckCallerIdVerificationResponse = {
  data: {
    callerIdVerified: boolean
  }
}

// === Admin: List All Phone Provisioning Records ===
export type AdminPhoneProvisioningRecord = {
  id: string | null
  organizationId: string
  organizationName: string
  managedBySuperadmin: boolean
  twilioSubaccountSid: string | null
  phoneNumber: string | null
  numberType: string | null
  provisioningStatus: string
  usesMainAccount: boolean
  callerIdVerified: boolean
  provisionedAt: string | null
  createdAt: string | null
}

export type AdminPhoneProvisioningResponse = {
  data: AdminPhoneProvisioningRecord[]
}
