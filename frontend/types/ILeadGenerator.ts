export interface ILeadGenerator {
    id: number
    title: string
    slug: string
    description: string | null
    file_name: string
    original_file_name: string
    is_gated: boolean
    is_active: boolean
    view_count: number
    download_count: number
    created_at: string
    updated_at: string
    lead_count?: number // present in list responses
}
