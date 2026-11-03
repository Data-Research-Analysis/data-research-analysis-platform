import { GeminiService } from './GeminiService.js';
import { AI_FEATURE_KEYS } from './AICallTrackerService.js';
import { DataModelContextBuilder } from './DataModelContextBuilder.js';
import { DataModelAnalysisService } from './DataModelAnalysisService.js';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import { getAppDataSource } from '../datasources/PostgresDS.js';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    supportingData?: any;
}

interface ChatSession {
    conversationId: string;
    dataModelId: number;
    userId: number;
    projectId: number;
    messages: ChatMessage[];
    createdAt: Date;
    lastActivityAt: Date;
}

export class DataModelChatService {
    private static instance: DataModelChatService;
    private geminiService: GeminiService;
    private contextBuilder: DataModelContextBuilder;
    private analysisService: DataModelAnalysisService;
    private sessions: Map<string, ChatSession> = new Map();
    private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
    private readonly MAX_MESSAGES_PER_SESSION = 50;
    private readonly MAX_ROWS_FOR_CONTEXT = 200;

    private constructor() {
        this.geminiService = new GeminiService();
        this.contextBuilder = new DataModelContextBuilder();
        this.analysisService = DataModelAnalysisService.getInstance();
        // Cleanup expired sessions every 15 minutes
        setInterval(() => this.cleanupExpiredSessions(), 15 * 60 * 1000);
    }

    static getInstance(): DataModelChatService {
        if (!DataModelChatService.instance) {
            DataModelChatService.instance = new DataModelChatService();
        }
        return DataModelChatService.instance;
    }

    /**
     * Start a new chat session for a data model
     */
    async startSession(dataModelId: number, userId: number, projectId: number): Promise<string> {
        const conversationId = `dm-chat-${dataModelId}-${userId}-${Date.now()}`;

        const systemPrompt = await this.buildSystemPrompt(dataModelId, userId);

        await this.geminiService.initializeConversation(conversationId, systemPrompt);

        const session: ChatSession = {
            conversationId,
            dataModelId,
            userId,
            projectId,
            messages: [],
            createdAt: new Date(),
            lastActivityAt: new Date(),
        };

        this.sessions.set(conversationId, session);

        // Persist the session so the conversation survives process restarts
        // (previously in-memory only, with a 1-hour timeout).
        await this.persistSession(session);

        return conversationId;
    }

    /** Build the system prompt (schema context + a small data sample). */
    private async buildSystemPrompt(dataModelId: number, userId: number): Promise<string> {
        const context = await this.contextBuilder.buildContext([dataModelId]);

        let dataSample = '';
        try {
            const processor = DataModelProcessor.getInstance();
            const rows = await processor.executeDataModelQuery(dataModelId, userId as any);
            if (rows && rows.length > 0) {
                const sampleRows = rows.slice(0, 20);
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                dataSample = this.formatDataSample(columns, sampleRows, rows.length);
            }
        } catch (error) {
            console.warn('[DataModelChatService] Could not load data sample:', error);
        }

        return this.buildChatSystemPrompt(context, dataSample);
    }

