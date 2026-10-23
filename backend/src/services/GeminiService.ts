import { GoogleGenAI } from '@google/genai';
import { AI_DATA_MODELER_TEMPLATE_PROMPT, AI_DATA_MODELER_CHAT_PROMPT } from '../constants/system-prompts.js';
import { IWidgetSpec } from '../types/IWidgetSpec.js';
import { DataModelPromptContext, getSystemInstruction, buildDataModelAnalysisPrompt } from '../templates/DataModelAnalysisPrompt.js';
import { MarketingAnalysisPromptContext, getMarketingAnalysisSystemInstruction, buildMarketingAnalysisPrompt } from '../templates/MarketingAnalysisPrompt.js';
import { IMarketingAnalysisAIResponse } from '../types/IAIMarketingAnalysis.js';
import { AICallTrackerService, AIFeatureKey, AI_FEATURE_KEYS } from './AICallTrackerService.js';
import dotenv from 'dotenv';

dotenv.config();

interface ChatSession {
    chat: any;
    createdAt: Date;
    schemaContext: string;
}

export interface IGenAIToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface IRunWithToolsEvent {
    type: 'text_delta' | 'tool_call' | 'function_response' | 'turn_end';
    text?: string;
    toolName?: string;
    toolArgs?: any;
    result?: any;
}

export interface IRunWithToolsParams {
    systemInstruction: string;
    contents: any[];
    tools: IGenAIToolDefinition[];
    executeTool: (name: string, args: any) => Promise<any>;
    onEvent?: (event: IRunWithToolsEvent) => void;
    maxToolCalls?: number;
    maxOutputTokens?: number;
    model?: string;
    temperature?: number;
}

export interface IRunWithToolsResult {
    text: string;
    contents: any[];
    toolCalls: number;
    gate?: Record<string, any> | null;
}

/** Optional instrumentation context supplied by callers (feature/action grouping). */
export interface IAICallMeta {
    featureKey?: AIFeatureKey;
    actionId?: string | null;
    userId?: number | null;
    orgId?: number | null;
    projectId?: number | null;
}

export class GeminiService {
    private genAI: GoogleGenAI;
    private chatSessions: Map<string, ChatSession>;
    private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        
        this.genAI = new GoogleGenAI({ apiKey });
        this.chatSessions = new Map();
        
