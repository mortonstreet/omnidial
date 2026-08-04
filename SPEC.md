# Project: OmniDial

## Objective

A low-cost, browser-based VoIP sales dialer powered by Twilio, designed for SDRs, account executives, and inside sales teams. Competing with Dialpad, Aircall, and similar tools on price while delivering a more powerful lead context experience during calls.

## Success Criteria

- [ ] Users can make outbound calls from the browser via Twilio
- [ ] Users can receive inbound callbacks and have them logged
- [ ] Power dialer mode auto-advances through campaign lead lists
- [ ] All calls are recorded with visible recording status indicator
- [ ] Reps can drop pre-recorded voicemails
- [ ] CSV upload creates campaigns with enriched lead context
- [ ] Native CRM with pipeline, deals, and call history
- [ ] Multi-tenant with Admin/Rep roles and Stripe billing
- [ ] Analytics dashboard with call metrics and rep leaderboards

---

## Feature Modules (Active Development)

**IMPORTANT:** Each module below is designed for independent development. Only work on ONE module per Claude session to prevent merge conflicts.

| Module | Spec File | Owner Files | Status |
|--------|-----------|-------------|--------|
| Dashboard | [specs/dashboard.md](specs/dashboard.md) | `app/dashboard/page.tsx`, `components/dashboard/*` | Ready |
| Settings | [specs/settings.md](specs/settings.md) | `app/dashboard/settings/*`, `components/settings/*` | Ready |
| CRM Pipeline | [specs/crm.md](specs/crm.md) | `app/dashboard/crm/*`, `components/crm/*` | Ready |
| Campaigns | [specs/campaigns.md](specs/campaigns.md) | `app/dashboard/campaigns/*`, `components/campaigns/*` | Ready |
| Leads | [specs/leads.md](specs/leads.md) | `app/dashboard/leads/*`, `components/leads/*` | Ready |
| Dialer | [specs/dialer.md](specs/dialer.md) | `app/dashboard/dialer/*`, `components/dialer/*` | Ready |
| Analytics | [specs/analytics.md](specs/analytics.md) | `app/dashboard/analytics/*`, `components/analytics/*` | Deprecated (→Dashboard) |

### Before Starting a Module

1. Read the full spec file for your assigned module
2. Only modify files listed in the "Files to Modify" section
3. For shared files (schema, types), create new files instead of editing existing
4. Follow implementation order in the spec
5. Run tests before committing

### Shared File Guidelines

These files may be touched by multiple modules - coordinate carefully:

- `shared/db/prisma/schema.prisma` - Add migrations, don't edit directly
- `shared/types/src/requests/` - Create new type files per module
- `frontend/lib/config.ts` - Add endpoints only, don't modify existing

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                        │
│                         Next.js + React                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Dialer    │  │  Campaigns  │  │  Analytics  │              │
│  │     UI      │  │   & CRM     │  │  Dashboard  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│              ┌───────────▼───────────┐                          │
│              │   Twilio Client SDK   │ (WebRTC)                 │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Railway)                         │
│                        Express + Node.js                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Auth     │  │   Twilio    │  │   Stripe    │              │
│  │ better-auth │  │  Webhooks   │  │  Webhooks   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                          │                                       │
│              ┌───────────▼───────────┐                          │
│              │    Business Logic     │                          │
│              │  (Services/Repos)     │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Postgres   │    │    Redis    │    │   Twilio    │
│  (Supabase) │    │  (Upstash)  │    │    API      │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Core Data Structures

#### Tenant (Organization)
```typescript
{
  id: string;                    // uuid
  name: string;                  // "Acme Sales Corp"
  slug: string;                  // "acme-sales" (for URLs)
  twilioAccountSid: string;      // Tenant's Twilio credentials
  twilioAuthToken: string;       // encrypted
  twilioPhoneNumbers: string[];  // purchased numbers
  stripeCustomerId: string;
  plan: "starter" | "pro";       // $20/mo base
  createdAt: timestamp;
}
```

