/**
 * Groq API Client
 * Fast LLM inference for lead qualification and high-volume processing.
 * 325-840 tokens/sec, $0.05/M tokens for high-volume tasks.
 *
 * @see https://console.groq.com/docs
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const REQUEST_TIMEOUT = 60000 // 60 seconds

// Available Groq models
export type GroqModel =
  | 'llama-3.3-70b-versatile'
  | 'llama-3.1-8b-instant'
  | 'llama-3.2-90b-vision-preview'
  | 'mixtral-8x7b-32768'
  | 'gemma2-9b-it'

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqChatRequest {
  model: GroqModel
  messages: GroqMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
  stop?: string | string[]
  response_format?: { type: 'text' | 'json_object' }
}

export interface GroqChatChoice {
  index: number
  message: {
    role: 'assistant'
    content: string
  }
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter'
}

export interface GroqUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_time: number
  completion_time: number
  total_time: number
}

export interface GroqChatResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: GroqChatChoice[]
  usage: GroqUsage
}

class GroqApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string,
  ) {
    super(message)
    this.name = 'GroqApiError'
  }
}

export class GroqClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = GROQ_BASE_URL) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Make an authenticated request to Groq API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')

        if (response.status === 401) {
          throw new GroqApiError(
            'Invalid API key. Please check your Groq API key.',
            401,
            errorText,
          )
        }

        if (response.status === 429) {
          throw new GroqApiError(
            'Rate limited. Please try again later.',
            429,
            errorText,
          )
        }

        if (response.status === 503) {
          throw new GroqApiError(
            'Groq service temporarily unavailable.',
            503,
            errorText,
          )
        }

        throw new GroqApiError(
          `Groq API error: ${errorText}`,
          response.status,
          errorText,
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof GroqApiError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GroqApiError('Request timeout', 408)
      }

      throw new GroqApiError(
        error instanceof Error ? error.message : 'Unknown error',
        500,
      )
    }
  }

  /**
   * Create a chat completion
   */
  async chatCompletion(request: GroqChatRequest): Promise<GroqChatResponse> {
    return this.request<GroqChatResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        stream: false, // Non-streaming for simplicity
      }),
    })
  }

  /**
   * Generate a simple completion from a single prompt
   */
  async complete(
    prompt: string,
    options: {
      model?: GroqModel
      systemPrompt?: string
      temperature?: number
      maxTokens?: number
      jsonMode?: boolean
    } = {},
  ): Promise<{ content: string; usage: GroqUsage }> {
    const {
      model = 'llama-3.3-70b-versatile',
      systemPrompt,
      temperature = 0.7,
      maxTokens = 2048,
      jsonMode = false,
    } = options

    const messages: GroqMessage[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await this.chatCompletion({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
    })

    return {
      content: response.choices[0]?.message.content ?? '',
      usage: response.usage,
    }
  }

  /**
   * Qualify a lead based on provided context
   * Returns structured qualification data
   */
  async qualifyLead(
    leadInfo: {
      name?: string
      email?: string
      company?: string
      title?: string
      website?: string
      linkedInUrl?: string
    },
    companyResearch: string,
    icpCriteria: string,
  ): Promise<{
    category: 'high_intent' | 'medium' | 'low_intent' | 'disqualified'
    score: number
    reasoning: string
    intentSignals: string[]
    usage: GroqUsage
  }> {
    const systemPrompt = `You are an expert SDR qualifying leads for B2B sales.
Analyze the lead and company research data against the ICP criteria.
Return a JSON object with:
- category: "high_intent" | "medium" | "low_intent" | "disqualified"
- score: 0-100 qualification score
- reasoning: 2-3 sentence explanation
- intentSignals: array of detected intent signals

Be objective and data-driven. High intent means they match ICP well and show buying signals.`

    const prompt = `Qualify this lead:

LEAD INFO:
${JSON.stringify(leadInfo, null, 2)}

COMPANY RESEARCH:
${companyResearch}

ICP CRITERIA:
${icpCriteria}

Return JSON only.`

    const response = await this.complete(prompt, {
      model: 'llama-3.3-70b-versatile',
      systemPrompt,
      temperature: 0.3, // Lower temp for more consistent scoring
      maxTokens: 1024,
      jsonMode: true,
    })

    const parsed = JSON.parse(response.content)

    return {
      category: parsed.category,
      score: Math.min(100, Math.max(0, parsed.score)),
      reasoning: parsed.reasoning,
      intentSignals: parsed.intentSignals || [],
      usage: response.usage,
    }
  }

  /**
   * Generate personalized email outreach
   */
  async generateEmail(
    lead: {
      firstName?: string
      lastName?: string
      company?: string
      title?: string
    },
    companyContext: string,
    valueProposition: string,
    tone: 'professional' | 'casual' | 'direct' = 'professional',
  ): Promise<{
    subject: string
    body: string
    usage: GroqUsage
  }> {
    const systemPrompt = `You are an expert sales copywriter crafting personalized outreach emails.
Write emails that are:
- Personalized to the recipient's role and company
- Clear on the value proposition
- Under 150 words
- Have a soft CTA (question, not a demand)

Tone: ${tone}

Return JSON with:
- subject: email subject line (under 60 chars)
- body: email body (plain text, no HTML)`

    const prompt = `Write an outreach email for:

RECIPIENT:
- Name: ${lead.firstName} ${lead.lastName || ''}
- Title: ${lead.title || 'Unknown'}
- Company: ${lead.company || 'Unknown'}

COMPANY CONTEXT:
${companyContext}

VALUE PROPOSITION:
${valueProposition}

Return JSON only.`

    const response = await this.complete(prompt, {
      model: 'llama-3.3-70b-versatile',
      systemPrompt,
      temperature: 0.7,
      maxTokens: 512,
      jsonMode: true,
    })

    const parsed = JSON.parse(response.content)

    return {
      subject: parsed.subject,
      body: parsed.body,
      usage: response.usage,
    }
  }

  /**
   * Generate SMS message
   */
  async generateSms(
    lead: { firstName?: string; company?: string },
    context: string,
    maxChars: number = 160,
  ): Promise<{ message: string; usage: GroqUsage }> {
    const systemPrompt = `You are writing brief, friendly SMS messages for sales outreach.
Keep messages under ${maxChars} characters.
Be conversational but professional.
Include a soft question or CTA.`

    const prompt = `Write an SMS to ${lead.firstName || 'there'} at ${lead.company || 'their company'}.

Context: ${context}

Return the SMS text only, no JSON.`

    const response = await this.complete(prompt, {
      model: 'llama-3.1-8b-instant', // Faster model for simple SMS
      systemPrompt,
      temperature: 0.8,
      maxTokens: 100,
    })

    return {
      message: response.content.slice(0, maxChars),
      usage: response.usage,
    }
  }

  /**
   * Test the connection by making a simple request
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.complete('Say "connected" in one word.', {
        model: 'llama-3.1-8b-instant',
        maxTokens: 10,
      })
      return { success: true, message: 'Connected to Groq' }
    } catch (error) {
      if (error instanceof GroqApiError) {
        return { success: false, message: error.message }
      }
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to connect to Groq',
      }
    }
  }
}

/**
 * Create a Groq client instance from environment
 */
export function createGroqClient(apiKey?: string): GroqClient {
  const key = apiKey || process.env.GROQ_API_KEY
  if (!key) {
    throw new Error('GROQ_API_KEY environment variable is required')
  }
  return new GroqClient(key)
}

/**
 * Validate Groq API key format
 */
export function validateGroqApiKey(apiKey: string): {
  valid: boolean
  error?: string
} {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  if (!apiKey.startsWith('gsk_')) {
    return {
      valid: false,
      error: 'Invalid API key format. Groq keys start with "gsk_"',
    }
  }

  return { valid: true }
}

// Singleton instance - lazily created when first accessed
let _groqClient: GroqClient | null = null

/**
 * Get the singleton Groq client instance
 */
export const groqClient = {
  get instance(): GroqClient {
    if (!_groqClient) {
      const key = process.env.GROQ_API_KEY
      if (!key) {
        throw new Error('GROQ_API_KEY environment variable is required')
      }
      _groqClient = new GroqClient(key)
    }
    return _groqClient
  },
  complete: (...args: Parameters<GroqClient['complete']>) =>
    groqClient.instance.complete(...args),
  chatCompletion: (...args: Parameters<GroqClient['chatCompletion']>) =>
    groqClient.instance.chatCompletion(...args),
  qualifyLead: (...args: Parameters<GroqClient['qualifyLead']>) =>
    groqClient.instance.qualifyLead(...args),
  generateEmail: (...args: Parameters<GroqClient['generateEmail']>) =>
    groqClient.instance.generateEmail(...args),
  generateSms: (...args: Parameters<GroqClient['generateSms']>) =>
    groqClient.instance.generateSms(...args),
}
