import { EUserType } from "./EUserType.js";
import { ISubscriptionTier } from "./ISubscriptionTier.js";

export interface IUsersPlatform {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    user_type: EUserType;
    token: string;
    email_verified_at?: Date | null;
    interested_subscription_tier?: ISubscriptionTier | null;
    interested_billing_cycle?: 'monthly' | 'annual' | null;
}