#### User
```typescript
{
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: "admin" | "rep";
  avatarUrl?: string;
  createdAt: timestamp;
}
```

#### Campaign
```typescript
{
  id: string;
  tenantId: string;
  createdById: string;           // user who created
  name: string;                  // "Q1 Enterprise Outreach"
  type: "personal" | "team";
  status: "active" | "paused" | "completed";
  assignedUserIds: string[];     // for team campaigns
  leadCount: number;
  dialedCount: number;
  connectedCount: number;
  createdAt: timestamp;
}
```

#### Lead
```typescript
{
  id: string;
  tenantId: string;

  // Core fields
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;                 // E.164 format
  company?: string;
  title?: string;
  linkedInUrl?: string;

  // Flexible CSV data
  customFields: Record<string, string>;  // any additional CSV columns

  // CRM fields
  pipelineStage: string;         // references PipelineStage
  dealValue?: number;

  // Tracking
  campaignIds: string[];         // campaigns this lead appears in
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

#### CampaignLead (junction table for campaign-specific state)
```typescript
{
  id: string;
  campaignId: string;
  leadId: string;
  assignedUserId?: string;       // for round-robin in team campaigns
  status: "pending" | "dialed" | "completed";
  dialOrder: number;             // position in power dial sequence
  createdAt: timestamp;
}
```

#### Call
```typescript
{
  id: string;
  tenantId: string;
  userId: string;                // rep who made/received call
  leadId?: string;               // null for unknown inbound callers
  campaignId?: string;

  // Twilio data
  twilioCallSid: string;
  fromNumber: string;
  toNumber: string;
  direction: "outbound" | "inbound";  // track call direction

  // Call metadata
  status: "initiated" | "ringing" | "in-progress" | "completed" | "failed" | "missed";
  disposition?: string;          // "connected" | "voicemail" | "not_interested" | custom
  duration: number;              // seconds
  recordingUrl?: string;
  recordingSid?: string;
  voicemailDropped: boolean;

  // Timestamps
  startedAt: timestamp;
  answeredAt?: timestamp;
  endedAt?: timestamp;
}
```

#### Disposition (customizable per tenant)
```typescript
{
  id: string;
  tenantId: string;
  label: string;                 // "Connected", "Voicemail", etc.
  color: string;                 // for UI badges
  isDefault: boolean;            // system defaults vs custom
  sortOrder: number;
}
```

#### PipelineStage (customizable per tenant)
```typescript
{
  id: string;
  tenantId: string;
  label: string;                 // "New", "Contacted", "Qualified", etc.
  color: string;
  sortOrder: number;
  isDefault: boolean;
}
```

#### VoicemailDrop
```typescript
{
  id: string;
  tenantId: string;
  userId: string;                // rep who recorded it
  name: string;                  // "Intro VM", "Follow-up VM"
  recordingUrl: string;          // stored in S3 or Twilio
  duration: number;              // seconds
  createdAt: timestamp;
}
```

#### Task (follow-up reminders)
```typescript
{
  id: string;
  tenantId: string;
  userId: string;
  leadId: string;
  title: string;                 // "Follow up call"
  dueAt: timestamp;
  completedAt?: timestamp;
  createdAt: timestamp;
}
```

### System Boundaries

**In Scope (v1):**
- Browser-based outbound calling via Twilio Client SDK
- Inbound call handling for callbacks (ring in browser, log calls)
- Click-to-dial and power dialer modes
- Campaign management with CSV import
- Call recording, playback, and download
- Voicemail drop (record in-app)
- Native CRM (leads, pipeline, deals, tasks)
- Multi-tenant with Admin/Rep roles
- Analytics dashboard
- Stripe billing integration

**External Interfaces:**
- Twilio: Voice API, Client SDK, Recordings API
- Stripe: Subscriptions, Checkout, Webhooks
- Supabase: Postgres database
- Upstash: Redis for caching/sessions
- Vercel: Frontend hosting
- Railway: Backend hosting

---

## Constraints & Tradeoffs

### Non-negotiable

- All calls must be recorded (with visible indicator showing recording is active)
- Call data must be isolated per tenant (multi-tenant security)
- Power dialer must show rich lead context during calls
- Browser-based only (no desktop/mobile apps for v1)
- Must handle Twilio webhooks reliably (call status, recordings)
- Inbound calls must be logged even if missed

### Acceptable Tradeoffs

- LinkedIn integration can be a simple link (not embedded view) if technical constraints block iframe/auth approach
- Lead enrichment is out of scope - users pre-enrich before CSV upload
- No real-time sync to external CRMs (HubSpot/Salesforce) in v1
- Round-robin is the only team campaign assignment strategy for v1
- Single voicemail drop per rep at a time (no mid-call selection from library) - TBD if this is limiting
- Inbound calls only match to existing leads by phone number (no IVR or smart routing)

### Out of Scope (v1)

- SMS/text messaging
- Mobile or desktop applications
- HubSpot/Salesforce integrations
- Predictive dialer (multi-line)
- Call transcription
- AI call analysis
- Lead enrichment APIs
- Custom call routing/IVR (beyond basic inbound handling)
- International calling (US/Canada only initially) - TBD

---

## Implementation Strategy

### Tech Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js 14+ (App Router), React, Tailwind, shadcn/ui | Vercel |
| Backend | Express.js, Node.js | Railway |
| Database | PostgreSQL | Supabase |
| Cache | Redis | Upstash |
| Auth | better-auth | Self-hosted (backend) |
| Telephony | Twilio Client SDK, Voice API | Twilio |
| Payments | Stripe Subscriptions | Stripe |
| File Storage | S3 or Twilio | TBD |

### Preferred Patterns

**Backend:**
- Follow `route → controller → service → repository` pattern per CLAUDE.md
- All Twilio webhook handlers in dedicated `/webhooks/twilio` routes
- Use transactions for multi-table operations (e.g., creating campaign + leads)
- Queue long-running tasks (CSV processing) via Redis/BullMQ

**Frontend:**
- Server Components by default, Client Components for interactivity
- Real-time call state via WebSocket or polling
- Optimistic UI updates for disposition logging
- React Query for server state, Zustand for client state (call UI)

**Database:**
- All IDs are UUIDs
- Soft deletes for leads/campaigns (preserve call history)
- Indexes on: `tenantId`, `campaignId`, `leadId`, `userId`, `createdAt`
- Row-level security considerations for multi-tenant

### Anti-patterns

- No direct database calls outside repositories
- No business logic in controllers
- No Twilio credentials in frontend code
- No polling for call status (use webhooks)
- No synchronous CSV processing (queue it)

### Optimization Parameters

- CSV upload limit: TBD - needs testing (start with 10,000 rows)
- Max concurrent calls per tenant: TBD - depends on Twilio limits
- Call recording retention: TBD - cost implications
- Power dialer auto-advance delay: TBD - user preference likely 1-3 seconds

---

## Feature Specifications

### 1. Dialer UI

**Click-to-Dial Mode:**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 LEAD CONTEXT PANEL                   │   │
│  │  ┌─────────┐                                        │   │
│  │  │ Avatar  │  John Smith                            │   │
│  │  │         │  VP of Sales @ Acme Corp               │   │
│  │  └─────────┘  john@acme.com                         │   │
│  │               +1 (555) 123-4567                     │   │
│  │                                                     │   │
│  │  LinkedIn: [View Profile →]                         │   │
│  │                                                     │   │
│  │  ┌─ Custom Fields ─────────────────────────────┐   │   │
│  │  │ Industry: SaaS                               │   │   │
│  │  │ Company Size: 50-100                         │   │   │
│  │  │ Revenue: $5M ARR                             │   │   │
│  │  │ Notes: Met at SaaStr conference              │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─ Call History ──────────────────────────────┐   │   │
│  │  │ Jan 3 - Voicemail (0:32) [▶ Play]           │   │   │
│  │  │ Dec 28 - Connected (4:12) [▶ Play]          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─ Campaigns ─────────────────────────────────┐   │   │
│  │  │ Q1 Enterprise, Winter Reactivation          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    DIAL CONTROLS                     │   │
│  │                                                     │   │
│  │   🔴 Recording Active                               │   │
│  │                                                     │   │
│  │   ┌─────────────────────────────────────────────┐   │   │
│  │   │              00:00:00                        │   │   │
│  │   │                                             │   │   │
│  │   │    [  🔇 Mute  ]  [  📞 End Call  ]         │   │   │
│  │   │                                             │   │   │
│  │   │    [ 📩 Drop Voicemail ]                    │   │   │
│  │   └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │   Disposition:                                      │   │
│  │   [ Connected ] [ Voicemail ] [ Not Interested ]   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Power Dialer Mode:**
- Same as above, plus:
- Lead queue sidebar showing upcoming leads
- "Next" and "Previous" navigation buttons
- Auto-advance toggle with configurable delay
- Progress indicator (e.g., "12 of 347 leads")

### 2. Inbound Call Handling

**When an inbound call arrives:**

```
┌─────────────────────────────────────────────────────────────┐
│                     INCOMING CALL                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │   📞 Incoming Call                                  │   │
│  │                                                     │   │
│  │   ┌─────────┐                                      │   │
│  │   │ Avatar  │  John Smith        (if matched)      │   │
│  │   │         │  VP Sales @ Acme                     │   │
│  │   └─────────┘  +1 (555) 123-4567                   │   │
│  │                                                     │   │
│  │   OR                                                │   │
│  │                                                     │   │
│  │   📞 Unknown Caller                                │   │
│  │      +1 (555) 999-8888                             │   │
│  │                                                     │   │
│  │   ┌──────────────┐  ┌──────────────┐              │   │
│  │   │   Answer     │  │   Decline    │              │   │
│  │   └──────────────┘  └──────────────┘              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Inbound Call Flow:**
1. Twilio webhook hits backend when call comes in
2. Backend looks up caller phone number → matches to existing lead if found
3. Backend returns TwiML to connect call to the rep's browser via Twilio Client
4. Frontend shows incoming call modal with caller info (if matched)
5. Rep answers → call connects, recording starts
6. Rep declines or misses → call logged as "missed"
7. After call ends → disposition UI shown (same as outbound)

