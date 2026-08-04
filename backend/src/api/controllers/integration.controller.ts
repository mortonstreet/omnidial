import * as integrationService from '@/services/integration.service'
import * as enrichEngineService from '@/services/enrichEngine.service'
import * as leadService from '@/services/lead.service'
import * as leadListService from '@/services/leadList.service'
import { AuthRequestHandler } from '@/types/handlers'
import { config } from '@/config'
import { Request, Response } from 'express'
import {
  ListIntegrationsRequest,
  GetIntegrationStatusRequest,
  ConnectIntegrationRequest,
  IntegrationCallbackRequest,
  UpdateIntegrationConfigRequest,
  DisconnectIntegrationRequest,
  TestIntegrationRequest,
  ListGoogleSheetsRequest,
  GetSheetColumnsRequest,
  ImportFromSheetRequest,
  ListEnrichEngineListsRequest,
  GetEnrichEngineListLeadsRequest,
  ImportFromEnrichEngineRequest,
  ConnectEnrichEngineRequest,
  GetEnrichEngineStatusRequest,
  DisconnectEnrichEngineRequest,
  TestEnrichEngineRequest,
  CheckSheetsWriteAccessRequest,
  ExportLeadsToSheetRequest,
  ExportListToSheetRequest,
  ExportAnalyticsToSheetRequest,
  ListHubSpotContactListsRequest,
  ImportFromHubSpotRequest,
} from '@shared/types/src'

export const listIntegrations: AuthRequestHandler<
  ListIntegrationsRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  const result = await integrationService.listIntegrations(organizationId)
  res.json(result)
}

export const getIntegrationStatus: AuthRequestHandler<
  GetIntegrationStatusRequest
> = async (req, res) => {
  const { organizationId, provider } = req.validated

  try {
    const result = await integrationService.getIntegrationStatus(
      organizationId,
      provider,
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: 'Unknown integration provider' })
  }
}

export const connectIntegration: AuthRequestHandler<
  ConnectIntegrationRequest
