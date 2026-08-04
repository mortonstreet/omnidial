/**
 * LeadMagic API Test Script
 *
 * Tests the LeadMagic API connection, credits balance, and optionally
 * runs a real enrichment lookup against a LinkedIn profile.
 *
 * Usage:
 *   npx tsx backend/scripts/test-leadmagic.ts --api-key=YOUR_KEY
 *   npx tsx backend/scripts/test-leadmagic.ts --api-key=YOUR_KEY --linkedin=https://www.linkedin.com/in/username
 *   npx tsx backend/scripts/test-leadmagic.ts --from-db --org=ORG_ID
 *
 * Options:
 *   --api-key=KEY         LeadMagic API key to test with
 *   --from-db             Read API key from database (requires --org)
 *   --org=ORG_ID          Organization ID to read API key from
 *   --linkedin=URL        LinkedIn profile URL to test enrichment (optional)
 */

const LEADMAGIC_BASE_URL = 'https://api.leadmagic.io'

async function testCredits(apiKey: string): Promise<boolean> {
  console.log('\n--- Testing LeadMagic Credits Endpoint ---')
  console.log(`POST ${LEADMAGIC_BASE_URL}/credits`)

  try {
    const response = await fetch(`${LEADMAGIC_BASE_URL}/credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(15_000),
    })

    console.log(`Status: ${response.status} ${response.statusText}`)
    const text = await response.text()
    console.log(`Response: ${text}`)

    if (!response.ok) {
      console.error('FAILED: API returned error status')
      return false
    }

    try {
      const data = JSON.parse(text)
      console.log(`Credits remaining: ${data.credits ?? 'unknown'}`)
      console.log('PASSED: Credits endpoint working')
      return true
    } catch {
      console.error('FAILED: Could not parse response as JSON')
      return false
    }
  } catch (error) {
    console.error('FAILED:', error instanceof Error ? error.message : error)
    return false
  }
}

async function testMobileFinder(
  apiKey: string,
  linkedInUrl: string,
): Promise<boolean> {
  console.log('\n--- Testing LeadMagic Mobile Finder ---')
  console.log(`POST ${LEADMAGIC_BASE_URL}/mobile-finder`)
  console.log(`LinkedIn URL: ${linkedInUrl}`)

  try {
    const response = await fetch(`${LEADMAGIC_BASE_URL}/mobile-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ profile_url: linkedInUrl }),
      signal: AbortSignal.timeout(30_000),
    })

    console.log(`Status: ${response.status} ${response.statusText}`)
    const text = await response.text()
    console.log(`Response: ${text}`)

    if (!response.ok) {
      console.error('FAILED: API returned error status')
      return false
    }

    try {
      const data = JSON.parse(text)
      console.log('\nParsed result:')
      console.log(`  Email: ${data.email || '(none)'}`)
      console.log(`  Mobile: ${data.mobile_number || '(none)'}`)
      console.log(`  Credits consumed: ${data.credits_consumed ?? 'unknown'}`)
      console.log(`  Message: ${data.message || '(none)'}`)

      if (data.mobile_number || data.email) {
        console.log('PASSED: Mobile finder returned contact info')
      } else {
        console.log(
          'PARTIAL: API responded OK but no contact info found for this profile',
        )
      }
      return true
    } catch {
      console.error('FAILED: Could not parse response as JSON')
      return false
    }
  } catch (error) {
    console.error('FAILED:', error instanceof Error ? error.message : error)
    return false
  }
}

async function getApiKeyFromDb(orgId: string): Promise<string | null> {
  // Dynamic import to avoid loading db deps when not needed
  const { Pool } = await import('pg')

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable not set')
    return null
  }

  const pool = new Pool({ connectionString: dbUrl, max: 1 })
  try {
    const result = await pool.query(
      `SELECT "apiKeyEncrypted" FROM "data_vendor_connection"
       WHERE "organizationId" = $1 AND "provider" = 'leadmagic' AND "isActive" = true
       LIMIT 1`,
      [orgId],
    )

    if (result.rows.length === 0) {
      console.error(`No active LeadMagic connection found for org: ${orgId}`)
      return null
    }

    // Need to decrypt — import the encryption module
    const { decrypt } = await import('../src/lib/encryption')
    return decrypt(result.rows[0].apiKeyEncrypted)
  } finally {
    await pool.end()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const getArg = (name: string) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`))
    return arg?.split('=').slice(1).join('=')
  }
  const hasFlag = (name: string) => args.includes(`--${name}`)

  let apiKey = getArg('api-key')
  const linkedInUrl = getArg('linkedin')
  const fromDb = hasFlag('from-db')
  const orgId = getArg('org')

  if (fromDb) {
    if (!orgId) {
      console.error('--from-db requires --org=ORG_ID')
      process.exit(1)
    }
    console.log(`Reading LeadMagic API key from database for org: ${orgId}`)
    apiKey = await getApiKeyFromDb(orgId)
    if (!apiKey) {
      process.exit(1)
    }
  }

  if (!apiKey) {
    console.error(
      'Usage: npx tsx backend/scripts/test-leadmagic.ts --api-key=YOUR_KEY',
    )
    console.error(
      '   or: npx tsx backend/scripts/test-leadmagic.ts --from-db --org=ORG_ID',
    )
    process.exit(1)
  }

  console.log('=== LeadMagic API Test ===')
  console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)

  const creditsOk = await testCredits(apiKey)

  if (linkedInUrl) {
    await testMobileFinder(apiKey, linkedInUrl)
  } else {
    console.log(
      '\nSkipping mobile-finder test (pass --linkedin=URL to test enrichment)',
    )
  }

  console.log('\n=== Summary ===')
  console.log(`Credits endpoint: ${creditsOk ? 'OK' : 'FAILED'}`)
  if (linkedInUrl) {
    console.log('Mobile finder: see results above')
  }

  process.exit(creditsOk ? 0 : 1)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