**Caller ID Matching:**
- Lookup inbound number against all leads in tenant
- If matched: show lead context during call
- If not matched: show "Unknown Caller" with option to create new lead after call

**Missed Call Handling:**
- If rep doesn't answer within 30 seconds (configurable), mark as missed
- Log missed call in call history
- If caller is a known lead, update their last activity

### 3. Campaign Management

**Campaign List View:**
- Table with: Name, Type (personal/team), Status, Leads, Dialed, Connected, Created
- Filters: My Campaigns, Team Campaigns, All
- Actions: Create, Edit, Pause, Delete, Export Results

**Campaign Detail View:**
- Stats header: Total leads, dialed, connected, conversion rate
- Lead list with status indicators and quick-dial buttons
- For team campaigns: assignment view showing which rep has which leads
- CSV re-upload option (append or replace)

**CSV Upload:**
- Drag-and-drop or file picker
- Column mapping UI (map CSV columns to lead fields)
- Preview first 10 rows before import
- Background processing with progress indicator
- Required columns: phone (everything else optional)
- Schema documentation available for download

### 4. Native CRM

**Pipeline View:**
```
┌─────────────────────────────────────────────────────────────┐
│  NEW (12)    CONTACTED (8)   QUALIFIED (5)   MEETING (3)   │
│  ┌───────┐   ┌───────┐       ┌───────┐       ┌───────┐     │
│  │ Lead  │   │ Lead  │       │ Lead  │       │ Lead  │     │
│  │ Card  │   │ Card  │       │ Card  │       │ Card  │     │
│  └───────┘   └───────┘       └───────┘       └───────┘     │
│  ┌───────┐   ┌───────┐       ┌───────┐                     │
│  │ Lead  │   │ Lead  │       │ Lead  │                     │
│  └───────┘   └───────┘       └───────┘                     │
│     ...         ...             ...                         │
└─────────────────────────────────────────────────────────────┘
```

