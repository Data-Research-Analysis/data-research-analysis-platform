import {defineStore} from 'pinia'
import type { IArticle } from '~/types/IArticle';
import type { ICategory } from '~/types/ICategory';
export const useArticlesStore = defineStore('articlesDRA', () => {
    const articles = ref<IArticle[]>([]);
    const categories = ref<ICategory[]>([]);
    const selectedArticle = ref<IArticle>();

    // Only access localStorage on client side
    if (import.meta.client) {
        if (localStorage.getItem('articles')) {
            articles.value = JSON.parse(localStorage.getItem('articles') || 'null') || [];
        }
        if (localStorage.getItem('categories')) {
            categories.value = JSON.parse(localStorage.getItem('categories') || 'null') || [];
        }
        if (localStorage.getItem('selectedArticle')) {
            selectedArticle.value = JSON.parse(localStorage.getItem('selectedArticle') || 'null')
        }
    }
    function setArticles(articlesList: IArticle[]) {
        articles.value = articlesList;
        if (import.meta.client) {
            localStorage.setItem('articles', JSON.stringify(articlesList));
        }
    }
    function setCategories(categoriesList: ICategory[]) {
        categories.value = categoriesList;
        if (import.meta.client) {
            localStorage.setItem('categories', JSON.stringify(categoriesList));
        }
    }
    function setSelectedArticle(article: IArticle) {
            selectedArticle.value = article
            if (import.meta.client) {
                localStorage.setItem('selectedArticle', JSON.stringify(article))
            }
        }
    function getArticles() {
        return articles.value;
    }
    function getCategories() {
        return categories.value;
    }
    function getSelectedArticle() {
        return selectedArticle.value;
    }
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
    async function retrieveCategories() {
        const token = getAuthToken();
        if (!token) {
            setCategories([]);
            return;
        }
        const url = `${baseUrl()}/admin/category/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setCategories(data);
    }
    async function retrieveArticles() {
        const token = getAuthToken();
        if (!token) {
            setArticles([]);
            return;
        }
        const url = `${baseUrl()}/admin/article/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setArticles(data);
    }
    async function retrievePublicArticles() {
        const responseToken = await getGeneratedToken();
        const token = responseToken.token;

        const url = `${baseUrl()}/article/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "non-auth",
            },
        });
        const data = await response.json();
        setArticles(data);
    }
    return {
        articles,
        categories,
        selectedArticle,
        setArticles,
        setCategories,
        setSelectedArticle,
        getArticles,
        getCategories,
        getSelectedArticle,
        clearArticles,
        clearCategories,
        retrieveCategories,
        retrieveArticles,
        retrievePublicArticles,
        clearSelectedArticle
    }
});
