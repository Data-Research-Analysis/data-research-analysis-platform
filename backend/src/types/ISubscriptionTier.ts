export interface ISubscriptionTier {
    id: number;
    tier_name: string;
    price_per_month_usd: number;
    price_per_year_usd: number | null;
    max_projects: number | null;
    max_data_sources_per_project: number | null;
    max_dashboards: number | null;
    max_data_models_per_data_source: number | null;
    max_rows_per_data_model: number;
    ai_generations_per_month: number | null;
    max_members_per_project: number | null;
    paddle_product_id: string | null;
    paddle_price_id_monthly: string | null;
    paddle_price_id_annual: string | null;
}
