/**
 * One-time migration script to encrypt existing plaintext OAuth tokens
 * in the `integration` table.
 *
 * Usage: npx tsx src/scripts/encrypt-integration-tokens.ts
 *
 * Safe to run multiple times - skips already-encrypted tokens.
 */

import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'

function isEncrypted(token: string): boolean {
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return false
  try {
    decrypt(token)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log('Starting integration token encryption migration...')

  const integrations = await db
    .selectFrom('integration')
    .select(['id', 'provider', 'accessToken', 'refreshToken'])
    .execute()

  let updated = 0
  let skipped = 0

  for (const integration of integrations) {
    let needsUpdate = false
    const updates: Record<string, string> = {}

    if (integration.accessToken && !isEncrypted(integration.accessToken)) {
      updates.accessToken = encrypt(integration.accessToken)
      needsUpdate = true
    }

    if (integration.refreshToken && !isEncrypted(integration.refreshToken)) {
      updates.refreshToken = encrypt(integration.refreshToken)
      needsUpdate = true
    }

    if (needsUpdate) {
      await db
        .updateTable('integration')
        .set(updates)
        .where('id', '=', integration.id)
        .execute()
      updated++
      console.log(
        `  Encrypted tokens for integration ${integration.id} (${integration.provider})`,
      )
    } else {
      skipped++
    }
  }

  console.log(
    `Done. Updated: ${updated}, Skipped (already encrypted or no tokens): ${skipped}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
