import { db } from '@/lib/db'
import { sql } from 'kysely'
import { v4 as uuidv4 } from 'uuid'
import { trigger as pusherTrigger } from '@/lib/pusher'
import { PUSHER_EVENTS, channels } from '@shared/types/src/pusher'
import type {
  CoachCardResponse,
  CoachCardCategory,
  TranscriptSegmentResponse,
  TriggerStatsResponse,
} from '@shared/types/src/requests/liveCoach'

// === Coach Card CRUD ===

export const createCoachCard = async (
  organizationId: string,
  createdById: string | null,
  data: {
    title: string
    category?: CoachCardCategory
    triggerPhrases: string[]
    content: string
    tips?: string[]
    sortOrder?: number
  },
): Promise<CoachCardResponse> => {
  const card = await db
    .insertInto('coach_card')
    .values({
      id: uuidv4(),
      organizationId,
      title: data.title,
      category: data.category ?? 'general',
      triggerPhrases: data.triggerPhrases,
      content: data.content,
      tips: data.tips ?? [],
      isActive: true,
      sortOrder: data.sortOrder ?? 0,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformCoachCard(card, null)
}

export const updateCoachCard = async (
  cardId: string,
  data: {
    title?: string
    category?: CoachCardCategory
    triggerPhrases?: string[]
    content?: string
    tips?: string[]
    isActive?: boolean
    sortOrder?: number
  },
): Promise<CoachCardResponse> => {
  const updated = await db
    .updateTable('coach_card')
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.triggerPhrases !== undefined && {
        triggerPhrases: data.triggerPhrases,
      }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.tips !== undefined && { tips: data.tips }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedAt: new Date(),
    })
    .where('id', '=', cardId)
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformCoachCard(updated, null)
}

export const deleteCoachCard = async (cardId: string): Promise<void> => {
  await db.deleteFrom('coach_card').where('id', '=', cardId).execute()
}

export const getCoachCard = async (
  cardId: string,
): Promise<CoachCardResponse | null> => {
  const card = await db
    .selectFrom('coach_card as cc')
    .leftJoin('user as u', 'u.id', 'cc.createdById')
    .where('cc.id', '=', cardId)
    .select([
      'cc.id',
      'cc.organizationId',
      'cc.title',
      'cc.category',
      'cc.triggerPhrases',
      'cc.content',
      'cc.tips',
      'cc.isActive',
      'cc.sortOrder',
      'cc.createdById',
      'cc.createdAt',
      'cc.updatedAt',
      'u.name as createdByName',
    ])
    .executeTakeFirst()

  if (!card) {
    return null
  }

  return transformCoachCard(card, card.createdByName)
}

