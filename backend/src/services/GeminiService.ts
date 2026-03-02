import { GoogleGenAI } from '@google/genai';
import { AI_DATA_MODELER_TEMPLATE_PROMPT, AI_DATA_MODELER_CHAT_PROMPT } from '../constants/system-prompts.js';
import { IWidgetSpec } from '../types/IWidgetSpec.js';
import dotenv from 'dotenv';

dotenv.config();

interface ChatSession {
    chat: any;
    createdAt: Date;
    schemaContext: string;
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
    async sendMessage(conversationId: string, message: string): Promise<string> {
        const session = this.chatSessions.get(conversationId);
        
        if (!session) {
            throw new Error('Conversation not found. Please initialize a new conversation.');
        }

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

            // Add assistant response to history
            session.chat.push({
                role: 'model',
                parts: [{ text: responseText }]
            });
            
            return responseText;
        } catch (error: any) {
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
        onChunk: (chunk: string) => void
    ): Promise<string> {
        const session = this.chatSessions.get(conversationId);
        
        if (!session) {
            throw new Error('Conversation not found. Please initialize a new conversation.');
        }

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
                fullResponse += chunkText;
                onChunk(chunkText);
            }

            // Add assistant response to history
            session.chat.push({
                role: 'model',
                parts: [{ text: fullResponse }]
            });
            
            return fullResponse;
        } catch (error) {
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
        projectId: number
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

        const response = await this.genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

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
}

// Singleton instance
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
    if (!geminiServiceInstance) {
        geminiServiceInstance = new GeminiService();
    }
    return geminiServiceInstance;
}
