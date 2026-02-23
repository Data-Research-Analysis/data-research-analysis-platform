<template>
    <v-dialog v-model="showDialog" max-width="900px" persistent>
        <v-card>
            <v-card-title class="text-h5 bg-primary">
                <span class="text-white">Configure Cross-Source Join</span>
                <v-spacer></v-spacer>
                <v-btn icon @click="closeDialog" variant="text" class="text-white">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pt-4">
                <v-alert v-if="suggestions.length > 0" type="info" variant="tonal" class="mb-4">
                    💡 We found {{ suggestions.length }} suggested join(s) based on column similarity
                </v-alert>

                <!-- Suggested Joins Section -->
                <div v-if="suggestions.length > 0" class="mb-6">
                    <h3 class="text-subtitle-1 font-weight-bold mb-3">Suggested Joins</h3>
                    <v-list>
                        <v-list-item
                            v-for="(suggestion, index) in suggestions"
                            :key="index"
                            class="border rounded mb-2"
                            @click="applySuggestion(suggestion)"
                        >
                            <template v-slot:prepend>
                                <v-icon :color="getConfidenceColor(suggestion.confidence)">
                                    mdi-link-variant
                                </v-icon>
                            </template>
                            <v-list-item-title>
                                <strong>{{ suggestion.leftColumnName }}</strong> 
                                <v-icon size="small">mdi-arrow-left-right</v-icon>
                                <strong>{{ suggestion.rightColumnName }}</strong>
                            </v-list-item-title>
                            <v-list-item-subtitle>
                                {{ suggestion.reason }}
                            </v-list-item-subtitle>
                            <template v-slot:append>
                                <v-chip :color="getConfidenceColor(suggestion.confidence)" size="small">
                                    {{ suggestion.confidence }}% match
                                </v-chip>
                            </template>
                        </v-list-item>
                    </v-list>
                </div>

                <v-divider v-if="suggestions.length > 0" class="my-4"></v-divider>

                <!-- Manual Join Configuration -->
                <h3 class="text-subtitle-1 font-weight-bold mb-3">Manual Join Configuration</h3>
                
                <v-row>
                    <!-- Left Table Selection -->
                    <v-col cols="12" md="5">
                        <v-card variant="outlined">
                            <v-card-text>
                                <h4 class="text-caption text-uppercase mb-2">Left Table</h4>
                                <v-select
                                    v-model="joinConfig.leftTable"
                                    :items="leftTables"
                                    item-title="display"
                                    item-value="value"
                                    label="Select Table"
                                    density="compact"
                                    @update:model-value="onLeftTableChange"
                                ></v-select>
                                
                                <v-select
                                    v-model="joinConfig.leftColumn"
                                    :items="leftColumns"
                                    item-title="column_name"
                                    item-value="column_name"
                                    label="Select Column"
                                    density="compact"
                                    :disabled="!joinConfig.leftTable"
                                ></v-select>

                                <v-chip v-if="leftTableSource" size="small" class="mt-2" :color="getSourceColor(leftTableSource.type)">
                                    {{ leftTableSource.name }}
                                </v-chip>
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <!-- Join Type -->
                    <v-col cols="12" md="2" class="d-flex align-center justify-center">
                        <v-select
                            v-model="joinConfig.joinType"
                            :items="joinTypes"
                            density="compact"
                            label="Join Type"
                        ></v-select>
                    </v-col>

                    <!-- Right Table Selection -->
                    <v-col cols="12" md="5">
                        <v-card variant="outlined">
                            <v-card-text>
                                <h4 class="text-caption text-uppercase mb-2">Right Table</h4>
                                <v-select
                                    v-model="joinConfig.rightTable"
                                    :items="rightTables"
                                    item-title="display"
                                    item-value="value"
                                    label="Select Table"
                                    density="compact"
                                    @update:model-value="onRightTableChange"
                                ></v-select>
                                
                                <v-select
                                    v-model="joinConfig.rightColumn"
                                    :items="rightColumns"
                                    item-title="column_name"
                                    item-value="column_name"
                                    label="Select Column"
                                    density="compact"
                                    :disabled="!joinConfig.rightTable"
                                ></v-select>

                                <v-chip v-if="rightTableSource" size="small" class="mt-2" :color="getSourceColor(rightTableSource.type)">
                                    {{ rightTableSource.name }}
                                </v-chip>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- Preview -->
                <v-alert v-if="isValidJoin" type="success" variant="outlined" class="mt-4">
                    <strong>Preview:</strong> 
                    {{ joinConfig.leftTable }}.{{ joinConfig.leftColumn }}
                    {{ joinConfig.joinType }}
                    {{ joinConfig.rightTable }}.{{ joinConfig.rightColumn }}
                </v-alert>
            </v-card-text>

            <v-card-actions class="px-6 pb-4">
                <v-checkbox
                    v-model="rememberJoin"
                    label="Remember this join for future suggestions"
                    density="compact"
                    hide-details
                ></v-checkbox>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
                <v-btn
                    color="primary"
                    @click="applyJoin"
                    :disabled="!isValidJoin"
                >
                    Apply Join
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDataModelsStore } from '~/stores/data_models';

