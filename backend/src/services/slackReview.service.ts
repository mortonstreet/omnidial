/**
 * Slack Review Service
 * Human-in-loop approval workflows for lead qualifications
 *
 * Features:
 * - Send qualification review requests to Slack
 * - Interactive approve/reject/edit buttons
 * - Thread replies for review context
 */

import { db } from '@/lib/db'
import { SlackClient, type SlackBlocks } from '@/clients/slack.client'
import * as workspaceRepo from '@/repositories/slackWorkspace.repository'
import * as leadQualificationService from '@/services/leadQualification.service'
import logger from '@/lib/logger'
import { config } from '@/config'

// Types

interface QualificationReview {
  qualificationId: string
  leadId: string
  leadName: string
  leadCompany: string | null
  leadEmail: string | null
  category: string
  score: number
  reasoning: string
  generatedEmail: {
    subject: string
    body: string
  } | null
  generatedSms: string | null
  organizationId: string
}

interface ReviewActionPayload {
  qualificationId: string
  action: 'approve' | 'reject' | 'edit'
}

// ============================================
// Send Review Request
// ============================================

/**
 * Send a qualification for human review in Slack
 */
export async function sendForReview(
  organizationId: string,
  qualificationId: string,
): Promise<{ success: boolean; messageTs?: string; channelId?: string }> {
  // Get the workspace for this organization
  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    logger.warn(
      { organizationId },
      'No Slack workspace found for organization - skipping review',
    )
    return { success: false }
  }

  // Get the review channel (default channel or specific review channel)
  const channelId = workspace.reviewChannelId || workspace.defaultChannelId
  if (!channelId) {
    logger.warn(
      { workspaceId: workspace.id },
      'No review channel configured - skipping review',
    )
    return { success: false }
  }

  // Get qualification details
  const qualification = await getQualificationDetails(qualificationId)
  if (!qualification) {
    logger.error(
      { qualificationId },
      'Qualification not found for Slack review',
    )
    return { success: false }
  }

  // Build and send the message
  const client = new SlackClient(workspace.botToken)
  const blocks = buildReviewBlocks(qualification)

  try {
    const result = await client.postMessage({
      channel: channelId,
      blocks,
      text: `New lead qualification for review: ${qualification.leadName}`,
    })

    // Store the message reference for updates
    await db
      .updateTable('lead_qualification')
      .set({
        slackMessageTs: result.ts,
        slackChannelId: result.channel,
        updatedAt: new Date(),
      })
      .where('id', '=', qualificationId)
      .execute()

    logger.info(
      { qualificationId, messageTs: result.ts },
      'Sent qualification for Slack review',
    )

    return {
      success: true,
      messageTs: result.ts,
      channelId: result.channel,
    }
  } catch (error) {
    logger.error(
      { error, qualificationId },
      'Failed to send Slack review message',
    )
    return { success: false }
  }
}

/**
 * Handle review action from Slack button click
 */
export async function handleReviewAction(
  workspaceId: string,
  slackUserId: string,
  payload: ReviewActionPayload,
  triggerId: string,
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace?.organizationId) {
    logger.warn({ workspaceId }, 'Workspace not linked to organization')
    return
  }

  const client = new SlackClient(workspace.botToken)

  // Get the reviewer's OmniDial user
  const userLink = await db
    .selectFrom('slack_user_link')
    .where('workspaceId', '=', workspaceId)
    .where('slackUserId', '=', slackUserId)
    .select(['userId'])
    .executeTakeFirst()

  if (!userLink) {
    // User not linked - show modal
    await client.openModal({
      triggerId,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Account Not Linked' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Link your Slack account to OmniDial to review qualifications.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Link Account' },
                url: `${config.frontendUrl}/dashboard/settings/integrations`,
                style: 'primary',
              },
            ],
          },
        ],
      },
    })
    return
  }

  if (payload.action === 'edit') {
    // Open edit modal
    const qualification = await getQualificationDetails(payload.qualificationId)
    if (!qualification) return

    await client.openModal({
      triggerId,
      view: buildEditModal(qualification),
    })
    return
  }

  // Handle approve/reject
  try {
    await leadQualificationService.reviewQualification(
      payload.qualificationId,
      userLink.userId,
      payload.action,
      {},
    )

    // Update the Slack message to show result
    await updateReviewMessage(
      workspace.id,
      payload.qualificationId,
      payload.action,
      slackUserId,
    )

    logger.info(
      { qualificationId: payload.qualificationId, action: payload.action },
      'Processed Slack review action',
    )
  } catch (error) {
    logger.error({ error }, 'Failed to process Slack review action')
  }
}

