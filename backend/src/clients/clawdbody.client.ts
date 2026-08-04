/**
 * ClawdBody Client
 * 1-Click deployment and management of OpenClaw VM instances
 *
 * ClawdBody provides:
 * - Managed VM instances for running OpenClaw agents
 * - Auto-scaling based on workload
 * - Cost tracking and optimization
 * - Multi-region deployment
 *
 * @see https://clawdbody.com/docs
 */

// Environment configuration
const CLAWDBODY_API_URL =
  process.env.CLAWDBODY_API_URL || 'https://api.clawdbody.com'
const CLAWDBODY_API_KEY = process.env.CLAWDBODY_API_KEY

// Types

export interface ClawdBodyConfig {
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

export type InstanceSize = 'micro' | 'small' | 'medium' | 'large' | 'xlarge'
export type InstanceStatus =
  | 'provisioning'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'terminated'
  | 'error'
export type Region =
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-northeast-1'

export interface InstanceSpec {
  name: string
  size: InstanceSize
  region: Region
  openclawVersion?: string
  autoScale?: boolean
  minInstances?: number
  maxInstances?: number
  environment?: Record<string, string>
  tags?: Record<string, string>
}

export interface Instance {
  id: string
  name: string
  status: InstanceStatus
  size: InstanceSize
  region: Region
  publicUrl: string
  internalUrl: string
  ipAddress: string
  openclawVersion: string
  openclawApiKey: string // Auto-generated API key for this instance
  resources: {
    cpu: number // vCPUs
    memory: number // MB
    storage: number // GB
  }
  metrics: {
    cpuUsage: number // percentage
    memoryUsage: number // percentage
    activeAgents: number
    activeSessions: number
    requestsPerMinute: number
  }
  autoScale: boolean
  minInstances: number
  maxInstances: number
  environment: Record<string, string>
  tags: Record<string, string>
  createdAt: string
  startedAt?: string
  stoppedAt?: string
  lastHealthCheck?: string
  estimatedMonthlyCost: number
}

export interface InstanceUsage {
  instanceId: string
  period: {
    start: string
    end: string
  }
  compute: {
    hours: number
    cost: number
  }
  storage: {
    gbHours: number
    cost: number
  }
  network: {
    ingressGb: number
    egressGb: number
    cost: number
  }
  total: number
}

export interface ScalingEvent {
  id: string
  instanceId: string
  type: 'scale_up' | 'scale_down'
  reason: string
  fromSize?: InstanceSize
  toSize?: InstanceSize
  fromCount?: number
  toCount?: number
  timestamp: string
}

export interface DeploymentLog {
  id: string
  instanceId: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

// Size specifications
const INSTANCE_SPECS: Record<
  InstanceSize,
  { cpu: number; memory: number; storage: number; hourlyRate: number }
> = {
  micro: { cpu: 1, memory: 1024, storage: 10, hourlyRate: 0.01 },
  small: { cpu: 2, memory: 2048, storage: 20, hourlyRate: 0.03 },
  medium: { cpu: 4, memory: 4096, storage: 40, hourlyRate: 0.06 },
  large: { cpu: 8, memory: 8192, storage: 80, hourlyRate: 0.12 },
  xlarge: { cpu: 16, memory: 16384, storage: 160, hourlyRate: 0.24 },
}

// ClawdBody Client class

class ClawdBodyClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  constructor(config: ClawdBodyConfig = {}) {
    this.baseUrl = config.baseUrl || CLAWDBODY_API_URL
    this.apiKey = config.apiKey || CLAWDBODY_API_KEY || ''
    this.timeout = config.timeout || 60000 // Longer timeout for provisioning
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `ClawdBody API error (${response.status}): ${errorText}`,
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `ClawdBody API request timed out after ${this.timeout}ms`,
        )
      }
      throw error
    }
  }

  // ============================================
  // Instance Management
  // ============================================

  /**
   * Create and provision a new OpenClaw instance
   */
  async createInstance(spec: InstanceSpec): Promise<Instance> {
    return this.request<Instance>('POST', '/api/instances', spec)
  }

  /**
   * Get instance by ID
   */
  async getInstance(instanceId: string): Promise<Instance | null> {
    try {
      return await this.request<Instance>('GET', `/api/instances/${instanceId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * List all instances
   */
  async listInstances(options?: {
    status?: InstanceStatus
    region?: Region
    tags?: Record<string, string>
  }): Promise<Instance[]> {
    const params = new URLSearchParams()
    if (options?.status) params.set('status', options.status)
    if (options?.region) params.set('region', options.region)
    if (options?.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        params.set(`tag:${key}`, value)
      })
    }

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ instances: Instance[] }>(
      'GET',
      `/api/instances${query}`,
    )
    return response.instances
  }

  /**
   * Update instance configuration
   */
  async updateInstance(
    instanceId: string,
    updates: Partial<
      Pick<
        InstanceSpec,
        'name' | 'autoScale' | 'minInstances' | 'maxInstances' | 'tags'
      >
    >,
  ): Promise<Instance> {
    return this.request<Instance>(
      'PATCH',
      `/api/instances/${instanceId}`,
      updates,
    )
  }

  /**
   * Start a stopped instance
   */
  async startInstance(instanceId: string): Promise<Instance> {
    return this.request<Instance>('POST', `/api/instances/${instanceId}/start`)
  }

  /**
   * Stop a running instance
   */
  async stopInstance(instanceId: string): Promise<Instance> {
    return this.request<Instance>('POST', `/api/instances/${instanceId}/stop`)
  }

  /**
   * Restart an instance
   */
  async restartInstance(instanceId: string): Promise<Instance> {
    return this.request<Instance>(
      'POST',
      `/api/instances/${instanceId}/restart`,
    )
  }

  /**
   * Terminate and delete an instance
   */
  async terminateInstance(instanceId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/instances/${instanceId}`)
  }

  /**
   * Resize an instance
   */
  async resizeInstance(
    instanceId: string,
    newSize: InstanceSize,
  ): Promise<Instance> {
    return this.request<Instance>(
      'POST',
      `/api/instances/${instanceId}/resize`,
      {
        size: newSize,
      },
    )
  }

  // ============================================
  // Health & Metrics
  // ============================================

  /**
   * Get real-time metrics for an instance
   */
  async getInstanceMetrics(instanceId: string): Promise<Instance['metrics']> {
    return this.request<Instance['metrics']>(
      'GET',
      `/api/instances/${instanceId}/metrics`,
    )
  }

  /**
   * Get detailed health check
   */
  async healthCheck(instanceId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: {
      name: string
      status: 'pass' | 'warn' | 'fail'
      message?: string
    }[]
    responseTime: number
    lastChecked: string
  }> {
    return this.request('GET', `/api/instances/${instanceId}/health`)
  }

  /**
   * Get instance logs
   */
  async getLogs(
    instanceId: string,
    options?: {
      level?: 'info' | 'warn' | 'error'
      since?: string
      limit?: number
    },
  ): Promise<DeploymentLog[]> {
    const params = new URLSearchParams()
    if (options?.level) params.set('level', options.level)
    if (options?.since) params.set('since', options.since)
    if (options?.limit) params.set('limit', options.limit.toString())

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ logs: DeploymentLog[] }>(
      'GET',
      `/api/instances/${instanceId}/logs${query}`,
    )
    return response.logs
  }

  // ============================================
  // Scaling
  // ============================================

  /**
   * Manually scale an instance
   */
  async scale(
    instanceId: string,
    config: {
      size?: InstanceSize
      replicas?: number
    },
  ): Promise<Instance> {
    return this.request<Instance>(
      'POST',
      `/api/instances/${instanceId}/scale`,
      config,
    )
  }

  /**
   * Get scaling history
   */
  async getScalingHistory(
    instanceId: string,
    options?: { since?: string; limit?: number },
  ): Promise<ScalingEvent[]> {
    const params = new URLSearchParams()
    if (options?.since) params.set('since', options.since)
    if (options?.limit) params.set('limit', options.limit.toString())

    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.request<{ events: ScalingEvent[] }>(
      'GET',
      `/api/instances/${instanceId}/scaling-history${query}`,
    )
    return response.events
  }

  // ============================================
  // Cost & Usage
  // ============================================

  /**
   * Get usage and cost for an instance
   */
  async getUsage(
    instanceId: string,
    period?: { start: string; end: string },
  ): Promise<InstanceUsage> {
    const params = new URLSearchParams()
    if (period?.start) params.set('start', period.start)
    if (period?.end) params.set('end', period.end)

    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request<InstanceUsage>(
      'GET',
      `/api/instances/${instanceId}/usage${query}`,
    )
  }

  /**
   * Get aggregate usage across all instances
   */
  async getAggregateUsage(period?: { start: string; end: string }): Promise<{
    totalCost: number
    instances: InstanceUsage[]
    breakdown: {
      compute: number
      storage: number
      network: number
    }
  }> {
    const params = new URLSearchParams()
    if (period?.start) params.set('start', period.start)
    if (period?.end) params.set('end', period.end)

    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request('GET', `/api/usage${query}`)
  }

  /**
   * Set spending limit / budget alert
   */
  async setBudgetAlert(config: {
    monthlyLimit: number
    alertThresholds: number[] // e.g., [50, 75, 90, 100] for percentage alerts
    notificationEmail: string
  }): Promise<void> {
    await this.request('POST', '/api/billing/budget', config)
  }

  // ============================================
  // Environment Variables & Secrets
  // ============================================

  /**
   * Set environment variables for an instance
   */
  async setEnvironment(
    instanceId: string,
    variables: Record<string, string>,
  ): Promise<void> {
    await this.request('PUT', `/api/instances/${instanceId}/environment`, {
      variables,
    })
  }

  /**
   * Get environment variables (values are masked)
   */
  async getEnvironment(instanceId: string): Promise<Record<string, string>> {
    const response = await this.request<{ variables: Record<string, string> }>(
      'GET',
      `/api/instances/${instanceId}/environment`,
    )
    return response.variables
  }

  /**
   * Delete environment variable
   */
  async deleteEnvironmentVariable(
    instanceId: string,
    key: string,
  ): Promise<void> {
    await this.request(
      'DELETE',
      `/api/instances/${instanceId}/environment/${key}`,
    )
  }

  // ============================================
  // Regions & Availability
  // ============================================

  /**
   * Get available regions and their status
   */
  async getRegions(): Promise<
    {
      id: Region
      name: string
      location: string
      status: 'available' | 'limited' | 'unavailable'
      latency?: number
    }[]
  > {
    const response = await this.request<{
      regions: {
        id: Region
        name: string
        location: string
        status: 'available' | 'limited' | 'unavailable'
        latency?: number
      }[]
    }>('GET', '/api/regions')
    return response.regions
  }

  /**
   * Get pricing for a specific region and size
   */
  async getPricing(
    region: Region,
    size: InstanceSize,
  ): Promise<{
    hourlyRate: number
    monthlyEstimate: number
    specs: { cpu: number; memory: number; storage: number }
  }> {
    return this.request('GET', `/api/pricing?region=${region}&size=${size}`)
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Estimate monthly cost for a configuration
   */
  estimateMonthlyCost(
    size: InstanceSize,
    hoursPerDay: number = 24,
    daysPerMonth: number = 30,
  ): number {
    const spec = INSTANCE_SPECS[size]
    return spec.hourlyRate * hoursPerDay * daysPerMonth
  }

  /**
   * Get recommended size based on expected workload
   */
  recommendSize(workload: {
    expectedAgents: number
    expectedConcurrentSessions: number
    expectedDailyMessages: number
  }): InstanceSize {
    // Simple heuristic - can be refined based on actual metrics
    const score =
      workload.expectedAgents * 10 +
      workload.expectedConcurrentSessions * 5 +
      workload.expectedDailyMessages * 0.01

    if (score < 50) return 'micro'
    if (score < 200) return 'small'
    if (score < 500) return 'medium'
    if (score < 1000) return 'large'
    return 'xlarge'
  }
}

