/**
 * What actually happened on a call, from the rep's disposition and the
 * call's length. "Completed with duration > 0" counts voicemail greetings as
 * connects; this does not.
 *
 * Undispositioned calls are judged against the org's own voicemail length:
 * longer than 90% of calls the reps marked "Voicemail" means a person was
 * on the line. Nothing here is a fixed number of seconds.
 */

export type CallOutcome =
  | 'conversation'
  | 'voicemail'
  | 'bad_number'
  | 'no_answer'
  | 'unclear'

export const VOICEMAIL_LABEL =
  /voice\s*mail|no\s*answer|busy|machine|left\s*message/i
export const BAD_NUMBER_LABEL =
  /wrong\s*number|disconnected|invalid|bad\s*number|not\s*in\s*service/i
/** A step forward agreed on the call. "Not interested" is a conversation, not a win. */
export const POSITIVE_LABEL =
  /call\s*back|callback|meeting|booked|demo|appointment|follow[\s-]*up|(?<!not\s)interested/i

export interface CallForOutcome {
  dispositionLabel: string | null
  duration: number
  direction?: string | null
}

export const classifyCall = (
  call: CallForOutcome,
  voicemailCutoffSeconds: number | null,
): CallOutcome => {
  const label = call.dispositionLabel?.trim()
  if (label) {
    if (BAD_NUMBER_LABEL.test(label)) return 'bad_number'
    if (VOICEMAIL_LABEL.test(label)) return 'voicemail'
    return 'conversation' // any other disposition means a person answered
  }
  if (call.duration <= 0) return 'no_answer'
  if (voicemailCutoffSeconds !== null && call.duration > voicemailCutoffSeconds)
    return 'conversation'
  return 'unclear'
}

export const isPositiveOutcome = (dispositionLabel: string | null) =>
  !!dispositionLabel && POSITIVE_LABEL.test(dispositionLabel)

/** 90th percentile of voicemail-call lengths; null without enough samples to trust. */
export const voicemailCutoff = (
  voicemailDurations: number[],
  minSamples = 10,
): number | null => {
  const values = voicemailDurations.filter((d) => d > 0).sort((a, b) => a - b)
  if (values.length < minSamples) return null
  return values[Math.min(values.length - 1, Math.ceil(values.length * 0.9) - 1)]
}

export interface CallForFunnel extends CallForOutcome {
  id: string
  userId?: string | null
}

export interface CallingFunnel {
  dials: number
  conversations: number
  /** conversations / dials */
  conversationRate: number | null
  dialsPerConversation: number | null
  voicemails: number
  badNumbers: number
  noAnswer: number
  unclear: number
  /** Talk time on real conversations only (voicemail greetings excluded). */
  conversationSeconds: number
  avgConversationSeconds: number | null
  medianConversationSeconds: number | null
  /** Conversations that ended with a step forward (disposition or AI-secured next step). */
  positiveOutcomes: number
  /** positiveOutcomes / conversations */
  positiveRate: number | null
  voicemailCutoffSeconds: number | null
}

const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const summarizeCalling = (
  calls: CallForFunnel[],
  voicemailCutoffSeconds: number | null,
  securedCallIds: Set<string> = new Set(),
): CallingFunnel => {
  const outbound = calls.filter((c) => c.direction !== 'inbound')
  let conversations = 0
  let voicemails = 0
  let badNumbers = 0
  let noAnswer = 0
  let unclear = 0
  let positive = 0
  const lengths: number[] = []
  for (const call of calls) {
    const outcome = classifyCall(call, voicemailCutoffSeconds)
    if (outcome === 'conversation') {
      conversations++
      lengths.push(call.duration)
      if (
        isPositiveOutcome(call.dispositionLabel) ||
        securedCallIds.has(call.id)
      )
        positive++
    } else if (outcome === 'voicemail') voicemails++
    else if (outcome === 'bad_number') badNumbers++
    else if (outcome === 'no_answer') noAnswer++
    else unclear++
  }
  const seconds = lengths.reduce((a, b) => a + b, 0)
  return {
    dials: outbound.length,
    conversations,
    conversationRate: outbound.length ? conversations / outbound.length : null,
    dialsPerConversation: conversations
      ? Math.round((outbound.length / conversations) * 10) / 10
      : null,
    voicemails,
    badNumbers,
    noAnswer,
    unclear,
    conversationSeconds: seconds,
    avgConversationSeconds: conversations
      ? Math.round(seconds / conversations)
      : null,
    medianConversationSeconds: median(lengths),
    positiveOutcomes: positive,
    positiveRate: conversations ? positive / conversations : null,
    voicemailCutoffSeconds,
  }
}
