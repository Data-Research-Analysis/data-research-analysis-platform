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

  // Get auth token for authenticated connections
  const authToken = getAuthToken();

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
    // Connected
  });

  socket.on('disconnect', (reason) => {
    // Disconnected
  });

  socket.on('connect_error', (error) => {
    console.error('🔥 Socket.IO connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    // Reconnected
  });

  socket.on('reconnect_error', (error) => {
    console.error('🔥 Socket.IO reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('💀 Socket.IO reconnection failed - max attempts reached');
  });

  // Listen for server initialization message (now includes userId and room info)
  socket.on('serverInitialization', (data) => {
    // Server initialized
  });

  // Data source sync events (client-side listeners)
  if (import.meta.client) {
    // Import stores and notification library for client-side only
    const { useDataSourceStore } = await import('@/stores/data_sources');
    const { useDataModelsStore } = await import('@/stores/data_models');
    const { useProjectsStore } = await import('@/stores/projects');
    const Swal = (await import('sweetalert2')).default;
    
    socket.on('sync:started', (data: { dataSourceId: number; dataSourceName: string; syncType: string }) => {
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
      const dataSourceStore = useDataSourceStore();
      dataSourceStore.updateSyncStatus(data.dataSourceId, 'syncing', data.progress);
    });

    socket.on('sync:completed', (data: { dataSourceId: number; dataSourceName: string; recordsSynced: number; duration: number }) => {
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
    socket.on('model:refresh:started', (data: { dataModelId: number; modelName: string; triggeredBy: string }) => {
      const dataModelsStore = useDataModelsStore();
      dataModelsStore.updateRefreshStatus(data.dataModelId, 'refreshing', 0);
      
      // Show toast notification
      Swal.fire({
        icon: 'info',
        title: 'Refresh Started',
        text: `Refreshing ${data.modelName}...`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });

    socket.on('model:refresh:completed', (data: { 
      dataModelId: number; 
      modelName: string; 
      rowsAfter: number; 
      durationMs: number;
    }) => {
      const dataModelsStore = useDataModelsStore();
      dataModelsStore.updateRefreshStatus(data.dataModelId, 'completed', 100, {
        rowCount: data.rowsAfter,
        duration: data.durationMs
      });
      
      // Refresh data models list to get updated metadata
      // Note: This requires project context, so only update if on data model page
      
      // Show success toast
      Swal.fire({
        icon: 'success',
        title: 'Refresh Completed',
        text: `${data.modelName} refreshed successfully! ${data.rowsAfter} rows in ${Math.round(data.durationMs / 1000)}s`,
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

    socket.on('model:refresh:failed', (data: any) => {
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
    
    // Cache invalidation events (for ETag and SWR caching)
    socket.on('project:created', async (data: { projectId: number; userId: number; organizationId: number | null; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: project created', data);
      const projectsStore = useProjectsStore();
      
      // Invalidate projects list cache
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/project\/list/);
      
      // Clear ETag cache for projects endpoints
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Invalidate cache manager timestamps
      const { useCacheManager } = await import('@/composables/useCacheManager');
      const cacheManager = useCacheManager();
      cacheManager.invalidateCache('projects');
      
      // Refresh projects in store
      await projectsStore.retrieveProjects();
    });
    
    socket.on('project:updated', async (data: { projectId: number; userId: number; organizationId: number | null; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: project updated', data);
      const projectsStore = useProjectsStore();
      
      // Invalidate projects list cache
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/project\/list/);
      
      // Clear ETag cache for projects endpoints
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Invalidate cache manager timestamps
      const { useCacheManager } = await import('@/composables/useCacheManager');
      const cacheManager = useCacheManager();
      cacheManager.invalidateCache('projects');
      
      // Refresh projects in store
      await projectsStore.retrieveProjects();
    });
    
    socket.on('project:deleted', async (data: { projectId: number; userId: number; organizationId: number | null; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: project deleted', data);
      const projectsStore = useProjectsStore();
      
      // Invalidate projects list cache
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/project\/list/);
      
      // Clear ETag cache for projects endpoints
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Invalidate cache manager timestamps
      const { useCacheManager } = await import('@/composables/useCacheManager');
      const cacheManager = useCacheManager();
      cacheManager.invalidateCache('projects');
      
      // Refresh projects in store
      await projectsStore.retrieveProjects();
    });
    
    socket.on('dataSource:created', async (data: { dataSourceId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dataSource created', data);
      const dataSourceStore = useDataSourceStore();
      
      // Invalidate data sources list cache
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/data-sources/);
      
      // Clear ETag cache for data sources endpoints
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Refresh data sources in store
      await dataSourceStore.retrieveDataSources();
    });
    
    socket.on('dataSource:updated', async (data: { dataSourceId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dataSource updated', data);
      const dataSourceStore = useDataSourceStore();
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/data-sources/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Refresh data sources in store
      await dataSourceStore.retrieveDataSources();
    });
    
    socket.on('dataSource:deleted', async (data: { dataSourceId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dataSource deleted', data);
      const dataSourceStore = useDataSourceStore();
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/data-sources/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Refresh data sources in store
      await dataSourceStore.retrieveDataSources();
    });
    
    socket.on('dataModel:refreshed', async (data: { dataModelId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dataModel refreshed', data);
      const dataModelsStore = useDataModelsStore();
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/data-models/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Refresh data models in store (requires project context - only if on data models page)
      // Store refresh will be handled by page-specific logic listening to this event
    });
    
    socket.on('dataModel:deleted', async (data: { dataModelId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dataModel deleted', data);
      const dataModelsStore = useDataModelsStore();
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/data-models/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Refresh data models in store
      // Store refresh will be handled by page-specific logic
    });
    
    socket.on('dashboard:updated', async (data: { dashboardId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dashboard updated', data);
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/dashboards/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Dashboard store refresh will be handled by page-specific logic
    });
    
    socket.on('dashboard:deleted', async (data: { dashboardId: number; projectId: number; timestamp: Date }) => {
      console.log('🔄 Cache invalidation: dashboard deleted', data);
      
      // Invalidate caches
      const { useStaleWhileRevalidate } = await import('@/composables/useStaleWhileRevalidate');
      const { invalidatePattern } = useStaleWhileRevalidate();
      invalidatePattern(/\/dashboards/);
      
      const { useFetchWithETag } = await import('@/composables/useFetchWithETag');
      const { clearETagCache } = useFetchWithETag();
      clearETagCache();
      
      // Dashboard store refresh will be handled by page-specific logic
    });
  }

  // Provide socket instance to the app
  nuxtApp.provide("socketio", socket);
  
  // Cleanup on app unmount
  nuxtApp.hook('app:beforeMount', () => {
    // Socket cleanup will be handled automatically on page navigation
  });
});
