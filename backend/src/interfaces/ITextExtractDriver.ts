import { AnalyzeDocumentCommandOutput } from "@aws-sdk/client-textract";
import CPage from "../types/CPage.js";

export interface ITextExtractDriver {
    initialize(region: string, accessKeyId: string, secretAccessKey: string): Promise<void>;
    extractTextFromImage(dataChunks: Uint8Array[]): Promise<AnalyzeDocumentCommandOutput>;
    buildPageModel(fileName: string): Promise<CPage>;
    convertExtractedTextToTable(fileName: string, page: CPage): Promise<string>;
}