/**
 * OpenClaw Client
 * Self-hosted agent runtime with persistent memory and tool execution
 *
 * OpenClaw provides:
 * - Persistent memory across conversations
 * - Tool execution framework with 50+ integrations
 * - Multi-agent orchestration
 * - Session management with context retention
 *
 * @see https://openclaw.ai/docs
 */

import { v4 as uuidv4 } from 'uuid'

// Environment configuration
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:3100'
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY

// Types

export interface OpenClawConfig {
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

export interface AgentConfig {
  name: string
  systemPrompt: string
  model?: string // claude-3-5-sonnet, gpt-4o, etc
  tools?: ToolDefinition[]
  maxTokens?: number
  temperature?: number
  memoryEnabled?: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler?: string // Reference to handler function
  requiresApproval?: boolean
}

export interface AgentInstance {
  id: string
  name: string
  status: 'idle' | 'running' | 'stopped' | 'error'
  config: AgentConfig
  sessionCount: number
  memoryCount: number
  createdAt: string
  lastActivityAt: string
}

export interface Session {
  id: string
  agentId: string
  status: 'active' | 'paused' | 'completed' | 'error'
  context: Record<string, unknown>
  messageCount: number
  createdAt: string
  lastMessageAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  timestamp: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  requiresApproval: boolean
}

export interface ToolResult {
  toolCallId: string
  result: unknown
  error?: string
}

export interface Memory {
  id: string
  key: string
  type: 'fact' | 'preference' | 'context' | 'learning' | 'relationship'
  content: string
  importance: number
  accessCount: number
  createdAt: string
  lastAccessedAt: string
  expiresAt?: string
}

export interface ChatRequest {
  sessionId: string
  message: string
  context?: Record<string, unknown>
  tools?: string[] // Tool names to enable for this message
  streamResponse?: boolean
}

export interface ChatResponse {
  messageId: string
  content: string
  toolCalls?: ToolCall[]
  memoryUpdates?: MemoryUpdate[]
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export interface MemoryUpdate {
  type: 'created' | 'updated' | 'deleted'
  memory: Memory
}

export interface ToolExecutionRequest {
  toolCallId: string
  action: 'approve' | 'reject' | 'execute'
  modifiedInput?: Record<string, unknown>
}

export interface ToolExecutionResponse {
  toolCallId: string
  status: 'executed' | 'rejected' | 'failed'
  result?: unknown
  error?: string
}

// OpenClaw Client class

class OpenClawClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  constructor(config: OpenClawConfig = {}) {
    this.baseUrl = config.baseUrl || OPENCLAW_API_URL
    this.apiKey = config.apiKey || OPENCLAW_API_KEY || ''
    this.timeout = config.timeout || 30000
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenClaw API error (${response.status}): ${errorText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `OpenClaw API request timed out after ${this.timeout}ms`,
        )
      }
      throw error
    }
  }

  // ============================================
  // Agent Management
  // ============================================

  /**
   * Create a new agent instance
   */
  async createAgent(config: AgentConfig): Promise<AgentInstance> {
    return this.request<AgentInstance>('POST', '/api/agents', config)
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentInstance | null> {
    try {
      return await this.request<AgentInstance>('GET', `/api/agents/${agentId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<AgentInstance[]> {
    const response = await this.request<{ agents: AgentInstance[] }>(
      'GET',
      '/api/agents',
    )
    return response.agents
  }

  /**
   * Update agent configuration
   */
  async updateAgent(
    agentId: string,
    updates: Partial<AgentConfig>,
  ): Promise<AgentInstance> {
    return this.request<AgentInstance>(
      'PATCH',
      `/api/agents/${agentId}`,
      updates,
    )
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/agents/${agentId}`)
  }

  /**
   * Start an agent (make it available for sessions)
   */
  async startAgent(agentId: string): Promise<AgentInstance> {
    return this.request<AgentInstance>('POST', `/api/agents/${agentId}/start`)
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<AgentInstance> {
    return this.request<AgentInstance>('POST', `/api/agents/${agentId}/stop`)
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a new session with an agent
   */
  async createSession(
    agentId: string,
    context?: Record<string, unknown>,
  ): Promise<Session> {
    return this.request<Session>('POST', `/api/agents/${agentId}/sessions`, {
      context,
    })
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.request<Session>('GET', `/api/sessions/${sessionId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * List sessions for an agent
   */
  async listSessions(
    agentId: string,
    options?: { status?: string; limit?: number },
  ): Promise<Session[]> {
    const params = new URLSearchParams()
    if (options?.status) params.set('status', options.status)
    if (options?.limit) params.set('limit', options.limit.toString())

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ sessions: Session[] }>(
      'GET',
      `/api/agents/${agentId}/sessions${query}`,
    )
    return response.sessions
  }

  /**
   * Update session context
   */
  async updateSessionContext(
    sessionId: string,
    context: Record<string, unknown>,
  ): Promise<Session> {
    return this.request<Session>('PATCH', `/api/sessions/${sessionId}`, {
      context,
    })
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string): Promise<Session> {
    return this.request<Session>('POST', `/api/sessions/${sessionId}/complete`)
  }

  // ============================================
  // Chat / Conversation
  // ============================================

  /**
   * Send a message to an agent session
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>(
      'POST',
      `/api/sessions/${request.sessionId}/messages`,
      {
        message: request.message,
        context: request.context,
        tools: request.tools,
      },
    )
  }

  /**
   * Get message history for a session
   */
  async getMessages(
    sessionId: string,
    options?: { limit?: number; before?: string },
  ): Promise<Message[]> {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', options.limit.toString())
    if (options?.before) params.set('before', options.before)

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ messages: Message[] }>(
      'GET',
      `/api/sessions/${sessionId}/messages${query}`,
    )
    return response.messages
  }

  // ============================================
  // Tool Execution
  // ============================================

  /**
   * Execute or respond to a tool call
   */
  async handleToolCall(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse> {
    return this.request<ToolExecutionResponse>(
      'POST',
      `/api/tools/${request.toolCallId}`,
      {
        action: request.action,
        modifiedInput: request.modifiedInput,
      },
    )
  }

  /**
   * Get pending tool calls requiring approval
   */
  async getPendingToolCalls(agentId?: string): Promise<ToolCall[]> {
    const params = agentId ? `?agentId=${agentId}` : ''
    const response = await this.request<{ toolCalls: ToolCall[] }>(
      'GET',
      `/api/tools/pending${params}`,
    )
    return response.toolCalls
  }

  /**
   * Register a custom tool
   */
  async registerTool(
    agentId: string,
    tool: ToolDefinition,
  ): Promise<ToolDefinition> {
    return this.request<ToolDefinition>(
      'POST',
      `/api/agents/${agentId}/tools`,
      tool,
    )
  }

  // ============================================
  // Memory Management
  // ============================================

  /**
   * Add a memory entry for an agent
   */
  async addMemory(
    agentId: string,
    memory: Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'lastAccessedAt'>,
  ): Promise<Memory> {
    return this.request<Memory>('POST', `/api/agents/${agentId}/memory`, memory)
  }

  /**
   * Get memories for an agent
   */
  async getMemories(
    agentId: string,
    options?: {
      type?: string
      query?: string // Semantic search query
      limit?: number
    },
  ): Promise<Memory[]> {
    const params = new URLSearchParams()
    if (options?.type) params.set('type', options.type)
    if (options?.query) params.set('query', options.query)
    if (options?.limit) params.set('limit', options.limit.toString())

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ memories: Memory[] }>(
      'GET',
      `/api/agents/${agentId}/memory${query}`,
    )
    return response.memories
  }

  /**
   * Update a memory entry
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<Pick<Memory, 'content' | 'importance' | 'expiresAt'>>,
  ): Promise<Memory> {
    return this.request<Memory>('PATCH', `/api/memory/${memoryId}`, updates)
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/memory/${memoryId}`)
  }

  /**
   * Clear all memories for an agent
   */
  async clearMemories(agentId: string, type?: string): Promise<void> {
    const params = type ? `?type=${type}` : ''
    await this.request<void>('DELETE', `/api/agents/${agentId}/memory${params}`)
  }

  // ============================================
  // Health & Status
  // ============================================

  /**
   * Check OpenClaw service health
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    version: string
    uptime: number
    activeAgents: number
    activeSessions: number
  }> {
    return this.request('GET', '/api/health')
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(agentId: string): Promise<{
    totalSessions: number
    activeSessions: number
    totalMessages: number
    totalToolCalls: number
    avgResponseTime: number
    memoryUsage: number
  }> {
    return this.request('GET', `/api/agents/${agentId}/metrics`)
  }
}

// Export singleton instance
export const openclawClient = new OpenClawClient()

// Export for custom configurations
export { OpenClawClient }

// ============================================
// OmniDial Integration Helpers
// ============================================

/**
 * Create a OmniDial lead qualification agent
 */
export async function createLeadQualificationAgent(
  name: string,
  systemPrompt: string,
): Promise<AgentInstance> {
  const tools: ToolDefinition[] = [
    {
      name: 'search_leads',
      description: 'Search for leads in OmniDial database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          filters: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              campaign: { type: 'string' },
              score: { type: 'number' },
            },
          },
          limit: { type: 'number', default: 10 },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_lead_details',
      description: 'Get detailed information about a specific lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'Lead ID' },
        },
        required: ['leadId'],
      },
    },
    {
      name: 'qualify_lead',
      description: 'Set qualification score and category for a lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          category: {
            type: 'string',
            enum: ['high_intent', 'medium', 'low_intent', 'disqualified'],
          },
          score: { type: 'number', minimum: 0, maximum: 100 },
          reasoning: { type: 'string' },
        },
        required: ['leadId', 'category', 'score', 'reasoning'],
      },
      requiresApproval: false,
    },
    {
      name: 'research_company',
      description: 'Research a company using web search',
      inputSchema: {
        type: 'object',
        properties: {
          companyName: { type: 'string' },
          domain: { type: 'string' },
        },
        required: ['companyName'],
      },
    },
    {
      name: 'draft_email',
      description: 'Draft a personalized email for a lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          template: { type: 'string' },
          personalization: { type: 'object' },
        },
        required: ['leadId'],
      },
      requiresApproval: true,
    },
    {
      name: 'send_email',
      description: 'Send an approved email to a lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['leadId', 'subject', 'body'],
      },
      requiresApproval: true,
    },
    {
      name: 'schedule_followup',
      description: 'Schedule a follow-up task or call',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          type: { type: 'string', enum: ['call', 'email', 'sms'] },
          scheduledAt: { type: 'string', format: 'date-time' },
          notes: { type: 'string' },
        },
        required: ['leadId', 'type', 'scheduledAt'],
      },
    },
  ]

  return openclawClient.createAgent({
    name,
    systemPrompt,
    model: 'claude-3-5-sonnet',
    tools,
    maxTokens: 4096,
    temperature: 0.7,
    memoryEnabled: true,
  })
}

