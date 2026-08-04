# OmniDial Scaling Architecture

## Overview

This document outlines how OmniDial scales from a single VPS to a multi-tenant Kubernetes platform.

## Scaling Phases

```
Phase 1                    Phase 2                    Phase 3
Single VPS                 Multi-Tenant               Kubernetes
(1-50 customers)           (50-200 customers)         (200+ customers)
─────────────────          ─────────────────          ─────────────────
┌─────────────┐            ┌─────────────────┐        ┌───────────────────┐
│  CCX23      │            │  CCX43 + DB     │        │  K8s Cluster      │
│  All-in-one │     →      │  Shared infra   │   →    │  Per-tenant NS    │
│             │            │  Tenant isolate │        │  Auto-scaling     │
└─────────────┘            └─────────────────┘        └───────────────────┘
   €35/mo                     €200/mo                    €500+/mo
```

## Phase 1: Single VPS (Current)

**Infrastructure:**
- Hetzner CCX23 (4 vCPU, 16GB RAM, 160GB NVMe)
- Single OpenClaw instance
- SQLite database
- All services on one machine

**Scaling triggers to Phase 2:**
- >30 active customers
- >50 concurrent agent sessions
- Response latency >2s consistently
- Memory usage >80%

**Cost:** ~€35/month

## Phase 2: Multi-Tenant Shared Infrastructure

**Infrastructure:**
```
┌─────────────────────────────────────────────────────────────┐
│  Load Balancer (Hetzner LB)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Gateway (rate limiting, auth, routing)         │   │
│  └─────────────────────────────────────────────────────┘   │
│            │                           │                    │
│  ┌─────────┴─────────┐     ┌──────────┴──────────┐        │
│  │  App Server 1     │     │  App Server 2       │        │
│  │  (Backend)        │     │  (Backend)          │        │
│  └───────────────────┘     └─────────────────────┘        │
│            │                           │                    │
│  ┌─────────┴───────────────────────────┴─────────┐        │
│  │  OpenClaw Cluster (HA)                         │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │        │
│  │  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │     │        │
│  │  └──────────┘  └──────────┘  └──────────┘     │        │
│  └────────────────────────────────────────────────┘        │
│            │                                                │
│  ┌─────────┴─────────────────────────────────────┐        │
│  │  Managed PostgreSQL (Hetzner)                  │        │
│  │  + Redis for caching/queues                    │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Tenant Isolation:**
- All data scoped by `organizationId`
- Rate limiting per organization
- Resource quotas per plan tier
- Separate encryption keys per tenant

**Database schema for multi-tenancy:**
```sql
-- All tables include organizationId
CREATE TABLE agent_instance (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  openclaw_agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_instance_org ON agent_instance(organization_id);
```

**Scaling triggers to Phase 3:**
- >150 active customers
- Enterprise customers needing dedicated resources
- Compliance requirements (data isolation)
- >500 concurrent sessions

**Cost:** ~€200-400/month

## Phase 3: Kubernetes Multi-Tenant

**Infrastructure:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner Kubernetes (hcloud k8s)                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Shared Services Namespace                                 │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │ Ingress  │ │ API GW   │ │ Billing  │ │ Monitor  │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Tenant Namespace: acme-corp                               │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │ │
│  │  │OpenClaw  │ │ Workers  │ │  Redis   │  Network Policy   │ │
│  │  │ (1-3)    │ │ (1-5)    │ │          │  isolates traffic │ │
│  │  └──────────┘ └──────────┘ └──────────┘                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Tenant Namespace: bigco-inc                               │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │ │
│  │  │OpenClaw  │ │ Workers  │ │  Redis   │  Dedicated PVC    │ │
│  │  │ (3-5)    │ │ (5-10)   │ │          │  for data         │ │
│  │  └──────────┘ └──────────┘ └──────────┘                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Managed Database Cluster                                  │ │
│  │  PostgreSQL (per-tenant schemas or databases)              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Per-tenant isolation:**
- Kubernetes Namespace per tenant
- NetworkPolicy for traffic isolation
- ResourceQuota for CPU/memory limits
- Separate PersistentVolumes for data
- Optional: dedicated database per tenant

**Horizontal Pod Autoscaler:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openclaw-hpa
  namespace: tenant-${TENANT_ID}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openclaw
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Cost:** €500-2000+/month depending on scale

## Plan-Based Resource Allocation

| Plan | Max Agents | Max Sessions/mo | Memory | Custom Tools | Dedicated? |
|------|------------|-----------------|--------|--------------|------------|
| Starter | 2 | 100 | 256MB | No | Shared |
| Growth | 10 | 1,000 | 1GB | Yes | Shared |
| Enterprise | Unlimited | Unlimited | Custom | Yes | Optional |

## Customer Self-Service Flow

```
1. Customer signs up for OmniDial
   └─→ Organization created in database

2. Customer selects plan (Starter/Growth/Enterprise)
   └─→ Plan limits configured

3. Provisioning service auto-creates default agents
   └─→ OpenClaw agents created
   └─→ Tools registered
   └─→ Memory initialized

4. Customer configures agents via UI
   └─→ Update system prompts
   └─→ Add custom tools (Growth+)
   └─→ Configure workflows

5. Customer uses agents
   └─→ Sessions created
   └─→ Usage tracked
   └─→ Billing updated

6. Auto-scaling (Enterprise)
   └─→ HPA scales pods
   └─→ Resources allocated
```

## Provisioning API

```typescript
// Auto-provision on org creation
POST /api/internal/provision
{
  "organizationId": "org_xxx",
  "plan": "growth",
  "defaults": {
    "agents": ["lead_qualifier", "sms_responder"]
  }
}

// Customer creates custom agent
POST /api/agents
{
  "type": "custom",
  "name": "My Sales Agent",
  "systemPrompt": "You are...",
  "tools": ["search_leads", "send_email"]
}

// Scale enterprise customer
POST /api/internal/scale
{
  "organizationId": "org_xxx",
  "dedicated": true,
  "replicas": 3
}
```

## Migration Strategy

### Phase 1 → Phase 2
1. Set up managed PostgreSQL
2. Migrate data from SQLite
3. Deploy second app server
4. Add load balancer
5. Switch DNS
6. Decommission old setup

### Phase 2 → Phase 3
1. Set up Kubernetes cluster
2. Deploy shared services
3. Create tenant namespace template
4. Migrate tenants one-by-one
5. Start with enterprise customers
6. Gradually migrate all tenants

## Monitoring & Observability

**Metrics to track:**
- Agent response latency (p50, p95, p99)
- Sessions per tenant
- Token usage per tenant
- Error rates
- Memory/CPU utilization
- Cost per tenant

**Tools:**
- Prometheus + Grafana for metrics
- Loki for logs
- Jaeger for tracing
- PagerDuty/Opsgenie for alerts

## Cost Optimization

1. **Right-size pods**: Start small, scale up based on usage
2. **Spot instances**: Use for non-critical workloads
3. **Reserved capacity**: Commit to base load for discounts
4. **Idle shutdown**: Scale to zero for inactive tenants
5. **Cache aggressively**: Reduce LLM API calls
