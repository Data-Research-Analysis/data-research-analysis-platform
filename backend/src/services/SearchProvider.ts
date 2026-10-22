import { GoogleGenAI } from '@google/genai';
import { AICallTrackerService, AI_FEATURE_KEYS } from './AICallTrackerService.js';
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
        const modelId = process.env.PLAN_MODEL ?? 'gemini-2.5-flash';
        const startedAt = Date.now();
        let response: any;
        try {
            response = await genAI.models.generateContent({
                model: modelId,
                contents: `Search the web and answer this research query concisely with facts and numbers where possible:\n\n${query}`,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.2,
                },
            });
        } catch (error: any) {
            AICallTrackerService.getInstance().track({
                featureKey: AI_FEATURE_KEYS.SEARCH_GROUNDING,
                modelId,
                inputTokens: 0,
                cachedInputTokens: 0,
                outputTokens: 0,
                latencyMs: Date.now() - startedAt,
                status: 'failed',
                errorInfo: error?.message,
            });
            throw error;
        }
        const usage = response.usageMetadata as any;
        AICallTrackerService.getInstance().track({
            featureKey: AI_FEATURE_KEYS.SEARCH_GROUNDING,
            modelId,
            inputTokens: usage?.promptTokenCount ?? 0,
            cachedInputTokens: usage?.cachedContentTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
            thoughtTokens: usage?.thoughtsTokenCount ?? 0,
            latencyMs: Date.now() - startedAt,
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
