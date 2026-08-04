import { WebClient, LogLevel } from '@slack/web-api'
import type { Block, KnownBlock, View } from '@slack/web-api'
import { decrypt } from '@/lib/encryption'
import logger from '@/lib/logger'

export type SlackBlocks = (Block | KnownBlock)[]

export interface SlackMessageOptions {
  channel: string
  blocks: SlackBlocks
  text?: string
  unfurlLinks?: boolean
  unfurlMedia?: boolean
}

export interface SlackEphemeralOptions extends SlackMessageOptions {
  user: string
}

export interface SlackModalOptions {
  triggerId: string
  view: View
}

export interface SlackHomeViewOptions {
  userId: string
  view: View
}

/**
 * Slack Web API client wrapper
 * Handles encrypted token decryption and provides typed methods for common operations
 */
export class SlackClient {
  private client: WebClient

  constructor(encryptedToken: string) {
    const token = decrypt(encryptedToken)
    this.client = new WebClient(token, {
      logLevel: LogLevel.WARN,
    })
  }

  /**
   * Post a message to a channel
   */
  async postMessage(options: SlackMessageOptions) {
    try {
      const result = await this.client.chat.postMessage({
        channel: options.channel,
        blocks: options.blocks,
        text: options.text || 'OmniDial notification',
        unfurl_links: options.unfurlLinks ?? false,
        unfurl_media: options.unfurlMedia ?? false,
      })
      return {
        success: true,
        ts: result.ts,
        channel: result.channel,
      }
    } catch (error) {
      logger.error(
        { error, channel: options.channel },
        'Failed to post Slack message',
      )
      throw error
    }
  }

  /**
   * Post an ephemeral message (only visible to one user)
   */
  async postEphemeral(options: SlackEphemeralOptions) {
    try {
      const result = await this.client.chat.postEphemeral({
        channel: options.channel,
        user: options.user,
        blocks: options.blocks,
        text: options.text || 'OmniDial notification',
      })
      return {
        success: true,
        ts: result.message_ts,
      }
    } catch (error) {
      logger.error(
        { error, channel: options.channel, user: options.user },
        'Failed to post ephemeral message',
      )
      throw error
    }
  }

  /**
   * Open a modal dialog
   */
  async openModal(options: SlackModalOptions) {
    try {
      const result = await this.client.views.open({
        trigger_id: options.triggerId,
        view: options.view,
      })
      return {
        success: true,
        viewId: result.view?.id,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to open Slack modal')
      throw error
    }
  }

  /**
   * Update the App Home tab for a user
   */
  async updateAppHome(options: SlackHomeViewOptions) {
    try {
      const result = await this.client.views.publish({
        user_id: options.userId,
        view: options.view,
      })
      return {
        success: true,
        viewId: result.view?.id,
      }
    } catch (error) {
      logger.error(
        { error, userId: options.userId },
        'Failed to update App Home',
      )
      throw error
    }
  }

  /**
   * Get user information from Slack
   */
  async getUserInfo(userId: string) {
    try {
      const result = await this.client.users.info({ user: userId })
      return result.user
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get Slack user info')
      throw error
    }
  }

  /**
   * Get user info by email
   */
  async getUserByEmail(email: string) {
    try {
      const result = await this.client.users.lookupByEmail({ email })
      return result.user
    } catch (error) {
      logger.error({ error, email }, 'Failed to lookup Slack user by email')
      return null
    }
  }

  /**
   * List conversations the bot can access
   */
  async listConversations() {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
      })
      return result.channels || []
    } catch (error) {
      logger.error({ error }, 'Failed to list Slack conversations')
      throw error
    }
  }

  /**
   * Open a DM channel with a user
   */
  async openDmChannel(userId: string) {
    try {
      const result = await this.client.conversations.open({
        users: userId,
      })
      return result.channel?.id
    } catch (error) {
      logger.error({ error, userId }, 'Failed to open DM channel')
      throw error
    }
  }

  /**
   * Upload a file to Slack
   */
  async uploadFile(options: {
    channels: string
    filename: string
    content: string
    title?: string
  }) {
    try {
      const result = await this.client.files.uploadV2({
        channel_id: options.channels,
        filename: options.filename,
        content: options.content,
        title: options.title,
      })
      return {
        success: true,
        fileId: (result as { file?: { id?: string } }).file?.id,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to upload file to Slack')
      throw error
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channel: string, timestamp: string, emoji: string) {
    try {
      await this.client.reactions.add({
        channel,
        timestamp,
        name: emoji,
      })
      return { success: true }
    } catch (error) {
      logger.error(
        { error, channel, timestamp, emoji },
        'Failed to add reaction',
      )
      throw error
    }
  }

  /**
   * Get workspace info
   */
  async getTeamInfo() {
    try {
      const result = await this.client.team.info()
      return result.team
    } catch (error) {
      logger.error({ error }, 'Failed to get team info')
      throw error
    }
  }
}

/**
 * Create a static WebClient for OAuth operations (no token needed yet)
 */
export function createOAuthClient() {
  return new WebClient()
}

/**
 * Exchange an OAuth code for access tokens
 */
export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const client = createOAuthClient()

  const result = await client.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID!,
    client_secret: process.env.SLACK_CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri,
  })

  return {
    accessToken: result.access_token!,
    tokenType: result.token_type,
    scope: result.scope,
    botUserId: result.bot_user_id!,
    appId: result.app_id!,
    team: {
      id: result.team?.id!,
      name: result.team?.name!,
    },
    enterprise: result.enterprise
      ? {
          id: result.enterprise.id!,
          name: result.enterprise.name!,
        }
      : null,
    authedUser: {
      id: result.authed_user?.id!,
    },
  }
}
