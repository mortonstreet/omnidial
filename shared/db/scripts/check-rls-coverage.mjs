#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const prismaRoot = path.join(packageRoot, 'prisma')
const migrationsRoot = path.join(prismaRoot, 'migrations')
const schemaPath = path.join(prismaRoot, 'schema.prisma')
const baseRlsMigrationPath = path.join(
  migrationsRoot,
  '20260207000000_add_row_level_security',
  'migration.sql',
)
const overridePath = path.join(prismaRoot, 'rls-classification-overrides.json')

const allowedCategories = new Set([
  'direct-org',
  'nullable-org',
  'join-org',
  'user-scoped',
  'no-rls',
])

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const readText = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf8')
}

const parseSchemaTables = () => {
  const schema = readText(schemaPath)
  const tableRegex = /@@map\("([^"]+)"\)/g
  const tables = new Set()
  let match = tableRegex.exec(schema)
  while (match) {
    tables.add(match[1])
    match = tableRegex.exec(schema)
  }
  return tables
}

const parseBaseClassifications = () => {
  const sql = readText(baseRlsMigrationPath)
  const lines = sql.split('\n')
  const classifications = new Map()
  let currentCategory = null
  let inNoRlsSection = false

  for (const line of lines) {
    if (line.includes('Pattern 1: Direct org-scoped tables')) {
      currentCategory = 'direct-org'
      inNoRlsSection = false
      continue
    }
    if (line.includes('Pattern 2: Nullable org-scoped tables')) {
      currentCategory = 'nullable-org'
      inNoRlsSection = false
      continue
    }
    if (line.includes('Pattern 3: JOIN-based org isolation')) {
      currentCategory = 'join-org'
      inNoRlsSection = false
      continue
    }
    if (line.includes('Pattern 4: User-scoped tables')) {
      currentCategory = 'user-scoped'
      inNoRlsSection = false
      continue
    }
    if (line.includes('No RLS tables')) {
      currentCategory = 'no-rls'
      inNoRlsSection = true
      continue
    }

    const tableMarker = line.match(
      /^-- ---------- ([A-Za-z0-9_]+)(?: .*?)? ----------$/,
    )
    if (tableMarker && currentCategory) {
      classifications.set(tableMarker[1], currentCategory)
    }

    if (inNoRlsSection) {
      const alterNoRls = line.match(
        /^ALTER TABLE "([^"]+)" ENABLE ROW LEVEL SECURITY;$/,
      )
      if (alterNoRls) {
        classifications.set(alterNoRls[1], 'no-rls')
      }
    }
  }

  return classifications
}

const parseOverrideClassifications = () => {
  const overrides = new Map()
  if (!fs.existsSync(overridePath)) {
    return overrides
  }

  const raw = JSON.parse(readText(overridePath))
  for (const [table, category] of Object.entries(raw)) {
    if (!allowedCategories.has(category)) {
      throw new Error(
        `Invalid classification "${category}" for table "${table}" in ${overridePath}`,
      )
    }
    overrides.set(table, category)
  }
  return overrides
}

const collectAllMigrationSql = () => {
  const chunks = []
  const migrationDirs = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const dir of migrationDirs) {
    const sqlPath = path.join(migrationsRoot, dir, 'migration.sql')
    if (fs.existsSync(sqlPath)) {
      chunks.push(readText(sqlPath))
    }
  }

  return chunks.join('\n\n')
}

const schemaTables = parseSchemaTables()
const baseClassifications = parseBaseClassifications()
const overrideClassifications = parseOverrideClassifications()
const allMigrationsSql = collectAllMigrationSql()

for (const [table, category] of overrideClassifications.entries()) {
  const existing = baseClassifications.get(table)
  if (existing && existing !== category) {
    throw new Error(
      `Conflicting RLS classification for "${table}": base=${existing}, override=${category}`,
    )
  }
  baseClassifications.set(table, category)
}

const failures = []

for (const table of schemaTables) {
  if (!baseClassifications.has(table)) {
    failures.push(
      `Missing RLS classification for table "${table}". Add it to the RLS migration comments or ${overridePath}.`,
    )
  }
}

for (const [table] of baseClassifications.entries()) {
  if (!schemaTables.has(table)) {
    failures.push(
      `RLS classification exists for "${table}" but table is not present in schema.prisma.`,
    )
  }
}

for (const [table, category] of baseClassifications.entries()) {
  const escapedTable = escapeRegExp(table)
  const hasRlsEnable = new RegExp(
    `ALTER TABLE\\s+"${escapedTable}"\\s+ENABLE ROW LEVEL SECURITY;`,
  ).test(allMigrationsSql)
  if (!hasRlsEnable) {
    failures.push(
      `Table "${table}" is classified as "${category}" but has no RLS enable statement.`,
    )
    continue
  }

  const policyMatches =
    allMigrationsSql.match(
      new RegExp(
        `CREATE POLICY\\s+"[^"]+"\\s+ON\\s+"${escapedTable}"\\s+FOR\\s+`,
        'g',
      ),
    ) ?? []

  if (category === 'no-rls') {
    if (policyMatches.length > 0) {
      failures.push(
        `Table "${table}" is classified as no-rls but has ${policyMatches.length} RLS policy statements.`,
      )
    }
    continue
  }

  if (policyMatches.length === 0) {
    failures.push(
      `Table "${table}" is classified as "${category}" but has no RLS policies.`,
    )
    continue
  }

  const hasDeleteDenyPolicy = new RegExp(
    `CREATE POLICY\\s+"${escapedTable}_delete"\\s+ON\\s+"${escapedTable}"\\s+FOR\\s+DELETE\\s+TO\\s+authenticated\\s+USING\\s+\\(false\\);`,
  ).test(allMigrationsSql)
  if (!hasDeleteDenyPolicy) {
    failures.push(
      `Table "${table}" is missing required "${table}_delete" deny policy.`,
    )
  }

  const hasAnonDenyPolicy = new RegExp(
    `CREATE POLICY\\s+"${escapedTable}_anon"\\s+ON\\s+"${escapedTable}"\\s+FOR\\s+ALL\\s+TO\\s+anon\\s+USING\\s+\\(false\\);`,
  ).test(allMigrationsSql)
  if (!hasAnonDenyPolicy) {
    failures.push(
      `Table "${table}" is missing required "${table}_anon" deny policy.`,
    )
  }
}

if (failures.length > 0) {
  console.error('RLS coverage check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

const counts = {
  'direct-org': 0,
  'nullable-org': 0,
  'join-org': 0,
  'user-scoped': 0,
  'no-rls': 0,
}

for (const category of baseClassifications.values()) {
  counts[category] += 1
}

console.log('RLS coverage check passed.')
console.log(
  `Classified ${baseClassifications.size} tables: direct-org=${counts['direct-org']}, nullable-org=${counts['nullable-org']}, join-org=${counts['join-org']}, user-scoped=${counts['user-scoped']}, no-rls=${counts['no-rls']}.`,
)
