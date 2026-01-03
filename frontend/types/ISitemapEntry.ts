import type { EPublishStatus } from './EPublishStatus'

export interface ISitemapEntry {
  id: number
  url: string
  publish_status: EPublishStatus
  priority: number
  created_at: string
  updated_at: string
}
