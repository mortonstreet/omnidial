import { config } from '@/config'
import Redis from 'ioredis'
import logger from '@/lib/logger'

export const redisConfig = {
  ...(config.redis.useTLS && {
    tls: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  }),
}

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    try {
      _redis = new Redis(config.redis.url, {
        ...redisConfig,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
          // Stop retrying after 10 attempts
          if (times > 10) {
            logger.error('[Redis] Max retry attempts reached, stopping retries')
            return null // Stop retrying
          }
          // Exponential backoff: 100ms, 200ms, 400ms... max 30s
          const delay = Math.min(times * 100, 30000)
          logger.warn(
            `[Redis] Retrying connection in ${delay}ms (attempt ${times})`,
          )
          return delay
        },
        reconnectOnError(err) {
          // Only reconnect on specific errors, not on max requests limit
          const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED']
          return targetErrors.some((e) => err.message.includes(e))
        },
      })

      _redis.on('error', (err) => {
        logger.error(`[Redis] Connection error: ${err.message}`)
      })

      _redis.on('connect', () => {
        logger.info('[Redis] Connected successfully')
      })
    } catch (error) {
      logger.error(`[Redis Lib] Error initializing Redis: ${error}`)
      throw error
    }
  }
  return _redis
}

export async function pingRedis(
  timeoutMs = 2000,
): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const redis = getRedis()
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), timeoutMs),
      ),
    ])
    return {
      healthy: result === 'PONG',
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function invalidateCache(key: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const result = await redis.del(key)
    logger.info({ key, deleted: result > 0 }, 'Cache invalidation')
    return result > 0
  } catch (error) {
    logger.error({ key, error }, 'Cache invalidation failed')
    return false
  }
}
