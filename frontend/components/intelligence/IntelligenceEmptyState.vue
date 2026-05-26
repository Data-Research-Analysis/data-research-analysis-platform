<script setup lang="ts">
/**
 * IntelligenceEmptyState — empty state component shown when no data sources
 * are connected in the Intelligence Hub.
 *
 * Displays a friendly message, illustration, and a CTA button that navigates
 * to the data connection flow.
 */

interface Props {
    /** The project id used to build the CTA link */
    projectId: number
    /** Optional title override */
    title?: string
    /** Optional message override */
    message?: string
}

const props = withDefaults(defineProps<Props>(), {
    title: 'Connect a data source to see your marketing intelligence',
    message: 'Link your ad platforms, analytics tools, or databases to unlock cross-channel performance metrics, attribution insights, and AI-powered recommendations.',
});
</script>

<template>
    <div class="intelligence-empty-state flex flex-col items-center justify-center py-16 md:py-24 text-center px-6">
        <!-- Illustration / icon cluster -->
        <div class="relative mb-6">
            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                <font-awesome-icon :icon="['fas', 'plug']" class="text-3xl text-blue-300" />
            </div>
            <!-- Decorative floating icons -->
            <span class="absolute -top-2 -right-3 w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
                <font-awesome-icon :icon="['fas', 'chart-line']" class="text-xs text-green-400" />
            </span>
            <span class="absolute -bottom-1 -left-3 w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                <font-awesome-icon :icon="['fas', 'robot']" class="text-xs text-amber-400" />
            </span>
        </div>

        <h2 class="text-base font-semibold text-gray-700 max-w-md">
            {{ title }}
        </h2>
        <p class="text-sm text-gray-400 mt-1.5 max-w-sm leading-relaxed">
            {{ message }}
        </p>

        <NuxtLink
            :to="`/projects/${projectId}/data-sources`"
            class="mt-6 inline-flex items-center gap-2 bg-primary-blue-100 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm"
        >
            <font-awesome-icon :icon="['fas', 'plus']" />
            Connect a Data Source
        </NuxtLink>

        <!-- Secondary link for wizard (if available) -->
        <NuxtLink
            :to="`/projects/${projectId}/data-sources/connect/wizard`"
            class="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
            <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="w-3 h-3" />
            Or try the Smart Connection Wizard
        </NuxtLink>
    </div>
</template>