/**
 * Recover voicemail recordings that Telnyx captured but the app never stored.
 *
 * The <Record> verb originally only set `action`, which does not fire when the
 * caller hangs up — the normal way a voicemail ends. The audio was recorded and
 * retained by Telnyx, but the webhook that writes `recordingUrl` never arrived,
 * so the call row stayed blank and the voicemail never appeared in the inbox
 * (which requires both `voicemailLeft` and a non-null `recordingUrl`).
 *
 * This script re-pairs Telnyx's stored recordings with their call rows, only
 * considering recordings Telnyx attributes to the Record verb.
 *
 * Matching is on `call_control_id` ONLY — deliberately. A from/to + time-window
 * fallback is tempting but unsafe here: `call.createdAt` is a naive
 * `timestamp without time zone` that the pg driver reads as local time, so it
 * is skewed from Telnyx's UTC by the host's offset. Worse, one caller hitting
 * the same number repeatedly produces several indistinguishable candidates, and
 * a wrong pair attaches one person's voicemail to another's call. Recordings
 * that cannot be matched exactly are reported for manual review instead.
 *
 * Storing `recordingSid` matters as much as the URL: Telnyx media URLs are
 * presigned and expire in ~10 minutes, and the playback proxy re-resolves a
 * fresh URL from the sid when the stored one goes stale.
 *
 * Usage:
 *   pnpm tsx src/scripts/recover-voicemail-recordings.ts             # dry run
 *   pnpm tsx src/scripts/recover-voicemail-recordings.ts --execute
 */

import { db } from '@/lib/db'
import { decryptApiKey } from '@/lib/encryption'

interface TelnyxRecording {
  id: string
  call_control_id?: string
  call_leg_id?: string
  from?: string
  to?: string
  initiated_by?: string
  duration_millis?: number
  recording_started_at?: string
  created_at?: string
  download_urls?: { mp3?: string; wav?: string }
}

/** Recordings created by the <Record> verb are voicemails; call recordings aren't. */
const RECORD_VERB = 'RecordVerb'

const main = async () => {
  const execute = process.argv.includes('--execute')
  console.log(`Voicemail recovery — ${execute ? 'EXECUTE' : 'DRY RUN'}\n`)

  const configs = await db
    .selectFrom('twilio_config')
    .select(['id', 'accountSid', 'authTokenEncrypted'])
    .execute()

  let totalRecovered = 0
  let unmatched = 0

  for (const cfg of configs) {
    const apiKey = decryptApiKey(cfg.authTokenEncrypted)

    const res = await fetch(
      'https://api.telnyx.com/v2/recordings?page[size]=250',
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    if (!res.ok) {
      console.log(`  !! Telnyx /recordings failed: ${res.status}`)
      continue
    }

    const body = (await res.json()) as { data?: TelnyxRecording[] }
    const voicemailRecordings = (body.data ?? []).filter(
      (r) => r.initiated_by === RECORD_VERB,
    )

    console.log(
      `Telnyx holds ${voicemailRecordings.length} Record-verb (voicemail) recording(s)\n`,
    )

    // Calls that should have a voicemail but have no audio stored.
    const orphanCalls = await db
      .selectFrom('call')
      .select([
        'id',
        'twilioCallSid',
        'fromNumber',
        'toNumber',
        'createdAt',
        'voicemailLeft',
        'recordingUrl',
      ])
      .where('twilioConfigId', '=', cfg.id)
      .where('direction', '=', 'inbound')
      .where('recordingUrl', 'is', null)
      .execute()

    console.log(
      `${orphanCalls.length} inbound call(s) with no stored recording\n`,
    )

    for (const rec of voicemailRecordings) {
      const mp3 = rec.download_urls?.mp3
      if (!mp3) continue

      const match = orphanCalls.find(
        (c) => c.twilioCallSid && c.twilioCallSid === rec.call_control_id,
      )

      if (!match) {
        console.log(
          `  UNMATCHED — needs manual review: recording ${rec.id} (${rec.from} → ${rec.to} @ ${rec.recording_started_at})`,
        )
        unmatched++
        continue
      }

      const seconds = Math.round((rec.duration_millis ?? 0) / 1000)
      console.log(
        `  ${rec.from} → ${rec.to}  ${seconds}s  recording ${rec.id} → call ${match.id}`,
      )

      if (execute) {
        await db
          .updateTable('call')
          .set({
            recordingUrl: mp3,
            recordingSid: rec.id,
            voicemailLeft: true,
            duration: seconds || undefined,
            updatedAt: new Date(),
          })
          .where('id', '=', match.id)
          .execute()
      }
      totalRecovered++
    }
  }

  console.log(
    `\n${totalRecovered} voicemail(s) ${execute ? 'recovered' : 'recoverable'}` +
      (unmatched ? `, ${unmatched} unmatched (manual review)` : '') +
      '.',
  )
  if (!execute) console.log('Dry run — re-run with --execute to apply.')

  await db.destroy()
}

main().catch(async (error) => {
  console.error('Recovery failed:', error)
  await db.destroy().catch(() => {})
  process.exit(1)
})
