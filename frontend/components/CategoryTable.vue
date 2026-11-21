<script setup lang="ts">
/**
 * CategoryTable — compact single-value breakdown card (category → value).
 */
interface Props {
    title: string
    rows: Array<{ category: string; value: number }>
    valueLabel?: string
    emptyText?: string
    formatValue?: (n: number) => string
}

const props = withDefaults(defineProps<Props>(), {
    valueLabel: 'Value',
    emptyText: 'No data',
    formatValue: undefined,
})

function fmt(n: number): string {
    if (props.formatValue) return props.formatValue(n)
    const v = Number(n) || 0
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return v.toLocaleString()
}
</script>

<template>
    <div class="bg-white border border-gray-200 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ title }}</h3>
        <div v-if="rows.length" class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead>
                    <tr class="text-left text-xs text-gray-500 border-b">
                        <th class="py-2 pr-4">Category</th>
                        <th class="py-2 text-right">{{ valueLabel }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in rows" :key="r.category" class="border-b last:border-0">
                        <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ r.category }}</td>
                        <td class="py-2 text-right">{{ fmt(r.value) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-else class="text-sm text-gray-400 py-6 text-center">{{ emptyText }}</p>
    </div>
</template>
