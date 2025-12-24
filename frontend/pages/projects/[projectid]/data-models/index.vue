<template>
  <div class="data-models-page">
    <v-container fluid>
      <!-- Header -->
      <v-row class="mb-4">
        <v-col>
          <h1 class="text-h4 mb-2">Data Models</h1>
          <p class="text-subtitle-1 text-medium-emphasis">
            Create and manage data models from your project's data sources
          </p>
        </v-col>
      </v-row>

      <!-- Action Buttons -->
      <v-row class="mb-6">
        <v-col>
          <v-btn-group>
            <!-- Single-source quick create dropdown -->
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn 
                  color="primary" 
                  v-bind="props"
                  prepend-icon="mdi-plus">
                  Create Data Model
                  <v-icon end>mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item 
                  v-for="source in dataSources" 
                  :key="source.id"
                  @click="createSingleSource(source.id)">
                  <template v-slot:prepend>
                    <v-icon :color="getSourceColor(source.data_type)">
                      {{ getSourceIcon(source.data_type) }}
                    </v-icon>
                  </template>
                  <v-list-item-title>From {{ source.name }}</v-list-item-title>
                  <v-list-item-subtitle>{{ source.data_type }}</v-list-item-subtitle>
                </v-list-item>
                <v-divider v-if="dataSources.length === 0"></v-divider>
                <v-list-item v-if="dataSources.length === 0" disabled>
                  <v-list-item-title>No data sources available</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <!-- Cross-source button -->
            <v-btn 
              color="secondary" 
              variant="outlined"
              prepend-icon="mdi-link-variant"
              :disabled="dataSources.length < 2"
              @click="createCrossSource">
              Create Cross-Source Model
            </v-btn>
          </v-btn-group>

          <!-- Helper text for cross-source -->
          <v-tooltip v-if="dataSources.length < 2" location="bottom">
            <template v-slot:activator="{ props }">
              <v-icon 
                v-bind="props" 
                class="ml-2" 
                size="small" 
                color="info">
                mdi-information
              </v-icon>
            </template>
            <span>Add at least 2 data sources to create cross-source models</span>
          </v-tooltip>
        </v-col>
      </v-row>

      <!-- Data Models List -->
      <v-row>
        <v-col>
          <v-card>
            <v-card-title>
              <v-row align="center">
                <v-col>Your Data Models</v-col>
                <v-col cols="auto">
                  <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Search models..."
                    single-line
                    hide-details
                    density="compact"
                    clearable>
                  </v-text-field>
                </v-col>
              </v-row>
            </v-card-title>

            <v-data-table
              :headers="headers"
              :items="filteredModels"
              :loading="loading"
              :search="search"
              items-per-page="10">
              
              <!-- Model name with cross-source indicator -->
              <template v-slot:item.name="{ item }">
                <div class="d-flex align-center">
                  <span>{{ item.name }}</span>
                  <v-chip 
                    v-if="item.is_cross_source" 
                    size="x-small" 
                    color="info" 
                    class="ml-2">
                    <v-icon start size="x-small">mdi-link-variant</v-icon>
                    Multi-Source
                  </v-chip>
                </div>
              </template>

              <!-- Data source(s) -->
              <template v-slot:item.sources="{ item }">
                <v-chip-group>
                  <v-chip 
                    v-for="source in getModelSources(item)" 
                    :key="source.id"
                    size="small"
                    :color="getSourceColor(source.data_type)">
                    <v-icon start size="small">{{ getSourceIcon(source.data_type) }}</v-icon>
                    {{ source.name }}
                  </v-chip>
                </v-chip-group>
              </template>

              <!-- Created date -->
              <template v-slot:item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>

              <!-- Actions -->
              <template v-slot:item.actions="{ item }">
                <v-btn 
                  icon="mdi-eye" 
                  size="small" 
                  variant="text"
                  @click="viewModel(item)">
                </v-btn>
                <v-btn 
                  icon="mdi-refresh" 
                  size="small" 
                  variant="text"
                  @click="refreshModel(item)">
                </v-btn>
                <v-btn 
                  icon="mdi-delete" 
                  size="small" 
                  variant="text"
                  color="error"
                  @click="deleteModel(item)">
                </v-btn>
              </template>

              <!-- Empty state -->
              <template v-slot:no-data>
                <div class="text-center pa-8">
                  <v-icon size="64" color="grey-lighten-1">mdi-table-off</v-icon>
                  <p class="text-h6 mt-4">No data models yet</p>
                  <p class="text-body-2 text-medium-emphasis">
                    Create your first data model to get started
                  </p>
                </div>
              </template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';

