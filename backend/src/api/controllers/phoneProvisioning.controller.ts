import * as phoneProvisioningService from '@/services/phoneProvisioning.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  GetPhoneProvisioningStatusRequest,
  SearchAvailableNumbersRequest,
  ProvisionPhoneNumberRequest,
  SetupInfrastructureRequest,
  VerifyCallerIdRequest,
  CheckCallerIdVerificationRequest,
} from '@shared/types/src'

const getOrganizationId = (session: any): string | null => {
  return session?.session?.activeOrganizationId || null
}

export const getStatus: AuthRequestHandler<
  GetPhoneProvisioningStatusRequest
> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const status =
      await phoneProvisioningService.getProvisioningStatus(organizationId)
    res.json({ data: status })
  } catch (error) {
    console.error('Failed to get phone provisioning status:', error)
    res.status(500).json({ error: 'Failed to get provisioning status' })
  }
}

export const searchNumbers: AuthRequestHandler<
  SearchAvailableNumbersRequest
> = async (req, res) => {
  try {
    const { areaCode } = req.validated
    const numbers =
      await phoneProvisioningService.searchAvailableNumbers(areaCode)
    res.json({ data: numbers })
  } catch (error) {
    console.error('Failed to search available numbers:', error)
    res.status(500).json({ error: 'Failed to search available numbers' })
  }
}

export const setupInfrastructure: AuthRequestHandler<
  SetupInfrastructureRequest
> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const result =
      await phoneProvisioningService.setupSubaccountInfrastructure(
        organizationId,
      )
    res.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to setup infrastructure' })
    }
  }
}

export const provisionDedicated: AuthRequestHandler<
  ProvisionPhoneNumberRequest
> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const { phoneNumber } = req.validated
    const result = await phoneProvisioningService.provisionSelectedNumber(
      organizationId,
      phoneNumber,
    )
    res.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to provision phone number' })
    }
  }
}

export const provisionQuick: AuthRequestHandler<{}> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const result =
      await phoneProvisioningService.provisionQuickNumber(organizationId)
    res.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to quick-provision phone number' })
    }
  }
}

export const verifyCaller: AuthRequestHandler<VerifyCallerIdRequest> = async (
  req,
  res,
) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const result = await phoneProvisioningService.verifyCallerId(organizationId)
    res.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to verify caller ID' })
    }
  }
}

export const checkVerification: AuthRequestHandler<
  CheckCallerIdVerificationRequest
> = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req.session)
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' })
    }
    const result =
      await phoneProvisioningService.checkCallerIdVerification(organizationId)
    res.json({ data: result })
  } catch (error) {
    console.error('Failed to check caller ID verification:', error)
    res.status(500).json({ error: 'Failed to check verification status' })
  }
}

// Admin controller
export const getAdminPhoneProvisioning: AuthRequestHandler<{}> = async (
  req,
  res,
) => {
  try {
    const records = await phoneProvisioningService.getAllProvisioningRecords()

    const enriched = records.map((record) => ({
      id: record.id || null,
      organizationId: record.organizationId,
      organizationName: record.organizationName,
      managedBySuperadmin: record.managedBySuperadmin,
      twilioSubaccountSid: record.twilioSubaccountSid || null,
      phoneNumber: record.phoneNumber || null,
      numberType: record.numberType || null,
      provisioningStatus: record.provisioningStatus || 'not_provisioned',
      usesMainAccount: record.usesMainAccount || false,
      callerIdVerified: record.callerIdVerified || false,
      provisionedAt: record.provisionedAt
        ? new Date(record.provisionedAt).toISOString()
        : null,
      createdAt: record.createdAt
        ? new Date(record.createdAt).toISOString()
        : null,
    }))

    res.json({ data: enriched })
  } catch (error) {
    console.error('Failed to get admin phone provisioning:', error)
    res.status(500).json({ error: 'Failed to get provisioning records' })
  }
}
