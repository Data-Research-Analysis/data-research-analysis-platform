import {defineStore} from 'pinia'
import type { IArticle } from '~/types/IArticle';
import type { ICategory } from '~/types/ICategory';
import type { IArticleVersion } from '~/types/IArticleVersion';
export const useArticlesStore = defineStore('articlesDRA', () => {
    const articles = ref<IArticle[]>([]);
    const categories = ref<ICategory[]>([]);
    const selectedArticle = ref<IArticle>();
    const articleVersions = ref<IArticleVersion[]>();

    function setArticles(articlesList: IArticle[]) {
        articles.value = articlesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('articles', JSON.stringify(articlesList));
                enableRefreshDataFlag('setArticles');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for articles.');
                    enableRefreshDataFlag('setArticles');
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
                enableRefreshDataFlag('setCategories');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ArticlesStore] localStorage quota exceeded for categories.');
                    enableRefreshDataFlag('setCategories');
                } else {
                    console.error('[ArticlesStore] Error saving categories to localStorage:', error);
                }
            }
        }
    }
    function setSelectedArticle(article: IArticle) {
            selectedArticle.value = article
            if (import.meta.client) {
                try {
                    localStorage.setItem('selectedArticle', JSON.stringify(article))
                } catch (error: any) {
                    if (error.name === 'QuotaExceededError') {
                        console.warn('[ArticlesStore] localStorage quota exceeded for selectedArticle.');
                    } else {
                        console.error('[ArticlesStore] Error saving selectedArticle to localStorage:', error);
                    }
                }
            }
        }
    function getArticles() {
        if (import.meta.client && localStorage.getItem('articles')) {
            articles.value = JSON.parse(localStorage.getItem('articles') || 'null') || [];
        }
        return articles.value;
    }
    function getCategories() {
        if (import.meta.client && localStorage.getItem('categories')) {
            categories.value = JSON.parse(localStorage.getItem('categories') || 'null') || [];
        }
        return categories.value;
    }
    function getSelectedArticle() {
        if (import.meta.client && localStorage.getItem('selectedArticle')) {
            selectedArticle.value = JSON.parse(localStorage.getItem('selectedArticle') || 'null')
        }
        return selectedArticle.value;
    }
    function clearArticles() {
        articles.value = [];
        if (import.meta.client) {
            localStorage.removeItem('articles');
            enableRefreshDataFlag('clearArticles');
        }
    }
    function clearCategories() {
        categories.value = [];
        if (import.meta.client) {
            localStorage.removeItem('categories');
            enableRefreshDataFlag('clearCategories');
        }
    }
    function clearSelectedArticle() {
        selectedArticle.value = undefined;
        if (import.meta.client) {
            localStorage.removeItem('selectedArticle');
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
    function getArticleVersions() {
        if (import.meta.client && localStorage.getItem('articleVersions')) {
            articleVersions.value = JSON.parse(localStorage.getItem('articleVersions') || '[]') || [];
        }
        return articleVersions.value ?? [];
    }
    function clearArticleVersions() {
        articleVersions.value = undefined;
        if (import.meta.client) {
            localStorage.removeItem('articleVersions');
        }
    }
    async function retrieveCategories() {
        const token = getAuthToken();
        if (!token) {
            setCategories([]);
            return;
        }
        const data = await $fetch<any>(`${baseUrl()}/admin/category/list`, {
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
        const data = await $fetch<any>(`${baseUrl()}/admin/article/list`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setArticles(data);
    }
    async function retrievePublicArticles() {
        const responseToken = await getGeneratedToken();
        const token = responseToken.token;

        const data = await $fetch<any>(`${baseUrl()}/article/list`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "non-auth",
            },
        });
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
        retrieveCategories,
        retrieveArticles,
        retrievePublicArticles,
        clearSelectedArticle
    }
});
