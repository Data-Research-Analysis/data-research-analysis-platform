<script setup lang="ts">
defineProps<{ gap: string }>();
</script>
<template>
    <section class="bg-primary-blue-100 w-full py-16 px-6 border-t border-white/10">
        <div class="max-w-6xl mx-auto">
            <h2 class="font-bold text-white text-center text-3xl mb-4">Plan → Prove</h2>
            <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">
                The gap is real. The loop closes it: plan where to spend, then prove it worked.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div class="text-sm font-semibold text-red-500 mb-2">Prove the gap</div>
                    <p class="text-gray-700">{{ gap }}</p>
                </div>
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div class="text-sm font-semibold text-primary-blue-100 mb-2">Plan the fix</div>
                    <p class="text-gray-700">Turn your website and brief into a channel-by-channel plan — budgets, targets, and the creative playbook.</p>
                </div>
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div class="text-sm font-semibold text-green-600 mb-2">Prove it</div>
                    <p class="text-gray-700">Connect your ad accounts, analytics, and data sources; track actuals against the plan and attribute revenue.</p>
                </div>
            </div>
            <div class="flex justify-center">
                <div class="w-64">
                    <combo-button label="Start with a plan" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPlanBuilder()" />
                </div>
            </div>
        </div>
    </section>
</template>
