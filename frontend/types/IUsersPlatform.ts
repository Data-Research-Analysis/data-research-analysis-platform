export interface IUsersPlatform {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    user_type: string;
    token: string;
    email_verified_at?: Date | null;
}