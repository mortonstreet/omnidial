# OmniDial - Functionality Testing Specification

## Overview
This document tracks the bugs and functionality that need to be tested locally before pushing to main branch and production.

**Last Updated:** Testing in progress
**Test Environment:** Cloudflared tunnel to backend, production URLs

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Twilio Credentials | Working | Saved via Settings tab |
| Device Registration | BUG | 400 on /api/dialer/token - "No active organization" |
| Outbound Calls | BUG | Calls connect then immediately cancel |
| Phone Numbers | Blocked | Can't load - device init fails first |
| Dispositions | BUG | 400 on /api/dispositions - "No active organization" |
| Dashboard Analytics | Needs Testing | Comprehensive testing needed |

---

## Console Errors Captured

```
GET https://api.omnidial.io/api/dispositions 400 (Bad Request)
GET https://api.omnidial.io/api/dialer/token 400 (Bad Request)
Failed to initialize Twilio device: Error: Failed to get capability token
```

**Root Cause Analysis:**
Both endpoints check `req.session?.activeOrganizationId` and return 400 if not present:
- `dialer.controller.ts:76-79` - getCapabilityToken
- `dialer.controller.ts:263-266` - listDispositions

Possible causes:
1. Session cookie not being sent with cross-origin requests
2. `activeOrganizationId` not set in session after organization selection
3. Auth middleware not properly populating session
4. CORS/cookie domain configuration issue

---

## Modified Components (Pending Changes)

### Backend Changes
- `backend/src/api/controllers/dialer.controller.ts`
- `backend/src/api/routes/dialer.ts`
- `backend/src/config/index.ts`
- `backend/src/lib/twilio.ts`
- `backend/src/repositories/analytics.repository.ts`
- `backend/src/services/dialer.service.ts`

### Frontend Changes
- `frontend/app/dashboard/dialer/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/dialer/DialerPanel.tsx`
- `frontend/hooks/api/useDialer.ts`
- `frontend/lib/api.ts`
- `frontend/lib/config.ts`

---

## Known Bugs

### BUG-001: Token Endpoint Returns 400 - "No Active Organization" (BLOCKING)
**Status:** Active - HIGHEST PRIORITY
**Severity:** Critical
**Endpoint:** `GET /api/dialer/token`
**Error:** `400 Bad Request`

**Code Location:**
```typescript
// backend/src/api/controllers/dialer.controller.ts:73-88
export const getCapabilityToken: AuthRequestHandler<GetCapabilityTokenRequest> = async (req, res) => {
  const organizationId = req.session?.activeOrganizationId
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  // ...
}
```

**Investigation Steps:**
1. Check if session cookie is being sent (check Network tab, Cookie header)
2. Verify `activeOrganizationId` is set when user selects organization
3. Check CORS configuration for `api.omnidial.io` ↔ `omnidial.io`
4. Verify auth middleware is correctly parsing session

**Likely Fix Areas:**
- `backend/src/api/middlewares/auth.ts` - session handling
- CORS cookie settings (`credentials: true`, `sameSite: 'none'`, `secure: true`)
- Better-auth session configuration

---

### BUG-002: Dispositions Endpoint Returns 400 (BLOCKING)
**Status:** Active
**Severity:** High
**Endpoint:** `GET /api/dispositions`
**Error:** `400 Bad Request`

**Same root cause as BUG-001** - `activeOrganizationId` not in session

---

### BUG-003: Calls Connect Then Immediately Cancel
**Status:** Active
**Severity:** High (blocked by BUG-001)
**Symptoms:**
- Call initiates and connects to Twilio
- Call immediately transitions to "completed" state
- Post-call disposition modal appears prematurely
- Actual call never stays connected

**Suspected Cause:**
- Frontend state management receiving premature `disconnect` event
- TwiML response issue causing Twilio to end call
- Status callback handling

**Files to Investigate:**
- `frontend/hooks/api/useDialer.ts:176-184` - disconnect event handling
- `frontend/components/dialer/DialerPanel.tsx:81-87` - state transition handling
- Backend webhook TwiML response

---