/**
 * Handle edit submission from Slack modal
 */
export async function handleEditSubmission(
  workspaceId: string,
  slackUserId: string,
  qualificationId: string,
  editedEmail: { subject: string; body: string } | undefined,
  editedSms: string | undefined,
  reviewNotes: string | undefined,
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace?.organizationId) return

  const userLink = await db
    .selectFrom('slack_user_link')
    .where('workspaceId', '=', workspaceId)
    .where('slackUserId', '=', slackUserId)
    .select(['userId'])
    .executeTakeFirst()

  if (!userLink) return

  try {
    await leadQualificationService.reviewQualification(
      qualificationId,
      userLink.userId,
      'edit',
      { editedEmail, editedSms, reviewNotes },
    )

    await updateReviewMessage(
      workspace.id,
      qualificationId,
      'edit',
      slackUserId,
    )

    logger.info({ qualificationId }, 'Processed Slack review edit')
  } catch (error) {
    logger.error({ error }, 'Failed to process Slack review edit')
  }
}

// ============================================
// Block Kit Builders
// ============================================

/**
 * Build the review message blocks
 */
function buildReviewBlocks(qualification: QualificationReview): SlackBlocks {
  const categoryEmoji =
    {
      high_intent: ':fire:',
      medium: ':yellow_circle:',
      low_intent: ':white_circle:',
      disqualified: ':x:',
    }[qualification.category] || ':question:'

  const scoreBar = buildScoreBar(qualification.score)

  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Lead Qualification Review`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Lead:*\n${qualification.leadName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Company:*\n${qualification.leadCompany || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Category:*\n${categoryEmoji} ${formatCategory(qualification.category)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score:*\n${scoreBar} ${qualification.score}/100`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*AI Reasoning:*\n${truncate(qualification.reasoning, 500)}`,
      },
    },
  ]

  // Add generated email preview
  if (qualification.generatedEmail) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Generated Email:*\n>*Subject:* ${qualification.generatedEmail.subject}\n>\n>${truncate(qualification.generatedEmail.body, 300).replace(/\n/g, '\n>')}`,
        },
      },
    )
  }

  // Add generated SMS preview
  if (qualification.generatedSms) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Generated SMS:*\n>${qualification.generatedSms}`,
      },
    })
  }

  // Action buttons
  blocks.push(
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: 'qualification_approve',
          value: JSON.stringify({
            qualificationId: qualification.qualificationId,
            action: 'approve',
          }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          style: 'danger',
          action_id: 'qualification_reject',
          value: JSON.stringify({
            qualificationId: qualification.qualificationId,
            action: 'reject',
          }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit & Approve', emoji: true },
          action_id: 'qualification_edit',
          value: JSON.stringify({
            qualificationId: qualification.qualificationId,
            action: 'edit',
          }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in OmniDial', emoji: true },
          url: `${config.frontendUrl}/dashboard/agents/qualifications/${qualification.qualificationId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `ID: ${qualification.qualificationId.slice(0, 8)}... | ${qualification.leadEmail || 'No email'}`,
        },
      ],
    },
  )

  return blocks
}

/**
 * Build the edit modal
 */
