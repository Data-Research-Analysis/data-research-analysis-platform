import {defineStore} from 'pinia'
import type { IArticle } from '~/types/IArticle';
import type { ICategory } from '~/types/ICategory';
export const useArticlesStore = defineStore('articlesDRA', () => {
    const articles = ref<IArticle[]>([]);
    const categories = ref<ICategory[]>([]);

    if (localStorage.getItem('articles')) {
        articles.value = JSON.parse(localStorage.getItem('articles') || 'null');
    }
    if (localStorage.getItem('categories')) {
        categories.value = JSON.parse(localStorage.getItem('categories') || 'null');
    }

    function setArticles(articlesList: IArticle[]) {
        articles.value = articlesList;
        localStorage.setItem('articles', JSON.stringify(articlesList));
    }
    function setCategories(categoriesList: ICategory[]) {
        categories.value = categoriesList;
        localStorage.setItem('categories', JSON.stringify(categoriesList));
    }
    function getArticles() {
        return articles.value;
    }
    function getCategories() {
        return categories.value;
    }
    function clearArticles() {
        articles.value = [];
        localStorage.removeItem('articles');
    }
    function clearCategories() {
        categories.value = [];
        localStorage.removeItem('categories');
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
        console.log('Retrieved categories:', data);
        setCategories(data);
    }
    return {
        articles,
        categories,
        setArticles,
        setCategories,
        getArticles,
        getCategories,
        clearArticles,
        clearCategories,
        retrieveCategories,
    }
});
