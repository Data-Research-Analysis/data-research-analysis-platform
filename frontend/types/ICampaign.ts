export interface ICampaignChannel {
    id: number;
    campaign_id: number;
    channel_type: string;
    data_source_id: number | null;
    channel_name: string | null;
    is_offline: boolean;
    created_at: string;
}

export interface ICampaign {
    id: number;
    project_id: number;
    created_by: number;
    name: string;
    description: string | null;
    objective: string;
    status: string;
    budget_total: number | null;
    target_leads: number | null;
    target_cpl: number | null;
    target_roas: number | null;
    target_impressions: number | null;
    start_date: string | null;
    end_date: string | null;
    channels: ICampaignChannel[];
    created_at: string;
    updated_at: string;
}

export interface ICreateCampaignPayload {
    project_id: number;
    name: string;
    description?: string | null;
    objective: string;
    status?: string;
    budget_total?: number | null;
    target_leads?: number | null;
    target_cpl?: number | null;
    target_roas?: number | null;
    target_impressions?: number | null;
    start_date?: string | null;
    end_date?: string | null;
}

export interface IUpdateCampaignPayload {
    name?: string;
    description?: string | null;
    objective?: string;
    budget_total?: number | null;
    target_leads?: number | null;
    target_cpl?: number | null;
    target_roas?: number | null;
    target_impressions?: number | null;
    start_date?: string | null;
    end_date?: string | null;
}

export interface IAddChannelPayload {
    channel_type: string;
    data_source_id?: number | null;
    channel_name?: string | null;
    is_offline?: boolean;
}

export const CAMPAIGN_OBJECTIVES: { value: string; label: string }[] = [
    { value: 'brand_awareness', label: 'Brand Awareness' },
    { value: 'lead_generation', label: 'Lead Generation' },
    { value: 'demand_generation', label: 'Demand Generation' },
    { value: 'customer_acquisition', label: 'Customer Acquisition' },
    { value: 'retention', label: 'Retention' },
    { value: 'product_launch', label: 'Product Launch' },
    { value: 'event_promotion', label: 'Event Promotion' },
    { value: 'other', label: 'Other' },
];

export const CAMPAIGN_STATUSES: { value: string; label: string; color: string }[] = [
    { value: 'draft', label: 'Draft', color: 'gray' },
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'paused', label: 'Paused', color: 'yellow' },
    { value: 'completed', label: 'Completed', color: 'blue' },
    { value: 'archived', label: 'Archived', color: 'red' },
];
