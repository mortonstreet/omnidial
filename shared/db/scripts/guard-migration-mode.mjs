#!/usr/bin/env node

const mode = process.argv[2]
if (!mode || (mode !== 'migrate' && mode !== 'deploy')) {
  console.error(
    'Usage: node ./scripts/guard-migration-mode.mjs <migrate|deploy>',
  )
  process.exit(1)
}

const allowedEnvs = new Set(['dev', 'stage', 'prod'])
const explicitDeployEnv = process.env.DEPLOY_ENV
const inferredDeployEnv =
  explicitDeployEnv ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')
const deployEnv = inferredDeployEnv.toLowerCase()
const allowOverride = process.env.ALLOW_MIGRATION_MODE_OVERRIDE === 'true'

if (!allowedEnvs.has(deployEnv)) {
  console.error(
    `Invalid DEPLOY_ENV "${inferredDeployEnv}". Allowed values: dev, stage, prod.`,
  )
  process.exit(1)
}

if (!allowOverride && mode === 'migrate' && deployEnv !== 'dev') {
  console.error(
    `Blocked prisma migrate dev in DEPLOY_ENV=${deployEnv}. Use db:deploy for stage/prod.`,
  )
  process.exit(1)
}

if (!allowOverride && mode === 'deploy' && deployEnv === 'dev') {
  console.error(
    'Blocked prisma migrate deploy in DEPLOY_ENV=dev. Use db:migrate for development.',
  )
  process.exit(1)
}

console.log(
  `Migration mode guard passed: mode=${mode}, DEPLOY_ENV=${deployEnv}${allowOverride ? ' (override enabled)' : ''}`,
)
