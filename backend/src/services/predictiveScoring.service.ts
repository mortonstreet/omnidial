import { db } from '@/lib/db'
import { sql } from 'kysely'
import { Decimal } from '@prisma/client/runtime/library'
import * as telnyxClient from '@/clients/telnyx.client'
import type {
  LeadPredictiveScoreResponse,
  CallAnswerPatternsResponse,
  CalculateScoresResponse,
  ReorderResponse,
  PhoneTypeDetectionResponse,
  PhoneType,
} from '@shared/types/src/requests/predictiveScoring'

// Day names for display
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

// Calculate predictive scores for all leads in a list
export const calculateScoresForList = async (
  organizationId: string,
  listId: string,
): Promise<CalculateScoresResponse> => {
  // Get all leads in the list
  const entries = await db
    .selectFrom('lead_list_entry as lle')
    .innerJoin('lead as l', 'l.id', 'lle.leadId')
    .where('lle.listId', '=', listId)
    .where('lle.removedAt', 'is', null)
    .where('l.deletedAt', 'is', null)
    .select([
      'l.id',
      'l.phone',
      'l.totalCallAttempts',
      'l.totalAnswers',
      'l.phoneType',
      'l.hasPersonalVoicemail',
    ])
    .execute()

  // Get organization's call answer patterns
  const patterns = await getCallAnswerPatterns(organizationId)

  // Calculate scores for each lead
  let totalScore = 0
  let highScoreCount = 0
  let lowScoreCount = 0

  for (const lead of entries) {
    const score = calculateLeadScore(lead, patterns)

    // Upsert the score
    await db
      .insertInto('lead_predictive_score')
      .values({
        id: crypto.randomUUID(),
        organizationId,
        leadId: lead.id,
        score: new Decimal(score).toString(),
        phoneType: lead.phoneType,
        hasPersonalVoicemail: lead.hasPersonalVoicemail,
        totalAttempts: lead.totalCallAttempts,
        totalAnswers: lead.totalAnswers,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column('leadId').doUpdateSet({
          score: new Decimal(score).toString(),
          phoneType: lead.phoneType,
          hasPersonalVoicemail: lead.hasPersonalVoicemail,
          totalAttempts: lead.totalCallAttempts,
          totalAnswers: lead.totalAnswers,
          calculatedAt: new Date(),
          updatedAt: new Date(),
        }),
      )
      .execute()

    totalScore += score
    if (score > 0.7) highScoreCount++
    if (score < 0.3) lowScoreCount++
  }

  return {
    listId,
    leadsProcessed: entries.length,
    avgScore: entries.length > 0 ? totalScore / entries.length : 0,
    highScoreCount,
    lowScoreCount,
  }
}

// Reorder campaign leads by predictive score
export const reorderCampaignByScore = async (
  organizationId: string,
  campaignId: string,
  listId: string,
): Promise<ReorderResponse> => {
  // Get leads with their scores
  const leadsWithScores = await db
    .selectFrom('campaign_lead as cl')
    .leftJoin('lead_predictive_score as lps', 'lps.leadId', 'cl.leadId')
    .where('cl.campaignId', '=', campaignId)
    .select(['cl.id', 'cl.leadId', 'lps.score'])
    .execute()

  // Sort by score descending (null scores at end)
  const sorted = leadsWithScores.sort((a, b) => {
    const scoreA = a.score ? Number(a.score) : 0
    const scoreB = b.score ? Number(b.score) : 0
    return scoreB - scoreA
  })

  // Update dial order based on score ranking
  for (let i = 0; i < sorted.length; i++) {
    await db
      .updateTable('campaign_lead')
      .set({
        scoreDialOrder: i + 1,
        predictiveScore: sorted[i].score,
      })
      .where('id', '=', sorted[i].id)
      .execute()
  }

  return {
    campaignId,
    listId,
    leadsReordered: sorted.length,
  }
}

// Get a single lead's score
export const getLeadScore = async (
  leadId: string,
): Promise<LeadPredictiveScoreResponse | null> => {
  const score = await db
    .selectFrom('lead_predictive_score as lps')
    .innerJoin('lead as l', 'l.id', 'lps.leadId')
    .where('lps.leadId', '=', leadId)
    .select([
      'lps.id',
      'lps.organizationId',
      'lps.leadId',
      'lps.score',
      'lps.phoneType',
      'lps.bestDayOfWeek',
      'lps.bestHourOfDay',
      'lps.totalAttempts',
      'lps.totalAnswers',
      'lps.lastAttemptAt',
      'lps.lastAnswerAt',
      'lps.calculatedAt',
      'l.firstName',
      'l.lastName',
      'l.phone',
    ])
    .executeTakeFirst()

  if (!score) {
    return null
  }

  return {
    id: score.id,
    organizationId: score.organizationId,
    leadId: score.leadId,
    leadName: `${score.firstName || ''} ${score.lastName || ''}`.trim() || null,
    leadPhone: score.phone,
    score: Number(score.score),
    phoneType: score.phoneType as PhoneType | null,
    bestDayOfWeek: score.bestDayOfWeek,
    bestHourOfDay: score.bestHourOfDay,
    totalAttempts: score.totalAttempts,
    totalAnswers: score.totalAnswers,
    answerRate:
      score.totalAttempts > 0 ? score.totalAnswers / score.totalAttempts : null,
    lastAttemptAt: score.lastAttemptAt?.toISOString() || null,
    lastAnswerAt: score.lastAnswerAt?.toISOString() || null,
    calculatedAt: score.calculatedAt.toISOString(),
  }
}

// Get call answer patterns for an organization
export const getCallAnswerPatterns = async (
  organizationId: string,
): Promise<CallAnswerPatternsResponse> => {
  // First, update patterns from recent call data
  await updateCallAnswerPatterns(organizationId)

  const patterns = await db
    .selectFrom('call_answer_pattern')
    .where('organizationId', '=', organizationId)
    .select(['dayOfWeek', 'hourOfDay', 'attempts', 'answers', 'answerRate'])
    .orderBy('dayOfWeek')
    .orderBy('hourOfDay')
    .execute()

  // Calculate overall stats
  let totalAttempts = 0
  let totalAnswers = 0
  let bestDay: {
    dayOfWeek: number
    dayName: string
    answerRate: number
  } | null = null
  let bestHour: { hourOfDay: number; answerRate: number } | null = null

  // Aggregate by day
  const dayStats = new Map<number, { attempts: number; answers: number }>()
  // Aggregate by hour
  const hourStats = new Map<number, { attempts: number; answers: number }>()

  for (const pattern of patterns) {
    totalAttempts += pattern.attempts
    totalAnswers += pattern.answers

    // Day aggregation
    const dayData = dayStats.get(pattern.dayOfWeek) || {
      attempts: 0,
      answers: 0,
    }
    dayData.attempts += pattern.attempts
    dayData.answers += pattern.answers
    dayStats.set(pattern.dayOfWeek, dayData)

    // Hour aggregation
    const hourData = hourStats.get(pattern.hourOfDay) || {
      attempts: 0,
      answers: 0,
    }
    hourData.attempts += pattern.attempts
    hourData.answers += pattern.answers
    hourStats.set(pattern.hourOfDay, hourData)
  }

  // Find best day
  for (const [day, stats] of dayStats) {
    if (stats.attempts >= 10) {
      const rate = stats.answers / stats.attempts
      if (!bestDay || rate > bestDay.answerRate) {
        bestDay = { dayOfWeek: day, dayName: DAY_NAMES[day], answerRate: rate }
      }
    }
  }

  // Find best hour
  for (const [hour, stats] of hourStats) {
    if (stats.attempts >= 10) {
      const rate = stats.answers / stats.attempts
      if (!bestHour || rate > bestHour.answerRate) {
        bestHour = { hourOfDay: hour, answerRate: rate }
      }
    }
  }

  return {
    organizationId,
    patterns: patterns.map((p) => ({
      dayOfWeek: p.dayOfWeek,
      dayName: DAY_NAMES[p.dayOfWeek],
      hourOfDay: p.hourOfDay,
      attempts: p.attempts,
      answers: p.answers,
      answerRate: Number(p.answerRate),
    })),
    bestDay,
    bestHour,
    overallAnswerRate: totalAttempts > 0 ? totalAnswers / totalAttempts : 0,
  }
}

// Update call answer patterns from recent call history
async function updateCallAnswerPatterns(organizationId: string): Promise<void> {
  // Get call statistics grouped by day of week and hour
  const stats = await db
    .selectFrom('call as c')
    .innerJoin('twilio_config as tc', 'tc.id', 'c.twilioConfigId')
    .where('tc.organizationId', '=', organizationId)
    .where('c.direction', '=', 'outbound')
    .where('c.startedAt', '>=', sql<Date>`NOW() - INTERVAL '30 days'`)
    .groupBy([
      sql`EXTRACT(DOW FROM c."startedAt")`,
      sql`EXTRACT(HOUR FROM c."startedAt")`,
    ])
    .select([
      sql<number>`EXTRACT(DOW FROM c."startedAt")::int`.as('dayOfWeek'),
      sql<number>`EXTRACT(HOUR FROM c."startedAt")::int`.as('hourOfDay'),
      sql<number>`COUNT(*)::int`.as('attempts'),
      sql<number>`COUNT(*) FILTER (WHERE c.status = 'completed' AND c."answeredAt" IS NOT NULL)::int`.as(
        'answers',
      ),
    ])
    .execute()

  // Upsert patterns
  for (const stat of stats) {
    const answerRate = stat.attempts > 0 ? stat.answers / stat.attempts : 0

    await db
      .insertInto('call_answer_pattern')
      .values({
        id: crypto.randomUUID(),
        organizationId,
        dayOfWeek: stat.dayOfWeek,
        hourOfDay: stat.hourOfDay,
        attempts: stat.attempts,
        answers: stat.answers,
        answerRate: new Decimal(answerRate).toString(),
        updatedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(['organizationId', 'dayOfWeek', 'hourOfDay']).doUpdateSet({
          attempts: stat.attempts,
          answers: stat.answers,
          answerRate: new Decimal(answerRate).toString(),
          updatedAt: new Date(),
        }),
      )
      .execute()
  }
}

// Detect phone type using the Telnyx Number Lookup API
export const detectPhoneType = async (
  organizationId: string,
  phoneNumber: string,
): Promise<PhoneTypeDetectionResponse> => {
  try {
    const telnyx = await telnyxClient.getClientForOrganization(organizationId)

    const lookup = await telnyx.numberLookup(phoneNumber)

    const lineType = lookup.carrier?.type || 'unknown'

    let phoneType: PhoneType = 'unknown'
    switch (lineType) {
      case 'mobile':
        phoneType = 'mobile'
        break
      case 'landline':
      case 'fixed line':
      case 'fixedLine':
        phoneType = 'landline'
        break
      case 'voip':
        phoneType = 'voip'
        break
    }

    const carrierInfo = lookup.carrier as
      | {
          name?: string
          mobile_country_code?: string
          mobile_network_code?: string
        }
      | undefined

    return {
      phoneNumber: lookup.phone_number || phoneNumber,
      phoneType,
      carrier: carrierInfo?.name || null,
      mobileCountryCode: carrierInfo?.mobile_country_code || null,
      mobileNetworkCode: carrierInfo?.mobile_network_code || null,
    }
  } catch (error) {
    return {
      phoneNumber,
      phoneType: 'unknown',
      carrier: null,
      mobileCountryCode: null,
      mobileNetworkCode: null,
    }
  }
}

// Calculate a lead's predictive score
function calculateLeadScore(
  lead: {
    id: string
    phone: string | null
    totalCallAttempts: number
    totalAnswers: number
    phoneType: string | null
    hasPersonalVoicemail: boolean | null
  },
  patterns: CallAnswerPatternsResponse,
): number {
  let score = 0.5 // Base score

  // Factor 1: Historical answer rate (weight: 40%)
  if (lead.totalCallAttempts > 0) {
    const personalRate = lead.totalAnswers / lead.totalCallAttempts
    score = score * 0.6 + personalRate * 0.4
  }

  // Factor 2: Phone type (weight: 20%)
  // Mobile phones have higher answer rates than landlines
  if (lead.phoneType === 'mobile') {
    score += 0.1
  } else if (lead.phoneType === 'landline') {
    score -= 0.05
  } else if (lead.phoneType === 'voip') {
    score -= 0.1 // VOIP often indicates business/filtered line
  }

  // Factor 3: Current time alignment with org patterns (weight: 20%)
  const now = new Date()
  const currentDay = now.getDay()
  const currentHour = now.getHours()

  const currentPattern = patterns.patterns.find(
    (p) => p.dayOfWeek === currentDay && p.hourOfDay === currentHour,
  )
  if (currentPattern && currentPattern.attempts >= 10) {
    // Boost if current time is good for calling
    if (currentPattern.answerRate > patterns.overallAnswerRate) {
      score += 0.1 * (currentPattern.answerRate - patterns.overallAnswerRate)
    }
  }

  // Factor 4: Personal voicemail signal
  // A personal voicemail greeting confirms the number belongs to a real person
  if (lead.hasPersonalVoicemail === true) {
    score += 0.15
  } else if (lead.hasPersonalVoicemail === false) {
    score -= 0.03 // Generic voicemail is a weak negative signal
  }

  // Factor 5: Recency of last call attempt (weight: 20%)
  // Don't have last call data in this simplified version, could add

  // Clamp score to 0-1 range
  return Math.max(0, Math.min(1, score))
}
