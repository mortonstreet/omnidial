import * as telnyxClient from '@/clients/telnyx.client'
import * as callRepository from '@/repositories/call.repository'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'
import * as workspaceRepo from '@/repositories/slackWorkspace.repository'
import * as messageLogRepo from '@/repositories/slackMessageLog.repository'
import { SlackClient } from '@/clients/slack.client'
import { config } from '@/config'
import logger from '@/lib/logger'
import { db } from '@/lib/db'

// In-memory store for tracking Slack-initiated calls
// In production, this would be Redis or a database table
const slackCallMetadata = new Map<
  string,
  { slackWorkspaceId: string; slackUserId: string }
>()

export interface InitiateCallParams {
  organizationId: string
  userId: string
  leadId: string
  leadPhone: string
  repPhone: string
  fromNumber: string
  slackWorkspaceId: string
  slackUserId: string
}

/**
 * Initiate a click-to-call from Slack
 *
 * Flow:
 * 1. Create call record
 * 2. Store Slack metadata separately (for status updates)
 * 3. Call the rep's phone first
 * 4. When rep answers, play a connecting message
 * 5. Bridge to lead by dialing them into a conference
 * 6. Post status updates back to Slack
 */
export async function initiateCallFromSlack(
  params: InitiateCallParams,
): Promise<{ callId: string }> {
  const {
    organizationId,
    userId,
    leadId,
    leadPhone,
    repPhone,
    fromNumber,
    slackWorkspaceId,
    slackUserId,
  } = params

  // Get Telnyx config
  const twilioConfig =
    await twilioConfigRepository.findByOrganizationId(organizationId)
  if (!twilioConfig) {
    throw new Error('No Telnyx configuration found for organization')
  }

  // Create call record
  const callRecord = await callRepository.create({
    twilioConfigId: twilioConfig.id,
    userId,
    leadId,
    fromNumber,
    toNumber: leadPhone,
    direction: 'outbound',
    status: 'initiated',
  })

  // Store Slack metadata for status updates
  slackCallMetadata.set(callRecord.id, { slackWorkspaceId, slackUserId })

  try {
    // Get Telnyx client
    const client = await telnyxClient.getClientForOrganization(organizationId)

    // Conference ID for this call
    const conferenceId = `slack-call-${callRecord.id}`

    // First, call the rep's phone
    // When answered, TeXML will put them in a conference and dial the lead
    await client.createCall({
      to: repPhone,
      from: fromNumber,
      url: `${config.backendUrl}/api/webhooks/telnyx/slack-call-rep-answered?callId=${callRecord.id}&leadPhone=${encodeURIComponent(leadPhone)}&fromNumber=${encodeURIComponent(fromNumber)}&conferenceId=${encodeURIComponent(conferenceId)}`,
      statusCallback: `${config.backendUrl}/api/webhooks/telnyx/slack-call-status?callId=${callRecord.id}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    })

    // Update call record with ringing status
    await callRepository.update(callRecord.id, {
      status: 'ringing',
    })

    // Post initial message to Slack
    await postCallStatusToSlack(slackWorkspaceId, slackUserId, {
      status: 'calling',
      message: `Calling your phone (${repPhone})...`,
      callId: callRecord.id,
    })

    logger.info(
      {
        callId: callRecord.id,
        repPhone,
        leadPhone,
        conferenceId,
      },
      'Initiated Slack click-to-call',
    )

    return { callId: callRecord.id }
  } catch (error) {
    // Update call record with failure
    await callRepository.update(callRecord.id, {
      status: 'failed',
      endedAt: new Date(),
    })

    logger.error(
      { error, callId: callRecord.id },
      'Failed to initiate Slack click-to-call',
    )
    throw error
  }
}

/**
 * Handle rep answering the call - bridges to lead
 * Called by Telnyx webhook
 */
export async function handleRepAnswered(params: {
  callId: string
  leadPhone: string
  fromNumber: string
  conferenceId: string
}): Promise<string> {
  const { callId, leadPhone, fromNumber, conferenceId } = params

  // Get call record
  const call = await callRepository.findById(callId)
  if (!call) {
    throw new Error(`Call record not found: ${callId}`)
  }

  // Get telnyx config for organization
  const twilioConfig = await twilioConfigRepository.findById(
    call.twilioConfigId,
  )
  if (!twilioConfig) {
    throw new Error(`Telnyx config not found for call: ${callId}`)
  }

  // Update call status
  await callRepository.update(callId, {
    status: 'in-progress',
    answeredAt: new Date(),
  })

  // Post update to Slack
  const slackMeta = slackCallMetadata.get(callId)
  if (slackMeta) {
    await postCallStatusToSlack(
      slackMeta.slackWorkspaceId,
      slackMeta.slackUserId,
      {
        status: 'connecting',
        message: `Connected! Dialing lead at ${leadPhone}...`,
        callId,
      },
    )
  }

  // Dial lead into the conference asynchronously
  setImmediate(async () => {
    try {
      const client = await telnyxClient.getClientForOrganization(
        twilioConfig.organizationId,
      )

      await client.createCall({
        to: leadPhone,
        from: fromNumber,
        url: `${config.backendUrl}/api/webhooks/telnyx/slack-call-bridge?callId=${callId}&conferenceId=${encodeURIComponent(conferenceId)}`,
        statusCallback: `${config.backendUrl}/api/webhooks/telnyx/slack-call-lead-status?callId=${callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      })

      logger.info(
        { callId, leadPhone, conferenceId },
        'Dialing lead for Slack click-to-call',
      )
    } catch (error) {
      logger.error(
        { error, callId },
        'Failed to dial lead for Slack click-to-call',
      )

      // Update Slack
      const slackMeta = slackCallMetadata.get(callId)
      if (slackMeta) {
        await postCallStatusToSlack(
          slackMeta.slackWorkspaceId,
          slackMeta.slackUserId,
          {
            status: 'failed',
            message: `Failed to connect to lead: ${(error as Error).message}`,
            callId,
          },
        )
      }
    }
  })

  // Return TeXML to put rep in conference
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you now. Please wait.</Say>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" record="record-from-start" recordingStatusCallback="${config.backendUrl}/api/webhooks/telnyx/recording?callId=${callId}">${conferenceId}</Conference>
  </Dial>
