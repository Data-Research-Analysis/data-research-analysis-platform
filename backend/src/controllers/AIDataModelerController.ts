import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SchemaCollectorService } from '../services/SchemaCollectorService.js';
import { SchemaFormatterUtility } from '../utilities/SchemaFormatter.js';
import { getGeminiService } from '../services/GeminiService.js';
import { RedisAISessionService, AIMessage } from '../services/RedisAISessionService.js';
import { DataQualityService } from '../services/DataQualityService.js';
import { DataQualityExecutionService } from '../services/DataQualityExecutionService.js';
import { SQLValidationService } from '../services/SQLValidationService.js';
import { AI_DATA_QUALITY_EXPERT_PROMPT, AI_ATTRIBUTION_EXPERT_PROMPT } from '../constants/system-prompts.js';
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
                // Session exists - but we need to validate the schema hasn't changed
                console.log('[AIDataModelerController] Found existing session in Redis:', {
                    conversationId: existingSession.metadata.conversationId,
                    messageCount: existingSession.messages?.length || 0,
                    hasModelDraft: !!existingSession.modelDraft,
                    hasSchemaContext: !!existingSession.schemaContext
                });

                // Validate schema by fetching current schema and comparing table count
                const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                    dataSourceId,
                    tokenDetails
                );

                if (dataSourceDetails) {
                    const dataSource = await AIDataModelerController.createDataSource(dataSourceDetails);
                    if (!dataSource.isInitialized) {
                        await dataSource.initialize();
                    }

                    // Fetch table metadata to get only tables belonging to this data source
                    const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                        dataSourceId,
                        dataSourceDetails.schema,
                        tokenDetails
                    );

                    const schemaCollector = new SchemaCollectorService();
                    const tableNames = tableMetadata.map(m => m.physical_table_name);
                    const currentTables = await schemaCollector.collectSchemaForTables(
                        dataSource,
                        dataSourceDetails.schema,
                        tableNames
                    );

                    if (dataSource.isInitialized) {
                        await dataSource.destroy();
                    }

                    const cachedTableCount = existingSession.schemaContext?.tables?.length || 0;
                    const currentTableCount = currentTables.length;

                    console.log('[AIDataModelerController] Schema validation:', {
                        dataSourceId,
                        cachedTableCount,
                        currentTableCount,
                        schemaChanged: cachedTableCount !== currentTableCount
                    });

                    // If schema has changed (different table count), invalidate and recreate session
                    if (cachedTableCount !== currentTableCount) {
                        console.log('[AIDataModelerController] Schema changed, clearing Redis session and creating new one');
                        await redisService.clearSession(dataSourceId, userId);
                        // Fall through to create new session below
                    } else {
                        // Schema matches - restore session
                        console.log('[AIDataModelerController] Schema matches, restoring session from Redis');
                        
                        const schemaSummary = existingSession.schemaContext 
                            ? SchemaFormatterUtility.getSchemaSummary(existingSession.schemaContext.tables)
                            : { tableCount: 0, totalColumns: 0 };
                        
                        const schemaDetails = existingSession.schemaContext?.tables
                            ? AIDataModelerController.extractSchemaDetails(existingSession.schemaContext.tables)
                            : { tables: [] };
                        
                        if (!existingSession.messages || existingSession.messages.length === 0) {
                            console.log('[AIDataModelerController] Session has no messages, adding welcome message');

                            const welcomeMessage = `Welcome! I've analyzed your database schema with **${schemaSummary.tableCount} tables** and **${schemaSummary.totalColumns} columns**.\n\nI can help you:\n• Identify analytical bottlenecks in your current schema\n• Propose optimized data models (Star Schema, OBT, etc.)\n• Suggest SQL implementation strategies\n• Recommend indexing for better query performance\n\nWhat would you like to analyze?`;
                            
                            const initialMessage: AIMessage = await redisService.addMessage(
                                dataSourceId,
                                userId,
                                'assistant',
                                welcomeMessage
                            );

                            existingSession.messages = [initialMessage];
                        }

                        // Extract inferred joins from schema context
                        let inferredJoins = existingSession.schemaContext?.inferredJoins || [];
                        
                        // CRITICAL: Regenerate inferred joins if missing or empty
                        // This handles cases where old sessions didn't have joins or displayNames weren't set
                        if (inferredJoins.length === 0 && existingSession.schemaContext?.tables) {
                            console.log('[AIDataModelerController] No inferred joins found in Redis, regenerating...');
                            
                            // Re-fetch table metadata to get current logical names
                            const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                                dataSourceId,
                                dataSourceDetails.schema,
                                tokenDetails
                            );
                            
                            // Merge displayNames into cached tables
                            const tablesWithDisplayNames = existingSession.schemaContext.tables.map((table: any) => {
                                const metadata = tableMetadata.find(
                                    m => m.physical_table_name === table.tableName && m.schema_name === table.schema
                                );
                                return {
                                    ...table,
                                    displayName: metadata?.logical_table_name || table.displayName || table.tableName
                                };
                            });
                            
                            // Run join inference with updated displayNames
                            const joinInferenceService = (await import('../services/JoinInferenceService.js')).JoinInferenceService.getInstance();
                            inferredJoins = await joinInferenceService.inferJoins(tablesWithDisplayNames);
                            console.log(`[AIDataModelerController] Regenerated ${inferredJoins.length} inferred join suggestions`);
                            
                            // Update schemaContext in Redis for future restores
                            existingSession.schemaContext.tables = tablesWithDisplayNames;
                            existingSession.schemaContext.inferredJoins = inferredJoins;
                            await redisService.saveSchemaContext(dataSourceId, userId, existingSession.schemaContext);
                        }
                        
                        const inferredJoinCount = inferredJoins.length;
                        const topInferredJoins = inferredJoins.slice(0, 10);

                        res.status(200).json({
                            conversationId: existingSession.metadata.conversationId,
                            messages: existingSession.messages,
                            modelDraft: existingSession.modelDraft,
                            schemaContext: existingSession.schemaContext,
                            schemaDetails,
                            schemaSummary,
                            inferredJoinCount,
                            inferredJoins: topInferredJoins,
                            source: 'redis',
                            message: 'Session restored from Redis'
                        });
                        return;
                    }
                }
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

            // Fetch table metadata (display names) from database - this filters to only user's tables
            const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                dataSourceId,
                dataSourceDetails.schema,
                tokenDetails
            );

            // Collect schema only for tables that belong to this data source (from metadata)
            const schemaCollector = new SchemaCollectorService();
            const tableNames = tableMetadata.map(m => m.physical_table_name);
            const tables = await schemaCollector.collectSchemaForTables(
                dataSource,
                dataSourceDetails.schema,
                tableNames
            );

            // Merge display names into tables
            const tablesWithDisplayNames = tables.map(table => {
                const metadata = tableMetadata.find(
                    m => m.physical_table_name === table.tableName && m.schema_name === table.schema
                );
                return {
                    ...table,
                    displayName: metadata?.logical_table_name || table.tableName
                };
            });

            // Run join inference for pattern-based suggestions
            console.log('[AIDataModelerController] Running join inference for session initialization...');
            const joinInferenceService = (await import('../services/JoinInferenceService.js')).JoinInferenceService.getInstance();
            const inferredJoins = await joinInferenceService.inferJoins(tablesWithDisplayNames);
            console.log(`[AIDataModelerController] Found ${inferredJoins.length} inferred join suggestions`);

            // Format schema to markdown WITH inferred joins
            const schemaMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(tablesWithDisplayNames, inferredJoins);
            const schemaSummary = SchemaFormatterUtility.getSchemaSummary(tablesWithDisplayNames);
            const schemaDetails = AIDataModelerController.extractSchemaDetails(tablesWithDisplayNames);

            console.log('[AIDataModelerController] Schema summary for data source', dataSourceId, ':', {
                tableCount: schemaSummary.tableCount,
                totalColumns: schemaSummary.totalColumns,
                tablesWithDisplayNamesCount: tablesWithDisplayNames.length
            });
            
            // DEBUG: Log schema markdown for comparison
            console.log('[DEBUG] ========== SCHEMA MARKDOWN START ==========');
            console.log('[DEBUG] Data Source ID:', dataSourceId);
            console.log('[DEBUG] Data Source Type:', dataSourceDetails.type);
            console.log('[DEBUG] Schema Name:', dataSourceDetails.schema);
            console.log('[DEBUG] Markdown Content:\n', schemaMarkdown.substring(0, 2000), '...'); // First 2000 chars
            console.log('[DEBUG] ========== SCHEMA MARKDOWN END ==========');

            // Close the data source connection
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }

            // Create schema context with display names AND inferred joins
            const schemaContext = {
                tables: tablesWithDisplayNames,
                relationships: [],
                inferredJoins: inferredJoins // Store for tracking which joins AI uses
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
                inferredJoinCount: inferredJoins.length,
                inferredJoins: inferredJoins.slice(0, 10), // Return top 10 for immediate UI display
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
            const redisService = new RedisAISessionService();

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

                    // Fetch table metadata to get only tables belonging to this data source
                    const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                        ds.id,
                        dataSourceDetails.schema,
                        tokenDetails
                    );

                    const schemaCollector = new SchemaCollectorService();
                    const tableNames = tableMetadata.map((m: any) => m.physical_table_name);
                    const tables = await schemaCollector.collectSchemaForTables(
                        dataSource,
                        dataSourceDetails.schema,
                        tableNames
                    );

                    await dataSource.destroy();

                    return {
                        dataSourceId: ds.id,
                        dataSourceName: ds.name,
                        dataSourceType: ds.type,
                        tables: tables
                    };
                } catch (error) {
                    console.error('[Cross-Source] Error fetching schema for data source:', ds.id, error);
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
            const { dataSourceId, conversationId, isCrossSource, message } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!userId || !message) {
                res.status(400).json({ error: 'userId and message are required' });
                return;
            }

            // Cross-source mode: use conversationId directly with Gemini
            if (isCrossSource && conversationId) {
                console.log('[AIDataModelerController] Handling cross-source chat:', { conversationId });

                const geminiService = getGeminiService();
                if (!geminiService.sessionExists(conversationId)) {
                    res.status(404).json({ error: 'Cross-source conversation not found. Please reinitialize.' });
                    return;
                }

                // Send to Gemini
                const response = await geminiService.sendMessage(conversationId, message);

                // Parse response to extract clean display message
                const parsed = AIDataModelerController.parseAIResponse(response);

                res.status(200).json({
                    userMessage: {
                        id: `msg_${Date.now()}_user`,
                        role: 'user',
                        content: message,
                        timestamp: new Date()
                    },
                    assistantMessage: {
                        id: `msg_${Date.now()}_assistant`,
                        role: 'assistant',
                        content: parsed.displayMessage,  // Send clean text instead of raw JSON
                        timestamp: new Date()
                    },
                    conversationId,
                    dataModel: parsed.dataModel || null
                });
                return;
            }

            // Single-source mode: use Redis
            if (!dataSourceId) {
                res.status(400).json({ error: 'dataSourceId is required for single-source mode' });
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

            // DEBUG: Log raw AI response
            console.log('[DEBUG] ========== RAW AI RESPONSE START ==========');
            console.log('[DEBUG] User Message:', message);
            console.log('[DEBUG] Response Length:', response.length);
            console.log('[DEBUG] Raw Response:', response);
            console.log('[DEBUG] ========== RAW AI RESPONSE END ==========');

            // Parse response to extract clean display message
            const parsed = AIDataModelerController.parseAIResponse(response);

            // Save assistant message to Redis with display message
            const assistantMessage = await redisService.addMessage(dataSourceId, userId, 'assistant', parsed.displayMessage);

            res.status(200).json({
                userMessage,
                assistantMessage,
                conversationId: session.conversationId,
                dataModel: parsed.dataModel || null
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
     * Parse AI response and extract display message for users
     * Handles GUIDE and BUILD_DATA_MODEL actions
     */
    private static parseAIResponse(aiResponse: string): {
        action: string;
        displayMessage: string;
        dataModel: any | null;
    } {
        try {
            // Look for JSON code block
            const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                
                // GUIDE action - return guidance message for display
                if (parsed.action === 'GUIDE') {
                    console.log('[AIDataModelerController] Parsed GUIDE response');
                    return {
                        action: 'GUIDE',
                        displayMessage: parsed.message || aiResponse,
                        dataModel: null
                    };
                }
                
                // BUILD_DATA_MODEL action - return guidance text + model
                if (parsed.action === 'BUILD_DATA_MODEL' && parsed.model) {
                    console.log('[AIDataModelerController] Parsed BUILD_DATA_MODEL response');
                    
                    // DEBUG: Log parsed model structure
                    console.log('[DEBUG] ========== PARSED MODEL START ==========');
                    console.log('[DEBUG] Model Table Name:', parsed.model.table_name);
                    console.log('[DEBUG] Column Count:', parsed.model.columns?.length || 0);
                    console.log('[DEBUG] Columns:', JSON.stringify(parsed.model.columns, null, 2));
                    console.log('[DEBUG] Query Options:', JSON.stringify(parsed.model.query_options, null, 2));
                    console.log('[DEBUG] ========== PARSED MODEL END ==========');
                    
                    // VALIDATION & AUTO-FIX: Check GROUP BY columns when aggregates exist
                    const groupBy = parsed.model.query_options?.group_by;
                    const hasAggregates = groupBy?.aggregate_functions?.length > 0 || 
                                         groupBy?.aggregate_expressions?.length > 0;
                    
                    if (hasAggregates) {
                        const groupByColumns = groupBy.group_by_columns || [];
                        const selectedColumns = parsed.model.columns?.filter((c: any) => c.is_selected_column === true) || [];
                        
                        // DEBUG: Log validation details
                        console.log('[DEBUG] ========== VALIDATION START ==========');
                        console.log('[DEBUG] Has Aggregates:', hasAggregates);
                        console.log('[DEBUG] Group By Columns Count:', groupByColumns.length);
                        console.log('[DEBUG] Selected Columns Count:', selectedColumns.length);
                        console.log('[DEBUG] Selected Columns:', selectedColumns.map(c => `${c.schema}.${c.table_name}.${c.column_name} (is_selected: ${c.is_selected_column})`));
                        console.log('[DEBUG] All Columns is_selected_column values:');
                        parsed.model.columns?.forEach((c: any) => {
                            console.log(`[DEBUG]   - ${c.schema}.${c.table_name}.${c.column_name}: is_selected_column = ${c.is_selected_column}`);
                        });
                        console.log('[DEBUG] ========== VALIDATION END ==========');
                        
                        if (groupByColumns.length === 0 && selectedColumns.length > 0) {
                            console.warn('[AI Validation] AUTO-FIXING: Model has aggregates but empty group_by_columns');
                            console.warn('[AI Validation] Selected columns count:', selectedColumns.length);
                            console.warn('[AI Validation] Aggregate functions count:', groupBy.aggregate_functions?.length || 0);
                            
                            // Auto-fix: Generate group_by_columns from selected columns
                            if (!groupBy.group_by_columns) {
                                groupBy.group_by_columns = [];
                            }
                            
                            groupBy.group_by_columns = selectedColumns.map((col: any) => {
                                let columnRef = `${col.schema}.${col.table_name}.${col.column_name}`;
                                // Include transform functions if present
                                if (col.transform_function) {
                                    const closeParens = ')'.repeat(col.transform_close_parens || 1);
                                    columnRef = `${col.transform_function}(${columnRef}${closeParens}`;
                                }
                                return columnRef;
                            });
                            
                            console.log('[AI Validation] Auto-generated group_by_columns:', groupBy.group_by_columns);
                        } else if (groupByColumns.length !== selectedColumns.length) {
                            console.warn('[AI Validation] Mismatch: group_by_columns has', groupByColumns.length, 'but selected columns has', selectedColumns.length);
                        } else {
                            console.log('[AI Validation] GROUP BY validation passed:', {
                                group_by_columns: groupByColumns.length,
                                selected_columns: selectedColumns.length,
                                aggregate_functions: groupBy.aggregate_functions?.length || 0
                            });
                        }
                    }
                    
                    return {
                        action: 'BUILD_DATA_MODEL',
                        displayMessage: parsed.guidance || 'I\'ve created a data model for you.',
                        dataModel: parsed.model
                    };
                }
                
                // NONE or unknown action
                if (parsed.action === 'NONE') {
                    return {
                        action: 'NONE',
                        displayMessage: parsed.message || 'I can only help with data modeling questions.',
                        dataModel: null
                    };
                }
            }
            
            // Fallback: no JSON found, treat as plain text
            console.warn('[AIDataModelerController] No JSON found in response, treating as plain text');
            return {
                action: 'UNKNOWN',
                displayMessage: aiResponse,
                dataModel: this.extractDataModelJSON(aiResponse) // Try old method as fallback
            };
            
        } catch (error) {
            console.error('[AIDataModelerController] Failed to parse AI response:', error);
            // On error, return raw response
            return {
                action: 'ERROR',
                displayMessage: aiResponse,
                dataModel: null
            };
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

            // Fetch table metadata to get only tables belonging to this data source
            const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                dataSourceId,
                dataSourceDetails.schema,
                tokenDetails
            );

            // Collect schema only for user's tables
            const schemaCollector = new SchemaCollectorService();
            const tableNames = tableMetadata.map(m => m.physical_table_name);
            const tables = await schemaCollector.collectSchemaForTables(
                dataSource,
                dataSourceDetails.schema,
                tableNames
            );

            // NEW: Run join inference for pattern-based suggestions
            console.log('[AIDataModelerController] Running join inference...');
            const joinInferenceService = (await import('../services/JoinInferenceService.js')).JoinInferenceService.getInstance();
            const inferredJoins = await joinInferenceService.inferJoins(tables);
            console.log(`[AIDataModelerController] Found ${inferredJoins.length} inferred join suggestions`);

            // Format schema to markdown WITH inferred joins
            const schemaMarkdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables, inferredJoins);
            const schemaSummary = SchemaFormatterUtility.getSchemaSummary(tables);

            // Generate unique conversation ID
            const conversationId = uuidv4();

            // Initialize Gemini conversation with enhanced schema
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(conversationId, schemaMarkdown);

            // Close the data source connection
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }

            res.status(200).json({
                conversationId,
                schemaSummary,
                inferredJoinCount: inferredJoins.length,
                inferredJoins: inferredJoins.slice(0, 10), // Return top 10 for immediate UI display
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
        
        // API-integrated sources (Excel, PDF, MongoDB) store data in PostgreSQL
        // Use PostgreSQL connection for these sources instead of their original connection details
        const apiSourceSchemas: Record<string, string> = {
            'google_analytics': 'dra_google_analytics',
            'google_ad_manager': 'dra_google_ad_manager',
            'google_ads': 'dra_google_ads',
            'excel': 'dra_excel',
            'pdf': 'dra_pdf',
            'mongodb': 'dra_mongodb'
        };
        
        const isApiIntegratedSource = apiSourceSchemas[dataSource.data_type];
        
        // Determine correct schema based on data source type
        let schema = connectionDetails.schema;
        
        if (!schema) {
            // Check if this is an API-integrated source
            if (isApiIntegratedSource) {
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
        
        // For API-integrated sources that store data in PostgreSQL, use internal PostgreSQL connection
        let host = connectionDetails.host;
        let port = connectionDetails.port;
        let database = connectionDetails.database;
        let username = connectionDetails.username;
        let password = connectionDetails.password;
        
        if (isApiIntegratedSource) {
            // Get internal PostgreSQL connection details from the DBDriver
            const internalDataSource = manager.connection;
            const pgOptions = internalDataSource.options as any;
            
            host = pgOptions.host;
            port = pgOptions.port;
            database = pgOptions.database;
            username = pgOptions.username;
            password = pgOptions.password;
            
            console.log(`[AIDataModelerController] Using internal PostgreSQL connection for API source '${dataSource.data_type}' (schema: ${schema}, host: ${host}:${port})`);
        }
        
        return {
            type: dataSource.data_type,
            host,
            port,
            database,
            username,
            password,
            schema
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
            case 'mongodb':           // MongoDB data stored in PostgreSQL (dra_mongodb schema)
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
     * Fetch table metadata (display names) from database
     */
    private static async fetchTableMetadata(
        dataSourceId: number,
        schemaName: string,
        tokenDetails: any
    ): Promise<any[]> {
        try {
            const { DBDriver } = await import('../drivers/DBDriver.js');
            const { EDataSourceType } = await import('../types/EDataSourceType.js');
            const { DRATableMetadata } = await import('../models/DRATableMetadata.js');

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver?.getConcreteDriver())?.manager;

            if (!manager) {
                console.warn('[AIDataModelerController] Database connection failed, skipping table metadata');
                return [];
            }

            // Fetch all table metadata for this data source
            const metadata = await manager.find(DRATableMetadata, {
                where: {
                    data_source_id: dataSourceId,
                    schema_name: schemaName
                }
            });

            console.log(`[AIDataModelerController] Fetched ${metadata.length} table metadata entries for data source ${dataSourceId}`);
            return metadata;

        } catch (error) {
            console.error('[AIDataModelerController] Error fetching table metadata:', error);
            return [];
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

    /**
     * Get AI-suggested JOIN relationships for a data source (Issue #270)
     * GET /api/ai-data-modeler/suggested-joins/:dataSourceId
     * 
     * Query Parameters:
     * - tables: Comma-separated list of table names (optional, filter to specific tables)
     * - useAI: Enable AI-powered suggestions (optional, default: false)
     * - schema: Schema name (optional)
     * - loadAll: Load all possible joins for entire data source (optional, default: false)
     */
    static async getSuggestedJoins(req: Request, res: Response): Promise<void> {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            // Parse query parameters
            const tablesParam = req.query.tables as string | undefined;
            const loadAll = req.query.loadAll === 'true';
            const useAI = req.query.useAI === 'true';
            const schemaParam = req.query.schema as string | undefined;

            const requestedTables = tablesParam 
                ? tablesParam.split(',').map(t => t.trim()).filter(t => t.length > 0)
                : null;

            if (loadAll) {
                console.log(`[AI Controller] Preloading all join suggestions for data source ${dataSourceId} (AI: ${useAI ? 'ENABLED' : 'DISABLED'})`);
            } else if (requestedTables && requestedTables.length > 0) {
                console.log(`[AI Controller] Fetching suggested joins for data source ${dataSourceId}, filtered to tables: ${requestedTables.join(', ')}`);
            } else {
                console.log(`[AI Controller] Fetching suggested joins for data source: ${dataSourceId} (all tables)`);
            }

            // Get data source details with access check
            const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                dataSourceId,
                tokenDetails
            );

            if (!dataSourceDetails) {
                res.status(404).json({ 
                    success: false,
                    error: 'Data source not found or access denied' 
                });
                return;
            }

            // Create data source connection
            const dataSource = await AIDataModelerController.createDataSource(dataSourceDetails);
            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            // Prepare options for AI enhancement
            // Always pass userId for PostgreSQL persistence (even if useAI is false)
            const inferenceOptions = {
                useAI: useAI,
                userId: userId || tokenDetails?.id, // Fallback to tokenDetails.id if user_id not set
                conversationId: useAI ? `join-inference-${dataSourceId}-${Date.now()}` : undefined
            };

            let inferredJoins: any[];
            let analyzedTableNames: string[];

            // LOAD ALL MODE: Preload suggestions for entire data source
            if (loadAll) {
                // Fetch table metadata to scope tables for this data source (if available)
                const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                    dataSourceId,
                    dataSourceDetails.schema,
                    tokenDetails
                );
                const scopedTableNames = tableMetadata.map((m: any) => m.physical_table_name).filter(Boolean);
                const hasScopedTables = scopedTableNames.length > 0;

                if (hasScopedTables) {
                    console.log(`[AI Controller] Scoping preload to ${scopedTableNames.length} tables from metadata`);
                } else {
                    console.log('[AI Controller] No table metadata found for preload scoping; falling back to full schema scan');
                }

                const joinInferenceService = (await import('../services/JoinInferenceService.js'))
                    .JoinInferenceService.getInstance();

                inferredJoins = await joinInferenceService.inferJoinsFromDataSource(
                    dataSource,
                    dataSourceId,
                    schemaParam || dataSourceDetails.schema,
                    inferenceOptions,
                    20,
                    hasScopedTables ? scopedTableNames : undefined
                );

                // Get analyzed table names for response
                const uniqueTables = new Set<string>();
                inferredJoins.forEach(join => {
                    uniqueTables.add(`${join.left_schema}.${join.left_table}`);
                    uniqueTables.add(`${join.right_schema}.${join.right_table}`);
                });
                analyzedTableNames = Array.from(uniqueTables);

                console.log(`[AI Controller] Preloaded ${inferredJoins.length} suggestions for ${analyzedTableNames.length} tables`);

                // Clean up connection
                if (dataSource.isInitialized) {
                    await dataSource.destroy();
                }

                // Return suggestions
                res.status(200).json({
                    success: true,
                    data: inferredJoins,
                    count: inferredJoins.length,
                    dataSourceId: dataSourceId,
                    dataSourceName: dataSourceDetails.name,
                    analyzedTables: analyzedTableNames,
                    tableCount: analyzedTableNames.length,
                    loadAll: true
                });
                return;
            }

            // FILTERED MODE: Original logic for specific tables
            // Fetch table metadata to get only tables belonging to this data source
            const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                dataSourceId,
                dataSourceDetails.schema,
                tokenDetails
            );

            // Collect schema - filter by requested tables if provided
            const schemaCollector = new SchemaCollectorService();
            let tableNames = tableMetadata.map((m: any) => m.physical_table_name);
            
            // Filter to only requested tables if specified
            if (requestedTables && requestedTables.length > 0) {
                tableNames = tableNames.filter(name => requestedTables.includes(name));
                console.log(`[AI Controller] Filtered to ${tableNames.length} requested tables`);
                
                // If user requested tables but none match, return empty suggestions
                if (tableNames.length === 0) {
                    console.warn(`[AI Controller] No matching tables found for requested filter`);
                    res.status(200).json({
                        success: true,
                        data: [],
                        count: 0,
                        dataSourceId: dataSourceId,
                        dataSourceName: dataSourceDetails.name,
                        requestedTables: requestedTables,
                        message: 'No matching tables found'
                    });
                    await dataSource.destroy();
                    return;
                }
            }

            // FILTERED MODE: Use same inference path as loadAll for consistency
            // This ensures PostgreSQL persistence works for both modes
            const joinInferenceService = (await import('../services/JoinInferenceService.js'))
                .JoinInferenceService.getInstance();

            // Use inferJoinsFromDataSource for persistence benefits
            // Pass requested tables to filter results
            inferredJoins = await joinInferenceService.inferJoinsFromDataSource(
                dataSource,
                dataSourceId,
                schemaParam || dataSourceDetails.schema,
                inferenceOptions,
                20,
                requestedTables && requestedTables.length > 0 ? requestedTables : tableNames
            );
            
            analyzedTableNames = tableNames;

            // Clean up connection after inference
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }

            console.log(`[AI Controller] Found ${inferredJoins.length} suggested joins among ${tableNames.length} tables (AI: ${useAI ? 'ENABLED' : 'DISABLED'})`);

            // Return suggestions
            res.status(200).json({
                success: true,
                data: inferredJoins,
                count: inferredJoins.length,
                dataSourceId: dataSourceId,
                dataSourceName: dataSourceDetails.name,
                analyzedTables: analyzedTableNames,
                tableCount: analyzedTableNames.length
            });

        } catch (error) {
            console.error('[AI Controller] Error fetching suggested joins:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch suggested joins',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get suggested JOIN relationships for cross-source data models
     * GET /api/ai-data-modeler/suggested-joins/cross-source/:projectId
     * 
     * Generates join suggestions across multiple data sources in a project.
     * Table keys are prefixed with data_source_id for disambiguation.
     * 
     * Query parameters:
     * - useAI: Enable AI-powered suggestions (optional, default: false)
     */
    static async getCrossSourceSuggestedJoins(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;
            const useAI = req.query.useAI === 'true';

            console.log(`[AI Controller] Fetching cross-source join suggestions for project ${projectId} (AI: ${useAI ? 'ENABLED' : 'DISABLED'})`);

            // Get data sources for the project using DataSourceProcessor
            const { DataSourceProcessor } = await import('../processors/DataSourceProcessor.js');
            const dataSourceProcessor = DataSourceProcessor.getInstance();
            
            const dataSources = await dataSourceProcessor.getDataSourcesByProject(
                projectId,
                tokenDetails
            );

            if (!dataSources || dataSources.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Project not found, access denied, or no data sources available'
                });
                return;
            }

            console.log(`[AI Controller] Found ${dataSources.length} data sources for project ${projectId}`);

            // Prepare inference options
            const inferenceOptions = useAI ? {
                useAI: true,
                userId: userId,
                conversationId: `cross-source-join-${projectId}-${Date.now()}`
            } : undefined;

            // Collect schemas from all data sources with data_source_id prefixing
            const allTablesWithSourceId: any[] = [];
            const dataSourceConnections: DataSource[] = [];

            for (const dataSource of dataSources) {
                try {
                    // Get data source details (handles connection details extraction and schema determination)
                    const dataSourceDetails = await AIDataModelerController.getDataSourceDetails(
                        dataSource.id,
                        tokenDetails
                    );

                    if (!dataSourceDetails) {
                        console.warn(`[AI Controller] Could not retrieve details for data source ${dataSource.id}`);
                        continue;
                    }

                    // Create data source connection
                    const dsConnection = await AIDataModelerController.createDataSource(dataSourceDetails);

                    if (!dsConnection.isInitialized) {
                        await dsConnection.initialize();
                    }
                    dataSourceConnections.push(dsConnection);

                    // Fetch table metadata using the schema from dataSourceDetails
                    const schema = dataSourceDetails.schema;
                    const tableMetadata = await AIDataModelerController.fetchTableMetadata(
                        dataSource.id,
                        schema,
                        tokenDetails
                    );

                    // Collect table schemas
                    const schemaCollector = new SchemaCollectorService();
                    const tableNames = tableMetadata.map((m: any) => m.physical_table_name);
                    const tables = await schemaCollector.collectSchemaForTables(
                        dsConnection,
                        schema,
                        tableNames
                    );

                    // Add data_source_id to each table and column for disambiguation
                    tables.forEach(table => {
                        const metadata = tableMetadata.find((m: any) => 
                            m.physical_table_name === table.tableName
                        );

                        // Prefix table with data_source_id in tableName for cross-source uniqueness
                        allTablesWithSourceId.push({
                            ...table,
                            dataSourceId: dataSource.id,
                            dataSourceName: dataSource.name,
                            dataSourceType: dataSourceDetails.type,
                            // Keep original tableName for display, add prefixed version for keys
                            originalTableName: table.tableName,
                            tableName: `${dataSource.id}.${table.schema}.${table.tableName}`,
                            displayName: metadata?.logical_table_name || table.tableName,
                            columns: table.columns.map((col: any) => ({
                                ...col,
                                dataSourceId: dataSource.id,
                                sourceTable: table.tableName
                            }))
                        });
                    });

                    console.log(`[AI Controller] Collected ${tables.length} tables from data source ${dataSource.id} (${dataSource.name})`);

                } catch (error) {
                    console.error(`[AI Controller] Failed to process data source ${dataSource.id}:`, error);
                    // Continue with other data sources
                }
            }

            // Clean up all connections
            for (const conn of dataSourceConnections) {
                if (conn.isInitialized) {
                    await conn.destroy();
                }
            }

            if (allTablesWithSourceId.length === 0) {
                res.status(200).json({
                    success: true,
                    data: [],
                    count: 0,
                    projectId: projectId,
                    dataSourceCount: dataSources.length,
                    message: 'No tables found in any data source'
                });
                return;
            }

            // Run cross-source join inference
            const joinInferenceService = (await import('../services/JoinInferenceService.js'))
                .JoinInferenceService.getInstance();
            
            const inferredJoins = await joinInferenceService.inferJoins(
                allTablesWithSourceId,
                inferenceOptions
            );

            console.log(`[AI Controller] Found ${inferredJoins.length} cross-source join suggestions among ${allTablesWithSourceId.length} tables`);

            // Return suggestions with metadata
            res.status(200).json({
                success: true,
                data: inferredJoins,
                count: inferredJoins.length,
                projectId: projectId,
                dataSourceCount: dataSources.length,
                totalTables: allTablesWithSourceId.length,
                crossSource: true
            });

        } catch (error) {
            console.error('[AI Controller] Error fetching cross-source suggested joins:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch cross-source suggested joins',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Helper method to determine schema name based on data source type and ID
     */
    private static determineSchemaName(dataType: string, dataSourceId: number): string {
        switch (dataType.toLowerCase()) {
            case 'google_analytics':
                return 'dra_google_analytics';
            case 'google_ads':
                return 'dra_google_ads';
            case 'google_ad_manager':
                return 'dra_google_ad_manager';
            case 'excel':
            case 'csv':
            case 'pdf':
                return 'dra_excel';
            case 'postgresql':
            case 'mysql':
            case 'mariadb':
            default:
                return 'public';
        }
    }

    /**
     * Initialize quality analysis session
     * POST /api/ai-data-modeler/quality/initialize
     */
    static async initializeQualitySession(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!dataModelId || !userId) {
                res.status(400).json({ error: 'dataModelId and userId are required' });
                return;
            }

            // Get data model details
            const dataModel = await AIDataModelerController.getDataModelDetails(dataModelId, tokenDetails);
            if (!dataModel) {
                res.status(404).json({ error: 'Data model not found' });
                return;
            }

            // Profile the data model
            const dataQualityService = DataQualityService.getInstance();
            const profile = await dataQualityService.profileDataModel(dataModel);

            // Format profile as markdown context for AI
            const qualityContext = AIDataModelerController.formatQualityContext(dataModel, profile);

            const redisService = new RedisAISessionService();

            // Check if quality session already exists
            const existingSession = await redisService.sessionExists(dataModelId, userId, 'data_quality');

            if (existingSession) {
                const session = await redisService.getFullSession(dataModelId, userId, 'data_quality');
                res.status(200).json({
                    conversationId: session.metadata?.conversationId,
                    messages: session.messages,
                    schemaContext: session.schemaContext,
                    sessionType: 'data_quality',
                    restored: true
                });
                return;
            }

            // Create new quality session
            const conversationId = `quality-${dataModelId}-${userId}-${Date.now()}`;
            
            await redisService.createSession(
                dataModelId,
                userId,
                { tables: [], relationships: [], inferredJoins: [] },
                'data_quality'
            );

            // Save quality context
            await redisService.saveSchemaContext(
                dataModelId,
                userId,
                { tables: [profile], relationships: [], inferredJoins: [] },
                'data_quality'
            );

            // Initialize Gemini conversation with quality expert prompt
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(
                conversationId,
                qualityContext,
                AI_DATA_QUALITY_EXPERT_PROMPT
            );

            // Add initial system message
            await redisService.addMessage(
                dataModelId,
                userId,
                'system',
                'Data quality analysis session initialized. I can help you identify and fix data quality issues.',
                'data_quality'
            );

            res.status(200).json({
                conversationId,
                dataModelId,
                sessionType: 'data_quality',
                status: 'initialized'
            });

        } catch (error) {
            console.error('[AIDataModelerController] Error initializing quality session:', error);
            res.status(500).json({
                error: 'Failed to initialize quality session',
                message: error.message
            });
        }
    }

    /**
     * Execute AI-generated cleaning SQL
     * POST /api/ai-data-modeler/quality/execute-sql
     */
    static async executeCleaningSQL(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, sql, dryRun = false } = req.body;
            const tokenDetails = req.body.tokenDetails;

            if (!dataModelId || !sql) {
                res.status(400).json({ error: 'dataModelId and sql are required' });
                return;
            }

            // Get data model details
            const dataModel = await AIDataModelerController.getDataModelDetails(dataModelId, tokenDetails);
            if (!dataModel) {
                res.status(404).json({ error: 'Data model not found' });
                return;
            }

            // Validate SQL
            const sqlValidator = SQLValidationService.getInstance();
            const validation = sqlValidator.validateCleaningSQL(sql);

            if (!validation.safe) {
                res.status(400).json({
                    error: 'SQL validation failed',
                    issues: validation.issues,
                    warnings: validation.warnings
                });
                return;
            }

            // Execute SQL
            const executionService = DataQualityExecutionService.getInstance();
            const result = await executionService.executeCleaningSQL(dataModel, sql, dryRun);

            res.status(200).json(result);

        } catch (error) {
            console.error('[AIDataModelerController] Error executing cleaning SQL:', error);
            res.status(500).json({
                error: 'Failed to execute cleaning SQL',
                message: error.message
            });
        }
    }

    /**
     * Helper: Get data model details
     */
    private static async getDataModelDetails(dataModelId: number, tokenDetails: any): Promise<any> {
        try {
            const { AppDataSource } = await import('../datasources/PostgresDS.js');
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const result = await queryRunner.query(
                    `SELECT * FROM "dra_data_models" WHERE id = $1`,
                    [dataModelId]
                );

                return result.length > 0 ? result[0] : null;
            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error('Error fetching data model:', error);
            return null;
        }
    }

    /**
     * Helper: Format quality context for AI
     */
    private static formatQualityContext(dataModel: any, profile: any): string {
        return `
# Data Model: ${dataModel.name}
**Schema**: ${dataModel.schema}
**Total Rows**: ${profile.totalRows}
**Columns**: ${profile.columnCount}

## Column Profiles

${profile.columns.map((col: any) => `
### ${col.name} (${col.type})
- **Null Rate**: ${col.nullRate}%
- **Distinct Values**: ${col.distinctCount} (${col.distinctRate}% unique)
- **Sample Values**: ${col.sampleValues.slice(0, 5).join(', ')}
${col.min !== undefined ? `- **Min**: ${col.min}` : ''}
${col.max !== undefined ? `- **Max**: ${col.max}` : ''}
${col.mean !== undefined ? `- **Mean**: ${col.mean.toFixed(2)}` : ''}
${col.stdDev !== undefined ? `- **Std Dev**: ${col.stdDev.toFixed(2)}` : ''}
`).join('\n')}

## Analysis Task
Please analyze this data model for quality issues including:
1. Duplicate records
2. Missing values that could be imputed
3. Inconsistent formats (dates, country names, phone numbers, emails)
4. Outliers in numeric columns
5. Data standardization opportunities

Provide specific SQL fixes for any issues you identify.
        `.trim();
    }

    /**
     * Initialize attribution analysis session
     * POST /api/ai-data-modeler/attribution/initialize
     */
    static async initializeAttributionSession(req: Request, res: Response): Promise<void> {
        try {
            const { projectId } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || !userId) {
                res.status(400).json({ error: 'projectId and userId are required' });
                return;
            }

            // Get attribution data summary for context
            const attributionContext = await AIDataModelerController.formatAttributionContext(projectId);

            const redisService = new RedisAISessionService();

            // Check if attribution session already exists
            const existingSession = await redisService.sessionExists(projectId, userId, 'attribution');

            if (existingSession) {
                const session = await redisService.getFullSession(projectId, userId, 'attribution');
                res.status(200).json({
                    conversationId: session.metadata?.conversationId,
                    messages: session.messages,
                    schemaContext: session.schemaContext,
                    sessionType: 'attribution',
                    restored: true
                });
                return;
            }

            // Create new attribution session
            const conversationId = `attribution-${projectId}-${userId}-${Date.now()}`;
            
            await redisService.createSession(
                projectId,
                userId,
                { tables: [], relationships: [], inferredJoins: [] },
                'attribution'
            );

            // Save attribution context
            await redisService.saveSchemaContext(
                projectId,
                userId,
                { tables: [], relationships: [], inferredJoins: [] },
                'attribution'
            );

            // Initialize Gemini conversation with attribution expert prompt
            const geminiService = getGeminiService();
            await geminiService.initializeConversation(
                conversationId,
                attributionContext,
                AI_ATTRIBUTION_EXPERT_PROMPT
            );

            // Add initial system message
            await redisService.addMessage(
                projectId,
                userId,
                'system',
                'Marketing attribution analysis session initialized. I can help you understand channel performance, optimize budget allocation, and analyze customer journeys.',
                'attribution'
            );

            res.status(200).json({
                conversationId,
                projectId,
                sessionType: 'attribution',
                status: 'initialized'
            });

        } catch (error) {
            console.error('[AIDataModelerController] Error initializing attribution session:', error);
            res.status(500).json({
                error: 'Failed to initialize attribution session',
                message: error.message
            });
        }
    }

    /**
     * Send message to attribution AI session
     * POST /api/ai-data-modeler/attribution/message
     */
    static async sendAttributionMessage(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, message } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || !message || !userId) {
                res.status(400).json({ error: 'projectId, message, and userId are required' });
                return;
            }

            const redisService = new RedisAISessionService();

            // Get session
            const session = await redisService.getFullSession(projectId, userId, 'attribution');
            if (!session.metadata) {
                res.status(404).json({ error: 'Session not found. Please initialize a session first.' });
                return;
            }

            const conversationId = session.metadata.conversationId;

            // Save user message
            await redisService.addMessage(
                projectId,
                userId,
                'user',
                message,
                'attribution'
            );

            // Send to AI
            const geminiService = getGeminiService();
            const aiResponse = await geminiService.sendMessage(conversationId, message);

            // Save AI response
            await redisService.addMessage(
                projectId,
                userId,
                'assistant',
                aiResponse,
                'attribution'
            );

            res.status(200).json({
                response: aiResponse,
                conversationId
            });

        } catch (error) {
            console.error('[AIDataModelerController] Error sending attribution message:', error);
            res.status(500).json({
                error: 'Failed to send message',
                message: error.message
            });
        }
    }

    /**
     * Get attribution session history
     * GET /api/ai-data-modeler/attribution/session/:projectId
     */
    static async getAttributionSession(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || !userId) {
                res.status(400).json({ error: 'projectId and userId are required' });
                return;
            }

            const redisService = new RedisAISessionService();
            const session = await redisService.getFullSession(projectId, userId, 'attribution');

            if (!session.metadata) {
                res.status(404).json({ error: 'Session not found' });
                return;
            }

            res.status(200).json({
                conversationId: session.metadata.conversationId,
                messages: session.messages,
                sessionType: 'attribution'
            });

        } catch (error) {
            console.error('[AIDataModelerController] Error getting attribution session:', error);
            res.status(500).json({
                error: 'Failed to get session',
                message: error.message
            });
        }
    }

    /**
     * Helper: Format attribution context for AI
     */
    private static async formatAttributionContext(projectId: number): Promise<string> {
        try {
            const { AppDataSource } = await import('../datasources/PostgresDS.js');
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Get channel summary
                const channels = await queryRunner.query(
                    `SELECT COUNT(*) as channel_count, 
                            ARRAY_AGG(DISTINCT name) as channel_names,
                            ARRAY_AGG(DISTINCT category) as channel_categories
                     FROM "dra_attribution_channels"
                     WHERE project_id = $1`,
                    [projectId]
                );

                // Get event summary
                const events = await queryRunner.query(
                    `SELECT 
                        COUNT(*) as total_events,
                        COUNT(DISTINCT user_identifier) as unique_users,
                        COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) as total_conversions,
                        SUM(CASE WHEN event_type = 'conversion' THEN event_value ELSE 0 END) as total_revenue
                     FROM "dra_attribution_events"
                     WHERE project_id = $1`,
                    [projectId]
                );

                // Get recent conversion paths
                const paths = await queryRunner.query(
                    `WITH recent_conversions AS (
                        SELECT id, user_identifier 
                        FROM "dra_attribution_events"
                        WHERE project_id = $1 
                          AND event_type = 'conversion'
                        ORDER BY event_timestamp DESC
                        LIMIT 5
                    )
                    SELECT 
                        rc.user_identifier,
                        ARRAY_AGG(c.name ORDER BY t.touchpoint_position) as channel_path
                    FROM recent_conversions rc
                    INNER JOIN "dra_attribution_touchpoints" t ON t.conversion_event_id = rc.id
                    INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                    GROUP BY rc.user_identifier`,
                    [projectId]
                );

                const channelCount = parseInt(channels[0]?.channel_count || 0);
                const channelNames = channels[0]?.channel_names || [];
                const totalEvents = parseInt(events[0]?.total_events || 0);
                const uniqueUsers = parseInt(events[0]?.unique_users || 0);
                const totalConversions = parseInt(events[0]?.total_conversions || 0);
                const totalRevenue = parseFloat(events[0]?.total_revenue || 0);

                return `
# Marketing Attribution Analysis Context
**Project ID**: ${projectId}

## Current Attribution Data

### Channels (${channelCount} total)
${channelNames.length > 0 ? channelNames.map((n: string) => `- ${n}`).join('\n') : '- No channels configured yet'}

### Performance Summary
- **Total Events Tracked**: ${totalEvents.toLocaleString()}
- **Unique Users**: ${uniqueUsers.toLocaleString()}
- **Total Conversions**: ${totalConversions.toLocaleString()}
- **Total Revenue**: $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
${totalConversions > 0 ? `- **Avg Conversion Value**: $${(totalRevenue / totalConversions).toFixed(2)}` : ''}

### Recent Conversion Paths
${paths.length > 0 ? paths.map((p: any) => `- ${p.channel_path.join(' → ')}`).join('\n') : '- No conversion paths tracked yet'}

## Your Role
You are a marketing attribution expert. Help the user:
1. Understand which channels drive the most conversions
2. Optimize budget allocation across channels
3. Identify underperforming channels or campaigns
4. Analyze customer journey patterns
5. Compare different attribution models (first-touch, last-touch, linear, time-decay, U-shaped)
6. Provide actionable recommendations for marketing optimization

Always structure your responses in JSON format as specified in your system prompt.
                `.trim();

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error('Error formatting attribution context:', error);
            return `# Marketing Attribution Analysis Context\n**Project ID**: ${projectId}\n\nNo attribution data available yet. Start tracking events to enable analysis.`;
        }
    }
}
