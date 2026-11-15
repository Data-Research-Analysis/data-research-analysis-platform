<script setup lang="ts">
interface DeckPdf {
    label: string;
    src: string;
}

const props = withDefaults(defineProps<{ pdfs: DeckPdf[]; downloads?: DeckPdf[] }>(), {
    pdfs: () => [],
    downloads: () => [],
});

const open = ref(true);
const activeIndex = ref(0);
const active = computed(() => props.pdfs[activeIndex.value]);
</script>
<template>
    <section class="bg-white w-full py-20 px-6">
        <div class="max-w-5xl mx-auto text-center">
            <h2 class="font-bold text-primary-blue-100 text-4xl mb-4">See the full plan deck</h2>
            <p class="text-primary-blue-100/70 text-lg max-w-2xl mx-auto mb-8">
                A real plan we built for ourself — research, channel budgets, creative brief, copy, tracking, QA, and the client-ready deck.
            </p>

            <div v-if="!open" class="flex flex-col items-center gap-3">
                <combo-button label="View the full deck" color="primary" class="h-14 px-8 text-lg shadow-lg cursor-pointer" @click="open = true" />
            </div>

            <div v-else class="text-left">
                <div v-if="pdfs.length > 1" class="flex flex-wrap gap-2 justify-center mb-6">
                    <button
                        v-for="(pdf, i) in pdfs"
                        :key="pdf.src"
                        type="button"
                        class="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer"
                        :class="i === activeIndex ? 'bg-primary-blue-100 text-white border-primary-blue-100' : 'bg-white text-primary-blue-100 border-gray-200 hover:border-primary-blue-100'"
                        @click="activeIndex = i"
                    >
                        {{ pdf.label }}
                    </button>
                </div>

                <div class="rounded-2xl overflow-hidden border border-gray-200 shadow-2xl bg-gray-50">
                    <iframe
                        v-if="active"
                        :src="active.src"
                        :title="active.label"
                        class="w-full h-[80vh]"
                    ></iframe>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-4 mt-6">
                    <a
                        v-if="active"
                        :href="active.src"
                        download
                        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-blue-100 text-white font-semibold hover:bg-primary-blue-300 transition-colors"
                    >
                        <font-awesome icon="fas fa-download" /> Download PDF
                    </a>
                    <a
                        v-if="active"
                        :href="active.src"
                        target="_blank"
                        rel="noopener"
                        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Open in new tab
                    </a>
                    <button type="button" class="text-sm text-gray-500 hover:text-gray-700 underline" @click="open = false">
                        Close
                    </button>
                </div>

                <div v-if="downloads.length" class="flex flex-wrap items-center justify-center gap-3 mt-4">
                    <span class="text-xs text-gray-400">Also download:</span>
                    <a
                        v-for="file in downloads"
                        :key="file.src"
                        :href="file.src"
                        download
                        class="text-sm text-primary-blue-100 hover:underline"
                    >
                        {{ file.label }}
                    </a>
                </div>
            </div>
        </div>
    </section>
</template>
