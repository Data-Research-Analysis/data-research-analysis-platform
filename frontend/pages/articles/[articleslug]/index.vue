<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const articlesStore = useArticlesStore();
const article = computed(() => articlesStore.getSelectedArticle());

</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
   
    </div>
</template>