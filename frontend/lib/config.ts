import { z } from 'zod'

const DEV_API_FALLBACK = 'http://localhost:8080/api'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const assertProductionApiUrl = (message: string): never => {
  throw new Error(
    `[config] ${message}. Set NEXT_PUBLIC_API_URL as a frontend build variable (for example, https://api.example.com/api).`,
  )
}

const normalizePublicApiUrl = (
  rawApiUrl: string | undefined,
  nodeEnv: string | undefined,
  ci: string | undefined,
): string => {
  const isProduction = nodeEnv === 'production'
  const enforceProductionValidation =
    isProduction && (ci === 'true' || ci === '1')
  const candidate = rawApiUrl?.trim()

  if (!candidate) {
    if (enforceProductionValidation) {
      return assertProductionApiUrl(
        'NEXT_PUBLIC_API_URL is required in production builds',
      )
    }
    return DEV_API_FALLBACK
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    if (enforceProductionValidation) {
      return assertProductionApiUrl(
        `NEXT_PUBLIC_API_URL is not a valid URL (received ${candidate})`,
      )
    }
    return DEV_API_FALLBACK
  }

  const host = parsed.hostname.toLowerCase()

  if (enforceProductionValidation && LOCAL_HOSTS.has(host)) {
    return assertProductionApiUrl(
      `NEXT_PUBLIC_API_URL cannot use a localhost host in production (received ${candidate})`,
    )
  }

  if (
    host === 'omnidial.io' ||
    host === 'www.omnidial.io' ||
    host === 'app.omnidial.io'
  ) {
    parsed.hostname = 'api.omnidial.io'
  }

  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/api'
  } else {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  }

  return parsed.toString().replace(/\/$/, '')
}

