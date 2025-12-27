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

// Column type detection
const categoricalTypes = ['varchar', 'text', 'char', 'string', 'date', 'datetime', 'timestamp', 'boolean', 'bool', 'enum'];
const numericalTypes = ['int', 'integer', 'bigint', 'float', 'double', 'decimal', 'numeric', 'real', 'number'];

function isCategorical(column) {
    const type = column.data_type?.toLowerCase() || '';
    return categoricalTypes.some(t => type.includes(t));
}

function isNumerical(column) {
    const type = column.data_type?.toLowerCase() || '';
    return numericalTypes.some(t => type.includes(t));
}

// Chart type requirements configuration
const chartTypeRequirements = {
    // Categorical-first charts
    pie: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Pie Chart' },
    donut: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Donut Chart' },
    vertical_bar: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Bar Chart' },
    horizontal_bar: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Horizontal Bar' },
    multiline: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Line Chart' },
    stacked_bar: { requiresCategoricalFirst: true, minCategorical: 2, minNumerical: 1, label: 'Stacked Bar' },
    vertical_bar_line: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 2, label: 'Combo Chart' },
    treemap: { requiresCategoricalFirst: true, minCategorical: 1, minNumerical: 1, label: 'Treemap' },
    
    // Flexible charts
    table: { requiresCategoricalFirst: false, minCategorical: 0, minNumerical: 0, label: 'Table' },
    bubble: { requiresCategoricalFirst: false, minCategorical: 0, minNumerical: 2, label: 'Bubble Chart' },
    text_block: { requiresCategoricalFirst: false, minCategorical: 0, minNumerical: 0, label: 'Text Block' },
};

// Check if user has selected a categorical column
const hasCategoricalSelection = computed(() => {
    if (!props.selectedChart?.columns) return false;
    return props.selectedChart.columns.some(col => {
        // Find the column in data models to check its type
        for (const dataModel of props.dataModels) {
            const column = dataModel.columns?.find(c => 
                c.column_name === col.column_name && dataModel.model_name === col.table_name
            );
            if (column && isCategorical(column)) {
                return true;
            }
        }
        return false;
    });
});

// Determine if checkbox should be shown for a column
function shouldShowCheckbox(column) {
    if (!props.selectedChart || !props.selectedChart.chart_type) {
        return true; // Default: show all checkboxes
    }
    
    const chartType = props.selectedChart.chart_type;
    const requirements = chartTypeRequirements[chartType];
    
    // If no specific requirements (table, text, etc.), show all checkboxes
    if (!requirements || !requirements.requiresCategoricalFirst) {
        return true;
    }
    
    // For charts requiring categorical first
    if (isCategorical(column)) {
        // Always show categorical checkboxes
        return true;
    }
    
    if (isNumerical(column)) {
        // Show numerical checkboxes only after categorical selection
        return hasCategoricalSelection.value;
    }
    
    return true; // Default: show checkbox
}

// Get helper text based on chart type and selection state
const helperText = computed(() => {
    if (!props.selectedChart || !props.selectedChart.chart_type || !props.selectedChart.config.add_columns_enabled) {
        return { show: false };
    }
    
    const chartType = props.selectedChart.chart_type;
    const requirements = chartTypeRequirements[chartType];
    
    if (!requirements || !requirements.requiresCategoricalFirst) {
        return { show: false };
    }
    
    if (!hasCategoricalSelection.value) {
        const minCat = requirements.minCategorical;
        return {
            show: true,
            type: 'blue',
            title: `Step 1: Select ${minCat} categorical column${minCat > 1 ? 's' : ''}`,
            subtitle: getChartHint(chartType, 'categorical')
        };
    } else {
        const minNum = requirements.minNumerical;
        return {
            show: true,
            type: 'green',
            title: `Step 2: Select ${minNum}${minNum > 1 ? '+' : ''} numerical column${minNum > 1 ? 's' : ''}`,
            subtitle: getChartHint(chartType, 'numerical')
        };
    }
});

