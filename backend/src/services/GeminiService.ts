import { GoogleGenAI } from '@google/genai';
import { AI_DATA_MODELER_TEMPLATE_PROMPT, AI_DATA_MODELER_CHAT_PROMPT } from '../constants/system-prompts.js';
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
                model: 'gemini-1.5-flash',
                contents: session.chat
            });

            const responseText = response.text || '';

            // Add assistant response to history
            session.chat.push({
                role: 'model',
                parts: [{ text: responseText }]
            });
            
            return responseText;
        } catch (error) {
            console.error('Error sending message to Gemini:', error);
            throw new Error('Failed to get AI response');
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
                model: 'gemini-1.5-flash',
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
}

// Singleton instance
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
    if (!geminiServiceInstance) {
        geminiServiceInstance = new GeminiService();
    }
    return geminiServiceInstance;
}
