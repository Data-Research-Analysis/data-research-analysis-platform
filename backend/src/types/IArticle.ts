import { DRAArticle } from "../models/DRAArticle";
import { DRACategory } from "../models/DRACategory";

export interface IArticle {
    article: DRAArticle;
    categories: DRACategory[];
}