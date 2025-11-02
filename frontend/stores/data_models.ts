import {defineStore} from 'pinia'
import type { IDataModel } from '~/types/IDataModel';
import type { IDataModelTable } from '~/types/IDataModelTable';
export const useDataModelsStore = defineStore('dataModelsDRA', () => {
    const dataModels = ref<IDataModel[]>([])
    const selectedDataModel = ref<IDataModel>()
    const dataModelTables = ref<IDataModelTable[]>([])
    
    // Only access localStorage on client side
    if (import.meta.client) {
        if (localStorage.getItem('dataModels')) {
            dataModels.value = JSON.parse(localStorage.getItem('dataModels') || '[]');
        }
        if (localStorage.getItem('selectedDataModel')) {
            selectedDataModel.value = JSON.parse(localStorage.getItem('selectedDataModel') || 'null');
        }
        if (localStorage.getItem('dataModelTables')) {
            dataModelTables.value = JSON.parse(localStorage.getItem('dataModelTables') || 'null');
        }
    }
    
    function setDataModels(dataModelsList: IDataModel[]) {
        dataModels.value = dataModelsList;
        if (import.meta.client) {
            localStorage.setItem('dataModels', JSON.stringify(dataModelsList));
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
        }
    }
    function getDataModels() {
        return dataModels.value;
    }
    function getDataModelTables() {
        return dataModelTables.value;
    }
    async function retrieveDataModels() {
        const token = getAuthToken();
        if (!token) {
            dataModels.value = [];
            return;
        }
        const url = `${baseUrl()}/data-model/list`;
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
        return selectedDataModel.value
    }
    function clearDataModels() {
        dataModels.value = []
        if (import.meta.client) {
            localStorage.removeItem('dataModels')
        }
    }
    function clearSelectedDataModel() {
        selectedDataModel.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDataModel')
        }
    }
    
    return {
        dataModels,
        selectedDataModel,
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
    }
});