- Drag-and-drop leads between stages
- Click lead card to open detail panel
- Deal value shown on cards (if set)
- Filter by campaign, date range, assigned rep

**Lead Detail Panel:**
- All lead fields (editable)
- Pipeline stage selector
- Deal value input
- Full call history with playback (both inbound and outbound)
- Task list with add/complete
- Notes section

### 5. Analytics Dashboard

**Metrics (toggleable time ranges: Today, This Week, This Month, Custom):**
- Total calls (outbound + inbound)
- Outbound calls
- Inbound calls (answered + missed)
- Connected calls (and rate)
- Missed inbound calls
- Total talk time
- Average call duration
- Calls by disposition (pie/bar chart)
- Calls over time (line chart)
- Top performing reps (leaderboard - team campaigns only)

**Call Log:**
- Sortable/filterable table
- Columns: Date, Direction (in/out icon), Lead, Campaign, Duration, Disposition, Rep
- Inline audio player
- Download recording button
- Export to CSV

### 6. Voicemail Drop

**Recording Flow:**
1. User goes to Settings > Voicemail Drops
2. Clicks "Record New"
3. Browser requests microphone permission
4. Records audio (max 60 seconds)
5. Preview playback
6. Save with name

**During Call:**
- "Drop Voicemail" button appears when call is ringing or in voicemail
- One-click drops the pre-recorded message
- Call automatically ends after drop
- Disposition auto-set to "Voicemail"

