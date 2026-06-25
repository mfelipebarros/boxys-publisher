import { supabase } from './supabase'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = await authHeaders()
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(path, { method: 'POST', headers, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => apiFetch<T>('GET', path),
  post: <T>(path: string, body: unknown) => apiFetch<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => apiFetch<T>('PUT', path, body),
  delete: <T>(path: string) => apiFetch<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => apiUpload<T>(path, formData),
}
