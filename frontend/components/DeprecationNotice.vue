<script setup lang="ts">
/**
 * DeprecationNotice — floating banner shown on orphaned pages before auto-redirect.
 *
 * Rendered globally via the project layout. Only visible when
 * `useDeprecationRedirect().state.isActive` is true.
 *
 * TICKET NAV-003: Kill Orphaned Pages — Redirect & Deprecate
 */

const { state, goNow, dismiss } = useDeprecationRedirect();

/** Friendly label derived from the new path's hash fragment */
const tabLabel = computed(() => {
    if (!state.newPath) return '';
    const hash = state.newPath.split('#')[1];
    if (!hash) return 'Overview';
    return hash.charAt(0).toUpperCase() + hash.slice(1);
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-[transform,opacity] duration-300 ease-out"
            enter-from-class="-translate-y-full opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition-[transform,opacity] duration-200 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="-translate-y-full opacity-0"
        >
            <div
                v-if="state.isActive"
                class="fixed top-0 left-0 right-0 z-[9999] print:hidden"
                role="alert"
                aria-live="assertive"
            >
                <!-- Banner -->
                <div class="bg-amber-50 border-b border-amber-300 shadow-lg">
                    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
                        <!-- Icon -->
                        <font-awesome-icon
                            :icon="['fas', 'triangle-exclamation']"
                            class="text-amber-600 text-lg flex-shrink-0"
                        />

                        <!-- Message -->
                        <p class="text-sm text-amber-900 flex-1">
                            <span class="font-semibold">This page has moved.</span>
                            Redirecting to
                            <span class="font-medium">Intelligence Hub{{ tabLabel ? ` → ${tabLabel}` : '' }}</span>
                            in a moment&hellip;
                        </p>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                                       text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300
                                       transition-colors cursor-pointer"
                                @click="goNow()"
                            >
                                Go now
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[10px]" />
                            </button>
                            <button
                                type="button"
                                class="p-1.5 text-amber-500 hover:text-amber-700 transition-colors cursor-pointer"
                                aria-label="Dismiss"
                                @click="dismiss()"
                            >
                                <font-awesome-icon :icon="['fas', 'xmark']" class="text-sm" />
                            </button>
                        </div>
                    </div>

                    <!-- Progress bar (depletes over 2 seconds) -->
                    <div class="h-0.5 bg-amber-200 overflow-hidden">
                        <div class="h-full bg-amber-500 w-full animate-deprecation-countdown" />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

