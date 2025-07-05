import type { IArticleData } from "./IArticleData";
import type { ICategory } from "./ICategory";

export interface IArticle {
    article: IArticleData
    categories: ICategory[];
}