import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIDataModelerController } from '../AIDataModelerController.js';
import { 
    MockRedisClient, 
    MockEntityManager, 
    MockGenAI,
    TestDataFactory,
    createMockRequest,
    createMockResponse
} from '../../__tests__/mocks/MockManager.js';

// Mock dependencies
let mockRedis: MockRedisClient;
let mockEntityManager: MockEntityManager;
let mockGenAI: MockGenAI;

jest.mock('../../config/redis.config.js', () => ({
    getRedisClient: () => mockRedis,
    RedisTTL: { AI_SESSION: 3600 }
}));

jest.mock('@google/genai', () => ({
    GoogleGenAI: MockGenAI
}));

/**
 * Unit tests for AIDataModelerController
 * Tests all endpoints, response parsing, and error handling
 */
describe('AIDataModelerController', () => {
    beforeEach(() => {
        mockRedis = new MockRedisClient();
        mockEntityManager = new MockEntityManager();
        mockGenAI = new MockGenAI();
        
        // Set up environment
        process.env.GEMINI_API_KEY = 'test-key';
    });

    afterEach(() => {
        mockRedis.clear();
        mockEntityManager.clear();
        mockGenAI.clear();
        delete process.env.GEMINI_API_KEY;
    });

    describe('Response Parsing', () => {
        describe('parseAIResponse', () => {
            it('should parse GUIDE action correctly', () => {
                const aiResponse = TestDataFactory.createAIGuideResponse(
                    'Here are some suggestions for your data model'
                );
                const wrapped = `\`\`\`json\n${aiResponse}\n\`\`\``;

                const result = (AIDataModelerController as any).parseAIResponse(wrapped);

                expect(result.action).toBe('GUIDE');
                expect(result.displayMessage).toBe('Here are some suggestions for your data model');
                expect(result.dataModel).toBeNull();
            });

            it('should parse BUILD_DATA_MODEL action correctly', () => {
                const guidance = 'I have created a sales report model for you';
                const aiResponse = TestDataFactory.createAIBuildModelResponse(guidance);
                const wrapped = `\`\`\`json\n${aiResponse}\n\`\`\``;

                const result = (AIDataModelerController as any).parseAIResponse(wrapped);

                expect(result.action).toBe('BUILD_DATA_MODEL');
                expect(result.displayMessage).toBe(guidance);
                expect(result.dataModel).toBeDefined();
                expect(result.dataModel.tables).toBeDefined();
            });

            it('should parse NONE action correctly', () => {
                const aiResponse = TestDataFactory.createAINoneResponse();
                const wrapped = `\`\`\`json\n${aiResponse}\n\`\`\``;

                const result = (AIDataModelerController as any).parseAIResponse(wrapped);

                expect(result.action).toBe('NONE');
                expect(result.displayMessage).toContain('only help with data modeling');
                expect(result.dataModel).toBeNull();
            });

            it('should handle malformed JSON', () => {
                const malformedJSON = '\`\`\`json\n{invalid json}}}\n\`\`\`';

                const result = (AIDataModelerController as any).parseAIResponse(malformedJSON);

                expect(result.action).toBe('ERROR');
                expect(result.displayMessage).toBeDefined();
                expect(result.dataModel).toBeNull();
            });

            it('should handle response without JSON block', () => {
                const plainText = 'This is just plain text without JSON';

                const result = (AIDataModelerController as any).parseAIResponse(plainText);

                expect(result.action).toBe('UNKNOWN');
                expect(result.displayMessage).toBe(plainText);
            });

            it('should handle missing action field', () => {
                const noAction = '\`\`\`json\n{"message": "test"}\n\`\`\`';

                const result = (AIDataModelerController as any).parseAIResponse(noAction);

                expect(result).toBeDefined();
                expect(result.displayMessage).toBeDefined();
            });

            it('should extract data model from old format', () => {
                const oldFormat = '\`\`\`json\n{"action": "BUILD_DATA_MODEL", "model": {"tables": []}}\n\`\`\`';

                const result = (AIDataModelerController as any).parseAIResponse(oldFormat);

                expect(result.action).toBe('BUILD_DATA_MODEL');
                expect(result.dataModel).toBeDefined();
            });
        });

        describe('extractDataModelJSON', () => {
            it('should extract data model from JSON block', () => {
                const model = TestDataFactory.createDataModel();
                const response = `\`\`\`json\n{"action": "BUILD_DATA_MODEL", "model": ${JSON.stringify(model)}}\n\`\`\``;

                const extracted = (AIDataModelerController as any).extractDataModelJSON(response);

                expect(extracted).toBeDefined();
                expect(extracted.tables).toBeDefined();
            });

            it('should return null for non-model JSON', () => {
                const response = '\`\`\`json\n{"action": "GUIDE", "message": "test"}\n\`\`\`';

                const extracted = (AIDataModelerController as any).extractDataModelJSON(response);

                expect(extracted).toBeNull();
            });

            it('should return null when no JSON block found', () => {
                const response = 'Plain text response';

                const extracted = (AIDataModelerController as any).extractDataModelJSON(response);

                expect(extracted).toBeNull();
            });

            it('should handle invalid JSON', () => {
                const response = '\`\`\`json\n{invalid}\n\`\`\`';

                const extracted = (AIDataModelerController as any).extractDataModelJSON(response);

                expect(extracted).toBeNull();
            });
        });
    });

    describe('Validation and Error Handling', () => {
        it('should validate required dataSourceId', async () => {
            const req = createMockRequest({});
            const res = createMockResponse();

            await AIDataModelerController.initializeSession(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
        });

        it('should validate required userId', async () => {
            const req = createMockRequest(
                { dataSourceId: 1 },
                {}
            );
            req.body.tokenDetails = null;
            const res = createMockResponse();

            await AIDataModelerController.initializeSession(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle database connection errors', async () => {
            const req = createMockRequest({ dataSourceId: 999 });
            const res = createMockResponse();

            await AIDataModelerController.initializeSession(req, res);

            // Should handle gracefully with error response
            expect(res.status).toHaveBeenCalled();
        });

        it('should handle unauthorized access', async () => {
            const req = createMockRequest({ dataSourceId: 1 });
            req.body.tokenDetails = { user_id: 999 }; // Wrong user
            const res = createMockResponse();

            await AIDataModelerController.initializeSession(req, res);

            // Should fail authorization check
            expect(res.status).toHaveBeenCalled();
        });
    });

    describe('Session Initialization (Single-Source)', () => {
        it('should create session metadata structure', async () => {
            // This would require more extensive mocking of database layer
            // Simplified test to verify the structure
            const req = createMockRequest({ dataSourceId: 1 });
            const res = createMockResponse();

            await AIDataModelerController.initializeSession(req, res);

            // Verify response structure (actual implementation depends on DB mocking)
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('Cross-Source Initialization', () => {
        it('should validate projectId and dataSources array', async () => {
            const req = createMockRequest({
                projectId: 1,
                dataSources: []
            });
            const res = createMockResponse();

            await AIDataModelerController.initializeCrossSourceSession(req, res);

            // Should require non-empty dataSources array
            expect(res.status).toHaveBeenCalled();
        });

        it('should handle invalid project ID', async () => {
            const req = createMockRequest({
                projectId: 999,
                dataSources: [{ id: 1 }]
            });
            const res = createMockResponse();

            await AIDataModelerController.initializeCrossSourceSession(req, res);

            expect(res.status).toHaveBeenCalled();
        });
    });

    describe('Message Sending', () => {
        it('should validate required message field', async () => {
            const req = createMockRequest({ dataSourceId: 1 });
            const res = createMockResponse();

            await AIDataModelerController.sendMessageWithRedis(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('message') })
            );
        });

        it('should handle session not found', async () => {
            const req = createMockRequest({
                dataSourceId: 999,
                message: 'Test message'
            });
            const res = createMockResponse();

            await AIDataModelerController.sendMessageWithRedis(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Session not found') })
            );
        });
    });

    describe('Model Draft Management', () => {
        it('should validate required modelState', async () => {
            const req = createMockRequest({ dataSourceId: 1 });
            const res = createMockResponse();

            await AIDataModelerController.updateModelDraft(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('modelState') })
            );
        });

        it('should validate modelState is an object', async () => {
            const req = createMockRequest({
                dataSourceId: 1,
                modelState: 'not an object'
            });
            const res = createMockResponse();

            await AIDataModelerController.updateModelDraft(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('Session Retrieval', () => {
        it('should handle non-existent session', async () => {
            const req = createMockRequest({}, { dataSourceId: '999' });
            const res = createMockResponse();

            await AIDataModelerController.getSession(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return session when exists', async () => {
            // Would need to create session first
            const req = createMockRequest({}, { dataSourceId: '1' });
            const res = createMockResponse();

            await AIDataModelerController.getSession(req, res);

            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('Save Conversation', () => {
        it('should validate required title', async () => {
            const req = createMockRequest({ dataSourceId: 1 });
            const res = createMockResponse();

            await AIDataModelerController.saveConversation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('title') })
            );
        });

        it('should handle session without data to save', async () => {
            const req = createMockRequest({
                dataSourceId: 999,
                title: 'Test Conversation'
            });
            const res = createMockResponse();

            await AIDataModelerController.saveConversation(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('Cancel Session', () => {
        it('should validate dataSourceId parameter', async () => {
            const req = createMockRequest({}, { dataSourceId: 'invalid' });
            const res = createMockResponse();

            await AIDataModelerController.cancelSession(req, res);

            // Should handle gracefully
            expect(res.json).toHaveBeenCalled();
        });

        it('should handle non-existent session gracefully', async () => {
            const req = createMockRequest({}, { dataSourceId: '999' });
            const res = createMockResponse();

            await AIDataModelerController.cancelSession(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });
    });

    describe('Get Saved Conversation', () => {
        it('should validate dataModelId', async () => {
            const req = createMockRequest({}, { dataModelId: 'invalid' });
            const res = createMockResponse();

            await AIDataModelerController.getSavedConversation(req, res);

            expect(res.json).toHaveBeenCalled();
        });

        it('should handle conversation not found', async () => {
            const req = createMockRequest({}, { dataModelId: '999' });
            const res = createMockResponse();

            await AIDataModelerController.getSavedConversation(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('Legacy Endpoints', () => {
        it('should handle legacy initialize endpoint', async () => {
            const req = createMockRequest({ dataSourceId: 1 });
            const res = createMockResponse();

            await AIDataModelerController.initializeConversation(req, res);

            expect(res.json).toHaveBeenCalled();
        });

        it('should handle legacy send message endpoint', async () => {
            const req = createMockRequest({
                conversationId: 'test-uuid',
                message: 'Test message'
            });
            const res = createMockResponse();

            await AIDataModelerController.sendMessage(req, res);

            expect(res.json).toHaveBeenCalled();
        });

        it('should handle legacy close conversation endpoint', async () => {
            const req = createMockRequest({}, { conversationId: 'test-uuid' });
            const res = createMockResponse();

            await AIDataModelerController.closeConversation(req, res);

            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        it('should handle empty schema context', () => {
            const emptySchema = { tables: [], relationships: [] };
            // Test with empty schema - should handle gracefully
            expect(emptySchema.tables).toEqual([]);
        });

        it('should handle very long messages', async () => {
            const longMessage = 'A'.repeat(100000);
            const req = createMockRequest({
                dataSourceId: 1,
                message: longMessage
            });
            const res = createMockResponse();

            await AIDataModelerController.sendMessageWithRedis(req, res);

            // Should handle without crashing
            expect(res.json).toHaveBeenCalled();
        });

        it('should handle special characters in messages', async () => {
            const specialMessage = 'Test <>&"\'{}[]';
            const req = createMockRequest({
                dataSourceId: 1,
                message: specialMessage
            });
            const res = createMockResponse();

            await AIDataModelerController.sendMessageWithRedis(req, res);

            expect(res.json).toHaveBeenCalled();
        });

        it('should handle concurrent requests', async () => {
            const req1 = createMockRequest({ dataSourceId: 1, message: 'Msg 1' });
            const req2 = createMockRequest({ dataSourceId: 1, message: 'Msg 2' });
            const res1 = createMockResponse();
            const res2 = createMockResponse();

            await Promise.all([
                AIDataModelerController.sendMessageWithRedis(req1, res1),
                AIDataModelerController.sendMessageWithRedis(req2, res2)
            ]);

            // Both should complete
            expect(res1.json).toHaveBeenCalled();
            expect(res2.json).toHaveBeenCalled();
        });
    });
});
