<script setup lang="ts">
interface PayoffStat {
    text: string;
    tag: 'Research' | 'Derived' | 'Internal' | 'Product';
}

interface Props {
    variant?: 'dark' | 'light';
    eyebrow?: string;
    headline?: string;
    sub?: string;
    stats: PayoffStat[];
    roiStrip?: string;
    bullets?: string[];
    ctaLabel?: string;
    ctaAction?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'dark',
    eyebrow: '',
    headline: '',
    sub: '',
    roiStrip: '',
    bullets: () => [],
    ctaLabel: '',
    ctaAction: undefined,
});
</script>

<template>
    <section
        class="w-full relative flex flex-col items-center py-20 px-6"
        :class="variant === 'dark' ? 'bg-primary-blue-100' : 'bg-white border-b border-gray-100'"
    >
        <div class="max-w-5xl mx-auto text-center">
            <p
                v-if="eyebrow"
                class="text-sm font-semibold uppercase tracking-widest mb-4"
                :class="variant === 'dark' ? 'text-blue-200' : 'text-primary-blue-100'"
            >
                {{ eyebrow }}
            </p>
            <h1
                v-if="headline"
                class="font-bold text-4xl md:text-5xl leading-tight mb-6"
                :class="variant === 'dark' ? 'text-white' : 'text-primary-blue-100'"
            >
                {{ headline }}
            </h1>
            <p
                v-if="sub"
                class="text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
                :class="variant === 'dark' ? 'text-blue-100' : 'text-gray-600'"
            >
                {{ sub }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
                <div
                    v-for="(stat, index) in stats"
                    :key="index"
                    class="rounded-xl p-6"
                    :class="variant === 'dark' ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-50 border border-gray-100'"
                >
                    <span
                        class="inline-block text-[11px] font-semibold uppercase tracking-wide mb-2 px-2 py-0.5 rounded-full"
                        :class="variant === 'dark' ? 'bg-blue-200/20 text-blue-100' : 'bg-primary-blue-100/10 text-primary-blue-100'"
                    >
                        {{ stat.tag }}
                    </span>
                    <p
                        class="leading-relaxed"
                        :class="variant === 'dark' ? 'text-blue-50' : 'text-gray-700'"
                    >
                        {{ stat.text }}
                    </p>
                </div>
            </div>

            <div
                v-if="roiStrip"
                class="inline-block rounded-lg px-6 py-3 mb-8 text-lg font-semibold"
                :class="variant === 'dark' ? 'bg-white text-primary-blue-100' : 'bg-primary-blue-100 text-white'"
            >
                {{ roiStrip }}
            </div>

            <ul v-if="bullets.length" class="max-w-2xl mx-auto mb-8 space-y-3 text-left">
                <li
                    v-for="(bullet, index) in bullets"
                    :key="index"
                    class="flex items-start gap-3"
                >
                    <div
                        class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        :class="variant === 'dark' ? 'bg-green-400/20' : 'bg-green-100'"
                    >
                        <font-awesome
                            icon="fas fa-check"
                            class="text-xs"
                            :class="variant === 'dark' ? 'text-green-300' : 'text-green-600'"
                        />
                    </div>
                    <span :class="variant === 'dark' ? 'text-blue-50' : 'text-gray-700'">
                        {{ bullet }}
                    </span>
                </li>
            </ul>

            <div v-if="ctaLabel && ctaAction" class="w-72 mx-auto">
                <combo-button
                    :label="ctaLabel"
                    :color="variant === 'dark' ? 'white' : 'primary'"
                    class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer"
                    @click="ctaAction"
                />
            </div>
        </div>
    </section>
</template>
