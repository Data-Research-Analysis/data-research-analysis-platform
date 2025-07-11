import { DRAArticle } from "../models/DRAArticle.js";
import { DRACategory } from "../models/DRACategory.js";

export interface IArticle {
    article: DRAArticle;
    categories: DRACategory[];
}