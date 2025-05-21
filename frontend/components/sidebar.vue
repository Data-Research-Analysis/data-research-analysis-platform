<script setup>
const route = useRoute();
const state = reactive({
    dataModelsOpened: true,
    dataModels: [],
})
const props = defineProps({
    dataModels: {
        type: Array,
        default: () => [],
    },
});
watch(
  route,
  (value, oldValue) => {
    updateStatus();
  },
);
function toggleDataModels(dataModel) {
    dataModel.show_model = !dataModel.show_model;
}
function updateStatus() {
    if (route.name === 'projects-projectname-data-sources') {
        state.dataModelsStatus = false;
    }
}
onMounted(async () => {
    console.log('mounted props.dataModels', props.dataModels);
})
</script>
<template>
    <div class="flex flex-col min-h-150 bg-gray-300 shadow-md">
        <div class="flex flex-row items-center ml-2 mr-2 p-2 text-lg font-bold cursor-pointer select-none">
            <h3 class="ml-2 mr-2">Data Models</h3>
        </div>
        <div v-if="state.dataModelsOpened"
            class="flex flex-col ml-5 mr-2 transition-all duration-500"
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
                class="text-md cursor-pointer w-full h-10 flex items-center justify-start mb-2"
                :class="{
                    'opacity-0': !state.dataModelsOpened,
                    'opacity-100': state.dataModelsOpened,
                    'h-0': !state.dataModelsOpened,
                    'h-auto': state.dataModelsOpened
                }"
            >
                
                <div class="flex flex-col ml-4 select-none">
                    <div class="flex flex-row" @click="toggleDataModels(dataModel)">
                        <font-awesome v-if="!dataModel.show_model" icon="fas fa-angle-right" class="mt-1 mr-1" />
                        <font-awesome v-else="dataModel.show_model" icon="fas fa-angle-down" class="mt-1 mr-1" />
                        <h5 class="w-2/3 overflow-clip text-ellipsis"
                            v-tippy="{ content: `${dataModel.cleaned_model_name}`, placement: 'right' }"
                        >
                            {{ dataModel.cleaned_model_name }}
                        </h5>
                    </div>
                    <div v-if="dataModel.show_model">
                        <!-- <div v-for="column in dataModel.columns" :key="column.id" class="cursor-pointer ml-5"> -->
                            <draggable
                                class="ml-6"
                                :list="dataModel.columns"
                                :group="{ name: 'data_model_columns', pull: 'clone', put: false }"
                                itemKey="column_name"
                            >
                                <template #item="{ element, index }">
                                    <h6 v-tippy="{content:`Column Name: ${element.column_name}<br />Column Data Type: ${element.data_type}`}" class="text-sm font-bold w-2/3 overflow-clip text-ellipsis">{{ element.column_name }}</h6>
                                </template>
                            </draggable>
                        <!-- </div> -->
                    </div>
                </div>
            </div>
        </div>        
    </div>
</template>