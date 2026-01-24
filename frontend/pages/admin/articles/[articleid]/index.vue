<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();

// Fetch categories using SSR-compatible composable
const { categories, pending: categoriesPending, error: categoriesError } = useCategories();

// SEO Meta Tags for Article Edit Page
useHead({
    title: 'Edit Article - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }, // Don't index admin pages
    ]
});

const state = reactive({
    title: '',
    content: '',
    contentMarkdown: '',  // NEW: Markdown content
    menuFilteredData: [],
    selectedMenuItems: [],
})

// Track unsaved changes
const hasUnsavedChanges = ref(false)
const initialContent = ref('')
const initialTitle = ref('')

// Watch for content changes
watch([() => state.content, () => state.title], () => {
    if (initialContent.value && (state.content !== initialContent.value || state.title !== initialTitle.value)) {
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

const article = computed(() => articlesStore.getSelectedArticle());

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

// Determine content and format for editor
const editorContent = computed(() => {
    // Prefer markdown if available, otherwise use HTML
    return state.contentMarkdown || state.content || '';
});

const editorFormat = computed(() => {
    // Always use markdown format to enable the view toggle button
    // The editor will auto-detect HTML vs markdown content
    return 'markdown';
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
async function updateArticle() {
    const token = getAuthToken();
    let url = `${baseUrl()}/admin/article/edit`;
    const title = state.title;
    const content = state.content;
    const categories = state.menuFilteredData.map((item) => item.id);
    try {
        await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                article_id: article.value.article.id,
                title: title,
                content: content,
                content_markdown: state.contentMarkdown,  // NEW: Send markdown
                categories: categories,
            }
        });
        hasUnsavedChanges.value = false // Clear unsaved changes flag
        await $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The article has been successfully updated.',
        });
        window.location.reload();
    } catch (error) {
        await $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! The article could not be updated.',
        });
    }
}

async function unpublishArticle() {
    const result = await $swal.fire({
        title: "Are you sure?",
        text: "This will unpublish the article and make it a draft",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, unpublish it!",
    });

    if (result.isConfirmed) {
        try {
            const token = getAuthToken();
            await $fetch(`${baseUrl()}/admin/article/unpublish/${article.value.article.id}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            
            hasUnsavedChanges.value = false
            await $swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Article unpublished successfully',
            });
            window.location.reload();
        } catch (error) {
            console.log("error", error);
            await $swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'There was an error unpublishing the article.',
            });
        }
    }
}

async function publishArticle() {
    const result = await $swal.fire({
        title: "Are you sure?",
        text: "This will publish the article and make it visible to the public",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, publish it!",
    });

    if (result.isConfirmed) {
        try {
            const token = getAuthToken();
            await $fetch(`${baseUrl()}/admin/article/publish/${article.value.article.id}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            
            hasUnsavedChanges.value = false
            await $swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Article published successfully',
            });
            window.location.reload();
        } catch (error) {
            console.log("error", error);
            await $swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'There was an error publishing the article.',
            });
        }
    }
}

// Initialize form data when article and categories are loaded
watchEffect(() => {
    if (article.value && categoriesKeys.value.length > 0) {
        state.title = article.value.article?.title || '';
        state.contentMarkdown = article.value.article?.content_markdown || '';  // NEW: Load markdown
        state.content = article.value.article?.content || '';  // HTML fallback
        state.selectedMenuItems = categoriesKeys.value.filter((item) => {
            return article.value.categories?.find((category) => category.id === item.id) !== undefined;
        });
        
        // Store initial values for change detection
        if (!initialContent.value) {
            initialContent.value = state.content
            initialTitle.value = state.title
            hasUnsavedChanges.value = false
        }
    }
});
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
                        Edit Article
                    </div>
                    <div
                        class="w-18 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        @click="updateArticle"
                    >
                        Update
                    </div>
                    <div
                        v-if="article?.article?.publish_status === 'published'"
                        class="w-24 text-center self-center text-sm p-1 ml-2 mb-4 bg-orange-600 text-white hover:bg-orange-700 cursor-pointer font-bold shadow-md rounded-lg"
                        @click="unpublishArticle"
                    >
                        Unpublish
                    </div>
                    <div
                        v-if="article?.article?.publish_status === 'draft'"
                        class="w-24 text-center self-center text-sm p-1 ml-2 mb-4 bg-green-600 text-white hover:bg-green-700 cursor-pointer font-bold shadow-md rounded-lg"
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
                        :default-options="state.selectedMenuItems"
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
                        :inputFormat="editorFormat"
                        @update:content="(content) => { updateContent(content); }" 
                        @update:markdown="(markdown) => { updateMarkdown(markdown); }"
                        :content="editorContent"
                    />
                </div>
            </div>
        </div>
    </div>
</template>