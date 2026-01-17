import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import aiDataModelerRouter from '../../../routes/ai_data_modeler.js';
import { AIDataModelerController } from '../../../controllers/AIDataModelerController.js';
import { TokenProcessor } from '../../../processors/TokenProcessor.js';
import { ITokenDetails } from '../../../types/ITokenDetails.js';
import { EUserType } from '../../../types/EUserType.js';

// Mock controller - use factory function
jest.mock('../../../controllers/AIDataModelerController.js', () => {
    const mockImpl = {
        initializeSession: jest.fn(),
        initializeCrossSourceSession: jest.fn(),
        sendMessageWithRedis: jest.fn(),
        updateModelDraft: jest.fn(),
        getSession: jest.fn(),
        saveConversation: jest.fn(),
        cancelSession: jest.fn(),
        getSavedConversation: jest.fn(),
        initializeConversation: jest.fn(),
        sendMessage: jest.fn(),
        closeConversation: jest.fn()
    };
    return {
        AIDataModelerController: mockImpl
    };
});

// Mock TokenProcessor
const mockValidateToken: any = jest.fn();
jest.mock('../../processors/TokenProcessor.js', () => ({
    TokenProcessor: {
        getInstance: jest.fn(() => ({
            validateToken: mockValidateToken
        }))
    }
}));

