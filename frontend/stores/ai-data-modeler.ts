import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { IMessage, ISchemaSummary, ISchemaDetails } from '~/types/IAIDataModeler';
import type { IModelDraft } from '~/types/IModelDraft';
import { getAuthToken } from '~/composables/AuthToken';

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
        
        console.log('[AI Store] Opening drawer for data source:', dataSourceId);
        console.log('[AI Store] Data model ID for loading conversation:', dataModelId);
        // Set currentDataSourceId immediately for retry context
        // This ensures retry mechanism always has context even if initialization fails
        currentDataSourceId.value = dataSourceId;
        isCrossSource.value = false; // Clear cross-source flag for single-source mode
        console.log('[AI Store] isCrossSource set to false for single-source mode');
        console.log('[AI Store] currentDataSourceId set to:', currentDataSourceId.value);
        // If dataModelId is provided, try to load conversation from database first
        if (dataModelId) {
            const loaded = await loadSavedConversation(dataModelId);
            if (loaded) {
                console.log('[AI Store] Loaded conversation from database for data model:', dataModelId);
                // Initialize a new Redis/Gemini session for continued conversation
                console.log('[AI Store] Initializing new session after loading from database');
                await initializeConversation(dataSourceId);
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
        // Perform cleanup first if needed
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
        
        // Use nextTick to ensure all pending reactive updates complete before unmounting
        await nextTick();
        isDrawerOpen.value = false;
    }

    /**
     * Initialize or restore session from Redis
     */
    async function initializeConversation(dataSourceId: number) {
        // Guard: Don't initialize if drawer is already closed
        if (!isDrawerOpen.value) {
            console.log('[AI Store] Drawer closed, aborting initialization');
            return false;
        }
        
        isInitializing.value = true;
        error.value = null;
        currentDataSourceId.value = dataSourceId;
        
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/session/initialize`;
            
            // Use retry logic for API call
            const data = await retryWithBackoff(async () => {
                return await $fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    },
                    body: { dataSourceId: parseInt(String(dataSourceId)) }
                });
            });
            
            // Guard: Check if drawer is still open after async operation
            if (!isDrawerOpen.value) {
                console.log('[AI Store] Drawer closed during initialization, discarding results');
                return false;
            }
            
            console.log('[AI Store] Initialize response:', {
                source: data.source,
                conversationId: data.conversationId,
                messageCount: data.messages?.length || 0,
                inferredJoinCount: data.inferredJoinCount || 0,
                messages: data.messages
            });
            
            conversationId.value = data.conversationId;
            sessionSource.value = data.source;
            modelDraft.value = data.modelDraft;
            
            // Store inferred joins if provided by backend
            // CRITICAL: Only set if preloadedSuggestions is empty to avoid overwriting the full AI-powered preload
            if (data.inferredJoins && Array.isArray(data.inferredJoins)) {
                // If preloadedSuggestions already has data from the builder's preload (with AI), keep it
                if (preloadedSuggestions.value.length === 0) {
                    preloadedSuggestions.value = data.inferredJoins;
                    suggestionsLoadedForDataSource.value = `${dataSourceId}:session`;
                    console.log('[AI Store] Loaded', data.inferredJoins.length, 'inferred joins from session');
                    console.log('[AI Store] Inferred joins detail:', data.inferredJoins.map(j => 
                        `${j.left_schema}.${j.left_table}.${j.left_column} → ${j.right_schema}.${j.right_table}.${j.right_column}`
                    ));
                    
                    // Sync to localStorage
                    if (import.meta.client) {
                        localStorage.setItem(
                            `join-suggestions:${dataSourceId}`,
                            JSON.stringify(data.inferredJoins)
                        );
                    }
                }
            }
            
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
            // Only set error if drawer is still open
            if (isDrawerOpen.value) {
                error.value = err instanceof Error ? err.message : 'Failed to initialize session';
            }
            console.error('Error initializing session:', err);
            return false;
        } finally {
            // ALWAYS clear isInitializing flag to prevent stuck state
            // Even if drawer was closed, we need to reset loading state
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
        // Guard: Don't initialize if drawer is already closed
        if (!isDrawerOpen.value) {
            console.log('[AI Store] Drawer closed, aborting cross-source initialization');
            return false;
        }
        
        isInitializing.value = true;
        error.value = null;
        
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/session/initialize-cross-source`;
            
            // Use retry logic for API call
            const data = await retryWithBackoff(async () => {
                return await $fetch(url, {
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
            });
            
            // Guard: Check if drawer is still open after async operation
            if (!isDrawerOpen.value) {
                console.log('[AI Store] Drawer closed during cross-source initialization, discarding results');
                return false;
            }
            
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
            // Only set error if drawer is still open
            if (isDrawerOpen.value) {
                error.value = err instanceof Error ? err.message : 'Failed to initialize cross-source session';
            }
            console.error('Error initializing cross-source session:', err);
            return false;
        } finally {
            // ALWAYS clear isInitializing flag to prevent stuck state
            // Even if drawer was closed, we need to reset loading state
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
        console.log('[AI Store - sendMessage] Current session context:', currentDataSourceId.value, isCrossSource.value);
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
        console.log('[AI Store] loadSavedConversation called for data model ID:', dataModelId);
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
            console.log('[AI Store] Conversation data:', conversation);

            console.log('[AI Store] Loaded conversation from database:', {
                conversationId: conversation.id,
                messageCount: conversation.messages?.length || 0,
                dataSourceId: conversation.data_source?.id,
                dataModelId: conversation.data_model?.id,
                isCrossSource: conversation.data_model?.is_cross_source
            });

            conversationId.value = conversation.id.toString();
            sessionSource.value = 'database';

            // Check if this is a cross-source data model
            const modelIsCrossSource = conversation.data_model?.is_cross_source || false;
            
            if (modelIsCrossSource) {
                // For cross-source models, set cross-source context
                // The project_id and data sources should be available from the data model
                isCrossSource.value = true;
                projectId.value = conversation.data_model?.project_id || null;
                
                // Note: Data sources list should be loaded by the calling component
                // and passed when opening the drawer in cross-source mode
                console.log('[AI Store] Loaded cross-source conversation:', {
                    projectId: projectId.value,
                    note: 'Data sources should be provided by calling component'
                });
            } else {
                // Single-source model
                currentDataSourceId.value = conversation.data_source?.id;
                isCrossSource.value = false;
            }
            console.log('[AI Store] currentDataSourceId set to:', currentDataSourceId.value);

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

    /**
     * Retry helper with exponential backoff for rate limit errors
     * @param fn Async function to retry
     * @param maxRetries Maximum number of retries (default: 3)
     * @param initialDelay Initial delay in ms (default: 2000)
     */
    async function retryWithBackoff<T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        initialDelay: number = 2000
    ): Promise<T> {
        let lastError: any;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err: any) {
                lastError = err;
                
                // Check if it's a rate limit error (429)
                const isRateLimitError = 
                    err.statusCode === 429 || 
                    err.status === 429 || 
                    (err.message && err.message.includes('429')) ||
                    (err.message && err.message.toLowerCase().includes('too many requests'));
                
                // Don't retry if it's not a rate limit error or we're out of retries
                if (!isRateLimitError || attempt === maxRetries) {
                    throw err;
                }
                
                // Calculate exponential backoff delay
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`[AI Store] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    // ============================================
    // SUGGESTED JOINS STATE & ACTIONS (Issue #270)
    // ============================================

    // State for AI-suggested JOIN relationships
    const suggestedJoins = ref<any[]>([]);
    const appliedSuggestions = ref<Set<string>>(new Set());
    const dismissedSuggestions = ref<Set<string>>(new Set());
    const loadingSuggestions = ref(false);
    
    // Preloading state
    const preloadedSuggestions = ref<any[]>([]);
    const suggestionsLoadedForDataSource = ref<string | null>(null);
    const isPreloading = ref(false);
    const preloadError = ref<string | null>(null);

    /**
     * Fetch suggested joins from backend API
     * @param dataSourceId Data source ID to analyze
     * @param tableNames Optional array of table names to filter suggestions (only analyze selected tables)
     * @param useAI Whether to use AI-powered suggestions (Pro/Enterprise tier)
     */
    async function fetchSuggestedJoins(dataSourceId: number, tableNames?: string[], useAI: boolean = false) {
        loadingSuggestions.value = true;
        
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[AI Store] No auth token available, skipping suggested joins fetch');
                return;
            }

            // Build URL with optional table filter and AI flag
            let url = `${baseUrl()}/ai-data-modeler/suggested-joins/${dataSourceId}`;
            const queryParams: string[] = [];
            
            if (tableNames && tableNames.length > 0) {
                const tableQuery = tableNames.join(',');
                queryParams.push(`tables=${encodeURIComponent(tableQuery)}`);
                console.log(`[AI Store] Fetching suggestions for selected tables: ${tableQuery}`);
            }
            
            if (useAI) {
                queryParams.push('useAI=true');
                console.log('[AI Store] AI-powered suggestions ENABLED');
            }
            
            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await $fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                credentials: 'include'
            });

            if (response && response.success) {
                suggestedJoins.value = response.data || [];
                console.log(`[AI Store] Fetched ${suggestedJoins.value.length} suggested joins (AI: ${useAI ? 'YES' : 'NO'})`);
                console.log('[AI Store] Suggested joins data:', JSON.stringify(response.data, null, 2));

                // Sync to localStorage
                if (import.meta.client) {
                    localStorage.setItem(
                        `suggested-joins-${dataSourceId}`,
                        JSON.stringify(response.data)
                    );
                }
            } else {
                console.warn('[AI Store] No success in response:', response);
            }
        } catch (error) {
            console.error('[AI Store] Error fetching suggested joins:', error);
        } finally {
            loadingSuggestions.value = false;
        }
    }

    /**
     * Preload all join suggestions for a data source (on page load)
     * Uses loadAll=true to fetch all possible joins without column selection
     * @param dataSourceId Data source ID to analyze
     * @param useAI Whether to use AI-powered suggestions
     */
    async function preloadSuggestionsForDataSource(dataSourceId: number, useAI: boolean = false) {
        const cacheKey = `${dataSourceId}:${useAI}`;
        
        // Check if already loaded
        if (suggestionsLoadedForDataSource.value === cacheKey) {
            console.log('[AI Store] Suggestions already loaded for', cacheKey);
            return preloadedSuggestions.value;
        }

        // Try loading from localStorage first (instant feedback)
        if (import.meta.client) {
            const localCacheKey = `join-suggestions:${dataSourceId}`;
            const cached = localStorage.getItem(localCacheKey);
            
            if (cached) {
                try {
                    const suggestions = JSON.parse(cached);
                    preloadedSuggestions.value = suggestions;
                    suggestionsLoadedForDataSource.value = cacheKey;
                    console.log('[AI Store] Loaded', suggestions.length, 'suggestions from localStorage (instant)');
                    
                    // Still fetch from server in background to update cache
                    fetchPreloadedSuggestions(dataSourceId, useAI, localCacheKey);
                    return suggestions;
                } catch (e) {
                    console.warn('[AI Store] Failed to parse cached suggestions');
                }
            }
        }

        // No cache, fetch from server
        return await fetchPreloadedSuggestions(dataSourceId, useAI, `join-suggestions:${dataSourceId}`);
    }

    /**
     * Helper function to fetch preloaded suggestions from backend
     */
    async function fetchPreloadedSuggestions(dataSourceId: number, useAI: boolean, cacheKey: string) {
        isPreloading.value = true;
        preloadError.value = null;

        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[AI Store] No auth token available');
                return [];
            }

            const config = useRuntimeConfig();
            const url = `${config.public.apiBase}/ai-data-modeler/suggested-joins/${dataSourceId}?loadAll=true${useAI ? '&useAI=true' : ''}`;
            
            console.log('[AI Store] Preloading suggestions from:', url);

            const response = await $fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                credentials: 'include'
            });

            if (response && response.success) {
                preloadedSuggestions.value = response.data || [];
                suggestionsLoadedForDataSource.value = `${dataSourceId}:${useAI}`;
                
                // Sync to localStorage
                if (import.meta.client) {
                    localStorage.setItem(cacheKey, JSON.stringify(preloadedSuggestions.value));
                }

                console.log('[AI Store] Preloaded', preloadedSuggestions.value.length, 'suggestions');
                return preloadedSuggestions.value;
            } else {
                console.warn('[AI Store] Preload failed:', response);
                return [];
            }
        } catch (error) {
            console.error('[AI Store] Failed to preload suggestions:', error);
            preloadError.value = error instanceof Error ? error.message : 'Unknown error';
            return [];
        } finally {
            isPreloading.value = false;
        }
    }

    /**
     * Mark a suggestion as applied
     * @param suggestionId Unique ID of the suggestion
     */
    function applySuggestion(suggestionId: string) {
        appliedSuggestions.value.add(suggestionId);

        if (import.meta.client) {
            localStorage.setItem(
                'applied-suggestions',
                JSON.stringify(Array.from(appliedSuggestions.value))
            );
        }
    }

    /**
     * Mark a suggestion as dismissed
     * @param suggestionId Unique ID of the suggestion
     */
    function dismissSuggestion(suggestionId: string) {
        dismissedSuggestions.value.add(suggestionId);

        if (import.meta.client) {
            localStorage.setItem(
                'dismissed-suggestions',
                JSON.stringify(Array.from(dismissedSuggestions.value))
            );
        }
    }

    /**
     * Preload cross-source join suggestions for a project
     * @param projectId Project ID containing multiple data sources
     * @param useAI Whether to use AI-powered suggestions
     */
    async function preloadCrossSourceSuggestions(projectId: number, useAI: boolean = false) {
        const cacheKey = `cross-source:${projectId}:${useAI}`;
        
        // Check if already loaded
        if (suggestionsLoadedForDataSource.value === cacheKey) {
            console.log('[AI Store] Cross-source suggestions already loaded for', cacheKey);
            return preloadedSuggestions.value;
        }

        // Try loading from localStorage first (instant feedback)
        if (import.meta.client) {
            const localCacheKey = `join-suggestions:cross-source:${projectId}`;
            const cached = localStorage.getItem(localCacheKey);
            
            if (cached) {
                try {
                    const suggestions = JSON.parse(cached);
                    preloadedSuggestions.value = suggestions;
                    suggestionsLoadedForDataSource.value = cacheKey;
                    console.log('[AI Store] Loaded', suggestions.length, 'cross-source suggestions from localStorage (instant)');
                    
                    // Still fetch from server in background to update cache
                    fetchCrossSourceSuggestions(projectId, useAI, localCacheKey);
                    return suggestions;
                } catch (e) {
                    console.warn('[AI Store] Failed to parse cached cross-source suggestions');
                }
            }
        }

        // No cache, fetch from server
        return await fetchCrossSourceSuggestions(projectId, useAI, `join-suggestions:cross-source:${projectId}`);
    }

    /**
     * Helper function to fetch cross-source suggestions from backend
     */
    async function fetchCrossSourceSuggestions(projectId: number, useAI: boolean, cacheKey: string) {
        isPreloading.value = true;
        preloadError.value = null;

        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[AI Store] No auth token available');
                return [];
            }

            const config = useRuntimeConfig();
            const url = `${config.public.apiBase}/ai-data-modeler/suggested-joins/cross-source/${projectId}${useAI ? '?useAI=true' : ''}`;
            
            console.log('[AI Store] Preloading cross-source suggestions from:', url);

            const response = await $fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                credentials: 'include'
            });

            if (response && response.success) {
                preloadedSuggestions.value = response.data || [];
                suggestionsLoadedForDataSource.value = `cross-source:${projectId}:${useAI}`;
                
                // Sync to localStorage
                if (import.meta.client) {
                    localStorage.setItem(cacheKey, JSON.stringify(preloadedSuggestions.value));
                }

                console.log('[AI Store] Preloaded', preloadedSuggestions.value.length, 'cross-source suggestions');
                return preloadedSuggestions.value;
            } else {
                console.warn('[AI Store] Cross-source preload failed:', response);
                return [];
            }
        } catch (error) {
            console.error('[AI Store] Failed to preload cross-source suggestions:', error);
            preloadError.value = error instanceof Error ? error.message : 'Unknown error';
            return [];
        } finally {
            isPreloading.value = false;
        }
    }

    /**
     * Clear all suggestions and reset state
     */
    function clearSuggestions() {
        suggestedJoins.value = [];
        appliedSuggestions.value.clear();
        dismissedSuggestions.value.clear();
    }

    // Computed properties for filtering suggestions
    const visibleSuggestions = computed(() => {
        return suggestedJoins.value.filter(s => !dismissedSuggestions.value.has(s.id));
    });

    const highConfidenceSuggestions = computed(() => {
        return visibleSuggestions.value.filter(s => s.confidence === 'high');
    });

    const mediumConfidenceSuggestions = computed(() => {
        return visibleSuggestions.value.filter(s => s.confidence === 'medium');
    });

    const lowConfidenceSuggestions = computed(() => {
        return visibleSuggestions.value.filter(s => s.confidence === 'low');
    });

    /**
     * Filter preloaded suggestions to show only those relevant to currently selected tables
     * This provides dynamic filtering as user selects columns
     */
    const relevantSuggestions = computed(() => {
        // If no model draft or columns, return all preloaded suggestions
        if (!modelDraft.value?.columns || modelDraft.value.columns.length === 0) {
            return preloadedSuggestions.value;
        }

        // Get unique table keys from selected columns
        const selectedTables = new Set<string>();
        modelDraft.value.columns.forEach((col: any) => {
            selectedTables.add(`${col.schema}.${col.table_name}`);
        });

        // Filter to suggestions where both tables are in the selection
        return preloadedSuggestions.value.filter(suggestion => {
            const leftKey = `${suggestion.left_schema}.${suggestion.left_table}`;
            const rightKey = `${suggestion.right_schema}.${suggestion.right_table}`;
            return selectedTables.has(leftKey) && selectedTables.has(rightKey);
        });
    });

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

        // Suggested Joins State (Issue #270)
        suggestedJoins,
        appliedSuggestions,
        dismissedSuggestions,
        loadingSuggestions,
        visibleSuggestions,
        highConfidenceSuggestions,
        mediumConfidenceSuggestions,
        lowConfidenceSuggestions,
        
        // Preloading State
        preloadedSuggestions,
        suggestionsLoadedForDataSource,
        isPreloading,
        preloadError,
        relevantSuggestions,

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
        generateMessageId,

        // Suggested Joins Actions (Issue #270)
        fetchSuggestedJoins,
        preloadSuggestionsForDataSource,
        preloadCrossSourceSuggestions,
        applySuggestion,
        dismissSuggestion,
        clearSuggestions
    };
});