        // Cleanup expired sessions every 10 minutes
        setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
    }

    /**
     * Initialize a new conversation with schema context
     * @param conversationId Unique identifier for the conversation
     * @param schemaContext Database schema in markdown format
     * @param systemPrompt Optional system prompt (defaults to template prompt)
     */
    async initializeConversation(
        conversationId: string, 
        schemaContext: string,
        systemPrompt: string = AI_DATA_MODELER_CHAT_PROMPT  // Default to chat mode for conversational guidance
    ): Promise<string> {
        try {
            // Create conversation history with system context
            const history = [
                {
                    role: 'user',
                    parts: [{ text: `System instruction: ${systemPrompt}\n\nHere is the database schema to analyze:\n\n${schemaContext}` }]
                },
                {
                    role: 'model',
                    parts: [{
                        text: 'I have received and analyzed the database schema. I\'m ready to help you create data models. What would you like me to help you with?'
                    }]
                }
            ];

            // Store the chat session with history
            this.chatSessions.set(conversationId, {
                chat: history,
                createdAt: new Date(),
                schemaContext
            });

            return conversationId;
        } catch (error) {
            console.error('Error initializing Gemini conversation:', error);
            throw new Error('Failed to initialize AI conversation');
        }
    }

    /**
     * Send a message to an existing conversation
     */
    async sendMessage(conversationId: string, message: string, meta?: IAICallMeta): Promise<string> {
        const session = this.chatSessions.get(conversationId);
        
        if (!session) {
            throw new Error('Conversation not found. Please initialize a new conversation.');
        }

        const startedAt = Date.now();
        try {
            // Add user message to history
            session.chat.push({
                role: 'user',
                parts: [{ text: message }]
            });

            // Generate response using the full conversation history
            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: session.chat
            });

            const responseText = response.text || '';
            this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODELER_CHAT, 'gemini-2.5-flash', response.usageMetadata, startedAt);

            // Add assistant response to history
            session.chat.push({
                role: 'model',
                parts: [{ text: responseText }]
            });
            
            return responseText;
        } catch (error: any) {
            this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODELER_CHAT, 'gemini-2.5-flash', null, startedAt, 'failed', error?.message);
            console.error('Error sending message to Gemini:', error);
            
            // Provide user-friendly error messages based on error type
            if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
                throw new Error('Unable to connect to AI service. Please check your internet connection and try again.');
            } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new Error('AI service quota exceeded. Please try again in a few moments.');
            } else if (error.message?.includes('timeout')) {
                throw new Error('AI service request timed out. Please try again.');
            } else if (error.message?.includes('API key')) {
                throw new Error('AI service configuration error. Please contact support.');
            } else {
                throw new Error('Unable to generate AI response at this time. Please try again later.');
            }
        }
    }

    /**
     * Send a message with streaming response (optional enhancement)
     */
    async sendMessageStream(
        conversationId: string,
        message: string,
        onChunk: (chunk: string) => void,
        meta?: IAICallMeta
    ): Promise<string> {
        const session = this.chatSessions.get(conversationId);
        
        if (!session) {
            throw new Error('Conversation not found. Please initialize a new conversation.');
        }

        const startedAt = Date.now();
        let lastUsage: any = null;
        try {
            // Add user message to history
            session.chat.push({
                role: 'user',
                parts: [{ text: message }]
            });

            // Generate streaming response
            const response = await this.genAI.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: session.chat
            });

            let fullResponse = '';
            for await (const chunk of response) {
                const chunkText = chunk.text || '';
                if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
                fullResponse += chunkText;
                onChunk(chunkText);
            }

            this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODELER_CHAT, 'gemini-2.5-flash', lastUsage, startedAt);

            // Add assistant response to history
            session.chat.push({
                role: 'model',
                parts: [{ text: fullResponse }]
            });
            
            return fullResponse;
        } catch (error) {
            this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODELER_CHAT, 'gemini-2.5-flash', lastUsage, startedAt, 'failed', (error as Error)?.message);
            console.error('Error streaming message from Gemini:', error);
            throw new Error('Failed to stream AI response');
        }
    }

    /**
     * Get conversation history (for debugging or persistence)
     */
    async getConversationHistory(conversationId: string): Promise<any> {
        const session = this.chatSessions.get(conversationId);
        
        if (!session) {
            throw new Error('Conversation not found');
        }

        // Return basic session info (actual history is managed by Gemini internally)
        return {
            conversationId,
            createdAt: session.createdAt,
            schemaContext: session.schemaContext
        };
    }

    /**
     * Destroy a conversation session
     */
    destroyConversation(conversationId: string): boolean {
        return this.chatSessions.delete(conversationId);
    }

    /**
     * Clean up expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = new Date().getTime();
        
        for (const [conversationId, session] of this.chatSessions.entries()) {
            const sessionAge = now - session.createdAt.getTime();
            
            if (sessionAge > this.SESSION_TIMEOUT_MS) {
                this.chatSessions.delete(conversationId);
                console.log(`Cleaned up expired session: ${conversationId}`);
            }
        }
    }

    /**
     * Get active session count
     */
    getActiveSessionCount(): number {
        return this.chatSessions.size;
    }

    /**
     * Check if a session exists
     */
    sessionExists(conversationId: string): boolean {
        return this.chatSessions.has(conversationId);
    }

    /**
     * Record one Gemini call in the AI usage log (fire-and-forget).
     * @param usage usageMetadata from the response (or last stream chunk)
     */
    private trackCall(
        meta: IAICallMeta | undefined,
        defaultFeatureKey: AIFeatureKey,
        modelId: string,
        usage: any,
        startedAt: number,
        status: 'success' | 'failed' | 'fallback' = 'success',
        errorInfo?: string | null,
        cacheEnabled = false,
    ): void {
        AICallTrackerService.getInstance().track({
            featureKey: meta?.featureKey ?? defaultFeatureKey,
            actionId: meta?.actionId ?? null,
            userId: meta?.userId ?? null,
            orgId: meta?.orgId ?? null,
            projectId: meta?.projectId ?? null,
            modelId,
            inputTokens: usage?.promptTokenCount ?? 0,
            cachedInputTokens: usage?.cachedContentTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
            thoughtTokens: usage?.thoughtsTokenCount ?? 0,
            status,
            errorInfo,
            latencyMs: Date.now() - startedAt,
            cacheEnabled,
        });
    }

    /**
     * One-shot chat call with a system instruction and a single user prompt.
     * Used by the Plan Studio for context questions.
     */
    async askQuestion(systemInstruction: string, question: string, meta?: IAICallMeta): Promise<string> {
        const modelId = process.env.PLAN_MODEL ?? 'gemini-2.5-flash';
        const startedAt = Date.now();
        try {
            const response = await this.genAI.models.generateContent({
                model: modelId,
                contents: [{ role: 'user', parts: [{ text: question }] }],
                config: {
                    systemInstruction,
                    temperature: 0.3,
                },
            });
            this.trackCall(meta, AI_FEATURE_KEYS.PLAN_CHAT, modelId, response.usageMetadata, startedAt);
            return (response.text ?? '').trim();
        } catch (error: any) {
            this.trackCall(meta, AI_FEATURE_KEYS.PLAN_CHAT, modelId, null, startedAt, 'failed', error?.message);
            console.error('[GeminiService] askQuestion error:', error);
            if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new Error('AI service quota exceeded. Please try again in a few moments.');
            }
            throw new Error('Unable to generate AI response at this time. Please try again later.');
        }
    }

    /**
     * Agent loop: run a model conversation with registered tools and execute
     * every function call the model requests, feeding results back until the
     * model returns plain text or the tool-call budget is exhausted.
     */
    async runWithTools(params: IRunWithToolsParams, meta?: IAICallMeta): Promise<IRunWithToolsResult> {
        const model = params.model ?? 'gemini-2.5-flash';
        const maxToolCalls = params.maxToolCalls ?? 40;
        const contents: any[] = [...params.contents];
        let toolCalls = 0;
        let emptyResponses = 0;

        const config: any = {
            systemInstruction: params.systemInstruction,
            temperature: params.temperature ?? 0.3,
        };
        if (params.maxOutputTokens) {
            config.maxOutputTokens = params.maxOutputTokens;
        }
        if (params.tools.length > 0) {
            config.tools = [{ functionDeclarations: params.tools }];
        }

        for (let iteration = 0; iteration < maxToolCalls + 2; iteration++) {
            let fullText = '';
            const functionCalls: any[] = [];
            let lastFinishReason: string | undefined;
            let lastUsage: any;
            let lastBlockReason: any;
            const iterationStartedAt = Date.now();

            try {
                const response = await this.genAI.models.generateContentStream({
                    model,
                    contents,
                    config,
                });

                for await (const chunk of response) {
                    const candidate = chunk.candidates?.[0];
                    if (candidate?.finishReason) lastFinishReason = candidate.finishReason;
                    if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
                    if (chunk.promptFeedback?.blockReason) lastBlockReason = chunk.promptFeedback.blockReason;
                    if (chunk.text) {
                        fullText += chunk.text;
                        params.onEvent?.({ type: 'text_delta', text: chunk.text });
                    }
                    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                        functionCalls.push(...chunk.functionCalls);
                    }
                }
            } catch (error: any) {
                this.trackCall(meta, AI_FEATURE_KEYS.PLAN_BUILD, model, lastUsage, iterationStartedAt, 'failed', error?.message);
                if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    throw new Error('AI service quota exceeded. Please try again in a few moments.');
                }
                throw error;
            }

            this.trackCall(meta, AI_FEATURE_KEYS.PLAN_BUILD, model, lastUsage, iterationStartedAt, 'success');

            if (functionCalls.length === 0) {
                if (!fullText.trim()) {
                    console.warn('[GeminiService] empty model response', JSON.stringify({
                        model,
                        finishReason: lastFinishReason,
                        blockReason: lastBlockReason,
                        usage: lastUsage,
                        contents: contents.length,
                    }));
                    // Transient empty responses (no text, no tool call) have been
                    // observed after gate answers. Nudge the model and retry
                    // instead of failing the whole step.
                    if (emptyResponses < 2) {
                        emptyResponses += 1;
                        contents.push({
                            role: 'user',
                            parts: [{ text: 'Continue the step now and produce the required deliverable. Do not return an empty response.' }],
                        });
                        continue;
                    }
                }
                params.onEvent?.({ type: 'turn_end' });
                return { text: fullText.trim(), contents, toolCalls };
            }

            for (const call of functionCalls) {
                const name: string = call.name;
                const args: any = call.args ?? {};
                toolCalls += 1;
                params.onEvent?.({ type: 'tool_call', toolName: name, toolArgs: args });

                let result: any;
                try {
                    result = await params.executeTool(name, args);
                } catch (error: any) {
                    result = { error: error.message ?? String(error) };
                }
                params.onEvent?.({ type: 'function_response', toolName: name, result });

                const modelPart: any = { functionCall: { name, args } };
                if (call.id) {
                    modelPart.functionCall.id = call.id;
                }
                const responsePart: any = { functionResponse: { name, response: result } };
                if (call.id) {
                    responsePart.functionResponse.id = call.id;
                }
                contents.push({ role: 'model', parts: [modelPart] });
                contents.push({ role: 'user', parts: [responsePart] });

                if (result && result.__plan_gate === true) {
                    params.onEvent?.({ type: 'turn_end' });
                    return { text: fullText.trim(), contents, toolCalls, gate: result };
                }
            }

            if (toolCalls >= maxToolCalls) {
                throw new Error(`Tool call budget exceeded (${maxToolCalls})`);
            }
        }

        throw new Error(`Agent loop did not converge after ${maxToolCalls + 2} iterations`);
    }

    /**
     * One-shot call: ask Gemini to generate a dashboard widget specification
     * from a block of AI insights text and the project's schema context.
     *
     * The returned IWidgetSpec contains a SQL query parameterised with
     * $1 = startDate (DATE) and $2 = endDate (DATE) so the caller can
     * bind real values when executing the widget.
     */
    async generateWidgetSpec(
        insightText: string,
        schemaContext: string,
        projectId: number,
        meta?: IAICallMeta
    ): Promise<IWidgetSpec> {
        const prompt = `You are a dashboard widget generator for a data analytics platform.

Project ID: ${projectId}

## Database Schema Context
${schemaContext}

## AI Insight to Visualise
${insightText}

Generate a dashboard widget specification for the insight above.
Use ONLY tables that exist in the schema context. The SQL query MUST:
- Be a SELECT statement only
- Use $1 for the start date filter (type DATE) and $2 for the end date filter (type DATE) when filtering by date
- Reference tables using the format schema."physical_table_name" exactly as shown in the schema

Respond with ONLY valid JSON (no markdown fences) matching this exact structure:
{
  "title": "<short widget title>",
  "chart_type": "<one of: bar|line|pie|donut|kpi|table|area>",
  "sql": "<parameterised SELECT statement>",
  "x_axis": "<column name for x-axis or null>",
  "y_axis": "<column name for y-axis or null>",
  "description": "<one sentence describing what this widget shows>"
}`;

        const startedAt = Date.now();
        let response: any;
        try {
            response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
        } catch (error: any) {
            this.trackCall(meta, AI_FEATURE_KEYS.REPORT_WIDGET, 'gemini-2.5-flash', null, startedAt, 'failed', error?.message);
            throw error;
        }
        this.trackCall(meta, AI_FEATURE_KEYS.REPORT_WIDGET, 'gemini-2.5-flash', response.usageMetadata, startedAt);

        const raw = (response.text ?? '').trim();

        // Strip markdown code fences if Gemini wraps the output anyway
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let spec: IWidgetSpec;
        try {
            spec = JSON.parse(cleaned);
        } catch {
            throw new Error(`Gemini returned invalid JSON for widget spec: ${cleaned.slice(0, 200)}`);
        }

        // Normalise chart_type to a known value
        const validTypes: IWidgetSpec['chart_type'][] = ['bar', 'line', 'pie', 'donut', 'kpi', 'table', 'area'];
        if (!validTypes.includes(spec.chart_type)) {
            spec.chart_type = 'bar';
        }

        return spec;
    }

    /**
     * DM-004: Generate a one-shot structured AI analysis of a data model.
     * Uses the statistical summary + sample data to produce marketing-focused insights.
     * @param context The prompt context containing column stats, correlations, anomalies, trends, and sample data
     * @returns Structured AI analysis result (key insights, patterns, anomalies, recommendations, data quality score)
     */
    async generateDataModelAnalysis(context: DataModelPromptContext, meta?: IAICallMeta): Promise<DataModelAIInsights> {
        const systemInstruction = getSystemInstruction();
        const userPrompt = buildDataModelAnalysisPrompt(context);
        const startedAt = Date.now();
        let response: any;
        try {
            response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.3,
                },
            });
        } catch (error: any) {
            this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODEL_ANALYSIS, 'gemini-2.5-flash', null, startedAt, 'failed', error?.message);
            throw error;
        }
        this.trackCall(meta, AI_FEATURE_KEYS.DATA_MODEL_ANALYSIS, 'gemini-2.5-flash', response.usageMetadata, startedAt);

        const raw = (response.text ?? '').trim();

        // Strip markdown code fences if the model wraps the output
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let result: DataModelAIInsights;
        try {
            result = JSON.parse(cleaned);
        } catch {
            throw new Error(`AI analysis returned invalid JSON: ${cleaned.slice(0, 300)}`);
        }

        // Validate and provide defaults for missing fields
        result.key_insights = result.key_insights || [];
        result.patterns_and_trends = result.patterns_and_trends || [];
        result.anomalies_detected = result.anomalies_detected || [];
        result.marketing_recommendations = result.marketing_recommendations || [];
        result.data_quality_score = result.data_quality_score || {
            overall_score: 0,
            completeness_score: 0,
            consistency_score: 0,
            issues: [],
        };

        return result;
    }

    /**
     * MKT-006: Generate a ready-made (non-chat) AI performance marketing
     * analysis report from the gathered marketing metrics, campaign
     * breakdowns, and user-defined targets.
     *
     * One-shot structured JSON call — the same pattern as
     * generateDataModelAnalysis().
     */
    async generateMarketingAnalysis(context: MarketingAnalysisPromptContext, meta?: IAICallMeta): Promise<IMarketingAnalysisAIResponse> {
        const systemInstruction = getMarketingAnalysisSystemInstruction();
        const userPrompt = buildMarketingAnalysisPrompt(context);
        const startedAt = Date.now();
        let response: any;
        try {
            response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.3,
                },
            });
        } catch (error: any) {
            this.trackCall(meta, AI_FEATURE_KEYS.AI_ANALYSIS, 'gemini-2.5-flash', null, startedAt, 'failed', error?.message);
            throw error;
        }
        this.trackCall(meta, AI_FEATURE_KEYS.AI_ANALYSIS, 'gemini-2.5-flash', response.usageMetadata, startedAt);

        const raw = (response.text ?? '').trim();

        // Strip markdown code fences if the model wraps the output
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let result: IMarketingAnalysisAIResponse;
        try {
            result = JSON.parse(cleaned);
        } catch {
            throw new Error(`AI marketing analysis returned invalid JSON: ${cleaned.slice(0, 300)}`);
        }

        // Validate and provide defaults for missing fields
        result.title = result.title || 'Marketing Performance Analysis';
        result.executive_summary = result.executive_summary || '';
        result.sections = Array.isArray(result.sections) ? result.sections : [];
        result.sections = result.sections.map((s: any) => ({
            heading: typeof s.heading === 'string' ? s.heading : 'Analysis',
            content: typeof s.content === 'string' ? s.content : '',
            recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
        }));
        result.spend_recommendations = Array.isArray(result.spend_recommendations) ? result.spend_recommendations : [];
        result.spend_recommendations = result.spend_recommendations.map((r: any) => ({
            entity: typeof r.entity === 'string' ? r.entity : 'Entity',
            entity_type: ['channel', 'campaign', 'ad_set', 'ad_group'].includes(r.entity_type) ? r.entity_type : 'channel',
            action: ['increase_budget', 'decrease_budget', 'maintain', 'pause'].includes(r.action) ? r.action : 'maintain',
            current_spend: typeof r.current_spend === 'number' ? r.current_spend : null,
            suggested_allocation: typeof r.suggested_allocation === 'string' ? r.suggested_allocation : null,
            rationale: typeof r.rationale === 'string' ? r.rationale : '',
        }));
        result.risks_and_alerts = Array.isArray(result.risks_and_alerts) ? result.risks_and_alerts : [];
        result.next_steps = Array.isArray(result.next_steps) ? result.next_steps : [];

        return result;
    }
}

