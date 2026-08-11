/* eslint-disable @typescript-eslint/no-explicit-any */

import { getToken } from '@clerk/nextjs'
import { env } from './config'

async function getErrorMessage(response: Response): Promise<string> {
  const fallback =
    response.statusText || `Request failed with status ${response.status}`

  try {
    const text = await response.text()
    if (!text) return fallback

    try {
      const data = JSON.parse(text)
      if (
        data?.error === 'Rate limit exceeded' &&
        typeof data?.message === 'string'
      ) {
        return data.message
      }
      if (typeof data?.error === 'string') {
        // Zod failures carry the offending fields in `details`. Without them
        // every rejected request reads as a bare "Validation failed", which
        // says nothing about which field the server actually objected to.
        const issues = Array.isArray(data?.details)
          ? data.details
              .map((issue: any) => {
                const path = Array.isArray(issue?.path)
                  ? issue.path.join('.')
                  : ''
                const message = issue?.message ?? 'invalid'
                return path ? `${path}: ${message}` : message
              })
              .filter(Boolean)
              .join('; ')
          : ''

        return issues ? `${data.error} (${issues})` : data.error
      }
      if (typeof data?.message === 'string') return data.message
      return text
    } catch {
      return text
    }
  } catch {
    return fallback
  }
}

export async function getAuthHeaders(options?: RequestInit) {
  const headers = new Headers(options?.headers)

  if (typeof window !== 'undefined' && !headers.has('Authorization')) {
    const token = await getToken().catch(() => null)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  return headers
}

export const get = async <T>(url: string, options?: RequestInit): Promise<T> =>
  fetch(`${env.API_URL.toString()}${url}`, {
    ...options,
    method: 'GET',
    credentials: 'include',
    headers: await getAuthHeaders(options),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }
    return response.json()
  })

export const post = <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  postWithAuthHeaders(url, data, options)

const postWithAuthHeaders = async <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  fetch(`${env.API_URL.toString()}${url}`, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
    headers: await getAuthHeaders({
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }
    return response.json()
  })

export const put = <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  putWithAuthHeaders(url, data, options)

const putWithAuthHeaders = async <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  fetch(`${env.API_URL.toString()}${url}`, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
    headers: await getAuthHeaders({
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }
    return response.json()
  })

export const patch = <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  patchWithAuthHeaders(url, data, options)

const patchWithAuthHeaders = async <T>(
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<T> =>
  fetch(`${env.API_URL.toString()}${url}`, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
    headers: await getAuthHeaders({
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }
    return response.json()
  })

export const del = async <T>(url: string, options?: RequestInit): Promise<T> =>
  fetch(`${env.API_URL.toString()}${url}`, {
    ...options,
    method: 'DELETE',
    credentials: 'include',
    headers: await getAuthHeaders(options),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }
    // Handle 204 No Content or empty responses
    const text = await response.text()
    if (!text) {
      return {} as T
    }
    return JSON.parse(text)
  })
