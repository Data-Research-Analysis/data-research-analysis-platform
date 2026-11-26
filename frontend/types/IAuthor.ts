export interface IAuthor {
    id: number;
    name: string;
    slug: string;
    picture?: string | null;
    linkedin_url?: string | null;
    website_url?: string | null;
    bio?: string | null;
    created_at?: string;
    updated_at?: string;
}