### 7. Team Management (Admin)

**Team View:**
- List of all reps with: Name, Email, Role, Calls This Month, Last Active
- Invite new rep (email invite flow)
- Remove rep (with confirmation)
- Cannot remove last admin

**Billing (Admin):**
- Current plan display
- Stripe Customer Portal link for managing subscription
- Additional phone numbers: list, add, remove
- Usage stats: total calls, minutes used

---

## Database Schema

```sql
-- Tenants (organizations)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  twilio_account_sid VARCHAR(255),
  twilio_auth_token_encrypted TEXT,
  twilio_phone_numbers TEXT[], -- array of E.164 numbers
  stripe_customer_id VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'rep', -- 'admin' | 'rep'
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'personal', -- 'personal' | 'team'
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'paused' | 'completed'
  lead_count INTEGER DEFAULT 0,
  dialed_count INTEGER DEFAULT 0,
  connected_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign user assignments (for team campaigns)
CREATE TABLE campaign_users (
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, user_id)
);

-- Pipeline stages (customizable per tenant)
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL, -- E.164 format
  company VARCHAR(255),
  title VARCHAR(255),
  linkedin_url TEXT,
  custom_fields JSONB DEFAULT '{}',
  pipeline_stage_id UUID REFERENCES pipeline_stages(id),
  deal_value DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- soft delete
);

-- Campaign-lead junction (tracks per-campaign state)
CREATE TABLE campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'dialed' | 'completed'
  dial_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

-- Dispositions (customizable per tenant)
CREATE TABLE dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  campaign_id UUID REFERENCES campaigns(id),
  twilio_call_sid VARCHAR(255) UNIQUE,
  from_number VARCHAR(50),
  to_number VARCHAR(50),
  direction VARCHAR(20) DEFAULT 'outbound', -- 'outbound' | 'inbound'
  status VARCHAR(50) DEFAULT 'initiated', -- 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'missed'
  disposition_id UUID REFERENCES dispositions(id),
  duration INTEGER DEFAULT 0, -- seconds
  recording_url TEXT,
  recording_sid VARCHAR(255),
  voicemail_dropped BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Voicemail drops (pre-recorded messages)
CREATE TABLE voicemail_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  recording_url TEXT NOT NULL,
  duration INTEGER DEFAULT 0, -- seconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (follow-up reminders)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  title VARCHAR(255) NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes on leads
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_phone ON leads(tenant_id, phone);
CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_assigned ON campaign_leads(assigned_user_id);
CREATE INDEX idx_calls_tenant ON calls(tenant_id);
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_lead ON calls(lead_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_started ON calls(started_at);
CREATE INDEX idx_calls_direction ON calls(tenant_id, direction);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_at);
```

