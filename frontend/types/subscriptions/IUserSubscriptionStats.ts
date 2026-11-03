export interface IUserSubscriptionStats {
    tier: {
        id: number;
        tier_name: string;
        max_rows_per_data_model: string;
        price_per_month_usd: string;
    };
    rowLimit: number;
}
