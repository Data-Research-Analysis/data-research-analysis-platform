import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { ITokenDetails } from '../types/ITokenDetails.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRAAIInsightReport } from '../models/DRAAIInsightReport.js';
import { DRAAIInsightMessage } from '../models/DRAAIInsightMessage.js';
import { DataSamplingService } from '../services/DataSamplingService.js';
import { RedisAISessionService } from '../services/RedisAISessionService.js';
import { GeminiService } from '../services/GeminiService.js';
import { AI_INSIGHTS_EXPERT_PROMPT, AI_INSIGHTS_FOLLOWUP_PROMPT } from '../constants/system-prompts.js';
import { SocketIODriver } from '../drivers/SocketIODriver.js';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { Repository, In } from 'typeorm';

interface InitializeSessionResponse {
    success: boolean;
    conversationId?: string;
    projectId: number;
    dataSourceIds: number[];
    error?: string;
}

interface GenerateInsightsResponse {
    success: boolean;
    insights?: any;
    conversationId?: string;
    error?: string;
}

interface FollowUpResponse {
    success: boolean;
    message?: string;
    error?: string;
}

interface SaveReportResponse {
    success: boolean;
    reportId?: number;
    error?: string;
}

interface InsightReport {
    id: number;
    title: string;
    project_id: number;
    data_source_ids: number[];
    insights_summary: any;
    status: string;
    started_at: Date;
    saved_at: Date | null;
    created_at: Date;
}

export class InsightsProcessor {
    private static instance: InsightsProcessor;
    private dataSamplingService: DataSamplingService;
    private redisSessionService: RedisAISessionService;
    private geminiService: GeminiService;

    private constructor() {
        this.dataSamplingService = DataSamplingService.getInstance();
        this.redisSessionService = new RedisAISessionService();
        this.geminiService = new GeminiService();
    }

    public static getInstance(): InsightsProcessor {
        if (!InsightsProcessor.instance) {
            InsightsProcessor.instance = new InsightsProcessor();
        }
        return InsightsProcessor.instance;
    }

