import { supabase } from '../lib/supabase'

export interface GoogleLocationOption {
  id: string
  name: string
  canonicalName?: string
  countryCode?: string
  type?: string
  status?: string
}

export async function fetchGoogleLocations(query: string): Promise<GoogleLocationOption[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase.functions.invoke<GoogleLocationOption[]>('google-locations', {
    body: { q: query, countryCode: 'BR' },
  })
  if (error || !Array.isArray(data)) return []
  return data
}

export async function fetchGoogleRadiusLocations(query: string): Promise<GoogleLocationOption[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase.functions.invoke<GoogleLocationOption[]>('google-locations-raio', {
    body: { q: query, countryCode: 'BR' },
  })
  if (error || !Array.isArray(data)) return []
  return data
}
