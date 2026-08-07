/**
 * Move caller-ID assignments from clients to individual reps.
 *
 * Numbers used to be assigned per client (client_phone_number), so every rep
 * working that client shared the pool and two of them could dial from the same
 * number at once. Ownership now sits on user_phone_number, one owner per number.
 *
 * A client's numbers can only be handed to a rep when exactly one rep is
 * assigned to that client (client_user_assignment). Anything ambiguous — no rep,
 * or several — is reported rather than guessed: picking wrongly would hand a rep
 * a caller ID that isn't theirs, which is the failure this migration exists to
 * remove. Report those and assign them by hand in Settings > Phone Numbers.
 *
 * client_phone_number is left untouched so this can be re-run and so the old
 * data is still there if the cutover needs backing out.
 *
 * Usage:
 *   pnpm tsx src/scripts/migrate-phone-numbers-to-users.ts            # dry run
 *   pnpm tsx src/scripts/migrate-phone-numbers-to-users.ts --execute
 */

import { db } from '@/lib/db'
import * as userPhoneNumberRepo from '@/repositories/userPhoneNumber.repository'

const main = async () => {
  const execute = process.argv.includes('--execute')
  console.log(`Phone number migration — ${execute ? 'EXECUTE' : 'DRY RUN'}\n`)

  const assignments = await db
    .selectFrom('client_phone_number as cpn')
    .innerJoin('client as c', 'c.id', 'cpn.clientId')
    .select([
      'cpn.organizationId',
      'cpn.clientId',
      'cpn.phoneNumber',
      'cpn.friendlyName',
      'c.name as clientName',
    ])
    .orderBy('cpn.createdAt', 'asc')
    .execute()

  console.log(`${assignments.length} client number assignment(s) to migrate\n`)

  let migrated = 0
  let alreadyOwned = 0
  const needsManual: string[] = []

  for (const assignment of assignments) {
    const reps = await db
      .selectFrom('client_user_assignment')
      .where('clientId', '=', assignment.clientId)
      .select(['userId'])
      .execute()

    const existing = await userPhoneNumberRepo.findByPhoneNumber(
      assignment.organizationId,
      assignment.phoneNumber,
    )
    if (existing) {
      console.log(
        `  ${assignment.phoneNumber}  already owned by ${existing.userId} — skipping`,
      )
      alreadyOwned++
      continue
    }

    if (reps.length !== 1) {
      const why =
        reps.length === 0
          ? 'no rep assigned to this client'
          : `${reps.length} reps assigned to this client`
      console.log(
        `  ${assignment.phoneNumber}  (${assignment.clientName}) — NEEDS MANUAL ASSIGNMENT: ${why}`,
      )
      needsManual.push(`${assignment.phoneNumber} (${assignment.clientName})`)
      continue
    }

    const userId = reps[0].userId
    console.log(
      `  ${assignment.phoneNumber}  (${assignment.clientName}) -> user ${userId}`,
    )

    if (execute) {
      await userPhoneNumberRepo.assign({
        organizationId: assignment.organizationId,
        userId,
        phoneNumber: assignment.phoneNumber,
        friendlyName: assignment.friendlyName ?? undefined,
      })
    }
    migrated++
  }

  console.log(
    `\n${migrated} ${execute ? 'migrated' : 'migratable'}` +
      (alreadyOwned ? `, ${alreadyOwned} already owned` : '') +
      (needsManual.length
        ? `, ${needsManual.length} need manual assignment`
        : ''),
  )

  if (needsManual.length) {
    console.log('\nAssign these by hand in Settings > Phone Numbers:')
    for (const entry of needsManual) console.log(`  - ${entry}`)
    console.log(
      '\nUntil assigned, no rep can dial from them — the server rejects a call\n' +
        'from an unowned caller ID.',
    )
  }

  if (!execute) console.log('\nDry run — re-run with --execute to apply.')

  await db.destroy()
}

main().catch(async (error) => {
  console.error('Migration failed:', error)
  await db.destroy().catch(() => {})
  process.exit(1)
})
