/**
 * Represents the article entity data from the backend
 * This matches the DRAArticle model structure
 */
import type { IAuthor } from "./IAuthor";

export interface IArticleData {
    id: number;
    title: string;
    content: string;
    content_markdown?: string;
    publish_status: string;
    slug: string;
    created_at: string; // Date as string for easier handling in UI
    updated_at?: string; // Date as string for easier handling in UI
    author?: IAuthor | null;
}