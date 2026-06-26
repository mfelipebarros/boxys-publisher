import { supabase } from '../lib/supabase'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string

export async function getUserTokensByUserIdAndProvider(userId: string): Promise<{ connected: boolean }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { connected: false }

  const resp = await fetch(`${SUPA_URL}/functions/v1/meta_conection_status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!resp.ok) return { connected: false }
  return await resp.json()
}

export async function handleFinishOnboardingMeta(ad_accounts: unknown[]) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const { data: { user } } = await supabase.auth.getUser()

  const response = await fetch(`${SUPA_URL}/functions/v1/meta_onboard_client`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user?.id,
      user_name: user?.user_metadata?.name ?? user?.email,
      ad_accounts,
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Erro ao finalizar integração Meta')
}

export async function fetchAdAccounts() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const { data: { user } } = await supabase.auth.getUser()
  if (!token) return null

  const res = await fetch(`${SUPA_URL}/functions/v1/meta_accounts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user?.id }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Falha ao buscar contas Meta')
  if (!Array.isArray(json.data)) return []
  return json.data.map((acc: { account_id: string; name: string; business?: { name: string }; currency: string; timezone_name: string }) => ({
    id: acc.account_id,
    name: acc.name,
    business: acc.business?.name,
    currency: acc.currency,
    timezone: acc.timezone_name,
  }))
}

export async function getLocations(searchTerm: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${SUPA_URL}/functions/v1/get_meta_location`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: searchTerm }),
  })
  return await response.json()
}

export async function getLocationByCoordinates(lat: string, lng: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${SUPA_URL}/functions/v1/get_meta_location_by_coordinates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })
  return await response.json()
}

export async function getMetaAudience(searchTerm: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${SUPA_URL}/functions/v1/get_meta_audience`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: searchTerm }),
  })
  return await response.json()
}