// Export singleton instance
export const clawdbodyClient = new ClawdBodyClient()

// Export for custom configurations
export { ClawdBodyClient }

// ============================================
// OmniDial Integration Helpers
// ============================================

/**
 * Provision a new OpenClaw instance for an organization
 */
export async function provisionOrganizationInstance(
  organizationId: string,
  organizationName: string,
  expectedWorkload: {
    expectedAgents: number
    expectedConcurrentSessions: number
    expectedDailyMessages: number
  },
): Promise<Instance> {
  const recommendedSize = clawdbodyClient.recommendSize(expectedWorkload)

  return clawdbodyClient.createInstance({
    name: `omnidial-${organizationName.toLowerCase().replace(/\s+/g, '-')}`,
    size: recommendedSize,
    region: 'us-east-1', // Default region
    autoScale: true,
    minInstances: 1,
    maxInstances: 3,
    environment: {
      OMNIDIAL_ORG_ID: organizationId,
      NODE_ENV: 'production',
    },
    tags: {
      organizationId,
      organizationName,
      product: 'omnidial',
      component: 'lead-agent',
    },
  })
}

/**
 * Get or create an instance for an organization
 */
export async function getOrCreateOrganizationInstance(
  organizationId: string,
  organizationName: string,
): Promise<Instance> {
  // Check if instance already exists
  const instances = await clawdbodyClient.listInstances({
    tags: { organizationId },
  })

  const existing = instances.find((i) => i.status !== 'terminated')
  if (existing) {
    // Start if stopped
    if (existing.status === 'stopped') {
      return clawdbodyClient.startInstance(existing.id)
    }
    return existing
  }

  // Create new instance with default workload estimates
  return provisionOrganizationInstance(organizationId, organizationName, {
    expectedAgents: 5,
    expectedConcurrentSessions: 20,
    expectedDailyMessages: 500,
  })
}

/**
 * Clean up unused instances (cost optimization)
 */
export async function cleanupUnusedInstances(
  maxIdleHours: number = 24,
): Promise<{ stopped: string[]; terminated: string[] }> {
  const instances = await clawdbodyClient.listInstances({ status: 'running' })
  const stopped: string[] = []
  const terminated: string[] = []

  const now = new Date()

  for (const instance of instances) {
    // Skip instances with active sessions
    if (instance.metrics.activeSessions > 0) continue

    const lastActivity = instance.lastHealthCheck
      ? new Date(instance.lastHealthCheck)
      : new Date(instance.startedAt || instance.createdAt)

    const idleHours =
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)

    if (idleHours > maxIdleHours * 7) {
      // Terminate if idle for 7x threshold (e.g., 7 days)
      await clawdbodyClient.terminateInstance(instance.id)
      terminated.push(instance.id)
    } else if (idleHours > maxIdleHours) {
      // Stop if idle for threshold period
      await clawdbodyClient.stopInstance(instance.id)
      stopped.push(instance.id)
    }
  }

  return { stopped, terminated }
}
