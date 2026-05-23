import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAppFetch } from '@/composables/useAppFetch';
import { getAuthToken } from '~/composables/AuthToken';
import { baseUrl } from '~/composables/Utils';
import type { IArticle, ICategory, IArticleVersion } from '~/types/IArticles';

export const useArticlesStore = defineStore('articlesDRA', () => {
    // State
    const articles = ref<IArticle[]>([]);
    const categories = ref<ICategory[]>([]);
    const selectedArticle = ref<IArticle | undefined>();
    const articleVersions = ref<IArticleVersion[] | undefined>();

    // Mutations / Setters
    function setArticles(articlesList: IArticle[]) {
        articles.value = articlesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('articles', JSON.stringify(articlesList));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for articles.');
                } else {
                    console.error('[ArticlesStore] Error saving articles to localStorage:', error);
                }
            }
        }
    }
    
    function setCategories(categoriesList: ICategory[]) {
        categories.value = categoriesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('categories', JSON.stringify(categoriesList));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for categories.');
                } else {
                    console.error('[ArticlesStore] Error saving categories to localStorage:', error);
                }
            }
        }
    }

    function setSelectedArticle(article: IArticle) {
        selectedArticle.value = article;
        if (import.meta.client) {
            try {
                localStorage.setItem('selectedArticle', JSON.stringify(article));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for selectedArticle.');
                } else {
                    console.error('[ArticlesStore] Error saving selectedArticle to localStorage:', error);
                }
            }
        }
    }

    function setArticleVersions(versions: IArticleVersion[]) {
        articleVersions.value = versions;
        if (import.meta.client) {
            try {
                localStorage.setItem('articleVersions', JSON.stringify(versions));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for articleVersions.');
                } else {
                    console.error('[ArticlesStore] Error saving articleVersions to localStorage:', error);
                }
            }
        }
    }

    // Getters
    function getArticles() {
        if (import.meta.client && localStorage.getItem('articles')) {
            articles.value = JSON.parse(localStorage.getItem('articles') || '[]');
        }
        return articles.value;
    }

    function getCategories() {
        if (import.meta.client && localStorage.getItem('categories')) {
            categories.value = JSON.parse(localStorage.getItem('categories') || '[]');
        }
        return categories.value;
    }

    function getSelectedArticle() {
        if (import.meta.client && !selectedArticle.value && localStorage.getItem('selectedArticle')) {
            selectedArticle.value = JSON.parse(localStorage.getItem('selectedArticle') || 'null');
        }
        return selectedArticle.value;
    }

    function getArticleVersions() {
        if (import.meta.client && !articleVersions.value && localStorage.getItem('articleVersions')) {
            articleVersions.value = JSON.parse(localStorage.getItem('articleVersions') || '[]');
        }
        return articleVersions.value ?? [];
    }

    // Clear functions
    function clearArticles() {
        articles.value = [];
        if (import.meta.client) {
            localStorage.removeItem('articles');
        }
    }
    
    function clearCategories() {
        categories.value = [];
        if (import.meta.client) {
            localStorage.removeItem('categories');
        }
    }

    function clearSelectedArticle() {
        selectedArticle.value = undefined;
        if (import.meta.client) {
            localStorage.removeItem('selectedArticle');
        }
    }
    
    function clearArticleVersions() {
        articleVersions.value = undefined;
        if (import.meta.client) {
            localStorage.removeItem('articleVersions');
        }
    }

    // Actions (API)
    async function retrieveCategories() {
        const token = getAuthToken();
        if (!token) {
            setCategories([]);
            return;
        }
        const data = await useAppFetch<any>(`${baseUrl()}/admin/category/list`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setCategories(data);
    }

    async function retrieveArticles() {
        const token = getAuthToken();
        if (!token) {
            setArticles([]);
            return;
        }
        const data = await useAppFetch<any>(`${baseUrl()}/admin/article/list`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setArticles(data);
    }
    
    // Note: getGeneratedToken is likely needed; assuming it is imported if available elsewhere
    // If not, this might need adjustment based on how public articles are fetched.
    async function retrievePublicArticles() {
        // const responseToken = await getGeneratedToken(); // Placeholder
        // const token = responseToken.token;
        
        // Temporarily fetching without specific token if not available in context
        const data = await useAppFetch<any>(`${baseUrl()}/article/list`);
        setArticles(data);
    }

    return {
        articles,
        categories,
        selectedArticle,
        articleVersions,
        
        setArticles,
        setCategories,
        setSelectedArticle,
        setArticleVersions,
        
        getArticles,
        getCategories,
        getSelectedArticle,
        getArticleVersions,
        
        clearArticles,
        clearCategories,
        clearArticleVersions,
        clearSelectedArticle,
        
        retrieveCategories,
        retrieveArticles,
        retrievePublicArticles,
    }
});