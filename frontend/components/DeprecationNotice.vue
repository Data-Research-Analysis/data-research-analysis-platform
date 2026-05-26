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
        <Transition name="deprecation-slide">
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
                        <div class="h-full bg-amber-500 deprecation-progress" />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Slide-in from top */
.deprecation-slide-enter-active {
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
.deprecation-slide-leave-active {
    transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.deprecation-slide-enter-from,
.deprecation-slide-leave-to {
    transform: translateY(-100%);
    opacity: 0;
}

/* Progress bar animation — shrinks from 100% to 0% over 2 seconds */
.deprecation-progress {
    width: 100%;
    animation: deprecation-countdown 2s linear forwards;
}

@keyframes deprecation-countdown {
    from {
        width: 100%;
    }
    to {
        width: 0%;
    }
}
</style>