</Response>`
}

/**
 * Handle call status updates from Telnyx
 * Updates Slack with call progress
 */
export async function handleCallStatusUpdate(params: {
  callId: string
  callStatus: string
  callDuration?: number
}): Promise<void> {
  const { callId, callStatus, callDuration } = params

  const slackMeta = slackCallMetadata.get(callId)
  if (!slackMeta) {
    return // Not a Slack-initiated call
  }

  // Map call status to user-friendly message
  let slackStatus: string
  let message: string

  switch (callStatus) {
    case 'ringing':
      slackStatus = 'ringing'
      message = 'Your phone is ringing...'
      break
    case 'in-progress':
      slackStatus = 'connected'
      message = 'Call connected!'
      break
    case 'completed':
      slackStatus = 'completed'
      message = callDuration
        ? `Call completed (${formatDuration(callDuration)})`
        : 'Call completed'

      // Update call record
      await callRepository.update(callId, {
        status: 'completed',
        endedAt: new Date(),
        duration: callDuration,
      })
      break
    case 'busy':
    case 'no-answer':
    case 'failed':
    case 'canceled':
      slackStatus = 'failed'
      message = `Call ${callStatus.replace('-', ' ')}`

      await callRepository.update(callId, {
        status: 'failed',
        endedAt: new Date(),
      })

      // Clean up metadata on call end
      slackCallMetadata.delete(callId)
      break
    default:
      return // Don't update for other statuses
  }

  await postCallStatusToSlack(
    slackMeta.slackWorkspaceId,
    slackMeta.slackUserId,
    {
      status: slackStatus,
      message,
      callId,
      duration: callDuration,
    },
  )

  // Clean up metadata when call completes
  if (callStatus === 'completed') {
    slackCallMetadata.delete(callId)
  }
}

/**
 * Get Slack metadata for a call
 */
export function getSlackMetadata(
  callId: string,
): { slackWorkspaceId: string; slackUserId: string } | undefined {
  return slackCallMetadata.get(callId)
}

/**
 * Post call status update to Slack
 */
async function postCallStatusToSlack(
  workspaceId: string,
  slackUserId: string,
  data: {
    status: string
    message: string
    callId: string
    duration?: number
  },
): Promise<void> {
  try {
    const workspace = await workspaceRepo.findById(workspaceId)
    if (!workspace) return

    const client = new SlackClient(workspace.botToken)

    const statusEmoji: Record<string, string> = {
      calling: ':phone:',
      ringing: ':bell:',
      connecting: ':hourglass_flowing_sand:',
      connected: ':white_check_mark:',
      completed: ':heavy_check_mark:',
      failed: ':x:',
    }

    const emoji = statusEmoji[data.status] || ':phone:'

    // Send ephemeral message to user (only they can see it)
    await client.postEphemeral({
      channel: slackUserId, // DM channel
      user: slackUserId,
      text: `${emoji} ${data.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} ${data.message}`,
          },
        },
        ...(data.status === 'completed'
          ? [
              {
                type: 'actions' as const,
                elements: [
                  {
                    type: 'button' as const,
                    text: {
                      type: 'plain_text' as const,
                      text: 'View Call Details',
                      emoji: true,
                    },
                    url: `${config.frontendUrl}/dashboard/calls/${data.callId}`,
                  },
                ],
              },
            ]
          : []),
      ],
    })

    // Log the message
    await messageLogRepo.create({
      workspaceId,
      channelId: slackUserId,
      eventType: 'click_to_call',
      payload: data,
      success: true,
    })
  } catch (error) {
    logger.error(
      { error, workspaceId, slackUserId },
      'Failed to post call status to Slack',
    )
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}
