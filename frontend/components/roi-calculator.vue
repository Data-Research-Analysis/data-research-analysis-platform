<script setup lang="ts">
const DRA_MONTHLY_PRICE = 129;

const monthlySpend = ref<number | null>(null);
const calculated = ref(false);
const waste = ref(0);
const multiple = ref(0);

const calculate = () => {
    const spend = Number(monthlySpend.value) || 0;
    if (spend <= 0) return;
    waste.value = Math.round(spend * 0.10);
    multiple.value = Math.max(0, Math.round(waste.value / DRA_MONTHLY_PRICE));
    calculated.value = true;
};

const formatCurrency = (value: number) => value.toLocaleString('en-US');
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h2 class="text-2xl font-bold text-primary-blue-100 text-center mb-6">See what you are losing.</h2>

            <form @submit.prevent="calculate" novalidate>
                <label for="roi-calc-spend" class="block text-sm font-medium text-gray-700 mb-2">
                    Your monthly ad spend
                </label>
                <div class="flex flex-col sm:flex-row gap-3 mb-4">
                    <div class="flex-1 relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                        <input
                            id="roi-calc-spend"
                            v-model.number="monthlySpend"
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="e.g. 50000"
                            class="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-900"
                        />
                    </div>
                    <button
                        type="submit"
                        class="px-8 py-3 bg-primary-blue-100 hover:bg-primary-blue-300 text-white rounded-lg font-semibold transition-colors cursor-pointer"
                    >
                        Calculate
                    </button>
                </div>
            </form>

            <div v-if="calculated" class="bg-primary-blue-100/5 border border-primary-blue-100/20 rounded-xl p-6 space-y-2">
                <p class="text-gray-800 leading-relaxed">
                    If 10% of your media budget is wasted, that is <strong class="text-primary-blue-100">${{ formatCurrency(waste) }} per month</strong>.
                </p>
                <p class="text-gray-800 leading-relaxed">
                    At your plan's price, that is a potential return of <strong class="text-green-600">{{ multiple }}x</strong> on your DRA investment.
                </p>
            </div>

            <p class="text-xs text-gray-500 mt-5 leading-relaxed">
                10% is a conservative industry benchmark. 78% of marketing decision-makers believe at least 10% of spend is wasted (Haus, 2026, via eMarketer). The average organization wastes 25% (DemandScience, 2026). Your result depends on your data.
            </p>
        </div>
    </div>
</template>
