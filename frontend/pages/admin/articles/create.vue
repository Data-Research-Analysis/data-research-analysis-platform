<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();

// Fetch categories using SSR-compatible composable
const { categories, pending: categoriesPending, error: categoriesError } = useCategories();

// SEO Meta Tags for Article Create Page
useHead({
    title: 'Create Article - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }, // Don't index admin pages
    ]
});

const state = reactive({
    title: '',
    content: '',
    contentMarkdown: '',  // NEW: Markdown content
    menuFilteredData: [],
})

// Track unsaved changes
const hasUnsavedChanges = ref(false)
const lastSavedContent = ref('')

// Watch for content changes
watch([() => state.content, () => state.title], () => {
    if (state.content || state.title) {
        hasUnsavedChanges.value = true
    }
})

// Prevent navigation if unsaved changes
onBeforeRouteLeave(async (to, from) => {
    if (hasUnsavedChanges.value) {
        const result = await $swal.fire({
            title: 'Unsaved Changes',
            text: 'You have unsaved changes. Are you sure you want to leave?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Leave',
            cancelButtonText: 'Stay',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        })
        if (!result.isConfirmed) {
            return false // Block navigation
        }
    }
})

// Compute categories keys from fetched data
const categoriesKeys = computed(() => {
    if (!categories.value) return [];
    return categories.value.map((category) => ({
        id: category.id,
        key: category.title.toLowerCase().replace(/\s+/g, '_'),
        label: category.title,
        showValues: true,
        isChild: false,
    }));
});

const filteredCategoriesKeys = computed(() => {
    return categoriesKeys.value.filter((item) => item.showValues);
});
function updateContent(content) {
    state.content = content;
}
function updateMarkdown(markdown) {  // NEW
    state.contentMarkdown = markdown;
}
function menuFilteredData(menuData) {
  state.menuFilteredData = menuData;
}
async function postData(publishStatus) {
    const token = getAuthToken();
    let url = `${baseUrl()}/admin/article/add`;
    const title = state.title;
    const content = state.content;
    const categories = state.menuFilteredData.map((item) => item.id);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            title: title,
            content: content,
            content_markdown: state.contentMarkdown,  // NEW: Send markdown
            categories: categories,
            publish_status: publishStatus,
        })
    });
    return response;
}
async function publishArticle() {
    const response = await postData("published");
    if (response.status === 200) {
        hasUnsavedChanges.value = false // Clear unsaved changes flag
        $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The article has been successfully published.',
        });
        router.push(`/admin/articles`);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! The article could not be published.',
        });
    }
}
async function saveAsDraft() {
    const response = await postData("draft");
    if (response.status === 200) {
        hasUnsavedChanges.value = false // Clear unsaved changes flag
    }
    if (response.status === 200) {
        $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The article has been saved as a draft.',
        });
        router.push(`/admin/articles`);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! The article could not be saved as a draft.',
        });
    }
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-xl">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        Create New Blog Article
                    </div>
                    <div
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        @click="saveAsDraft"
                    >
                        Save As Draft
                    </div>
                    <div
                        class="w-18 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        @click="publishArticle"
                    >
                        Publish
                    </div>
                </div>
                <div>
                    <input 
                        v-model="state.title"
                        type="text"
                        class="w-full p-2 border border-gray-300 mb-3 rounded-lg"
                        placeholder="Article Title"
                    />
                </div>
                <div class="mb-3">
                    <div v-if="categoriesPending" class="text-gray-500 p-2">
                        Loading categories...
                    </div>
                    <div v-else-if="categoriesError" class="text-red-500 p-2">
                        Error loading categories. Please refresh the page.
                    </div>
                    <multi-select
                        v-else-if="filteredCategoriesKeys.length"
                        :options="filteredCategoriesKeys"
                        :default-options="[filteredCategoriesKeys[0]]"
                        :searchable="true"
                        placeholder="Select Categories"
                        @multi-select-filtered-data="
                            (filteredData) => menuFilteredData(filteredData)
                        "
                    />
                    <div v-else class="text-gray-500 p-2">
                        No categories available.
                    </div>
                </div>
                <div>
                    <text-editor 
                        :buttons="['bold', 'italic', 'heading', 'strike', 'underline', 'link', 'code', 'image', 'ordered-list', 'bullet-list', 'undo', 'redo', 'block-quote']" 
                        minHeight="200" 
                        inputFormat="markdown"
                        @update:content="(content) => { updateContent(content); }" 
                        @update:markdown="(markdown) => { updateMarkdown(markdown); }"
                    />
                </div>
            </div>
        </div>
    </div>
</template>