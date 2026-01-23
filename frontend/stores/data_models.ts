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
        const url = `${baseUrl()}/data-model/list/${projectId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
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
        const url = `${baseUrl()}/data-model/tables/project/${projectId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
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
            const url = `${baseUrl()}/data-model/projects/${projectId}/all-tables`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch tables: ${response.statusText}`);
            }
            
            const data = await response.json();
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
            const url = `${baseUrl()}/data-model/suggest-joins`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify({
                    leftTable,
                    rightTable
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to suggest joins: ${response.statusText}`);
            }
            
            const suggestions = await response.json();
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
            const url = `${baseUrl()}/data-model/save-join-to-catalog`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify(joinDefinition)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save join: ${response.statusText}`);
            }
            
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
                dataModels.value[modelIndex] = {
                    ...dataModels.value[modelIndex],
                    refresh_status: status,
                    last_refreshed_at: metadata.lastRefreshedAt || dataModels.value[modelIndex].last_refreshed_at,
                    row_count: metadata.rowCount || dataModels.value[modelIndex].row_count,
                    last_refresh_duration_ms: metadata.duration || dataModels.value[modelIndex].last_refresh_duration_ms,
                    refresh_error: metadata.error || null
                };
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
        
        const url = `${baseUrl()}/refresh/data-model/${dataModelId}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to trigger refresh');
        }
        
        const data = await response.json();
        
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
        
        const url = `${baseUrl()}/refresh/cascade/${dataSourceId}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to trigger cascade refresh');
        }
        
        const data = await response.json();
        
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
        
        const url = `${baseUrl()}/refresh/history/${dataModelId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get refresh history');
        }
        
        return await response.json();
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
        getRefreshHistory
    }
});
