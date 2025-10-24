export interface IUserManagement {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    user_type: string;
    email_verified_at: Date | null;
    unsubscribe_from_emails_at: Date | null;
}