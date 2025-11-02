<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();

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
    keys: [],
    menuFilteredData: [],
    selectedMenuItems: [],
})
const article = computed(() => articlesStore.getSelectedArticle());
const categoriesKeys = computed(() => {
  return state.keys.filter((item) => item.showValues);
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

watch(
    articlesStore,
    (value, oldValue) => {
        if (article.value?.article) {
            state.title = article.value.article.title;
            state.contentMarkdown = article.value.article.content_markdown || '';  // NEW: Load markdown
            state.content = article.value.article.content;  // HTML fallback
            state.selectedMenuItems = state.keys.filter((item) => {
                return article.value.categories.find((category) => category.id === item.id) !== undefined;
            });
        }
    },
);
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
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            article_id: article.value.article.id,
            title: title,
            content: content,
            content_markdown: state.contentMarkdown,  // NEW: Send markdown
            categories: categories,
        })
    });
    if (response.status === 200) {
        $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The article has been successfully updated.',
        });
        router.push(`/admin/articles`);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! The article could not be updated.',
        });
    }
    articlesStore.clearSelectedArticle();
    articlesStore.clearArticles();
    await articlesStore.retrieveArticles();
}
onMounted(() => {
    const categories = articlesStore.getCategories();
    state.keys = categories.map((category) => ({
        id: category.id,
        key: category.title.toLowerCase().replace(/\s+/g, '_'),
        label: category.title,
        showValues: true,
        isChild: false,
    }));
    state.title = article?.value?.article?.title || '';
    state.contentMarkdown = article?.value?.article?.content_markdown || '';  // NEW: Load markdown
    state.content = article?.value?.article?.content || '';  // HTML fallback
    state.selectedMenuItems = state.keys.filter((item) => {
        return article?.value?.categories.find((category) => category.id === item.id) !== undefined;
    });
})
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
                        Edit Article
                    </div>
                    <div
                        class="w-18 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                        @click="updateArticle"
                    >
                        Update
                    </div>
                </div>
                <div>
                    <input 
                        v-model="state.title"
                        type="text"
                        class="w-full p-2 border border-gray-300 mb-3"
                        placeholder="Article Title"
                    />
                </div>
                <div class="mb-3">
                    <multi-select
                        v-if="categoriesKeys.length && state.selectedMenuItems.length"
                        :options="categoriesKeys"
                        :default-options="state.selectedMenuItems"
                        :searchable="true"
                        placeholder="Select Categories"
                        @multi-select-filtered-data="
                            (filteredData) => menuFilteredData(filteredData)
                        "
                    />
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