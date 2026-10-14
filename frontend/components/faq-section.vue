<script setup lang="ts">
import { HOME_FAQ_DATA } from '@/constants/homeFaq';

// FAQ data is shared with pages/index.vue for FAQPage JSON-LD injection.
const faqData = HOME_FAQ_DATA;

// Expose faqData for parent to use in Schema.org injection
defineExpose({
    faqData
});
</script>

<template>
    <section id="faq" class="py-10">
        <div class="container mx-auto px-4 max-w-4xl">
            <h2 class="text-3xl font-bold text-primary-blue-100 text-center mb-12">Frequently Asked Questions</h2>
            <div class="space-y-6">
                <div v-for="(faq, index) in faqData" 
                     :key="index" 
                     class="bg-white p-6 rounded-lg shadow-md">
                    <h3 class="text-xl font-semibold mb-3 text-primary-blue-100">
                        {{ faq.question }}
                    </h3>
                    <p class="text-gray-700">{{ faq.answer }}</p>
                </div>
            </div>
        </div>
    </section>
</template>
