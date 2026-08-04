/**
 * SMS Campaign Execution Service
 * Handles the actual execution of SMS campaigns:
 * - Send window calculation
 * - Message template rendering
 * - AI personalization
 * - Twilio SMS sending
 */

import * as smsCampaignRepo from '@/repositories/smsCampaign.repository'
import * as smsCampaignStepRepo from '@/repositories/smsCampaignStep.repository'
import * as smsCampaignEnrollmentRepo from '@/repositories/smsCampaignEnrollment.repository'
import * as smsCampaignMessageRepo from '@/repositories/smsCampaignMessage.repository'
import * as outreachService from './outreachGeneration.service'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { sendMessage } from '@/lib/telnyx'
import logger from '@/lib/logger'

// ============================================
// Types
// ============================================

interface SendWindowConfig {
  sendWindowStart: string // HH:MM
  sendWindowEnd: string // HH:MM
  sendDays: number[] // 0=Sunday, 1=Monday, etc.
  defaultTimezone: string
}

interface EnrollmentWithContext {
  id: string
  campaignId: string
  leadId: string
  status: string
  currentStep: number
  nextSendAt: Date | null
  timezone: string | null
  researchData: any
  organizationId: string
  sendWindowStart: string
  sendWindowEnd: string
  sendDays: number[]
  defaultTimezone: string
  aiEnabled: boolean
  aiModel: string | null
  aiSystemPrompt: string | null
  valueProposition: string | null
  dailySendLimit: number
  firstName: string | null
  lastName: string | null
  phone: string | null
  normalizedPhone: string | null
  company: string | null
  title: string | null
  leadTimezone: string | null
}

// ============================================
// Send Window Logic
// ============================================

/**
 * Check if the current time is within the send window for a given timezone
 */
export function isWithinSendWindow(
  timezone: string,
  config: SendWindowConfig,
): boolean {
  try {
    const now = new Date()

    // Get current time in lead's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const hour = parseInt(
      parts.find((p) => p.type === 'hour')?.value ?? '0',
      10,
    )
    const minute = parseInt(
      parts.find((p) => p.type === 'minute')?.value ?? '0',
      10,
    )
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'

    // Convert weekday string to number (0=Sunday)
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }
    const dayOfWeek = weekdayMap[weekdayStr] ?? 1

    // Check if today is a send day
    if (!config.sendDays.includes(dayOfWeek)) {
      return false
    }

    // Parse send window times
    const [startHour, startMin] = config.sendWindowStart.split(':').map(Number)
    const [endHour, endMin] = config.sendWindowEnd.split(':').map(Number)

    // Convert to minutes for easier comparison
    const currentMinutes = hour * 60 + minute
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } catch (error) {
    logger.error({ error, timezone }, 'Error checking send window')
    return false
  }
}

/**
 * Calculate the next send time within the send window
 */
export function calculateNextSendTime(
  timezone: string,
  config: SendWindowConfig,
  dayOffset: number = 0,
): Date {
  const now = new Date()

  try {
    // Get current time in lead's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })

    // Start from today + dayOffset
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + dayOffset)

    // Parse send window start time
    const [startHour, startMin] = config.sendWindowStart.split(':').map(Number)

    // Set to start of send window on target date
    // First, get the target date in the lead's timezone
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    // Find the next valid send day
    let daysToAdd = 0
    for (let i = 0; i < 14; i++) {
      // Check up to 2 weeks ahead
      const checkDate = new Date(targetDate)
      checkDate.setDate(checkDate.getDate() + i)

      // Get day of week in lead's timezone
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      })
      const weekdayStr = dayFormatter.format(checkDate)
      const weekdayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      }
      const dayOfWeek = weekdayMap[weekdayStr] ?? 1

      if (config.sendDays.includes(dayOfWeek)) {
        daysToAdd = i
        break
      }
    }

    // Calculate final send time
    const sendDate = new Date(targetDate)
    sendDate.setDate(sendDate.getDate() + daysToAdd)

    // Set to start of send window (in UTC, accounting for timezone)
    // This is a simplified approach - for production, use a proper timezone library
    sendDate.setUTCHours(startHour, startMin, 0, 0)

    // If the calculated time is in the past, move to next valid day
    if (sendDate <= now) {
      return calculateNextSendTime(timezone, config, dayOffset + 1)
    }

    return sendDate
  } catch (error) {
    logger.error({ error, timezone }, 'Error calculating next send time')
    // Fallback to simple calculation
    const fallback = new Date(now)
    fallback.setDate(fallback.getDate() + dayOffset + 1)
    fallback.setHours(9, 0, 0, 0)
    return fallback
  }
}

