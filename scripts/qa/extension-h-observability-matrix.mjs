import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function matchesEvery(fileContent, patterns) {
  return patterns.every((pattern) => pattern.test(fileContent))
}

const checks = [
  {
    id: 'OBS-1',
    description: 'Bulk enrichment job payload carries correlationId',
    assertions: [
      {
        file: 'backend/src/types/queues.ts',
        patterns: [
          /export interface ExtensionBulkEnrichEvent[\s\S]*correlationId:\s*string/,
        ],
      },
    ],
  },
  {
    id: 'OBS-2',
    description:
      'Bulk enrichment worker emits structured start/progress/completion/failure events',
    assertions: [
      {
        file: 'backend/src/queues/extension-bulk-enrich.worker.ts',
        patterns: [
          /JOB_STARTED:\s*'extension\.bulk_enrich\.job\.started'/,
          /JOB_PROGRESS:\s*'extension\.bulk_enrich\.job\.progress'/,
          /JOB_COMPLETED:\s*'extension\.bulk_enrich\.job\.completed'/,
          /JOB_FAILED:\s*'extension\.bulk_enrich\.job\.failed'/,
          /correlationId/,
        ],
      },
    ],
  },
  {
    id: 'OBS-3',
    description:
      'Job polling contract returns correlationId and controller propagates x-correlation-id',
    assertions: [
      {
        file: 'shared/types/src/requests/extension.ts',
        patterns: [
          /export interface ExtensionBulkEnrichJobStatusResponse[\s\S]*correlationId:\s*string/,
        ],
      },
      {
        file: 'backend/src/services/extension.service.ts',
        patterns: [
          /const correlationId = job\.data\.correlationId/,
          /return \{\s*jobId:\s*String\(job\.id\),\s*correlationId,/,
        ],
      },
      {
        file: 'backend/src/api/controllers/extension.controller.ts',
        patterns: [
          /res\.setHeader\('x-correlation-id', result\.correlationId\)/,
        ],
      },
    ],
  },
  {
    id: 'QA-1',
    description: 'Multi-tab profile update isolation is enforced in popup handler',
    assertions: [
      {
        file: 'extension/src/popup/components/App.tsx',
        patterns: [
          /message\.type === 'PROFILE_DETECTED'/,
          /sourceTabId !== activeLinkedInTabIdRef\.current/,
        ],
      },
    ],
  },
  {
    id: 'QA-2',
    description: 'Org-switch cache isolation is enforced for extension cache keys',
    assertions: [
      {
        file: 'extension/src/lib/storage.ts',
        patterns: [
          /const CACHE_VERSION = 'v2'/,
          /return `\$\{CACHE_PREFIX\}:lead:\$\{orgId\}:/,
          /if \(currentOrg && currentOrg !== orgId\) \{\s*await clearOrgScopedCaches\(\)/,
        ],
      },
    ],
  },
  {
    id: 'QA-3',
    description: 'LinkedIn list/search collector behavior is implemented',
    assertions: [
      {
        file: 'extension/src/content/linkedin.ts',
        patterns: [
          /function inferSourceType\(\): LinkedInSelectionItem\['sourceType'\]/,
          /if \(url\.includes\('\/sales\/'\)\) return 'sales_nav_search'/,
          /if \(url\.includes\('\/search\/'\)\) return 'linkedin_search'/,
          /const observer = new MutationObserver\(\(\) => \{/,
          /type: 'SELECTION_TOGGLE'/,
        ],
      },
    ],
  },
  {
    id: 'QA-4',
    description: 'Selection cart persistence and update broadcasts are wired',
    assertions: [
      {
        file: 'extension/src/background/service-worker.ts',
        patterns: [
          /async function persistSelectionCart\(/,
          /async function broadcastSelectionCartUpdate\(/,
          /type: 'SELECTION_CART_UPDATED'/,
          /if \(message\.type === 'SELECTION_TOGGLE'\)/,
        ],
      },
    ],
  },
  {
    id: 'QA-5',
    description: 'List ingest, queue, polling, and CRM bulk push endpoints are present',
    assertions: [
      {
        file: 'backend/src/api/routes/extension.ts',
        patterns: [
          /'\/lists\/create-from-linkedin-selection'/,
          /'\/lists\/:id\/bulk-enrich'/,
          /'\/jobs\/:jobId'/,
          /'\/lists\/:id\/bulk-push-crm'/,
        ],
      },
      {
        file: 'backend/src/services/extension.service.ts',
        patterns: [
          /export const createListFromLinkedInSelection = async/,
          /export const enqueueListBulkEnrich = async/,
          /export const getBulkEnrichJobStatus = async/,
          /export const bulkPushListToCrm = async/,
        ],
      },
    ],
  },
]

let passed = 0
const failures = []

for (const check of checks) {
  const failedAssertions = []
  for (const assertion of check.assertions) {
    const content = readWorkspaceFile(assertion.file)
    if (!matchesEvery(content, assertion.patterns)) {
      failedAssertions.push(assertion.file)
    }
  }

  if (failedAssertions.length === 0) {
    passed += 1
    console.log(`PASS ${check.id} ${check.description}`)
  } else {
    failures.push({ id: check.id, description: check.description, files: failedAssertions })
    console.log(`FAIL ${check.id} ${check.description}`)
  }
}

console.log(`\nSubspec H matrix: ${passed}/${checks.length} checks passed`)

if (failures.length > 0) {
  console.log('\nFailed checks:')
  for (const failure of failures) {
    console.log(`- ${failure.id}: ${failure.description}`)
    for (const file of failure.files) {
      console.log(`  file: ${file}`)
    }
  }
  process.exit(1)
}
