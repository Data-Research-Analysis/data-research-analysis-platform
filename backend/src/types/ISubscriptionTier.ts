export interface ISubscriptionTier {
    id: number;
    tier_name: string;
    price_per_month_usd: number;
    price_per_year_usd: number | null;
    max_rows_per_data_model: number;
    paddle_product_id: string | null;
    paddle_price_id_monthly: string | null;
    paddle_price_id_annual: string | null;
}