// ============================================
// Message Rendering
// ============================================

/**
 * Render a message template with lead data
 */
export function renderTemplate(
  template: string,
  lead: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    title?: string | null
  },
  researchData?: any,
): string {
  let message = template

  // Basic lead variables
  message = message.replace(/\{\{firstName\}\}/g, lead.firstName || '')
  message = message.replace(/\{\{lastName\}\}/g, lead.lastName || '')
  message = message.replace(/\{\{company\}\}/g, lead.company || '')
  message = message.replace(/\{\{title\}\}/g, lead.title || '')

  // Research data variables
  if (researchData) {
    message = message.replace(
      /\{\{research\.recentNews\}\}/g,
      researchData.recentNews || '',
    )
    message = message.replace(
      /\{\{research\.companyInfo\}\}/g,
      researchData.companyInfo || '',
    )
    message = message.replace(
      /\{\{research\.funding\}\}/g,
      researchData.funding || '',
    )
  }

  // Clean up any remaining template variables
  message = message.replace(/\{\{[^}]+\}\}/g, '')

  // Clean up extra whitespace
  message = message.replace(/\s+/g, ' ').trim()

  return message
}

/**
 * Apply AI personalization to a message
 */
export async function personalizeWithAI(
  baseMessage: string,
  lead: {
    firstName?: string | null
    company?: string | null
  },
  context: {
    aiSystemPrompt?: string | null
    valueProposition?: string | null
    maxChars?: number
  },
): Promise<string> {
  try {
    // Use the outreach generation service for AI personalization
    const personalizedMessage = await outreachService.generateSms(
      { firstName: lead.firstName, company: lead.company },
      {
        purpose: `Personalize this SMS for ${lead.firstName || 'the recipient'}: "${baseMessage}"`,
        callToAction: context.valueProposition || undefined,
      },
      { maxChars: context.maxChars || 160 },
    )

    return personalizedMessage
  } catch (error) {
    logger.error({ error }, 'AI personalization failed, using base message')
    return baseMessage
  }
}

// ============================================
// Telnyx Integration
// ============================================

/**
 * Get Telnyx credentials for the organization
 * (stored in the twilio_config table: accountSid = Telnyx account SID,
 * authTokenEncrypted = encrypted Telnyx API key)
 */
async function getTelnyxCredentials(organizationId: string) {
  const telnyxConfig = await db
    .selectFrom('twilio_config')
    .select(['accountSid', 'authTokenEncrypted', 'phoneNumbers'])
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  if (!telnyxConfig || telnyxConfig.phoneNumbers.length === 0) {
    throw new Error('No Telnyx credentials configured')
  }

  return {
    apiKey: decrypt(telnyxConfig.authTokenEncrypted),
    fromNumber: telnyxConfig.phoneNumbers[0],
  }
}

/**
 * Send an SMS via Telnyx
 */
async function sendViaTelnyx(
  apiKey: string,
  from: string,
  to: string,
  body: string,
): Promise<{ messageSid: string }> {
  const result = await sendMessage(apiKey, {
    from,
    to,
    text: body,
  })

  return { messageSid: result.id }
}

// ============================================
// Main Execution Functions
// ============================================

/**
 * Process a single enrollment - send the next message in the sequence
 */
