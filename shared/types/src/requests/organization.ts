import { z } from 'zod'

export const GetCreditBalanceRequestSchema = z.object({
  organizationId: z.string(),
})

export type GetCreditBalanceRequest = z.infer<typeof GetCreditBalanceRequestSchema>

export const UpdateOrganizationRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
})

export type UpdateOrganizationRequest = z.infer<
  typeof UpdateOrganizationRequestSchema
>
