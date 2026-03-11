import type { ESubscriptionTier } from './ESubscriptionTier';

export interface ISubscriptionTier {
    id: number;
    tier_name: ESubscriptionTier;
    max_rows_per_data_model: string; // bigint as string
    max_projects: number | null;
    max_data_sources_per_project: number | null;
    max_dashboards: number | null;
    ai_generations_per_month: number | null;
    price_per_month_usd: string; // decimal as string
    price_per_year_usd: string | null; // decimal as string, null if not set
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
