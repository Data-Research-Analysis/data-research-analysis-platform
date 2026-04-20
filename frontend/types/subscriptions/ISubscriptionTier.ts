import type { ESubscriptionTier } from './ESubscriptionTier';

export interface ISubscriptionTier {
    id: number;
    tier_name: ESubscriptionTier;
    max_rows_per_data_model: string; // bigint as string
    max_projects: number | null;
    max_data_sources_per_project: number | null;
    max_dashboards: number | null;
    max_data_models_per_data_source?: number | null;
    ai_generations_per_month: number | null;
    price_per_month_usd: string; // decimal as string
    price_per_year_usd: string | null; // decimal as string, null if not set
    is_active: boolean;
    paddle_product_id: string | null;
    paddle_price_id_monthly: string | null;
    paddle_price_id_annual: string | null;
    created_at: string;
    updated_at: string;
}
