import { createClerkClient } from '@clerk/backend'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(backendRoot, '..')

for (const envPath of [
  path.resolve(repoRoot, '.env'),
  path.resolve(backendRoot, '.env'),
  path.resolve(repoRoot, '.env.local'),
  path.resolve(backendRoot, '.env.local'),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true })
  }
}

const getArg = (name) => {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0) return process.argv[index + 1]

  return undefined
}

const hasFlag = (name) => process.argv.includes(`--${name}`)

const firstEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

const redact = (value) =>
  value.length <= 12 ? '[set]' : `${value.slice(0, 8)}...${value.slice(-4)}`

const requireValue = (name, value) => {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const formatError = (error) => {
  if (!(error instanceof Error)) return String(error)

  const parts = [error.message].filter(Boolean)
  for (const key of ['status', 'code', 'clerkError', 'longMessage']) {
    if (error[key]) {
      parts.push(`${key}=${error[key]}`)
    }
  }
  if (error.cause) {
    parts.push(
      `cause=${
        error.cause.code ??
        error.cause.message ??
        (typeof error.cause === 'string' ? error.cause : 'unknown')
      }`,
    )
  }
  return parts.join(' ')
}

const readSetCookies = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  const setCookie = headers.get('set-cookie')
  return setCookie ? [setCookie] : []
}

const mergeCookies = (cookieJar, headers) => {
  for (const cookie of readSetCookies(headers)) {
    const [pair] = cookie.split(';')
    const [name] = pair.split('=')
    if (!name) continue
    cookieJar.set(name, pair)
  }
}

const cookieHeader = (cookieJar) =>
  [...cookieJar.values()].filter(Boolean).join('; ')

const consumeAgentTaskUrl = async (url, expectedRedirectUrl) => {
  let currentUrl = url
  const cookieJar = new Map()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const headers = {}
    const cookies = cookieHeader(cookieJar)
    if (cookies) headers.cookie = cookies

    const response = await fetch(currentUrl, {
      headers,
      redirect: 'manual',
    })
    mergeCookies(cookieJar, response.headers)

    const location = response.headers.get('location')
    console.log(
      `agentTask=consume status=${response.status} url=${new URL(
        currentUrl,
      ).origin}`,
    )

    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString()
      if (currentUrl.startsWith(expectedRedirectUrl)) {
        console.log('agentTask=consume redirected-to-app')
        return
      }
      continue
    }

    throw new Error(
      `Agent Task did not redirect to ${expectedRedirectUrl}; final status ${response.status}`,
    )
  }

  throw new Error('Agent Task redirect chain exceeded 8 hops')
}

const main = async () => {
  const clerkSecretKey = requireValue(
    'CLERK_SECRET_KEY',
    process.env.CLERK_SECRET_KEY,
  )
  const clerkPublishableKey = requireValue(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY',
    firstEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY'),
  )
  const email = requireValue(
    'E2E Clerk user email (--email or E2E_CLERK_USER_EMAIL)',
    getArg('email') ??
      firstEnv(
        'E2E_CLERK_USER_EMAIL',
        'CLERK_E2E_USER_EMAIL',
        'PLAYWRIGHT_TEST_EMAIL',
        'E2E_EMAIL',
        'TEST_EMAIL',
      ),
  )

  const expiresInSeconds = Number(getArg('expires-in-seconds') ?? 300)
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds < 60) {
    throw new Error('--expires-in-seconds must be a number >= 60')
  }

  const appUrl = (
    getArg('app-url') ??
    firstEnv('CLERK_LOGIN_SMOKE_APP_URL') ??
    'https://app.omnidial.io'
  ).replace(/\/+$/, '')
  const redirectUrl = getArg('redirect-url') ?? `${appUrl}/dashboard`
  const consumeAgentTask = hasFlag('consume-agent-task')
  const createAgentTask = hasFlag('agent-task') || consumeAgentTask

  const clerk = createClerkClient({
    secretKey: clerkSecretKey,
    publishableKey: clerkPublishableKey,
  })

  console.log('Clerk login smoke: starting')
  console.log(`publishableKey=${redact(clerkPublishableKey)}`)
  console.log(`email=${email}`)
  console.log(`redirectUrl=${redirectUrl}`)

  const users = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 2,
  })
  const matches = Array.isArray(users.data) ? users.data : []
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Clerk user for ${email}; found ${matches.length}`,
    )
  }

  const user = matches[0]
  console.log(`user=found id=${user.id}`)

  const testingToken = await clerk.testingTokens.createTestingToken()
  console.log(
    `testingToken=created expiresAt=${new Date(
      testingToken.expiresAt * 1000,
    ).toISOString()}`,
  )

  const signInToken = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds,
  })
  console.log(`signInToken=created id=${signInToken.id}`)

  const revokedSignInToken =
    await clerk.signInTokens.revokeSignInToken(signInToken.id)
  console.log(`signInToken=revoked status=${revokedSignInToken.status}`)

  if (createAgentTask) {
    const agentTask = await clerk.agentTasks.create({
      onBehalfOf: { userId: user.id },
      permissions: '*',
      agentName: 'omnidial-login-smoke',
      taskDescription: 'Verify OmniDial production programmatic login',
      redirectUrl,
      sessionMaxDurationInSeconds: Math.min(expiresInSeconds, 1800),
    })
    console.log(`agentTask=created id=${agentTask.agentTaskId}`)

    let consumed = false
    if (consumeAgentTask) {
      try {
        await consumeAgentTaskUrl(agentTask.url, redirectUrl)
        consumed = true
      } finally {
        await clerk.agentTasks
          .revoke(agentTask.agentTaskId)
          .then(() => console.log('agentTask=revoked'))
          .catch((error) => {
            if (!consumed) throw error
            console.log('agentTask=revoke-skipped-after-consume')
          })
      }
    } else {
      await clerk.agentTasks.revoke(agentTask.agentTaskId)
      console.log('agentTask=revoked')
    }
  }

  console.log('Clerk login smoke: passed')
}

main().catch((error) => {
  console.error('Clerk login smoke: failed')
  console.error(formatError(error))
  process.exit(1)
})
