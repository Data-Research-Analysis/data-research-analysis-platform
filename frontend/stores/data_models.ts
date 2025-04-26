import {defineStore} from 'pinia'
import type { IDataModel } from '~/types/IDataModel';
export const useDataModelsStore = defineStore('dataModelsDRA', () => {
    const dataModels = ref<IDataModel[]>([])
    const selectedDataModel = ref<IDataModel>()
    
    if (localStorage.getItem('projects')) {
        dataModels.value = JSON.parse(localStorage.getItem('dataModels') || '[]')
    }
    if (localStorage.getItem('selectedProject')) {
        selectedDataModel.value = JSON.parse(localStorage.getItem('selectedDataModel') || 'null')
    }
    function setDataModels(dataModelsList: IDataModel[]) {
        dataModels.value = dataModelsList
        localStorage.setItem('dataModels', JSON.stringify(dataModelsList))
    }
    function setSelectedDataModel(dataModel: IDataModel) {
        selectedDataModel.value = dataModel
        localStorage.setItem('selectedDataModel', JSON.stringify(dataModel))
    }
    function getDataModels() {
        return dataModels.value;
    }
    async function retrieveDataModels() {
        const token = getAuthToken();
        if (!token) {
            dataModels.value = [];
            return;
        }
        const url = `${baseUrl()}/data-models/list`;
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

    function getSelectedDataModel() {
        return selectedDataModel.value
    }
    function clearDataModels() {
        dataModels.value = []
        localStorage.removeItem('dataModels')
    }
    function clearSelectedDataModel() {
        selectedDataModel.value = undefined
        localStorage.removeItem('selectedDataModel')
    }
    
    return {
        dataModels,
        selectedDataModel,
        setDataModels,
        setSelectedDataModel,
        getDataModels,
        retrieveDataModels,
        clearDataModels,
        getSelectedDataModel,
        clearSelectedDataModel,
    }
});