---

## API Endpoints

### Auth (better-auth handles most)
- `POST /api/auth/signup` - Create account + tenant
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Get current session

### Tenant
- `GET /api/tenant` - Get current tenant
- `PATCH /api/tenant` - Update tenant settings
- `POST /api/tenant/twilio` - Configure Twilio credentials

### Users
- `GET /api/users` - List team members
- `POST /api/users/invite` - Invite new rep
- `DELETE /api/users/:id` - Remove user
- `PATCH /api/users/:id/role` - Change role

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign detail
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/upload` - Upload CSV
- `GET /api/campaigns/:id/leads` - Get campaign leads
- `POST /api/campaigns/:id/assign` - Assign leads (round-robin)

### Leads
- `GET /api/leads` - List all leads (with filters)
- `POST /api/leads` - Create lead manually
- `GET /api/leads/:id` - Get lead detail
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Soft delete lead
- `GET /api/leads/:id/calls` - Get lead call history
- `GET /api/leads/lookup?phone=` - Lookup lead by phone (for inbound matching)

### Calls
- `POST /api/calls` - Initiate outbound call
- `GET /api/calls/:id` - Get call detail
- `PATCH /api/calls/:id/disposition` - Set disposition
- `POST /api/calls/:id/voicemail-drop` - Drop voicemail
- `GET /api/calls` - List calls (with filters, direction)

### Twilio Webhooks
- `POST /api/webhooks/twilio/voice` - Outbound call status updates
- `POST /api/webhooks/twilio/voice/inbound` - Inbound call handler
- `POST /api/webhooks/twilio/recording` - Recording ready
- `POST /api/webhooks/twilio/status` - Call status callback

### Voicemail Drops
- `GET /api/voicemail-drops` - List user's voicemail drops
- `POST /api/voicemail-drops` - Create new (with audio upload)
- `DELETE /api/voicemail-drops/:id` - Delete voicemail drop

### Pipeline & CRM
- `GET /api/pipeline-stages` - List stages
- `POST /api/pipeline-stages` - Create stage
- `PATCH /api/pipeline-stages/:id` - Update stage
- `DELETE /api/pipeline-stages/:id` - Delete stage
- `GET /api/tasks` - List user's tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update/complete task
- `DELETE /api/tasks/:id` - Delete task

### Dispositions
- `GET /api/dispositions` - List dispositions
- `POST /api/dispositions` - Create custom disposition
- `PATCH /api/dispositions/:id` - Update disposition
- `DELETE /api/dispositions/:id` - Delete disposition

### Analytics
- `GET /api/analytics/calls` - Call metrics (includes inbound/outbound breakdown)
- `GET /api/analytics/leaderboard` - Rep leaderboard

### Billing
- `POST /api/billing/checkout` - Create Stripe checkout session
- `GET /api/billing/portal` - Get Stripe portal URL
- `POST /api/webhooks/stripe` - Stripe webhooks

---

## Open Questions

### Technical Research Needed

1. **LinkedIn Integration**
   - Can we iframe LinkedIn profiles? (Likely blocked by X-Frame-Options)
   - LinkedIn OAuth is restricted - would need to apply for Marketing Developer Platform access
   - Alternative: Browser extension that injects LinkedIn data? Complex, separate project.
   - **Recommendation for v1:** Simple "View on LinkedIn" link that opens new tab

2. **Call Recording Storage**
   - Option A: Use Twilio's recording storage (simpler, usage-based cost)
   - Option B: Download and store in S3 (more control, fixed cost)
   - Need to evaluate cost at scale

3. **Voicemail Drop Implementation**
   - Twilio's `<Play>` TwiML can play recording when voicemail detected
   - AMD (Answering Machine Detection) has accuracy limitations
   - May need manual "Drop" button rather than auto-detect

4. **Inbound Call Routing**
   - Single rep per phone number? Or ring all online reps?
   - For v1: Route to the last rep who used that number for outbound, or first available
   - Configurable per phone number in settings

### Needs Benchmarking

- CSV upload size limits (start with 10K, test larger)
- Concurrent WebRTC connections per browser tab
- Recording playback performance with many recordings
- Redis session storage sizing

### Business Decisions

- Free trial? If so, how many calls/days?
- What happens when subscription lapses? (Grace period? Immediate lockout?)
- Recording retention policy (forever? 90 days? configurable?)
- International calling - include in v1 or defer?

---

## Reference Examples

### CSV Schema (User Documentation)

Required columns:
- `phone` - Phone number (any format, will be normalized to E.164)

Recommended columns:
- `first_name` - Contact first name
- `last_name` - Contact last name
- `email` - Email address
- `company` - Company name
- `title` - Job title
- `linkedin_url` - LinkedIn profile URL

Any additional columns will be stored in `custom_fields` and displayed in the lead context panel.

Example:
```csv
phone,first_name,last_name,email,company,title,linkedin_url,industry,company_size,notes
+15551234567,John,Smith,john@acme.com,Acme Corp,VP Sales,https://linkedin.com/in/johnsmith,SaaS,50-100,Met at SaaStr
+15559876543,Jane,Doe,jane@example.com,Example Inc,CEO,https://linkedin.com/in/janedoe,Fintech,10-50,Referred by Bob
```

### Default Pipeline Stages

1. New (gray)
2. Contacted (blue)
3. Qualified (yellow)
4. Meeting Booked (purple)
5. Proposal Sent (orange)
6. Closed Won (green)
7. Closed Lost (red)

### Default Dispositions

1. Connected (green)
2. Voicemail (yellow)
3. Not Interested (red)
4. Wrong Number (gray)
5. Callback Requested (blue)

---

## Pricing Model

**Starter Plan: $20/month**
- 1 user included
- Unlimited calls (Twilio usage billed separately)
- 1 phone number included
- All features

**Additional:**
- $5/month per additional phone number
- Additional users: TBD (maybe $10/user/month?)

**Twilio Costs (passed through or absorbed?):**
- Outbound calls: ~$0.014/min
- Phone numbers: ~$1.15/month
- Recordings: ~$0.0025/min storage

**Decision needed:** Do users connect their own Twilio account, or do we provide Twilio and mark up usage?

---

## Implementation Phases

### Phase 1: Foundation
- Project scaffolding (Next.js, Express, Supabase)
- better-auth integration
- Multi-tenant data model
- Basic UI shell with navigation

### Phase 2: Core Dialer
- Twilio Client SDK integration
- Click-to-dial functionality
- Call recording
- Basic call UI

### Phase 3: Inbound Calls
- Inbound webhook handling
- Caller ID matching to leads
- Incoming call UI with answer/decline
- Missed call logging

### Phase 4: Campaigns & Power Dialer
- Campaign CRUD
- CSV upload and processing
- Lead list management
- Power dialer mode with auto-advance

### Phase 5: CRM Features
- Pipeline view with drag-and-drop
- Lead detail panel
- Tasks and notes
- Call history per lead (inbound + outbound)

### Phase 6: Team & Voicemail
- Team campaigns with round-robin
- Voicemail drop recording
- Voicemail drop during calls
- Custom dispositions

### Phase 7: Analytics & Billing
- Analytics dashboard (with inbound/outbound metrics)
- Rep leaderboard
- Stripe integration
- Landing page with pricing

### Phase 8: Polish
- Error handling and edge cases
- Performance optimization
- Mobile-responsive refinements
- User onboarding flow

---

*Last updated: January 5, 2026*
*Review this spec and let me know any corrections or additions.*