function getChartHint(chartType, phase) {
    const hints = {
        pie: {
            categorical: 'Choose a category for slices (e.g., Product, Region)',
            numerical: 'Choose a value to measure (e.g., Sales, Revenue)'
        },
        donut: {
            categorical: 'Choose a category for segments (e.g., Category)',
            numerical: 'Choose a value to measure (e.g., Amount, Count)'
        },
        vertical_bar: {
            categorical: 'Choose categories for X-axis (e.g., Month, Product)',
            numerical: 'Choose values for Y-axis (e.g., Revenue, Quantity)'
        },
        horizontal_bar: {
            categorical: 'Choose categories for Y-axis (e.g., Department)',
            numerical: 'Choose values for X-axis (e.g., Budget, Headcount)'
        },
        multiline: {
            categorical: 'Choose X-axis (preferably date/time)',
            numerical: 'Choose metrics to plot as lines (e.g., Sales, Profit)'
        },
        stacked_bar: {
            categorical: 'Choose 2 categories (main category + stack dimension)',
            numerical: 'Choose a value to measure (e.g., Sales)'
        },
        vertical_bar_line: {
            categorical: 'Choose X-axis category (e.g., Month)',
            numerical: 'Choose 2+ values (bars + line metrics)'
        },
        treemap: {
            categorical: 'Choose hierarchy levels (e.g., Category, Sub-category)',
            numerical: 'Choose a value for size (e.g., Sales Amount)'
        }
    };
    
    return hints[chartType]?.[phase] || '';
}

// Get icon and color for column based on type
function getColumnIcon(column) {
    const type = column.data_type?.toLowerCase() || '';
    
    // Date/time columns
    if (['date', 'datetime', 'timestamp'].some(t => type.includes(t))) {
        return { icon: 'fa-calendar', color: 'text-purple-500' };
    }
    
    // Categorical columns
    if (isCategorical(column)) {
        return { icon: 'fa-font', color: 'text-blue-500' };
    }
    
    // Numerical columns
    if (isNumerical(column)) {
        return { icon: 'fa-hashtag', color: 'text-green-500' };
    }
    
    // Default
    return { icon: 'fa-database', color: 'text-gray-500' };
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
    <div v-if="state.sideBarStatus" class="flex flex-col min-h-150 bg-gray-300 shadow-md relative w-70">
        <div class="flex flex-row items-center ml-2 mr-2 p-2 text-lg font-bold cursor-pointer select-none">
            <h3 class="mr-2">Data Models</h3>
        </div>
        
        <!-- Helper text for smart column selection -->
        <div v-if="helperText.show" class="mx-2 mb-3">
            <div v-if="helperText.type === 'blue'" class="px-3 py-2 bg-blue-50 border-l-4 border-blue-400 text-sm rounded">
                <p class="font-medium text-blue-800">{{ helperText.title }}</p>
                <p class="text-blue-600 text-xs mt-1">{{ helperText.subtitle }}</p>
            </div>
            <div v-else-if="helperText.type === 'green'" class="px-3 py-2 bg-green-50 border-l-4 border-green-400 text-sm rounded">
                <p class="font-medium text-green-800">{{ helperText.title }}</p>
                <p class="text-green-600 text-xs mt-1">{{ helperText.subtitle }}</p>
            </div>
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
                                    <!-- Checkbox - conditionally shown based on chart type and selection -->
                                    <div v-if="props.selectedChart && props.selectedChart.chart_id && props.selectedChart.config.add_columns_enabled && shouldShowCheckbox(element)" 
                                         class="h-10 flex flex-col justify-center">
                                        <input 
                                            type="checkbox" 
                                            class="cursor-pointer mt-1 scale-150"
                                            :checked="isColumnSelected(dataModel.model_name, element.column_name)" 
                                            @change="toggleSelectedColumn($event, dataModel.model_name, element.column_name)"
                                        />
                                    </div>
                                    
                                    <!-- Column Type Icon -->
                                    <div class="flex items-center mx-2">
                                        <font-awesome 
                                            :icon="getColumnIcon(element).icon"
                                            :class="getColumnIcon(element).color"
                                            class="text-sm"
                                        />
                                    </div>
                                    
                                    <!-- Column name - always visible, always black -->
                                    <div class="h-10 flex flex-col justify-center">
                                        <h6 
                                            v-tippy="{
                                                content: `Column Name: ${element.column_name}<br />Column Data Type: ${element.data_type}`
                                            }" 
                                            class="text-sm font-bold hover:text-gray-500 p-1 m-1"
                                        >
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