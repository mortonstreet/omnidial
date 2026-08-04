import { db } from '../src/lib/db'
import { randomUUID } from 'crypto'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function seed() {
  const email = 'fox@mortonstreet.ai'
  const password = 'gtmdials9900'
  const name = 'Fox Admin'

  console.log('Seeding database...')

  // Check if user already exists
  const existingUser = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', email)
    .executeTakeFirst()

  if (existingUser) {
    console.log('User already exists, updating to admin with verified email...')
    await db
      .updateTable('user')
      .set({ role: 'admin', emailVerified: true })
      .where('id', '=', existingUser.id)
      .execute()
    console.log('User updated successfully!')
    console.log('\nLogin credentials:')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)
    process.exit(0)
  }

  // Create user directly in database
  const userId = randomUUID()
  const accountId = randomUUID()
  const hashedPassword = await hashPassword(password)
  const now = new Date()

  try {
    // Insert user
    await db
      .insertInto('user')
      .values({
        id: userId,
        email,
        name,
        emailVerified: true,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    console.log(`Created user: ${email}`)

    // Insert account with password (better-auth credential account)
    await db
      .insertInto('account')
      .values({
        id: accountId,
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    console.log('Created credential account with password')

    console.log('\n✅ Seed completed successfully!')
    console.log('\nLogin credentials:')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)
  } catch (error) {
    console.error('Error creating user:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
