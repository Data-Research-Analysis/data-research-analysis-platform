import { DRAArticle } from "../models/DRAArticle.js";
import { DRACategory } from "../models/DRACategory.js";

export interface IArticle {
    article: DRAArticle;
    categories: DRACategory[];
}

/**
 * Public article list item with the heavy body fields removed, so the article
 * index / related-articles payload stays small.
 */
export interface IPublicArticleSummary {
    article: Omit<DRAArticle, 'content' | 'content_markdown'>;
    categories: DRACategory[];
}