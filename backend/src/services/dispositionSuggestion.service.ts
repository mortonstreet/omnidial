import Anthropic from '@anthropic-ai/sdk'
import * as callRepository from '@/repositories/call.repository'
import * as dispositionRepository from '@/repositories/disposition.repository'
import * as leadRepository from '@/repositories/lead.repository'
import {
  transcribeRecording,
  isTranscriptionAvailable,
} from '@/services/transcription.service'

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic()

interface DispositionSuggestion {
  dispositionId: string
  dispositionLabel: string
  confidence: number
  reasoning: string
}

interface VoicemailAnalysis {
  isPersonalVoicemail: boolean | null
  reasoning: string
}

interface SuggestDispositionsResult {
  suggestions: DispositionSuggestion[]
  voicemailAnalysis?: VoicemailAnalysis
  callId: string
  transcriptAvailable: boolean
}

/**
 * Get AI-powered disposition suggestions for a call
 * Uses Claude to analyze call transcript/context and suggest appropriate dispositions
 */
export const suggestDispositions = async (
  callId: string,
  organizationId: string,
  twilioConfigId: string,
  transcript?: string,
): Promise<SuggestDispositionsResult> => {
  // Get available dispositions for this org
  const dispositions =
    await dispositionRepository.findAllByTwilioConfigId(twilioConfigId)

  if (dispositions.length === 0) {
    throw new Error('No dispositions configured')
  }

  // Get call details for context
  const call = await callRepository.findById(callId)
  if (!call) {
    throw new Error('Call not found')
  }

  // Auto-transcribe recording if no transcript provided and recording exists
  let resolvedTranscript = transcript
  if (!resolvedTranscript && call.recordingUrl && isTranscriptionAvailable()) {
    try {
      const result = await transcribeRecording(
        call.recordingUrl,
        organizationId,
      )
      resolvedTranscript = result.text
    } catch (error) {
      console.error('Auto-transcription failed, proceeding without:', error)
    }
  }

  // Pre-check: if transcript matches IVR/robo patterns, short-circuit to voicemail disposition
  if (resolvedTranscript && isIvrTranscript(resolvedTranscript)) {
    const findDisposition = (labels: string[]) => {
      for (const label of labels) {
        const match = dispositions.find((d) =>
          d.label.toLowerCase().includes(label.toLowerCase()),
        )
        if (match) return match
      }
      return null
    }

    const voicemailDisposition = findDisposition([
      'voicemail',
      'no answer',
      'busy',
    ])
    if (voicemailDisposition) {
      // Persist voicemail analysis — IVR is not a personal voicemail
      if (call.leadId) {
        try {
          await leadRepository.updatePersonalVoicemailStatus(call.leadId, false)
        } catch (error) {
          console.error('Failed to persist voicemail analysis:', error)
        }
      }

      return {
        suggestions: [
          {
            dispositionId: voicemailDisposition.id,
            dispositionLabel: voicemailDisposition.label,
            confidence: 0.95,
            reasoning:
              'IVR/automated system detected in transcript — not a live person',
          },
        ],
        voicemailAnalysis: {
          isPersonalVoicemail: false,
          reasoning:
            'Transcript contains IVR/robo voicemail patterns (e.g. menu prompts, press-key options)',
        },
        callId,
        transcriptAvailable: true,
      }
    }
  }

  // Build disposition options for the prompt
  const dispositionOptions = dispositions.map((d) => ({
    id: d.id,
    label: d.label,
  }))

  // Build the prompt for Claude
  const prompt = buildDispositionPrompt(
    call,
    dispositionOptions,
    resolvedTranscript,
  )

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Parse Claude's response
    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const suggestions = parseClaudeResponse(responseText, dispositions)
    const voicemailAnalysis = parseVoicemailAnalysis(responseText)

    // Persist voicemail analysis to lead if available
    if (voicemailAnalysis?.isPersonalVoicemail != null && call.leadId) {
      try {
        await leadRepository.updatePersonalVoicemailStatus(
          call.leadId,
          voicemailAnalysis.isPersonalVoicemail,
        )
      } catch (error) {
        console.error('Failed to persist voicemail analysis:', error)
      }
    }

    return {
      suggestions,
      voicemailAnalysis: voicemailAnalysis ?? undefined,
      callId,
      transcriptAvailable: !!resolvedTranscript,
    }
  } catch (error) {
    console.error('Failed to get AI disposition suggestions:', error)

    // Return a fallback based on call duration/status
    const fallbackSuggestion = getFallbackSuggestion(call, dispositions)

    return {
      suggestions: fallbackSuggestion ? [fallbackSuggestion] : [],
      callId,
      transcriptAvailable: false,
    }
  }
}

