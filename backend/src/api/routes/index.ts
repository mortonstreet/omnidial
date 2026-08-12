import { Router } from 'express'
import { pingRedis } from '@/lib/redis'
import { getTelnyxHealth } from '@/services/telnyxHealth.service'
import exampleRoutes from './example'
import adminRoutes from './admin'
import organizationRoutes from './organization'
import userRoutes from './user'
import notificationRoutes from './notification'
import pusherRoutes from './pusher'
import pipelineRoutes from './pipeline'
import leadsRoutes from './leads'
import tasksRoutes from './tasks'
import notesRoutes from './notes'
import campaignRoutes from './campaigns'
import dialerRoutes from './dialer'
import callsRoutes from './calls'
import voicemailDropsRoutes from './voicemail-drops'
import voicemailGreetingsRoutes from './voicemail-greetings'
import voicemailInboxRoutes from './voicemail-inbox'
import dispositionsRoutes from './dispositions'
import telnyxWebhookRoutes from './webhooks/telnyx'
import slackWebhookRoutes from './webhooks/slack'
import stripeWebhookRoutes from './webhooks/stripe'
import clerkWebhookRoutes from './webhooks/clerk'
import hubspotWebhookRoutes from './webhooks/hubspot'
import listsRoutes from './lists'
import clientsRoutes from './clients'
import activityRoutes from './activity'
import scheduleRoutes from './schedule'
import analyticsRoutes from './analytics'
import scriptsRoutes from './scripts'
import powerDialerRoutes from './powerDialer'
import apiKeysRoutes from './api-keys'
import integrationsRoutes from './integrations'
import clientUserAssignmentsRoutes from './clientUserAssignments'
import coachingRoutes from './coaching'
import callIntelligenceRoutes from './callIntelligence'
// OmniDial Enhancements
import parallelDialerRoutes from './parallelDialer'
import predictiveScoringRoutes from './predictiveScoring'
import salesFloorRoutes from './salesFloor'
import liveCoachRoutes from './liveCoach'
import localPresenceRoutes from './localPresence'
import enrichmentRoutes from './enrichment'
import researchRoutes from './research'
import repProfileRoutes from './repProfile'
import notificationSettingsRoutes from './notificationSettings'
import slackRoutes from './slack'
import extensionRoutes from './extension'
import crmRoutes from './crm'
import dncRoutes from './dnc'
import smsCampaignsRoutes from './smsCampaigns'
import agentRoutes from './agent'
import orchestrationRoutes from './orchestration'
import phoneSetupRoutes from './phoneSetup'
import billingRoutes from './billing'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Dependency health, reported separately from /health so a degraded
// dependency never fails the Railway healthcheck and takes the app down.
router.get('/health/deps', async (req, res) => {
  const [redis, telnyx] = await Promise.all([pingRedis(), getTelnyxHealth()])
  res.json({ status: 'ok', redis, telnyx })
})

// Polled by the dialer so reps see "carrier degraded" instead of an opaque
// failure. Cached in the service, so frequent polling costs no extra API calls.
router.get('/health/telnyx', async (req, res) => {
  const telnyx = await getTelnyxHealth()
  res.json(telnyx)
})

router.use('/example', exampleRoutes)
router.use('/admin', adminRoutes)
router.use('/organization', organizationRoutes)
router.use('/user', userRoutes)
router.use('/notifications', notificationRoutes)
router.use('/pusher', pusherRoutes)
router.use('/pipeline-stages', pipelineRoutes)
router.use('/leads', leadsRoutes)
router.use('/tasks', tasksRoutes)
router.use('/notes', notesRoutes)
router.use('/campaigns', campaignRoutes)
router.use('/dialer', dialerRoutes)
router.use('/calls', callsRoutes)
router.use('/voicemail-drops', voicemailDropsRoutes)
router.use('/voicemail-greetings', voicemailGreetingsRoutes)
router.use('/voicemail-inbox', voicemailInboxRoutes)
router.use('/dispositions', dispositionsRoutes)
router.use('/webhooks/telnyx', telnyxWebhookRoutes)
router.use('/webhooks/slack', slackWebhookRoutes)
router.use('/webhooks/stripe', stripeWebhookRoutes)
router.use('/webhooks/clerk', clerkWebhookRoutes)
router.use('/webhooks/hubspot', hubspotWebhookRoutes)
router.use('/lists', listsRoutes)
router.use('/clients', clientsRoutes)
router.use('/activity', activityRoutes)
router.use('/schedule', scheduleRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/scripts', scriptsRoutes)
router.use('/power-dialer', powerDialerRoutes)
router.use('/api-keys', apiKeysRoutes)
router.use('/integrations', integrationsRoutes)
router.use('/client-user-assignments', clientUserAssignmentsRoutes)
router.use('/coaching', coachingRoutes)
router.use('/call-intelligence', callIntelligenceRoutes)
// OmniDial Enhancements
router.use('/parallel-dialer', parallelDialerRoutes)
router.use('/predictive-scoring', predictiveScoringRoutes)
router.use('/sales-floor', salesFloorRoutes)
router.use('/live-coach', liveCoachRoutes)
router.use('/local-presence', localPresenceRoutes)
router.use('/enrichment', enrichmentRoutes)
router.use('/research', researchRoutes)
router.use('/rep-profiles', repProfileRoutes)
router.use('/notification-settings', notificationSettingsRoutes)
router.use('/slack', slackRoutes)
router.use('/extension', extensionRoutes)
router.use('/crm', crmRoutes)
router.use('/dnc', dncRoutes)
router.use('/sms-campaigns', smsCampaignsRoutes)
router.use('/agents', agentRoutes)
router.use('/orchestration', orchestrationRoutes)
router.use('/phone-setup', phoneSetupRoutes)
router.use('/billing', billingRoutes)
router.use('/sentry', (req, res) => {
  throw new Error('Testing sentry error')
})

export const apiRoutes = router
