/**
 * Composable for WebSocket-based real-time sync status updates
 * Provides reactive sync status for Google Ad Manager data sources
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';

export interface SyncStatus {
    dataSourceId: number;
    syncId: number;
    status: 'idle' | 'starting' | 'running' | 'completed' | 'failed';
    currentReport?: string;
    progress: number; // 0-100
    recordsSynced: number;
    recordsFailed: number;
    errors: string[];
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
}

export interface SyncEvent {
    type: string;
    eventType?: string;
    data?: any;
    timestamp: string;
}

export function useSyncStatus() {
    const ws = ref<WebSocket | null>(null);
    const connected = ref(false);
    const reconnectAttempts = ref(0);
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    
    // Track sync statuses for multiple data sources
    const syncStatuses = ref<Map<number, SyncStatus>>(new Map());
    
    // Subscribed data source IDs
    const subscribedDataSources = ref<Set<number>>(new Set());
    
    /**
     * Connect to WebSocket server
     */
    const connect = () => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/sync-status`;
        
        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
        
        try {
            ws.value = new WebSocket(wsUrl);
            
            ws.value.onopen = () => {
                console.log('✅ WebSocket connected');
                connected.value = true;
                reconnectAttempts.value = 0;
                
                // Re-subscribe to data sources if any
                if (subscribedDataSources.value.size > 0) {
                    subscribe(Array.from(subscribedDataSources.value));
                }
            };
            
            ws.value.onmessage = (event) => {
                try {
                    const message: SyncEvent = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            ws.value.onclose = () => {
                console.log('❌ WebSocket disconnected');
                connected.value = false;
                
                // Attempt to reconnect
                if (reconnectAttempts.value < maxReconnectAttempts) {
                    reconnectAttempts.value++;
                    console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})...`);
                    setTimeout(connect, reconnectDelay);
                } else {
                    console.error('Max reconnection attempts reached');
                }
            };
            
            ws.value.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    };
    
    /**
     * Disconnect from WebSocket
     */
    const disconnect = () => {
        if (ws.value) {
            ws.value.close();
            ws.value = null;
            connected.value = false;
        }
    };
    
    /**
     * Subscribe to sync updates for specific data sources
     */
    const subscribe = (dataSourceIds: number[]) => {
        dataSourceIds.forEach(id => {
            subscribedDataSources.value.add(id);
            
            // Initialize status if not exists
            if (!syncStatuses.value.has(id)) {
                syncStatuses.value.set(id, {
                    dataSourceId: id,
                    syncId: 0,
                    status: 'idle',
                    progress: 0,
                    recordsSynced: 0,
                    recordsFailed: 0,
                    errors: [],
                });
            }
        });
        
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({
                type: 'subscribe',
                dataSourceIds,
            }));
            console.log(`📡 Subscribed to data sources: ${dataSourceIds.join(', ')}`);
        }
    };
    
    /**
     * Unsubscribe from sync updates
     */
    const unsubscribe = (dataSourceIds: number[]) => {
        dataSourceIds.forEach(id => {
            subscribedDataSources.value.delete(id);
        });
        
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({
                type: 'unsubscribe',
                dataSourceIds,
            }));
            console.log(`📡 Unsubscribed from data sources: ${dataSourceIds.join(', ')}`);
        }
    };
    
    /**
     * Handle incoming WebSocket messages
     */
    const handleMessage = (message: SyncEvent) => {
        switch (message.type) {
            case 'connected':
                console.log('WebSocket connection confirmed');
                break;
                
            case 'subscribed':
                console.log('Subscribed to data sources:', message.data);
                break;
                
            case 'sync-event':
                handleSyncEvent(message);
                break;
                
            case 'error':
                console.error('WebSocket error:', message);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    };
    
    /**
     * Handle sync event updates
     */
    const handleSyncEvent = (message: SyncEvent) => {
        const { eventType, data } = message;
        const dataSourceId = data?.dataSourceId;
        
        if (!dataSourceId) return;
        
        let status = syncStatuses.value.get(dataSourceId);
        if (!status) {
            status = {
                dataSourceId,
                syncId: data.syncId || 0,
                status: 'idle',
                progress: 0,
                recordsSynced: 0,
                recordsFailed: 0,
                errors: [],
            };
            syncStatuses.value.set(dataSourceId, status);
        }
        
        switch (eventType) {
            case 'sync:started':
                status.syncId = data.syncId;
                status.status = 'running';
                status.startedAt = new Date(data.startedAt);
                status.progress = 0;
                status.recordsSynced = 0;
                status.recordsFailed = 0;
                status.errors = [];
                break;
                
            case 'sync:report:completed':
                status.currentReport = data.reportType;
                status.recordsSynced += data.recordsSynced;
                status.recordsFailed += data.recordsFailed;
                // Update progress (assuming equal weight for each report)
                break;
                
            case 'sync:report:failed':
                status.errors.push(`${data.reportType}: ${data.error}`);
                status.recordsFailed++;
                break;
                
            case 'sync:completed':
                status.status = data.status === 'COMPLETED' ? 'completed' : 
                               data.status === 'FAILED' ? 'failed' : 'completed';
                status.recordsSynced = data.totalRecordsSynced;
                status.recordsFailed = data.totalRecordsFailed;
                status.completedAt = new Date(data.completedAt);
                status.durationMs = data.durationMs;
                status.progress = 100;
                break;
                
            case 'sync:failed':
                status.status = 'failed';
                status.errors.push(data.error);
                status.completedAt = new Date(data.failedAt);
                status.progress = 0;
                break;
        }
        
        // Trigger reactivity
        syncStatuses.value = new Map(syncStatuses.value);
    };
    
    /**
     * Get sync status for a specific data source
     */
    const getSyncStatus = (dataSourceId: number): SyncStatus | undefined => {
        return syncStatuses.value.get(dataSourceId);
    };
    
    /**
     * Check if a data source is currently syncing
     */
    const isSyncing = (dataSourceId: number): boolean => {
        const status = syncStatuses.value.get(dataSourceId);
        return status?.status === 'running' || status?.status === 'starting';
    };
    
    /**
     * Get all sync statuses
     */
    const getAllStatuses = computed(() => {
        return Array.from(syncStatuses.value.values());
    });
    
    // Auto-connect on mount
    onMounted(() => {
        connect();
    });
    
    // Cleanup on unmount
    onUnmounted(() => {
        disconnect();
    });
    
    return {
        connected,
        syncStatuses: getAllStatuses,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        getSyncStatus,
        isSyncing,
    };
}
