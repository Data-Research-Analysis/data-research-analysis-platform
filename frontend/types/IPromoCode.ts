export interface IPromoCode {
    id: number;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed_amount' | 'free_trial' | 'upgraded_tier';
    discount_value: number | null;
    discount_duration_months: number | null;
    campaign_name: string | null;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
    max_uses: number | null;
    current_uses: number;
    max_uses_per_user: number | null;
    applicable_tiers: number[] | null;
    applicable_users: (number | string)[] | null;
    email_domain_restriction: string | null;
    new_users_only: boolean;
    upgraded_tier_id: number | null;
    created_by: number;
    created_at: string;
    updated_at: string;
    paddle_discount_id: string | null;
}

export interface IPromoCodeRedemption {
    id: number;
    promo_code_id: number;
    user_id: number;
    organization_id: number | null;
    subscription_id: number | null;
    discount_applied: number;
    original_price: number;
    final_price: number;
    status: 'active' | 'expired' | 'cancelled';
    redeemed_at: string;
    expires_at: string | null;
    user_email?: string;
    organization_name?: string | null;
    promo_code?: IPromoCode;
}

export interface IPromoCodeValidation {
    valid: boolean;
    error?: string;
    discountAmount?: number;
    finalPrice?: number;
    discountDescription?: string;
    discountType?: string;
    discountValue?: number;
    upgradesTo?: {
        id: number;
        name: string;
    };
}

export interface IPromoCodeAnalytics {
    totalRedemptions: number;
    activeRedemptions: number;
    totalRevenue: number;
    totalDiscount: number;
    conversionRate: number;
}
