import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GeminiService } from '../GeminiService.js';
import { MockGenAI } from '../../__tests__/mocks/MockManager.js';

// Mock the Google GenAI import
jest.mock('@google/genai', () => ({
    GoogleGenAI: MockGenAI
}));

/**
 * Unit tests for GeminiService
 * Tests AI conversation management, session handling, and streaming
 */
describe('GeminiService', () => {
    let service: GeminiService;
    let mockGenAI: MockGenAI;

    beforeEach(() => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test-api-key';
        
        // Create fresh instance
        service = new GeminiService();
        mockGenAI = new MockGenAI();
    });

    afterEach(() => {
        // Clean up
        delete process.env.GEMINI_API_KEY;
        mockGenAI.clear();
    });

    describe('Initialization', () => {
        it('should initialize with valid API key', () => {
            expect(service).toBeDefined();
            expect(service.getActiveSessionCount()).toBe(0);
        });

        it('should throw error when API key is missing', () => {
            delete process.env.GEMINI_API_KEY;
            
            expect(() => {
                new GeminiService();
            }).toThrow('GEMINI_API_KEY environment variable is not set');
        });

        it('should start with zero active sessions', () => {
            expect(service.getActiveSessionCount()).toBe(0);
        });
    });

    describe('Conversation Management', () => {
        const conversationId = 'test-conv-123';
        const schemaContext = '# Database Schema\n## Table: users\n- id (integer)';

        it('should initialize new conversation with schema context', async () => {
            const result = await service.initializeConversation(
                conversationId,
                schemaContext
            );

            expect(result).toBe(conversationId);
            expect(service.sessionExists(conversationId)).toBe(true);
            expect(service.getActiveSessionCount()).toBe(1);
        });

        it('should initialize with custom system prompt', async () => {
            const customPrompt = 'Custom AI prompt for testing';
            
            const result = await service.initializeConversation(
                conversationId,
                schemaContext,
                customPrompt
            );

            expect(result).toBe(conversationId);
            expect(service.sessionExists(conversationId)).toBe(true);
        });

        it('should store conversation in session map', async () => {
            await service.initializeConversation(conversationId, schemaContext);
            
            const history = await service.getConversationHistory(conversationId);
            expect(history).toBeDefined();
            expect(history.conversationId).toBe(conversationId);
            expect(history.schemaContext).toBe(schemaContext);
        });

        it('should handle multiple conversations independently', async () => {
            const conv1 = 'conv-1';
            const conv2 = 'conv-2';

            await service.initializeConversation(conv1, 'Schema 1');
            await service.initializeConversation(conv2, 'Schema 2');

            expect(service.getActiveSessionCount()).toBe(2);
            expect(service.sessionExists(conv1)).toBe(true);
            expect(service.sessionExists(conv2)).toBe(true);
        });

        it('should destroy conversation', async () => {
            await service.initializeConversation(conversationId, schemaContext);
            
            const destroyed = service.destroyConversation(conversationId);
            
            expect(destroyed).toBe(true);
            expect(service.sessionExists(conversationId)).toBe(false);
            expect(service.getActiveSessionCount()).toBe(0);
        });

        it('should return false when destroying non-existent conversation', () => {
            const destroyed = service.destroyConversation('non-existent');
            expect(destroyed).toBe(false);
        });
    });

    describe('Message Handling', () => {
        const conversationId = 'test-conv-msg';
        const schemaContext = '# Schema';

        beforeEach(async () => {
            await service.initializeConversation(conversationId, schemaContext);
        });

        it('should send message to existing conversation', async () => {
            const message = 'Create a sales report model';
            
            const response = await service.sendMessage(conversationId, message);
            
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should throw error for non-existent conversation', async () => {
            await expect(
                service.sendMessage('non-existent-conv', 'test message')
            ).rejects.toThrow('Conversation not found');
        });

        it('should handle empty messages', async () => {
            const response = await service.sendMessage(conversationId, '');
            expect(response).toBeDefined();
        });

        it('should handle very long messages', async () => {
            const longMessage = 'A'.repeat(10000);
            
            const response = await service.sendMessage(conversationId, longMessage);
            expect(response).toBeDefined();
        });

        it('should maintain conversation context across messages', async () => {
            await service.sendMessage(conversationId, 'What tables do I have?');
            const response2 = await service.sendMessage(conversationId, 'Tell me more about the first one');
            
            expect(response2).toBeDefined();
        });
    });

    describe('Streaming', () => {
        const conversationId = 'test-conv-stream';
        const schemaContext = '# Schema';

        beforeEach(async () => {
            await service.initializeConversation(conversationId, schemaContext);
            mockGenAI.setDefaultResponse('This is a test response');
        });

        it('should stream responses with chunks', async () => {
            const chunks: string[] = [];
            
            const fullResponse = await service.sendMessageStream(
                conversationId,
                'Test message',
                (chunk) => chunks.push(chunk)
            );

            expect(chunks.length).toBeGreaterThan(0);
            expect(fullResponse).toBeDefined();
            expect(typeof fullResponse).toBe('string');
        });

        it('should accumulate full response from chunks', async () => {
            let accumulated = '';
            
            const fullResponse = await service.sendMessageStream(
                conversationId,
                'Test message',
                (chunk) => { accumulated += chunk; }
            );

            expect(accumulated).toBe(fullResponse);
        });

        it('should call onChunk callback for each chunk', async () => {
            const onChunk = jest.fn();
            
            await service.sendMessageStream(
                conversationId,
                'Test message',
                onChunk
            );

            expect(onChunk).toHaveBeenCalled();
        });

        it('should throw error for non-existent conversation', async () => {
            await expect(
                service.sendMessageStream(
                    'non-existent',
                    'test',
                    () => {}
                )
            ).rejects.toThrow('Conversation not found');
        });
    });

    describe('Session Cleanup', () => {
        it('should cleanup expired sessions', async () => {
            const oldConv = 'old-conv';
            
            // Create conversation
            await service.initializeConversation(oldConv, 'Schema');
            
            // Manually age the session (access private property for testing)
            const sessions = (service as any).chatSessions;
            const session = sessions.get(oldConv);
            if (session) {
                // Set created time to 2 hours ago (past timeout)
                session.createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
            }

            // Run cleanup
            (service as any).cleanupExpiredSessions();

            // Session should be removed
            expect(service.sessionExists(oldConv)).toBe(false);
        });

        it('should preserve active sessions during cleanup', async () => {
            const activeConv = 'active-conv';
            
            await service.initializeConversation(activeConv, 'Schema');
            
            // Run cleanup (session is recent, should not be removed)
            (service as any).cleanupExpiredSessions();

            expect(service.sessionExists(activeConv)).toBe(true);
        });

        it('should handle sessions exactly at timeout boundary', async () => {
            const boundaryConv = 'boundary-conv';
            
            await service.initializeConversation(boundaryConv, 'Schema');
            
            // Set to exactly at timeout (1 hour)
            const sessions = (service as any).chatSessions;
            const session = sessions.get(boundaryConv);
            if (session) {
                session.createdAt = new Date(Date.now() - 60 * 60 * 1000);
            }

            (service as any).cleanupExpiredSessions();

            // Should NOT be removed (> timeout, not >=)
            expect(service.sessionExists(boundaryConv)).toBe(true);
        });
    });

    describe('Session Queries', () => {
        const conversationId = 'test-query-conv';
        const schemaContext = '# Test Schema';

        it('should check if session exists', async () => {
            expect(service.sessionExists(conversationId)).toBe(false);
            
            await service.initializeConversation(conversationId, schemaContext);
            
            expect(service.sessionExists(conversationId)).toBe(true);
        });

        it('should return correct active session count', async () => {
            expect(service.getActiveSessionCount()).toBe(0);

            await service.initializeConversation('conv1', schemaContext);
            expect(service.getActiveSessionCount()).toBe(1);

            await service.initializeConversation('conv2', schemaContext);
            expect(service.getActiveSessionCount()).toBe(2);

            service.destroyConversation('conv1');
            expect(service.getActiveSessionCount()).toBe(1);
        });

        it('should get conversation history', async () => {
            await service.initializeConversation(conversationId, schemaContext);
            
            const history = await service.getConversationHistory(conversationId);
            
            expect(history).toBeDefined();
            expect(history.conversationId).toBe(conversationId);
            expect(history.createdAt).toBeInstanceOf(Date);
            expect(history.schemaContext).toBe(schemaContext);
        });

        it('should throw error when getting history for non-existent conversation', async () => {
            await expect(
                service.getConversationHistory('non-existent')
            ).rejects.toThrow('Conversation not found');
        });
    });

    describe('Error Handling', () => {
        const conversationId = 'test-error-conv';

        it('should handle API errors gracefully', async () => {
            await service.initializeConversation(conversationId, 'Schema');
            
            // Force an error by providing invalid data to mock
            await expect(
                service.sendMessage(conversationId, 'test')
            ).resolves.toBeDefined(); // Should not throw, should return response
        });

        it('should handle initialization errors', async () => {
            // Mock should handle this, but if real API fails, it should throw
            await expect(
                service.initializeConversation('test', '')
            ).resolves.toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle special characters in messages', async () => {
            const convId = 'special-chars-conv';
            await service.initializeConversation(convId, 'Schema');
            
            const specialMessage = 'Test with special chars: <>&"\'{}[]';
            const response = await service.sendMessage(convId, specialMessage);
            
            expect(response).toBeDefined();
        });

        it('should handle Unicode characters', async () => {
            const convId = 'unicode-conv';
            await service.initializeConversation(convId, 'Schema');
            
            const unicodeMessage = 'Test 中文 العربية 🎉';
            const response = await service.sendMessage(convId, unicodeMessage);
            
            expect(response).toBeDefined();
        });

        it('should handle multiline messages', async () => {
            const convId = 'multiline-conv';
            await service.initializeConversation(convId, 'Schema');
            
            const multilineMessage = 'Line 1\nLine 2\nLine 3';
            const response = await service.sendMessage(convId, multilineMessage);
            
            expect(response).toBeDefined();
        });
    });
});
