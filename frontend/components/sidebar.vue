<script setup>
import { useDashboardsStore } from '~/stores/dashboards';

const dashboardsStore = useDashboardsStore();
const route = useRoute();
const emits = defineEmits(['add:selectedColumns', 'remove:selectedColumns', 'toggleSidebar']);
const state = reactive({
    dataModelsOpened: true,
    dataModels: [],
    sideBarStatus: true,
})
const props = defineProps({
    dataModels: {
        type: Array,
        default: () => [],
    },
    selectedChart: {
        type: Object,
        default: () => null,
    },
});
watch(
  route,
  (value, oldValue) => {
    updateStatus();
  },
);
const columnsAdded = computed(() => {
    return dashboardsStore.getColumnsAdded();
});
function isDataModelEnabled(dataModel) {
    if (columnsAdded.value.length) {
        const tableName = columnsAdded.value[0].table_name;
        if (dataModel.model_name === tableName) {
            return true;
        }
        return false;
    }
    return true;
}
function toggleDataModels(dataModel) {
    dataModel.show_model = !dataModel.show_model;
}
function updateStatus() {
    if (route.name === 'projects-projectname-data-sources') {
        state.dataModelsStatus = false;
    }
}
function isColumnSelected(modelName, columnName) {
    return props?.selectedChart?.columns?.find((column) => column.table_name === modelName && column.column_name === columnName) ? true : false;
}
function toggleSelectedColumn(event, modelName, columnName) {
    if (event.target.checked) {
        emits('add:selectedColumns', {
            chart_id: props.selectedChart.chart_id,
            table_name: modelName,
            column_name: columnName,
        });
    } else {
        emits('remove:selectedColumns', {
            chart_id: props.selectedChart.chart_id,
            table_name: modelName,
            column_name: columnName,
        });
    }
}
function toggleSidebar() {
    state.sideBarStatus = !state.sideBarStatus;
    emits('toggleSidebar', state.sideBarStatus); 
}
</script>
<template>
    <div v-if="!state.sideBarStatus" class="relative min-h-150">
        <div class="absolute top-0 mr-2 bg-gray-100 hover:bg-gray-300 border border-gray-400 hover:border-gray-400 border-1 pl-2 pr-2 shadow-lg cursor-pointer" 
                v-tippy="{ content: 'Expand Sidebars', placement: 'right' }"
                @click="toggleSidebar"
            >
               <font-awesome 
                   icon="fas fa-angle-right"
                   class="text-md text-gray-600"                   
               />
           </div>
    </div>
    <div v-if="state.sideBarStatus" class="flex flex-col min-h-150 bg-gray-300 shadow-md relative">
        <div class="flex flex-row items-center ml-2 mr-2 p-2 text-lg font-bold cursor-pointer select-none">
            <h3 class="mr-2">Data Models</h3>
        </div>
        <div v-if="state.dataModelsOpened"
            class="flex flex-col mr-2 transition-all duration-500"
            :class="{
                'opacity-0': !state.dataModelsOpened,
                'opacity-100': state.dataModelsOpened,
                'h-0': !state.dataModelsOpened,
                'h-auto': state.dataModelsOpened
            }"
        >
            <div
                v-for="dataModel in props.dataModels"
                :key="dataModel.id"
                class="text-mdw-full h-10 flex items-center justify-start mb-2"
                :class="{
                    'opacity-0': !state.dataModelsOpened,
                    'opacity-100': state.dataModelsOpened,
                    'h-0': !state.dataModelsOpened,
                    'h-auto': state.dataModelsOpened
                }"
            >
                <div v-if="isDataModelEnabled(dataModel)" class="flex flex-col ml-4 select-none cursor-pointer ">
                    <div class="flex flex-row" @click="toggleDataModels(dataModel)">
                        <font-awesome v-if="!dataModel.show_model" icon="fas fa-angle-right" class="mt-1 mr-1" />
                        <font-awesome v-else="dataModel.show_model" icon="fas fa-angle-down" class="mt-1 mr-1" />
                        <h5 class="w-full"
                            v-tippy="{ content: `${dataModel.cleaned_model_name}`, placement: 'right' }"
                        >
                            {{ dataModel.cleaned_model_name.length > 20 ? `${dataModel.cleaned_model_name.substring(0, 20)}...`: dataModel.cleaned_model_name }}
                        </h5>
                    </div>
                    <div v-if="dataModel.show_model">
                        <draggable
                            class="ml-6"
                            :list="dataModel.columns"
                            :group="{ name: 'data_model_columns', pull: 'clone', put: false }"
                            itemKey="column_name"
                        >
                            <template #item="{ element, index }">
                                <div class="flex flex-row items-center">
                                    <div v-if="props.selectedChart && props.selectedChart.chart_id && props.selectedChart.config.add_columns_enabled" class="h-10 flex flex-col justify-center">
                                        <input type="checkbox" class="cursor-pointer mt-1 scale-150" :checked="isColumnSelected(dataModel.model_name, element.column_name)" @change="toggleSelectedColumn($event, dataModel.model_name, element.column_name)"/>
                                    </div>
                                    <div class="h-10 flex flex-col justify-center">
                                        <h6 v-tippy="{content:`Column Name: ${element.column_name}<br />Column Data Type: ${element.data_type}`}" class="text-sm font-bold hover:text-gray-500 p-1 m-1">
                                            {{ element.column_name.length > 20 ? `${element.column_name.substring(0, 20)}...`: element.column_name }}
                                        </h6>
                                    </div>
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>
                <div v-else class="flex flex-row items-center text-gray-500 ml-4 select-none"
                    v-tippy="{ content: 'Delete all of the columns from the selected data model to add columns from this data model.', placement: 'right' }"
                >
                    <font-awesome icon="fas fa-angle-right" class="mt-1 mr-1" />
                    {{ dataModel.cleaned_model_name.length > 20 ? `${dataModel.cleaned_model_name.substring(0, 20)}...`: dataModel.cleaned_model_name }}
                </div>
            </div>
        </div>        
        <div class="absolute top-0 -right-4 mr-2 bg-gray-100 hover:bg-gray-300 border border-gray-400 hover:border-gray-400 border-1 pl-2 pr-2 shadow-lg cursor-pointer" 
            v-tippy="{ content: 'Collapse Sidebars', placement: 'right' }"
            @click="toggleSidebar"
        >
            <font-awesome 
                icon="fas fa-angle-left"
                class="text-md text-gray-600"                   
            />
        </div>
    </div>
</template>