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
            localStorage.setItem('articles', JSON.stringify(articlesList));
            enableRefreshDataFlag('setArticles');
        }
    }
    function setCategories(categoriesList: ICategory[]) {
        categories.value = categoriesList;
        if (import.meta.client) {
            localStorage.setItem('categories', JSON.stringify(categoriesList));
            enableRefreshDataFlag('setCategories');
        }
    }
    function setSelectedArticle(article: IArticle) {
            selectedArticle.value = article
            if (import.meta.client) {
                localStorage.setItem('selectedArticle', JSON.stringify(article))
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
            localStorage.setItem('articleVersions', JSON.stringify(versions));
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
        const data = await $fetch(`${baseUrl()}/admin/category/list`, {
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
        const data = await $fetch(`${baseUrl()}/admin/article/list`, {
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

        const data = await $fetch(`${baseUrl()}/article/list`, {
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