> = async (req, res) => {
  const { organizationId, provider, redirectUrl } = req.validated

  try {
    const result = await integrationService.initiateOAuthFlow(
      organizationId,
      provider,
      req.user.id,
      redirectUrl,
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const handleOAuthCallback: AuthRequestHandler<
  IntegrationCallbackRequest
> = async (req, res) => {
  const { organizationId, provider, code } = req.validated

  try {
    await integrationService.handleOAuthCallback(
      organizationId,
      provider,
      req.user.id,
      code,
    )
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

// GET callback handler for OAuth redirects from providers like Google
// This is called by the OAuth provider (e.g., Google) after user grants permission
// No authentication middleware - state parameter contains user/org info
export const handleOAuthCallbackRedirect = async (
  req: Request,
  res: Response,
) => {
  const { code, state, error: oauthError } = req.query

  // Default redirect path for errors
  const errorRedirect = `${config.frontendUrl}/dashboard/settings?error=oauth_failed`

  // Check for OAuth errors (e.g., user denied access)
  if (oauthError) {
    console.error('OAuth error:', oauthError)
    return res.redirect(
      `${config.frontendUrl}/dashboard/settings?error=${oauthError}`,
    )
  }

  if (
    !code ||
    !state ||
    typeof code !== 'string' ||
    typeof state !== 'string'
  ) {
    console.error('Missing code or state in OAuth callback')
    return res.redirect(errorRedirect)
  }

  // Decode state to get organizationId, provider, userId, and redirectUrl
  let stateData: {
    organizationId: string
    provider: string
    userId: string
    redirectUrl?: string
    timestamp: number
  }

  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    console.error('Failed to decode OAuth state')
    return res.redirect(errorRedirect)
  }

  const { organizationId, provider, userId, redirectUrl } = stateData

  // Validate state timestamp (expires after 10 minutes)
  const stateAge = Date.now() - stateData.timestamp
  if (stateAge > 10 * 60 * 1000) {
    console.error('OAuth state expired')
    return res.redirect(
      `${config.frontendUrl}/dashboard/settings?error=state_expired`,
    )
  }

  try {
    console.log('OAuth callback processing:', {
      provider,
      organizationId,
      backendUrl: config.backendUrl,
      callbackUri: `${config.backendUrl}/api/integrations/${provider}/callback`,
    })

    await integrationService.handleOAuthCallback(
      organizationId,
      provider,
      userId,
      code,
    )

    // Redirect to frontend with success
    const successUrl = redirectUrl || '/dashboard/settings'
    const redirectBase = successUrl.startsWith('http')
      ? successUrl
      : `${config.frontendUrl}${successUrl}`
    const separator = redirectBase.includes('?') ? '&' : '?'
    return res.redirect(
      `${redirectBase}${separator}integration_connected=${provider}`,
    )
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error'
    console.error('OAuth callback error:', {
      provider,
      organizationId,
      backendUrl: config.backendUrl,
      error: errorMessage,
      stack: (error as Error).stack,
    })
    return res.redirect(
      `${config.frontendUrl}/dashboard/settings?error=oauth_callback_failed&detail=${encodeURIComponent(errorMessage)}`,
    )
  }
}

export const updateIntegrationConfig: AuthRequestHandler<
  UpdateIntegrationConfigRequest
> = async (req, res) => {
  const { organizationId, provider, config } = req.validated

  const result = await integrationService.updateIntegrationConfig(
    organizationId,
    provider,
    config,
  )
  res.json({ data: result })
}

export const disconnectIntegration: AuthRequestHandler<
  DisconnectIntegrationRequest
> = async (req, res) => {
  const { organizationId, provider } = req.validated

  await integrationService.disconnectIntegration(organizationId, provider)
  res.json({ success: true })
}

export const testIntegration: AuthRequestHandler<
  TestIntegrationRequest
> = async (req, res) => {
  const { organizationId, provider } = req.validated

  const result = await integrationService.testConnection(
    organizationId,
    provider,
  )
  res.json({ data: result })
}

// === Google Sheets Specific ===

export const listGoogleSheets: AuthRequestHandler<
  ListGoogleSheetsRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    const sheets = await integrationService.listGoogleSheets(organizationId)
    res.json({ data: sheets })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const getSheetColumns: AuthRequestHandler<
  GetSheetColumnsRequest
> = async (req, res) => {
  const { organizationId, sheetId } = req.validated

  try {
    const columns = await integrationService.getGoogleSheetColumns(
      organizationId,
      sheetId,
    )
    res.json({ data: columns })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const importFromSheet: AuthRequestHandler<
  ImportFromSheetRequest
> = async (req, res) => {
  const { organizationId, sheetId, columnMappings, listName } = req.validated

  try {
    // Get spreadsheet name for list name
    const sheetName =
      listName ||
      (await integrationService.getGoogleSheetName(organizationId, sheetId))

    // Create a new lead list
    const list = await leadListService.createList({
      organizationId,
      name: sheetName,
      description: `Imported from Google Sheets`,
      createdById: req.user.id,
    })

    // Read data from spreadsheet
    const rows = await integrationService.getGoogleSheetData(
      organizationId,
      sheetId,
    )

    // Build mapping from column index to lead field
    const fieldMap = new Map<number, string>()
    for (const mapping of columnMappings) {
      fieldMap.set(mapping.columnIndex, mapping.leadField)
    }

    // Import leads
    const leadIds: string[] = []
    const errors: string[] = []

    for (const row of rows) {
      try {
        const leadData: Record<string, string | undefined> = {}

        for (const [colIndex, value] of row.values.entries()) {
          const fieldName = fieldMap.get(colIndex)
          if (fieldName && value) {
            leadData[fieldName] = value
          }
        }

        // Skip rows without phone (required field)
        if (!leadData.phone) {
          continue
        }

        const lead = await leadService.create({
          organizationId,
          userId: req.user.id,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          email: leadData.email,
          phone: leadData.phone,
          company: leadData.company,
          title: leadData.title,
          linkedInUrl: leadData.linkedInUrl,
        })

        leadIds.push(lead.id)
      } catch (error) {
        errors.push(`Row ${row.rowIndex}: ${(error as Error).message}`)
      }
    }

    // Add leads to the list
    if (leadIds.length > 0) {
      await leadListService.addLeadsToList(list.id, organizationId, leadIds)
    }

    res.json({
      data: {
        success: true,
        listId: list.id,
        listName: list.name,
        leadsImported: leadIds.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error list
      },
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

// === Enrich Engine Specific (API Key Authentication) ===

/**
 * Connect EnrichEngine using API key
 */
export const connectEnrichEngine: AuthRequestHandler<
  ConnectEnrichEngineRequest
> = async (req, res) => {
  const { organizationId, apiKey } = req.validated

  try {
    const result = await enrichEngineService.connect(
      organizationId,
      req.user.id,
      apiKey,
    )
    res.json({ data: result })
  } catch (error) {
    console.error('EnrichEngine connect error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      organizationId,
      apiKeyPrefix: apiKey?.substring(0, 15) + '...',
    })
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Get EnrichEngine connection status
 */
export const getEnrichEngineStatus: AuthRequestHandler<
  GetEnrichEngineStatusRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    const status = await enrichEngineService.getConnectionStatus(organizationId)
    res.json({ data: status })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Disconnect EnrichEngine
 */
export const disconnectEnrichEngine: AuthRequestHandler<
  DisconnectEnrichEngineRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    await enrichEngineService.disconnect(organizationId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Test EnrichEngine connection
 */
export const testEnrichEngine: AuthRequestHandler<
  TestEnrichEngineRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    const result = await enrichEngineService.testConnection(organizationId)
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * List available EnrichEngine lists
 */
export const listEnrichEngineLists: AuthRequestHandler<
  ListEnrichEngineListsRequest
> = async (req, res) => {
  const { organizationId, page, limit, search } = req.validated

  try {
    const result = await enrichEngineService.getLists(organizationId, {
      page: page ?? 1,
      limit: limit ?? 20,
      search,
    })
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Get leads from a specific EnrichEngine list
 */
export const getEnrichEngineListLeads: AuthRequestHandler<
  GetEnrichEngineListLeadsRequest
> = async (req, res) => {
  const { organizationId, listId, page, limit } = req.validated

  try {
    const result = await enrichEngineService.getListWithLeads(
      organizationId,
      listId,
      { page: page ?? 1, limit: limit ?? 100 },
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Import leads from EnrichEngine list
 */
export const importFromEnrichEngine: AuthRequestHandler<
  ImportFromEnrichEngineRequest
> = async (req, res) => {
  const { organizationId, listId, listName } = req.validated

  try {
    // Get list info from EnrichEngine to get name if not provided
    const listsResponse = await enrichEngineService.getLists(organizationId)
    const enrichList = listsResponse.lists.find((l) => l.id === listId)

    if (!enrichList) {
      return res.status(404).json({ error: 'EnrichEngine list not found' })
    }

    const finalListName = listName || enrichList.name

    // Create a new lead list
    const list = await leadListService.createList({
      organizationId,
      name: finalListName,
      description: `Imported from EnrichEngine`,
      createdById: req.user.id,
    })

    // Fetch all leads from EnrichEngine (handles pagination internally)
    const enrichLeads = await enrichEngineService.getAllLeadsFromList(
      organizationId,
      listId,
    )

    const leadIds: string[] = []
    const errors: string[] = []

    for (const enrichLead of enrichLeads) {
      try {
        // Import enrichment-first leads when they at least have a phone or LinkedIn URL.
        if (!enrichLead.phone && !enrichLead.linkedinUrl) {
          continue
        }

        const lead = await leadService.create({
          organizationId,
          userId: req.user.id,
          firstName: enrichLead.firstName || undefined,
          lastName: enrichLead.lastName || undefined,
          email: enrichLead.email || undefined,
          phone: enrichLead.phone || '',
          company: enrichLead.company || undefined,
          title: enrichLead.role || undefined,
          linkedInUrl: enrichLead.linkedinUrl || undefined,
          customFields: enrichLead.customFields as Record<string, string>,
        })

        leadIds.push(lead.id)
      } catch (error) {
        errors.push(
          `Lead ${enrichLead.firstName || ''} ${enrichLead.lastName || ''}: ${(error as Error).message}`,
        )
      }
    }

    // Add leads to the list
    if (leadIds.length > 0) {
      await leadListService.addLeadsToList(list.id, organizationId, leadIds)
    }

    // Update last sync timestamp
    await enrichEngineService.updateLastSyncAt(organizationId)

    res.json({
      data: {
        success: true,
        listId: list.id,
        listName: list.name,
        leadsImported: leadIds.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      },
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

// === HubSpot Specific ===

export const getHubSpotContactsSummary: AuthRequestHandler<
  ListHubSpotContactListsRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    const summary =
      await integrationService.getHubSpotContactsSummary(organizationId)
    res.json({ data: summary })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const importFromHubSpot: AuthRequestHandler<
  ImportFromHubSpotRequest
> = async (req, res) => {
  const { organizationId, listName, requirePhone, maxContacts } = req.validated

  try {
    const contacts = await integrationService.fetchHubSpotContacts(
      organizationId,
      maxContacts,
    )

    const now = new Date()
    const defaultListName =
      listName ||
      `HubSpot Import ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const list = await leadListService.createList({
      organizationId,
      name: defaultListName,
      description: 'Imported from HubSpot',
      createdById: req.user.id,
    })

    const leadIds: string[] = []
    const errors: string[] = []

    for (const contact of contacts) {
      try {
        if (requirePhone && !contact.phone) {
          continue
        }

        // phone is required for lead creation; skip if missing
        if (!contact.phone) {
          continue
        }

        const lead = await leadService.create({
          organizationId,
          userId: req.user.id,
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
          email: contact.email || undefined,
          phone: contact.phone,
          company: contact.company || undefined,
          title: contact.jobTitle || undefined,
        })

        leadIds.push(lead.id)
      } catch (error) {
        errors.push(
          `Contact ${contact.firstName || ''} ${contact.lastName || ''}: ${(error as Error).message}`,
        )
      }
    }

    if (leadIds.length > 0) {
      await leadListService.addLeadsToList(list.id, organizationId, leadIds)
    }

    // Update last sync timestamp
    await integrationService.updateIntegrationConfig(
      organizationId,
      'hubspot',
      {},
    )

    res.json({
      data: {
        success: true,
        listId: list.id,
        listName: list.name,
        leadsImported: leadIds.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      },
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

// === Google Sheets Export ===

/**
 * Check if user has write access to Google Sheets (for export)
 */
export const checkSheetsWriteAccess: AuthRequestHandler<
  CheckSheetsWriteAccessRequest
> = async (req, res) => {
  const { organizationId } = req.validated

  try {
    const result =
      await integrationService.checkSheetsWriteAccess(organizationId)
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Export leads to Google Sheets
 */
export const exportLeadsToSheet: AuthRequestHandler<
  ExportLeadsToSheetRequest
> = async (req, res) => {
  const { organizationId, leadIds, target, existingSheetId, newSheetTitle } =
    req.validated

  try {
    const result = await integrationService.exportLeadsToSheet(
      organizationId,
      leadIds,
      target,
      existingSheetId,
      newSheetTitle,
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Export a list to Google Sheets
 */
export const exportListToSheet: AuthRequestHandler<
  ExportListToSheetRequest
> = async (req, res) => {
  const { organizationId, listId, target, existingSheetId, newSheetTitle } =
    req.validated

  try {
    const result = await integrationService.exportListToSheet(
      organizationId,
      listId,
      target,
      existingSheetId,
      newSheetTitle,
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

/**
 * Export analytics to Google Sheets
 */
export const exportAnalyticsToSheet: AuthRequestHandler<
  ExportAnalyticsToSheetRequest
> = async (req, res) => {
  const { organizationId, dateRange, target, existingSheetId, newSheetTitle } =
    req.validated

  try {
    const result = await integrationService.exportAnalyticsToSheet(
      organizationId,
      dateRange,
      target,
      existingSheetId,
      newSheetTitle,
    )
    res.json({ data: result })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}
