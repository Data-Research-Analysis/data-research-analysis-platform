export interface IUsersPlatform {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    user_type: string;
    token: string;
    email_verified_at?: Date | null;
    interested_subscription_tier?: any;
    interested_billing_cycle?: 'monthly' | 'annual' | null;
    dismissed_paid_plan_banner_until?: Date | null;
}