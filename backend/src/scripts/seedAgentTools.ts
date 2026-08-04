/**
 * Seed Script: Agent Tools
 *
 * Seeds the system tools available to agents for the orchestration framework.
 * These are global tools that can be used by any agent in the system.
 *
 * Run with: pnpm --filter backend run seed:agent-tools
 */

import * as agentToolRepo from '@/repositories/agentTool.repository'
import type {
  CreateAgentToolInput,
  ToolCategory,
} from '@/repositories/agentTool.repository'
import logger from '@/lib/logger'

interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  handler: string
  parameters: Record<string, unknown>
  requiresApproval: boolean
}

const SYSTEM_TOOLS: ToolDefinition[] = [
  // ============================================
  // Email Tools
  // ============================================
  {
    name: 'compose_email',
    description: 'Compose a personalized email for a lead',
    category: 'email',
    handler: 'agentTools.draftEmail',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead to email' },
        template: {
          type: 'string',
          description: 'Optional email template to use',
        },
        personalization: {
          type: 'object',
          description: 'Additional personalization context',
        },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },
  {
    name: 'send_email',
    description: 'Send an email to a lead (requires approval)',
    category: 'email',
    handler: 'agentTools.queueEmail',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (HTML)' },
      },
      required: ['leadId', 'subject', 'body'],
    },
    requiresApproval: true,
  },
  {
    name: 'get_email_templates',
    description: 'Get available email templates for the organization',
    category: 'email',
    handler: 'agentTools.getEmailTemplates',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by template category',
        },
      },
    },
    requiresApproval: false,
  },

  // ============================================
  // SMS Tools
  // ============================================
  {
    name: 'compose_sms',
    description: 'Compose an SMS message for a lead',
    category: 'sms',
    handler: 'agentTools.draftSms',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        purpose: { type: 'string', description: 'Purpose of the SMS' },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },
  {
    name: 'send_sms',
    description: 'Send an SMS to a lead (requires approval)',
    category: 'sms',
    handler: 'agentTools.queueSms',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        message: {
          type: 'string',
          description: 'SMS message content (max 160 chars)',
        },
      },
      required: ['leadId', 'message'],
    },
    requiresApproval: true,
  },

  // ============================================
  // Research Tools
  // ============================================
  {
    name: 'research_company',
    description: 'Research a company using web search',
    category: 'research',
    handler: 'agentTools.researchCompany',
    parameters: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Name of the company' },
        domain: { type: 'string', description: 'Company website domain' },
      },
      required: ['companyName'],
    },
    requiresApproval: false,
  },
  {
    name: 'research_person',
    description: 'Research a person/contact using web search',
    category: 'research',
    handler: 'agentTools.researchPerson',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the person' },
        company: { type: 'string', description: 'Company they work at' },
      },
      required: ['name'],
    },
    requiresApproval: false,
  },
  {
    name: 'enrich_lead',
    description: 'Enrich a lead with additional data',
    category: 'research',
    handler: 'agentTools.enrichLead',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead to enrich' },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Data sources to use for enrichment',
        },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },

  // ============================================
  // CRM Tools
  // ============================================
  {
    name: 'get_lead_data',
    description: 'Get detailed information about a lead',
    category: 'crm',
    handler: 'agentTools.getLeadDetails',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },
  {
    name: 'update_lead_data',
    description: 'Update lead information',
    category: 'crm',
    handler: 'agentTools.updateLead',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        updates: {
          type: 'object',
          description: 'Fields to update',
        },
      },
      required: ['leadId', 'updates'],
    },
    requiresApproval: false,
  },
  {
    name: 'search_leads',
    description: 'Search for leads matching criteria',
    category: 'crm',
    handler: 'agentTools.searchLeads',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        filters: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            title: { type: 'string' },
          },
        },
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
    requiresApproval: false,
  },
  {
    name: 'get_conversation_history',
    description: 'Get message history with a lead',
    category: 'crm',
    handler: 'agentTools.getConversationHistory',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        type: {
          type: 'string',
          enum: ['email', 'sms'],
          description: 'Filter by message type',
        },
        limit: { type: 'number', description: 'Max messages to return' },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },
  {
    name: 'add_note',
    description: 'Add a note to a lead',
    category: 'crm',
    handler: 'agentTools.addNote',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        content: { type: 'string', description: 'Note content' },
      },
      required: ['leadId', 'content'],
    },
    requiresApproval: false,
  },
  {
    name: 'schedule_followup',
    description: 'Schedule a follow-up task for a lead',
    category: 'crm',
    handler: 'agentTools.scheduleFollowup',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        title: { type: 'string', description: 'Task title' },
        scheduledAt: {
          type: 'string',
          description: 'ISO datetime for the task',
        },
      },
      required: ['leadId', 'title', 'scheduledAt'],
    },
    requiresApproval: false,
  },
  {
    name: 'get_campaign_data',
    description: 'Get campaign details',
    category: 'crm',
    handler: 'agentTools.getCampaignData',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'ID of the campaign' },
      },
      required: ['campaignId'],
    },
    requiresApproval: false,
  },
  {
    name: 'get_campaign_leads',
    description: 'Get leads in a campaign',
    category: 'crm',
    handler: 'agentTools.getCampaignLeads',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'ID of the campaign' },
        status: {
          type: 'string',
          description: 'Filter by lead status in campaign',
        },
        limit: { type: 'number', description: 'Max leads to return' },
      },
      required: ['campaignId'],
    },
    requiresApproval: false,
  },

  // ============================================
  // Qualification Tools
  // ============================================
  {
    name: 'score_lead',
    description: 'Calculate qualification score for a lead',
    category: 'crm',
    handler: 'agentTools.scoreLead',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead to score' },
        criteria: { type: 'object', description: 'Scoring criteria' },
      },
      required: ['leadId'],
    },
    requiresApproval: false,
  },
  {
    name: 'save_qualification',
    description: 'Save a lead qualification result',
    category: 'crm',
    handler: 'agentTools.qualifyLead',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        category: {
          type: 'string',
          enum: ['high_intent', 'medium', 'low_intent', 'disqualified'],
        },
        score: { type: 'number', description: 'Score 0-100' },
        reasoning: {
          type: 'string',
          description: 'Explanation for the qualification',
        },
      },
      required: ['leadId', 'category', 'score', 'reasoning'],
    },
    requiresApproval: false,
  },

  // ============================================
  // Analytics Tools
  // ============================================
  {
    name: 'get_agent_stats',
    description: 'Get statistics for agent execution',
    category: 'analytics',
    handler: 'agentTools.getAgentStats',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the agent' },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO)' },
            end: { type: 'string', description: 'End date (ISO)' },
          },
        },
      },
    },
    requiresApproval: false,
  },

  // ============================================
  // Campaign Tools
  // ============================================
  {
    name: 'create_campaign',
    description: 'Create a new campaign (requires approval)',
    category: 'campaign',
    handler: 'agentTools.createCampaign',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        description: { type: 'string', description: 'Campaign description' },
        type: {
          type: 'string',
          enum: ['email', 'sms', 'multi_channel'],
        },
      },
      required: ['name', 'type'],
    },
    requiresApproval: true,
  },
  {
    name: 'add_leads_to_campaign',
    description: 'Add leads to a campaign',
    category: 'campaign',
    handler: 'agentTools.addLeadsToCampaign',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'ID of the campaign' },
        leadIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of lead IDs to add',
        },
      },
      required: ['campaignId', 'leadIds'],
    },
    requiresApproval: false,
  },

  // ============================================
  // Orchestrator Tools
  // ============================================
  {
    name: 'call_agent',
    description: 'Call a specialized agent to perform a task',
    category: 'orchestrator',
    handler: 'agentOrchestration.callSpecializedAgent',
    parameters: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          enum: [
            'email',
            'sms',
            'research',
            'qualify',
            'analytics',
            'campaign',
          ],
          description: 'Type of agent to call',
        },
        prompt: {
          type: 'string',
          description: 'Task for the agent to perform',
        },
        context: {
          type: 'object',
          description: 'Additional context for the agent',
        },
        leadId: { type: 'string', description: 'Optional lead ID' },
        campaignId: { type: 'string', description: 'Optional campaign ID' },
      },
      required: ['agentType', 'prompt'],
    },
    requiresApproval: false,
  },
  {
    name: 'request_approval',
    description: 'Request human approval for an action',
    category: 'orchestrator',
    handler: 'agentOrchestration.requestApproval',
    parameters: {
      type: 'object',
      properties: {
        approvalType: {
          type: 'string',
          enum: [
            'send_email',
            'send_sms',
            'create_campaign',
            'bulk_action',
            'modify_lead',
          ],
        },
        summary: {
          type: 'string',
          description: 'Summary of the action needing approval',
        },
        details: {
          type: 'object',
          description: 'Detailed information about the action',
        },
        leadId: { type: 'string', description: 'Optional lead ID' },
        campaignId: { type: 'string', description: 'Optional campaign ID' },
      },
      required: ['approvalType', 'summary', 'details'],
    },
    requiresApproval: false,
  },
  {
    name: 'log_activity',
    description: 'Log an activity to the audit trail',
    category: 'orchestrator',
    handler: 'agentTools.logActivity',
    parameters: {
      type: 'object',
      properties: {
        activityType: { type: 'string', description: 'Type of activity' },
        description: { type: 'string', description: 'Activity description' },
        leadId: { type: 'string', description: 'Optional lead ID' },
        campaignId: { type: 'string', description: 'Optional campaign ID' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['activityType', 'description'],
    },
    requiresApproval: false,
  },
]

async function seedSystemTools() {
  logger.info('Seeding system tools...')

  for (const toolDef of SYSTEM_TOOLS) {
    try {
      const input: CreateAgentToolInput = {
        organizationId: null, // System tools have null org
        name: toolDef.name,
        description: toolDef.description,
        category: toolDef.category,
        parameters: toolDef.parameters,
        handler: toolDef.handler,
        requiresApproval: toolDef.requiresApproval,
        isSystem: true,
      }

      await agentToolRepo.upsertSystemTool(input)
      logger.info({ name: toolDef.name }, 'Upserted system tool')
    } catch (error) {
      logger.error({ name: toolDef.name, error }, 'Failed to seed tool')
    }
  }

  logger.info(`Seeded ${SYSTEM_TOOLS.length} system tools`)
}

// Export for programmatic use
export { seedSystemTools, SYSTEM_TOOLS }

// CLI entry point
if (require.main === module) {
  seedSystemTools()
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Failed to seed system tools:', error)
      process.exit(1)
    })
}
