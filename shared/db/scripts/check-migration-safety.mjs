#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const migrationsRoot = path.join(packageRoot, 'prisma', 'migrations')

const migrationDirs = fs
  .readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

if (migrationDirs.length === 0) {
  throw new Error(`No migration directories found in ${migrationsRoot}`)
}

const latestMigrationDir = migrationDirs[migrationDirs.length - 1]
const latestMigrationPath = path.join(
  migrationsRoot,
  latestMigrationDir,
  'migration.sql',
)

if (!fs.existsSync(latestMigrationPath)) {
  throw new Error(`Missing migration.sql for ${latestMigrationDir}`)
}

const sql = fs.readFileSync(latestMigrationPath, 'utf8')
const lines = sql.split('\n')
const failures = []

const requiredMarkers = [
  '-- @wave1-safe:',
  '-- @lock-risk:',
  '-- @dry-run-required:',
]

for (const marker of requiredMarkers) {
  if (!sql.includes(marker)) {
    failures.push(
      `Latest migration (${latestMigrationDir}) is missing required metadata marker "${marker}"`,
    )
  }
}

const destructivePatterns = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
]

if (!sql.includes('-- @allow-destructive')) {
  for (const pattern of destructivePatterns) {
    if (pattern.test(sql)) {
      failures.push(
        `Latest migration (${latestMigrationDir}) contains destructive SQL matching ${pattern}`,
      )
    }
  }
}

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index]
  if (!/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(line)) {
    continue
  }
  if (/\bCONCURRENTLY\b/i.test(line)) {
    continue
  }

  const context = [lines[index - 2] ?? '', lines[index - 1] ?? '', line].join(
    '\n',
  )
  if (!context.includes('@allow-non-concurrent-index')) {
    failures.push(
      `Latest migration (${latestMigrationDir}) has non-concurrent index creation without "@allow-non-concurrent-index": ${line.trim()}`,
    )
  }
}

if (failures.length > 0) {
  console.error('Migration safety check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(
  `Migration safety check passed for latest migration: ${latestMigrationDir}`,
)
