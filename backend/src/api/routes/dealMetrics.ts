import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  connectGrain,
  getDealMetrics,
  getHubSpotSyncStatus,
  reconcileHubSpot,
  syncHubSpotStages,
  getLeadDealSignals,
  setDealOutcome,
  syncDealSignals,
} from '@/api/controllers/dealMetrics.controller'
import {
  ConnectGrainRequestSchema,
  GetDealMetricsRequestSchema,
  GetHubSpotSyncStatusRequestSchema,
  ReconcileHubSpotRequestSchema,
  GetLeadDealSignalsRequestSchema,
  SetDealOutcomeRequestSchema,
  SyncDealSignalsRequestSchema,
} from '@shared/types/src'

const router = Router()

// Pipeline velocity, stage conversion, deal size, next steps, champions, win/loss
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(GetDealMetricsRequestSchema),
  authenticatedRoute(getDealMetrics),
)

// Close a deal as won/lost with a reason (moves it to the matching stage)
router.post(
  '/leads/:leadId/outcome',
  withBetterAuth,
  validateAndMerge(SetDealOutcomeRequestSchema),
  authenticatedRoute(setDealOutcome),
)

// AI-scored touchpoints (calls, email threads, meetings) for one lead
router.get(
  '/leads/:leadId/signals',
  withBetterAuth,
  validateAndMerge(GetLeadDealSignalsRequestSchema),
  authenticatedRoute(getLeadDealSignals),
)

// Score new calls / Gmail threads / Grain meetings now
router.post(
  '/signals/sync',
  withBetterAuth,
  validateAndMerge(SyncDealSignalsRequestSchema),
  authenticatedRoute(syncDealSignals),
)

// Grain uses a personal/workspace API token rather than OAuth
router.post(
  '/grain/connect',
  withBetterAuth,
  validateAndMerge(ConnectGrainRequestSchema),
  authenticatedRoute(connectGrain),
)

// HubSpot two-way sync health: scopes, stage mapping, counts, recent events
router.get(
  '/hubspot/status',
  withBetterAuth,
  validateAndMerge(GetHubSpotSyncStatusRequestSchema),
  authenticatedRoute(getHubSpotSyncStatus),
)

// Add OmniDial stages missing from HubSpot's stage dropdown, then re-map
router.post(
  '/hubspot/stages/sync',
  withBetterAuth,
  validateAndMerge(GetHubSpotSyncStatusRequestSchema),
  authenticatedRoute(syncHubSpotStages),
)

// Compare every linked lead with HubSpot; fix=true converges (newest edit wins)
router.post(
  '/hubspot/reconcile',
  withBetterAuth,
  validateAndMerge(ReconcileHubSpotRequestSchema),
  authenticatedRoute(reconcileHubSpot),
)

export default router