    /**
     * When a session is restored from the persistent store after a restart (or
     * after the in-memory Gemini conversation expired), rebuild the Gemini
     * conversation from the schema context and replay the past messages. The
     * replays are system re-feeds of already-paid work — recorded, never charged.
     */
    private async ensureGeminiConversation(session: ChatSession): Promise<void> {
        if (this.geminiService.sessionExists(session.conversationId)) return;

        const systemPrompt = await this.buildSystemPrompt(session.dataModelId, session.userId);
        await this.geminiService.initializeConversation(session.conversationId, systemPrompt);

        for (const msg of session.messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                await this.geminiService.sendMessage(session.conversationId, msg.content, {
                    featureKey: AI_FEATURE_KEYS.DATA_MODEL_CHAT,
                    actionId: String(session.conversationId),
                    userId: session.userId,
                    projectId: session.projectId,
                    replay: true,
                });
            }
        }
    }

    /** Load a session from memory, falling back to the persistent PG store. */
    private async loadSession(conversationId: string): Promise<ChatSession | null> {
        const cached = this.sessions.get(conversationId);
        if (cached) return cached;

        try {
            const dataSource = await getAppDataSource();
            if (!dataSource?.isInitialized) return null;
            const rows = await dataSource.query(
                `SELECT conversation_id, data_model_id, user_id, project_id, messages, created_at, last_activity_at
                 FROM "dra_ai_data_model_chat_sessions" WHERE conversation_id = $1`,
                [conversationId],
            );
            if (!rows || rows.length === 0) return null;

            const row = rows[0];
            const rawMessages = typeof row.messages === 'string' ? JSON.parse(row.messages) : (row.messages ?? []);
            const session: ChatSession = {
                conversationId,
                dataModelId: Number(row.data_model_id),
                userId: Number(row.user_id),
                projectId: Number(row.project_id),
                messages: rawMessages.map((m: any) => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                    supportingData: m.supportingData,
                })),
                createdAt: new Date(row.created_at),
                lastActivityAt: new Date(row.last_activity_at),
            };
            this.sessions.set(conversationId, session);
            return session;
        } catch (error) {
            console.warn('[DataModelChatService] Failed to load session from PostgreSQL:', (error as Error)?.message);
            return null;
        }
    }

    /** Upsert a session (full message array) into the persistent PG store. */
    private async persistSession(session: ChatSession): Promise<void> {
        try {
            const dataSource = await getAppDataSource();
            if (!dataSource?.isInitialized) return;
            await dataSource.query(
                `INSERT INTO "dra_ai_data_model_chat_sessions"
                    (conversation_id, data_model_id, user_id, project_id, messages, last_activity_at)
                 VALUES ($1, $2, $3, $4, $5, now())
                 ON CONFLICT (conversation_id) DO UPDATE SET
                    messages = EXCLUDED.messages,
                    last_activity_at = now()`,
                [
                    session.conversationId,
                    session.dataModelId,
                    session.userId,
                    session.projectId,
                    JSON.stringify(session.messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString(), supportingData: m.supportingData }))),
                ],
            );
        } catch (error) {
            console.warn('[DataModelChatService] Failed to persist session to PostgreSQL:', (error as Error)?.message);
        }
    }

    /**
     * Send a question and get an AI answer
     */
    async askQuestion(
        conversationId: string,
        question: string,
        dataModelId: number,
        userId: number,
        projectId: number,
        organizationId?: number | null
    ): Promise<{ answer: string; supportingData?: any }> {
        const session = await this.loadSession(conversationId);

        if (!session) {
            throw new Error('Chat session not found. Please start a new session.');
        }

        // After a restart the in-memory Gemini conversation may be gone even
        // though the session is restored — rebuild it (replays are free).
        await this.ensureGeminiConversation(session);

        if (session.messages.length >= this.MAX_MESSAGES_PER_SESSION) {
            throw new Error('Maximum conversation length reached. Please start a new session.');
        }

        session.lastActivityAt = new Date();

        // Add user message to session
        session.messages.push({
            role: 'user',
            content: question,
            timestamp: new Date(),
        });

        // Gather relevant data context based on the question
        const supportingData = await this.gatherRelevantData(question, dataModelId, userId, projectId);

        // Augment the question with data context if available
        let augmentedQuestion = question;
        if (supportingData) {
            augmentedQuestion = `${question}\n\n[Relevant data context]\n${JSON.stringify(supportingData, null, 2)}`;
        }

        // Send to Gemini and get response
        const answer = await this.geminiService.sendMessage(conversationId, augmentedQuestion, {
            featureKey: AI_FEATURE_KEYS.DATA_MODEL_CHAT,
            actionId: String(conversationId),
            userId,
            projectId,
            orgId: organizationId ?? null,
        });

        // Add assistant message to session
        session.messages.push({
            role: 'assistant',
            content: answer,
            timestamp: new Date(),
            supportingData,
        });

        // Persist the exchange so the history survives restarts.
        await this.persistSession(session);

        return { answer, supportingData };
    }

    /**
     * Get conversation history
     */
    async getHistory(conversationId: string): Promise<ChatMessage[]> {
        const session = await this.loadSession(conversationId);
        if (!session) return [];
        return session.messages;
    }

    /**
     * Gather relevant data based on the user's question
     */
    private async gatherRelevantData(
        question: string,
        dataModelId: number,
        userId: number,
        projectId: number
    ): Promise<any | null> {
        try {
            // Execute the data model query to get actual data
            const processor = DataModelProcessor.getInstance();
            const rows = await processor.executeDataModelQuery(dataModelId, userId as any);
            if (!rows || rows.length === 0) return null;

            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

            // If the dataset is small enough, include it all
            if (rows.length <= this.MAX_ROWS_FOR_CONTEXT) {
                return {
                    columns,
                    rows,
                    totalRows: rows.length,
                };
            }

            // For larger datasets, provide a relevant subset based on the question
            const questionLower = question.toLowerCase();
            let filteredRows = rows;

            // Try to filter based on question keywords
            const filterableKeywords = ['campaign', 'channel', 'source', 'platform', 'ad_group'];
            for (const keyword of filterableKeywords) {
                if (questionLower.includes(keyword)) {
                    const colIndex = columns.findIndex((c: string) =>
                        c.toLowerCase().includes(keyword)
                    );
                    if (colIndex >= 0) {
                        // Include all unique values for that column
                        const uniqueVals = new Set(filteredRows.map((r: any) => r[colIndex]));
                        if (uniqueVals.size <= 50) {
                            // Keep filtered subset
                            filteredRows = filteredRows.slice(0, this.MAX_ROWS_FOR_CONTEXT);
                        }
                    }
                }
            }

            // If still too large, take a representative sample
            if (filteredRows.length > this.MAX_ROWS_FOR_CONTEXT) {
                filteredRows = filteredRows.slice(0, this.MAX_ROWS_FOR_CONTEXT);
            }

            return {
                columns,
                rows: filteredRows,
                totalRows: rows.length,
                sampledRows: filteredRows.length,
            };
        } catch (error) {
            console.warn('[DataModelChatService] Error gathering relevant data:', error);
            return null;
        }
    }

    /**
     * Build the system prompt for the chat session
     */
    private buildChatSystemPrompt(context: any, dataSample: string): string {
        return `You are an expert data analyst assistant embedded in a data research platform. You help users understand and analyze their marketing data models.

## Your Role
- Answer questions about the user's data clearly and accurately
- Reference specific values, rows, and metrics from the data when answering
- Provide actionable insights and recommendations
- If you cannot answer based on the available data, say so honestly
- Format numbers appropriately (e.g., currency with $, percentages with %)
- When presenting data, use markdown tables for clarity

## Data Model Context
${context.markdownSummary || 'No additional context available.'}

${dataSample ? `## Data Sample\n${dataSample}` : ''}

## Guidelines
- Always reference actual data values when making claims
- If the question cannot be answered from the available data, explain what data would be needed
- For trend questions, look at date-ordered data
- For comparison questions, provide specific numbers
- Keep answers concise but thorough
- Use bullet points and tables for structured answers`;
    }

    /**
     * Format data sample for prompt context
     */
    private formatDataSample(columns: string[], rows: any[], totalRows: number): string {
        const header = `| ${columns.join(' | ')} |`;
        const separator = `| ${columns.map(() => '---').join(' | ')} |`;
        const dataRows = rows.slice(0, 20).map(
            (row: any) => `| ${columns.map((_: string, i: number) => String(row[i] ?? 'NULL')).join(' | ')} |`
        );

        return `Total rows: ${totalRows}\n\n${header}\n${separator}\n${dataRows.join('\n')}`;
    }

    /**
     * Cleanup expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = new Date();
        for (const [id, session] of this.sessions.entries()) {
            if (now.getTime() - session.lastActivityAt.getTime() > this.SESSION_TIMEOUT_MS) {
                this.sessions.delete(id);
            }
        }
    }
}