export const listCoachCards = async (
  organizationId: string,
  filters: {
    category?: CoachCardCategory
    isActive?: boolean
  },
  pagination: { page: number; limit: number },
) => {
  let query = db
    .selectFrom('coach_card')
    .where('organizationId', '=', organizationId)

  if (filters.category) {
    query = query.where('category', '=', filters.category)
  }

  if (filters.isActive !== undefined) {
    query = query.where('isActive', '=', filters.isActive)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const cards = await query
    .selectAll()
    .orderBy('sortOrder', 'asc')
    .orderBy('title', 'asc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  return {
    data: cards.map((c) => transformCoachCard(c, null)),
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
  }
}

// === Live Phrase Matching ===

// Check transcript text against coach cards and trigger if match found
export const checkForTriggers = async (
  organizationId: string,
  callId: string,
  userId: string,
  text: string,
): Promise<void> => {
  // Get active coach cards for this org
  const cards = await db
    .selectFrom('coach_card')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .selectAll()
    .execute()

  const textLower = text.toLowerCase()

  for (const card of cards) {
    // Check each trigger phrase
    for (const phrase of card.triggerPhrases) {
      const phraseLower = phrase.toLowerCase()

      // Simple contains check - could be enhanced with fuzzy matching
      if (textLower.includes(phraseLower)) {
        // Calculate a simple confidence score based on match quality
        const confidence = phraseLower.length / textLower.length

        // Create trigger record
        const trigger = await db
          .insertInto('coach_card_trigger')
          .values({
            id: uuidv4(),
            coachCardId: card.id,
            callId,
            userId,
            triggerPhrase: phrase,
            confidence: confidence.toFixed(4),
            triggeredAt: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        // Emit the coach card to the rep via Pusher
        await pusherTrigger(
          channels.privateCall(callId),
          PUSHER_EVENTS.COACH_CARD_TRIGGERED,
          {
            callId,
            userId,
            triggerId: trigger.id,
            card: transformCoachCard(card, null),
            triggerPhrase: phrase,
            confidence,
          },
        )

        // Only trigger once per card per transcript segment
        break
      }
    }
  }
}

// Submit feedback on whether a triggered card was helpful
export const submitTriggerFeedback = async (
  triggerId: string,
  wasHelpful: boolean,
): Promise<void> => {
  await db
    .updateTable('coach_card_trigger')
    .set({ wasHelpful })
    .where('id', '=', triggerId)
    .execute()
}

// Get trigger statistics
export const getTriggerStats = async (
  organizationId: string,
  filters: {
    coachCardId?: string
    startDate?: Date
    endDate?: Date
  },
): Promise<TriggerStatsResponse> => {
  let query = db
    .selectFrom('coach_card_trigger as cct')
    .innerJoin('coach_card as cc', 'cc.id', 'cct.coachCardId')
    .where('cc.organizationId', '=', organizationId)

  if (filters.coachCardId) {
    query = query.where('cct.coachCardId', '=', filters.coachCardId)
  }
  if (filters.startDate) {
    query = query.where('cct.triggeredAt', '>=', filters.startDate)
  }
  if (filters.endDate) {
    query = query.where('cct.triggeredAt', '<=', filters.endDate)
  }

  // Get overall stats
  const overallStats = await query
    .select([
      sql<number>`COUNT(*)::int`.as('totalTriggers'),
      sql<number>`COUNT(*) FILTER (WHERE cct."wasHelpful" = true)::int`.as(
        'helpfulCount',
      ),
      sql<number>`COUNT(*) FILTER (WHERE cct."wasHelpful" = false)::int`.as(
        'notHelpfulCount',
      ),
      sql<number>`COUNT(*) FILTER (WHERE cct."wasHelpful" IS NULL)::int`.as(
        'pendingFeedbackCount',
      ),
    ])
    .executeTakeFirstOrThrow()

  // Get top trigger phrases
  const topPhrases = await query
    .groupBy('cct.triggerPhrase')
    .select([
      'cct.triggerPhrase as phrase',
      sql<number>`COUNT(*)::int`.as('count'),
    ])
    .orderBy(sql`COUNT(*)`, 'desc')
    .limit(10)
    .execute()

  // Get stats by card
  const cardStats = await query
    .groupBy(['cc.id', 'cc.title'])
    .select([
      'cc.id as cardId',
      'cc.title as cardTitle',
      sql<number>`COUNT(*)::int`.as('count'),
      sql<number>`COUNT(*) FILTER (WHERE cct."wasHelpful" = true)::int`.as(
        'helpfulCount',
      ),
      sql<number>`COUNT(*) FILTER (WHERE cct."wasHelpful" = false)::int`.as(
        'notHelpfulCount',
      ),
    ])
    .orderBy(sql`COUNT(*)`, 'desc')
    .execute()

  const helpfulRate =
    overallStats.helpfulCount + overallStats.notHelpfulCount > 0
      ? overallStats.helpfulCount /
        (overallStats.helpfulCount + overallStats.notHelpfulCount)
      : null

  return {
    organizationId,
    totalTriggers: overallStats.totalTriggers,
    helpfulCount: overallStats.helpfulCount,
    notHelpfulCount: overallStats.notHelpfulCount,
    pendingFeedbackCount: overallStats.pendingFeedbackCount,
    helpfulRate,
    topTriggerPhrases: topPhrases.map((p) => ({
      phrase: p.phrase,
      count: p.count,
    })),
    triggersByCard: cardStats.map((c) => ({
      cardId: c.cardId,
      cardTitle: c.cardTitle,
      count: c.count,
      helpfulRate:
        c.helpfulCount + c.notHelpfulCount > 0
          ? c.helpfulCount / (c.helpfulCount + c.notHelpfulCount)
          : null,
    })),
  }
}

// === Live Transcript Segments ===

export const addTranscriptSegment = async (
  callId: string,
  organizationId: string,
  segment: {
    speaker: 'rep' | 'prospect' | 'unknown'
    text: string
    confidence?: number
    startMs: number
    endMs: number
    isFinal: boolean
  },
): Promise<TranscriptSegmentResponse> => {
  const record = await db
    .insertInto('live_transcript_segment')
    .values({
      id: uuidv4(),
      callId,
      organizationId,
      speaker: segment.speaker,
      text: segment.text,
      confidence: segment.confidence?.toFixed(4) ?? null,
      startMs: segment.startMs,
      endMs: segment.endMs,
      isFinal: segment.isFinal,
      createdAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  const response: TranscriptSegmentResponse = {
    id: record.id,
    callId: record.callId,
    speaker: record.speaker as any,
    text: record.text,
    confidence: record.confidence ? Number(record.confidence) : null,
    startMs: record.startMs,
    endMs: record.endMs,
    isFinal: record.isFinal,
    createdAt: record.createdAt.toISOString(),
  }

  // Emit transcript update event
  await pusherTrigger(
    channels.privateCall(callId),
    PUSHER_EVENTS.TRANSCRIPT_UPDATE,
    {
      callId,
      segment: response,
    },
  )

  // If this is a final segment, check for coach card triggers
  if (segment.isFinal) {
    // Get the call to find the user
    const call = await db
      .selectFrom('call')
      .where('id', '=', callId)
      .select(['userId'])
      .executeTakeFirst()

    if (call) {
      await checkForTriggers(organizationId, callId, call.userId, segment.text)
    }
  }

  return response
}

export const getLiveTranscript = async (
  callId: string,
  afterMs: number = 0,
): Promise<TranscriptSegmentResponse[]> => {
  const segments = await db
    .selectFrom('live_transcript_segment')
    .where('callId', '=', callId)
    .where('startMs', '>=', afterMs)
    .selectAll()
    .orderBy('startMs', 'asc')
    .execute()

  return segments.map((s) => ({
    id: s.id,
    callId: s.callId,
    speaker: s.speaker as any,
    text: s.text,
    confidence: s.confidence ? Number(s.confidence) : null,
    startMs: s.startMs,
    endMs: s.endMs,
    isFinal: s.isFinal,
    createdAt: s.createdAt.toISOString(),
  }))
}

function transformCoachCard(
  card: any,
  createdByName: string | null,
): CoachCardResponse {
  return {
    id: card.id,
    organizationId: card.organizationId,
    title: card.title,
    category: card.category as CoachCardCategory,
    triggerPhrases: card.triggerPhrases,
    content: card.content,
    tips: card.tips,
    isActive: card.isActive,
    sortOrder: card.sortOrder,
    createdById: card.createdById,
    createdByName,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  }
}