/**
 * Build the prompt for Claude to analyze and suggest dispositions
 */
function buildDispositionPrompt(
  call: {
    duration: number | null
    status: string
    direction: string
    answeredAt: Date | null
    endedAt: Date | null
    toNumber: string
    leadId: string | null
  },
  dispositionOptions: { id: string; label: string }[],
  transcript?: string,
): string {
  const callInfo = `
Call Information:
- Direction: ${call.direction}
- Duration: ${call.duration || 0} seconds
- Status: ${call.status}
- Was Answered: ${call.answeredAt ? 'Yes' : 'No'}
- Phone Number: ${call.toNumber}
`

  const transcriptSection = transcript
    ? `
Call Transcript:
${transcript}
`
    : `
(No transcript available - please infer disposition from call metadata)
`

  const optionsSection = `
Available Disposition Options:
${dispositionOptions.map((d) => `- ${d.label} (ID: ${d.id})`).join('\n')}
`

  return `You are a call center AI assistant helping to categorize call outcomes.

${callInfo}
${transcriptSection}
${optionsSection}

Based on the call information${transcript ? ' and transcript' : ''}, suggest the most appropriate disposition(s) for this call.

Respond in JSON format with an array of suggestions, ordered by confidence (highest first), and a voicemail analysis:
{
  "suggestions": [
    {
      "dispositionId": "the-id-from-options",
      "dispositionLabel": "the-label-from-options",
      "confidence": 0.95,
      "reasoning": "Brief explanation why this disposition fits"
    }
  ],
  "voicemailAnalysis": {
    "isPersonalVoicemail": true,
    "reasoning": "Brief explanation of voicemail type classification"
  }
}

Rules:
- Only suggest dispositions from the available options
- Confidence should be between 0 and 1
- If call wasn't answered (duration 0 or no answeredAt), suggest "Voicemail" or "No Answer" type dispositions
- If call was very short (< 10 seconds), it might be a wrong number or immediate hang up
- Provide 1-3 suggestions maximum
- Be concise in reasoning (1-2 sentences)

CRITICAL - IVR / Robo Voicemail / Voicemail Greeting Detection:
- If the transcript contains IVR, automated system language, OR voicemail greeting language, this is NOT a real human connection. It should be dispositioned as "Voicemail" or "No Answer" — NEVER as a connect or conversation.
- A voicemail greeting where someone states their name (e.g. "Hi you've reached John, please leave a message") is still a VOICEMAIL, not a connect. The person did NOT pick up — their recorded greeting played.
- Common IVR/robo patterns include (but are not limited to):
  - "press 1", "press 2", "press #", "press star", or any "press [digit/key]" prompts
  - "for more options", "for billing", "for sales", "for support", "for English", "for Spanish"
  - "please listen carefully as our menu options have changed"
  - "your call is important to us"
  - "the mailbox is full"
  - "is not available", "cannot be reached", "cannot take your call"
  - "office hours are", "we are currently closed"
  - "please hold", "please wait"
  - "this call may be recorded"
  - "dial by name directory"
  - "if you know your party's extension"
  - "the number you have dialed", "the person you are trying to reach"
  - "automated attendant", "auto attendant"
  - "main menu", "previous menu", "return to the main menu"
  - Repetitive menu structures or numbered options
- Common voicemail greeting patterns include (but are not limited to):
  - "leave a message", "please leave a message", "leave a detailed message"
  - "after the beep", "after the tone", "at the tone", "at the beep"
  - "you've reached [name]", "hi you've reached", "hello you've reached"
  - "this is the voicemail of", "the voicemail box"
  - "sorry I missed your call", "sorry I can't take your call"
  - "I'm not available", "I'm unavailable", "I'm unable to take your call", "I'm away"
  - "call me back", "call us back", "get back to you", "return your call"
  - "I'll get back to you", "I'll return your call"
  - "no one is available to take your call"
  - "your call has been forwarded to voicemail"
  - "record your message"
  - "please try again later", "please try calling back"
- If ANY of these patterns appear in the transcript, treat it as voicemail/IVR, NOT a live person. Disposition as voicemail/no answer accordingly.
- THIS IS THE HIGHEST PRIORITY RULE — it overrides call duration, answered status, or any other signal. A call can show as "answered" but still be voicemail/IVR.

Voicemail analysis rules:
- "isPersonalVoicemail": true if the transcript shows a personal/custom voicemail greeting (person recorded their own name, e.g. "Hi, you've reached John...")
- "isPersonalVoicemail": false if it's a generic/carrier/system default voicemail greeting (e.g. "The person you are calling is not available"), OR if it's an IVR/automated attendant system with menu options
- "isPersonalVoicemail": null if there's no voicemail detected, the call was answered by a real person, or you can't determine the voicemail type
- An IVR/robo system answering the call is NOT a personal voicemail and NOT a real connection — classify isPersonalVoicemail as false
`
}

