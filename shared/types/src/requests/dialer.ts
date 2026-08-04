import { z } from 'zod';

// === Twilio Config Types ===
export const GetTwilioConfigRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetTwilioConfigRequest = z.infer<typeof GetTwilioConfigRequestSchema>;

export const CreateTwilioConfigRequestSchema = z.object({
  organizationId: z.string().min(1),
  accountSid: z.string().min(1),
  authToken: z.string().min(1),
  phoneNumbers: z.array(z.string()).optional().default([]),
});
export type CreateTwilioConfigRequest = z.infer<typeof CreateTwilioConfigRequestSchema>;

export const UpdateTwilioConfigRequestSchema = z.object({
  organizationId: z.string().min(1),
  accountSid: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  phoneNumbers: z.array(z.string()).optional(),
});
export type UpdateTwilioConfigRequest = z.infer<typeof UpdateTwilioConfigRequestSchema>;

// === Call Types ===
export const CallDirection = z.enum(['outbound', 'inbound']);
export type CallDirection = z.infer<typeof CallDirection>;

export const CallStatus = z.enum(['initiated', 'ringing', 'in-progress', 'completed', 'failed', 'missed']);
export type CallStatus = z.infer<typeof CallStatus>;

export const InitiateCallRequestSchema = z.object({
  toNumber: z.string().min(1),
  fromNumber: z.string().min(1),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});
export type InitiateCallRequest = z.infer<typeof InitiateCallRequestSchema>;

export const GetCallRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetCallRequest = z.infer<typeof GetCallRequestSchema>;

export const ListCallsRequestSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  direction: CallDirection.optional(),
  status: CallStatus.optional(),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dispositionId: z.string().optional(), // Can be UUID or 'null' for calls without disposition
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type ListCallsRequest = z.infer<typeof ListCallsRequestSchema>;

export const UpdateCallDispositionRequestSchema = z.object({
  id: z.string().uuid(),
  dispositionId: z.string().uuid(),
});
export type UpdateCallDispositionRequest = z.infer<typeof UpdateCallDispositionRequestSchema>;

export const DropVoicemailRequestSchema = z.object({
  callId: z.string().uuid(),
  voicemailDropId: z.string().uuid(),
});
export type DropVoicemailRequest = z.infer<typeof DropVoicemailRequestSchema>;

// === Voicemail Drop Types ===
export const GetVoicemailDropRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetVoicemailDropRequest = z.infer<typeof GetVoicemailDropRequestSchema>;

export const ListVoicemailDropsRequestSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
export type ListVoicemailDropsRequest = z.infer<typeof ListVoicemailDropsRequestSchema>;

export const CreateVoicemailDropRequestSchema = z.object({
  name: z.string().min(1).max(255),
  recordingUrl: z.string().url(),
  duration: z.number().int().min(0),
});
export type CreateVoicemailDropRequest = z.infer<typeof CreateVoicemailDropRequestSchema>;

export const DeleteVoicemailDropRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteVoicemailDropRequest = z.infer<typeof DeleteVoicemailDropRequestSchema>;

// === Disposition Types ===
export const GetDispositionRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetDispositionRequest = z.infer<typeof GetDispositionRequestSchema>;

export const ListDispositionsRequestSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type ListDispositionsRequest = z.infer<typeof ListDispositionsRequestSchema>;

export const CreateDispositionRequestSchema = z.object({
  label: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6B7280'),
  sortOrder: z.number().int().optional().default(0),
  isDefault: z.boolean().optional().default(false),
});
export type CreateDispositionRequest = z.infer<typeof CreateDispositionRequestSchema>;

export const UpdateDispositionRequestSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateDispositionRequest = z.infer<typeof UpdateDispositionRequestSchema>;

export const DeleteDispositionRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteDispositionRequest = z.infer<typeof DeleteDispositionRequestSchema>;

// === Capability Token Types ===
export const GetCapabilityTokenRequestSchema = z.object({
  identity: z.string().min(1).optional(),
});
export type GetCapabilityTokenRequest = z.infer<typeof GetCapabilityTokenRequestSchema>;

// === Client Phone Number Assignment Types ===
export const ListPhoneNumberAssignmentsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ListPhoneNumberAssignmentsRequest = z.infer<typeof ListPhoneNumberAssignmentsRequestSchema>;

export const GetClientPhoneNumbersRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
});
export type GetClientPhoneNumbersRequest = z.infer<typeof GetClientPhoneNumbersRequestSchema>;

export const AssignPhoneNumberRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
  phoneNumber: z.string().min(1),
  friendlyName: z.string().optional(),
});
export type AssignPhoneNumberRequest = z.infer<typeof AssignPhoneNumberRequestSchema>;

export const UnassignPhoneNumberRequestSchema = z.object({
  organizationId: z.string().min(1),
  phoneNumber: z.string().min(1),
});
export type UnassignPhoneNumberRequest = z.infer<typeof UnassignPhoneNumberRequestSchema>;

export const GetDialablePhoneNumbersRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
});
export type GetDialablePhoneNumbersRequest = z.infer<typeof GetDialablePhoneNumbersRequestSchema>;

