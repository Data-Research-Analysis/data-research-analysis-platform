import { defineStore } from 'pinia';
import { ref } from 'vue';

interface InsightSession {
    conversationId: string;
    projectId: number;
    dataSourceIds: number[];
    startedAt: string;
    lastActivityAt: string;
    status: 'draft' | 'saved' | 'archived';
}

interface InsightMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

interface InsightReport {
    id: number;
    title: string;
    project_id: number;
    data_source_ids: number[];
    insights_summary: any;
    status: string;
    started_at: string;
    saved_at: string | null;
    created_at: string;
}

interface GenerationProgress {
    phase: 'sampling' | 'computing_stats' | 'analyzing' | 'complete';
    progress: number;
    currentSource?: string;
    message: string;
}

export const useInsightsStore = defineStore('insights', () => {
    // State
    const activeSession = ref<InsightSession | null>(null);
    const reports = ref<InsightReport[]>([]);
    const selectedDataSourceIds = ref<number[]>([]);
    const messages = ref<InsightMessage[]>([]);
    const isGenerating = ref(false);
    const generationProgress = ref<GenerationProgress | null>(null);
    const currentInsights = ref<any>(null);
    const samplingInfo = ref<any>(null);
    const streamingResponse = ref('');
    const error = ref<string | null>(null);

    /**
     * Initialize Socket.IO listeners (client-only)
     */
    function initializeSocketListeners() {
        if (!import.meta.client) return;

        const nuxtApp = useNuxtApp();
        const socket = nuxtApp.$socketio;
        if (!socket) {
            console.warn('[Insights Store] Socket.IO not available');
            return;
        }

        console.log('[Insights Store] Initializing Socket.IO listeners');
        console.log('[Insights Store] Socket connected:', socket.connected);
        console.log('[Insights Store] Socket ID:', socket.id);

        // Test listener for ANY event
        socket.onAny((eventName: string, ...args: any[]) => {
            console.log(`[Insights Store] Socket.IO event received: ${eventName}`, args);
        });

        // Listen for progress updates
        socket.on('insight-analysis-progress', (data: any) => {
            console.log('[Insights Store] Received insight-analysis-progress:', data);
            generationProgress.value = {
                phase: data.phase,
                progress: data.progress,
                currentSource: data.currentSource,
                message: data.message
            };
        });

        // Listen for streaming chunks
        socket.on('insight-chunk', (data: any) => {
            console.log('[Insights Store] Received insight-chunk');
            streamingResponse.value += data.chunk;
        });

        // Listen for completion
        socket.on('insight-complete', (data: any) => {
            console.log('[Insights Store] Insights complete event received:', data);
            
            // Transform the insights structure to match template expectations
            const transformedInsights: any = {
                anomalies: [],
                trends: [],
                correlations: [],
                distributions: [],
                recommendations: []
            };
            
            // Access the insights array from data.insights.insights
            const insightsArray = data.insights?.insights;
            if (insightsArray && Array.isArray(insightsArray)) {
                insightsArray.forEach((item: any) => {
                    const formattedItem = {
                        insight: `${item.title}: ${item.description}`,
                        confidence: item.confidence,
                        supporting_data: item.supporting_data,
                        actionability: item.actionability
                    };
                    
                    switch (item.category) {
                        case 'anomaly':
                            transformedInsights.anomalies.push(formattedItem);
                            break;
                        case 'trend':
                            transformedInsights.trends.push(formattedItem);
                            break;
                        case 'correlation':
                            transformedInsights.correlations.push(formattedItem);
                            break;
                        case 'distribution':
                            transformedInsights.distributions.push(formattedItem);
                            break;
                        case 'recommendation':
                            transformedInsights.recommendations.push(formattedItem);
                            break;
                    }
                });
            }
            
            currentInsights.value = transformedInsights;
            
            // Store sampling info if provided
            if (data.sampling_info) {
                samplingInfo.value = data.sampling_info;
                if (import.meta.client) {
                    localStorage.setItem('insights_samplingInfo', JSON.stringify(data.sampling_info));
                }
            }
            
            // Load messages from backend session (includes AI-generated suggested questions)
            // Fire and forget - don't block the event handler
            loadSessionMessages(data.projectId).catch(err => {
                console.error('[Insights Store] Error loading session messages:', err);
            });
            
            // Save to localStorage
            if (import.meta.client) {
                localStorage.setItem('insights_currentInsights', JSON.stringify(currentInsights.value));
            }
            
            isGenerating.value = false;
            generationProgress.value = null;
        });

        // Listen for errors
        socket.on('insight-error', (data: any) => {
            console.error('[Insights Store] Socket error:', data.error);
            error.value = data.error;
            isGenerating.value = false;
            generationProgress.value = null;
        });
    }

    /**
     * Load messages from backend session
     */
    async function loadSessionMessages(projectId: number) {
        try {
            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/session/${projectId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (response.exists && response.messages) {
                messages.value = response.messages.map((msg: any) => ({
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp || new Date().toISOString()
                }));
                
                if (import.meta.client) {
                    localStorage.setItem('insights_messages', JSON.stringify(messages.value));
                }
            }
        } catch (error: any) {
            console.error('[Insights Store] Error loading session messages:', error);
        }
    }

    /**
     * Set selected data sources
     */
    function setSelectedDataSources(ids: number[]) {
        selectedDataSourceIds.value = ids;
        if (import.meta.client) {
            localStorage.setItem('insights_selectedDataSources', JSON.stringify(ids));
        }
    }

    /**
     * Initialize insights session
     */
    async function initializeSession(projectId: number, dataSourceIds: number[]) {
        try {
            error.value = null;
            isGenerating.value = true;
            generationProgress.value = {
                phase: 'sampling',
                progress: 0,
                message: 'Initializing session...'
            };

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/session/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    projectId,
                    dataSourceIds
                }
            });

            if (response.success) {
                activeSession.value = {
                    conversationId: response.conversationId,
                    projectId,
                    dataSourceIds,
                    startedAt: new Date().toISOString(),
                    lastActivityAt: new Date().toISOString(),
                    status: 'draft'
                };

                if (import.meta.client) {
                    localStorage.setItem('insights_activeSession', JSON.stringify(activeSession.value));
                }

                return { success: true };
            } else {
                error.value = response.error || 'Failed to initialize session';
                isGenerating.value = false;
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error initializing session:', err);
            error.value = err.message || 'Failed to initialize session';
            isGenerating.value = false;
            generationProgress.value = null;
            return { success: false, error: error.value };
        }
    }

    /**
     * Generate insights
     * Non-blocking - returns immediately and relies on Socket.IO events for progress
     */
    async function generateInsights(projectId: number) {
        try {
            error.value = null;
            isGenerating.value = true;
            streamingResponse.value = '';
            currentInsights.value = null;
            generationProgress.value = {
                phase: 'initializing',
                progress: 0,
                message: 'Starting insights generation...'
            };

            if (!activeSession.value?.conversationId) {
                error.value = 'No active session. Please initialize first.';
                isGenerating.value = false;
                generationProgress.value = null;
                return { success: false, error: error.value };
            }

            const token = getAuthToken();
            
            // Fire and forget - backend processes in background and emits Socket.IO events
            await $fetch(`${baseUrl()}/insights/session/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: { 
                    projectId,
                    conversationId: activeSession.value.conversationId
                }
            });

            // Return immediately - Socket.IO events will update state
            // The 'insight-complete' event handler will:
            // - Set currentInsights.value
            // - Set isGenerating.value = false
            // - Clear generationProgress.value
            return { success: true, status: 'processing' };

        } catch (err: any) {
            console.error('[Insights Store] Error starting insights generation:', err);
            error.value = err.message || 'Failed to start insights generation';
            isGenerating.value = false;
            generationProgress.value = null;
            return { success: false, error: error.value };
        }
    }

    /**
     * Ask a follow-up question
     */
    async function askFollowUp(projectId: number, message: string) {
        try {
            error.value = null;
            isGenerating.value = true;

            if (!activeSession.value?.conversationId) {
                error.value = 'No active session';
                isGenerating.value = false;
                return { success: false, error: error.value };
            }

            messages.value.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            });

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/session/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    projectId,
                    conversationId: activeSession.value.conversationId,
                    message
                }
            });

            if (response.success) {
                messages.value.push({
                    role: 'assistant',
                    content: response.message,
                    timestamp: new Date().toISOString()
                });

                if (import.meta.client) {
                    localStorage.setItem('insights_messages', JSON.stringify(messages.value));
                }

                isGenerating.value = false;
                return { success: true, message: response.message };
            } else {
                error.value = response.error || 'Failed to send message';
                isGenerating.value = false;
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error sending follow-up:', err);
            
            // Provide user-friendly error messages
            let userMessage = 'Unable to send your message. Please try again.';
            
            if (err.statusCode === 429 || err.message?.includes('rate limit')) {
                userMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (err.statusCode === 401 || err.statusCode === 403) {
                userMessage = 'Session expired. Please refresh the page and try again.';
            } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
                userMessage = 'Network error. Please check your connection and try again.';
            } else if (err.data?.error) {
                // Use the error message from the backend if available
                userMessage = err.data.error;
            }
            
            error.value = userMessage;
            isGenerating.value = false;
            return { success: false, error: userMessage };
        }
    }

    /**
     * Save insight report
     */
    async function saveReport(projectId: number, title?: string) {
        try {
            error.value = null;

            if (!activeSession.value?.conversationId) {
                error.value = 'No active session to save';
                return { success: false, error: error.value };
            }

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/reports/save`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    projectId,
                    conversationId: activeSession.value.conversationId,
                    title
                }
            });

            if (response.success) {
                // Clear active session
                clearSession();

                // Reload reports list
                await loadReports(projectId);

                return { success: true, reportId: response.reportId };
            } else {
                error.value = response.error || 'Failed to save report';
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error saving report:', err);
            error.value = err.message || 'Failed to save report';
            return { success: false, error: error.value };
        }
    }

    /**
     * Load reports for a project
     */
    async function loadReports(projectId: number, page: number = 1, limit: number = 20) {
        try {
            error.value = null;

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/reports/project/${projectId}?page=${page}&limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            reports.value = response.reports;

            if (import.meta.client) {
                localStorage.setItem('insights_reports', JSON.stringify(reports.value));
            }

            return { success: true, reports: response.reports, total: response.total };
        } catch (err: any) {
            console.error('[Insights Store] Error loading reports:', err);
            error.value = err.message || 'Failed to load reports';
            return { success: false, error: error.value };
        }
    }

    /**
     * Load a specific report
     */
    async function loadReport(reportId: number) {
        try {
            error.value = null;

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/reports/${reportId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (response.report) {
                currentInsights.value = response.report.insights_summary;
                messages.value = response.messages.map((m: any) => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.created_at
                }));

                if (import.meta.client) {
                    localStorage.setItem('insights_currentInsights', JSON.stringify(currentInsights.value));
                    localStorage.setItem('insights_messages', JSON.stringify(messages.value));
                }

                return { success: true, report: response.report, messages: response.messages };
            } else {
                error.value = response.error || 'Report not found';
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error loading report:', err);
            error.value = err.message || 'Failed to load report';
            return { success: false, error: error.value };
        }
    }

    /**
     * Delete a report
     */
    async function deleteReport(reportId: number) {
        try {
            error.value = null;

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/reports/${reportId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (response.success) {
                // Remove from local reports list
                reports.value = reports.value.filter(r => r.id !== reportId);

                if (import.meta.client) {
                    localStorage.setItem('insights_reports', JSON.stringify(reports.value));
                }

                return { success: true };
            } else {
                error.value = response.error || 'Failed to delete report';
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error deleting report:', err);
            error.value = err.message || 'Failed to delete report';
            return { success: false, error: error.value };
        }
    }

    /**
     * Cancel active session
     */
    async function cancelSession(projectId: number) {
        try {
            error.value = null;

            if (!activeSession.value?.conversationId) {
                clearSession();
                return { success: true };
            }

            const token = getAuthToken();
            const response = await $fetch(`${baseUrl()}/insights/session/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (response.success) {
                clearSession();
                return { success: true };
            } else {
                error.value = response.error || 'Failed to cancel session';
                return { success: false, error: error.value };
            }
        } catch (err: any) {
            console.error('[Insights Store] Error canceling session:', err);
            error.value = err.message || 'Failed to cancel session';
            return { success: false, error: error.value };
        }
    }

    /**
     * Clear session locally
     */
    function clearSession() {
        activeSession.value = null;
        messages.value = [];
        currentInsights.value = null;
        streamingResponse.value = '';
        isGenerating.value = false;
        generationProgress.value = null;
        error.value = null;

        if (import.meta.client) {
            localStorage.removeItem('insights_activeSession');
            localStorage.removeItem('insights_messages');
            localStorage.removeItem('insights_currentInsights');
        }
    }

    /**
     * Restore session from localStorage (client-only)
     */
    async function restoreFromLocalStorage() {
        if (!import.meta.client) return;

        try {
            const savedSession = localStorage.getItem('insights_activeSession');
            if (savedSession) {
                activeSession.value = JSON.parse(savedSession);
                
                // Load fresh messages from backend if there's an active session
                if (activeSession.value?.projectId) {
                    await loadSessionMessages(activeSession.value.projectId);
                }
            }

            const savedMessages = localStorage.getItem('insights_messages');
            if (savedMessages && !activeSession.value) {
                // Only use localStorage messages if no active session
                messages.value = JSON.parse(savedMessages);
            }

            const savedInsights = localStorage.getItem('insights_currentInsights');
            if (savedInsights) {
                currentInsights.value = JSON.parse(savedInsights);
            }

            const savedSamplingInfo = localStorage.getItem('insights_samplingInfo');
            if (savedSamplingInfo) {
                samplingInfo.value = JSON.parse(savedSamplingInfo);
            }

            const savedReports = localStorage.getItem('insights_reports');
            if (savedReports) {
                reports.value = JSON.parse(savedReports);
            }

            const savedDataSources = localStorage.getItem('insights_selectedDataSources');
            if (savedDataSources) {
                selectedDataSourceIds.value = JSON.parse(savedDataSources);
            }
        } catch (err) {
            console.error('[Insights Store] Error restoring from localStorage:', err);
        }
    }

    // Initialize Socket.IO listeners on client
    if (import.meta.client) {
        initializeSocketListeners();
        restoreFromLocalStorage();
    }

    return {
        // State
        activeSession,
        reports,
        selectedDataSourceIds,
        messages,
        isGenerating,
        generationProgress,
        currentInsights,
        samplingInfo,
        streamingResponse,
        error,

        // Actions
        initializeSocketListeners,
        setSelectedDataSources,
        initializeSession,
        generateInsights,
        askFollowUp,
        saveReport,
        loadReports,
        loadReport,
        deleteReport,
        cancelSession,
        clearSession,
        restoreFromLocalStorage,
        loadSessionMessages
    };
});
