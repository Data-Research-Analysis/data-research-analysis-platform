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
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
                title: categoryTitle,
            }),
        };
        const response = await fetch(`${baseUrl()}/admin/category/add`, requestOptions);
        if (response && response.status === 200) {
            const data = await response.json();
            $swal.fire({
                title: `The category ${categoryTitle} has been created successfully.`,
                confirmButtonColor: "#3C8DBC",
            });
            await articlesStore.retrieveCategories();
        } else {
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
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            category_id: state.category_id_editing,
            title: state.category_title_editing,
        }),
    };
    const response = await fetch(`${baseUrl()}/admin/category/edit`, requestOptions);
    if (response && response.status === 200) {
        $swal.fire({
            title: `The category title has been changed successfully.`,
            confirmButtonColor: "#3C8DBC",
        });
    } else {
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
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    try {
        const response = await fetch(`${baseUrl()}/admin/category/delete/${categoryId}`, requestOptions);
        if (response && response.status === 200) {
            const data = await response.json();
            $swal.fire(`The category has been deleted successfully.`);
        } else {
            $swal.fire(`There was an error deleting the category.`);
        }
    } catch (error) {
        $swal.fire(`A network error occurred while deleting the category.`);
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
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Categories
                    </div>
                    <div
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                        @click="addCategory"
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
                                <td class="border px-4 py-2 text-center">
                                    {{ category.id }}
                                </td>
                                <td class="border px-4 py-2">
                                    <input v-if="state.is_editing && state.category_id_editing === category.id" type="text" v-model="state.category_title_editing" class="text-left outline p-1" />
                                    <span v-else>{{ category.title }}</span>
                                </td>
                                <td class="border px-4 py-2">
                                    <div class="flex flex-row justify-center">
                                        <button v-if="state.is_editing && state.category_id_editing === category.id" @click="submitEditingChanges" class="w-36 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md">
                                            Submit Changes
                                        </button>
                                        <button v-else @click="beginEditCategory(category.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md">
                                            Edit
                                        </button>
                                        <button @click="deleteCategory(category.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-red-600 text-white hover:bg-red-700 cursor-pointer font-bold shadow-md">Delete</button>
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