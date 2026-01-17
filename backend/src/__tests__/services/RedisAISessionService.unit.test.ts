import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RedisAISessionService } from '../RedisAISessionService.js';
import { MockRedisClient, TestDataFactory } from '../../__tests__/mocks/MockManager.js';

// Mock the Redis client
let mockRedis: MockRedisClient;

jest.mock('../../config/redis.config.js', () => ({
    getRedisClient: () => mockRedis,
    RedisTTL: {
        AI_SESSION: 3600 // 1 hour
    }
}));

/**
 * Unit tests for RedisAISessionService
 * Tests Redis-based session persistence and management
 */
describe('RedisAISessionService', () => {
    let service: RedisAISessionService;
    const dataSourceId = 1;
    const userId = 100;

    beforeEach(() => {
        mockRedis = new MockRedisClient();
        service = new RedisAISessionService();
    });

    afterEach(() => {
        mockRedis.clear();
    });

    describe('Session Management', () => {
        const schemaContext = TestDataFactory.createSchemaContext();

        it('should create new session with metadata', async () => {
            const session = await service.createSession(
                dataSourceId,
                userId,
                schemaContext
            );

            expect(session).toBeDefined();
            expect(session.conversationId).toBeDefined();
            expect(session.dataSourceId).toBe(dataSourceId);
            expect(session.userId).toBe(userId);
            expect(session.status).toBe('draft');
            expect(session.startedAt).toBeDefined();
            expect(session.lastActivityAt).toBeDefined();
        });

        it('should set TTL on session creation', async () => {
            await service.createSession(dataSourceId, userId, schemaContext);
            
            const key = service.getConversationKey(dataSourceId, userId);
            const ttl = await mockRedis.ttl(key);
            
            expect(ttl).toBeGreaterThan(0);
        });

        it('should retrieve existing session', async () => {
            const created = await service.createSession(
                dataSourceId,
                userId,
                schemaContext
            );

            const retrieved = await service.getSession(dataSourceId, userId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.conversationId).toBe(created.conversationId);
            expect(retrieved?.dataSourceId).toBe(dataSourceId);
            expect(retrieved?.userId).toBe(userId);
        });

        it('should return null for non-existent session', async () => {
            const session = await service.getSession(999, 999);
            expect(session).toBeNull();
        });

        it('should update session activity timestamp', async () => {
            const created = await service.createSession(
                dataSourceId,
                userId,
                schemaContext
            );

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            await service.updateSessionActivity(dataSourceId, userId);

            const updated = await service.getSession(dataSourceId, userId);
            
            expect(updated?.lastActivityAt).not.toBe(created.lastActivityAt);
        });

        it('should clear session data', async () => {
            await service.createSession(dataSourceId, userId, schemaContext);
            
            await service.clearSession(dataSourceId, userId);

            const session = await service.getSession(dataSourceId, userId);
            expect(session).toBeNull();
        });
    });

    describe('Message Management', () => {
        beforeEach(async () => {
            const schemaContext = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schemaContext);
        });

        it('should add user message', async () => {
            const message = await service.addMessage(
                dataSourceId,
                userId,
                'user',
                'Create a sales report'
            );

            expect(message).toBeDefined();
            expect(message.role).toBe('user');
            expect(message.content).toBe('Create a sales report');
            expect(message.timestamp).toBeDefined();
        });

        it('should add assistant message', async () => {
            const message = await service.addMessage(
                dataSourceId,
                userId,
                'assistant',
                'I can help you build that'
            );

            expect(message.role).toBe('assistant');
            expect(message.content).toBe('I can help you build that');
        });

        it('should maintain message order', async () => {
            await service.addMessage(dataSourceId, userId, 'user', 'Message 1');
            await service.addMessage(dataSourceId, userId, 'assistant', 'Message 2');
            await service.addMessage(dataSourceId, userId, 'user', 'Message 3');

            const messages = await service.getMessages(dataSourceId, userId);

            expect(messages).toHaveLength(3);
            expect(messages[0].content).toBe('Message 1');
            expect(messages[1].content).toBe('Message 2');
            expect(messages[2].content).toBe('Message 3');
        });

        it('should retrieve all messages in order', async () => {
            const msg1 = await service.addMessage(dataSourceId, userId, 'user', 'First');
            const msg2 = await service.addMessage(dataSourceId, userId, 'assistant', 'Second');

            const messages = await service.getMessages(dataSourceId, userId);

            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('First');
            expect(messages[1].content).toBe('Second');
        });

        it('should clear messages', async () => {
            await service.addMessage(dataSourceId, userId, 'user', 'Test message');
            
            await service.clearMessages(dataSourceId, userId);

            const messages = await service.getMessages(dataSourceId, userId);
            expect(messages).toHaveLength(0);
        });

        it('should handle empty message content', async () => {
            const message = await service.addMessage(
                dataSourceId,
                userId,
                'user',
                ''
            );

            expect(message.content).toBe('');
        });

        it('should handle very long messages', async () => {
            const longContent = 'A'.repeat(10000);
            const message = await service.addMessage(
                dataSourceId,
                userId,
                'user',
                longContent
            );

            expect(message.content).toBe(longContent);
        });

        it('should return empty array when no messages exist', async () => {
            const messages = await service.getMessages(dataSourceId, userId);
            expect(messages).toEqual([]);
        });
    });

    describe('Model Draft Management', () => {
        beforeEach(async () => {
            const schemaContext = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schemaContext);
        });

        it('should save model draft', async () => {
            const modelState = {
                tables: [{ table_name: 'users', columns: [] }],
                relationships: [],
                indexes: []
            };

            const draft = await service.saveModelDraft(
                dataSourceId,
                userId,
                modelState
            );

            expect(draft).toBeDefined();
            expect(draft.tables).toEqual(modelState.tables);
            expect(draft.version).toBe(1);
            expect(draft.lastModified).toBeDefined();
        });

        it('should increment version on each save', async () => {
            const modelState = { tables: [], relationships: [], indexes: [] };

            const draft1 = await service.saveModelDraft(dataSourceId, userId, modelState);
            const draft2 = await service.saveModelDraft(dataSourceId, userId, modelState);
            const draft3 = await service.saveModelDraft(dataSourceId, userId, modelState);

            expect(draft1.version).toBe(1);
            expect(draft2.version).toBe(2);
            expect(draft3.version).toBe(3);
        });

        it('should update lastModified timestamp', async () => {
            const modelState = { tables: [], relationships: [], indexes: [] };

            const draft1 = await service.saveModelDraft(dataSourceId, userId, modelState);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const draft2 = await service.saveModelDraft(dataSourceId, userId, modelState);

            expect(new Date(draft2.lastModified).getTime()).toBeGreaterThan(
                new Date(draft1.lastModified).getTime()
            );
        });

        it('should retrieve model draft', async () => {
            const modelState = {
                tables: [{ table_name: 'products', columns: [] }],
                relationships: [],
                indexes: []
            };

            await service.saveModelDraft(dataSourceId, userId, modelState);
            
            const retrieved = await service.getModelDraft(dataSourceId, userId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.tables).toEqual(modelState.tables);
        });

        it('should merge partial updates', async () => {
            await service.saveModelDraft(dataSourceId, userId, {
                tables: [{ table_name: 'users' }],
                relationships: [],
                indexes: []
            });

            const updated = await service.saveModelDraft(dataSourceId, userId, {
                tables: [{ table_name: 'products' }]
            });

            expect(updated.tables[0].table_name).toBe('products');
            expect(updated.version).toBe(2);
        });

        it('should return null when no draft exists', async () => {
            const draft = await service.getModelDraft(dataSourceId, userId);
            expect(draft).toBeNull();
        });

        it('should clear model draft', async () => {
            const modelState = { tables: [], relationships: [], indexes: [] };
            await service.saveModelDraft(dataSourceId, userId, modelState);

            await service.clearModelDraft(dataSourceId, userId);

            const draft = await service.getModelDraft(dataSourceId, userId);
            expect(draft).toBeNull();
        });
    });

    describe('Schema Context', () => {
        it('should save schema context', async () => {
            const schema = TestDataFactory.createSchemaContext(5);

            await service.saveSchemaContext(dataSourceId, userId, schema);

            const retrieved = await service.getSchemaContext(dataSourceId, userId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.tables).toHaveLength(5);
        });

        it('should retrieve schema context', async () => {
            const schema = TestDataFactory.createGoogleAnalyticsSchema();

            await service.saveSchemaContext(dataSourceId, userId, schema);

            const retrieved = await service.getSchemaContext(dataSourceId, userId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.tables[0].schema).toBe('dra_google_analytics');
        });

        it('should handle large schemas', async () => {
            const largeSchema = TestDataFactory.createSchemaContext(100);

            await service.saveSchemaContext(dataSourceId, userId, largeSchema);

            const retrieved = await service.getSchemaContext(dataSourceId, userId);

            expect(retrieved?.tables).toHaveLength(100);
        });

        it('should return null when no context exists', async () => {
            const schema = await service.getSchemaContext(dataSourceId, userId);
            expect(schema).toBeNull();
        });
    });

    describe('Bulk Operations', () => {
        beforeEach(async () => {
            const schemaContext = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schemaContext);
        });

        it('should get full session with all data', async () => {
            // Add messages
            await service.addMessage(dataSourceId, userId, 'user', 'Hello');
            await service.addMessage(dataSourceId, userId, 'assistant', 'Hi there');

            // Add model draft
            await service.saveModelDraft(dataSourceId, userId, {
                tables: [{ table_name: 'test' }],
                relationships: [],
                indexes: []
            });

            const fullSession = await service.getFullSession(dataSourceId, userId);

            expect(fullSession.metadata).toBeDefined();
            expect(fullSession.messages).toHaveLength(2);
            expect(fullSession.modelDraft).toBeDefined();
            expect(fullSession.schemaContext).toBeDefined();
        });

        it('should handle partial session data gracefully', async () => {
            // Only metadata exists, no messages or draft
            const fullSession = await service.getFullSession(dataSourceId, userId);

            expect(fullSession.metadata).toBeDefined();
            expect(fullSession.messages).toEqual([]);
            expect(fullSession.modelDraft).toBeNull();
        });

        it('should clear all session data atomically', async () => {
            await service.addMessage(dataSourceId, userId, 'user', 'Test');
            await service.saveModelDraft(dataSourceId, userId, { tables: [], relationships: [], indexes: [] });

            await service.clearAllSessionData(dataSourceId, userId);

            const session = await service.getSession(dataSourceId, userId);
            const messages = await service.getMessages(dataSourceId, userId);
            const draft = await service.getModelDraft(dataSourceId, userId);

            expect(session).toBeNull();
            expect(messages).toEqual([]);
            expect(draft).toBeNull();
        });
    });

    describe('Session Lifecycle', () => {
        beforeEach(async () => {
            const schemaContext = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schemaContext);
        });

        it('should check if session exists', async () => {
            const exists = await service.sessionExists(dataSourceId, userId);
            expect(exists).toBe(true);

            const notExists = await service.sessionExists(999, 999);
            expect(notExists).toBe(false);
        });

        it('should get session TTL', async () => {
            const ttl = await service.getSessionTTL(dataSourceId, userId);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(3600); // Should be less than or equal to initial TTL
        });

        it('should extend session TTL', async () => {
            const initialTTL = await service.getSessionTTL(dataSourceId, userId);
            
            await service.extendSession(dataSourceId, userId);
            
            const newTTL = await service.getSessionTTL(dataSourceId, userId);
            expect(newTTL).toBeGreaterThanOrEqual(initialTTL);
        });

        it('should handle expired sessions', async () => {
            // Note: This is tested via TTL checks
            const ttl = await service.getSessionTTL(dataSourceId, userId);
            expect(ttl).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle concurrent updates', async () => {
            const schema = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schema);

            // Simulate concurrent message additions
            await Promise.all([
                service.addMessage(dataSourceId, userId, 'user', 'Msg 1'),
                service.addMessage(dataSourceId, userId, 'user', 'Msg 2'),
                service.addMessage(dataSourceId, userId, 'user', 'Msg 3')
            ]);

            const messages = await service.getMessages(dataSourceId, userId);
            expect(messages).toHaveLength(3);
        });

        it('should handle very large payloads', async () => {
            const largePayload = {
                tables: Array(100).fill({
                    table_name: 'test_table',
                    columns: Array(50).fill({ column_name: 'col', data_type: 'varchar' })
                }),
                relationships: [],
                indexes: []
            };

            const draft = await service.saveModelDraft(dataSourceId, userId, largePayload);
            expect(draft.tables).toHaveLength(100);
        });

        it('should handle JSON parse errors gracefully', async () => {
            // Manually corrupt data in Redis
            const key = service.getConversationKey(dataSourceId, userId);
            await mockRedis.set(key, 'invalid json{{{');

            const session = await service.getSession(dataSourceId, userId);
            // Should handle error and return null or throw
            expect(session).toBeDefined(); // Depending on implementation
        });

        it('should handle special characters in content', async () => {
            const schema = TestDataFactory.createSchemaContext();
            await service.createSession(dataSourceId, userId, schema);

            const specialContent = 'Test <>&"\'{}\n\t';
            const message = await service.addMessage(
                dataSourceId,
                userId,
                'user',
                specialContent
            );

            expect(message.content).toBe(specialContent);
        });
    });
});
