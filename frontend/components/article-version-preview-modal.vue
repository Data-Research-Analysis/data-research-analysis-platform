<script setup lang="ts">
import type { IArticleVersion } from '~/types/IArticleVersion';

const props = defineProps({
    version: {
        type: Object as () => IArticleVersion,
        required: true,
    },
});

const emits = defineEmits(['close']);

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

</script>

<template>
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        @click.self="emits('close')"
    >
        <!-- Modal panel -->
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                    <h2 class="text-lg font-bold text-gray-800">
                        Version {{ version.version_number }} Preview
                    </h2>
                    <p class="text-sm text-gray-500 mt-0.5">
                        Saved {{ formatDate(version.created_at) }}
                        <span v-if="version.change_summary" class="ml-2 text-gray-400">
                            &mdash; {{ version.change_summary }}
                        </span>
                    </p>
                </div>
                <button
                    @click="emits('close')"
                    class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label="Close preview"
                >
                    <font-awesome icon="fas fa-times" class="text-lg" />
                </button>
            </div>

            <!-- Scrollable content -->
            <div class="overflow-y-auto flex-1 px-6 py-5">
                <!-- Title -->
                <h3 class="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                    {{ version.title }}
                </h3>

                <!-- Rendered HTML content -->
                <div
                    class="prose prose-sm sm:prose-base max-w-none text-gray-700"
                    v-html="version.content"
                ></div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                    @click="emits('close')"
                    class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
</template>
