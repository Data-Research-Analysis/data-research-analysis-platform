import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SchemaCollectorService } from '../services/SchemaCollectorService.js';
import { SchemaFormatterUtility } from '../utilities/SchemaFormatter.js';
import { getGeminiService } from '../services/GeminiService.js';
import { RedisAISessionService } from '../services/RedisAISessionService.js';
import { DataSource } from 'typeorm';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { MySQLDataSource } from '../datasources/MySQLDataSource.js';
import { MariaDBDataSource } from '../datasources/MariaDBDataSource.js';

export class AIDataModelerController {
    /**
     * Initialize or restore AI session from Redis
     * POST /api/ai-data-modeler/session/initialize
     */
    static async initializeSession(req: Request, res: Response): Promise<void> {
        try {
            const { dataSourceId } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataSourceId || !userId) {
                res.status(400).json({ error: 'dataSourceId and userId are required' });
                return;
            }

            const redisService = new RedisAISessionService();

            // Check if session exists in Redis
            const existingSession = await redisService.getFullSession(dataSourceId, userId);

            if (existingSession.metadata) {
                // Session exists - restore it
                console.log('[AIDataModelerController] Restoring session from Redis:', {
                    conversationId: existingSession.metadata.conversationId,
                    messageCount: existingSession.messages?.length || 0,
                    hasModelDraft: !!existingSession.modelDraft,
                    hasSchemaContext: !!existingSession.schemaContext
                });

                // If session exists but has no messages, add the welcome message
                // Get schema summary and details
                const schemaSummary = existingSession.schemaContext 
                    ? SchemaFormatterUtility.getSchemaSummary(existingSession.schemaContext.tables)
                    : { tableCount: 0, totalColumns: 0 };
                
                const schemaDetails = existingSession.schemaContext?.tables
                    ? AIDataModelerController.extractSchemaDetails(existingSession.schemaContext.tables)
                    : { tables: [] };
                
                if (!existingSession.messages || existingSession.messages.length === 0) {
                    console.log('[AIDataModelerController] Session has no messages, adding welcome message');

                    const welcomeMessage = `Welcome! I've analyzed your database schema with **${schemaSummary.tableCount} tables** and **${schemaSummary.totalColumns} columns**.\n\nI can help you:\n• Identify analytical bottlenecks in your current schema\n• Propose optimized data models (Star Schema, OBT, etc.)\n• Suggest SQL implementation strategies\n• Recommend indexing for better query performance\n\nWhat would you like to analyze?`;
                    
                    const initialMessage = await redisService.addMessage(
                        dataSourceId,
                        userId,
                        'assistant',
                        welcomeMessage
                    );

                    existingSession.messages = [initialMessage];
                }

                res.status(200).json({
                    conversationId: existingSession.metadata.conversationId,
                    messages: existingSession.messages,
                    modelDraft: existingSession.modelDraft,
                    schemaContext: existingSession.schemaContext,
                    schemaDetails,
                    schemaSummary,
                    source: 'redis',
                    message: 'Session restored from Redis'
                });
                return;
            }

            // No existing session - create new one
            const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                dataSourceId,
                tokenDetails
            );

            if (!dataSourceDetails) {
                res.status(404).json({ error: 'Data source not found or access denied' });
                return;
            }

            // Create TypeORM DataSource
            const dataSource = await AIDataModelerController.createDataSource(dataSourceDetails);
            
            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            // Collect schema
            const schemaCollector = new SchemaCollectorService();
            const tables = await schemaCollector.collectSchema(
                dataSource,
                dataSourceDetails.schema
            );

