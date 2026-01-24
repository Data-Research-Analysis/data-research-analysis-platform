import { defineStore } from 'pinia';
import type { IMessage, ISchemaSummary, ISchemaDetails } from '~/types/IAIDataModeler';
import type { IModelDraft } from '~/types/IModelDraft';

export const useAIDataModelerStore = defineStore('aiDataModelerDRA', () => {
    const isDrawerOpen = ref(false);
    const conversationId = ref<string | null>(null);
    const messages = ref<IMessage[]>([]);
    const isLoading = ref(false);
    const isInitializing = ref(false);
    const schemaSummary = ref<ISchemaSummary | null>(null);
    const schemaDetails = ref<ISchemaDetails | null>(null);
    const error = ref<string | null>(null);
    const currentDataSourceId = ref<number | null>(null);
    const modelDraft = ref<IModelDraft | null>(null);
    const sessionSource = ref<'redis' | 'database' | 'new'>('new');
    const isDirty = ref(false);
    const isRestored = ref(false);
    const applyTrigger = ref(0);
    const modelHistory = ref<Array<{ model: IModelDraft; timestamp: string; messageId: string }>>([]);
    const currentHistoryIndex = ref(-1);
    
    // Cross-source properties
    const isCrossSource = ref(false);
    const projectId = ref<number | null>(null);
    const dataSources = ref<Array<{ id: number; name: string; type: string }>>([]);

    /**
     * Open the AI drawer and initialize conversation
     */
    async function openDrawer(dataSourceId: number, dataModelId?: number) {
        isDrawerOpen.value = true;
        error.value = null;
        
        // If dataModelId is provided, try to load conversation from database first
        if (dataModelId) {
            const loaded = await loadSavedConversation(dataModelId);
            if (loaded) {
                console.log('[AI Store] Loaded conversation from database for data model:', dataModelId);
                return;
            }
            // If loading failed, fall through to initialize new session
            console.log('[AI Store] No conversation found for data model, initializing new session');
        }
        
        // Initialize conversation with the data source (new or Redis session)
        await initializeConversation(dataSourceId);
    }

    /**
     * Open the AI drawer for cross-source mode
     */
    async function openDrawerCrossSource(
        projectIdValue: number, 
        dataSourcesArray: Array<{ id: number; name: string; type: string }>,
        dataModelId?: number
    ) {
        isDrawerOpen.value = true;
        error.value = null;
        isCrossSource.value = true;
        projectId.value = projectIdValue;
        dataSources.value = dataSourcesArray;
        
        console.log('[AI Store] Opening cross-source drawer:', {
            projectId: projectIdValue,
            dataSourceCount: dataSourcesArray.length,
            dataSources: dataSourcesArray
        });
        
        // If dataModelId is provided, try to load conversation from database first
        if (dataModelId) {
            const loaded = await loadSavedConversation(dataModelId);
            if (loaded) {
                console.log('[AI Store] Loaded conversation from database for data model:', dataModelId);
                return;
            }
            console.log('[AI Store] No conversation found for data model, initializing new session');
        }
        
        // Initialize cross-source conversation
        await initializeCrossSourceConversation(projectIdValue, dataSourcesArray);
    }

    /**
     * Close the AI drawer and optionally cleanup conversation
     */
    async function closeDrawer(cleanup: boolean = false) {
        isDrawerOpen.value = false;
        
        if (cleanup && currentDataSourceId.value) {
            try {
                await cancelSession();
                // Clear history when cleaning up
                modelHistory.value = [];
                currentHistoryIndex.value = -1;
            } catch (err) {
                console.error('Error cancelling session:', err);
            }
        }
    }

    /**
     * Initialize or restore session from Redis
     */
    async function initializeConversation(dataSourceId: number) {
        isInitializing.value = true;
        error.value = null;
        currentDataSourceId.value = dataSourceId;
        
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/session/initialize`;
            const data = await $fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: { dataSourceId: parseInt(String(dataSourceId)) }
            });
            
            console.log('[AI Store] Initialize response:', {
                source: data.source,
                conversationId: data.conversationId,
                messageCount: data.messages?.length || 0,
                messages: data.messages
            });
            
            conversationId.value = data.conversationId;
            sessionSource.value = data.source;
            modelDraft.value = data.modelDraft;
            
            // Store schema details for pattern detection
            if (data.schemaDetails) {
                schemaDetails.value = data.schemaDetails;
            }
            
            if (data.source === 'redis') {
                // Restored from Redis
                messages.value = data.messages.map((msg: any) => ({
                    id: generateMessageId(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp)
                }));
                
                // Also store schemaSummary for Redis restored sessions
                if (data.schemaSummary) {
                    schemaSummary.value = data.schemaSummary;
                }
                
                isRestored.value = true;
            } else {
                // New session - messages already include initial welcome from backend
                schemaSummary.value = data.schemaSummary;
                messages.value = data.messages.map((msg: any) => ({
                    id: generateMessageId(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp)
                }));
                isRestored.value = false;
            }

            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to initialize session';
            console.error('Error initializing session:', err);
            return false;
        } finally {
            isInitializing.value = false;
        }
    }

    /**
     * Initialize cross-source conversation
     */
    async function initializeCrossSourceConversation(
        projectIdValue: number,
        dataSourcesArray: Array<{ id: number; name: string; type: string }>
    ) {
        isInitializing.value = true;
        error.value = null;
        
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/session/initialize-cross-source`;
            const data = await $fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: { 
                    projectId: projectIdValue,
                    dataSources: dataSourcesArray 
                }
            });
            
            console.log('[AI Store] Initialize cross-source response:', {
                conversationId: data.conversationId,
                messageCount: data.messages?.length || 0
            });
            
            conversationId.value = data.conversationId;
            sessionSource.value = 'new';
            schemaSummary.value = data.schemaSummary;
            
            messages.value = data.messages.map((msg: any) => ({
                id: generateMessageId(),
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            
            isRestored.value = false;
            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to initialize cross-source session';
            console.error('Error initializing cross-source session:', err);
            return false;
        } finally {
            isInitializing.value = false;
        }
    }

    /**
     * Send a message to the AI (saves to Redis)
     * @param message User message
     * @param options Optional parameters like isTemplate flag
     */
    async function sendMessage(message: string, options?: { isTemplate?: boolean }) {
        // Check if we have an active session (either single-source or cross-source)
        if (!currentDataSourceId.value && !isCrossSource.value) {
            error.value = 'No active session';
            return false;
        }

        if (!message.trim()) {
            return false;
        }

        isLoading.value = true;
        error.value = null;

        // Add user message immediately
        const userMessage: IMessage = {
            id: generateMessageId(),
            role: 'user',
            content: message.trim(),
            timestamp: new Date()
        };
        messages.value.push(userMessage);

        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            // For cross-source, use conversationId directly instead of dataSourceId
            const url = `${baseUrl()}/ai-data-modeler/session/chat`;
            const requestBody: any = {
                message: message.trim(),
                isTemplate: options?.isTemplate || false  // Pass template mode flag to backend
            };

            if (isCrossSource.value) {
                // Cross-source mode: send conversationId
                requestBody.conversationId = conversationId.value;
                requestBody.isCrossSource = true;
            } else {
                // Single-source mode: send dataSourceId
                requestBody.dataSourceId = currentDataSourceId.value;
            }

            const data = await $fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: requestBody
            });

            // Add AI response
            const aiMessage: IMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: data.assistantMessage.content,
                timestamp: new Date(data.assistantMessage.timestamp)
            };
            messages.value.push(aiMessage);

            // Check if AI generated a data model
            console.log('[AI Store - sendMessage] Checking for dataModel in response:', {
                hasDataModel: !!data.dataModel,
                dataModel: data.dataModel
            });
            
            if (data.dataModel) {
                console.log('[AI Store] AI generated a data model:', data.dataModel);
                // Wrap single dataModel in array if not already an array
                const tablesArray = Array.isArray(data.dataModel) ? data.dataModel : [data.dataModel];
                const newModelDraft = {
                    tables: tablesArray,
                    relationships: [],
                    indexes: [],
                    lastModified: new Date().toISOString(),
                    version: 1
                };
                console.log('[AI Store] Setting modelDraft.value to:', newModelDraft);
                modelDraft.value = newModelDraft;
                console.log('[AI Store] modelDraft.value is now:', modelDraft.value);
                
                // Add to history
                addModelToHistory(newModelDraft, aiMessage.id);
                console.log('[AI Store] Added to history. History length:', modelHistory.value.length);
                
                // Save to Redis - pass the full modelDraft structure, not just data.dataModel
                await updateModelDraft(newModelDraft);
            } else {
                console.warn('[AI Store] No dataModel in response. Response structure:', data);
            }

            isDirty.value = true;
            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to send message';
            console.error('Error sending message:', err);
            
            // Remove the user message if sending failed
            messages.value.pop();
            
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Update model draft in Redis
     */
    async function updateModelDraft(modelState: Partial<IModelDraft>) {
        if (!currentDataSourceId.value) {
            return false;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                return false;
            }

            const url = `${baseUrl()}/ai-data-modeler/session/model-draft`;
            const data = await $fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: {
                    dataSourceId: currentDataSourceId.value,
                    modelState
                }
            });

            modelDraft.value = {
                ...modelState,
                lastModified: data.lastModified,
                version: data.version
            } as IModelDraft;

            isDirty.value = true;
            return true;
        } catch (err) {
            console.error('Error updating model draft:', err);
            return false;
        }
    }

    /**
     * Save conversation to database and clear Redis
     */
    async function saveConversation(dataModelId: number, title: string) {
        if (!currentDataSourceId.value) {
            error.value = 'No active session';
            return false;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/session/save`;
            await $fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: {
                    dataSourceId: currentDataSourceId.value,
                    dataModelId,
                    title
                }
            });

            // Clear local state
            isDirty.value = false;
            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to save conversation';
            console.error('Error saving conversation:', err);
            return false;
        }
    }

    /**
     * Cancel session and clear Redis
     */
    async function cancelSession() {
        if (!currentDataSourceId.value) {
            return;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                return;
            }

            const url = `${baseUrl()}/ai-data-modeler/session/${currentDataSourceId.value}`;
            await $fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });
        } catch (err) {
            console.error('Error cancelling session:', err);
        } finally {
            // Reset state
            resetState();
        }
    }

    /**
     * Load saved conversation from database
     */
    async function loadSavedConversation(dataModelId: number) {
        isInitializing.value = true;
        error.value = null;

        try {
            const token = getAuthToken();
            if (!token) {
                console.log('[AI Store] No auth token, cannot load conversation');
                throw new Error('Authentication required');
            }

            console.log('[AI Store] Attempting to load conversation for data model:', dataModelId);

            const url = `${baseUrl()}/ai-data-modeler/conversations/${dataModelId}`;
            const data = await $fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            }) as any;

            console.log('[AI Store] Load conversation response successful');
            const conversation = data.conversation;

            console.log('[AI Store] Loaded conversation from database:', {
                conversationId: conversation.id,
                messageCount: conversation.messages?.length || 0,
                dataSourceId: conversation.data_source_id
            });

            conversationId.value = conversation.id.toString();
            currentDataSourceId.value = conversation.data_source_id;
            sessionSource.value = 'database';

            messages.value = conversation.messages.map((msg: any) => ({
                id: generateMessageId(),
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.created_at)
            }));

            isRestored.value = true;
            isDirty.value = false;
            return true;
        } catch (err: any) {
            console.error('[AI Store] Error loading conversation:', err);
            // Don't set error.value for 404s, just return false
            if (err.statusCode === 404) {
                console.log('[AI Store] No conversation found for data model:', dataModelId);
                return false;
            }
            if (err instanceof Error) {
                error.value = err.message;
            }
            return false;
        } finally {
            isInitializing.value = false;
        }
    }

    /**
     * Reset all state
     */
    function resetState() {
        conversationId.value = null;
        messages.value = [];
        schemaSummary.value = null;
        schemaDetails.value = null;
        currentDataSourceId.value = null;
        modelDraft.value = null;
        sessionSource.value = 'new';
        isDirty.value = false;
        isRestored.value = false;
    }

    /**
     * Clear error
     */
    function clearError() {
        error.value = null;
    }

    /**
     * Manually trigger application of model draft to builder
     */
    function applyModelToBuilder() {
        console.log('[AI Store - applyModelToBuilder] START');
        console.log('[AI Store] Current applyTrigger value:', applyTrigger.value);
        console.log('[AI Store] Current modelDraft:', modelDraft.value);
        applyTrigger.value++;
        console.log('[AI Store] New applyTrigger value:', applyTrigger.value);
        console.log('[AI Store - applyModelToBuilder] END');
    }

    /**
     * Add current model to history
     */
    function addModelToHistory(model: IModelDraft, messageId: string) {
        const historyEntry = {
            model: JSON.parse(JSON.stringify(model)), // Deep clone
            timestamp: new Date().toISOString(),
            messageId
        };
        
        // If we're not at the end of history, remove future entries
        if (currentHistoryIndex.value < modelHistory.value.length - 1) {
            modelHistory.value = modelHistory.value.slice(0, currentHistoryIndex.value + 1);
        }
        
        modelHistory.value.push(historyEntry);
        currentHistoryIndex.value = modelHistory.value.length - 1;
        
        // Keep only last 10 models to avoid memory issues
        if (modelHistory.value.length > 10) {
            modelHistory.value.shift();
            currentHistoryIndex.value--;
        }
        
        console.log('[AI Store] Model added to history. Total:', modelHistory.value.length);
    }

    /**
     * Revert to a previous model from history
     */
    function revertToHistoryModel(index: number) {
        if (index >= 0 && index < modelHistory.value.length) {
            const historyEntry = modelHistory.value[index];
            modelDraft.value = JSON.parse(JSON.stringify(historyEntry.model)); // Deep clone
            currentHistoryIndex.value = index;
            console.log('[AI Store] Reverted to model at index:', index);
        }
    }

    /**
     * Go back to previous model
     */
    function goToPreviousModel() {
        if (currentHistoryIndex.value > 0) {
            revertToHistoryModel(currentHistoryIndex.value - 1);
            return true;
        }
        return false;
    }

    /**
     * Go forward to next model
     */
    function goToNextModel() {
        if (currentHistoryIndex.value < modelHistory.value.length - 1) {
            revertToHistoryModel(currentHistoryIndex.value + 1);
            return true;
        }
        return false;
    }

    /**
     * Check if can go back
     */
    function canGoBack() {
        return currentHistoryIndex.value > 0;
    }

    /**
     * Check if can go forward
     */
    function canGoForward() {
        return currentHistoryIndex.value < modelHistory.value.length - 1;
    }

    /**
     * Generate a unique message ID
     */
    function generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    return {
        // State
        isDrawerOpen,
        conversationId,
        messages,
        isLoading,
        isInitializing,
        schemaSummary,
        schemaDetails,
        error,
        currentDataSourceId,
        modelDraft,
        sessionSource,
        isDirty,
        isRestored,
        applyTrigger,
        modelHistory,
        currentHistoryIndex,
        isCrossSource,
        projectId,
        dataSources,

        // Actions
        openDrawer,
        openDrawerCrossSource,
        closeDrawer,
        initializeConversation,
        initializeCrossSourceConversation,
        sendMessage,
        updateModelDraft,
        saveConversation,
        cancelSession,
        loadSavedConversation,
        resetState,
        clearError,
        applyModelToBuilder,
        addModelToHistory,
        revertToHistoryModel,
        goToPreviousModel,
        goToNextModel,
        canGoBack,
        canGoForward,
        generateMessageId
    };
});
