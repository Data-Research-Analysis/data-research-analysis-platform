import { DRAArticle } from "../../backend/src/models/DRAArticle";
import { DRACategory } from "../../backend/src/models/DRACategory";

export interface IArticleData {
    article: {
        id: number;
        title: string;
        content: string;
    };
    categories: DRACategory[];
}