/**
 * Parse Claude's response into structured suggestions
 */
function parseClaudeResponse(
  responseText: string,
  dispositions: { id: string; label: string }[],
): DispositionSuggestion[] {
  try {
    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    const suggestions = parsed.suggestions || []

    // Validate and filter suggestions to ensure they match available dispositions
    return suggestions
      .filter((s: DispositionSuggestion) => {
        const matchingDisposition = dispositions.find(
          (d) => d.id === s.dispositionId,
        )
        return matchingDisposition !== undefined
      })
      .map((s: DispositionSuggestion) => ({
        dispositionId: s.dispositionId,
        dispositionLabel: s.dispositionLabel,
        confidence: Math.min(1, Math.max(0, s.confidence || 0)),
        reasoning: s.reasoning || 'No reasoning provided',
      }))
  } catch {
    return []
  }
}

/**
 * Parse voicemail analysis from Claude's response
 */
function parseVoicemailAnalysis(
  responseText: string,
): VoicemailAnalysis | null {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const analysis = parsed.voicemailAnalysis
    if (!analysis) return null

    return {
      isPersonalVoicemail:
        analysis.isPersonalVoicemail === true
          ? true
          : analysis.isPersonalVoicemail === false
            ? false
            : null,
      reasoning: analysis.reasoning || '',
    }
  } catch {
    return null
  }
}

/**
 * Check if transcript text matches IVR/robo voicemail or personal voicemail greeting patterns.
 * Any of these mean the call was NOT a live human conversation.
 */
