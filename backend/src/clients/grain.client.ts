/**
 * Grain public API (v2). Auth is a Personal or Workspace Access Token,
 * created in Grain → Workspace settings → Integrations → API.
 * Docs: https://developers.grain.com/endpoints.html
 */

const GRAIN_API_BASE = 'https://api.grain.com/_/public-api/v2'
const GRAIN_API_VERSION = '2026-10-01'

export interface GrainParticipant {
  name: string | null
  email: string | null
  scope: 'internal' | 'external' | string
}

export interface GrainRecording {
  id: string
  title: string
  start_datetime: string
  url: string
  participants?: GrainParticipant[]
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Public-Api-Version': GRAIN_API_VERSION,
  'Content-Type': 'application/json',
})

const grainError = async (response: Response, action: string) =>
  new Error(
    `Grain ${action} failed (${response.status}): ${(await response.text()).slice(0, 300)}`,
  )

/** Recordings after `after`, newest-first pages, external meetings only. */
export const listRecordings = async (
  token: string,
  after: Date,
  maxPages = 5,
): Promise<GrainRecording[]> => {
  const recordings: GrainRecording[] = []
  let cursor: string | null = null

  for (let page = 0; page < maxPages; page++) {
    const response = await fetch(`${GRAIN_API_BASE}/recordings`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        filter: {
          after_datetime: after.toISOString(),
          participant_scope: 'external',
        },
        include: { participants: true },
        ...(cursor && { cursor }),
      }),
    })
    if (!response.ok) throw await grainError(response, 'list recordings')

    const body = (await response.json()) as {
      recordings?: GrainRecording[]
      cursor?: string | null
    }
    recordings.push(...(body.recordings ?? []))
    cursor = body.cursor ?? null
    if (!cursor) break
  }

  return recordings
}

/** Plain-text transcript ("Speaker: text" lines). */
export const getTranscriptText = async (
  token: string,
  recordingId: string,
): Promise<string> => {
  const response = await fetch(
    `${GRAIN_API_BASE}/recordings/${encodeURIComponent(recordingId)}/transcript.txt`,
    { headers: headers(token) },
  )
  if (!response.ok) throw await grainError(response, 'get transcript')
  return response.text()
}

/** Cheapest authenticated call, for the connect flow. */
export const testToken = async (token: string): Promise<void> => {
  const response = await fetch(`${GRAIN_API_BASE}/recordings`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      filter: { title_search: '__omnidial_connect_test__' },
    }),
  })
  if (!response.ok) throw await grainError(response, 'token check')
}