const dataModelsStore = useDataModelsStore();

const props = defineProps({
    show: {
        type: Boolean,
        required: true
    },
    allTables: {
        type: Array,
        required: true,
        default: () => []
    }
});

const emit = defineEmits(['close', 'apply-join']);

const showDialog = computed({
    get: () => props.show,
    set: (value) => {
        if (!value) emit('close');
    }
});

const joinConfig = ref({
    leftTable: null,
    leftColumn: null,
    rightTable: null,
    rightColumn: null,
    joinType: 'INNER'
});

const joinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL'];
const suggestions = ref([]);
const rememberJoin = ref(true);
const leftColumns = ref([]);
const rightColumns = ref([]);

// Flatten all tables for selection
const allTablesList = computed(() => {
    const tables = [];
    props.allTables.forEach((source: any) => {
        source.tables?.forEach((table: any) => {
            tables.push({
                value: `${table.schema}.${table.table_name}`,
                display: `${source.dataSourceName} - ${table.table_name}`,
                schema: table.schema,
                table_name: table.table_name,
                columns: table.columns || [],
                sourceId: source.dataSourceId,
                sourceName: source.dataSourceName,
                sourceType: source.dataSourceType
            });
        });
    });
    return tables;
});

const leftTables = computed(() => allTablesList.value);
const rightTables = computed(() => {
    // Exclude the currently selected left table
    return allTablesList.value.filter(t => t.value !== joinConfig.value.leftTable);
});

const leftTableSource = computed(() => {
    if (!joinConfig.value.leftTable) return null;
    const table = allTablesList.value.find(t => t.value === joinConfig.value.leftTable);
    return table ? { name: table.sourceName, type: table.sourceType } : null;
});

const rightTableSource = computed(() => {
    if (!joinConfig.value.rightTable) return null;
    const table = allTablesList.value.find(t => t.value === joinConfig.value.rightTable);
    return table ? { name: table.sourceName, type: table.sourceType } : null;
});

const isValidJoin = computed(() => {
    return joinConfig.value.leftTable &&
           joinConfig.value.leftColumn &&
           joinConfig.value.rightTable &&
           joinConfig.value.rightColumn;
});

function onLeftTableChange() {
    joinConfig.value.leftColumn = null;
    const table = allTablesList.value.find(t => t.value === joinConfig.value.leftTable);
    leftColumns.value = table?.columns || [];
    
    // Fetch suggestions when both tables are selected
    if (joinConfig.value.rightTable) {
        fetchJoinSuggestions();
    }
}

function onRightTableChange() {
    joinConfig.value.rightColumn = null;
    const table = allTablesList.value.find(t => t.value === joinConfig.value.rightTable);
    rightColumns.value = table?.columns || [];
    
    // Fetch suggestions when both tables are selected
    if (joinConfig.value.leftTable) {
        fetchJoinSuggestions();
    }
}