/**
 * Create an SMS response agent
 */
export async function createSmsResponseAgent(
  name: string,
  systemPrompt: string,
): Promise<AgentInstance> {
  const tools: ToolDefinition[] = [
    {
      name: 'get_lead_context',
      description: 'Get context about the lead who sent the SMS',
      inputSchema: {
        type: 'object',
        properties: {
          phoneNumber: { type: 'string' },
        },
        required: ['phoneNumber'],
      },
    },
    {
      name: 'get_conversation_history',
      description: 'Get SMS conversation history with the lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          limit: { type: 'number', default: 10 },
        },
        required: ['leadId'],
      },
    },
    {
      name: 'send_sms',
      description: 'Send an SMS response',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          message: { type: 'string', maxLength: 160 },
        },
        required: ['leadId', 'message'],
      },
      requiresApproval: false, // SMS responses are typically automated
    },
    {
      name: 'escalate_to_human',
      description: 'Escalate the conversation to a human rep',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          reason: { type: 'string' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['leadId', 'reason'],
      },
    },
  ]

  return openclawClient.createAgent({
    name,
    systemPrompt,
    model: 'claude-3-5-sonnet',
    tools,
    maxTokens: 160, // Keep SMS responses short
    temperature: 0.7,
    memoryEnabled: true,
  })
}

/**
 * Start a qualification workflow for a lead
 */
export async function startQualificationWorkflow(
  agentId: string,
  leadData: {
    leadId: string
    name: string
    company: string
    email: string
    phone?: string
    source?: string
    customFields?: Record<string, unknown>
  },
): Promise<{
  session: Session
  response: ChatResponse
}> {
  // Create session with lead context
  const session = await openclawClient.createSession(agentId, {
    lead: leadData,
    workflowType: 'qualification',
    startedAt: new Date().toISOString(),
  })

  // Send initial prompt to start qualification
  const response = await openclawClient.chat({
    sessionId: session.id,
    message: `New lead for qualification:
Name: ${leadData.name}
Company: ${leadData.company}
Email: ${leadData.email}
${leadData.phone ? `Phone: ${leadData.phone}` : ''}
${leadData.source ? `Source: ${leadData.source}` : ''}

Please:
1. Research this company to understand their business, tech stack, and recent news
2. Qualify this lead based on our ICP criteria
3. Generate a personalized outreach email draft
4. Provide your reasoning for the qualification decision`,
    tools: [
      'research_company',
      'qualify_lead',
      'draft_email',
      'get_lead_details',
    ],
  })

  return { session, response }
}
