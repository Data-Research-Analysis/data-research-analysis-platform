import { DRAArticle } from "../../backend/src/models/DRAArticle";
import { DRACategory } from "../../backend/src/models/DRACategory";

export interface IArticleData {
    article: {
        id: number;
        title: string;
        content: string;
        publish_status: string; // Added field to match UI usage
        slug: string;
        created_at: string; // Date as string for easier handling in UI
    };
    categories: DRACategory[];
}