export enum QueueName {
  EXAMPLE = 'example',
  CSV_IMPORT = 'csv-import',
  LIST_CSV_IMPORT = 'list-csv-import',
  EXTENSION_BULK_ENRICH = 'extension-bulk-enrich',
  SCHEDULED_NOTIFICATIONS = 'scheduled-notifications',
  RESEARCH_TASK = 'research-task',
  SMS_CAMPAIGN = 'sms-campaign',
  BILLING = 'billing',
}

export enum ExampleEventType {
  GET_EXAMPLE = 'getExample',
}

export interface ExampleEvent {
  id: string
  type: ExampleEventType
}

export enum CsvImportEventType {
  PROCESS_CSV = 'processCsv',
}

export interface CsvImportEvent {
  type: CsvImportEventType
  organizationId: string
  campaignId: string
  userId: string
  fileContent: string // Base64 encoded CSV content
  fileName: string
}

export enum ListCsvImportEventType {
  PROCESS_CSV = 'processCsv',
}

export interface ListCsvImportEvent {
  type: ListCsvImportEventType
  organizationId: string
  listId: string
  userId: string
  fileContent: string // Base64 encoded CSV content
  fileName: string
}

export enum ExtensionBulkEnrichEventType {
  PROCESS_LIST_BULK_ENRICH = 'processListBulkEnrich',
}

export interface ExtensionBulkEnrichEvent {
  type: ExtensionBulkEnrichEventType
  organizationId: string
  userId: string
  listId: string
  leadIds: string[]
  providers?: string[]
  forceRefresh?: boolean
  correlationId: string
}

export enum ScheduledNotificationEventType {
  DAILY_PERFORMANCE_SUMMARY = 'dailyPerformanceSummary',
  REP_REMINDERS = 'repReminders',
}

export interface ScheduledNotificationEvent {
  type: ScheduledNotificationEventType
  organizationId: string
  userId?: string // For rep reminders, the specific rep to notify
}

export enum ResearchTaskEventType {
  EXECUTE_TASK = 'executeTask',
}

export interface ResearchTaskEvent {
  type: ResearchTaskEventType
  taskId: string
  organizationId: string
}

export enum SmsCampaignEventType {
  PROCESS_READY = 'processReady', // Process all ready enrollments
  PROCESS_ENROLLMENT = 'processEnrollment', // Process a specific enrollment
  HANDLE_REPLY = 'handleReply', // Handle an inbound reply
  HANDLE_UNSUBSCRIBE = 'handleUnsubscribe', // Handle STOP message
  HANDLE_DELIVERY_STATUS = 'handleDeliveryStatus', // Twilio webhook status
}

export enum BillingEventType {
  CYCLE_ROTATION = 'cycleRotation',
  REDIS_SYNC = 'redisSync',
  REPORT_OVERAGE = 'reportOverage',
}

export interface BillingQueueEvent {
  type: BillingEventType
}

export interface SmsCampaignEvent {
  type: SmsCampaignEventType
  // For PROCESS_READY
  limit?: number
  // For PROCESS_ENROLLMENT
  enrollmentId?: string
  // For HANDLE_REPLY / HANDLE_UNSUBSCRIBE
  fromPhone?: string
  organizationId?: string
  // For HANDLE_DELIVERY_STATUS
  messageSid?: string
  status?: string
  errorCode?: string
}