### BUG-004: Disposition Not Saving
**Status:** Active (blocked by BUG-001/002)
**Severity:** Medium
**Symptoms:**
- Disposition selection doesn't persist to database

**Files to Investigate:**
- `frontend/components/dialer/DispositionSelector.tsx`
- `backend/src/services/dialer.service.ts:245-250`

---

## Features to Test (After Bug Fixes)

### 1. Twilio Device Initialization
- [ ] Device connects successfully with valid credentials
- [ ] Device shows "Ready" status indicator (green dot)
- [ ] Device handles connection errors gracefully
- [ ] Token refresh works when approaching expiration
- [ ] Console shows "Twilio device registered" message

### 2. Dialer Settings (Admin/Owner Only)
- [ ] Settings tab only visible to admin/owner roles
- [ ] Non-admin users see only Dialer and History tabs
- [ ] Can create new Twilio configuration
- [ ] Can update existing Twilio configuration
- [ ] Phone numbers fetch from Twilio account
- [ ] Refresh phone numbers button works

### 3. Outbound Calling
- [ ] "From" number selector shows available Twilio numbers
- [ ] Can initiate outbound call
- [ ] Call state transitions correctly through all states
- [ ] Call duration timer works
- [ ] Mute/unmute toggles correctly
- [ ] End call button terminates call

### 4. Post-Call Flow
- [ ] Disposition modal appears ONLY after call actually ends
- [ ] Can select and save disposition
- [ ] Call duration resets after disposition

### 5. Dashboard Analytics
- [ ] Dashboard shows today's call metrics
- [ ] Metrics update after completing calls

### 6. Call History
- [ ] Call history displays past calls
- [ ] Call details show correctly

---

## Debugging Checklist

### Step 1: Verify Session Contains activeOrganizationId
```javascript
// In browser console after logging in and selecting org:
document.cookie // Check for session cookie
```

Check backend logs when making request:
```bash
# In backend terminal, log req.session
console.log('Session:', req.session)
```

### Step 2: Verify CORS Configuration
Backend should have:
```typescript
cors({
  origin: 'https://omnidial.io',
  credentials: true,
})
```

Cookies should have:
```
SameSite=None; Secure
```

### Step 3: Check Auth Middleware
Verify `withBetterAuth` middleware properly populates:
- `req.user`
- `req.session`
- `req.session.activeOrganizationId`

---

## Test Environment Setup

### Current Configuration
- [x] Twilio account with valid credentials
- [x] Twilio API Key and Secret configured
- [x] TwiML App SID configured
- [x] Cloudflared tunnel for webhook access
- [ ] Session/auth issue resolved
- [ ] Backend server running without errors
- [ ] Frontend server running

### Environment Variables Required
```bash
# Backend (.env)
TELNYX_TEXML_APP_ID=your-texml-application-id
BACKEND_URL=https://your-cloudflared-url

# Encryption for API key storage
ENCRYPTION_KEY=your-encryption-key

# Telnyx API credentials
TELNYX_API_KEY=KEYxxxxxxxxxx
TELNYX_ACCOUNT_SID=your-telnyx-account-sid
TELNYX_PUBLIC_KEY=your-webhook-public-key
```

---

## Next Steps

1. **Fix BUG-001 (Token 400)** - This is blocking everything
   - Debug why `activeOrganizationId` is not in session
   - Check better-auth organization middleware
   - Verify session cookies are being sent cross-origin

2. **Once device initializes** - Test outbound calling
   - Debug call state transitions
   - Check TwiML webhook responses

3. **Test disposition saving**
   - Verify API endpoint works
   - Check database writes

4. **Full regression testing**
   - All features end-to-end
   - Document any remaining issues

---

## Interview Notes

**Session Date:** Current

**Key Findings:**
1. Twilio credentials are saved and working
2. Using Cloudflared for local webhook tunneling
3. **Critical:** API endpoints return 400 because `activeOrganizationId` not in session
4. Device fails to initialize due to token endpoint 400
5. Calls were connecting then immediately canceling (needs re-test after fix)
6. Dispositions not loading or saving