function isIvrTranscript(transcript: string): boolean {
  const lower = transcript.toLowerCase()
  const ivrAndVoicemailPatterns = [
    // IVR / automated system patterns
    /press\s+(\d|one|two|three|four|five|six|seven|eight|nine|zero|pound|star|#|\*)/,
    /for\s+(more\s+)?options/,
    /for\s+(billing|sales|support|service|english|spanish|french)/,
    /menu\s+options\s+have\s+changed/,
    /your\s+call\s+is\s+important/,
    /mailbox\s+is\s+full/,
    /office\s+hours\s+are/,
    /we\s+are\s+(currently\s+)?closed/,
    /please\s+hold/,
    /this\s+call\s+may\s+be\s+recorded/,
    /dial\s+by\s+name/,
    /if\s+you\s+know\s+your\s+party'?s?\s+extension/,
    /the\s+number\s+you\s+have\s+dialed/,
    /the\s+person\s+you\s+are\s+(trying\s+to\s+reach|calling)/,
    /auto(mated)?\s+attendant/,
    /(main|previous)\s+menu/,
    /return\s+to\s+the\s+main\s+menu/,
    /please\s+listen\s+carefully/,
    /is\s+not\s+available/,
    /cannot\s+(be\s+reached|take\s+your\s+call)/,

    // Voicemail greeting patterns (personal and generic)
    /leave\s+(a\s+)?message/,
    /leave\s+(a\s+)?(detailed\s+)?message/,
    /record\s+your\s+message/,
    /after\s+the\s+(beep|tone)/,
    /at\s+the\s+(beep|tone)/,
    /please\s+(leave|record)\s+(a\s+)?(brief|short|detailed)?\s*message/,
    /you('?ve|\s+have)\s+reached\s+/,
    /hi\s+you('?ve|\s+have)\s+reached/,
    /hello\s+you('?ve|\s+have)\s+reached/,
    /this\s+is\s+the\s+voicemail/,
    /sorry\s+(i|we)\s+(missed|can't take|cannot take|am not able)/,
    /i('?m|\s+am)\s+(not\s+available|unavailable|unable\s+to\s+take|away)/,
    /we('?re|\s+are)\s+(not\s+available|unavailable|unable\s+to\s+take|away)/,
    /call\s+(me|us)\s+back/,
    /get\s+back\s+to\s+you/,
    /return\s+your\s+call/,
    /i('?ll|\s+will)\s+(get\s+back|return|call\s+you)/,
    /no\s+one\s+is\s+available/,
    /your\s+call\s+has\s+been\s+forwarded/,
    /the\s+voice\s*mail\s+box/,
    /voice\s*mail\s+(box|system|greeting)/,
    /please\s+try\s+(again|calling|your\s+call)\s+(later|back)/,
  ]
  return ivrAndVoicemailPatterns.some((pattern) => pattern.test(lower))
}

/**
 * Get fallback suggestion based on call metadata when AI is unavailable
 */
function getFallbackSuggestion(
  call: {
    duration: number | null
    status: string
    answeredAt: Date | null
  },
  dispositions: { id: string; label: string }[],
): DispositionSuggestion | null {
  // Find appropriate disposition based on call metadata
  const wasAnswered = !!call.answeredAt
  const duration = call.duration || 0

  // Priority matching for common disposition labels
  const findDisposition = (labels: string[]) => {
    for (const label of labels) {
      const match = dispositions.find((d) =>
        d.label.toLowerCase().includes(label.toLowerCase()),
      )
      if (match) return match
    }
    return null
  }

  if (!wasAnswered || duration === 0) {
    // Call wasn't answered
    const disposition = findDisposition(['voicemail', 'no answer', 'busy'])
    if (disposition) {
      return {
        dispositionId: disposition.id,
        dispositionLabel: disposition.label,
        confidence: 0.7,
        reasoning: 'Call was not answered',
      }
    }
  }

  if (duration < 10) {
    // Very short call - possible wrong number or quick hang up
    const disposition = findDisposition([
      'wrong number',
      'hung up',
      'disconnected',
    ])
    if (disposition) {
      return {
        dispositionId: disposition.id,
        dispositionLabel: disposition.label,
        confidence: 0.5,
        reasoning: 'Very short call duration suggests possible wrong number',
      }
    }
  }

  // Default to first disposition with low confidence
  if (dispositions.length > 0) {
    return {
      dispositionId: dispositions[0].id,
      dispositionLabel: dispositions[0].label,
      confidence: 0.3,
      reasoning: 'Default suggestion - please review call details',
    }
  }

  return null
}
