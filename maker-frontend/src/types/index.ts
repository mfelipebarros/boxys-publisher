// ---- Publisher (SQLite) ----

export type DestinationOption = 'social' | 'ad'
export type Destination = DestinationOption[] | null

export interface IAConfig {
  abordagem: { enabled: boolean; context: string; pdf_url?: string }
  trafego: { enabled: boolean; context: string; pdf_url?: string }
}

export interface VersoConfig {
  one_liner?: string
  campaign_color?: string
  campaign_type?: string
  broker_profile?: string
  lead_cost?: string
  clear_description?: string
}

export interface LocalCampaign {
  id: number
  name: string
  figma_file_key: string
  boxys_campaign_id: number | null
  creative_count: number
  created_at: string
  updated_at: string
  // new metadata fields
  briefing_text?: string | null
  ia_config?: string | null
  campaign_title?: string | null
  general_description?: string | null
  basic_copy?: string | null
  explanation_video_url?: string | null
  traffic_video_url?: string | null
  verso_config?: string | null
  thumb_url?: string | null
  featured_image_url?: string | null
  traffic_config?: string | null
}

// ---- Paid Traffic (Meta + Google) ----

export interface Placements {
  facebook: { enabled: boolean; positions: { feed: boolean; stories: boolean; reels: boolean } }
  instagram: { enabled: boolean; positions: { feed: boolean; stories: boolean; reels: boolean; explore: boolean } }
  audienceNetwork: { enabled: boolean; positions: { native: boolean; banner: boolean; interstitial: boolean } }
  whatsapp: { enabled: boolean; positions: { status: boolean } }
  threads: { enabled: boolean; positions: { feed: boolean } }
}

export interface PaidTraffic {
  id?: string
  objective: string
  gender: string
  min_age: number
  max_age: number
  budget: number
  campaign_id?: number
  placements: Placements
}

export type MetaAudience = {
  id: string
  name: string
  targetingKey: string
  path?: string[]
}

export type AudienceGroup = {
  id: string
  label: string
  items: MetaAudience[]
}

export type LocationSource = 'search' | 'reverse'

export interface MetaLocation {
  id: string
  name: string
  paid_traffic_id?: string
  label?: string
  subtitle?: string
  lat: string
  long: string
  type: string
  typeLabel?: string
  radius: number
  context?: string
  osmType?: string
  osmId?: string | number
  placeRank?: number
  category?: string
  source?: LocationSource
  hasExplicitName?: boolean
  debugReason?: string
}

export type GoogleCampaignMode = 'search' | 'performance_max' | 'demand_gen'
export type GoogleRadiusUnit = 'km' | 'mi'

export interface GoogleRadiusLocation {
  id?: string
  name: string
  canonicalName?: string
  radius: number
  unit: GoogleRadiusUnit
}

export interface GoogleTrafficForm {
  campaign_name: string
  business_name: string
  objective: string
  final_url?: string
  bidding_mode?: 'automatic' | 'manual'
  bidding_strategy?: 'maximize_clicks' | 'maximize_conversions' | 'maximize_conversion_value' | 'target_cpa' | 'manual_cpc' | 'target_impression_share'
  display_network_enabled?: boolean
  search_partners_enabled?: boolean
  keywords?: string
  negative_keywords?: string
  locations?: string
  location_ids?: string[]
  location_mode?: 'location' | 'radius'
  radius_locations?: GoogleRadiusLocation[]
  sitelinks?: string
  callouts?: string
  structured_snippet?: string
  lead_form_enabled?: boolean
  lead_form_cta?: string
  lead_form_headline?: string
  lead_form_description?: string
  audience_signals?: string
  custom_audiences?: string
  placements?: string
  titles?: string
  long_titles?: string
  descriptions?: string
  budget: number
  duration_days?: number
  start_date?: string
  end_date?: string
}

export interface GoogleTrafficSettings {
  activeType?: GoogleCampaignMode
  search?: GoogleTrafficForm
  performance_max?: GoogleTrafficForm
  demand_gen?: GoogleTrafficForm
}

export interface PaidTrafficInfoComplete {
  generalInfos: PaidTraffic
  audienceGroups: AudienceGroup[]
  locations: MetaLocation[]
  googleInfo?: GoogleTrafficSettings
}

export interface PaidTrafficStepHandle {
  validate: () => boolean
}

export interface LocalCreative {
  id: number
  campaign_id: number
  copy_id: number | null
  copy_name?: string | null
  type: 'html' | 'image' | 'video' | 'landing_page'
  name: string
  local_path: string
  supabase_url: string
  thumbnail_url: string
  width: number
  height: number
  figma_node_id: string
  format_label: string
  manifest_json: string
  created_at: string
  destination?: Destination
}

export interface LocalCopy {
  id: number
  campaign_id: number
  name: string
  title: string
  description: string
  message: string
  content_html: string
  type: 'criativo' | 'landing_page' | 'search'
  content: string
  criativo_count?: number
  created_at: string
  updated_at: string
}

export interface LocalCarouselAsset {
  id: number
  carousel_id: number
  position: number
  type: 'html' | 'image'
  file_url: string
  thumbnail_url: string
  html_content: string
  caption: string
  created_at: string
}

export interface LocalCarousel {
  id: number
  campaign_id: number
  name: string
  created_at: string
  destination?: Destination
  items: LocalCarouselItem[]
  assets: LocalCarouselAsset[]
  asset_count?: number
}

export interface LocalCarouselItem {
  id: number
  carousel_id: number
  creative_id: number
  position: number
  creative_name?: string
  creative_thumbnail?: string
}

// ---- Boxys (Supabase) ----

export interface BoxyCampaign {
  id: number
  title: string
  image: string
  published: boolean
  created_at: string
  asset_count: number
}

export interface BoxyAdvertisement {
  id: string
  title: string | null
  format: string
  dimensions: string | null
  published: boolean
  created_at: string
  cover_image_url: string | null
}

export interface BocySocialCreative {
  id: string
  title: string | null
  format: string
  published: boolean
  created_at: string
}

export interface BoxyLandingPage {
  id: string
  slug: string
  published: boolean
  created_at: string
  cover_image_url: string | null
}

// ---- Parse HTML response ----

export interface ParsedHtmlMeta {
  title: string
  desc: string
  message: string
  format_label: string
  width: number
  height: number
}

// ---- API responses ----

export type ApiOk<T> = { status: 'ok' } & T
