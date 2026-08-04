import { getRedis } from '../src/lib/redis'

async function flushRateLimits() {
  const redis = getRedis()
  const patterns = ['auth:magic:*', 'login_lockout:*']
  let totalDeleted = 0

  for (const pattern of patterns) {
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      )
      cursor = nextCursor
      if (keys.length > 0) {
        const deleted = await redis.del(...keys)
        totalDeleted += deleted
        for (const key of keys) {
          console.log(`  DEL ${key}`)
        }
      }
    } while (cursor !== '0')
  }

  console.log(`\nFlushed ${totalDeleted} rate limit keys.`)
  process.exit(0)
}

flushRateLimits().catch((err) => {
  console.error('Failed to flush rate limits:', err)
  process.exit(1)
})