function buildEditModal(qualification: QualificationReview) {
  const blocks: SlackBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Editing outreach for:* ${qualification.leadName}${qualification.leadCompany ? ` at ${qualification.leadCompany}` : ''}`,
      },
    },
    { type: 'divider' },
  ]

  if (qualification.generatedEmail) {
    blocks.push(
      {
        type: 'input',
        block_id: 'email_subject',
        label: { type: 'plain_text', text: 'Email Subject' },
        element: {
          type: 'plain_text_input',
          action_id: 'email_subject_input',
          initial_value: qualification.generatedEmail.subject,
        },
      },
      {
        type: 'input',
        block_id: 'email_body',
        label: { type: 'plain_text', text: 'Email Body' },
        element: {
          type: 'plain_text_input',
          action_id: 'email_body_input',
          multiline: true,
          initial_value: qualification.generatedEmail.body,
        },
      },
    )
  }

  if (qualification.generatedSms) {
    blocks.push({
      type: 'input',
      block_id: 'sms_body',
      label: { type: 'plain_text', text: 'SMS Message' },
      element: {
        type: 'plain_text_input',
        action_id: 'sms_body_input',
        initial_value: qualification.generatedSms,
        max_length: 320,
      },
    })
  }

  blocks.push({
    type: 'input',
    block_id: 'review_notes',
    label: { type: 'plain_text', text: 'Review Notes (optional)' },
    optional: true,
    element: {
      type: 'plain_text_input',
      action_id: 'review_notes_input',
      multiline: true,
      placeholder: {
        type: 'plain_text',
        text: 'Add any notes about your changes...',
      },
    },
  })

  return {
    type: 'modal' as const,
    callback_id: 'qualification_edit_modal',
    title: { type: 'plain_text' as const, text: 'Edit Outreach' },
    submit: { type: 'plain_text' as const, text: 'Approve with Edits' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    private_metadata: JSON.stringify({
      qualificationId: qualification.qualificationId,
    }),
    blocks,
  }
}

/**
 * Update the review message after action
 */
async function updateReviewMessage(
  workspaceId: string,
  qualificationId: string,
  action: 'approve' | 'reject' | 'edit',
  reviewerSlackId: string,
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) return

  const qualification = await db
    .selectFrom('lead_qualification')
    .where('id', '=', qualificationId)
    .select(['slackMessageTs', 'slackChannelId'])
    .executeTakeFirst()

  if (!qualification?.slackMessageTs || !qualification?.slackChannelId) return

  const statusEmoji =
    {
      approve: ':white_check_mark:',
      reject: ':x:',
      edit: ':pencil:',
    }[action] || ':question:'

  const statusText =
    {
      approve: 'Approved',
      reject: 'Rejected',
      edit: 'Edited & Approved',
    }[action] || 'Unknown'

  // Add a thread reply showing the review result
  const client = new SlackClient(workspace.botToken)
  await client.postMessage({
    channel: qualification.slackChannelId,
    blocks: [
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${statusEmoji} *${statusText}* by <@${reviewerSlackId}>`,
          },
        ],
      },
    ],
    text: `${statusText} by reviewer`,
  })
}

// ============================================
// Helpers
// ============================================

async function getQualificationDetails(
  qualificationId: string,
): Promise<QualificationReview | null> {
  const result = await db
    .selectFrom('lead_qualification')
    .innerJoin('lead', 'lead.id', 'lead_qualification.leadId')
    .where('lead_qualification.id', '=', qualificationId)
    .select([
      'lead_qualification.id as qualificationId',
      'lead_qualification.leadId',
      'lead_qualification.organizationId',
      'lead_qualification.category',
      'lead_qualification.score',
      'lead_qualification.reasoning',
      'lead_qualification.generatedEmail',
      'lead_qualification.generatedSms',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.email',
    ])
    .executeTakeFirst()

  if (!result) return null

  return {
    qualificationId: result.qualificationId,
    leadId: result.leadId,
    leadName:
      [result.firstName, result.lastName].filter(Boolean).join(' ') ||
      'Unknown',
    leadCompany: result.company,
    leadEmail: result.email,
    category: result.category,
    score: result.score,
    reasoning: result.reasoning,
    generatedEmail: result.generatedEmail as {
      subject: string
      body: string
    } | null,
    generatedSms: result.generatedSms,
    organizationId: result.organizationId,
  }
}

function buildScoreBar(score: number): string {
  const filled = Math.round(score / 10)
  const empty = 10 - filled
  return (
    ':large_green_square:'.repeat(filled) + ':white_large_square:'.repeat(empty)
  )
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
