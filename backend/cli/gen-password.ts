import { auth } from '../src/lib/better-auth'

const password = 'gtmdials'
const userId = 'VqGOOPf93GYpiFCnGCvgo9An7ZUte65m'

async function main() {
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)

  console.log(`
Delete old account first:
DELETE FROM account WHERE "userId" = '${userId}';

Then insert:
INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '${userId}',
  'credential',
  '${userId}',
  '${hash}',
  NOW(),
  NOW()
);

Password: ${password}
`)
}

main().catch(console.error)
