import crypto from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(crypto.scrypt)

/**
 * Generate a secure random password
 * Creates a password with mixed case, numbers, and special characters
 */
export const generateSecurePassword = (length: number = 16): string => {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const bytes = crypto.randomBytes(length)
  let password = ''

  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length]
  }

  return password
}

/**
 * Hash a password using scrypt (Better Auth's default algorithm)
 * Format: salt:hash (both base64 encoded)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16)
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer

  return `${salt.toString('base64')}:${derivedKey.toString('base64')}`
}

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  try {
    const [saltBase64, hashBase64] = hash.split(':')
    if (!saltBase64 || !hashBase64) return false

    const salt = Buffer.from(saltBase64, 'base64')
    const storedHash = Buffer.from(hashBase64, 'base64')
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer

    return crypto.timingSafeEqual(derivedKey, storedHash)
  } catch {
    return false
  }
}