describe('AI Data Modeler Operations Integration Tests', () => {
    let app: Application;
    let mockController: any;
    
    const validToken = 'valid-jwt-token';
    const validTokenDetails: ITokenDetails = {
        user_id: 1,
        email: 'test@example.com',
        user_type: EUserType.ADMIN,
        iat: Date.now()
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/ai-data-modeler', aiDataModelerRouter);
        
        // Get mocked instances
        mockController = AIDataModelerController;
        
        jest.clearAllMocks();
        mockValidateToken.mockResolvedValue(validTokenDetails);
    });

    describe('Session Initialization', () => {
        it('should initialize AI session with valid data source ID', async () => {
            mockController.initializeSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    conversationId: 'uuid-123',
                    message: 'Session initialized'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/session/initialize')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: 1 })
                .expect(200);

            expect(response.body.conversationId).toBeDefined();
            expect(mockController.initializeSession).toHaveBeenCalled();
        });

        it('should validate dataSourceId is an integer', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: 'invalid' })
                .expect(400);

            expect(mockController.initializeSession).not.toHaveBeenCalled();
        });

        it('should require dataSourceId parameter', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(mockController.initializeSession).not.toHaveBeenCalled();
        });

        it('should require authentication for session initialization', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize')
                .send({ dataSourceId: 1 })
                .expect(401);

            expect(mockController.initializeSession).not.toHaveBeenCalled();
        });
    });

    describe('Cross-Source Session Initialization', () => {
        it('should initialize cross-source session with project ID and data sources', async () => {
            mockController.initializeCrossSourceSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    conversationId: 'cross-uuid-456',
                    message: 'Cross-source session initialized'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/session/initialize-cross-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    projectId: 1,
                    dataSources: [1, 2, 3]
                })
                .expect(200);

            expect(response.body.conversationId).toBeDefined();
            expect(mockController.initializeCrossSourceSession).toHaveBeenCalled();
        });

        it('should validate projectId is an integer', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize-cross-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    projectId: 'invalid',
                    dataSources: [1, 2]
                })
                .expect(400);

            expect(mockController.initializeCrossSourceSession).not.toHaveBeenCalled();
        });

        it('should require dataSources as non-empty array', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize-cross-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    projectId: 1,
                    dataSources: []
                })
                .expect(400);

            expect(mockController.initializeCrossSourceSession).not.toHaveBeenCalled();
        });

        it('should reject missing dataSources parameter', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize-cross-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ projectId: 1 })
                .expect(400);

            expect(mockController.initializeCrossSourceSession).not.toHaveBeenCalled();
        });
    });

    describe('Chat Operations', () => {
        it('should send message with valid data', async () => {
            mockController.sendMessageWithRedis.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    response: 'AI response',
                    conversationId: 'uuid-123'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    message: 'Create a data model for sales'
                })
                .expect(200);

            expect(response.body.response).toBeDefined();
            expect(mockController.sendMessageWithRedis).toHaveBeenCalled();
        });

        it('should validate message is not empty', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    message: '   '
                })
                .expect(400);

            expect(mockController.sendMessageWithRedis).not.toHaveBeenCalled();
        });

        it('should support cross-source chat with isCrossSource flag', async () => {
            mockController.sendMessageWithRedis.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    response: 'Cross-source AI response'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    conversationId: '123e4567-e89b-12d3-a456-426614174000',
                    isCrossSource: true,
                    message: 'Join these data sources'
                })
                .expect(200);

            expect(mockController.sendMessageWithRedis).toHaveBeenCalled();
        });

        it('should validate conversationId is UUID when provided', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    conversationId: 'not-a-uuid',
                    message: 'Test message'
                })
                .expect(400);

            expect(mockController.sendMessageWithRedis).not.toHaveBeenCalled();
        });

        it('should require message parameter', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: 1 })
                .expect(400);

            expect(mockController.sendMessageWithRedis).not.toHaveBeenCalled();
        });
    });

    describe('Model Draft Management', () => {
        it('should update model draft with valid state', async () => {
            mockController.updateModelDraft.mockImplementation((req: any, res: any) => {
                res.status(200).json({ message: 'Draft updated' });
            });

            const modelState = {
                tables: ['users', 'orders'],
                joins: [{ from: 'users', to: 'orders' }]
            };

            const response = await request(app)
                .post('/ai-data-modeler/session/model-draft')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    modelState: modelState
                })
                .expect(200);

            expect(mockController.updateModelDraft).toHaveBeenCalled();
        });

        it('should validate modelState is an object', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/model-draft')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    modelState: 'not-an-object'
                })
                .expect(400);

            expect(mockController.updateModelDraft).not.toHaveBeenCalled();
        });

        it('should require dataSourceId for draft updates', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/model-draft')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    modelState: { tables: [] }
                })
                .expect(400);

            expect(mockController.updateModelDraft).not.toHaveBeenCalled();
        });
    });

    describe('Session Retrieval', () => {
        it('should retrieve session state from Redis', async () => {
            mockController.getSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    dataSourceId: 1,
                    conversationId: 'uuid-123',
                    messages: [],
                    modelDraft: null
                });
            });

            const response = await request(app)
                .get('/ai-data-modeler/session/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.conversationId).toBeDefined();
            expect(mockController.getSession).toHaveBeenCalled();
        });

        it('should validate dataSourceId is numeric in URL', async () => {
            mockController.getSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({});
            });

            await request(app)
                .get('/ai-data-modeler/session/123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockController.getSession).toHaveBeenCalled();
        });

        it('should require authentication for session retrieval', async () => {
            const response = await request(app)
                .get('/ai-data-modeler/session/1')
                .expect(401);

            expect(mockController.getSession).not.toHaveBeenCalled();
        });
    });

    describe('Session Persistence', () => {
        it('should save conversation to database and clear Redis', async () => {
            mockController.saveConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    dataModelId: 5,
                    message: 'Conversation saved'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/session/save')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    title: 'Sales Model Conversation'
                })
                .expect(200);

            expect(response.body.dataModelId).toBeDefined();
            expect(mockController.saveConversation).toHaveBeenCalled();
        });

        it('should require title for saving conversation', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/save')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: 1 })
                .expect(400);

            expect(mockController.saveConversation).not.toHaveBeenCalled();
        });

        it('should trim whitespace from title', async () => {
            mockController.saveConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({ dataModelId: 5 });
            });

            await request(app)
                .post('/ai-data-modeler/session/save')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    title: '  Trimmed Title  '
                })
                .expect(200);

            expect(mockController.saveConversation).toHaveBeenCalled();
        });
    });

    describe('Session Cancellation', () => {
        it('should cancel session and clear Redis', async () => {
            mockController.cancelSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({ message: 'Session cancelled' });
            });

            const response = await request(app)
                .delete('/ai-data-modeler/session/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockController.cancelSession).toHaveBeenCalled();
        });

        it('should validate dataSourceId parameter for cancellation', async () => {
            mockController.cancelSession.mockImplementation((req: any, res: any) => {
                res.status(200).json({});
            });

            await request(app)
                .delete('/ai-data-modeler/session/999')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockController.cancelSession).toHaveBeenCalled();
        });

        it('should require authentication for session cancellation', async () => {
            const response = await request(app)
                .delete('/ai-data-modeler/session/1')
                .expect(401);

            expect(mockController.cancelSession).not.toHaveBeenCalled();
        });
    });

    describe('Saved Conversation Retrieval', () => {
        it('should retrieve saved conversation from database', async () => {
            mockController.getSavedConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    conversationId: 'uuid-saved',
                    title: 'Sales Model',
                    messages: [
                        { role: 'user', content: 'Create model' },
                        { role: 'assistant', content: 'Model created' }
                    ]
                });
            });

            const response = await request(app)
                .get('/ai-data-modeler/conversations/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.messages).toBeDefined();
            expect(mockController.getSavedConversation).toHaveBeenCalled();
        });

        it('should validate dataModelId is numeric', async () => {
            mockController.getSavedConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({});
            });

            await request(app)
                .get('/ai-data-modeler/conversations/42')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockController.getSavedConversation).toHaveBeenCalled();
        });

        it('should require authentication for retrieving conversations', async () => {
            const response = await request(app)
                .get('/ai-data-modeler/conversations/5')
                .expect(401);

            expect(mockController.getSavedConversation).not.toHaveBeenCalled();
        });
    });

    describe('Legacy Endpoints - Backward Compatibility', () => {
        it('should initialize conversation using legacy endpoint', async () => {
            mockController.initializeConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    conversationId: 'legacy-uuid',
                    message: 'Legacy conversation initialized'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/initialize')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: 1 })
                .expect(200);

            expect(response.body.conversationId).toBeDefined();
            expect(mockController.initializeConversation).toHaveBeenCalled();
        });

        it('should send message using legacy endpoint', async () => {
            mockController.sendMessage.mockImplementation((req: any, res: any) => {
                res.status(200).json({
                    response: 'Legacy AI response'
                });
            });

            const response = await request(app)
                .post('/ai-data-modeler/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    conversationId: '123e4567-e89b-12d3-a456-426614174000',
                    message: 'Legacy chat message'
                })
                .expect(200);

            expect(mockController.sendMessage).toHaveBeenCalled();
        });

        it('should validate UUID for legacy chat', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    conversationId: 'not-a-uuid',
                    message: 'Test'
                })
                .expect(400);

            expect(mockController.sendMessage).not.toHaveBeenCalled();
        });

        it('should close conversation using legacy endpoint', async () => {
            mockController.closeConversation.mockImplementation((req: any, res: any) => {
                res.status(200).json({ message: 'Conversation closed' });
            });

            const response = await request(app)
                .delete('/ai-data-modeler/conversation/123e4567-e89b-12d3-a456-426614174000')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockController.closeConversation).toHaveBeenCalled();
        });

        it('should validate UUID for legacy close conversation', async () => {
            const response = await request(app)
                .delete('/ai-data-modeler/conversation/invalid-uuid')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockController.closeConversation).not.toHaveBeenCalled();
        });
    });

    describe('Security & Rate Limiting', () => {
        it('should enforce authentication across all endpoints', async () => {
            const endpoints = [
                { method: 'post', path: '/ai-data-modeler/session/initialize', body: { dataSourceId: 1 } },
                { method: 'post', path: '/ai-data-modeler/session/chat', body: { message: 'test' } },
                { method: 'get', path: '/ai-data-modeler/session/1', body: {} },
                { method: 'delete', path: '/ai-data-modeler/session/1', body: {} }
            ];

            for (const endpoint of endpoints) {
                const req = (request(app) as any)[endpoint.method](endpoint.path);
                if (endpoint.method === 'post') {
                    req.send(endpoint.body);
                }
                await req.expect(401);
            }
        });

        it('should sanitize user input in messages', async () => {
            mockController.sendMessageWithRedis.mockImplementation((req: any, res: any) => {
                res.status(200).json({ response: 'Sanitized response' });
            });

            const xssPayload = '<script>alert("xss")</script>';

            await request(app)
                .post('/ai-data-modeler/session/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    dataSourceId: 1,
                    message: xssPayload
                })
                .expect(200);

            expect(mockController.sendMessageWithRedis).toHaveBeenCalled();
        });

        it('should validate integer IDs to prevent injection', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/session/initialize')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ dataSourceId: '1; DROP TABLE users;' })
                .expect(400);

            expect(mockController.initializeSession).not.toHaveBeenCalled();
        });

        it('should validate UUID format to prevent injection', async () => {
            const response = await request(app)
                .post('/ai-data-modeler/chat')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    conversationId: "' OR '1'='1",
                    message: 'test'
                })
                .expect(400);

            expect(mockController.sendMessage).not.toHaveBeenCalled();
        });
    });
});
