<script setup>
import { useArticlesStore } from '@/stores/articles';
const articlesStore = useArticlesStore();
const categories = computed(() => articlesStore.categories);
function editCategory(categoryId) {
}
function deleteCategory(categoryId) {
 
}
function addCategory() {
    
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Categories
                    </div>
                    <div
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                        @click="saveAsDraft"
                    >
                        Add Category
                    </div>
                </div>
                <div class="mt-3">
                    <table class="w-full table-auto table-striped">
                        <thead>
                            <tr class="h-10 bg-primary-blue-100 border border-solid">
                                <th class="px-4 py-2 border border-solid border-black text-white">ID</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Title</th>
                                <th class="px-4 py-2 boder border-solid border-black text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="category in categories" :key="category.id">
                                <td class="border px-4 py-2 text-center">{{ category.id }}</td>
                                <td class="border px-4 py-2">{{ category.title }}</td>
                                <td class="border px-4 py-2">
                                    <div class="flex flex-row justify-center">
                                        <button class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md">Edit</button>
                                        <button @click="articlesStore.deleteCategory(category.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-red-600 text-white hover:bg-red-700 cursor-pointer font-bold shadow-md">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>