            // Format schema to markdown
            const schemaMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);
            const schemaSummary = SchemaFormatterUtility.getSchemaSummary(tables);
            const schemaDetails = AIDataModelerController.extractSchemaDetails(tables);

            // Close the data source connection
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }

            // Create schema context
            const schemaContext = {
                tables: tables,
                relationships: []
            };

            // Create session in Redis
            const metadata = await redisService.createSession(dataSourceId, userId, schemaContext);

            // Initialize Gemini conversation (system prompt is handled by GeminiService)
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(metadata.conversationId, schemaMarkdown);

            // Create and save initial welcome message to Redis
            const welcomeMessage = `Welcome! I've analyzed your database schema with **${schemaSummary.tableCount} tables** and **${schemaSummary.totalColumns} columns**.\n\nI can help you:\n• Identify analytical bottlenecks in your current schema\n• Propose optimized data models (Star Schema, OBT, etc.)\n• Suggest SQL implementation strategies\n• Recommend indexing for better query performance\n\nLet me provide you with an initial analysis...`;
            
            const initialMessage = await redisService.addMessage(
                dataSourceId,
                userId,
                'assistant',
                welcomeMessage
            );

            console.log('[AIDataModelerController] New session created, starting auto-analysis...');

            // Automatically analyze the schema and provide recommendations
            const analysisPrompt = `I'm reviewing this database schema for analytics purposes. Please provide:

1. **Schema Overview**: What kind of system does this represent? (e-commerce, CRM, SaaS, etc.)

2. **Key Entities**: Identify 3-5 most important tables for analytics

3. **Recommended Data Model**: Suggest the best approach:
   - Star Schema (if clear fact/dimension pattern exists)
   - One Big Table (OBT) (if denormalized view would help)
   - Snowflake Schema (if normalization is important)

4. **Quick Wins**: 1-2 immediate optimizations for better query performance

Keep it concise - aim for 200-300 words total.`;

            let autoAnalysisMessage: any = null;
            let autoPromptMessage: any = null;

            try {
                // Send auto-analysis prompt to Gemini
                const analysisResponse = await geminiService.sendMessage(
                    metadata.conversationId,
                    analysisPrompt
                );

                // Save the auto-generated prompt to Redis
                autoPromptMessage = await redisService.addMessage(
                    dataSourceId,
                    userId,
                    'user',
                    analysisPrompt
                );

                // Save AI's analysis response to Redis
                autoAnalysisMessage = await redisService.addMessage(
                    dataSourceId,
                    userId,
                    'assistant',
                    analysisResponse
                );

                console.log('[AIDataModelerController] Auto-analysis completed:', {
                    conversationId: metadata.conversationId,
                    messageCount: 3,
                    analysisLength: analysisResponse.length
                });

            } catch (error) {
                console.error('[AIDataModelerController] Auto-analysis failed, continuing without it:', error);
                // Don't fail initialization if auto-analysis fails
            }

            // Build messages array
            const messages = [initialMessage];
            if (autoPromptMessage && autoAnalysisMessage) {
                messages.push(autoPromptMessage, autoAnalysisMessage);
            }

            res.status(200).json({
                conversationId: metadata.conversationId,
                messages: messages,
                modelDraft: null,
                schemaContext,
                schemaSummary,
                schemaDetails,
                source: 'new',
                message: 'New session initialized successfully'
            });

        } catch (error) {
            console.error('Error initializing session:', error);
            res.status(500).json({
                error: 'Failed to initialize session',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Initialize cross-source AI session with schemas from multiple data sources
     * POST /api/ai-data-modeler/session/initialize-cross-source
     */
    static async initializeCrossSourceSession(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, dataSources } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            console.log('[AIDataModelerController] Initializing cross-source session:', {
                projectId,
                dataSourceCount: dataSources?.length || 0,
                userId
            });

            if (!projectId || !userId || !dataSources || dataSources.length === 0) {
                res.status(400).json({ error: 'projectId, userId, and dataSources are required' });
                return;
            }

            // Use project ID as session key for cross-source
            const sessionKey = `cross_source_${projectId}`;
            const redisService = new RedisAI

SessionService();

            // Fetch schemas from ALL data sources in parallel
            const schemaPromises = dataSources.map(async (ds: any) => {
                try {
                    const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                        ds.id,
                        tokenDetails
                    );

                    if (!dataSourceDetails) {
                        console.warn(`[Cross-Source] Data source ${ds.id} not found or access denied`);
                        return null;
                    }

                    const dataSource = await AIDataModelerController.createDataSource(dataSourceDetails);
                    if (!dataSource.isInitialized) {
                        await dataSource.initialize();
                    }

                    const schemaCollector = new SchemaCollectorService();
                    const tables = await schemaCollector.collectSchema(
                        dataSource,
                        dataSourceDetails.schema
                    );

                    await dataSource.destroy();

                    return {
                        dataSourceId: ds.id,
                        dataSourceName: ds.name,
                        dataSourceType: ds.type,
                        tables: tables
                    };
                } catch (error) {
                    console.error(`[Cross-Source] Error fetching schema for data source ${ds.id}:`, error);
                    return null;
                }
            });

            const schemas = (await Promise.all(schemaPromises)).filter(s => s !== null);

            if (schemas.length === 0) {
                res.status(404).json({ error: 'No accessible data sources found' });
                return;
            }

            console.log(`[Cross-Source] Collected schemas from ${schemas.length} data sources`);

            // Build cross-source markdown with source prefixes
            let crossSourceMarkdown = '# Cross-Source Database Schema\n\n';
            crossSourceMarkdown += `Analyzing **${schemas.length}** data sources for cross-source analytics.\n\n`;

            let totalTables = 0;
            let totalColumns = 0;

            schemas.forEach((schema: any) => {
                crossSourceMarkdown += `## Data Source: ${schema.dataSourceName} (${schema.dataSourceType})\n\n`;
                const sourceMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(schema.tables);
                crossSourceMarkdown += sourceMarkdown;
                crossSourceMarkdown += '\n---\n\n';
                
                totalTables += schema.tables.length;
                schema.tables.forEach((t: any) => totalColumns += t.columns?.length || 0);
            });

            const schemaSummary = {
                dataSourceCount: schemas.length,
                tableCount: totalTables,
                totalColumns: totalColumns
            };

            // Create schema context with all sources
            const schemaContext = {
                sources: schemas,
                relationships: []
            };

            // Create session with special cross-source conversation ID
            const conversationId = uuidv4();
            const metadata = {
                conversationId,
                projectId,
                isCrossSource: true,
                dataSourceIds: dataSources.map((ds: any) => ds.id),
                startedAt: new Date().toISOString()
            };

            // Initialize Gemini with cross-source context
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(conversationId, crossSourceMarkdown);

            // Welcome message for cross-source
            const welcomeMessage = `Welcome to **Cross-Source Analytics**! I've analyzed schemas from **${schemas.length} data sources** with **${totalTables} tables** and **${totalColumns} columns**.\n\nI can help you:\n• Design cross-source data models with JOINs across databases\n• Identify relationships between tables from different sources\n• Suggest optimal query strategies for federated analytics\n• Recommend data integration patterns\n\nWhat cross-source analysis would you like to create?`;

            res.status(200).json({
                conversationId,
                messages: [{
                    id: `msg_${Date.now()}`,
                    role: 'assistant',
                    content: welcomeMessage,
                    timestamp: new Date()
                }],
                modelDraft: null,
                schemaContext,
                schemaSummary,
                source: 'new',
                message: 'Cross-source session initialized successfully'
            });

        } catch (error) {
            console.error('Error initializing cross-source session:', error);
            res.status(500).json({
                error: 'Failed to initialize cross-source session',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send a message and save to Redis
     * POST /api/ai-data-modeler/session/chat
     */
    static async sendMessageWithRedis(req: Request, res: Response): Promise<void> {
        try {
            const { dataSourceId, message } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataSourceId || !userId || !message) {
                res.status(400).json({ error: 'dataSourceId, userId, and message are required' });
                return;
            }

            const redisService = new RedisAISessionService();

            // Get session metadata
            const session = await redisService.getSession(dataSourceId, userId);
            if (!session) {
                res.status(404).json({ error: 'Session not found. Please initialize first.' });
                return;
            }

            // Check if Gemini conversation exists
            const geminiService = getGeminiService();
            if (!geminiService.sessionExists(session.conversationId)) {
                // Need to restore from Redis - get schema context and re-initialize
                const schemaContext = await redisService.getSchemaContext(dataSourceId, userId);
                
                if (schemaContext) {
                    const schemaMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(schemaContext.tables);
                    await geminiService.initializeConversation(session.conversationId, schemaMarkdown);
                } else {
                    res.status(500).json({ error: 'Schema context not found in session' });
                    return;
                }
            }

            // Save user message to Redis
            const userMessage = await redisService.addMessage(dataSourceId, userId, 'user', message);

            // Send to Gemini
            const response = await geminiService.sendMessage(session.conversationId, message);

            // Check if response contains data model JSON
            const dataModelJSON = AIDataModelerController.extractDataModelJSON(response);

            // Save assistant message to Redis
            const assistantMessage = await redisService.addMessage(dataSourceId, userId, 'assistant', response);

            res.status(200).json({
                userMessage,
                assistantMessage,
                conversationId: session.conversationId,
                dataModel: dataModelJSON || null
            });

        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                error: 'Failed to send message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update model draft in Redis
     * POST /api/ai-data-modeler/session/model-draft
     */
    static async updateModelDraft(req: Request, res: Response): Promise<void> {
        try {
            const { dataSourceId, modelState } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataSourceId || !userId || !modelState) {
                res.status(400).json({ error: 'dataSourceId, userId, and modelState are required' });
                return;
            }

            const redisService = new RedisAISessionService();
            const draft = await redisService.saveModelDraft(dataSourceId, userId, modelState);

            res.status(200).json({
                success: true,
                version: draft.version,
                lastModified: draft.lastModified
            });

        } catch (error) {
            console.error('Error updating model draft:', error);
            res.status(500).json({
                error: 'Failed to update model draft',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get current session state from Redis
     * GET /api/ai-data-modeler/session/:dataSourceId
     */
    static async getSession(req: Request, res: Response): Promise<void> {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId, 10);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataSourceId || !userId) {
                res.status(400).json({ error: 'dataSourceId and userId are required' });
                return;
            }

            const redisService = new RedisAISessionService();
            const session = await redisService.getFullSession(dataSourceId, userId);

            if (!session.metadata) {
                res.status(404).json({ error: 'Session not found' });
                return;
            }

            res.status(200).json(session);

        } catch (error) {
            console.error('Error getting session:', error);
            res.status(500).json({
                error: 'Failed to get session',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Save conversation to database and clear Redis
     * POST /api/ai-data-modeler/session/save
     */
    static async saveConversation(req: Request, res: Response): Promise<void> {
        try {
            const { dataSourceId, dataModelId, title } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            console.log('[AIDataModelerController] saveConversation called with:', {
                dataSourceId,
                dataModelId,
                title,
                userId
            });

            if (!dataSourceId || !userId || !title) {
                console.error('[AIDataModelerController] Missing required fields:', {
                    hasDataSourceId: !!dataSourceId,
                    hasUserId: !!userId,
                    hasTitle: !!title
                });
                res.status(400).json({ error: 'dataSourceId, userId, and title are required' });
                return;
            }

            const redisService = new RedisAISessionService();
            
            // Get full session from Redis
            const session = await redisService.getFullSession(dataSourceId, userId);
            
            console.log('[AIDataModelerController] Retrieved session from Redis:', {
                hasMetadata: !!session.metadata,
                messagesCount: session.messages?.length || 0,
                conversationId: session.metadata?.conversationId
            });
            
            if (!session.metadata || !session.messages || session.messages.length === 0) {
                console.error('[AIDataModelerController] No session data to save');
                res.status(404).json({ error: 'No session data to save' });
                return;
            }

            // Get database driver
            const { DBDriver } = await import('../drivers/DBDriver.js');
            const { EDataSourceType } = await import('../types/EDataSourceType.js');
            const { DRAAIDataModelConversation } = await import('../models/DRAAIDataModelConversation.js');
            const { DRAAIDataModelMessage } = await import('../models/DRAAIDataModelMessage.js');
            
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver?.getConcreteDriver())?.manager;
            
            if (!manager) {
                res.status(500).json({ error: 'Database connection failed' });
                return;
            }

            // Save conversation to database
            const conversation = manager.create(DRAAIDataModelConversation, {
                data_source: { id: dataSourceId } as any,
                user: { id: userId } as any,
                data_model: dataModelId ? { id: dataModelId } as any : null,
                title,
                status: 'saved',
                started_at: new Date(session.metadata.startedAt),
                saved_at: new Date(),
            });

            const savedConversation = await manager.save(DRAAIDataModelConversation, conversation);

            // Save messages
            const messageEntities = session.messages.map((msg) => 
                manager.create(DRAAIDataModelMessage, {
                    conversation: { id: savedConversation.id } as any,
                    role: msg.role,
                    content: msg.content,
                    metadata: null,
                    created_at: new Date(msg.timestamp)
                })
            );

            await manager.save(DRAAIDataModelMessage, messageEntities);

            console.log('[AIDataModelerController] Saved conversation and messages:', {
                conversationId: savedConversation.id,
                messagesSaved: messageEntities.length
            });

            // Clear Redis session
            await redisService.clearAllSessionData(dataSourceId, userId);

            // Destroy Gemini session
            const geminiService = getGeminiService();
            geminiService.destroyConversation(session.metadata.conversationId);

            console.log('[AIDataModelerController] Cleared Redis and Gemini session');

            res.status(200).json({
                conversationId: savedConversation.id,
                success: true,
                message: 'Conversation saved to database successfully'
            });

        } catch (error) {
            console.error('Error saving conversation:', error);
            res.status(500).json({
                error: 'Failed to save conversation',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Cancel session and clear Redis
     * DELETE /api/ai-data-modeler/session/:dataSourceId
     */
    static async cancelSession(req: Request, res: Response): Promise<void> {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId, 10);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataSourceId || !userId) {
                res.status(400).json({ error: 'dataSourceId and userId are required' });
                return;
            }

            const redisService = new RedisAISessionService();
            
            // Get session before clearing
            const session = await redisService.getSession(dataSourceId, userId);
            
            // Clear Redis
            await redisService.clearAllSessionData(dataSourceId, userId);

            // Destroy Gemini session if exists
            if (session) {
                const geminiService = getGeminiService();
                geminiService.destroyConversation(session.conversationId);
            }

            res.status(200).json({
                success: true,
                message: 'Session cancelled and cleared successfully'
            });

        } catch (error) {
            console.error('Error cancelling session:', error);
            res.status(500).json({
                error: 'Failed to cancel session',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }



    /**
     * Extract data model JSON from AI response
     */
    private static extractDataModelJSON(aiResponse: string): any | null {
        try {
            // Look for JSON code block
            const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) return null;
            
            const jsonString = jsonMatch[1];
            const parsed = JSON.parse(jsonString);
            
            // Validate it's a data model action
            if (parsed.action === 'BUILD_DATA_MODEL' && parsed.model) {
                console.log('[AIDataModelerController] Extracted data model from AI response');
                return parsed.model;
            }
            
            return null;
        } catch (error) {
            console.error('[AIDataModelerController] Failed to parse data model JSON:', error);
            return null;
        }
    }

    /**
     * Get saved conversation from database
     * GET /api/ai-data-modeler/conversations/:dataModelId
     */
    static async getSavedConversation(req: Request, res: Response): Promise<void> {
        try {
            const dataModelId = parseInt(req.params.dataModelId, 10);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            console.log('[AIDataModelerController] getSavedConversation called:', {
                dataModelId,
                userId,
                hasTokenDetails: !!tokenDetails
            });

            if (!dataModelId || !userId) {
                console.log('[AIDataModelerController] Missing required parameters');
                res.status(400).json({ error: 'dataModelId and userId are required' });
                return;
            }

            // Get database driver
            const { DBDriver } = await import('../drivers/DBDriver.js');
            const { EDataSourceType } = await import('../types/EDataSourceType.js');
            const { DRAAIDataModelConversation } = await import('../models/DRAAIDataModelConversation.js');
            
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver?.getConcreteDriver())?.manager;
            
            if (!manager) {
                res.status(500).json({ error: 'Database connection failed' });
                return;
            }

            // Get conversation with messages
            const conversation = await manager.findOne(DRAAIDataModelConversation, {
                where: { 
                    data_model: { id: dataModelId },
                    user: { id: userId }
                },
                relations: ['messages', 'data_model', 'user', 'data_source'],
                order: {
                    messages: {
                        created_at: 'ASC'
                    }
                }
            });

            console.log('[AIDataModelerController] Database query result:', {
                found: !!conversation,
                messageCount: conversation?.messages?.length || 0
            });

            if (!conversation) {
                console.log('[AIDataModelerController] No conversation found for data model:', dataModelId);
                res.status(404).json({ error: 'Conversation not found' });
                return;
            }

            console.log('[AIDataModelerController] Returning conversation:', {
                id: conversation.id,
                messageCount: conversation.messages.length
            });

            res.status(200).json({
                conversation,
                source: 'database'
            });

        } catch (error) {
            console.error('Error getting saved conversation:', error);
            res.status(500).json({
                error: 'Failed to get saved conversation',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Initialize a new AI conversation with schema context (Legacy endpoint - kept for backward compatibility)
     * POST /api/ai-data-modeler/initialize
     */
    static async initializeConversation(req: Request, res: Response): Promise<void> {
        try {
            const { dataSourceId } = req.body;
            const tokenDetails = req.body.tokenDetails;

            if (!dataSourceId) {
                res.status(400).json({ error: 'dataSourceId is required' });
                return;
            }

            // Get data source connection details
            const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                dataSourceId,
                tokenDetails
            );

            if (!dataSourceDetails) {
                res.status(404).json({ error: 'Data source not found or access denied' });
                return;
            }

            // Create TypeORM DataSource
            const dataSource = await AIDataModelerController.createDataSource(dataSourceDetails);
            
            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            // Collect schema
            const schemaCollector = new SchemaCollectorService();
            const tables = await schemaCollector.collectSchema(
                dataSource,
                dataSourceDetails.schema
            );

            // Format schema to markdown
            const schemaMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);
            const schemaSummary = SchemaFormatterUtility.getSchemaSummary(tables);

            // Generate unique conversation ID
            const conversationId = uuidv4();

            // Initialize Gemini conversation
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(conversationId, schemaMarkdown);

            // Close the data source connection
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }

            res.status(200).json({
                conversationId,
                schemaSummary,
                message: 'AI conversation initialized successfully'
            });

        } catch (error) {
            console.error('Error initializing AI conversation:', error);
            res.status(500).json({
                error: 'Failed to initialize AI conversation',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send a message in an existing conversation
     * POST /api/ai-data-modeler/chat
     */
    static async sendMessage(req: Request, res: Response): Promise<void> {
        try {
            const { conversationId, message } = req.body;

            if (!conversationId || !message) {
                res.status(400).json({ error: 'conversationId and message are required' });
                return;
            }

            // Check if conversation exists
            const geminiService = getGeminiService();
            if (!geminiService.sessionExists(conversationId)) {
                res.status(404).json({ error: 'Conversation not found or expired' });
                return;
            }

            // Send message to Gemini
            const response = await geminiService.sendMessage(conversationId, message);

            res.status(200).json({
                response,
                conversationId
            });

        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                error: 'Failed to send message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Close an active conversation
     * DELETE /api/ai-data-modeler/conversation/:conversationId
     */
    static async closeConversation(req: Request, res: Response): Promise<void> {
        try {
            const { conversationId } = req.params;

            if (!conversationId) {
                res.status(400).json({ error: 'conversationId is required' });
                return;
            }

            const geminiService = getGeminiService();
            const deleted = geminiService.destroyConversation(conversationId);

            if (deleted) {
                res.status(200).json({ message: 'Conversation closed successfully' });
            } else {
                res.status(404).json({ error: 'Conversation not found' });
            }

        } catch (error) {
            console.error('Error closing conversation:', error);
            res.status(500).json({
                error: 'Failed to close conversation',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get data source details from database
     */
    private static async getDataSourceDetails(
        dataSourceId: number,
        tokenDetails: any
    ): Promise<any> {
        const { user_id } = tokenDetails;
        
        // Get database driver
        const { DBDriver } = await import('../drivers/DBDriver.js');
        const { EDataSourceType } = await import('../types/EDataSourceType.js');
        const { DRAUsersPlatform } = await import('../models/DRAUsersPlatform.js');
        const { DRADataSource } = await import('../models/DRADataSource.js');
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return null;
        }
        
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) {
            return null;
        }
        
        // Verify user exists
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
        if (!user) {
            return null;
        }
        
        // Get data source with user access verification
        const dataSource: any = await manager.findOne(DRADataSource, {
            where: { id: dataSourceId, users_platform: user }
        });
        
        if (!dataSource) {
            return null;
        }
        
        // Extract connection details (already decrypted by transformer)
        const connectionDetails = dataSource.connection_details;
        
        // Determine correct schema based on data source type
        let schema = connectionDetails.schema;
        
        if (!schema) {
            // Only API-integrated sources have fixed schemas
            // User databases (PostgreSQL, MySQL, MariaDB) should use connection_details.schema
            const apiSourceSchemas: Record<string, string> = {
                'google_analytics': 'dra_google_analytics',
                'google_ad_manager': 'dra_google_ad_manager',
                'google_ads': 'dra_google_ads',
                'excel': 'dra_excel',
                'pdf': 'dra_pdf'
            };
            
            // Check if this is an API-integrated source
            if (apiSourceSchemas[dataSource.data_type]) {
                schema = apiSourceSchemas[dataSource.data_type];
                console.log(`[AIDataModelerController] Using fixed schema for API source '${dataSource.data_type}': '${schema}'`);
            } else {
                // For user databases, default to 'public' only if no schema specified
                schema = 'public';
                console.log(`[AIDataModelerController] Using default schema 'public' for '${dataSource.data_type}'`);
            }
        } else {
            console.log(`[AIDataModelerController] Using schema from connection details: '${schema}'`);
        }
        
        return {
            type: dataSource.data_type,
            host: connectionDetails.host,
            port: connectionDetails.port,
            database: connectionDetails.database,
            username: connectionDetails.username,
            password: connectionDetails.password,
            schema: schema
        };
    }

    /**
     * Create TypeORM DataSource based on database type
     */
    private static async createDataSource(dataSourceDetails: any): Promise<DataSource> {
        const { type, host, port, database, username, password, schema } = dataSourceDetails;

        switch (type) {
            case 'postgresql':
            case 'google_analytics':  // Google Analytics data stored in PostgreSQL
            case 'google_ad_manager': // Google Ad Manager data stored in PostgreSQL
            case 'google_ads':        // Google Ads data stored in PostgreSQL
            case 'excel':             // Excel data stored in PostgreSQL (dra_excel schema)
            case 'pdf':               // PDF data stored in PostgreSQL (dra_pdf schema)
                return PostgresDataSource.getInstance().getDataSource(
                    host,
                    port,
                    database,
                    username,
                    password
                );
            
            case 'mysql':
                return MySQLDataSource.getInstance().getDataSource(
                    host,
                    port,
                    database,
                    username,
                    password
                );
            
            case 'mariadb':
                return MariaDBDataSource.getInstance().getDataSource(
                    host,
                    port,
                    database,
                    username,
                    password
                );
            
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
    }

    /**
     * Extract simplified schema details for frontend pattern detection
     */
    private static extractSchemaDetails(tables: any[]): any {
        return {
            tables: tables.map(table => ({
                name: table.tableName,
                columnCount: table.columns?.length || 0,
                hasTimestamps: table.columns?.some((col: any) => 
                    col.column_name.toLowerCase().includes('created_at') ||
                    col.column_name.toLowerCase().includes('updated_at') ||
                    col.column_name.toLowerCase().includes('timestamp') ||
                    col.data_type.toLowerCase().includes('timestamp')
                ) || false,
                foreignKeyReferences: table.foreignKeys?.map((fk: any) => fk.foreign_table_name) || []
            }))
        };
    }
}
