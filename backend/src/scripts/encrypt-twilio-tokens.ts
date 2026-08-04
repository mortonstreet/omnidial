/**
 * One-time migration script to encrypt existing plaintext authToken values
 * in the `twilio_config` table.
 *
 * Usage: npx tsx src/scripts/encrypt-twilio-tokens.ts
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
  console.log('Starting Twilio auth token encryption migration...')

  const configs = await db
    .selectFrom('twilio_config')
    .select(['id', 'authTokenEncrypted'])
    .execute()

  let updated = 0
  let skipped = 0

  for (const config of configs) {
    if (!config.authTokenEncrypted) {
      skipped++
      continue
    }

    if (isEncrypted(config.authTokenEncrypted)) {
      skipped++
      continue
    }

    // Token is plaintext - encrypt it
    const encrypted = encrypt(config.authTokenEncrypted)
    await db
      .updateTable('twilio_config')
      .set({ authTokenEncrypted: encrypted })
      .where('id', '=', config.id)
      .execute()

    updated++
    console.log(`  Encrypted auth token for twilio_config ${config.id}`)
  }

  console.log(
    `Done. Updated: ${updated}, Skipped (already encrypted or empty): ${skipped}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
