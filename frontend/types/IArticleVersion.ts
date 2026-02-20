/**
 * Represents a single version snapshot of an article.
 * Mirrors the backend IArticleVersion interface.
 */
export interface IArticleVersion {
    id: number;
    version_number: number;
    title: string;
    content: string;
    content_markdown?: string;
    change_summary?: string;
    article_id: number;
    created_at: string;
}
