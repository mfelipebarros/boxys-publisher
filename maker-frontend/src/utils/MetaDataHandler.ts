import { supabase } from '../lib/supabase'

export async function getLocations(searchTerm: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const url = import.meta.env.VITE_SUPABASE_URL as string

  const response = await fetch(`${url}/functions/v1/get_meta_location`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: searchTerm }),
  })
  return await response.json()
}

export async function getLocationByCoordinates(lat: string, lng: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const url = import.meta.env.VITE_SUPABASE_URL as string

  const response = await fetch(`${url}/functions/v1/get_meta_location_by_coordinates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })
  return await response.json()
}

export async function getMetaAudience(searchTerm: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const url = import.meta.env.VITE_SUPABASE_URL as string

  const response = await fetch(`${url}/functions/v1/get_meta_audience`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: searchTerm }),
  })
  return await response.json()
}