/** AI-003: Cross-source insights for multi-platform data models */
export interface CrossSourceInsights {
    cross_channel_efficiency: Array<{
        metric: string;
        channel_comparison: Array<{
            channel: string;
            value: number;
            rank: number;
        }>;
        best_channel: string;
        worst_channel: string;
        insight: string;
    }>;
    budget_allocation: {
        current_distribution: Array<{
            channel: string;
            current_spend: number;
            percentage: number;
        }>;
        recommended_distribution: Array<{
            channel: string;
            recommended_spend: number;
            percentage: number;
            change: number;
        }>;
        total_budget: number;
        expected_improvement: string;
        rationale: string;
    };
    funnel_attribution: {
        top_of_funnel: Array<{
            channel: string;
            role: string;
            key_metrics: string[];
        }>;
        bottom_of_funnel: Array<{
            channel: string;
            role: string;
            key_metrics: string[];
        }>;
        insight: string;
    };
    cross_source_correlations: Array<{
        source_a: string;
        metric_a: string;
        source_b: string;
        metric_b: string;
        relationship: string;
        strength: 'strong' | 'moderate' | 'weak';
    }>;
    unified_strategy: {
        summary: string;
        action_items: Array<{
            action: string;
            priority: 'high' | 'medium' | 'low';
            channels_affected: string[];
            expected_impact: string;
        }>;
    };
}

/** Structured AI analysis response for a data model */
export interface DataModelAIInsights {
    key_insights: Array<{
        title: string;
        description: string;
        severity: 'info' | 'success' | 'warning' | 'danger';
        metric?: string | null;
        icon?: string;
        source?: string | null;
    }>;
    patterns_and_trends: Array<{
        pattern: string;
        columns_involved: string[];
        confidence: number;
        marketing_implication: string;
    }>;
    anomalies_detected: Array<{
        anomaly: string;
        affected_column: string;
        expected_range: string;
        actual_value: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    marketing_recommendations: Array<{
        recommendation: string;
        priority: 'high' | 'medium' | 'low';
        expected_impact: string;
        related_metrics: string[];
    }>;
    data_quality_score: {
        overall_score: number;
        completeness_score: number;
        consistency_score: number;
        issues: Array<{
            issue: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
            affected_columns: string[];
            recommendation: string;
        }>;
    };
    /** AI-003: Cross-source insights (only present for multi-source data models) */
    cross_source_insights?: CrossSourceInsights;
}

// Singleton instance
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
    if (!geminiServiceInstance) {
        geminiServiceInstance = new GeminiService();
    }
    return geminiServiceInstance;
}