async function fetchJoinSuggestions() {
    if (!joinConfig.value.leftTable || !joinConfig.value.rightTable) return;
    
    const leftTable = allTablesList.value.find(t => t.value === joinConfig.value.leftTable);
    const rightTable = allTablesList.value.find(t => t.value === joinConfig.value.rightTable);
    
    if (!leftTable || !rightTable) return;
    
    try {
        const result = await dataModelsStore.suggestJoins(
            { 
                table_name: leftTable.table_name,
                schema: leftTable.schema,
                columns: leftTable.columns,
                data_source_id: leftTable.sourceId
            },
            { 
                table_name: rightTable.table_name,
                schema: rightTable.schema,
                columns: rightTable.columns,
                data_source_id: rightTable.sourceId
            }
        );
        
        suggestions.value = result || [];
    } catch (error) {
        console.error('[CrossSourceJoinDialog] Error fetching suggestions:', error);
        suggestions.value = [];
    }
}

function applySuggestion(suggestion: any) {
    joinConfig.value.leftColumn = suggestion.leftColumnName;
    joinConfig.value.rightColumn = suggestion.rightColumnName;
    joinConfig.value.joinType = suggestion.suggestedJoinType;
}

function getConfidenceColor(confidence: number) {
    if (confidence >= 90) return 'success';
    if (confidence >= 70) return 'info';
    if (confidence >= 50) return 'warning';
    return 'error';
}

function getSourceColor(sourceType: string) {
    const colors: Record<string, string> = {
        'postgresql': 'blue',
        'mysql': 'orange',
        'mariadb': 'orange',
        'excel': 'green',
        'pdf': 'red',
        'google_analytics': 'purple',
        'google_ad_manager': 'indigo',
        'google_ads': 'pink',
        'meta_ads': 'blue',
        'linkedin_ads': 'cyan'
    };
    return colors[sourceType?.toLowerCase()] || 'grey';
}

async function applyJoin() {
    if (!isValidJoin.value) return;
    
    const joinDefinition = {
        leftTable: joinConfig.value.leftTable,
        leftColumn: joinConfig.value.leftColumn,
        rightTable: joinConfig.value.rightTable,
        rightColumn: joinConfig.value.rightColumn,
        joinType: joinConfig.value.joinType,
        leftTableInfo: allTablesList.value.find(t => t.value === joinConfig.value.leftTable),
        rightTableInfo: allTablesList.value.find(t => t.value === joinConfig.value.rightTable)
    };
    
    // Save to catalog if requested
    if (rememberJoin.value) {
        const leftTable = allTablesList.value.find(t => t.value === joinConfig.value.leftTable);
        const rightTable = allTablesList.value.find(t => t.value === joinConfig.value.rightTable);
        
        if (leftTable && rightTable) {
            await dataModelsStore.saveJoinToCatalog({
                leftDataSourceId: leftTable.sourceId,
                leftTableName: leftTable.table_name,
                leftColumnName: joinConfig.value.leftColumn,
                rightDataSourceId: rightTable.sourceId,
                rightTableName: rightTable.table_name,
                rightColumnName: joinConfig.value.rightColumn,
                joinType: joinConfig.value.joinType
            });
        }
    }
    
    emit('apply-join', joinDefinition);
    closeDialog();
}

function closeDialog() {
    // Reset form
    joinConfig.value = {
        leftTable: null,
        leftColumn: null,
        rightTable: null,
        rightColumn: null,
        joinType: 'INNER'
    };
    suggestions.value = [];
    rememberJoin.value = true;
    
    emit('close');
}

// Watch for dialog opening to potentially prefetch suggestions
watch(() => props.show, (newVal) => {
    if (newVal) {
        suggestions.value = [];
    }
});
</script>

<style scoped>
.border {
    border: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item {
    cursor: pointer;
    transition: background-color 0.2s;
}

.v-list-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
}
</style>
