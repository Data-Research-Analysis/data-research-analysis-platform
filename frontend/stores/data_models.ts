import {defineStore} from 'pinia'
import type { IDataModel } from '~/types/IDataModel';
import type { IDataModelTable } from '~/types/IDataModelTable';
import type { IDataModelData } from '~/types/IDataModelData';

interface RefreshStatus {
    status: string;
    progress: number;
    lastRefreshedAt?: string;
    rowCount?: number;
    duration?: number;
    error?: string;
}

interface RefreshJob {
    jobId: string;
    dataModelId: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

let dataModelsInitialized = false;

export const useDataModelsStore = defineStore('dataModelsDRA', () => {
    const dataModels = ref<IDataModel[]>([])
    const selectedDataModel = ref<IDataModel>()
    const dataModelTables = ref<IDataModelTable[]>([])
    
    // Issue #361 - Data Model Composition: Store data models as source tables
    const dataModelSourceTables = ref<IDataModelTable[]>([])
    
    // Real-time refresh state
    const refreshStatus = ref<Map<number, RefreshStatus>>(new Map())
    const refreshJobs = ref<Map<string, RefreshJob>>(new Map())
    const refreshErrors = ref<Map<number, string>>(new Map())
    
    // In-memory cache for paginated data (not persisted to localStorage)
    const dataModelDataCache = ref<Map<string, IDataModelData>>(new Map())

    function setDataModels(dataModelsList: IDataModel[]) {
        dataModels.value = dataModelsList;
        if (import.meta.client) {
            try {
                localStorage.setItem('dataModels', JSON.stringify(dataModelsList));
                enableRefreshDataFlag('setDataModels');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[DataModelsStore] localStorage quota exceeded for dataModels. Data kept in memory only.');
                    // Keep data in memory, just skip localStorage persistence
                    enableRefreshDataFlag('setDataModels');
                } else {
                    console.error('[DataModelsStore] Error saving dataModels to localStorage:', error);
                }
            }
        }
    }
    function setSelectedDataModel(dataModel: IDataModel) {
        selectedDataModel.value = dataModel;
        if (import.meta.client) {
            try {
                localStorage.setItem('selectedDataModel', JSON.stringify(dataModel));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[DataModelsStore] localStorage quota exceeded for selectedDataModel. Data kept in memory only.');
                } else {
                    console.error('[DataModelsStore] Error saving selectedDataModel to localStorage:', error);
                }
            }
        }
    }
    function setDataModelTables(dataModelTablesList: IDataModelTable[]) {
        dataModelTables.value = dataModelTablesList;
        if (import.meta.client) {
            try {
                // Store only metadata, exclude rows array to prevent QuotaExceededError
                const metadataOnly = dataModelTablesList.map(table => ({
                    ...table,
                    rows: undefined,  // Remove rows array from localStorage
                    row_count: table.row_count || table.rows?.length || 0
                }));
                
                localStorage.setItem('dataModelTables', JSON.stringify(metadataOnly));
                enableRefreshDataFlag('setDataModelTables');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[DataModelsStore] localStorage quota exceeded - storing minimal metadata only');
                    // Fallback: store even less data (just IDs, names, and counts)
                    try {
                        const minimalMeta = dataModelTablesList.map(t => ({
                            data_model_id: t.data_model_id,
                            table_name: t.table_name,
                            logical_name: t.logical_name,
                            schema: t.schema,
                            row_count: t.row_count || 0
                        }));
                        localStorage.setItem('dataModelTables', JSON.stringify(minimalMeta));
                        enableRefreshDataFlag('setDataModelTables');
                    } catch (fallbackError) {
                        console.error('[DataModelsStore] Even minimal metadata storage failed:', fallbackError);
                        enableRefreshDataFlag('setDataModelTables');
                    }
                } else {
                    console.error('[DataModelsStore] Error saving dataModelTables to localStorage:', error);
                }
            }
        }
    }
    function getDataModels() {
        // Return current value - don't overwrite with potentially stale localStorage
        return dataModels.value;
    }
    function getDataModelTables() {
        // Return current value - don't overwrite with potentially stale localStorage
        return dataModelTables.value;
    }
    async function retrieveDataModels(projectId: number) {
        const token = getAuthToken();
        if (!token) {
            dataModels.value = [];
            return;
        }
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        const data = await $fetch<IDataModel[]>(`${baseUrl()}/data-model/list/${projectId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
                ...orgHeaders,
            },
        });
        setDataModels(data)
    }
    async function retrieveDataModelTables(projectId: number) {
        if (!projectId) {
            setDataModelTables([]);
            return;
        }
        const token = getAuthToken();
        if (!token) {
            setDataModelTables([]);
            return;
        }
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        const data = await $fetch(`${baseUrl()}/data-model/tables/project/${projectId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
                ...orgHeaders,
            },
        }) as any;
        setDataModelTables(data);
    }
    
    // Issue #361 - Data Model Composition: Methods for data models as source tables
    async function retrieveDataModelsAsSourceTables(projectId: number): Promise<void> {
        if (!projectId) {
            setDataModelSourceTables([]);
            return;
        }
        
        try {
            const config = useRuntimeConfig();
            const token = getAuthToken();
            if (!token) {
                setDataModelSourceTables([]);
                return;
            }

            const response = await $fetch<{ success: boolean; tables: IDataModelTable[] }>(
                `${config.public.apiBase}/data-model/project/${projectId}/data-models-as-tables`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    }
                }
            );

            if (response.success) {
                setDataModelSourceTables(response.tables);
            } else {
                setDataModelSourceTables([]);
            }
        } catch (error) {
            console.error('[data_models store] retrieveDataModelsAsSourceTables failed:', error);
            setDataModelSourceTables([]);
        }
    }

    function setDataModelSourceTables(tables: IDataModelTable[]) {
        dataModelSourceTables.value = tables;
        if (import.meta.client) {
            try {
                // Store metadata only (exclude rows) to prevent localStorage quota issues
                const metadataOnly = tables.map(table => ({
                    ...table,
                    rows: undefined,
                    row_count: table.row_count || 0
                }));
                localStorage.setItem('dataModelSourceTables', JSON.stringify(metadataOnly));
                enableRefreshDataFlag('setDataModelSourceTables');
            } catch (err) {
                if (err instanceof DOMException && err.name === 'QuotaExceededError') {
                    console.warn('[data_models store] localStorage quota exceeded for dataModelSourceTables, keeping in memory only');
                } else {
                    console.error('[data_models store] Error saving dataModelSourceTables to localStorage:', err);
                }
            }
        }
    }

    function getDataModelSourceTables() {
        if (import.meta.client && dataModelSourceTables.value.length === 0) {
            const stored = localStorage.getItem('dataModelSourceTables');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    dataModelSourceTables.value = parsed;
                } catch (err) {
                    console.error('[data_models store] Failed to parse dataModelSourceTables from localStorage:', err);
                }
            }
        }
        return dataModelSourceTables.value;
    }
    
    function getSelectedDataModel() {
        // Load from localStorage only if not already set
        if (import.meta.client && !selectedDataModel.value && localStorage.getItem('selectedDataModel')) {
            selectedDataModel.value = JSON.parse(localStorage.getItem('selectedDataModel') || 'null');
        }
        return selectedDataModel.value
    }
    function clearDataModels() {
        dataModels.value = []
        if (import.meta.client) {
            localStorage.removeItem('dataModels');
            enableRefreshDataFlag('clearDataModels');
        }
    }
    function clearSelectedDataModel() {
        selectedDataModel.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDataModel');
        }
    }
    
    /**
     * Fetch paginated data from a data model
     * Implements 5-minute in-memory cache for performance
     * @param dataModelId - ID of the data model
     * @param page - Page number (1-indexed)
     * @param limit - Number of rows per page
     * @param sortBy - Optional column to sort by
     * @param sortOrder - Sort order (ASC or DESC)
     * @returns Promise with paginated data and metadata
     */
    async function fetchDataModelData(
        dataModelId: number,
        page: number = 1,
        limit: number = 100,
        sortBy?: string,
        sortOrder?: 'ASC' | 'DESC',
        search?: string,
        filters?: Record<string, any>
    ): Promise<IDataModelData> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        // Create cache key including search and filters
        const filterKey = filters ? JSON.stringify(filters) : 'none';
        const searchKey = search || 'none';
        const cacheKey = `dm_${dataModelId}_p${page}_l${limit}_s${sortBy || 'none'}_${sortOrder || 'none'}_search${searchKey}_f${filterKey}`;
        const cached = dataModelDataCache.value.get(cacheKey);
        
        // Return cached data if fresh (< 5 minutes)
        if (cached && cached.fetchedAt) {
            const age = Date.now() - cached.fetchedAt.getTime();
            if (age < 5 * 60 * 1000) { // 5 minutes in milliseconds
                console.log(`[DataModelsStore] Using cached data for ${cacheKey}, age: ${Math.round(age / 1000)}s`);
                return cached;
            }
        }
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        // Build query parameters
        const params: Record<string, any> = { page, limit };
        if (sortBy) params.sort_by = sortBy;
        if (sortOrder) params.sort_order = sortOrder;
        if (search) params.search = search;
        if (filters && Object.keys(filters).length > 0) params.filters = JSON.stringify(filters);
        
        console.log(`[DataModelsStore] Fetching data for model ${dataModelId}, page ${page}, limit ${limit}, search: ${search || 'none'}, filters: ${Object.keys(filters || {}).length}`);
        
        const response = await $fetch<IDataModelData>(
            `${baseUrl()}/data-model/${dataModelId}/data`,
            {
                params,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                    ...orgHeaders,
                },
            }
        );
        
        // Add to cache with timestamp
        const cachedData: IDataModelData = {
            ...response,
            fetchedAt: new Date()
        };
        dataModelDataCache.value.set(cacheKey, cachedData);
        
        // Limit cache size (keep only last 20 entries)
        if (dataModelDataCache.value.size > 20) {
            const firstKey = dataModelDataCache.value.keys().next().value;
            dataModelDataCache.value.delete(firstKey);
        }
        
        return response;
    }
    
    /**
     * Clear the data model data cache
     * Call this when data models are refreshed or updated
     */
    function clearDataModelDataCache(dataModelId?: number) {
        if (dataModelId) {
            // Clear cache for specific data model
            const keysToDelete: string[] = [];
            dataModelDataCache.value.forEach((_, key) => {
                if (key.startsWith(`dm_${dataModelId}_`)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => dataModelDataCache.value.delete(key));
            console.log(`[DataModelsStore] Cleared cache for data model ${dataModelId}`);
        } else {
            // Clear all cache
            dataModelDataCache.value.clear();
            console.log('[DataModelsStore] Cleared all data model data cache');
        }
    }
    
    /**
     * NEW METHODS FOR CROSS-DATA-SOURCE SUPPORT
     */
    
    /**
     * Fetch tables from all data sources in a project
     * Used for cross-source data model building
     */
    async function fetchAllProjectTables(projectId: number) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return [];
        }
        
        try {
            const data = await $fetch(`${baseUrl()}/data-model/projects/${projectId}/all-tables`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
            return data;
        } catch (error) {
            console.error('[CrossSource] Error fetching all project tables:', error);
            return [];
        }
    }
    
    /**
     * Get join suggestions between two tables
     */
    async function suggestJoins(leftTable: any, rightTable: any) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return [];
        }
        
        try {
            const suggestions = await $fetch(`${baseUrl()}/data-model/suggest-joins`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: {
                    leftTable,
                    rightTable
                }
            }) as any;
            return suggestions;
        } catch (error) {
            console.error('[CrossSource] Error suggesting joins:', error);
            return [];
        }
    }
    
    /**
     * Save a successful join to the catalog for future reuse
     */
    async function saveJoinToCatalog(joinDefinition: any) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return false;
        }
        
        try {
            await $fetch(`${baseUrl()}/data-model/save-join-to-catalog`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: joinDefinition
            });
            return true;
        } catch (error) {
            console.error('[CrossSource] Error saving join to catalog:', error);
            return false;
        }
    }
    
    // Refresh status management
    function updateRefreshStatus(dataModelId: number, status: string, progress: number = 0, metadata?: Partial<RefreshStatus>) {
        const currentStatus = refreshStatus.value.get(dataModelId) || {
            status: 'idle',
            progress: 0
        };
        
        refreshStatus.value.set(dataModelId, {
            ...currentStatus,
            status,
            progress,
            ...metadata
        });
        
        // Update data model in list if metadata provided
        if (metadata && dataModels.value.length > 0) {
            const modelIndex = dataModels.value.findIndex(m => m.id === dataModelId);
            if (modelIndex !== -1) {
                const updatedModel = { ...dataModels.value[modelIndex] } as any;
                updatedModel.refresh_status = status;
                if (metadata.lastRefreshedAt) updatedModel.last_refreshed_at = metadata.lastRefreshedAt;
                if (metadata.rowCount !== undefined) updatedModel.row_count = metadata.rowCount;
                if (metadata.duration !== undefined) updatedModel.last_refresh_duration_ms = metadata.duration;
                if (metadata.error !== undefined) updatedModel.refresh_error = metadata.error;
                dataModels.value[modelIndex] = updatedModel;
                setDataModels([...dataModels.value]);
            }
        }
    }
    
    function getRefreshStatus(dataModelId: number): RefreshStatus | undefined {
        return refreshStatus.value.get(dataModelId);
    }
    
    function clearRefreshStatus(dataModelId: number) {
        refreshStatus.value.delete(dataModelId);
    }
    
    function setRefreshError(dataModelId: number, error: string) {
        refreshErrors.value.set(dataModelId, error);
        updateRefreshStatus(dataModelId, 'failed', 0, { error });
    }
    
    function clearRefreshError(dataModelId: number) {
        refreshErrors.value.delete(dataModelId);
    }
    
    // Refresh job management
    function addRefreshJob(jobId: string, dataModelId: number) {
        refreshJobs.value.set(jobId, {
            jobId,
            dataModelId,
            status: 'pending'
        });
    }
    
    function updateRefreshJob(jobId: string, status: 'pending' | 'running' | 'completed' | 'failed') {
        const job = refreshJobs.value.get(jobId);
        if (job) {
            refreshJobs.value.set(jobId, { ...job, status });
        }
    }
    
    function getRefreshJob(jobId: string): RefreshJob | undefined {
        return refreshJobs.value.get(jobId);
    }
    
    function clearRefreshJob(jobId: string) {
        refreshJobs.value.delete(jobId);
    }
    
    // Manual refresh trigger
    async function refreshDataModel(dataModelId: number) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const data = await $fetch(`${baseUrl()}/refresh/data-model/${dataModelId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        }) as any;
        
        // Track the job
        if (data.jobId) {
            addRefreshJob(data.jobId, dataModelId);
        }
        
        return data;
    }
    
    // Cascade refresh trigger
    async function cascadeRefreshDataSource(dataSourceId: number) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const data = await $fetch(`${baseUrl()}/refresh/cascade/${dataSourceId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        }) as any;
        
        // Track all jobs
        if (data.jobIds && Array.isArray(data.jobIds)) {
            data.jobIds.forEach((jobId: string, index: number) => {
                if (data.modelIds && data.modelIds[index]) {
                    addRefreshJob(jobId, data.modelIds[index]);
                }
            });
        }
        
        return data;
    }
    
    // Get refresh history
    async function getRefreshHistory(dataModelId: number) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const data = await $fetch(`${baseUrl()}/refresh/history/${dataModelId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        return data;
    }
    
    // Copy/clone data model
    async function copyDataModel(dataModelId: number): Promise<IDataModel> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const newModel = await $fetch<IDataModel>(
            `${baseUrl()}/data-model/copy/${dataModelId}`, 
            {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }
        );
        
        // Invalidate related caches when data model is created
        const cacheManager = useCacheManager();
        cacheManager.invalidateRelated('dataModel', newModel.id);
        
        // Add to local store
        dataModels.value.push(newModel);
        setDataModels(dataModels.value);
        
        return newModel;
    }

    // Issue #10 — pending SQL suggestion for handoff to the data model builder
    const pendingSQLSuggestion = ref<{ dataModelId: number; sql: string; description: string } | null>(null);

    function setPendingSQLSuggestion(payload: { dataModelId: number; sql: string; description: string } | null) {
        pendingSQLSuggestion.value = payload;
    }

    function clearPendingSQLSuggestion() {
        pendingSQLSuggestion.value = null;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Issue #361 — Medallion Architecture: Layer Management
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Update a data model's layer assignment
     * @param dataModelId - The ID of the data model
     * @param layer - The layer to assign (raw_data | clean_data | business_ready)
     * @param layerConfig - Optional layer-specific configuration
     * @returns Success boolean
     */
    async function updateDataModelLayer(
        dataModelId: number,
        layer: string,
        layerConfig?: any
    ): Promise<boolean> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const updates: any = { data_layer: layer };
        if (layerConfig) {
            updates.layer_config = layerConfig;
        }

        const response = await $fetch<{ success: boolean; updates: any }>(
            `${baseUrl()}/data-model/${dataModelId}`,
            {
                method: 'PATCH',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updates)
            }
        );

        if (response && response.success !== false) {
            // Update local store
            const model = dataModels.value.find(m => m.id === dataModelId);
            if (model) {
                (model as any).data_layer = layer;
                if (layerConfig) {
                    (model as any).layer_config = layerConfig;
                }
                setDataModels([...dataModels.value]);
            }
            return true;
        }

        return false;
    }

    /**
     * Validate a layer assignment for a data model
     * @param dataModelId - The ID of the data model
     * @param layer - The layer to validate
     * @returns Validation result with issues
     */
    async function validateLayer(
        dataModelId: number,
        layer: string
    ): Promise<{ validation: any; recommendation: any } | null> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        try {
            const response = await $fetch<{ success: boolean; validation: any; recommendation: any }>(
                `${baseUrl()}/data-model/validate-layer`,
                {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Authorization-Type": "auth",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ dataModelId, layer })
                }
            );

            if (response && response.success) {
                return {
                    validation: response.validation,
                    recommendation: response.recommendation
                };
            }
        } catch (error: any) {
            console.error('[DataModelsStore] Layer validation failed:', error);
            throw new Error(error.data?.error || error.message || 'Layer validation failed');
        }

        return null;
    }

    /**
     * Get layer recommendation for a data model
     * @param dataModelId - The ID of the data model
     * @returns Layer recommendation with reasoning
     */
    async function getLayerRecommendation(
        dataModelId: number
    ): Promise<{ layer: string; reasoning: string; confidence: string } | null> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        try {
            const response = await $fetch<{ success: boolean; recommendation: any }>(
                `${baseUrl()}/data-model/recommend-layer/${dataModelId}`,
                {
                    method: 'GET',
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Authorization-Type": "auth"
                    }
                }
            );

            if (response && response.success && response.recommendation) {
                return response.recommendation;
            }
        } catch (error: any) {
            console.error('[DataModelsStore] Layer recommendation failed:', error);
        }

        return null;
    }
    
    /**
     * Issue #361: Get data models filtered by layer
     * @param layer - The data layer to filter by
     * @param projectId - The project  ID
     * @returns Promise with filtered data models
     */
    async function getDataModelsByLayer(
        layer: 'raw_data' | 'clean_data' | 'business_ready',
        projectId: number
    ): Promise<IDataModel[]> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        try {
            const data = await $fetch<IDataModel[]>(
                `${baseUrl()}/data-model/by-layer/${layer}/project/${projectId}`,
                {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Authorization-Type": "auth",
                        ...orgHeaders,
                    },
                }
            );
            return data;
        } catch (error: any) {
            console.error(`[DataModelsStore] Failed to retrieve ${layer} data models:`, error);
            return [];
        }
    }
    
    /**
     * Issue #361: Get statistics about layer distribution
     * @param projectId - Optional project ID to filter stats
     * @returns Statistics object with counts and percentages per layer
     */
    function getLayerStats(projectId?: number) {
        let models = dataModels.value;
        
        // Filter by project if specified
        if (projectId) {
            models = models.filter(model => 
                model.data_source?.project_id === projectId ||
                model.data_model_sources?.some((dms: any) => dms.data_source?.project_id === projectId)
            );
        }
        
        const total = models.length;
        const rawCount = models.filter((m: any) => m.data_layer === 'raw_data').length;
        const cleanCount = models.filter((m: any) => m.data_layer === 'clean_data').length;
        const businessCount = models.filter((m: any) => m.data_layer === 'business_ready').length;
        const unclassified = models.filter((m: any) => !m.data_layer).length;
        
        return {
            total,
            raw_data: {
                count: rawCount,
                percentage: total > 0 ? Math.round((rawCount / total) * 100) : 0
            },
            clean_data: {
                count: cleanCount,
                percentage: total > 0 ? Math.round((cleanCount / total) * 100) : 0
            },
            business_ready: {
                count: businessCount,
                percentage: total > 0 ? Math.round((businessCount / total) * 100) : 0
            },
            unclassified: {
                count: unclassified,
                percentage: total > 0 ? Math.round((unclassified / total) * 100) : 0
            }
        };
    }
    
    /**
     * Issue #361: Upgrade a data model from one layer to another
     * This is a convenience method that calls updateDataModelLayer with validation
     * @param dataModelId - ID of the data model to upgrade
     * @param newLayer - Target layer to upgrade to
     * @returns Success status and any validation warnings
     */
    async function upgradeModelLayer(
        dataModelId: number,
        newLayer: 'raw_data' | 'clean_data' | 'business_ready'
    ): Promise<{ success: boolean; warnings?: string[] }> {
        try {
            // First validate the new layer
            const validation = await validateLayer(dataModelId, newLayer);
            
            const warnings: string[] = [];
            if (validation && !validation.valid) {
                // Collect any warning-level issues
                validation.issues.forEach((issue: any) => {
                    if (issue.severity === 'warning') {
                        warnings.push(issue.message);
                    }
                });
                
                // If there are errors (not just warnings), return failure
                const hasErrors = validation.issues.some((issue: any) => issue.severity === 'error');
                if (hasErrors) {
                    return {
                        success: false,
                        warnings: validation.issues
                            .filter((i: any) => i.severity === 'error')
                            .map((i: any) => i.message)
                    };
                }
            }
            
            // Proceed with update
            await updateDataModelLayer(dataModelId, newLayer);
            
            // Update local state
            const modelIndex = dataModels.value.findIndex(m => m.id === dataModelId);
            if (modelIndex >= 0) {
                (dataModels.value[modelIndex] as any).data_layer = newLayer;
                setDataModels([...dataModels.value]);
            }
            
            return {
                success: true,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        } catch (error: any) {
            console.error('[DataModelsStore] Layer upgrade failed:', error);
            return {
                success: false,
                warnings: [error.message || 'Failed to upgrade layer']
            };
        }
    }
    
    return {
        dataModels,
        selectedDataModel,
        refreshStatus,
        refreshJobs,
        refreshErrors,
        pendingSQLSuggestion,
        setDataModels,
        setSelectedDataModel,
        setDataModelTables,
        getDataModels,
        getDataModelTables,
        retrieveDataModels,
        retrieveDataModelTables,
        clearDataModels,
        getSelectedDataModel,
        clearSelectedDataModel,
        // Issue #361 - Data Model Composition
        dataModelSourceTables,
        retrieveDataModelsAsSourceTables,
        setDataModelSourceTables,
        getDataModelSourceTables,
        // Paginated data methods
        fetchDataModelData,
        clearDataModelDataCache,
        // Cross-source methods
        fetchAllProjectTables,
        suggestJoins,
        saveJoinToCatalog,
        // Refresh methods
        updateRefreshStatus,
        getRefreshStatus,
        clearRefreshStatus,
        setRefreshError,
        clearRefreshError,
        addRefreshJob,
        updateRefreshJob,
        getRefreshJob,
        clearRefreshJob,
        refreshDataModel,
        cascadeRefreshDataSource,
        getRefreshHistory,
        copyDataModel,
        // Issue #10 — pre-filled SQL suggestion for data model builder handoff
        setPendingSQLSuggestion,
        clearPendingSQLSuggestion,
        // Issue #361 — Medallion Architecture: Layer Management
        updateDataModelLayer,
        validateLayer,
        getLayerRecommendation,
        getDataModelsByLayer,
        getLayerStats,
        upgradeModelLayer,
    }
});
