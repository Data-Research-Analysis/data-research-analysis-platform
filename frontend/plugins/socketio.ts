import { io, Socket } from "socket.io-client";
import { getAuthToken } from "~/composables/AuthToken";

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig();  
  const socketHost = config.public.NUXT_SOCKETIO_SERVER_URL || 'http://localhost';
  const socketPort = config.public.NUXT_SOCKETIO_SERVER_PORT || 3002;
  let socketPath = `${socketHost}:${socketPort}`;
  if (config.public.NUXT_ENV === 'production') {
    socketPath = `${socketHost}`;
  }
  console.log(`[Socket.IO] Attempting to connect to server at ${socketPath}`);
  console.log(`[Socket.IO] Environment: ${config.public.NUXT_ENV}`);

  // Get auth token for authenticated connections
  const authToken = getAuthToken();
  if (authToken) {
    console.log('[Socket.IO] Auth token found, connecting as authenticated user');
    console.log('[Socket.IO] Token type:', typeof authToken);
    console.log('[Socket.IO] Token length:', authToken.length);
    console.log('[Socket.IO] Token (first 30 chars):', authToken.substring(0, 30));
  } else {
    console.log('[Socket.IO] No auth token, connecting as anonymous user');
  }

  const socket: Socket = io(socketPath, {
    auth: {
      token: authToken // Send auth token in handshake
    },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10, // Increased from 5
    timeout: 20000,
    forceNew: true,
    transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
    upgrade: true, // Allow upgrade from polling to WebSocket
    path: '/socket.io/', // Explicit path
    withCredentials: true // Important for CORS
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from Socket.IO server:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔥 Socket.IO connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected to Socket.IO server after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_error', (error) => {
    console.error('🔥 Socket.IO reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('💀 Socket.IO reconnection failed - max attempts reached');
  });

  // Listen for server initialization message (now includes userId and room info)
  socket.on('serverInitialization', (data) => {
    console.log('📡 Server initialization message:', data);
    if (data.userId) {
      console.log(`✅ Authenticated as user ${data.userId} in room ${data.room}`);
    }
  });

  // Data source sync events (client-side listeners)
  if (import.meta.client) {
    // Import stores and notification library for client-side only
    const { useDataSourceStore } = await import('@/stores/data_sources');
    const { useDataModelsStore } = await import('@/stores/data_models');
    const Swal = (await import('sweetalert2')).default;
    
    socket.on('sync:started', (data: { dataSourceId: number; dataSourceName: string; syncType: string }) => {
      console.log('🔄 Sync started:', data);
      const dataSourceStore = useDataSourceStore();
      dataSourceStore.updateSyncStatus(data.dataSourceId, 'syncing', 0);
      
      // Show toast notification
      Swal.fire({
        icon: 'info',
        title: 'Sync Started',
        text: `Syncing ${data.dataSourceName}...`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });

    socket.on('sync:progress', (data: { dataSourceId: number; progress: number; message?: string }) => {
      console.log('📊 Sync progress:', data);
      const dataSourceStore = useDataSourceStore();
      dataSourceStore.updateSyncStatus(data.dataSourceId, 'syncing', data.progress);
    });

    socket.on('sync:completed', (data: { dataSourceId: number; dataSourceName: string; recordsSynced: number; duration: number }) => {
      console.log('✅ Sync completed:', data);
      const dataSourceStore = useDataSourceStore();
      dataSourceStore.updateSyncStatus(data.dataSourceId, 'completed', 100);
      
      // Refresh data sources to get updated last_sync timestamp
      dataSourceStore.retrieveDataSources();
      
      // Show success toast
      Swal.fire({
        icon: 'success',
        title: 'Sync Completed',
        text: `${data.dataSourceName} synced successfully! ${data.recordsSynced} records in ${Math.round(data.duration / 1000)}s`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
      });
      
      // Clear sync status after 5 seconds
      setTimeout(() => {
        dataSourceStore.clearSyncStatus(data.dataSourceId);
      }, 5000);
    });

    socket.on('sync:failed', (data: { dataSourceId: number; dataSourceName: string; error: string }) => {
      console.error('❌ Sync failed:', data);
      const dataSourceStore = useDataSourceStore();
      dataSourceStore.updateSyncStatus(data.dataSourceId, 'failed', 0);
      dataSourceStore.setSyncError(data.dataSourceId, data.error);
      
      // Show error toast
      Swal.fire({
        icon: 'error',
        title: 'Sync Failed',
        text: `Failed to sync ${data.dataSourceName}: ${data.error}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 7000,
        timerProgressBar: true
      });
    });
    
    // Data model refresh events
    socket.on('model:refresh:started', (data: { dataModelId: number; dataModelName: string; triggeredBy: string }) => {
      console.log('🔄 Model refresh started:', data);
      const dataModelsStore = useDataModelsStore();
      dataModelsStore.updateRefreshStatus(data.dataModelId, 'refreshing', 0);
      
      // Show toast notification
      Swal.fire({
        icon: 'info',
        title: 'Refresh Started',
        text: `Refreshing ${data.dataModelName}...`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });

    socket.on('model:refresh:completed', (data: { 
      dataModelId: number; 
      dataModelName: string; 
      rowCount: number; 
      duration: number;
      lastRefreshedAt: string;
    }) => {
      console.log('✅ Model refresh completed:', data);
      const dataModelsStore = useDataModelsStore();
      dataModelsStore.updateRefreshStatus(data.dataModelId, 'completed', 100, {
        rowCount: data.rowCount,
        duration: data.duration,
        lastRefreshedAt: data.lastRefreshedAt
      });
      
      // Refresh data models list to get updated metadata
      // Note: This requires project context, so only update if on data model page
      
      // Show success toast
      Swal.fire({
        icon: 'success',
        title: 'Refresh Completed',
        text: `${data.dataModelName} refreshed successfully! ${data.rowCount} rows in ${Math.round(data.duration / 1000)}s`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
      });
      
      // Clear refresh status after 5 seconds
      setTimeout(() => {
        dataModelsStore.clearRefreshStatus(data.dataModelId);
      }, 5000);
    });

    socket.on('model:refresh:failed', (data: { dataModelId: number; dataModelName: string; error: string }) => {
      console.error('❌ Model refresh failed:', data);
      const dataModelsStore = useDataModelsStore();
      dataModelsStore.updateRefreshStatus(data.dataModelId, 'failed', 0);
      dataModelsStore.setRefreshError(data.dataModelId, data.error);
      
      // Show error toast
      Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: `Failed to refresh ${data.dataModelName}: ${data.error}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 7000,
        timerProgressBar: true
      });
    });
  }

  // Provide socket instance to the app
  nuxtApp.provide("socketio", socket);
  
  // Cleanup on app unmount
  nuxtApp.hook('app:beforeMount', () => {
    // Socket cleanup will be handled automatically on page navigation
  });
});
