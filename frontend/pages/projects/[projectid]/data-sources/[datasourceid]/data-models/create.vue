<script setup>
import _ from 'lodash';
const { $swal } = useNuxtApp();
const route = useRoute();
const dataModelRef = useTemplateRef('dataModelRef');
const state = reactive({
    show_dialog: false,
    tables: [
    ],
    data_table: {
        table_name: 'Table 1',
        columns: [
        ],
        query_options: {
            where: [],
            group_by: [],
            order_by: [],
            offset: 0,
            limit: 0,
        }
    },
    loading: false,
    query_options: [
        {
            name: 'WHERE',
        },
        {
            name: 'GROUP BY',
        },
        {
            name: 'OFFSET',
        },
        {
            name: 'LIMIT',
        },
        {
            name: 'ORDER BY',
        },
    ],
    equality: ['=', '>', '<', '>=', '<=', '!='],
    condition: ['AND', '0R'],
    order: ['ASC', 'DESC'],
    
});
const showWhereClause = computed(() => {
    return state?.data_table?.query_options?.where?.length > 0;
});
const showOrderByClause = computed(() => {
    return state?.data_table?.query_options?.order_by?.length > 0;
});
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}
function changeDataModel(event) {
    state.data_table.columns = state.data_table.columns.filter((column) => {
         //Remove the foreign key column. Do not allow to columns that are foreign keys in the referenced table
        if (event.added.element.reference.foreign_table_schema && event.added.element.reference.local_table_name === column.table_name && event.added.element.reference.local_column_name === column.column_name) {
            $swal.fire({
                icon: 'error',
                title: `Error!`,
                text: `The column can not be added to the data model.`,
            });
            return false
        }
        //remove duplicate columns
        if (state.data_table.columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
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
            "Authorization-Type": "auth",
        },
    });
    const data = await response.json();
    console.log('getDataSourceTables', data);
    state.tables = data
}
function deleteColumn(columnName) {
    state.data_table.columns = state.data_table.columns.filter((column) => {
        return column.column_name !== columnName;
    });
    if (state.data_table.columns.length === 0) {
        state.data_table.query_options.where = [];
        state.data_table.query_options.group_by = [];
        state.data_table.query_options.order_by = [];
        state.data_table.query_options.offset = 0;
        state.data_table.query_options.limit = 0;
    }
}
function isColumnInDataModel(columnName, tableName) {
    return state.data_table.columns.filter((column) => column.column_name === columnName && column.table_name === tableName).length > 0;
}
function addQueryOption(queryOption) {
    if (queryOption === 'WHERE') {
        state.data_table.query_options.where.push({
            name: queryOption,
            column: '',
            equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
            value: '',
            condition: '',// condition: 'AND', 'OR'
        });
    } else if (queryOption === 'GROUP BY') {
        state.data_table.query_options.group_by.push({
            name: queryOption,
            column: '',
        });
    } else if (queryOption === 'ORDER BY') {
        state.data_table.query_options.order_by.push({
            name: queryOption,
            columns: [],
            /**
             * 
             * {
             *   name: '',
             *   order: '',// order: 'ASC', 'DESC'
             *   }
             */
        });
    } else if (queryOption === 'OFFSET') {
        state.data_table.query_options.offset = 0;
    } else if (queryOption === 'LIMIT') {
        state.data_table.query_options.limit = 0;
    }
    state.show_dialog = false;
    console.log('state.data_table.query_options', state.data_table.query_options);
}
function removeQueryOption(index) {
    state.data_table.query_options.where.splice(index, 1);
}
async function saveDataModel() {
    let sqlQuery = '';
    let dataTables = state.data_table.columns.map((column) => `${column.schema}.${column.table_name}`);
    const fromJoinClauses = [];
    const tableCombinations = [];
    const lines = [];
    dataTables = _.uniq(dataTables);
    //TODO: Handle single table case. There will be no join clause in this case.
    if (dataTables.length === 1) {
        lines.push(`FROM ${dataTables[0]}`);
        sqlQuery = `SELECT ${state.data_table.columns.map((column) => `${column.schema}.${column.table_name}.${column.column_name}`).join(', ')}\n${lines.join('\n')}`;
    } else {
        for (let i = 0; i < dataTables.length; i++) {
            for (let j = 0; j < dataTables.length; j++) {
                if (dataTables[i] !== dataTables[j]) {
                    tableCombinations.push(`${dataTables[i]}-${dataTables[j]}`);
                }
            }
        }
        const relationshipReferences = state.tables.filter((table) => {
            return table.references.length > 0
        }).map((table) => table.references);
        relationshipReferences.forEach((references) => {
            references.forEach((reference) => {
                const tableCombinationString = `${reference.local_table_schema}.${reference.local_table_name}-${reference.foreign_table_schema}.${reference.foreign_table_name}`;
                if (tableCombinations.includes(tableCombinationString)) {
                    fromJoinClauses.push(reference);
                }
            });
        });
        fromJoinClauses.forEach((clause, index) => {
            if (index === 0) {
                lines.push(`FROM ${clause.local_table_schema}.${clause.local_table_name}`)
                lines.push(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)
                lines.push(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
            } else {
                if (!lines.includes(`JOIN ${clause.local_table_schema}.${clause.local_table_name}`)) {
                    lines.push(`JOIN ${clause.local_table_schema}.${clause.local_table_name}`)
                }
                if (!lines.includes(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)) {
                    lines.push(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)
                }
                if (!lines.includes(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)) {
                    lines.push(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
                }
            }
        });
        sqlQuery = `SELECT ${state.data_table.columns.map((column) => `${column.schema}.${column.table_name}.${column.column_name}`).join(', ')}\n${lines.join('\n')}`;
    }
    
    console.log('state.data_table.query_options', state.data_table.query_options);
    state.data_table.query_options.where.forEach((clause) => {
        if (clause.condition === '') {
            //first where clause
            sqlQuery += ` WHERE ${clause.column} ${state.equality[clause.equality]} '${clause.value}'\n`;
        } else {
            sqlQuery += ` ${state.condition[clause.condition]} ${clause.column} ${state.equality[clause.equality]} '${clause.value}'\n`;
        }
    });
    console.log('sqlQuery', sqlQuery);
}

function keepDataModelInViewPort() {
    //Keep the datatable in view while scrolling the page vertically. This allows the
    //user to see the datatable while scrolling the page which helps in dragging the columns
    //to the datamodel.
    document.addEventListener("scroll", () => {
        const dataModelContainer = document.getElementById("data-model-container");
        if (window.scrollY > 500) {
            const clientHeight = dataModelRef?.value?.clientHeight || 0;
            dataModelContainer.style.transform = `translateY(${window.scrollY - clientHeight}px)`;
        } else {
            setTimeout(() => {
                if (window.scrollY <= 500) {
                    dataModelContainer.style.transform = `translateY(0px)`;
                }
            }, 300);
        }
    })
}

onMounted(async () => {
    await getDataSourceTables();
    keepDataModelInViewPort();
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
                <h2 class="font-bold text-center mb-5">Tables</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                    <div v-for="table in state.tables" class="flex flex-col border border-primary-blue-100 border-solid p-1">
                        <h4 class="bg-gray-300 text-center font-bold p-1 mb-2">{{ table.schema }}.{{ table.table_name }}</h4>
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
                                        'bg-gray-200': !element.reference.foreign_table_schema ? index % 2 === 0 : false,
                                        'bg-red-100 border-t-1 border-b-1 border-red-300': isColumnInDataModel(element.column_name, table.table_name),
                                    }"
                                >
                                    Column: <strong>{{ element.column_name }}</strong><br />
                                    Column Data Type: {{ element.data_type }}<br />
                                    <div v-if="element.reference && element.reference.foreign_table_schema">
                                        <strong>Foreign Key Relationship Reference:</strong><br />
                                        <div class="border border-primary-blue-100 border-solid p-2 m-1">
                                            Foreign Table Name: <strong>{{ element.reference.foreign_table_schema }}.{{ element.reference.foreign_table_name }}</strong><br />
                                            Foreign Column Name: <strong>{{ element.reference.foreign_column_name }}</strong><br />
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>
            </div>
            <div class="w-1/2 flex flex-col">
                <h2 class="font-bold text-center mb-5">Data Model</h2>
                <div class="w-full border border-primary-blue-100 border-solid" id="data-model-container" ref="dataModelRef">
                    <div class="flex flex-col p-5">
                        <div class="flex flex-row justify-center bg-gray-300 text-center font-bold p-1 mb-2">
                            <h4 class="w-full font-bold">
                                {{ state.data_table.table_name }}
                            </h4>
                            <div class="w-auto" v-tippy="{ content: 'View the final query result of the data model as a table.' }">
                                <font-awesome icon="fas fa-expand" class="items-center self-center text-xl text-black hover:text-gray-400 cursor-pointer mr-4"/>
                            </div>
                        </div>
                        <draggable
                            class="list-group min-h-80 bg-gray-100"
                            :list="state.data_table.columns"
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
                        <div v-if="showWhereClause" class="w-full flex flex-col mt-10">
                            <h3 class="font-bold mb-2">Where</h3>
                            <div class="flex flex-col bg-gray-100 p-5">
                                <div v-for="(clause, index) in state.data_table.query_options.where" class="flex flex-row justify-between mb-5">
                                    <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Condition</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                            <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Column</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column">
                                            <option v-for="column in state.data_table.columns" :key="column.column_name" :value="column.column_name">{{ column.column_name }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Equality</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.equality">
                                            <option v-for="(equality, index) in state.equality" :key="index" :value="index">{{ equality }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Value</h5>
                                        <input type="text" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.value" />
                                    </div>
                                    <div v-if="index === state.data_table.query_options.where.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('where')">
                                        <font-awesome icon="fas fa-plus"/>
                                    </div>
                                    <div v-else class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption(index)">
                                        <font-awesome icon="fas fa-minus"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="showOrderByClause" class="w-full flex flex-col mt-10">
                            <h3 class="font-bold mb-2">Order By</h3>
                            <div class="flex flex-col bg-gray-100 p-5">
                                <div v-for="(clause, index) in state.data_table.query_options.order_by" class="flex flex-row justify-between mb-5">
                                    <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Condition</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                            <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Column</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column">
                                            <option v-for="column in state.data_table.columns" :key="column.column_name" :value="column.column_name">{{ column.column_name }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Equality</h5>
                                        <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.equality">
                                            <option v-for="(equality, index) in state.equality" :key="index" :value="index">{{ equality }}</option>
                                        </select>
                                    </div>
                                    <div class="flex flex-col w-full mr-2">
                                        <h5 class="font-bold mb-2">Value</h5>
                                        <input type="text" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.value" />
                                    </div>
                                    <div v-if="index === state.data_table.query_options.where.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('where')">
                                        <font-awesome icon="fas fa-plus"/>
                                    </div>
                                    <div v-else class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption(index)">
                                        <font-awesome icon="fas fa-minus"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="state && state.data_table && state.data_table.columns && state.data_table.columns.length" class="w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 cursor-pointer mt-5 hover:bg-gray-100 font-bold" @click="openDialog">
                            + Add Query Clause (for example: where, group by, order by)
                        </div>
                        <div
                            v-if="state && state.data_table && state.data_table.columns && state.data_table.columns.length"
                            class="w-1/2 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                            @click="saveDataModel"
                        >
                            Save Data Model
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <overlay-dialog v-if="state.show_dialog" @close="closeDialog">
            <template #overlay>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <template v-for="queryOption in state.query_options" :key="queryOption.name">
                        <div class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none" @click="addQueryOption(queryOption.name)">
                            {{ queryOption.name }}
                        </div>
                    </template>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>