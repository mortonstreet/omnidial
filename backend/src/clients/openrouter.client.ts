const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

interface OpenRouterResponse {
  choices?: Array<{ message: { content: string } }>
  usage?: { total_tokens: number }
}

/**
 * Single-turn chat completion that must answer with a JSON object. Throws when
 * the key is missing, the request fails, or no JSON object comes back.
 */
export const completeJson = async <T>(params: {
  model: string
  system: string
  user: string
  title: string
  maxTokens?: number
}): Promise<{ data: T; tokensUsed: number }> => {
  try {
    return await completeJsonOnce<T>(params)
  } catch (error) {
    // Models occasionally emit malformed JSON (an unescaped quote in a
    // transcript excerpt). One stricter retry fixes nearly all of them.
    if (!(error instanceof SyntaxError)) throw error
    return completeJsonOnce<T>({
      ...params,
      user: `${params.user}\n\nReturn strictly valid JSON: escape any double quotes inside string values.`,
    })
  }
}

const completeJsonOnce = async <T>(params: {
  model: string
  system: string
  user: string
  title: string
  maxTokens?: number
}): Promise<{ data: T; tokensUsed: number }> => {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omnidial.io',
      'X-Title': params.title,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: params.maxTokens ?? 1500,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `OpenRouter API error ${response.status}: ${await response.text()}`,
    )
  }

  const body = (await response.json()) as OpenRouterResponse
  const content = body.choices?.[0]?.message.content ?? ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON object in OpenRouter response')
  }

  return {
    data: JSON.parse(jsonMatch[0]) as T,
    tokensUsed: body.usage?.total_tokens ?? 0,
  }
}
