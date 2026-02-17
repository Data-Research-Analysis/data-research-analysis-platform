import {defineStore} from 'pinia'
import type { IDataModel } from '~/types/IDataModel';
import type { IDataModelTable } from '~/types/IDataModelTable';

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
    
    // Real-time refresh state
    const refreshStatus = ref<Map<number, RefreshStatus>>(new Map())
    const refreshJobs = ref<Map<string, RefreshJob>>(new Map())
    const refreshErrors = ref<Map<number, string>>(new Map())

    function setDataModels(dataModelsList: IDataModel[]) {
        dataModels.value = dataModelsList;
        if (import.meta.client) {
            localStorage.setItem('dataModels', JSON.stringify(dataModelsList));
            enableRefreshDataFlag('setDataModels');
        }
    }
    function setSelectedDataModel(dataModel: IDataModel) {
        selectedDataModel.value = dataModel;
        if (import.meta.client) {
            localStorage.setItem('selectedDataModel', JSON.stringify(dataModel));
        }
    }
    function setDataModelTables(dataModelTablesList: IDataModelTable[]) {
        dataModelTables.value = dataModelTablesList;
        if (import.meta.client) {
            localStorage.setItem('dataModelTables', JSON.stringify(dataModelTablesList));
            enableRefreshDataFlag('setDataModelTables');
        }
    }
    function getDataModels() {
        if (import.meta.client && localStorage.getItem('dataModels')) {
            dataModels.value = JSON.parse(localStorage.getItem('dataModels') || '[]');
        }
        return dataModels.value;
    }
    function getDataModelTables() {
        if (import.meta.client && localStorage.getItem('dataModelTables')) {
            dataModelTables.value = JSON.parse(localStorage.getItem('dataModelTables') || '[]');
        }
        return dataModelTables.value;
    }
    async function retrieveDataModels(projectId: number) {
        const token = getAuthToken();
        if (!token) {
            dataModels.value = [];
            return;
        }
        const data = await $fetch<IDataModel[]>(`${baseUrl()}/data-model/list/${projectId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
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
        const data = await $fetch(`${baseUrl()}/data-model/tables/project/${projectId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        }) as any;
        setDataModelTables(data);
    }
    function getSelectedDataModel() {
        if (import.meta.client && localStorage.getItem('selectedDataModel')) {
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
        
        // Add to local store
        dataModels.value.push(newModel);
        setDataModels(dataModels.value);
        
        return newModel;
    }
    
    return {
        dataModels,
        selectedDataModel,
        refreshStatus,
        refreshJobs,
        refreshErrors,
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
        copyDataModel
    }
    
    // Initialize from localStorage once on client
    if (import.meta.client && !dataModelsInitialized && localStorage.getItem('dataModels')) {
        dataModels.value = JSON.parse(localStorage.getItem('dataModels') || '[]');
        dataModelsInitialized = true;
    }
    
    return storeExports;
});
