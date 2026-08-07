/**
 * Backfill lead timezones using the offline resolver.
 *
 * The dialer's timezone priority ordering only works if leads actually carry a
 * timezone — a null sinks a lead into the lowest ORDER BY bucket regardless of
 * where the prospect really is. This script populates `lead.timezone` for every
 * lead we can place from data already in the database (custom fields + phone
 * area code), with no API calls and no cost.
 *
 * Usage:
 *   pnpm --filter backend backfill:timezones                 # dry run, prints coverage
 *   pnpm --filter backend backfill:timezones --execute       # writes results
 *   pnpm --filter backend backfill:timezones --execute --force
 *       # also re-resolves leads that already have a timezone or a failed attempt
 *   pnpm --filter backend backfill:timezones --org <organizationId>
 */

import { db } from '@/lib/db'
import {
  resolveTimezoneOffline,
  type TimezoneSource,
} from '@/lib/timezoneResolver'

interface Args {
  execute: boolean
  force: boolean
  organizationId?: string
}

const parseArgs = (): Args => {
  const argv = process.argv.slice(2)
  const orgIndex = argv.indexOf('--org')

  return {
    execute: argv.includes('--execute'),
    force: argv.includes('--force'),
    organizationId: orgIndex >= 0 ? argv[orgIndex + 1] : undefined,
  }
}

const BATCH_SIZE = 500

const main = async () => {
  const { execute, force, organizationId } = parseArgs()

  console.log(
    `Lead timezone backfill — ${execute ? 'EXECUTE' : 'DRY RUN'}${force ? ' (force re-resolve)' : ''}`,
  )
  if (organizationId) console.log(`Scoped to organization ${organizationId}`)
  console.log('')

  let query = db
    .selectFrom('lead')
    .select([
      'id',
      'organizationId',
      'phone',
      'normalizedPhone',
      'customFields',
      'timezone',
      'timezoneResolvedAt',
    ])
    .where('deletedAt', 'is', null)

  if (organizationId) {
    query = query.where('organizationId', '=', organizationId)
  }

  // Without --force, only touch leads that have no timezone yet. Leads whose
  // previous resolution attempt failed are included: those attempts ran against
  // APIs that are now returning errors, so their null is not authoritative.
  if (!force) {
    query = query.where('timezone', 'is', null)
  }

  const leads = await query.execute()
  console.log(`Loaded ${leads.length} candidate leads\n`)

  const bySource = new Map<TimezoneSource, number>()
  const byTimezone = new Map<string, number>()
  const updates: Array<{
    id: string
    organizationId: string
    timezone: string
  }> = []
  let unresolved = 0
  let changed = 0

  for (const lead of leads) {
    const result = resolveTimezoneOffline({
      customFields: lead.customFields,
      phone: lead.phone,
      normalizedPhone: lead.normalizedPhone,
    })

    if (!result.timezone) {
      unresolved++
      continue
    }

    bySource.set(result.source!, (bySource.get(result.source!) ?? 0) + 1)
    byTimezone.set(result.timezone, (byTimezone.get(result.timezone) ?? 0) + 1)

    if (lead.timezone !== result.timezone) changed++

    updates.push({
      id: lead.id,
      organizationId: lead.organizationId,
      timezone: result.timezone,
    })
  }

  const pct = (n: number) =>
    leads.length ? `${((n / leads.length) * 100).toFixed(1)}%` : '0%'

  console.log('Resolved by signal:')
  for (const [source, count] of [...bySource.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(
      `  ${source.padEnd(26)} ${String(count).padStart(6)}  ${pct(count)}`,
    )
  }
  console.log(
    `  ${'(unresolved)'.padEnd(26)} ${String(unresolved).padStart(6)}  ${pct(unresolved)}`,
  )
  console.log('')

  console.log('Top resolved timezones:')
  for (const [timezone, count] of [...byTimezone.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)) {
    console.log(`  ${timezone.padEnd(32)} ${String(count).padStart(6)}`)
  }
  console.log('')

  console.log(
    `${updates.length} leads resolvable (${changed} would change value)`,
  )

  if (!execute) {
    console.log('\nDry run — no writes. Re-run with --execute to apply.')
    await db.destroy()
    return
  }

  console.log('\nWriting...')
  const now = new Date()
  let written = 0

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)

    // Group by timezone so each distinct value is a single UPDATE ... IN (...)
    const byValue = new Map<string, string[]>()
    for (const update of batch) {
      const ids = byValue.get(update.timezone) ?? []
      ids.push(update.id)
      byValue.set(update.timezone, ids)
    }

    for (const [timezone, ids] of byValue) {
      await db
        .updateTable('lead')
        .set({ timezone, timezoneResolvedAt: now, updatedAt: now })
        .where('id', 'in', ids)
        .execute()
      written += ids.length
    }

    console.log(
      `  ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`,
    )
  }

  console.log(`\nDone. Updated ${written} leads.`)
  await db.destroy()
}

main().catch(async (error) => {
  console.error('Backfill failed:', error)
  await db.destroy().catch(() => {})
  process.exit(1)
})
