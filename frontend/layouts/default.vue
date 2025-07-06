<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";

const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const articlesStore = useArticlesStore();
const loggedInUserStore = useLoggedInUserStore();
const route = useRoute();
const router = useRouter();
const state = reactive({
    authenticated: false,
})
const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});
const isUserAdmin = computed(() => {
    return loggedInUser.value?.user_type === 'admin';
});
watch(
  route,
  async (value, oldValue) => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
    await dataModelsStore.retrieveDataModels();
    await dashboardsStore.retrieveDashboards();

    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    if (value?.params?.projectid) {
        const projectId = parseInt(value.params.projectid);
        projectsStore.clearSelectedProject();
        const project = projectsStore.getProjects().find((project) => project.id === projectId);
        if (project) {
            projectsStore.setSelectedProject(project);
        } else {
            router.push(`/projects`);
            return;
        }
        if (value?.params?.dashboardid) {
            const dashboardId = parseInt(value.params.dashboardid);
            const dashboard = dashboardsStore.getDashboards().find((dashboard) => dashboard.id === dashboardId);
            dashboardsStore.clearSelectedDashboard();
            if (dashboard) {
                dashboardsStore.setSelectedDashboard(dashboard);
            } else {
                router.push(`/dashboards`);
                return;
            }
        }
    }
    console.log('route change', isUserAdmin.value);
    if (isUserAdmin.value) {
        await articlesStore.retrieveArticles();

    } else {
        await articlesStore.retrievePublicArticles();
    }
    await articlesStore.retrieveCategories();
    if (value?.params?.articleid) {
        const articleId = parseInt(value.params.articleid);
        articlesStore.clearSelectedArticle();
        const article = articlesStore.getArticles().find((article) => article.article.id === articleId);
        if (article) {
            articlesStore.setSelectedArticle(article);
        } else {
            router.push(`/admin/articles`);
            return;
        }
    }
    if (value?.params?.articleslug) {
        const articleSlug = value.params.articleslug;
        articlesStore.clearSelectedArticle();
        console.log('default articleSlug', articleSlug);
        const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
        console.log('default article', article);
        console.log('default articleId', article?.article?.id);
        if (article) {
            articlesStore.setSelectedArticle(article);
        } else {
            // router.push(`/articles`);
            return;
        }
    }
  },
);
onMounted(async () => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
    await dataModelsStore.retrieveDataModels();
    await dashboardsStore.retrieveDashboards();
    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    if (route?.params?.projectid) {
        const projectId = parseInt(route.params.projectid);
        projectsStore.clearSelectedProject();
        const project = projectsStore.getProjects().find((project) => project.id === projectId);
        if (project) {
            projectsStore.setSelectedProject(project);
        } else {
            router.push(`/projects`);
            return;
        }
        if (route?.params?.dashboardid) {
            const dashboardId = parseInt(route.params.dashboardid);
            const dashboard = dashboardsStore.getDashboards().find((dashboard) => dashboard.id === dashboardId);
            dashboardsStore.clearSelectedDashboard();
            if (dashboard) {
                dashboardsStore.setSelectedDashboard(dashboard);
            } else {
                router.push(`/dashboards`);
                return;
            }
        }
    }
    if (isUserAdmin.value) {
        await articlesStore.retrieveArticles();
    } else {
        await articlesStore.retrievePublicArticles();
    }
    await articlesStore.retrieveCategories();
    console.log('articlesStore.getArticles()', articlesStore.getArticles());
    if (route?.params?.articleid) {
        const articleId = parseInt(route.params.articleid);
        articlesStore.clearSelectedArticle();
        const article = articlesStore.getArticles().find((article) => article.article.id === articleId);
        if (article) {
            articlesStore.setSelectedArticle(article);
        } else {
            router.push(`/admin/articles`);
            return;
        }
    }
    if (route?.params?.articleslug) {
        const articleSlug = route.params.articleslug;
        console.log('default articleSlug', articleSlug);

        articlesStore.clearSelectedArticle();
        const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
        console.log('default article', article);
        console.log('default articleId', article?.article?.id);
        if (article) {
            articlesStore.setSelectedArticle(article);
        } else {
            // router.push(`/articles`);
            return;
        }
    }
})
</script>
<template>
    <div class="relative">
        <header-nav />
        <breadcrumbs v-if="state.authenticated" />
        <div class="flex "
        :class="{
            'flex-row': state.authenticated,
            'flex-col': !state.authenticated,
        }"
        >
        <div class="w-full">
                <slot></slot>
            </div>
        </div>
        <footer-nav />
    </div>
</template>