export async function processEnrollment(
  enrollment: EnrollmentWithContext,
): Promise<{ success: boolean; reason?: string }> {
  const leadTimezone =
    enrollment.timezone || enrollment.leadTimezone || enrollment.defaultTimezone

  // Check send window
  if (
    !isWithinSendWindow(leadTimezone, {
      sendWindowStart: enrollment.sendWindowStart,
      sendWindowEnd: enrollment.sendWindowEnd,
      sendDays: enrollment.sendDays,
      defaultTimezone: enrollment.defaultTimezone,
    })
  ) {
    // Reschedule to next valid send time
    const nextSendAt = calculateNextSendTime(
      leadTimezone,
      {
        sendWindowStart: enrollment.sendWindowStart,
        sendWindowEnd: enrollment.sendWindowEnd,
        sendDays: enrollment.sendDays,
        defaultTimezone: enrollment.defaultTimezone,
      },
      0,
    )

    await smsCampaignEnrollmentRepo.update(enrollment.id, { nextSendAt })

    return { success: false, reason: 'Outside send window, rescheduled' }
  }

  // Check daily limit
  const todayCount = await smsCampaignMessageRepo.countTodayByCampaignId(
    enrollment.campaignId,
  )
  if (todayCount >= enrollment.dailySendLimit) {
    // Reschedule to tomorrow
    const nextSendAt = calculateNextSendTime(
      leadTimezone,
      {
        sendWindowStart: enrollment.sendWindowStart,
        sendWindowEnd: enrollment.sendWindowEnd,
        sendDays: enrollment.sendDays,
        defaultTimezone: enrollment.defaultTimezone,
      },
      1,
    )

    await smsCampaignEnrollmentRepo.update(enrollment.id, { nextSendAt })

    return { success: false, reason: 'Daily limit reached, rescheduled' }
  }

  // Get current step
  const step = await smsCampaignStepRepo.findByCampaignIdAndStepNumber(
    enrollment.campaignId,
    enrollment.currentStep,
  )

  if (!step) {
    // No more steps, mark as completed
    await smsCampaignEnrollmentRepo.markCompleted(enrollment.id)
    return { success: false, reason: 'No more steps, completed' }
  }

  // Get phone number
  const toPhone = enrollment.normalizedPhone || enrollment.phone
  if (!toPhone) {
    await smsCampaignEnrollmentRepo.markFailed(enrollment.id)
    return { success: false, reason: 'No phone number' }
  }

  // Render message
  let messageBody = renderTemplate(
    step.messageTemplate,
    {
      firstName: enrollment.firstName,
      lastName: enrollment.lastName,
      company: enrollment.company,
      title: enrollment.title,
    },
    enrollment.researchData,
  )

  // Apply AI personalization if enabled
  const shouldPersonalize = step.aiEnabled ?? enrollment.aiEnabled
  let aiPersonalized = false

  if (shouldPersonalize) {
    try {
      messageBody = await personalizeWithAI(
        messageBody,
        {
          firstName: enrollment.firstName,
          company: enrollment.company,
        },
        {
          aiSystemPrompt: step.aiPromptOverride || enrollment.aiSystemPrompt,
          valueProposition: enrollment.valueProposition,
          maxChars: 160,
        },
      )
      aiPersonalized = true
    } catch (error) {
      logger.error({ error }, 'AI personalization failed')
    }
  }

  // Create message record
  const message = await smsCampaignMessageRepo.create({
    campaignId: enrollment.campaignId,
    enrollmentId: enrollment.id,
    stepId: step.id,
    leadId: enrollment.leadId,
    toPhone,
    messageBody,
    originalTemplate: step.messageTemplate,
    aiPersonalized,
    scheduledAt: new Date(),
  })

  try {
    // Get Telnyx credentials
    const creds = await getTelnyxCredentials(enrollment.organizationId)

    // Mark as sending
    await smsCampaignMessageRepo.markSending(message.id)

    // Send via Telnyx
    const result = await sendViaTelnyx(
      creds.apiKey,
      creds.fromNumber,
      toPhone,
      messageBody,
    )

    // Mark as sent
    await smsCampaignMessageRepo.markSent(message.id, result.messageSid)

    // Update stats
    await smsCampaignRepo.incrementStat(enrollment.campaignId, 'totalSent')
    await smsCampaignStepRepo.incrementStat(step.id, 'totalSent')

    // Get all steps to determine if there's a next step
    const allSteps = await smsCampaignStepRepo.findByCampaignId(
      enrollment.campaignId,
    )
    const currentStepIndex = allSteps.findIndex(
      (s) => s.stepNumber === enrollment.currentStep,
    )
    const nextStep = allSteps[currentStepIndex + 1]

    if (nextStep) {
      // Calculate next send time based on next step's day offset
      const daysDiff = nextStep.dayOffset - step.dayOffset
      const nextSendAt = calculateNextSendTime(
        leadTimezone,
        {
          sendWindowStart: enrollment.sendWindowStart,
          sendWindowEnd: enrollment.sendWindowEnd,
          sendDays: enrollment.sendDays,
          defaultTimezone: enrollment.defaultTimezone,
        },
        daysDiff > 0 ? daysDiff : 1,
      )

      await smsCampaignEnrollmentRepo.advanceToNextStep(
        enrollment.id,
        nextStep.stepNumber,
        nextSendAt,
      )
    } else {
      // No more steps, mark as completed
      await smsCampaignEnrollmentRepo.markCompleted(enrollment.id)
    }

    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    await smsCampaignMessageRepo.markFailed(message.id, errorMessage)
    await smsCampaignStepRepo.incrementStat(step.id, 'totalFailed')

    logger.error(
      { error, enrollmentId: enrollment.id, messageId: message.id },
      'Failed to send SMS campaign message',
    )

    return { success: false, reason: errorMessage }
  }
}

