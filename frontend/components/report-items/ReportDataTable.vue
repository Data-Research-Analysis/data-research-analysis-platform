<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getAuthToken } from '~/composables/AuthToken'
import { useOrganizationContext } from '~/composables/useOrganizationContext'

interface Props {
  dataModelId: number | null
  columns: string[]
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  dataModelId: null,
  title: '',
})

const loading = ref(false)
const error = ref<string | null>(null)
const dataRows = ref<Record<string, any>[]>([])
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'ASC' | 'DESC'>('DESC')

async function fetchData() {
  if (!props.dataModelId || props.columns.length === 0) {
    dataRows.value = []
    return
  }

  loading.value = true
  error.value = null

  try {
    const { useAppFetch } = await import('~/composables/useAppFetch')
    const config = useRuntimeConfig()
    let token = getAuthToken()
    let authType = 'auth'
    const { getOrgHeaders } = useOrganizationContext()

    if (!token) {
      const tokenResp = await $fetch<any>(`${config.public.apiBase}/generate-token`)
      token = tokenResp.token
      authType = 'non-auth'
    }

    const response = await useAppFetch(
      `${config.public.apiBase}/data-model/${props.dataModelId}/explore`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': authType,
          'Content-Type': 'application/json',
          ...getOrgHeaders(),
        },
        body: {
          columns: props.columns,
          page: 0,
          pageSize: 100,
        },
      },
    )

    const respData = response?.data?.value ?? response
    const data = respData?.data || respData

    if (data?.rows && Array.isArray(data.rows)) {
      dataRows.value = data.rows
    } else if (data?.data && Array.isArray(data.data)) {
      dataRows.value = data.data
    } else {
      dataRows.value = []
    }
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Failed to load data'
    dataRows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.dataModelId, props.columns.join(',')],
  (newVal, oldVal) => {
    if (!oldVal || newVal[0] !== oldVal[0] || newVal[1] !== oldVal[1]) {
      fetchData()
    }
  },
  { immediate: true },
)

function toggleSort(col: string) {
  if (sortColumn.value === col) {
    sortDirection.value = sortDirection.value === 'DESC' ? 'ASC' : 'DESC'
  } else {
    sortColumn.value = col
    sortDirection.value = 'DESC'
  }
}

const sortedRows = computed(() => {
  const rows = [...dataRows.value]
  if (sortColumn.value) {
    rows.sort((a, b) => {
      const aVal = a[sortColumn.value!] ?? ''
      const bVal = b[sortColumn.value!] ?? ''
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection.value === 'ASC' ? aVal - bVal : bVal - aVal
      }
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDirection.value === 'ASC' ? cmp : -cmp
    })
  }
  return rows
})

function formatColumnName(col: string): string {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '\u2014'
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString()
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(val)
}
</script>

<template>
  <div class="report-data-table rounded-lg border border-gray-200 bg-white">
    <div
      v-if="title"
      class="flex items-center justify-between px-4 py-3 border-b border-gray-100"
    >
      <h3 class="text-sm font-semibold text-gray-800">{{ title }}</h3>
      <button
        class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        title="Refresh data"
        @click="fetchData"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="p-8 flex flex-col items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
      <p class="text-sm text-gray-500">Loading data...</p>
    </div>

    <div v-else-if="error" class="p-8 flex flex-col items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-sm text-red-600 font-medium mb-1">Failed to load data</p>
      <p class="text-xs text-gray-500 mb-3">{{ error }}</p>
      <button
        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        @click="fetchData"
      >
        Retry
      </button>
    </div>

    <div v-else-if="sortedRows.length === 0" class="p-8 flex flex-col items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <p class="text-sm text-gray-500">No data available</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/50">
            <th
              v-for="col in columns"
              :key="col"
              class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none transition-colors"
              @click="toggleSort(col)"
            >
              <span class="inline-flex items-center gap-1">
                {{ formatColumnName(col) }}
                <span v-if="sortColumn === col" class="text-blue-500">
                  {{ sortDirection === 'DESC' ? '\u2193' : '\u2191' }}
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in sortedRows"
            :key="idx"
            class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
          >
            <td
              v-for="col in columns"
              :key="col"
              class="px-4 py-3 tabular-nums text-gray-700"
            >
              {{ formatCellValue(row[col]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
      {{ sortedRows.length }} {{ sortedRows.length === 1 ? 'row' : 'rows' }}
    </div>
  </div>
</template>
