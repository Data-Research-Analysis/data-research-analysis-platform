<script setup>
const route = useRoute();
const state = reactive({
    show_dialog: false,
    tables: [
    ],
    tables2: [
        {
            table_name: 'Table 1',
            columns: [
            ],
        }
    ],
    list: [{
        id: 1, email: 'mustafa.neguib@gmail.com', first_name: 'Mustafa'
    }],
    loading: false,
    query_options: [
        {
            name: 'where',
        },
        {
            name: 'group by',
        },
        {
            name: 'offset',
        },
        {
            name: 'limit',
        },
        {
            name: 'order by',
        },
    ],
});
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}
function changeDataModel(event) {
    //remove duplicate columns
    state.tables2[0].columns = state.tables2[0].columns.filter((column) => {
        if (state.tables2[0].columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
            return false;
        } else {
            return true;
        }
    });
}
async function getDataSourceTables() {
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/tables/${route.params.datasourceid}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization_Type": "auth",
        },
    });
    const data = await response.json();
    console.log('getDataSourceTables', data);
    state.tables = data
}
function deleteColumn(columnName) {
    state.tables2[0].columns = state.tables2[0].columns.filter((column) => {
        return column.column_name !== columnName;
    });
}
onMounted(async () => {
    await getDataSourceTables();
})
</script>
<template>
   <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Create A Data Model from the Connected Data Source
        </div>
        <div class="text-md mb-10">
            You can create a new data model from the tables given below by dragging into the empty block shown in the data model section to the right.
        </div>
        <div class="flex flex-row m-10">
            <div class="w-1/2 flex flex-col pr-5 mr-5 border-r-2 border-primary-blue-100">
                <div class="text-lg font-bold text-center mb-5">Tables</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                    <div v-for="table in state.tables" class="flex flex-col border border-primary-blue-100 border-solid p-1">
                        <div class="bg-gray-300 text-center font-bold p-1 mb-2">{{ table.table_name }}</div>
                        <draggable
                            class="list-group"
                            :list="table.columns"
                            :group="{
                                name: 'tables',
                                pull: 'clone',
                                put: false,
                            }"
                            itemKey="name"
                            >
                            <template #item="{ element, index }">
                                <div class="list-group-item cursor-pointer p-1 ml-2 mr-2"
                                    :class="{
                                        'bg-gray-200': index % 2 === 0,
                                    }"
                                >
                                    Column: {{ element.column_name }}<br />
                                    Column Data Type: {{ element.data_type }}
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>
            </div>
            <div class="w-1/2 flex flex-col">
                <div class="text-lg font-bold text-center mb-5">Data Model</div>
                <div class="w-full border border-primary-blue-100 border-solid">
                    <div class="flex flex-col p-5">
                        <div class="flex flex-row justify-center bg-gray-300 text-center font-bold p-1 mb-2">
                            <div class="w-full">
                                {{ state.tables2[0].table_name }}
                            </div>
                            <div class="w-auto">
                                <font-awesome icon="fas fa-expand" class="items-center self-center text-xl text-black hover:text-gray-400 cursor-pointer mr-4"
                                    v-tippy-content="'Expand to full screen'"
                                />
                            </div>
                        </div>
                        <draggable
                            class="list-group min-h-50 bg-gray-100"
                            :list="state.tables2[0].columns"
                            group="tables"
                            @change="changeDataModel"
                            itemKey="name"
                            >
                            <template #item="{ element, index }">
                                <div class="list-group-item cursor-pointer p-1 ml-2 mr-2"
                                :class="{
                                    'bg-gray-200': index % 2 === 0,
                                }"
                                    >
                                    <div class="flex flex-row justify-between">
                                        <div class="ml-2">
                                            Table: {{ element.table_name }}<br />
                                            <strong>Column: {{ element.column_name }}</strong><br />
                                            Column Data Type: {{ element.data_type }}
                                        </div>
                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="deleteColumn(element.column_name)">
                                            Delete
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </draggable>
                        <div class="w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 cursor-pointer mt-5 hover:bg-gray-100 font-bold" @click="openDialog">
                            + Add Section
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <overlay-dialog v-if="state.show_dialog" @close="closeDialog">
            <template #overlay>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <template v-for="queryOption in state.query_options" :key="queryOption.name">
                        <div class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none" >
                            {{ queryOption.name }}
                        </div>
                    </template>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>