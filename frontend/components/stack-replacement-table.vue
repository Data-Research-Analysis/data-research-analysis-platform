<script setup lang="ts">
const rows = [
    { label: 'Data pipeline', cost: '~$549/month' },
    { label: 'BI layer', cost: '~$150+/month' },
    { label: 'Attribution platform', cost: '$1,500+/month' },
    { label: 'Marketing data analyst', cost: '~$5,800 to $7,750/month' },
    { label: 'What you pay today', cost: 'well over $8,000/month', highlight: true },
];
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <table class="w-full">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="py-4 px-6 text-left text-sm font-semibold text-gray-900">Component</th>
                        <th class="py-4 px-6 text-right text-sm font-semibold text-gray-900">Monthly cost</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr
                        v-for="(row, index) in rows"
                        :key="index"
                        :class="row.highlight ? 'bg-primary-blue-100/5' : ''"
                    >
                        <td class="py-4 px-6 text-sm" :class="row.highlight ? 'font-bold text-gray-900' : 'text-gray-700'">
                            {{ row.label }}
                        </td>
                        <td class="py-4 px-6 text-right text-sm" :class="row.highlight ? 'font-bold text-primary-blue-100' : 'font-semibold text-gray-800'">
                            {{ row.cost }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p class="inline-block text-xs text-gray-500 bg-white/90 border border-gray-100 rounded-lg px-3 py-2 mt-3 text-center">
            Pipeline, BI, and attribution figures are vendor list prices. Analyst cost is derived from a $70,000 to $93,000 annual salary (PayScale, Glassdoor 2026).
        </p>
    </div>
</template>
