import { defineStore } from 'pinia';
import type { IMessage, ISchemaSummary } from '~/types/IAIDataModeler';

interface ModelDraft {
    tables: any;
    relationships: any[];
    indexes: any[];
    lastModified: string;
    version: number;
}

export const useAIDataModelerStore = defineStore('aiDataModelerDRA', () => {
    const isDrawerOpen = ref(false);
    const conversationId = ref<string | null>(null);
    const messages = ref<IMessage[]>([]);
    const isLoading = ref(false);
    const isInitializing = ref(false);
    const schemaSummary = ref<ISchemaSummary | null>(null);
    const error = ref<string | null>(null);
    const currentDataSourceId = ref<number | null>(null);
    const modelDraft = ref<ModelDraft | null>(null);
    const sessionSource = ref<'redis' | 'database' | 'new'>('new');
    const isDirty = ref(false);
    const isRestored = ref(false);

    /**
     * Open the AI drawer and initialize conversation
     */
    async function openDrawer(dataSourceId: number) {
        isDrawerOpen.value = true;
        error.value = null;
        
        // Initialize conversation with the data source
        await initializeConversation(dataSourceId);
    }

    /**
     * Close the AI drawer and optionally cleanup conversation
     */
    async function closeDrawer(cleanup: boolean = false) {
        isDrawerOpen.value = false;
        
        if (cleanup && currentDataSourceId.value) {
            try {
                await cancelSession();
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
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify({ dataSourceId: parseInt(String(dataSourceId)) })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to initialize session');
            }

            const data = await response.json();
            conversationId.value = data.conversationId;
            sessionSource.value = data.source;
            modelDraft.value = data.modelDraft;
            
            if (data.source === 'redis') {
                // Restored from Redis
                messages.value = data.messages.map((msg: any) => ({
                    id: generateMessageId(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp)
                }));
                isRestored.value = true;
            } else {
                // New session
                schemaSummary.value = data.schemaSummary;
                messages.value = [
                    {
                        id: generateMessageId(),
                        role: 'assistant',
                        content: `Welcome! I've analyzed your database schema with **${data.schemaSummary.tableCount} tables** and **${data.schemaSummary.totalColumns} columns**.\n\nI can help you:\n• Identify analytical bottlenecks in your current schema\n• Propose optimized data models (Star Schema, OBT, etc.)\n• Suggest SQL implementation strategies\n• Recommend indexing for better query performance\n\nWhat would you like to analyze?`,
                        timestamp: new Date()
                    }
                ];
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
     * Send a message to the AI (saves to Redis)
     */
    async function sendMessage(message: string) {
        if (!currentDataSourceId.value) {
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

            const url = `${baseUrl()}/ai-data-modeler/session/chat`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify({
                    dataSourceId: currentDataSourceId.value,
                    message: message.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            const data = await response.json();

            // Add AI response
            const aiMessage: IMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: data.assistantMessage.content,
                timestamp: new Date(data.assistantMessage.timestamp)
            };
            messages.value.push(aiMessage);

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
    async function updateModelDraft(modelState: Partial<ModelDraft>) {
        if (!currentDataSourceId.value) {
            return false;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                return false;
            }

            const url = `${baseUrl()}/ai-data-modeler/session/model-draft`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify({
                    dataSourceId: currentDataSourceId.value,
                    modelState
                })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            modelDraft.value = {
                ...modelState,
                lastModified: data.lastModified,
                version: data.version
            } as ModelDraft;

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
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify({
                    dataSourceId: currentDataSourceId.value,
                    dataModelId,
                    title
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save conversation');
            }

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
            await fetch(url, {
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
                throw new Error('Authentication required');
            }

            const url = `${baseUrl()}/ai-data-modeler/conversations/${dataModelId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load conversation');
            }

            const data = await response.json();
            const conversation = data.conversation;

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
            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load conversation';
            console.error('Error loading conversation:', err);
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
        error,
        currentDataSourceId,
        modelDraft,
        sessionSource,
        isDirty,
        isRestored,

        // Actions
        openDrawer,
        closeDrawer,
        initializeConversation,
        sendMessage,
        updateModelDraft,
        saveConversation,
        cancelSession,
        loadSavedConversation,
        resetState,
        clearError
    };
});
