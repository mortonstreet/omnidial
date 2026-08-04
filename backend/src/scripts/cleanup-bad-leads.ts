/**
 * Cleanup script for removing leads with bad imports (e.g., "linkedin urk" typo)
 *
 * This script:
 * 1. Finds leads with a specific custom field key (indicating bad import)
 * 2. Shows how many leads will be affected
 * 3. Optionally shows call history that will be preserved
 * 4. Deletes the leads (hard delete - CASCADE removes from campaigns and lists)
 * 5. Call records are preserved (no FK constraint)
 *
 * Usage:
 *   pnpm tsx backend/src/scripts/cleanup-bad-leads.ts --org <organizationId> --field "linkedin urk"
 *   pnpm tsx backend/src/scripts/cleanup-bad-leads.ts --org <organizationId> --field "linkedin urk" --dry-run
 *   pnpm tsx backend/src/scripts/cleanup-bad-leads.ts --org <organizationId> --field "linkedin urk" --execute
 */

import { Pool } from 'pg'
import { Kysely, PostgresDialect, sql, type SqlBool } from 'kysely'
import { DB } from '@shared/db/src'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import readline from 'readline'

// Load environment variables - try multiple paths
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../../.env'),
]
const possibleEnvLocalPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '../.env.local'),
  path.resolve(__dirname, '../../../.env.local'),
]

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}
for (const envLocalPath of possibleEnvLocalPaths) {
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true })
    break
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const getArg = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return undefined
  return args[index + 1]
}

const organizationId = getArg('org')
const customFieldKey = getArg('field') || 'linkedin urk'
const dryRun = args.includes('--dry-run')
const execute = args.includes('--execute')

if (!organizationId) {
  console.error(
    'Usage: pnpm tsx backend/src/scripts/cleanup-bad-leads.ts --org <organizationId> --field "linkedin urk" [--dry-run | --execute]',
  )
  console.error('')
  console.error('Options:')
  console.error('  --org <id>       Organization ID (required)')
  console.error(
    '  --field <name>   Custom field key to search for (default: "linkedin urk")',
  )
  console.error(
    '  --dry-run        Show what would be deleted without making changes',
  )
  console.error(
    '  --execute        Execute the deletion without confirmation prompt',
  )
  process.exit(1)
}

// Create database connection
const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 5,
    }),
  }),
})

async function findLeadsByCustomField(orgId: string, fieldKey: string) {
  const leads = await db
    .selectFrom('lead')
    .where('organizationId', '=', orgId)
    .where('deletedAt', 'is', null)
    .where(sql<SqlBool>`"customFields"::jsonb ? ${fieldKey}`)
    .select([
      'id',
      'phone',
      'firstName',
      'lastName',
      'company',
      'customFields',
      'createdAt',
    ])
    .execute()

  return leads
}

async function countCallsForLeads(leadIds: string[]) {
  if (leadIds.length === 0) return 0

  const result = await db
    .selectFrom('call')
    .where('leadId', 'in', leadIds)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  return Number(result.count)
}

async function countCampaignLeadsForLeads(leadIds: string[]) {
  if (leadIds.length === 0) return 0

  const result = await db
    .selectFrom('campaign_lead')
    .where('leadId', 'in', leadIds)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  return Number(result.count)
}

async function countListEntriesForLeads(leadIds: string[]) {
  if (leadIds.length === 0) return 0

  const result = await db
    .selectFrom('lead_list_entry')
    .where('leadId', 'in', leadIds)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  return Number(result.count)
}

async function bulkHardDeleteLeads(orgId: string, leadIds: string[]) {
  if (leadIds.length === 0) return 0

  const result = await db
    .deleteFrom('lead')
    .where('id', 'in', leadIds)
    .where('organizationId', '=', orgId)
    .executeTakeFirst()

  return Number(result.numDeletedRows)
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function main() {
  console.log('========================================')
  console.log('Lead Cleanup Script')
  console.log('========================================')
  console.log('')
  console.log(`Organization ID: ${organizationId}`)
  console.log(`Custom field to find: "${customFieldKey}"`)
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (no changes)' : execute ? 'EXECUTE (will delete)' : 'INTERACTIVE'}`,
  )
  console.log('')

  try {
    // Find affected leads
    console.log('Searching for affected leads...')
    const leads = await findLeadsByCustomField(organizationId!, customFieldKey)

    if (leads.length === 0) {
      console.log(`\nNo leads found with custom field "${customFieldKey}"`)
      await db.destroy()
      process.exit(0)
    }

    console.log(
      `\nFound ${leads.length} leads with custom field "${customFieldKey}"`,
    )

    // Show sample of leads
    console.log('\nSample leads (first 10):')
    console.log('----------------------------------------')
    leads.slice(0, 10).forEach((lead) => {
      const name =
        [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '(no name)'
      const customFields =
        typeof lead.customFields === 'string'
          ? JSON.parse(lead.customFields)
          : lead.customFields
      console.log(
        `  - ${lead.phone} | ${name} | ${lead.company || '(no company)'} | customFields: ${JSON.stringify(customFields)}`,
      )
    })
    if (leads.length > 10) {
      console.log(`  ... and ${leads.length - 10} more`)
    }

    const leadIds = leads.map((l) => l.id)

    // Count related records
    console.log('\nAnalyzing related records...')
    const [callCount, campaignLeadCount, listEntryCount] = await Promise.all([
      countCallsForLeads(leadIds),
      countCampaignLeadsForLeads(leadIds),
      countListEntriesForLeads(leadIds),
    ])

    console.log('\n========================================')
    console.log('IMPACT SUMMARY')
    console.log('========================================')
    console.log(`Leads to delete:              ${leads.length}`)
    console.log(
      `Campaign associations:        ${campaignLeadCount} (will be CASCADE deleted)`,
    )
    console.log(
      `List entries:                 ${listEntryCount} (will be CASCADE deleted)`,
    )
    console.log(
      `Call records:                 ${callCount} (will be PRESERVED)`,
    )
    console.log('========================================')

    if (dryRun) {
      console.log('\n[DRY RUN] No changes made.')
      await db.destroy()
      process.exit(0)
    }

    // Confirm deletion
    let shouldDelete = execute
    if (!execute) {
      console.log('')
      shouldDelete = await askConfirmation(
        'Do you want to DELETE these leads? (y/N): ',
      )
    }

    if (!shouldDelete) {
      console.log('\nOperation cancelled.')
      await db.destroy()
      process.exit(0)
    }

    // Perform deletion
    console.log('\nDeleting leads...')
    const deleted = await bulkHardDeleteLeads(organizationId!, leadIds)

    console.log(`\nSuccessfully deleted ${deleted} leads.`)
    console.log(
      'Campaign associations and list entries have been CASCADE deleted.',
    )
    console.log(`${callCount} call records have been preserved.`)
  } catch (error) {
    console.error('\nError:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
