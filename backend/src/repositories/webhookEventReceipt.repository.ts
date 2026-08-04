import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export type WebhookReceiptStatus = 'processing' | 'processed' | 'failed'

export interface ClaimWebhookEventInput {
  provider: string
  eventId: string
  eventType?: string
  hash?: string
}

export type ClaimWebhookEventResult =
  | {
      status: 'claimed'
      isReplay: false
      hashMismatch: false
    }
  | {
      status: 'claimed_retry'
      isReplay: true
      hashMismatch: boolean
    }
  | {
      status: 'duplicate_processed'
      isReplay: true
      hashMismatch: boolean
    }
  | {
      status: 'duplicate_processing'
      isReplay: true
      hashMismatch: boolean
    }

export const claimForProcessing = async (
  input: ClaimWebhookEventInput,
): Promise<ClaimWebhookEventResult> => {
  const now = new Date()
  const insertResult = await db
    .insertInto('webhook_event_receipt')
    .values({
      id: uuidv4(),
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType ?? null,
      status: 'processing',
      hash: input.hash ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) => oc.columns(['provider', 'eventId']).doNothing())
    .execute()

  const inserted = Number(insertResult[0]?.numInsertedOrUpdatedRows ?? 0) > 0
  if (inserted) {
    return { status: 'claimed', isReplay: false, hashMismatch: false }
  }

  const existing = await db
    .selectFrom('webhook_event_receipt')
    .select(['status', 'hash'])
    .where('provider', '=', input.provider)
    .where('eventId', '=', input.eventId)
    .executeTakeFirst()

  // Best-effort fallback if we couldn't read the existing row after conflict.
  if (!existing) {
    return {
      status: 'duplicate_processing',
      isReplay: true,
      hashMismatch: false,
    }
  }

  const hashMismatch =
    !!existing.hash && !!input.hash && existing.hash !== input.hash

  await db
    .updateTable('webhook_event_receipt')
    .set({
      updatedAt: now,
    })
    .where('provider', '=', input.provider)
    .where('eventId', '=', input.eventId)
    .execute()

  if (existing.status === 'processed') {
    return { status: 'duplicate_processed', isReplay: true, hashMismatch }
  }

  if (existing.status === 'failed') {
    const retryClaim = await db
      .updateTable('webhook_event_receipt')
      .set({
        status: 'processing',
        eventType: input.eventType ?? null,
        hash: input.hash ?? null,
        processedAt: null,
        updatedAt: now,
      })
      .where('provider', '=', input.provider)
      .where('eventId', '=', input.eventId)
      .where('status', '=', 'failed')
      .executeTakeFirst()

    if (Number(retryClaim.numUpdatedRows ?? 0) > 0) {
      return { status: 'claimed_retry', isReplay: true, hashMismatch }
    }
  }

  return { status: 'duplicate_processing', isReplay: true, hashMismatch }
}

export const markProcessed = async (provider: string, eventId: string) => {
  const now = new Date()
  await db
    .updateTable('webhook_event_receipt')
    .set({
      status: 'processed',
      processedAt: now,
      updatedAt: now,
    })
    .where('provider', '=', provider)
    .where('eventId', '=', eventId)
    .execute()
}

export const markFailed = async (provider: string, eventId: string) => {
  const now = new Date()
  await db
    .updateTable('webhook_event_receipt')
    .set({
      status: 'failed',
      processedAt: now,
      updatedAt: now,
    })
    .where('provider', '=', provider)
    .where('eventId', '=', eventId)
    .execute()
}
