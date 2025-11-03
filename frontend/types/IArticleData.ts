/**
 * Represents the article entity data from the backend
 * This matches the DRAArticle model structure
 */
export interface IArticleData {
    id: number;
    title: string;
    content: string;
    publish_status: string;
    slug: string;
    created_at: string; // Date as string for easier handling in UI
}