/**
 * Process all ready enrollments
 */
export async function processReadyEnrollments(limit: number = 100): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  const enrollments = await smsCampaignEnrollmentRepo.findReadyToSend(limit)

  const result = {
    processed: 0,
    successful: 0,
    failed: 0,
  }

  for (const enrollment of enrollments) {
    result.processed++

    const processResult = await processEnrollment(
      enrollment as EnrollmentWithContext,
    )

    if (processResult.success) {
      result.successful++
    } else {
      result.failed++
    }
  }

  return result
}

/**
 * Handle an inbound reply - mark enrollment as replied
 */
export async function handleInboundReply(
  fromPhone: string,
  organizationId: string,
): Promise<void> {
  // Find active enrollment for this phone
  const enrollment = await smsCampaignEnrollmentRepo.findActiveByPhone(
    fromPhone,
    organizationId,
  )

  if (enrollment) {
    await smsCampaignEnrollmentRepo.markReplied(enrollment.id)
    await smsCampaignRepo.incrementStat(enrollment.campaignId, 'totalReplied')

    logger.info(
      { enrollmentId: enrollment.id, campaignId: enrollment.campaignId },
      'Marked enrollment as replied',
    )
  }
}

/**
 * Handle an unsubscribe request (e.g., STOP message)
 */
export async function handleUnsubscribe(
  fromPhone: string,
  organizationId: string,
): Promise<void> {
  // Find active enrollment for this phone
  const enrollment = await smsCampaignEnrollmentRepo.findActiveByPhone(
    fromPhone,
    organizationId,
  )

  if (enrollment) {
    await smsCampaignEnrollmentRepo.markUnsubscribed(enrollment.id)
    await smsCampaignRepo.incrementStat(
      enrollment.campaignId,
      'totalUnsubscribed',
    )

    logger.info(
      { enrollmentId: enrollment.id, campaignId: enrollment.campaignId },
      'Marked enrollment as unsubscribed',
    )
  }
}

/**
 * Handle Twilio delivery status webhook
 */
export async function handleDeliveryStatus(
  messageSid: string,
  status: string,
  errorCode?: string,
): Promise<void> {
  const message =
    await smsCampaignMessageRepo.findByTwilioMessageSid(messageSid)

  if (!message) {
    logger.warn({ messageSid }, 'Message not found for delivery status')
    return
  }

  switch (status) {
    case 'delivered':
      await smsCampaignMessageRepo.markDelivered(message.id)
      await smsCampaignRepo.incrementStat(message.campaignId, 'totalDelivered')

      // Also update step stats
      await smsCampaignStepRepo.incrementStat(message.stepId, 'totalDelivered')
      break

    case 'undelivered':
    case 'failed':
      await smsCampaignMessageRepo.markUndelivered(
        message.id,
        errorCode || status,
      )
      break

    default:
      logger.debug({ messageSid, status }, 'Ignoring delivery status')
  }
}
