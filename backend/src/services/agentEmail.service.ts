/**
 * Agent Email Service
 * Manages email configuration and sending for AI SDR agents
 */

import { encrypt, decrypt } from '@/lib/encryption'
import * as agentRepo from '@/repositories/agent.repository'
import * as agentEmailConfigRepo from '@/repositories/agentEmailConfig.repository'
import * as agentMessageRepo from '@/repositories/agentMessage.repository'
import type {
  ConfigureAgentEmailRequest,
  AgentEmailConfigResponse,
  SendAgentMessageRequest,
  AgentMessageResponse,
} from '@shared/types/src/requests/leadAgent'
import { db } from '@/lib/db'

// AgentMail.to API (v0)
const AGENTMAIL_BASE_URL =
  process.env.AGENTMAIL_BASE_URL || 'https://api.agentmail.to/v0'

/**
 * Configure email for an agent
 */
export async function configureEmail(
  agentId: string,
  organizationId: string,
  config: ConfigureAgentEmailRequest,
): Promise<AgentEmailConfigResponse> {
  // Verify agent belongs to organization
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  let fromEmail: string
  let configData: agentEmailConfigRepo.CreateAgentEmailConfigInput

  switch (config.provider) {
    case 'agentmail':
      fromEmail = config.fromEmail
      configData = {
        agentId,
        provider: 'agentmail',
        agentmailApiKeyEncrypted: encrypt(config.apiKey),
        agentmailInboxId: config.inboxId || null,
        fromEmail,
        fromName: config.fromName || null,
        signatureHtml: config.signatureHtml || null,
        isVerified: false,
      }
      break

    case 'gmail':
      // For Gmail, we'd need to exchange the auth code for tokens
      // This is a simplified implementation
      throw new Error('Gmail OAuth not yet implemented')

    case 'outlook':
      // For Outlook, we'd need to exchange the auth code for tokens
      throw new Error('Outlook OAuth not yet implemented')

    default:
      throw new Error('Unknown email provider')
  }

  // Upsert the config
  const saved = await agentEmailConfigRepo.upsertByAgentId(agentId, configData)

  return transformEmailConfig(saved)
}

/**
 * Test email connection
 */
export async function testEmailConnection(
  agentId: string,
  organizationId: string,
): Promise<{ success: boolean; message: string }> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const config = await agentEmailConfigRepo.findByAgentId(agentId)
  if (!config) {
    throw new Error('Email not configured')
  }

  switch (config.provider) {
    case 'agentmail':
      return testAgentMail(config)
    case 'gmail':
      return testGmail(config)
    case 'outlook':
      return testOutlook(config)
    default:
      return { success: false, message: 'Unknown provider' }
  }
}

/**
 * Verify email configuration (mark as verified after successful test)
 */
export async function verifyEmailConfig(
  agentId: string,
  organizationId: string,
): Promise<AgentEmailConfigResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  // Test the connection
  const testResult = await testEmailConnection(agentId, organizationId)
  if (!testResult.success) {
    throw new Error(`Verification failed: ${testResult.message}`)
  }

  // Mark as verified
  await agentEmailConfigRepo.setVerified(agentId, true)

  const config = await agentEmailConfigRepo.findByAgentId(agentId)
  if (!config) {
    throw new Error('Config not found after verification')
  }

  return transformEmailConfig(config)
}

/**
 * Send an email on behalf of an agent
 */