const envSchema = z.object({
  API_URL: z.string().url(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  // Pusher
  PUSHER_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  PUSHER_KEY: z.string().default('app-key'),
  PUSHER_HOST: z.string().default('localhost'),
  PUSHER_PORT: z.coerce.number().default(6001),
  PUSHER_USE_TLS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  // PostHog
  POSTHOG_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
})

export const env = envSchema.parse({
  API_URL: normalizePublicApiUrl(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV,
    process.env.CI,
  ),
  NODE_ENV: process.env.NODE_ENV,
  PUSHER_ENABLED: process.env.NEXT_PUBLIC_PUSHER_ENABLED,
  PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
  PUSHER_HOST: process.env.NEXT_PUBLIC_PUSHER_HOST,
  PUSHER_PORT: process.env.NEXT_PUBLIC_PUSHER_PORT,
  PUSHER_USE_TLS: process.env.NEXT_PUBLIC_PUSHER_USE_TLS,
  POSTHOG_ENABLED: process.env.NEXT_PUBLIC_POSTHOG_ENABLED,
})

export const ENDPOINTS = {
  USER: {
    ACCOUNT: '/user/account',
    ONBOARDING: '/user/onboarding',
    ONBOARDING_STATUS: '/user/onboarding-status',
  },
  AUTH: {
    VERIFY_EMAIL: '/auth/verify-email',
    SIGN_IN: '/auth/sign-in',
    SIGN_UP: '/auth/sign-up',
    SIGN_OUT: '/auth/sign-out',
  },
  ORGANIZATION: {
    INVITE_MEMBER: '/auth/organization/invite-member',
    CREDIT_BALANCE: (orgId: string) => `/organization/${orgId}/credit-balance`,
    SUBSCRIPTION: (orgId: string) => `/organization/${orgId}/subscription`,
    UPDATE: (orgId: string) => `/organization/${orgId}`,
  },
  ADMIN: {
    STATS: '/admin/stats',
    USERS: '/admin/users',
    ORGANIZATIONS: '/admin/organizations',
    ADD_CREDITS: (organizationId: string) =>
      `/admin/organizations/${organizationId}/credits`,
    DELETE_USER: (userId: string) => `/admin/users/${userId}`,
    DELETE_ORGANIZATION: (organizationId: string) =>
      `/admin/organizations/${organizationId}`,
    REASSIGN_USER: (userId: string) => `/admin/users/${userId}/reassign`,
    CREATE_ORGANIZATION: '/admin/organizations',
    REMOVE_USER_FROM_ORG: (organizationId: string, userId: string) =>
      `/admin/organizations/${organizationId}/members/${userId}`,
    ORGANIZATION_MEMBERS: (organizationId: string) =>
      `/admin/organizations/${organizationId}/members`,
    SWITCH_ORG: '/admin/switch-org',
    // Error Logs
    ERROR_LOGS: '/admin/error-logs',
    ERROR_LOG: (id: string) => `/admin/error-logs/${id}`,
    ERROR_LOG_STATS: '/admin/error-logs/stats',
    ERROR_LOG_STATUS: (id: string) => `/admin/error-logs/${id}/status`,
    // Admin Logs
    LOGS_CALLS: '/admin/logs/calls',
    LOGS_CALL_DETAIL: (id: string) => `/admin/logs/calls/${id}`,
    LOGS_RECORDINGS: '/admin/logs/recordings',
    LOGS_TRANSCRIPTIONS: '/admin/logs/transcriptions',
    LOGS_TRANSCRIPTION_DETAIL: (id: string) =>
      `/admin/logs/transcriptions/${id}`,
    LOGS_ACTIVITY: '/admin/logs/activity',
    PHONE_PROVISIONING: '/admin/phone-provisioning',
    PROVISION_ORG: (orgId: string) => `/admin/organizations/${orgId}/provision`,
    MARK_MAIN_ACCOUNT: (orgId: string) =>
      `/admin/organizations/${orgId}/mark-main-account`,
    RELEASE_NUMBER: (orgId: string) =>
      `/admin/organizations/${orgId}/release-number`,
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: '/notifications/mark-read',
    MARK_ALL_READ: '/notifications/mark-all-read',
  },
  PIPELINE_STAGES: {
    LIST: '/pipeline-stages',
    CREATE: '/pipeline-stages',
    UPDATE: (id: string) => `/pipeline-stages/${id}`,
    DELETE: (id: string) => `/pipeline-stages/${id}`,
    REORDER: '/pipeline-stages/reorder',
  },
  CAMPAIGNS: {
    LIST: '/campaigns',
    GET: (id: string) => `/campaigns/${id}`,
    CREATE: '/campaigns',
    UPDATE: (id: string) => `/campaigns/${id}`,
    DELETE: (id: string) => `/campaigns/${id}`,
    UPLOAD: (id: string) => `/campaigns/${id}/upload`,
    EXPORT: (id: string) => `/campaigns/${id}/export`,
    ASSIGN: (id: string) => `/campaigns/${id}/assign`,
    LEADS: (id: string) => `/campaigns/${id}/leads`,
  },
  LEADS: {
    LIST: '/leads',
    GET: (id: string) => `/leads/${id}`,
    CREATE: '/leads',
    UPDATE: (id: string) => `/leads/${id}`,
    DELETE: (id: string) => `/leads/${id}`,
    MOVE: (id: string) => `/leads/${id}/move`,
    LOOKUP: '/leads/lookup',
    BULK_CREATE: '/leads/bulk',
    SMART_QUERY: '/leads/smart-query',
    BULK_ADD_TO_CAMPAIGN: '/leads/bulk-add-to-campaign',
    BULK_ADD_TO_PIPELINE: '/leads/bulk-add-to-pipeline',
    ACTIVITY: (id: string) => `/leads/${id}/activity`,
    CALLS: (id: string) => `/leads/${id}/calls`,
    COMPANY_SUMMARY: (id: string) => `/leads/${id}/company-summary`,
    ENRICH_FROM_WEBSITE: (id: string) => `/leads/${id}/enrich-from-website`,
    CONTACT_METHODS: (leadId: string) => `/leads/${leadId}/contact-methods`,
    CONTACT_METHOD: (id: string) => `/leads/contact-methods/${id}`,
  },
  DNC: {
    LIST: '/dnc',
    MARK: '/dnc/mark',
    UNMARK: '/dnc/unmark',
    REMOVE_CAMPAIGN_LEADS: '/dnc/remove-campaign-leads',
    REMOVE_LIST_LEADS: '/dnc/remove-list-leads',
  },
  CRM: {
    CONNECTED: '/crm/connected',
    PUSH: '/crm/push',
    BULK_PUSH: '/crm/bulk-push',
    SYNC_ALL: '/crm/sync-all',
    PRESENCE: '/crm/presence',
    TEST: '/crm/test',
  },
  TASKS: {
    LIST: '/tasks',
    GET: (id: string) => `/tasks/${id}`,
    CREATE: '/tasks',
    UPDATE: (id: string) => `/tasks/${id}`,
    COMPLETE: (id: string) => `/tasks/${id}/complete`,
    DELETE: (id: string) => `/tasks/${id}`,
  },
  NOTES: {
    LIST: '/notes',
    CREATE: '/notes',
    UPDATE: (id: string) => `/notes/${id}`,
    DELETE: (id: string) => `/notes/${id}`,
  },
  DIALER: {
    TOKEN: '/dialer/token',
    CONFIG: (orgId: string) => `/dialer/config/${orgId}`,
    CREATE_CONFIG: '/dialer/config',
    UPDATE_CONFIG: (orgId: string) => `/dialer/config/${orgId}`,
    PHONE_NUMBERS: (orgId: string) => `/dialer/phone-numbers/${orgId}`,
    // Phone number assignments
    PHONE_NUMBER_ASSIGNMENTS: (orgId: string) =>
      `/dialer/phone-numbers/${orgId}/assignments`,
    ASSIGN_PHONE_NUMBER: '/dialer/phone-numbers/assign',
    UNASSIGN_PHONE_NUMBER: (orgId: string, phoneNumber: string) =>
      `/dialer/phone-numbers/${orgId}/assign/${encodeURIComponent(phoneNumber)}`,
    DIALABLE_PHONE_NUMBERS: (orgId: string) =>
      `/dialer/phone-numbers/${orgId}/dialable`,
    // Active dialer sessions
    SESSIONS: '/dialer/sessions',
    SESSION_END: (sessionId: string) => `/dialer/sessions/${sessionId}/end`,
    ACTIVE_SESSIONS: (orgId: string) => `/dialer/sessions/${orgId}`,
    MY_SESSION: '/dialer/sessions/me',
  },
  CALLS: {
    LIST: '/calls',
    CREATE: '/calls',
    GET: (id: string) => `/calls/${id}`,
    END: (id: string) => `/calls/${id}/end`,
    SET_DISPOSITION: (id: string) => `/calls/${id}/disposition`,
    DROP_VOICEMAIL: (callId: string) => `/calls/${callId}/voicemail-drop`,
    SEND_DTMF: (id: string) => `/calls/${id}/dtmf`,
    RECORDING: (id: string) => `/calls/${id}/recording`,
    SUGGEST_DISPOSITION: (id: string) => `/calls/${id}/suggest-disposition`,
  },
  VOICEMAIL_DROPS: {
    LIST: '/voicemail-drops',
    CREATE: '/voicemail-drops',
    DELETE: (id: string) => `/voicemail-drops/${id}`,
  },
  VOICEMAIL_GREETINGS: {
    LIST: '/voicemail-greetings',
    CREATE: '/voicemail-greetings',
    ACTIVATE: (id: string) => `/voicemail-greetings/${id}/activate`,
    DELETE: (id: string) => `/voicemail-greetings/${id}`,
  },
  VOICEMAIL_INBOX: {
    LIST: '/voicemail-inbox',
    MARK_READ: (id: string) => `/voicemail-inbox/${id}/read`,
    MARK_ALL_READ: '/voicemail-inbox/read-all',
  },
  DISPOSITIONS: {
    LIST: '/dispositions',
    CREATE: '/dispositions',
    UPDATE: (id: string) => `/dispositions/${id}`,
    DELETE: (id: string) => `/dispositions/${id}`,
  },
  ACTIVITY: {
    LIST: (orgId: string) => `/activity/${orgId}`,
  },
  ANALYTICS: {
    CALLS: (orgId: string) => `/analytics/${orgId}/calls`,
    LEADERBOARD: (orgId: string) => `/analytics/${orgId}/leaderboard`,
  },
  SCHEDULE: {
    LIST: (orgId: string) => `/schedule/${orgId}`,
    CREATE: '/schedule',
    UPDATE: (id: string) => `/schedule/${id}`,
    DELETE: (id: string) => `/schedule/${id}`,
  },
  LISTS: {
    // Folders
    FOLDERS: '/lists/folders',
    FOLDER: (id: string) => `/lists/folders/${id}`,
    REORDER_FOLDERS: '/lists/folders/reorder',
    // Lists
    LIST: '/lists',
    GET: (id: string) => `/lists/${id}`,
    CREATE: '/lists',
    UPDATE: (id: string) => `/lists/${id}`,
    DELETE: (id: string) => `/lists/${id}`,
    UPLOAD: (id: string) => `/lists/${id}/upload`,
    EXPORT: (id: string) => `/lists/${id}/export`,
    // List leads
    LEADS: (id: string) => `/lists/${id}/leads`,
    SOFT_REMOVE_LEAD: (listId: string, leadId: string) =>
      `/lists/${listId}/leads/${leadId}`,
    // Campaign linking
    CAMPAIGN_LISTS: (campaignId: string) => `/lists/campaigns/${campaignId}`,
    ADD_TO_CAMPAIGN: (campaignId: string) => `/lists/campaigns/${campaignId}`,
    REMOVE_FROM_CAMPAIGN: (campaignId: string, listId: string) =>
      `/lists/campaigns/${campaignId}/${listId}`,
    // Favorites
    FAVORITES: '/lists/favorites',
    FAVORITE_IDS: '/lists/favorites/ids',
    // Recents
    RECENTS: '/lists/recents',
    OPEN: (id: string) => `/lists/${id}/open`,
    FOLDER_OPEN: (id: string) => `/lists/folders/${id}/open`,
  },
  CLIENTS: {
    LIST: '/clients',
    GET: (id: string) => `/clients/${id}`,
    CREATE: '/clients',
    UPDATE: (id: string) => `/clients/${id}`,
    DELETE: (id: string) => `/clients/${id}`,
  },
  CLIENT_USER_ASSIGNMENTS: {
    MY_CLIENTS: '/client-user-assignments/my-clients',
    CLIENT_USERS: (clientId: string) =>
      `/client-user-assignments/clients/${clientId}/users`,
    USER_CLIENTS: (userId: string) =>
      `/client-user-assignments/users/${userId}/clients`,
    ASSIGN: '/client-user-assignments/assign',
    UNASSIGN: (clientId: string, userId: string) =>
      `/client-user-assignments/clients/${clientId}/users/${userId}`,
  },
  API_KEYS: {
    LIST: '/api-keys',
    GET: (id: string) => `/api-keys/${id}`,
    CREATE: '/api-keys',
    REVOKE: (id: string) => `/api-keys/${id}`,
    USAGE: (id: string) => `/api-keys/${id}/usage`,
  },
  INTEGRATIONS: {
    LIST: '/integrations',
    STATUS: (provider: string) => `/integrations/${provider}/status`,
    CONNECT: (provider: string) => `/integrations/${provider}/connect`,
    CALLBACK: (provider: string) => `/integrations/${provider}/callback`,
    CONFIG: (provider: string) => `/integrations/${provider}/config`,
    DISCONNECT: (provider: string) => `/integrations/${provider}`,
    TEST: (provider: string) => `/integrations/${provider}/test`,
    // Google Sheets specific
    GOOGLE_SHEETS: {
      LIST: '/integrations/google_sheets/sheets',
      COLUMNS: (sheetId: string) =>
        `/integrations/google_sheets/columns/${sheetId}`,
      IMPORT: '/integrations/google_sheets/import',
      WRITE_ACCESS: '/integrations/google_sheets/write-access',
      EXPORT_LEADS: '/integrations/google_sheets/export/leads',
      EXPORT_LIST: '/integrations/google_sheets/export/list',
      EXPORT_ANALYTICS: '/integrations/google_sheets/export/analytics',
    },
    // HubSpot specific
    HUBSPOT: {
      CONTACTS_SUMMARY: '/integrations/hubspot/contacts/summary',
      IMPORT: '/integrations/hubspot/import',
    },
    // EnrichEngine specific (API Key authentication)
    ENRICHENGINE: {
      CONNECT: '/integrations/enrichengine/connect',
      STATUS: '/integrations/enrichengine/status',
      DISCONNECT: '/integrations/enrichengine',
      TEST: '/integrations/enrichengine/test',
      LISTS: '/integrations/enrichengine/lists',
      LIST_LEADS: (listId: string) =>
        `/integrations/enrichengine/lists/${listId}/leads`,
      IMPORT: '/integrations/enrichengine/import',
    },
  },
  SCRIPTS: {
    LIST: '/scripts',
    GET: (id: string) => `/scripts/${id}`,
    CREATE: '/scripts',
    UPDATE: (id: string) => `/scripts/${id}`,
    DELETE: (id: string) => `/scripts/${id}`,
  },
  POWER_DIALER: {
    PROGRESS: '/power-dialer/progress',
    START: '/power-dialer/start',
    STOP: '/power-dialer/stop',
    NEXT_LEAD: '/power-dialer/next-lead',
    SKIP: '/power-dialer/skip',
    ADVANCE: '/power-dialer/advance',
    PREVIOUS: '/power-dialer/previous',
  },
  COACHING: {
    STATS: '/coaching/stats',
    RECENT: '/coaching/recent',
    HISTORY: '/coaching/history',
    UNCOACHED: '/coaching/uncoached',
    BY_LEAD: (leadId: string) => `/coaching/leads/${leadId}`,
    ELIGIBILITY: (callId: string) => `/coaching/calls/${callId}/eligibility`,
    GET: (callId: string) => `/coaching/calls/${callId}`,
    GENERATE: (callId: string) => `/coaching/calls/${callId}/generate`,
  },
  CALL_INTELLIGENCE: {
    ELIGIBILITY: (callId: string) =>
      `/call-intelligence/calls/${callId}/eligibility`,
    GET: (callId: string) => `/call-intelligence/calls/${callId}`,
    GENERATE: (callId: string) => `/call-intelligence/calls/${callId}/generate`,
    BY_LEAD: (leadId: string) => `/call-intelligence/leads/${leadId}`,
  },
  // OmniDial Enhancements
  PARALLEL_DIALER: {
    SESSIONS: '/parallel-dialer/sessions',
    SESSION: (sessionId: string) => `/parallel-dialer/sessions/${sessionId}`,
    SESSION_END: (sessionId: string) =>
      `/parallel-dialer/sessions/${sessionId}/end`,
    SESSION_PAUSE: (sessionId: string) =>
      `/parallel-dialer/sessions/${sessionId}/pause`,
    SESSION_RESUME: (sessionId: string) =>
      `/parallel-dialer/sessions/${sessionId}/resume`,
    SESSION_DIAL: (sessionId: string) =>
      `/parallel-dialer/sessions/${sessionId}/dial`,
    SESSION_JOIN: (sessionId: string) =>
      `/parallel-dialer/sessions/${sessionId}/join`,
    ABANDONED_CALLS: '/parallel-dialer/abandoned-calls',
  },
  PREDICTIVE_SCORING: {
    CALCULATE: (listId: string) => `/predictive-scoring/calculate/${listId}`,
    REORDER: (campaignId: string, listId: string) =>
      `/predictive-scoring/reorder/${campaignId}/${listId}`,
    LEAD_SCORE: (leadId: string) => `/predictive-scoring/lead/${leadId}`,
    PATTERNS: '/predictive-scoring/patterns',
    PHONE_TYPE: '/predictive-scoring/phone-type',
  },
  SALES_FLOOR: {
    STATUS: '/sales-floor/status',
    LEADERBOARD: '/sales-floor/leaderboard',
    BLITZ_LIST: '/sales-floor/blitz',
    BLITZ_GET: (blitzId: string) => `/sales-floor/blitz/${blitzId}`,
    BLITZ_CREATE: '/sales-floor/blitz',
    BLITZ_START: (blitzId: string) => `/sales-floor/blitz/${blitzId}/start`,
    BLITZ_END: (blitzId: string) => `/sales-floor/blitz/${blitzId}/end`,
    BLITZ_JOIN: (blitzId: string) => `/sales-floor/blitz/${blitzId}/join`,
    LISTEN_START: '/sales-floor/listen/start',
    LISTEN_END: (sessionId: string) => `/sales-floor/listen/${sessionId}/end`,
    LISTEN_MODE: (sessionId: string) => `/sales-floor/listen/${sessionId}/mode`,
  },
  LIVE_COACH: {
    CARDS: '/live-coach/cards',
    CARD: (cardId: string) => `/live-coach/cards/${cardId}`,
    TRANSCRIPT: (callId: string) => `/live-coach/transcript/${callId}`,
    TRIGGER_FEEDBACK: (triggerId: string) =>
      `/live-coach/triggers/${triggerId}/feedback`,
    TRIGGER_STATS: '/live-coach/trigger-stats',
  },
  LOCAL_PRESENCE: {
    PHONE_POOL: '/local-presence/phone-pool',
    PHONE_POOL_SYNC: '/local-presence/phone-pool/sync',
    PHONE_POOL_UPDATE: (id: string) => `/local-presence/phone-pool/${id}`,
    PREVIEW: '/local-presence/preview',
    CALLBACK_ROUTES: '/local-presence/callback-routes',
    CLEAR_EXPIRED_ROUTES: '/local-presence/callback-routes/clear-expired',
    COVERAGE: '/local-presence/coverage',
    MISSING_AREA_CODES: '/local-presence/missing-area-codes',
  },
  ENRICHMENT: {
    VENDORS: '/enrichment/vendors',
    VENDOR: (vendorId: string) => `/enrichment/vendors/${vendorId}`,
    VENDOR_TEST: (vendorId: string) => `/enrichment/vendors/${vendorId}/test`,
    LEAD_ENRICH: (leadId: string) => `/enrichment/leads/${leadId}/enrich`,
    BULK_ENRICH: '/enrichment/bulk-enrich',
    PROSPEO_LIST_MOBILE: (listId: string) =>
      `/enrichment/lists/${listId}/prospeo-mobile`,
    LEAD_CONTACTS: (leadId: string) => `/enrichment/leads/${leadId}/contacts`,
    HISTORY: '/enrichment/history',
  },
  RESEARCH: {
    TASKS: '/research/tasks',
    TASK: (taskId: string) => `/research/tasks/${taskId}`,
    TASK_CANCEL: (taskId: string) => `/research/tasks/${taskId}/cancel`,
    TASK_RETRY: (taskId: string) => `/research/tasks/${taskId}/retry`,
    TASKS_BULK: '/research/tasks/bulk',
    APPROVALS: '/research/approvals',
    APPROVAL_APPROVE: (id: string) => `/research/approvals/${id}/approve`,
    APPROVAL_REJECT: (id: string) => `/research/approvals/${id}/reject`,
    APPROVAL_MODIFY: (id: string) => `/research/approvals/${id}/modify`,
    APPROVALS_BULK_APPROVE: '/research/approvals/bulk/approve',
    APPROVALS_BULK_REJECT: '/research/approvals/bulk/reject',
    TEMPLATES: '/research/templates',
    TEMPLATE: (templateId: string) => `/research/templates/${templateId}`,
    FIELDS: '/research/fields',
    FIELD: (fieldId: string) => `/research/fields/${fieldId}`,
    CONNECTION_TEST: '/research/connection/test',
    CREDITS: '/research/credits',
  },
  REP_PROFILES: {
    STATS: (orgId: string, userId: string) =>
      `/rep-profiles/${orgId}/${userId}/stats`,
  },
  NOTIFICATION_SETTINGS: {
    GET: '/notification-settings',
    UPDATE: '/notification-settings',
    TEST_DAILY_SUMMARY: '/notification-settings/test-daily-summary',
    TEST_REP_REMINDER: '/notification-settings/test-rep-reminder',
  },
  SLACK: {
    STATUS: '/slack/status',
    INSTALL_URL: '/slack/install-url',
    DISCONNECT: '/slack/disconnect',
    CHANNELS: '/slack/channels',
    NOTIFICATION_RULES: '/slack/notification-rules',
    LINK_USER: '/slack/link-user',
    AUTO_LINK: '/slack/auto-link',
    TEST_NOTIFICATION: '/slack/test-notification',
    // App Directory flow linking
    LINK_VALIDATE: (token: string) => `/slack/link/validate?token=${token}`,
    LINK_ORGANIZATIONS: (token: string) =>
      `/slack/link/organizations?token=${token}`,
    LINK_COMPLETE: '/slack/link/complete',
  },
  AGENTS: {
    LIST: '/agents',
    GET: (id: string) => `/agents/${id}`,
    CREATE: '/agents',
    UPDATE: (id: string) => `/agents/${id}`,
    DELETE: (id: string) => `/agents/${id}`,
    ACTIVATE: (id: string) => `/agents/${id}/activate`,
    DEACTIVATE: (id: string) => `/agents/${id}/deactivate`,
    STATS: (id: string) => `/agents/${id}/stats`,
    // Email config
    EMAIL_CONFIG: (agentId: string) => `/agents/${agentId}/email`,
    EMAIL_TEST: (agentId: string) => `/agents/${agentId}/email/test`,
    EMAIL_VERIFY: (agentId: string) => `/agents/${agentId}/email/verify`,
    // SMS config
    SMS_PROVISION: (agentId: string) => `/agents/${agentId}/sms/provision`,
    SMS_CONFIG: (agentId: string) => `/agents/${agentId}/sms`,
    SMS_AI_CONFIG: (agentId: string) => `/agents/${agentId}/sms/ai-config`,
    SMS_ACTIVATE: (agentId: string) => `/agents/${agentId}/sms/activate`,
    // Workflows
    WORKFLOWS: (agentId: string) => `/agents/${agentId}/workflows`,
    WORKFLOW: (agentId: string, workflowId: string) =>
      `/agents/${agentId}/workflows/${workflowId}`,
    WORKFLOW_ACTIVATE: (agentId: string, workflowId: string) =>
      `/agents/${agentId}/workflows/${workflowId}/activate`,
    WORKFLOW_DEACTIVATE: (agentId: string, workflowId: string) =>
      `/agents/${agentId}/workflows/${workflowId}/deactivate`,
    WORKFLOW_EXECUTE: (agentId: string, workflowId: string) =>
      `/agents/${agentId}/workflows/${workflowId}/execute`,
    // Qualifications
    QUALIFICATIONS: '/agents/qualifications',
    QUALIFICATION: (id: string) => `/agents/qualifications/${id}`,
    QUALIFICATIONS_PENDING: '/agents/qualifications/pending',
    QUALIFICATIONS_STATS: '/agents/qualifications/stats',
    QUALIFICATION_REVIEW: (id: string) => `/agents/qualifications/${id}/review`,
    // Orchestration Jobs
    JOBS: (agentId: string) => `/agents/${agentId}/jobs`,
    JOB: (agentId: string, jobId: string) => `/agents/${agentId}/jobs/${jobId}`,
    JOB_START: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/start`,
    JOB_PAUSE: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/pause`,
    JOB_RESUME: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/resume`,
    JOB_CANCEL: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/cancel`,
    JOB_PROGRESS: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/progress`,
    JOB_STEPS: (agentId: string, jobId: string) =>
      `/agents/${agentId}/jobs/${jobId}/steps`,
    // Conversations
    CONVERSATIONS: (agentId: string) => `/agents/${agentId}/conversations`,
    // SMS Autonomous
    SMS_AUTONOMOUS: (agentId: string) => `/agents/${agentId}/sms/autonomous`,
    // Gmail OAuth
    GMAIL_AUTH_URL: (agentId: string) =>
      `/agents/${agentId}/email/gmail/auth-url`,
    GMAIL_STATUS: (agentId: string) => `/agents/${agentId}/email/gmail/status`,
    GMAIL_DISCONNECT: (agentId: string) => `/agents/${agentId}/email/gmail`,
    GMAIL_TEST: (agentId: string) => `/agents/${agentId}/email/gmail/test`,
  },
  BILLING: {
    USAGE: '/billing/usage',
    USAGE_HISTORY: '/billing/usage/history',
    OVERAGE_CAP_ACKNOWLEDGE: '/billing/overage-cap/acknowledge',
  },
  PHONE_SETUP: {
    STATUS: '/phone-setup/status',
    SEARCH: (areaCode: string) => `/phone-setup/search?areaCode=${areaCode}`,
    SETUP: '/phone-setup/setup',
    PROVISION: '/phone-setup/provision',
    PROVISION_QUICK: '/phone-setup/provision/quick',
    VERIFY: '/phone-setup/verify',
    VERIFY_STATUS: '/phone-setup/verify/status',
  },
  ORCHESTRATION: {
    // Agent Definitions
    DEFINITIONS: '/orchestration/definitions',
    DEFINITION: (id: string) => `/orchestration/definitions/${id}`,
    // Invocation
    INVOKE: '/orchestration/invoke',
    INVOKE_AGENT: (definitionId: string) =>
      `/orchestration/invoke/${definitionId}`,
    INVOKE_BY_TYPE: (agentType: string) =>
      `/orchestration/invoke/type/${agentType}`,
    // Executions
    EXECUTIONS: '/orchestration/executions',
    EXECUTION: (id: string) => `/orchestration/executions/${id}`,
    EXECUTION_CHILDREN: (id: string) =>
      `/orchestration/executions/${id}/children`,
    // Approvals
    APPROVALS: '/orchestration/approvals',
    APPROVAL: (id: string) => `/orchestration/approvals/${id}`,
    APPROVAL_RESPOND: (id: string) => `/orchestration/approvals/${id}/respond`,
    APPROVALS_BATCH: '/orchestration/approvals/batch',
    // Tools
    TOOLS: '/orchestration/tools',
    TOOLS_BY_CATEGORY: (category: string) => `/orchestration/tools/${category}`,
  },
}

export const QUERY_KEYS = {
  organizations: () => ['organizations'] as const,
  userAccount: () => ['user', 'account'] as const,
  onboardingStatus: () => ['user', 'onboarding-status'] as const,
  organizationMembers: (orgId?: string) =>
    ['organization', 'members', orgId] as const,
  organizationInvitations: (orgId?: string) =>
    ['organization', 'invitations', orgId] as const,
  organizationCreditBalance: (orgId?: string) =>
    ['organization', 'credit-balance', orgId] as const,
  organizationSubscription: (orgId?: string) =>
    ['organization', 'subscription', orgId] as const,
  adminStats: () => ['admin', 'stats'] as const,
  adminUsers: () => ['admin', 'users'] as const,
  adminOrganizations: () => ['admin', 'organizations'] as const,
  adminAddCredits: (organizationId?: string) =>
    ['admin', 'organizations', organizationId, 'credits'] as const,
  adminErrorLogs: (filters?: Record<string, unknown>) =>
    ['admin', 'error-logs', filters] as const,
  adminErrorLog: (id?: string) => ['admin', 'error-log', id] as const,
  adminErrorLogStats: (params?: Record<string, unknown>) =>
    ['admin', 'error-log-stats', params] as const,
  adminLogsCalls: (filters?: Record<string, unknown>) =>
    ['admin', 'logs', 'calls', filters] as const,
  adminLogsCallDetail: (id?: string) => ['admin', 'logs', 'call', id] as const,
  adminLogsRecordings: (filters?: Record<string, unknown>) =>
    ['admin', 'logs', 'recordings', filters] as const,
  adminLogsTranscriptions: (filters?: Record<string, unknown>) =>
    ['admin', 'logs', 'transcriptions', filters] as const,
  adminLogsTranscriptionDetail: (id?: string) =>
    ['admin', 'logs', 'transcription', id] as const,
  adminLogsActivity: (filters?: Record<string, unknown>) =>
    ['admin', 'logs', 'activity', filters] as const,
  notifications: () => ['notifications'] as const,
  notificationsUnreadCount: () => ['notifications', 'unread-count'] as const,
  // CRM
  pipelineStages: () => ['pipeline-stages'] as const,
  tasks: (params?: { leadId?: string; userId?: string; completed?: string }) =>
    ['tasks', params] as const,
  task: (id: string) => ['tasks', id] as const,
  notes: (leadId: string) => ['notes', leadId] as const,
  // Campaigns
  campaigns: (orgId?: string) => ['campaigns', orgId] as const,
  campaign: (id?: string) => ['campaign', id] as const,
  campaignLeads: (campaignId?: string) =>
    ['campaign', campaignId, 'leads'] as const,
  // Leads (shared)
  leads: (orgId?: string) => ['leads', orgId] as const,
  lead: (id?: string) => ['lead', id] as const,
  dncEntries: (orgId?: string) => ['dnc-entries', orgId] as const,
  leadContactMethods: (leadId?: string) =>
    ['lead-contact-methods', leadId] as const,
  leadByPhone: (phone?: string) => ['lead', 'by-phone', phone] as const,
  leadActivity: (leadId: string) => ['lead', leadId, 'activity'] as const,
  leadCompanySummary: (leadId: string) =>
    ['lead', leadId, 'company-summary'] as const,
  connectedCrms: (orgId?: string) => ['crm', 'connected', orgId] as const,
  crmPresence: (orgId?: string, leadId?: string) =>
    ['crm', 'presence', orgId, leadId] as const,
  // Dialer
  dialerToken: () => ['dialer', 'token'] as const,
  dialerConfig: (orgId?: string) => ['dialer', 'config', orgId] as const,
  dialerPhoneNumbers: (orgId?: string) =>
    ['dialer', 'phone-numbers', orgId] as const,
  phoneNumberAssignments: (orgId?: string) =>
    ['phone-number-assignments', orgId] as const,
  dialablePhoneNumbers: (orgId?: string) =>
    ['dialable-phone-numbers', orgId] as const,
  calls: (filters?: Record<string, unknown>) => ['calls', filters] as const,
  call: (id: string) => ['calls', id] as const,
  voicemailDrops: () => ['voicemail-drops'] as const,
  voicemailGreetings: () => ['voicemail-greetings'] as const,
  voicemailInbox: (filters?: Record<string, unknown>) =>
    ['voicemail-inbox', filters] as const,
  voicemailInboxUnread: () => ['voicemail-inbox', 'unread'] as const,
  dispositions: () => ['dispositions'] as const,
  // Lists
  listFolders: (orgId?: string) => ['list-folders', orgId] as const,
  lists: (orgId?: string, folderId?: string) =>
    ['lists', orgId, folderId] as const,
  list: (id?: string) => ['list', id] as const,
  listLeads: (listId?: string) => ['list', listId, 'leads'] as const,
  campaignLists: (campaignId?: string) =>
    ['campaign', campaignId, 'lists'] as const,
  listFavorites: (orgId?: string) => ['list-favorites', orgId] as const,
  listFavoriteIds: (orgId?: string) => ['list-favorite-ids', orgId] as const,
  listRecents: (orgId?: string) => ['list-recents', orgId] as const,
  // Clients
  clients: (orgId?: string) => ['clients', orgId] as const,
  client: (id?: string) => ['client', id] as const,
  // Client-User Assignments
  myAssignedClients: (orgId?: string) =>
    ['my-assigned-clients', orgId] as const,
  clientUserAssignments: (orgId?: string, clientId?: string) =>
    ['client-user-assignments', orgId, clientId] as const,
  userClientAssignments: (orgId?: string, userId?: string) =>
    ['user-client-assignments', orgId, userId] as const,
  // API Keys
  apiKeys: (orgId?: string) => ['api-keys', orgId] as const,
  apiKey: (id?: string) => ['api-key', id] as const,
  apiKeyUsage: (id?: string) => ['api-key-usage', id] as const,
  // Integrations
  integrations: (orgId?: string) => ['integrations', orgId] as const,
  integrationStatus: (provider?: string) => ['integration', provider] as const,
  googleSheets: (orgId?: string) => ['google-sheets', orgId] as const,
  googleSheetColumns: (sheetId?: string) =>
    ['google-sheet-columns', sheetId] as const,
  googleSheetsWriteAccess: (orgId?: string) =>
    ['google-sheets-write-access', orgId] as const,
  hubspotContactsSummary: (orgId?: string) =>
    ['hubspot-contacts-summary', orgId] as const,
  enrichEngineStatus: (orgId?: string) =>
    ['enrichengine-status', orgId] as const,
  enrichEngineLists: (orgId?: string) => ['enrichengine-lists', orgId] as const,
  enrichEngineListLeads: (listId?: string) =>
    ['enrichengine-list-leads', listId] as const,
  // Scripts
  scripts: (orgId?: string, campaignId?: string) =>
    ['scripts', orgId, campaignId] as const,
  script: (id?: string) => ['script', id] as const,
  // Power Dialer
  powerDialerProgress: (
    campaignId?: string,
    listId?: string,
    timezonePriority?: string,
  ) =>
    ['power-dialer', 'progress', campaignId, listId, timezonePriority] as const,
  powerDialerNextLead: (
    campaignId?: string,
    listId?: string,
    timezonePriority?: string,
  ) =>
    [
      'power-dialer',
      'next-lead',
      campaignId,
      listId,
      timezonePriority,
    ] as const,
  // Dialer Sessions
  activeSessions: (orgId?: string) => ['dialer', 'sessions', orgId] as const,
  mySession: () => ['dialer', 'session', 'me'] as const,
  // Lead Calls
  leadCalls: (leadId?: string) => ['lead', leadId, 'calls'] as const,
  // Analytics
  analyticsCalls: (
    orgId?: string,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, unknown>,
  ) => ['analytics', 'calls', orgId, startDate, endDate, filters] as const,
  analyticsLeaderboard: (
    orgId?: string,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, unknown>,
  ) =>
    ['analytics', 'leaderboard', orgId, startDate, endDate, filters] as const,
  // Coaching (Sales Coach)
  coachingStats: (orgId?: string, userId?: string) =>
    ['coaching', 'stats', orgId, userId] as const,
  coachingRecent: (orgId?: string, filters?: Record<string, unknown>) =>
    ['coaching', 'recent', orgId, filters] as const,
  coachingHistory: (userId?: string, filters?: Record<string, unknown>) =>
    ['coaching', 'history', userId, filters] as const,
  coachingEligibility: (callId?: string) =>
    ['coaching', 'eligibility', callId] as const,
  callCoaching: (callId?: string) => ['coaching', 'call', callId] as const,
  uncoachedCalls: (orgId?: string, filters?: Record<string, unknown>) =>
    ['coaching', 'uncoached', orgId, filters] as const,
  leadCoaching: (leadId?: string, filters?: Record<string, unknown>) =>
    ['coaching', 'lead', leadId, filters] as const,
  // Call Intelligence
  intelligenceEligibility: (callId?: string) =>
    ['intelligence', 'eligibility', callId] as const,
  callIntelligence: (callId?: string) =>
    ['intelligence', 'call', callId] as const,
  leadIntelligence: (leadId?: string, filters?: Record<string, unknown>) =>
    ['intelligence', 'lead', leadId, filters] as const,
  // OmniDial Enhancements
  parallelDialerSession: (sessionId?: string) =>
    ['parallel-dialer', 'session', sessionId] as const,
  abandonedCalls: (orgId?: string, filters?: Record<string, unknown>) =>
    ['parallel-dialer', 'abandoned-calls', orgId, filters] as const,
  predictiveScorePatterns: (orgId?: string) =>
    ['predictive-scoring', 'patterns', orgId] as const,
  leadPredictiveScore: (leadId?: string) =>
    ['predictive-scoring', 'lead', leadId] as const,
  salesFloorStatus: (orgId?: string) =>
    ['sales-floor', 'status', orgId] as const,
  salesFloorLeaderboard: (orgId?: string, filters?: Record<string, unknown>) =>
    ['sales-floor', 'leaderboard', orgId, filters] as const,
  blitzes: (orgId?: string) => ['sales-floor', 'blitzes', orgId] as const,
  blitz: (blitzId?: string) => ['sales-floor', 'blitz', blitzId] as const,
  coachCards: (orgId?: string, filters?: Record<string, unknown>) =>
    ['live-coach', 'cards', orgId, filters] as const,
  coachCard: (cardId?: string) => ['live-coach', 'card', cardId] as const,
  liveTranscript: (callId?: string) =>
    ['live-coach', 'transcript', callId] as const,
  triggerStats: (orgId?: string, filters?: Record<string, unknown>) =>
    ['live-coach', 'trigger-stats', orgId, filters] as const,
  phonePool: (orgId?: string, filters?: Record<string, unknown>) =>
    ['local-presence', 'phone-pool', orgId, filters] as const,
  localPresencePreview: (leadPhone?: string) =>
    ['local-presence', 'preview', leadPhone] as const,
  areaCodeCoverage: (orgId?: string) =>
    ['local-presence', 'coverage', orgId] as const,
  missingAreaCodes: (orgId?: string, listId?: string) =>
    ['local-presence', 'missing-area-codes', orgId, listId] as const,
  enrichmentVendors: (orgId?: string) =>
    ['enrichment', 'vendors', orgId] as const,
  leadContactInfo: (leadId?: string) =>
    ['enrichment', 'lead-contacts', leadId] as const,
  enrichmentHistory: (orgId?: string, filters?: Record<string, unknown>) =>
    ['enrichment', 'history', orgId, filters] as const,
  // Research
  researchTasks: (orgId?: string, filters?: Record<string, unknown>) =>
    ['research', 'tasks', orgId, filters] as const,
  researchTask: (taskId?: string) => ['research', 'task', taskId] as const,
  researchApprovals: (orgId?: string, filters?: Record<string, unknown>) =>
    ['research', 'approvals', orgId, filters] as const,
  researchTemplates: (orgId?: string) =>
    ['research', 'templates', orgId] as const,
  researchTemplate: (templateId?: string) =>
    ['research', 'template', templateId] as const,
  researchFields: (orgId?: string) => ['research', 'fields', orgId] as const,
  researchCredits: (orgId?: string) => ['research', 'credits', orgId] as const,
  // Rep Profiles
  repProfileStats: (
    orgId?: string,
    userId?: string,
    period?: string,
    filters?: Record<string, unknown>,
  ) => ['rep-profile', 'stats', orgId, userId, period, filters] as const,
  // Notification Settings
  notificationSettings: (orgId?: string) =>
    ['notification-settings', orgId] as const,
  // Slack
  slackStatus: (orgId?: string) => ['slack', 'status', orgId] as const,
  slackChannels: (orgId?: string) => ['slack', 'channels', orgId] as const,
  slackLinkValidate: (token?: string) =>
    ['slack', 'link', 'validate', token] as const,
  slackLinkOrganizations: (token?: string) =>
    ['slack', 'link', 'organizations', token] as const,
  // Agents
  agents: (orgId?: string) => ['agents', orgId] as const,
  agent: (id?: string) => ['agent', id] as const,
  agentStats: (id?: string) => ['agent', id, 'stats'] as const,
  agentWorkflows: (agentId?: string) =>
    ['agent', agentId, 'workflows'] as const,
  agentWorkflow: (agentId?: string, workflowId?: string) =>
    ['agent', agentId, 'workflow', workflowId] as const,
  qualifications: (orgId?: string, filters?: Record<string, unknown>) =>
    ['qualifications', orgId, filters] as const,
  qualification: (id?: string) => ['qualification', id] as const,
  qualificationsPending: (orgId?: string) =>
    ['qualifications', 'pending', orgId] as const,
  qualificationsStats: (orgId?: string) =>
    ['qualifications', 'stats', orgId] as const,
  agentJobs: (agentId?: string, filters?: Record<string, unknown>) =>
    ['agent', agentId, 'jobs', filters] as const,
  agentJob: (agentId?: string, jobId?: string) =>
    ['agent', agentId, 'job', jobId] as const,
  agentJobProgress: (agentId?: string, jobId?: string) =>
    ['agent', agentId, 'job', jobId, 'progress'] as const,
  agentJobSteps: (agentId?: string, jobId?: string) =>
    ['agent', agentId, 'job', jobId, 'steps'] as const,
  agentConversations: (agentId?: string, leadId?: string) =>
    ['agent', agentId, 'conversations', leadId] as const,
  agentGmailStatus: (agentId?: string) =>
    ['agent', agentId, 'gmail', 'status'] as const,
  // Billing
  billingUsage: (orgId?: string) => ['billing', 'usage', orgId] as const,
  billingUsageHistory: (orgId?: string) =>
    ['billing', 'usage-history', orgId] as const,
  // Phone Setup
  phoneProvisioningStatus: (orgId?: string) =>
    ['phone-setup', 'status', orgId] as const,
  availableNumbers: (areaCode?: string) =>
    ['phone-setup', 'search', areaCode] as const,
  callerIdVerificationStatus: (orgId?: string) =>
    ['phone-setup', 'verify', orgId] as const,
  adminPhoneProvisioning: () => ['admin', 'phone-provisioning'] as const,
  // Orchestration
  orchestrationDefinitions: (
    orgId?: string,
    filters?: Record<string, unknown>,
  ) => ['orchestration', 'definitions', orgId, filters] as const,
  orchestrationDefinition: (id?: string) =>
    ['orchestration', 'definition', id] as const,
  orchestrationExecutions: (
    orgId?: string,
    filters?: Record<string, unknown>,
  ) => ['orchestration', 'executions', orgId, filters] as const,
  orchestrationExecution: (id?: string) =>
    ['orchestration', 'execution', id] as const,
  orchestrationExecutionChildren: (id?: string) =>
    ['orchestration', 'execution', id, 'children'] as const,
  orchestrationApprovals: (orgId?: string) =>
    ['orchestration', 'approvals', orgId] as const,
  orchestrationApproval: (id?: string) =>
    ['orchestration', 'approval', id] as const,
  orchestrationTools: (orgId?: string, category?: string) =>
    ['orchestration', 'tools', orgId, category] as const,
}
