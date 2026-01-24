<script setup>
import { useArticlesStore } from '@/stores/articles';
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();
const state = reactive({
    is_editing: false,
    category_id_editing: null,
    category_title_editing: "",
});
const categories = computed(() => [...articlesStore.categories].sort((a, b) => a.id - b.id));
async function addCategory() {
    const inputValue = "";
    const { value: categoryTitle } = await $swal.fire({
        title: "Enter Category Title",
        input: "text",
        inputLabel: "Category Title",
        inputValue,
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        inputValidator: (value) => {
            if (!value) {
                return "Please enter in a title for the category!";
            }
        }
    });
    if (categoryTitle) {
        const token = getAuthToken();
        const requestOptions = {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                title: categoryTitle,
            },
        };
        try {
            await $fetch(`${baseUrl()}/admin/category/add`, {
                method: "POST",
                ...requestOptions
            });
            $swal.fire({
                title: `The category ${categoryTitle} has been created successfully.`,
                confirmButtonColor: "#3C8DBC",
            });
            await articlesStore.retrieveCategories();
        } catch (error) {
            $swal.fire({
                title: `There was an error creating the category ${categoryTitle}.`,
                confirmButtonColor: "#3C8DBC",
            });
        }
    }
}
async function submitEditingChanges() {
    const token = getAuthToken();
    const requestOptions = {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: {
            category_id: state.category_id_editing,
            title: state.category_title_editing,
        },
    };
    try {
        await $fetch(`${baseUrl()}/admin/category/edit`, {
            method: "POST",
            ...requestOptions
        });
        $swal.fire({
            title: `The category title has been changed successfully.`,
            confirmButtonColor: "#3C8DBC",
        });
    } catch (error) {
        $swal.fire({
            title: `There was an error changing the category title.`,
            confirmButtonColor: "#3C8DBC",
        });
    }
    await articlesStore.retrieveCategories();
    state.is_editing = false;
    state.category_id_editing = null;
}
function beginEditCategory(categoryId) {
    state.is_editing = true;
    state.category_id_editing = categoryId;
    state.category_title_editing = categories.value.find(category => category.id === categoryId).title;
}
async function deleteCategory(categoryId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the category?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }
    const token = getAuthToken();
    const requestOptions = {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    try {
        await $fetch(`${baseUrl()}/admin/category/delete/${categoryId}`, {
            method: "DELETE",
            ...requestOptions
        });
        $swal.fire(`The category has been deleted successfully.`);
    } catch (error) {
        $swal.fire(`There was an error deleting the category.`);
    }
    await articlesStore.retrieveCategories();
}

</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Categories
                    </div>
                    <div
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        @click="addCategory"
                    >
                        Add Category
                    </div>
                </div>
                <div class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="category in categories" :key="category.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ category.id }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <input v-if="state.is_editing && state.category_id_editing === category.id" type="text" v-model="state.category_title_editing" class="px-3 py-1 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-blue-100" />
                                        <span v-else>{{ category.title }}</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <button v-if="state.is_editing && state.category_id_editing === category.id" @click="submitEditingChanges" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 cursor-pointer">
                                                <font-awesome icon="fas fa-check" class="text-base" />
                                                <span>Save</span>
                                            </button>
                                            <button v-else @click="beginEditCategory(category.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer">
                                                <font-awesome icon="fas fa-edit" class="text-base" />
                                                <span>Edit</span>
                                            </button>
                                            <button @click="deleteCategory(category.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 cursor-pointer">
                                                <font-awesome icon="fas fa-trash" class="text-base" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>