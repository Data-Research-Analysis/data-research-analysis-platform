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

// ---- Version History ----
const route = useRoute();
const showVersionHistory = ref(false);
const previewVersion = ref(null);

const { data: versions, pending: versionsPending, refresh: refreshVersions } = useArticleVersions(
    route.params.articleid
);

function toggleVersionHistory() {
    showVersionHistory.value = !showVersionHistory.value;
    if (showVersionHistory.value) {
        refreshVersions();
    }
}

function formatVersionDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// The latest saved version (versions are returned newest-first)
const currentVersion = computed(() => {
    if (!versions.value || versions.value.length === 0) return null;
    return versions.value[0];
})

async function restoreVersion(versionNumber) {
    const result = await $swal.fire({
        title: `Restore to Version ${versionNumber}?`,
        text: 'Your current content will be auto-saved as a new version before restoring.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, restore it!',
    });
    if (!result.isConfirmed) return;

    try {
        const token = getAuthToken();
        await $fetch(
            `${baseUrl()}/admin/article/${article.value.article.id}/versions/${versionNumber}/restore`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }
        );
        hasUnsavedChanges.value = false;
        await $swal.fire({
            icon: 'success',
            title: 'Restored!',
            text: `Article restored to version ${versionNumber}.`,
        });
        window.location.reload();
    } catch (error) {
        await $swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'There was an error restoring the article.',
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
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        Edit Article
                    </div>
                    <div v-if="currentVersion" class="self-center ml-3 mb-4 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-mono border border-gray-200">
                        v{{ currentVersion.version_number }}
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
                        :close-on-select="false"
                        placeholder="Select Categories"
                        @multi-select-filtered-data="
                            (filteredData) => menuFilteredData(filteredData)
                        "
                    />
                    <div v-else class="text-gray-500 p-2">
                        No categories available.
                    </div>
                </div>
                <!-- Version History Panel -->
                <div class="mt-3 mb-3">
                    <button
                        @click="toggleVersionHistory"
                        class="flex items-center gap-2 text-sm font-medium text-primary-blue-600 hover:text-primary-blue-800 transition-colors cursor-pointer"
                    >
                        <font-awesome :icon="showVersionHistory ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" class="text-xs" />
                        <span>
                            Version History
                            <span v-if="versions && versions.length" class="text-gray-500 font-normal">
                                ({{ versions.length }} version{{ versions.length !== 1 ? 's' : '' }})
                            </span>
                        </span>
                    </button>

                    <div v-if="showVersionHistory" class="mt-3">
                        <!-- Loading -->
                        <div v-if="versionsPending" class="flex items-center gap-2 text-gray-500 text-sm py-4">
                            <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-blue-500"></div>
                            <span>Loading versions...</span>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="!versions || versions.length === 0" class="text-gray-400 text-sm py-4">
                            No versions saved yet. Versions are created automatically each time you update the article.
                        </div>

                        <!-- Versions table -->
                        <div v-else class="overflow-x-auto rounded-lg border border-gray-200">
                            <table class="min-w-full divide-y divide-gray-200 text-sm">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left font-medium text-gray-600">Version</th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-600">Title</th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-600">Saved</th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-600">Note</th>
                                        <th class="px-4 py-2 text-right font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 bg-white">
                                    <tr
                                        v-for="version in versions"
                                        :key="version.id"
                                        class="hover:bg-gray-50 transition-colors"
                                    >
                                        <td class="px-4 py-2 font-mono text-gray-700">
                                            v{{ version.version_number }}
                                        </td>
                                        <td class="px-4 py-2 text-gray-800 max-w-xs truncate">
                                            {{ version.title }}
                                        </td>
                                        <td class="px-4 py-2 text-gray-500 whitespace-nowrap">
                                            {{ formatVersionDate(version.created_at) }}
                                        </td>
                                        <td class="px-4 py-2 text-gray-400 max-w-xs truncate">
                                            {{ version.change_summary || '—' }}
                                        </td>
                                        <td class="px-4 py-2">
                                            <div class="flex justify-end gap-2">
                                                <button
                                                    @click="previewVersion = version"
                                                    class="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors cursor-pointer"
                                                >
                                                    Preview
                                                </button>
                                                <button
                                                    @click="restoreVersion(version.version_number)"
                                                    class="px-2 py-1 text-xs rounded bg-primary-blue-100 hover:bg-primary-blue-200 text-primary-blue-700 font-medium transition-colors cursor-pointer"
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
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

    <!-- Version Preview Modal -->
    <article-version-preview-modal
        v-if="previewVersion"
        :version="previewVersion"
        @close="previewVersion = null"
    />
</template>