export async function sendEmail(
  agentId: string,
  organizationId: string,
  request: {
    leadId: string
    subject: string
    bodyHtml: string
    workflowId?: string
  },
): Promise<AgentMessageResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  if (!agent.emailEnabled) {
    throw new Error('Email is not enabled for this agent')
  }

  const config = await agentEmailConfigRepo.findByAgentId(agentId)
  if (!config || !config.isVerified) {
    throw new Error('Email not configured or not verified')
  }

  // Check daily limit
  const sentToday = await agentMessageRepo.countTodayByAgentIdAndType(
    agentId,
    'email',
  )
  if (sentToday >= agent.dailyEmailLimit) {
    throw new Error('Daily email limit reached')
  }

  // Get lead email
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', request.leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .select(['id', 'email', 'firstName', 'lastName'])
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  if (!lead.email) {
    throw new Error('Lead has no email address')
  }

  // Create message record
  const message = await agentMessageRepo.create({
    agentId,
    workflowId: request.workflowId || null,
    leadId: request.leadId,
    messageType: 'email',
    status: 'sending',
    emailSubject: request.subject,
    emailBodyHtml: request.bodyHtml,
    toEmail: lead.email,
  })

  // Send the email
  try {
    await sendViaProvider(config, {
      to: lead.email,
      toName:
        `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || undefined,
      subject: request.subject,
      bodyHtml: request.bodyHtml,
    })

    // Update status to sent
    await agentMessageRepo.update(message.id, { status: 'sent' })

    const updated = await agentMessageRepo.findById(message.id)
    return transformMessage(updated!)
  } catch (error) {
    // Mark as failed
    await agentMessageRepo.markFailed(
      message.id,
      error instanceof Error ? error.message : 'Unknown error',
    )

    throw error
  }
}

/**
 * Get email configuration for an agent
 */
export async function getEmailConfig(
  agentId: string,
  organizationId: string,
): Promise<AgentEmailConfigResponse | null> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const config = await agentEmailConfigRepo.findByAgentId(agentId)
  if (!config) {
    return null
  }

  return transformEmailConfig(config)
}

/**
 * Delete email configuration
 */
export async function deleteEmailConfig(
  agentId: string,
  organizationId: string,
): Promise<void> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  await agentEmailConfigRepo.deleteByAgentId(agentId)
}

// Provider-specific implementations

async function testAgentMail(
  config: Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>,
): Promise<{ success: boolean; message: string }> {
  if (!config?.agentmailApiKeyEncrypted) {
    return { success: false, message: 'API key not configured' }
  }

  const apiKey = decrypt(config.agentmailApiKeyEncrypted)

  try {
    // Test by listing inboxes (v0 API)
    const response = await fetch(`${AGENTMAIL_BASE_URL}/inboxes`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, message: `AgentMail error: ${error}` }
    }

    const data = await response.json()
    const inboxCount = Array.isArray(data)
      ? data.length
      : data.inboxes?.length || 0

    return {
      success: true,
      message: `AgentMail connected (${inboxCount} inbox${inboxCount !== 1 ? 'es' : ''})`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

async function testGmail(
  config: Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>,
): Promise<{ success: boolean; message: string }> {
  if (!config) {
    return { success: false, message: 'Config not found' }
  }

  const gmailAgentService = await import('@/services/gmailAgent.service')
  return gmailAgentService.testConnection(config.agentId)
}

async function testOutlook(
  config: Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>,
): Promise<{ success: boolean; message: string }> {
  // Would implement MS Graph API test
  return { success: false, message: 'Outlook not yet implemented' }
}

async function sendViaProvider(
  config: Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>,
  email: {
    to: string
    toName?: string
    subject: string
    bodyHtml: string
  },
): Promise<void> {
  if (!config) {
    throw new Error('Email config not found')
  }

  switch (config.provider) {
    case 'agentmail':
      await sendViaAgentMail(config, email)
      break
    case 'gmail':
      await sendViaGmail(config, email)
      break
    case 'outlook':
      throw new Error('Outlook sending not yet implemented')
    default:
      throw new Error('Unknown provider')
  }
}

async function sendViaGmail(
  config: NonNullable<
    Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>
  >,
  email: {
    to: string
    toName?: string
    subject: string
    bodyHtml: string
  },
): Promise<void> {
  const gmailAgentService = await import('@/services/gmailAgent.service')
  await gmailAgentService.sendEmail(
    config.agentId,
    email.to,
    email.subject,
    email.bodyHtml,
  )
}

async function sendViaAgentMail(
  config: NonNullable<
    Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>
  >,
  email: {
    to: string
    toName?: string
    subject: string
    bodyHtml: string
  },
): Promise<{ messageId: string; threadId: string }> {
  if (!config.agentmailApiKeyEncrypted) {
    throw new Error('AgentMail API key not configured')
  }

  if (!config.agentmailInboxId) {
    throw new Error('AgentMail inbox ID not configured')
  }

  const apiKey = decrypt(config.agentmailApiKeyEncrypted)

  // Add signature if configured
  let bodyHtml = email.bodyHtml
  if (config.signatureHtml) {
    bodyHtml += `<br><br>${config.signatureHtml}`
  }

  // Format recipient - AgentMail accepts "Name <email>" or just "email"
  const toAddress = email.toName ? `${email.toName} <${email.to}>` : email.to

  // AgentMail v0 API: POST /inboxes/{inbox_id}/messages/send
  const response = await fetch(
    `${AGENTMAIL_BASE_URL}/inboxes/${config.agentmailInboxId}/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toAddress,
        subject: email.subject,
        html: bodyHtml,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AgentMail send failed: ${error}`)
  }

  const result = await response.json()
  return {
    messageId: result.message_id,
    threadId: result.thread_id,
  }
}

// Helper functions

function transformEmailConfig(
  config: NonNullable<
    Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>
  >,
): AgentEmailConfigResponse {
  return {
    id: config.id,
    agentId: config.agentId,
    provider: config.provider,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    isVerified: config.isVerified,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}

function transformMessage(
  message: NonNullable<Awaited<ReturnType<typeof agentMessageRepo.findById>>>,
): AgentMessageResponse {
  return {
    id: message.id,
    agentId: message.agentId,
    workflowId: message.workflowId,
    leadId: message.leadId,
    campaignId: message.campaignId,
    messageType: message.messageType,
    status: message.status,
    emailSubject: message.emailSubject,
    toEmail: message.toEmail,
    smsBody: message.smsBody,
    toPhone: message.toPhone,
    deliveredAt: message.deliveredAt?.toISOString() || null,
    openedAt: message.openedAt?.toISOString() || null,
    clickedAt: message.clickedAt?.toISOString() || null,
    failureReason: message.failureReason,
    createdAt: message.createdAt.toISOString(),
  }
}
