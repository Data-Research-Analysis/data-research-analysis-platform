import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export interface ISearchResult {
    summary: string;
    sources: string[];
}

export class SearchProvider {
    private static instance: SearchProvider;

    private constructor() {}

    public static getInstance(): SearchProvider {
        if (!SearchProvider.instance) {
            SearchProvider.instance = new SearchProvider();
        }
        return SearchProvider.instance;
    }

    private getProvider(): string {
        return process.env.PLAN_SEARCH_PROVIDER ?? 'gemini';
    }

    private async searchWithGemini(query: string, limit: number): Promise<ISearchResult> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.generateContent({
            model: process.env.PLAN_MODEL ?? 'gemini-2.5-flash',
            contents: `Search the web and answer this research query concisely with facts and numbers where possible:\n\n${query}`,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2,
            },
        });
        const text = response.text ?? '';
        const sources: string[] = [];
        const grounding = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks as any[] | undefined;
        if (grounding) {
            for (const chunk of grounding) {
                const uri = chunk?.web?.uri;
                if (uri && !sources.includes(uri)) sources.push(uri);
                if (sources.length >= limit) break;
            }
        }
        return { summary: text.trim(), sources };
    }

    public async search(query: string, limit = 8): Promise<ISearchResult> {
        const provider = this.getProvider();
        if (provider === 'gemini' || provider === '') {
            return this.searchWithGemini(query, limit);
        }
        throw new Error(`Search provider "${provider}" is not configured. Set PLAN_SEARCH_API_KEY or use gemini grounding.`);
    }
}
