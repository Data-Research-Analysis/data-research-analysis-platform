<script setup lang="ts">
const props = withDefaults(defineProps<{ variant?: 'blue' | 'white' }>(), {
    variant: 'blue',
});
</script>
<template>
    <section class="w-full py-20 px-6" :class="variant === 'blue' ? 'bg-primary-blue-100' : 'bg-white'">
        <div class="max-w-6xl mx-auto">
            <h2 class="font-bold text-center text-4xl mb-4" :class="variant === 'blue' ? 'text-white' : 'text-primary-blue-100'">
                Client planning eats your week
            </h2>
            <p class="text-center text-lg mb-16 max-w-2xl mx-auto" :class="variant === 'blue' ? 'text-blue-100' : 'text-primary-blue-100/70'">
                Three things every agency knows too well.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="rounded-xl p-8 border border-gray-100" :class="variant === 'blue' ? 'bg-white' : 'bg-gray-50'">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-excel" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Spreadsheet for every client</h3>
                    <p class="text-gray-600">You rebuild the same media plan by hand — version after version, client after client.</p>
                </div>
                <div class="rounded-xl p-8 border border-gray-100" :class="variant === 'blue' ? 'bg-white' : 'bg-gray-50'">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-clock" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Days before you can pitch</h3>
                    <p class="text-gray-600">Research, briefs, and decks take days before the client even sees the plan.</p>
                </div>
                <div class="rounded-xl p-8 border border-gray-100" :class="variant === 'blue' ? 'bg-white' : 'bg-gray-50'">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-camera" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Screenshots don't prove it</h3>
                    <p class="text-gray-600">When the client asks "did it work?", you're stitching screenshots together.</p>
                </div>
            </div>
            <div class="flex justify-center mt-12">
                <div class="w-64">
                    <combo-button label="Build a free client plan" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPlanBuilder()" />
                </div>
            </div>
        </div>
    </section>
</template>