const router = useRouter();
const route = useRoute();
const dataModelsStore = useDataModelsStore();

const projectId = computed(() => parseInt(route.params.projectid as string));
const search = ref('');
const loading = ref(false);
const dataSources = ref<any[]>([]);

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Data Source(s)', key: 'sources', sortable: false },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

const dataModels = computed(() => dataModelsStore.dataModels);

const filteredModels = computed(() => {
  if (!search.value) return dataModels.value;
  
  const searchLower = search.value.toLowerCase();
  return dataModels.value.filter(model => 
    model.name.toLowerCase().includes(searchLower)
  );
});

onMounted(async () => {
  loading.value = true;
  try {
    // Fetch data models
    await dataModelsStore.fetchDataModels();
    
    // Fetch data sources - use the all-tables endpoint to get sources
    try {
      const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
      if (response && Array.isArray(response)) {
        dataSources.value = response.map((source: any) => ({
          id: source.dataSourceId,
          name: source.dataSourceName,
          data_type: source.dataSourceType
        }));
      }
    } catch (error) {
      console.error('Error fetching data sources:', error);
      dataSources.value = [];
    }
  } finally {
    loading.value = false;
  }
});

function createSingleSource(dataSourceId: number) {
  router.push(`/projects/${projectId.value}/data-sources/${dataSourceId}/data-models/create`);
}

function createCrossSource() {
  router.push(`/projects/${projectId.value}/data-models/create`);
}

function getModelSources(model: any) {
  if (model.is_cross_source && model.data_model_sources) {
    // Multi-source model
    return model.data_model_sources.map((dms: any) => dms.data_source);
  } else if (model.data_source) {
    // Single-source model
    return [model.data_source];
  }
  return [];
}

function getSourceColor(sourceType: string): string {
  const colors: Record<string, string> = {
    'postgresql': 'blue',
    'mysql': 'orange',
    'mariadb': 'orange-darken-2',
    'excel': 'green',
    'csv': 'green-lighten-1',
    'google_analytics': 'purple',
    'google_ad_manager': 'red',
    'google_ads': 'blue-grey',
    'pdf': 'red-lighten-1'
  };
  return colors[sourceType?.toLowerCase()] || 'grey';
}

function getSourceIcon(sourceType: string): string {
  const icons: Record<string, string> = {
    'postgresql': 'mdi-database',
    'mysql': 'mdi-database',
    'mariadb': 'mdi-database',
    'excel': 'mdi-file-excel',
    'csv': 'mdi-file-delimited',
    'google_analytics': 'mdi-google-analytics',
    'google_ad_manager': 'mdi-google-ads',
    'google_ads': 'mdi-google-ads',
    'pdf': 'mdi-file-pdf-box'
  };
  return icons[sourceType?.toLowerCase()] || 'mdi-database-outline';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function viewModel(model: any) {
  // TODO: Implement view functionality
  console.log('View model:', model);
}

function refreshModel(model: any) {
  // TODO: Implement refresh functionality
  console.log('Refresh model:', model);
}

function deleteModel(model: any) {
  // TODO: Implement delete functionality with confirmation
  console.log('Delete model:', model);
}
</script>

<style scoped>
.data-models-page {
  height: 100%;
}
</style>