// === Response Types ===
export interface TwilioConfigResponse {
  id: string;
  organizationId: string;
  accountSid: string;
  phoneNumbers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CallResponse {
  id: string;
  twilioConfigId: string;
  userId: string;
  leadId: string | null;
  campaignId: string | null;
  twilioCallSid: string | null;
  fromNumber: string;
  toNumber: string;
  direction: CallDirection;
  status: CallStatus;
  dispositionId: string | null;
  dispositionLabel: string | null;
  dispositionColor: string | null;
  duration: number;
  recordingUrl: string | null;
  recordingSid: string | null;
  voicemailDropped: boolean;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Lead information for display
  leadFirstName: string | null;
  leadLastName: string | null;
  // User information for display
  userName: string | null;
}

export interface CallListResponse {
  data: CallResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface VoicemailDropResponse {
  id: string;
  twilioConfigId: string;
  userId: string;
  name: string;
  recordingUrl: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoicemailDropListResponse {
  data: VoicemailDropResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface DispositionResponse {
  id: string;
  twilioConfigId: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DispositionListResponse {
  data: DispositionResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CapabilityTokenResponse {
  token: string;
  identity: string;
  expiresAt: string;
  /** SIP domain of the TeXML application — browser calls dial sip:<target>@<domain> */
  sipDomain?: string | null;
}

// Client Phone Number Response Types
export interface ClientPhoneNumberResponse {
  id: string;
  organizationId: string;
  clientId: string;
  phoneNumber: string;
  friendlyName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneNumberWithAssignment {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  callerIdVerified: boolean;
  assignedToClient: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface DialablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  callerIdVerified: boolean;
}

// === Active Dialer Session Types ===

export const StartDialerSessionRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(),
});
export type StartDialerSessionRequest = z.infer<typeof StartDialerSessionRequestSchema>;

export const EndDialerSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type EndDialerSessionRequest = z.infer<typeof EndDialerSessionRequestSchema>;

export const GetActiveSessionsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetActiveSessionsRequest = z.infer<typeof GetActiveSessionsRequestSchema>;

export interface ActiveDialerSessionResponse {
  id: string;
  organizationId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  twilioConfigId: string;
  status: string;
  currentCallId: string | null;
  campaignId: string | null;
  listId: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSessionsListResponse {
  data: ActiveDialerSessionResponse[];
}

// === AI Disposition Suggestion Types ===

export const SuggestDispositionRequestSchema = z.object({
  id: z.string().uuid(), // callId
  organizationId: z.string().min(1),
  transcript: z.string().optional(), // Optional transcript for better suggestions
});
export type SuggestDispositionRequest = z.infer<
  typeof SuggestDispositionRequestSchema
>;

export interface DispositionSuggestion {
  dispositionId: string;
  dispositionLabel: string;
  confidence: number;
  reasoning: string;
}

export interface SuggestDispositionResponse {
  suggestions: DispositionSuggestion[];
  callId: string;
  transcriptAvailable: boolean;
}

// === Voicemail Greeting Types ===

export const ListVoicemailGreetingsRequestSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
export type ListVoicemailGreetingsRequest = z.infer<typeof ListVoicemailGreetingsRequestSchema>;

export const CreateVoicemailGreetingRequestSchema = z.object({
  name: z.string().min(1).max(255),
  recordingUrl: z.string().url(),
  recordingSid: z.string().optional(),
  duration: z.number().int().min(0),
});
export type CreateVoicemailGreetingRequest = z.infer<typeof CreateVoicemailGreetingRequestSchema>;

export const SetActiveVoicemailGreetingRequestSchema = z.object({
  id: z.string().uuid(),
});
export type SetActiveVoicemailGreetingRequest = z.infer<typeof SetActiveVoicemailGreetingRequestSchema>;

export const DeleteVoicemailGreetingRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteVoicemailGreetingRequest = z.infer<typeof DeleteVoicemailGreetingRequestSchema>;

// === Voicemail Inbox Types ===

export const ListVoicemailsRequestSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
});
export type ListVoicemailsRequest = z.infer<typeof ListVoicemailsRequestSchema>;

export const MarkVoicemailReadRequestSchema = z.object({
  id: z.string().uuid(),
});
export type MarkVoicemailReadRequest = z.infer<typeof MarkVoicemailReadRequestSchema>;

export const MarkAllVoicemailsReadRequestSchema = z.object({});
export type MarkAllVoicemailsReadRequest = z.infer<typeof MarkAllVoicemailsReadRequestSchema>;

// === Voicemail Response Types ===

export interface VoicemailGreetingResponse {
  id: string;
  twilioConfigId: string;
  name: string;
  recordingUrl: string;
  recordingSid: string | null;
  duration: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoicemailGreetingListResponse {
  data: VoicemailGreetingResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface VoicemailInboxItem {
  id: string;
  fromNumber: string;
  toNumber: string;
  recordingUrl: string;
  recordingSid: string | null;
  duration: number;
  voicemailReadAt: string | null;
  startedAt: string;
  createdAt: string;
  // Joined lead info
  leadId: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
}

export interface VoicemailInboxResponse {
  data: VoicemailInboxItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}
