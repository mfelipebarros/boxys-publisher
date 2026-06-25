// ---- Publisher (SQLite) ----

export interface LocalCampaign {
  id: number
  name: string
  figma_file_key: string
  boxys_campaign_id: number | null
  creative_count: number
  created_at: string
  updated_at: string
}

export interface LocalCreative {
  id: number
  campaign_id: number
  copy_id: number | null
  copy_name?: string | null
  type: 'html' | 'image' | 'video'
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
}

export interface LocalCopy {
  id: number
  campaign_id: number
  name: string
  title: string
  description: string
  message: string
  content_html: string
  type: 'criativo' | 'landing_page'
  content: string
  criativo_count?: number
  created_at: string
  updated_at: string
}

export interface LocalCarousel {
  id: number
  campaign_id: number
  name: string
  created_at: string
  items: LocalCarouselItem[]
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
