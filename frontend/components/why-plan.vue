<script setup lang="ts">
</script>
<template>
    <section class="bg-white w-full py-20 px-6">
        <div class="max-w-5xl mx-auto">
            <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">
                Why a plan builder — not another dashboard?
            </h2>
            <p class="text-primary-blue-100/70 text-center text-lg mb-16 max-w-2xl mx-auto">
                A dashboard tells you what happened. It can't tell you whether it was the right call — because there was no plan to compare against.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div class="text-sm font-bold text-primary-blue-100 mb-2">1 · Proof needs a baseline</div>
                    <p class="text-gray-600">You can't prove ROI without targets set before you spend. The plan is that baseline.</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div class="text-sm font-bold text-primary-blue-100 mb-2">2 · Budgets follow a plan</div>
                    <p class="text-gray-600">Channel budgets and targets decide where the money goes — not last month's gut feel.</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div class="text-sm font-bold text-primary-blue-100 mb-2">3 · Then you prove it</div>
                    <p class="text-gray-600">Connect your data, compare actuals to the plan, and show exactly what worked.</p>
                </div>
            </div>
            <div class="flex justify-center">
                <div class="w-64">
                    <combo-button label="Build the baseline" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPlanBuilder()" />
                </div>
            </div>
        </div>
    </section>
</template>