    /**
     * Get repository for DRAAIInsightReport
     */
    private async getReportRepository(): Promise<Repository<DRAAIInsightReport>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        return concreteDriver.manager.getRepository(DRAAIInsightReport);
    }

    /**
     * Get repository for DRAAIInsightMessage
     */
    private async getMessageRepository(): Promise<Repository<DRAAIInsightMessage>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        return concreteDriver.manager.getRepository(DRAAIInsightMessage);
    }

    /**
     * Validate that user has access to project
     */
    private async validateProjectAccess(
        projectId: number,
        userId: number
    ): Promise<{ valid: boolean; error?: string }> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        const project = await manager.findOne(DRAProject, {
            where: { id: projectId }
        });

        if (!project) {
            return { valid: false, error: 'Project not found' };
        }

        // Check if user is owner (via relation)
        const projectWithOwner = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform']
        });
        
        if (projectWithOwner?.users_platform?.id === userId) {
            return { valid: true };
        }

        // Check if user is a project member
        const membership = await manager.findOne(DRAProjectMember, {
            where: {
                project: { id: projectId },
                user: { id: userId }
            }
        });

        if (!membership) {
            return { valid: false, error: 'Access denied: You do not have permission to access this project' };
        }

        return { valid: true };
    }

    /**
     * Validate that data sources belong to project
     */
    private async validateDataSources(
        projectId: number,
        dataSourceIds: number[]
    ): Promise<{ valid: boolean; error?: string }> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        for (const dataSourceId of dataSourceIds) {
            // Load data source with project relation
            const dsWithProject = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId },
                relations: ['project']
            });

            if (!dsWithProject) {
                return { valid: false, error: `Data source ${dataSourceId} not found` };
            }
            
            if (dsWithProject.project?.id !== projectId) {
                return { valid: false, error: `Data source ${dataSourceId} does not belong to project ${projectId}` };
            }
        }

        return { valid: true };
    }

    /**
     * Generate suggested questions from insights
     * @param insights - The insights object returned by AI
     * @returns Markdown formatted list of suggested questions
     */
    private generateSuggestedQuestions(insights: any): string {
        const questions: string[] = [];

        // Add questions based on insights content
        if (insights.anomalies && insights.anomalies.length > 0) {
            questions.push("What do these anomalies mean for my business?");
            questions.push("Which anomalies should I investigate first?");
        }

        if (insights.trends && insights.trends.length > 0) {
            questions.push("How can I leverage these trends for better decision-making?");
            questions.push("Are these trends likely to continue?");
        }

        if (insights.correlations && insights.correlations.length > 0) {
            questions.push("What correlations are most significant?");
            questions.push("How can I use these correlations to improve my business?");
        }

        if (insights.distributions && insights.distributions.length > 0) {
            questions.push("What do these distribution patterns tell me?");
            questions.push("Are there any concerning distribution patterns?");
        }

        if (insights.business_insights && insights.business_insights.length > 0) {
            questions.push("What actions should I take based on these insights?");
        }

        // Default questions if no specific insights matched
        if (questions.length === 0) {
            questions.push("What are the most important findings from this analysis?");
            questions.push("Which areas of my data need immediate attention?");
            questions.push("How can I improve my data quality?");
            questions.push("What patterns should I investigate further?");
        }

        // Always add these general questions
        questions.push("Can you summarize the key takeaways?");
        questions.push("What should be my next steps?");

        // Format as markdown
        let markdown = "I've completed the analysis of your data. Here are some questions you can ask me:\n\n";
        questions.slice(0, 8).forEach((question, index) => {
            markdown += `${index + 1}. ${question}\n`;
        });
        markdown += "\nFeel free to ask any other questions about your data!";

        return markdown;
    }

    /**
     * Initialize an insight session
     * @param projectId - Project ID
     * @param dataSourceIds - Array of data source IDs to analyze
     * @param userId - User ID
     * @param tokenDetails - User token details
     */
    public async initializeSession(
        projectId: number,
        dataSourceIds: number[],
        userId: number,
        tokenDetails: ITokenDetails
    ): Promise<InitializeSessionResponse> {
        try {
            // Validate project access
            const projectValidation = await this.validateProjectAccess(projectId, userId);
            if (!projectValidation.valid) {
                return {
                    success: false,
                    projectId,
                    dataSourceIds,
                    error: projectValidation.error
                };
            }

            // Validate data sources
            const dataSourceValidation = await this.validateDataSources(projectId, dataSourceIds);
            if (!dataSourceValidation.valid) {
                return {
                    success: false,
                    projectId,
                    dataSourceIds,
                    error: dataSourceValidation.error
                };
            }

            // Check for existing active session
            const existingSession = await this.redisSessionService.getSession(
                projectId,
                userId,
                'insights'
            );

            if (existingSession && existingSession.status === 'draft') {
                // Only reuse the session if the selected data sources are identical.
                // If the user changed their selection, fall through and re-initialize
                // with the new data sources so the context is rebuilt from scratch.
                const redis = this.redisSessionService['redis'];
                const draftKey = `insight_draft:insights:${projectId}:${userId}`;
                const draftRaw = await redis.get(draftKey);
                const draft = draftRaw ? JSON.parse(draftRaw) : null;

                const storedIds: number[] = (draft?.dataSourceIds ?? []).slice().sort((a: number, b: number) => a - b);
                const incomingIds: number[] = dataSourceIds.slice().sort((a, b) => a - b);
                const idsMatch =
                    storedIds.length === incomingIds.length &&
                    storedIds.every((id, i) => id === incomingIds[i]);

                if (idsMatch) {
                    // Same selection — reuse the cached session as-is
                    return {
                        success: true,
                        conversationId: existingSession.conversationId,
                        projectId,
                        dataSourceIds
                    };
                }
                // Data sources changed — invalidate the old session and rebuild below
            }

            // Build context (this collects schema + samples + statistics)
            const socketIODriver = SocketIODriver.getInstance();
            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'sampling',
                progress: 10,
                message: 'Connecting to data sources...'
            });

            // Load data models for this project to get logical table names
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const dataModels = await manager.find(DRADataModel, {
                where: { 
                    data_source: { id: In(dataSourceIds) }
                },
                select: ['schema', 'name', 'query']
            });

            // Build mapping of physical table names to logical names
            // Format: "schema.tablename" -> "Logical Name"
            const tableNameMapping: Record<string, string> = {};
            for (const model of dataModels) {
                const queryObj = model.query as any;
                if (queryObj && queryObj.table) {
                    const physicalKey = `${model.schema}.${queryObj.table}`;
                    tableNameMapping[physicalKey] = model.name;
                }
            }

            const { context, markdown } = await this.dataSamplingService.buildInsightContext(
                projectId,
                dataSourceIds,
                tokenDetails,
                tableNameMapping
            );

            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'computing_stats',
                progress: 60,
                message: 'Computing statistics...'
            });

            // Create Redis session
            const session = await this.redisSessionService.createSession(
                projectId,
                userId,
                {
                    tables: context.data_sources,
                    relationships: []
                },
                'insights'
            );

            // Store the sampling context in Redis
            const contextKey = `schema_context:insights:${projectId}:${userId}`;
            const redis = this.redisSessionService['redis'];
            await redis.set(contextKey, markdown);
            await redis.expire(contextKey, 24 * 60 * 60); // 24 hours

            // Store sampling_info separately so generateInsights can reference it
            const samplingInfoKey = `sampling_info:insights:${projectId}:${userId}`;
            await redis.set(samplingInfoKey, JSON.stringify(context.sampling_info ?? null));
            await redis.expire(samplingInfoKey, 24 * 60 * 60); // 24 hours

            // Store insight draft with data source IDs
            const draftKey = `insight_draft:insights:${projectId}:${userId}`;
            await redis.set(draftKey, JSON.stringify({
                dataSourceIds,
                insights: null,
                selectedSources: context.data_sources.map(ds => ds.data_source_name),
                lastModified: new Date().toISOString(),
                version: 1
            }));
            await redis.expire(draftKey, 24 * 60 * 60);

            // Initialize Gemini conversation
            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'analyzing',
                progress: 70,
                message: 'Initializing AI analysis...'
            });

            await this.geminiService.initializeConversation(
                session.conversationId,
                markdown,
                AI_INSIGHTS_EXPERT_PROMPT
            );

            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'complete',
                progress: 100,
                message: 'Session initialized successfully'
            });

            return {
                success: true,
                conversationId: session.conversationId,
                projectId,
                dataSourceIds
            };

        } catch (error: any) {
            console.error('Error initializing insight session:', error);
            return {
                success: false,
                projectId,
                dataSourceIds,
                error: error.message
            };
        }
    }

    /**
     * Generate initial insights from AI
     */
    public async generateInsights(
        projectId: number,
        userId: number
    ): Promise<GenerateInsightsResponse> {
        try {
            // Get session
            const session = await this.redisSessionService.getSession(
                projectId,
                userId,
                'insights'
            );

            if (!session) {
                return {
                    success: false,
                    error: 'No active session found. Please initialize a session first.'
                };
            }

            // Get context
            const redis = this.redisSessionService['redis'];
            const contextKey = `schema_context:insights:${projectId}:${userId}`;
            const schemaContext = await redis.get(contextKey);

            // Retrieve sampling_info stored during initializeSession
            const samplingInfoKey = `sampling_info:insights:${projectId}:${userId}`;
            const samplingInfoRaw = await redis.get(samplingInfoKey);
            const samplingInfo = samplingInfoRaw ? JSON.parse(samplingInfoRaw) : null;

            if (!schemaContext) {
                return {
                    success: false,
                    error: 'Schema context not found. Please reinitialize the session.'
                };
            }

            // Re-initialize Gemini conversation if needed (in case of server restart or lost session)
            await this.geminiService.initializeConversation(
                session.conversationId,
                schemaContext,
                AI_INSIGHTS_EXPERT_PROMPT
            );

            // Send analysis prompt to Gemini with streaming
            const socketIODriver = SocketIODriver.getInstance();
            const analysisPrompt = `
Based on the database schema, sample data, and statistics provided, please analyze the data and provide structured insights.

Return your analysis in the following JSON format:
{
  "summary": {
    "sources_analyzed": <number>,
    "total_tables": <number>,
    "total_rows_estimated": <number>,
    "date_range": { "earliest": "YYYY-MM-DD", "latest": "YYYY-MM-DD" },
    "key_entities": ["entity1", "entity2", ...]
  },
  "insights": [
    {
      "category": "trend|anomaly|correlation|distribution|recommendation",
      "title": "Brief insight title",
      "description": "Detailed description of the insight",
      "confidence": "high|medium|low",
      "supporting_data": "Specific data points or statistics that support this insight",
      "tables_involved": ["table1", "table2"],
      "actionability": "What action can be taken based on this insight"
    }
  ],
  "cross_source_observations": [
    {
      "title": "Observation title",
      "sources": ["Source 1", "Source 2"],
      "join_key": "potential_join_column",
      "potential_value": "What value this provides"
    }
  ],
  "suggested_questions": [
    "Question 1?",
    "Question 2?"
  ],
  "recommended_data_models": [
    {
      "name": "Model name",
      "description": "What this model would provide",
      "tables_involved": ["table1", "table2"],
      "sql_hint": "SELECT ... (basic SQL structure)",
      "estimated_complexity": "low|medium|high"
    }
  ]
}

Please analyze the provided data and return structured insights.
            `;

            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'analyzing',
                progress: 20,
                message: 'AI is analyzing your data...'
            });

            // Stream response with progress updates
            let chunkCount = 0;
            const fullResponse = await this.geminiService.sendMessageStream(
                session.conversationId,
                analysisPrompt,
                async (chunk: string) => {
                    chunkCount++;
                    // Update progress as chunks arrive (20% -> 90%)
                    const progress = Math.min(90, 20 + Math.floor(chunkCount / 2));
                    
                    await socketIODriver.emitToUser(userId, 'insight-chunk', {
                        projectId,
                        chunk,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Periodic progress updates
                    if (chunkCount % 10 === 0) {
                        await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                            projectId,
                            phase: 'analyzing',
                            progress,
                            message: `Generating insights... (${chunkCount} chunks received)`
                        });
                    }
                }
            );

            // Update progress: parsing response
            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'processing',
                progress: 92,
                message: 'Processing AI response...'
            });

            // Parse JSON response
            let insights: any;
            try {
                // Extract JSON from markdown code blocks if present
                const jsonMatch = fullResponse.match(/```json\n([\s\S]*?)\n```/) || 
                                 fullResponse.match(/```\n([\s\S]*?)\n```/);
                const jsonString = jsonMatch ? jsonMatch[1] : fullResponse;
                insights = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('Error parsing insights JSON:', parseError);
                // Return raw response if parsing fails
                insights = { raw_response: fullResponse };
            }

            // Generate suggested questions from insights
            const suggestedQuestions = this.generateSuggestedQuestions(insights);
            
            // Save suggested questions as first assistant message instead of full insights
            await this.redisSessionService.addMessage(
                projectId,
                userId,
                'assistant',
                suggestedQuestions,
                'insights'
            );

            // Update draft with insights
            const draftKey = `insight_draft:insights:${projectId}:${userId}`;
            const existingDraft = await redis.get(draftKey);
            const draft = existingDraft ? JSON.parse(existingDraft) : {};
            draft.insights = insights;
            draft.sampling_info = samplingInfo;
            draft.lastModified = new Date().toISOString();
            draft.version = (draft.version || 0) + 1;
            await redis.set(draftKey, JSON.stringify(draft));
            await redis.expire(draftKey, 24 * 60 * 60);

            // Final progress update
            await socketIODriver.emitToUser(userId, 'insight-analysis-progress', {
                projectId,
                phase: 'complete',
                progress: 100,
                message: 'Insights generated successfully!'
            });

            await socketIODriver.emitToUser(userId, 'insight-complete', {
                projectId,
                insights,
                sampling_info: samplingInfo
            });

            return {
                success: true,
                insights,
                conversationId: session.conversationId
            };

        } catch (error: any) {
            console.error('Error generating insights:', error);
            
            // Determine user-friendly error message
            let userMessage = 'Unable to generate insights at this time. Please try again later.';
            
            if (error.message?.includes('connect to AI service') || error.message?.includes('internet connection')) {
                userMessage = error.message;
            } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                userMessage = 'AI service is currently busy. Please try again in a few moments.';
            } else if (error.message?.includes('timeout')) {
                userMessage = 'Request timed out. Please try again with fewer data sources or a smaller dataset.';
            } else if (error.message?.includes('configuration error')) {
                userMessage = 'Service configuration issue. Please contact support.';
            } else if (error.message?.includes('data source')) {
                userMessage = 'Unable to access your data sources. Please check your connections and try again.';
            }
            
            // Emit error event via Socket.IO
            try {
                const socketIODriver = SocketIODriver.getInstance();
                await socketIODriver.emitToUser(userId, 'insight-error', {
                    projectId,
                    error: userMessage,
                    timestamp: new Date().toISOString()
                });
            } catch (socketError) {
                console.error('Failed to emit Socket.IO error event:', socketError);
            }
            
            return {
                success: false,
                error: userMessage
            };
        }
    }

    /**
     * Ask a follow-up question
     */
    public async askFollowUp(
        projectId: number,
        message: string,
        userId: number
    ): Promise<FollowUpResponse> {
        try {
            // Get session
            const session = await this.redisSessionService.getSession(
                projectId,
                userId,
                'insights'
            );

            if (!session) {
                return {
                    success: false,
                    error: 'No active session found'
                };
            }

            // Get schema context and re-initialize if needed
            const redis = this.redisSessionService['redis'];
            const contextKey = `schema_context:insights:${projectId}:${userId}`;
            const schemaContext = await redis.get(contextKey);

            if (schemaContext) {
                // Re-initialize Gemini conversation with conversational prompt for follow-ups
                await this.geminiService.initializeConversation(
                    session.conversationId,
                    schemaContext,
                    AI_INSIGHTS_FOLLOWUP_PROMPT
                );
            }

            // Send message to Gemini
            const response = await this.geminiService.sendMessage(
                session.conversationId,
                message
            );

            // Save messages to Redis
            await this.redisSessionService.addMessage(
                projectId,
                userId,
                'user',
                message,
                'insights'
            );

            await this.redisSessionService.addMessage(
                projectId,
                userId,
                'assistant',
                response,
                'insights'
            );

            return {
                success: true,
                message: response
            };

        } catch (error: any) {
            console.error('Error processing follow-up:', error);
            
            // Provide user-friendly error message
            let userMessage = 'Unable to process your question at this time.';
            
            if (error.message?.includes('connect to AI service') || error.message?.includes('internet connection')) {
                userMessage = error.message;
            } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                userMessage = error.message;
            } else if (error.message?.includes('timeout')) {
                userMessage = error.message;
            } else if (error.message?.includes('configuration error')) {
                userMessage = error.message;
            } else if (error.message?.includes('session')) {
                userMessage = 'Your session has expired. Please start a new analysis.';
            }
            
            return {
                success: false,
                error: userMessage
            };
        }
    }

    /**
     * Get active session for a project
     */
    public async getActiveSession(
        projectId: number,
        userId: number
    ): Promise<any> {
        try {
            const session = await this.redisSessionService.getSession(
                projectId,
                userId,
                'insights'
            );

            if (!session) {
                return { exists: false };
            }

            // Get messages
            const messages = await this.redisSessionService.getMessages(
                projectId,
                userId,
                'insights'
            );

            // Get draft
            const redis = this.redisSessionService['redis'];
            const draftKey = `insight_draft:insights:${projectId}:${userId}`;
            const draftData = await redis.get(draftKey);
            const draft = draftData ? JSON.parse(draftData) : null;

            return {
                exists: true,
                session,
                messages,
                draft
            };

        } catch (error: any) {
            console.error('Error getting active session:', error);
            return { exists: false, error: error.message };
        }
    }

    /**
     * Transform insights from AI format to display format
     * @param insights - Raw insights from AI
     * @returns Categorized insights
     */
    private transformInsightsForDisplay(insights: any): any {
        const transformed = {
            anomalies: [],
            trends: [],
            correlations: [],
            distributions: [],
            recommendations: [],
            business_insights: [],
            suggested_questions: insights.suggested_questions || []
        };

        // Handle array of insights with category field
        if (insights.insights && Array.isArray(insights.insights)) {
            insights.insights.forEach((item: any) => {
                const formattedItem = {
                    insight: `${item.title}: ${item.description}`,
                    confidence: item.confidence,
                    supporting_data: item.supporting_data,
                    actionability: item.actionability
                };
                
                switch (item.category) {
                    case 'anomaly':
                        transformed.anomalies.push(formattedItem);
                        break;
                    case 'trend':
                        transformed.trends.push(formattedItem);
                        break;
                    case 'correlation':
                        transformed.correlations.push(formattedItem);
                        break;
                    case 'distribution':
                        transformed.distributions.push(formattedItem);
                        break;
                    case 'recommendation':
                        transformed.recommendations.push(formattedItem);
                        break;
                }
            });
        }
        // Handle already categorized insights
        else if (insights.anomalies || insights.trends || insights.correlations || insights.distributions) {
            return insights;
        }

        return transformed;
    }

    /**
     * Cancel active session without saving
     */
    public async cancelSession(
        projectId: number,
        userId: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await this.redisSessionService.clearSession(projectId, userId, 'insights');
            await this.redisSessionService.clearMessages(projectId, userId, 'insights');
            
            const redis = this.redisSessionService['redis'];
            const draftKey = `insight_draft:insights:${projectId}:${userId}`;
            const contextKey = `schema_context:insights:${projectId}:${userId}`;
            
            await redis.del(draftKey);
            await redis.del(contextKey);

            return { success: true };

        } catch (error: any) {
            console.error('Error canceling session:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save insight report to database
     */
    public async saveInsightReport(
        projectId: number,
        userId: number,
        title?: string
    ): Promise<SaveReportResponse> {
        try {
            // Get session and draft
            const session = await this.redisSessionService.getSession(
                projectId,
                userId,
                'insights'
            );

            if (!session) {
                return {
                    success: false,
                    error: 'No active session found'
                };
            }

            const redis = this.redisSessionService['redis'];
            const draftKey = `insight_draft:insights:${projectId}:${userId}`;
            const draftData = await redis.get(draftKey);
            const draft = draftData ? JSON.parse(draftData) : null;

            if (!draft || !draft.insights) {
                return {
                    success: false,
                    error: 'No insights to save. Please generate insights first.'
                };
            }

            // Save to database
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;

            const report = new DRAAIInsightReport();
            report.title = title || `Insight Report - ${new Date().toLocaleDateString()}`;
            report.project_id = projectId;
            report.user_id = userId;
            report.data_source_ids = draft.dataSourceIds;
            
            // Transform insights to categorized structure for display
            const transformedInsights = this.transformInsightsForDisplay(draft.insights);
            
            // Add sampling info to transformed insights
            transformedInsights.sampling_info = draft.sampling_info;
            
            report.insights_summary = transformedInsights;
            
            report.status = 'saved';
            report.started_at = new Date(session.startedAt);
            report.saved_at = new Date();

            const savedReport = await manager.save(report);

            // Save messages
            const messages = await this.redisSessionService.getMessages(
                projectId,
                userId,
                'insights'
            );

            for (const msg of messages) {
                const message = new DRAAIInsightMessage();
                message.report_id = savedReport.id;
                message.role = msg.role;
                message.content = msg.content;
                message.metadata = { timestamp: msg.timestamp };
                await manager.save(message);
            }

            // Clear Redis session
            await this.cancelSession(projectId, userId);

            return {
                success: true,
                reportId: savedReport.id
            };

        } catch (error: any) {
            console.error('Error saving insight report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all insight reports for a project
     */
    public async getInsightReports(
        projectId: number,
        userId: number,
        page: number = 1,
        limit: number = 20
    ): Promise<{ reports: InsightReport[]; total: number; error?: string }> {
        try {
            // Validate project access
            const validation = await this.validateProjectAccess(projectId, userId);
            if (!validation.valid) {
                return { reports: [], total: 0, error: validation.error };
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;

            const [reports, total] = await manager.findAndCount(DRAAIInsightReport, {
                where: { project_id: projectId },
                order: { created_at: 'DESC' },
                skip: (page - 1) * limit,
                take: limit
            });

            return {
                reports: reports.map(r => ({
                    id: r.id,
                    title: r.title,
                    project_id: r.project_id,
                    data_source_ids: r.data_source_ids,
                    insights_summary: r.insights_summary,
                    status: r.status,
                    started_at: r.started_at,
                    saved_at: r.saved_at,
                    created_at: r.created_at
                })),
                total
            };

        } catch (error: any) {
            console.error('Error fetching insight reports:', error);
            return { reports: [], total: 0, error: error.message };
        }
    }

    /**
     * Get a specific insight report
     */
    public async getInsightReport(
        reportId: number,
        userId: number
    ): Promise<{ report?: any; messages?: any[]; error?: string }> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;

            const report = await manager.findOne(DRAAIInsightReport, {
                where: { id: reportId },
                relations: ['messages', 'project']
            });

            if (!report) {
                return { error: 'Report not found' };
            }

            // Validate access
            const validation = await this.validateProjectAccess(report.project_id, userId);
            if (!validation.valid) {
                return { error: validation.error };
            }

            return {
                report: {
                    id: report.id,
                    title: report.title,
                    project_id: report.project_id,
                    data_source_ids: report.data_source_ids,
                    insights_summary: report.insights_summary,
                    status: report.status,
                    started_at: report.started_at,
                    saved_at: report.saved_at,
                    created_at: report.created_at
                },
                messages: report.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    metadata: m.metadata,
                    created_at: m.created_at
                }))
            };

        } catch (error: any) {
            console.error('Error fetching insight report:', error);
            return { error: error.message };
        }
    }

    /**
     * Delete an insight report
     */
    public async deleteInsightReport(
        reportId: number,
        userId: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;

            const report = await manager.findOne(DRAAIInsightReport, {
                where: { id: reportId }
            });

            if (!report) {
                return { success: false, error: 'Report not found' };
            }

            // Validate access
            const validation = await this.validateProjectAccess(report.project_id, userId);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Delete report (messages cascade automatically)
            await manager.remove(report);

            return { success: true };

        } catch (error: any) {
            console.error('Error deleting insight report:', error);
            return { success: false, error: error.message };
        }
    }
}
