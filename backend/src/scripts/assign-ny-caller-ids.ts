/**
 * Assign known New York caller IDs to the correct reps.
 *
 * Rule requested for the current cutover:
 *   - 929 area code -> Ben Lorber
 *   - 646 area code -> Fox Lorber
 *
 * The script uses DB-known numbers from twilio_config.phoneNumbers,
 * phone_provisioning.phoneNumber, client_phone_number, and user_phone_number.
 * It is idempotent: rerunning it moves matching numbers to the expected user.
 * It also checks historical call rows and can backfill call.userId from the
 * caller ID area code: outbound uses fromNumber, inbound uses toNumber.
 *
 * Usage:
 *   pnpm tsx src/scripts/assign-ny-caller-ids.ts
 *   pnpm tsx src/scripts/assign-ny-caller-ids.ts --execute
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { Kysely, PostgresDialect, sql } from 'kysely'
import type { DB } from '@shared/db/src'
import { normalizePhone } from '@/lib/phone'

type TargetRule = {
  areaCode: string
  label: string
  matchesUser: (user: UserCandidate) => boolean
}

type UserCandidate = {
  id: string
  name: string | null
  email: string
}

type NumberCandidate = {
  organizationId: string
  phoneNumber: string
  friendlyName: string | null
}

type CallAttributionCandidate = {
  id: string
  organizationId: string
  userId: string
  userName: string | null
  direction: string
  fromNumber: string
  toNumber: string
  campaignId: string | null
  startedAt: Date
}

const normalizedIdentity = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? ''

const userMatchesFullNameOrEmail = (
  user: UserCandidate,
  firstName: string,
  lastName: string,
) => {
  const name = normalizedIdentity(user.name)
  const email = normalizedIdentity(user.email)
  const fullName = `${firstName} ${lastName}`.toLowerCase()
  const identityPattern = new RegExp(
    `${firstName}.*${lastName}|${lastName}.*${firstName}`,
    'i',
  )

  return name === fullName || identityPattern.test(email)
}

const targetRules: TargetRule[] = [
  {
    areaCode: '929',
    label: 'Ben Lorber',
    matchesUser: (user) => userMatchesFullNameOrEmail(user, 'ben', 'lorber'),
  },
  {
    areaCode: '646',
    label: 'Fox Lorber',
    matchesUser: (user) => userMatchesFullNameOrEmail(user, 'fox', 'lorber'),
  },
]

const loadEnv = () => {
  const rootDir = path.resolve(__dirname, '../../..')
  const envFiles = [
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, 'backend/.env'),
    path.join(rootDir, 'backend/.env.local'),
  ]

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: true })
    }
  }
}

loadEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to assign caller IDs')
}

const shouldUseSsl = (() => {
  const sslMode = process.env.DB_SSL_MODE
  if (sslMode === 'disable') return false
  if (sslMode === 'require') return true

  try {
    const host = new URL(databaseUrl).hostname
    return host.endsWith('.supabase.com') || host.endsWith('.supabase.co')
  } catch {
    return false
  }
})()

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      }
    : undefined,
})

const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
})

const getAreaCode = (phoneNumber: string): string | null => {
  const digits = normalizePhone(phoneNumber)
  const nationalNumber =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

  return nationalNumber.length >= 10 ? nationalNumber.slice(0, 3) : null
}

const uniqueNumbers = (numbers: NumberCandidate[]): NumberCandidate[] => {
  const seen = new Set<string>()

  return numbers.filter((number) => {
    const key = `${number.organizationId}:${normalizePhone(number.phoneNumber)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const getDbKnownNumbers = async (): Promise<NumberCandidate[]> => {
  const [configs, provisionedNumbers, clientNumbers, userNumbers] =
    await Promise.all([
      db
        .selectFrom('twilio_config')
        .select(['organizationId', 'phoneNumbers'])
        .execute(),
      db
        .selectFrom('phone_provisioning')
        .select(['organizationId', 'phoneNumber'])
        .where('phoneNumber', 'is not', null)
        .execute(),
      db
        .selectFrom('client_phone_number')
        .select(['organizationId', 'phoneNumber', 'friendlyName'])
        .execute(),
      db
        .selectFrom('user_phone_number')
        .select(['organizationId', 'phoneNumber', 'friendlyName'])
        .execute(),
    ])

  return uniqueNumbers([
    ...configs.flatMap((config) =>
      (config.phoneNumbers ?? []).map((phoneNumber) => ({
        organizationId: config.organizationId,
        phoneNumber,
        friendlyName: null,
      })),
    ),
    ...provisionedNumbers
      .filter(
        (number): number is typeof number & { phoneNumber: string } =>
          typeof number.phoneNumber === 'string',
      )
      .map((number) => ({
        organizationId: number.organizationId,
        phoneNumber: number.phoneNumber,
        friendlyName: null,
      })),
    ...clientNumbers,
    ...userNumbers,
  ])
}

const getCallAttributionCandidates = async (): Promise<
  CallAttributionCandidate[]
> => {
  const rows = await db
    .selectFrom('call as c')
    .innerJoin('twilio_config as tc', 'tc.id', 'c.twilioConfigId')
    .leftJoin('user as u', 'u.id', 'c.userId')
    .where((eb) =>
      eb.or([
        sql<boolean>`regexp_replace(
          case when c."direction" = 'inbound' then c."toNumber" else c."fromNumber" end,
          '[^0-9]',
          '',
          'g'
        ) like '1646%'`,
        sql<boolean>`regexp_replace(
          case when c."direction" = 'inbound' then c."toNumber" else c."fromNumber" end,
          '[^0-9]',
          '',
          'g'
        ) like '1929%'`,
        sql<boolean>`regexp_replace(
          case when c."direction" = 'inbound' then c."toNumber" else c."fromNumber" end,
          '[^0-9]',
          '',
          'g'
        ) like '646%'`,
        sql<boolean>`regexp_replace(
          case when c."direction" = 'inbound' then c."toNumber" else c."fromNumber" end,
          '[^0-9]',
          '',
          'g'
        ) like '929%'`,
      ]),
    )
    .select([
      'c.id',
      'tc.organizationId',
      'c.userId',
      'u.name as userName',
      'c.direction',
      'c.fromNumber',
      'c.toNumber',
      'c.campaignId',
      'c.startedAt',
    ])
    .orderBy('c.startedAt', 'desc')
    .execute()

  return rows.filter((call) => {
    const callerId =
      call.direction === 'inbound' ? call.toNumber : call.fromNumber
    return targetRules.some((rule) => rule.areaCode === getAreaCode(callerId))
  })
}

const findTargetUser = async (
  organizationId: string,
  rule: TargetRule,
): Promise<UserCandidate | null> => {
  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .where('member.organizationId', '=', organizationId)
    .select(['user.id', 'user.name', 'user.email'])
    .execute()

  const matches = members.filter(rule.matchesUser)
  if (matches.length === 1) {
    return matches[0]
  }

  const reason = matches.length === 0 ? 'not found' : 'ambiguous'
  console.log(
    `  ${rule.areaCode} -> ${rule.label}: user ${reason} in org ${organizationId}`,
  )
  return null
}

const findUserPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  return db
    .selectFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('phoneNumber', '=', phoneNumber)
    .selectAll()
    .executeTakeFirst()
}

const reconcileCallAttribution = async (
  calls: CallAttributionCandidate[],
  targetUsers: Map<string, UserCandidate | null>,
  execute: boolean,
) => {
  let corrected = 0
  let skipped = 0
  let alreadyCorrect = 0

  if (calls.length === 0) {
    console.log('\nNo 929 or 646 call rows found for attribution checks.')
    return { corrected, skipped, alreadyCorrect }
  }

  console.log(`\nCall attribution check: ${calls.length} row(s) scanned`)

  for (const call of calls) {
    const callerId =
      call.direction === 'inbound' ? call.toNumber : call.fromNumber
    const areaCode = getAreaCode(callerId)
    const rule = targetRules.find((target) => target.areaCode === areaCode)
    if (!rule) continue

    const user = targetUsers.get(`${call.organizationId}:${rule.areaCode}`)
    if (!user) {
      skipped++
      console.log(
        `  skip call ${call.id} (${callerId}) - ${rule.label} unavailable`,
      )
      continue
    }

    if (call.userId === user.id) {
      alreadyCorrect++
      continue
    }

    const campaign = call.campaignId ? ` campaign=${call.campaignId}` : ''
    const action = execute ? 'correct' : 'would correct'
    console.log(
      `  ${action} call ${call.id}${campaign} ${call.direction} ${callerId}: ` +
        `${call.userName ?? call.userId} -> ${user.name ?? user.email}`,
    )

    if (execute) {
      await db
        .updateTable('call')
        .set({ userId: user.id, updatedAt: new Date() })
        .where('id', '=', call.id)
        .executeTakeFirst()
    }

    corrected++
  }

  console.log(
    `${corrected} call row(s) ${execute ? 'corrected' : 'need correction'}` +
      (alreadyCorrect ? `, ${alreadyCorrect} already correct` : '') +
      (skipped ? `, ${skipped} skipped` : ''),
  )

  return { corrected, skipped, alreadyCorrect }
}

const assignUserPhoneNumber = async (data: {
  organizationId: string
  userId: string
  phoneNumber: string
  friendlyName?: string
}) => {
  const now = new Date()

  return db
    .insertInto('user_phone_number')
    .values({
      id: randomUUID(),
      organizationId: data.organizationId,
      userId: data.userId,
      phoneNumber: data.phoneNumber,
      friendlyName: data.friendlyName ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['organizationId', 'phoneNumber']).doUpdateSet({
        userId: data.userId,
        friendlyName: data.friendlyName ?? null,
        updatedAt: now,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

const main = async () => {
  const execute = process.argv.includes('--execute')
  console.log(`NY caller ID assignment - ${execute ? 'EXECUTE' : 'DRY RUN'}\n`)

  const candidates = (await getDbKnownNumbers()).filter((number) =>
    targetRules.some(
      (rule) => rule.areaCode === getAreaCode(number.phoneNumber),
    ),
  )
  const callCandidates = await getCallAttributionCandidates()

  if (candidates.length === 0 && callCandidates.length === 0) {
    console.log('No 929 or 646 caller IDs or call rows found.')
    return
  }

  const targetUsers = new Map<string, UserCandidate | null>()
  const organizationIds = new Set([
    ...candidates.map((c) => c.organizationId),
    ...callCandidates.map((c) => c.organizationId),
  ])
  for (const organizationId of organizationIds) {
    for (const rule of targetRules) {
      targetUsers.set(
        `${organizationId}:${rule.areaCode}`,
        await findTargetUser(organizationId, rule),
      )
    }
  }

  let assigned = 0
  let skipped = 0

  if (candidates.length === 0) {
    console.log('No 929 or 646 caller IDs found in DB-known phone numbers.')
  }

  for (const candidate of candidates) {
    const areaCode = getAreaCode(candidate.phoneNumber)
    const rule = targetRules.find((target) => target.areaCode === areaCode)
    if (!rule) continue

    const user = targetUsers.get(`${candidate.organizationId}:${rule.areaCode}`)
    if (!user) {
      skipped++
      console.log(
        `  skip ${candidate.phoneNumber} (${candidate.organizationId}) - ${rule.label} unavailable`,
      )
      continue
    }

    const existing = await findUserPhoneNumber(
      candidate.organizationId,
      candidate.phoneNumber,
    )
    const currentOwner =
      existing && existing.userId !== user.id ? ` from ${existing.userId}` : ''
    const action =
      existing?.userId === user.id
        ? 'keep'
        : execute
          ? 'assign'
          : 'would assign'

    console.log(
      `  ${action} ${candidate.phoneNumber}${currentOwner} -> ${user.name ?? user.email}`,
    )

    if (execute && existing?.userId !== user.id) {
      await assignUserPhoneNumber({
        organizationId: candidate.organizationId,
        userId: user.id,
        phoneNumber: candidate.phoneNumber,
        friendlyName: candidate.friendlyName ?? undefined,
      })
    }

    assigned++
  }

  console.log(
    `\n${assigned} matching number(s) ${execute ? 'processed' : 'planned'}` +
      (skipped ? `, ${skipped} skipped` : ''),
  )

  await reconcileCallAttribution(callCandidates, targetUsers, execute)

  if (!execute) {
    console.log('\nDry run - re-run with --execute to apply.')
  }
}

main()
  .catch((error) => {
    console.error('NY caller ID assignment failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.destroy().catch(() => {})
  })
