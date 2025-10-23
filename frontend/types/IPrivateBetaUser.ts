export interface IPrivateBetaUser {
    id: number;
    first_name: string;
    last_name: string;
    business_email: string;
    phone_number: string;
    country: string;
    agree_to_receive_updates: boolean;
    company_name: string;
    created_at: Date;
}