-- Agent Orchestration Schema
-- Simplified agent system with specialized agents called by orchestrator

-- Agent definitions (configured via dashboard)
CREATE TABLE "agent_definition" (
  "id" VARCHAR(36) PRIMARY KEY,
  "organizationId" VARCHAR(36) NOT NULL,

  "name" VARCHAR(100) NOT NULL,
  "type" VARCHAR(50) NOT NULL,  -- orchestrator, email, sms, research, qualify, analytics, campaign
  "description" TEXT,

  "systemPrompt" TEXT NOT NULL,
  "tools" JSONB NOT NULL DEFAULT '[]',
  "guardrails" JSONB NOT NULL DEFAULT '{}',

  "model" VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet',
  "maxTokens" INT NOT NULL DEFAULT 2048,
  "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.5,

  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,  -- Built-in agents vs user-created

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_definition_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_definition_organizationId_idx" ON "agent_definition"("organizationId");
CREATE INDEX "agent_definition_type_idx" ON "agent_definition"("type");
CREATE INDEX "agent_definition_isActive_idx" ON "agent_definition"("isActive");

-- Agent executions (audit trail)
CREATE TABLE "agent_execution" (
  "id" VARCHAR(36) PRIMARY KEY,
  "organizationId" VARCHAR(36) NOT NULL,
  "agentDefinitionId" VARCHAR(36) NOT NULL,

  -- What triggered this
  "triggerType" VARCHAR(50) NOT NULL,  -- user, orchestrator, schedule, webhook, inbound_sms
  "triggerContext" JSONB,
  "parentExecutionId" VARCHAR(36),     -- If called by orchestrator

  -- Input/Output
  "inputPrompt" TEXT NOT NULL,
  "inputContext" JSONB,
  "outputResponse" TEXT,
  "outputToolCalls" JSONB,

  -- Status
  "status" VARCHAR(20) NOT NULL DEFAULT 'running',  -- running, awaiting_approval, completed, failed, cancelled
  "error" TEXT,

  -- Related entities
  "leadId" VARCHAR(36),
  "campaignId" VARCHAR(36),

  -- Metrics
  "tokensInput" INT,
  "tokensOutput" INT,
  "durationMs" INT,
  "estimatedCost" DECIMAL(10,6),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "agent_execution_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_execution_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId")
    REFERENCES "agent_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_execution_parentExecutionId_fkey" FOREIGN KEY ("parentExecutionId")
    REFERENCES "agent_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "agent_execution_leadId_fkey" FOREIGN KEY ("leadId")
    REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "agent_execution_campaignId_fkey" FOREIGN KEY ("campaignId")
    REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "agent_execution_organizationId_idx" ON "agent_execution"("organizationId");
CREATE INDEX "agent_execution_agentDefinitionId_idx" ON "agent_execution"("agentDefinitionId");
CREATE INDEX "agent_execution_parentExecutionId_idx" ON "agent_execution"("parentExecutionId");
CREATE INDEX "agent_execution_status_idx" ON "agent_execution"("status");
CREATE INDEX "agent_execution_createdAt_idx" ON "agent_execution"("createdAt" DESC);
CREATE INDEX "agent_execution_leadId_idx" ON "agent_execution"("leadId");

-- Pending approvals
CREATE TABLE "agent_approval" (
  "id" VARCHAR(36) PRIMARY KEY,
  "organizationId" VARCHAR(36) NOT NULL,
  "executionId" VARCHAR(36) NOT NULL,

  "approvalType" VARCHAR(50) NOT NULL,  -- send_email, send_sms, create_campaign, bulk_action

  -- What needs approval
  "actionSummary" TEXT NOT NULL,
  "actionDetails" JSONB NOT NULL,

  -- Related entities
  "leadId" VARCHAR(36),
  "campaignId" VARCHAR(36),

  -- Status
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, modified, expired
  "respondedById" VARCHAR(36),
  "response" VARCHAR(20),  -- approved, rejected, modified
  "responseNote" TEXT,
  "modifications" JSONB,

  -- Routing
  "slackMessageTs" VARCHAR(50),
  "slackChannelId" VARCHAR(50),

  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "agent_approval_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_approval_executionId_fkey" FOREIGN KEY ("executionId")
    REFERENCES "agent_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_approval_leadId_fkey" FOREIGN KEY ("leadId")
    REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "agent_approval_campaignId_fkey" FOREIGN KEY ("campaignId")
    REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "agent_approval_respondedById_fkey" FOREIGN KEY ("respondedById")
    REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "agent_approval_organizationId_status_idx" ON "agent_approval"("organizationId", "status");
CREATE INDEX "agent_approval_executionId_idx" ON "agent_approval"("executionId");
CREATE INDEX "agent_approval_pending_idx" ON "agent_approval"("organizationId") WHERE "status" = 'pending';

-- Tool definitions (registered tools that agents can use)
CREATE TABLE "agent_tool" (
  "id" VARCHAR(36) PRIMARY KEY,
  "organizationId" VARCHAR(36),  -- NULL for system tools

  "name" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(50) NOT NULL,  -- email, sms, research, crm, analytics

  "parameters" JSONB NOT NULL,  -- JSON Schema for parameters
  "handler" VARCHAR(200) NOT NULL,  -- Service method reference

  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_tool_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_tool_name_org_idx" ON "agent_tool"("name", "organizationId");
CREATE INDEX "agent_tool_category_idx" ON "agent_tool"("category");

-- Tool execution logs (for debugging and analytics)
CREATE TABLE "agent_tool_execution" (
  "id" VARCHAR(36) PRIMARY KEY,
  "executionId" VARCHAR(36) NOT NULL,
  "toolId" VARCHAR(36) NOT NULL,

  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,

  "status" VARCHAR(20) NOT NULL DEFAULT 'running',  -- running, completed, failed
  "durationMs" INT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "agent_tool_execution_executionId_fkey" FOREIGN KEY ("executionId")
    REFERENCES "agent_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_tool_execution_toolId_fkey" FOREIGN KEY ("toolId")
    REFERENCES "agent_tool"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_tool_execution_executionId_idx" ON "agent_tool_execution"("executionId");

-- Add orchestration reference to existing agent table
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "orchestrationEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "orchestratorDefinitionId" VARCHAR(36);
ALTER TABLE "agent" ADD CONSTRAINT "agent_orchestratorDefinitionId_fkey"
  FOREIGN KEY ("orchestratorDefinitionId") REFERENCES "agent_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Daily usage tracking for rate limiting
CREATE TABLE "agent_usage" (
  "id" VARCHAR(36) PRIMARY KEY,
  "organizationId" VARCHAR(36) NOT NULL,
  "agentDefinitionId" VARCHAR(36) NOT NULL,
  "date" DATE NOT NULL,

  "executionCount" INT NOT NULL DEFAULT 0,
  "tokenCount" INT NOT NULL DEFAULT 0,
  "approvalCount" INT NOT NULL DEFAULT 0,
  "errorCount" INT NOT NULL DEFAULT 0,

  "emailsSent" INT NOT NULL DEFAULT 0,
  "smsSent" INT NOT NULL DEFAULT 0,

  "estimatedCost" DECIMAL(10,4) NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_usage_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_usage_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId")
    REFERENCES "agent_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_usage_org_agent_date_idx" ON "agent_usage"("organizationId", "agentDefinitionId", "date");
