import crypto from 'crypto'
import { config } from '@/config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment variable
 * In production, this should be a 32-byte key stored securely
 */
function getEncryptionKey(): Buffer {
  const key = config.encryptionKey || process.env.ENCRYPTION_KEY

  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. ' +
        'Generate one with: openssl rand -hex 32',
    )
  }

  const effectiveKey =
    key || config.jwt.secret || 'default-dev-key-do-not-use-in-prod'
  // Use SHA-256 to derive a 32-byte key from the provided string
  return crypto.createHash('sha256').update(effectiveKey).digest()
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Combine IV + auth tag + encrypted data, all hex encoded
  return iv.toString('hex') + authTag.toString('hex') + encrypted
}

/**
 * Decrypt a string that was encrypted with the encrypt function
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()

  // Extract IV, auth tag, and encrypted data
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex')
  const authTag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2),
    'hex',
  )
  const encrypted = encryptedData.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Encrypt an API key for secure storage
 */
export function encryptApiKey(apiKey: string): string {
  return encrypt(apiKey)
}

/**
 * Decrypt a stored API key
 */
export function decryptApiKey(encryptedKey: string): string {
  return decrypt(encryptedKey)
}
