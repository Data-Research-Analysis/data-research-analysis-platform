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
const isInPublicDashboard = computed(() => {
    return route.name === 'public-dashboard-dashboardkey';
});
watch(
  route,
  async (value, oldValue) => {
    state.authenticated = isAuthenticated();
    if (state.authenticated) {
        await projectsStore.retrieveProjects();
        await dataSourceStore.retrieveDataSources();
        await dataModelsStore.retrieveDataModels();
        await dashboardsStore.retrieveDashboards();
        if (projectsStore?.getSelectedProject()?.id) {
            await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
        }
        if (value?.params?.projectid) {
            const projectId = parseInt(route.params.projectid);
            projectsStore.clearSelectedProject();
            const project = projectsStore.getProjects().find((project) => project.id === projectId);
            if (project) {
                projectsStore.setSelectedProject(project);
            } else {
                router.push(`/projects`);
                return;
            }
            if (value?.params?.dashboardid) {
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
            await articlesStore.retrieveCategories();
            await articlesStore.retrieveArticles();
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
        }
    } else {
        await articlesStore.retrieveCategories();
        await articlesStore.retrievePublicArticles();
        if (value?.params?.articleslug) {
            const articleSlug = route.params.articleslug;
            articlesStore.clearSelectedArticle();
            const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
            if (article) {
                articlesStore.setSelectedArticle(article);
            } else {
                return;
            }
        }
    }
  },
);
onMounted(async () => {
    state.authenticated = isAuthenticated();
    if (state.authenticated) {
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
            await articlesStore.retrieveCategories();
            await articlesStore.retrieveArticles();
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
        }
    } else {
        await articlesStore.retrieveCategories();
        await articlesStore.retrievePublicArticles();
        if (route?.params?.articleslug) {
            const articleSlug = route.params.articleslug;
            articlesStore.clearSelectedArticle();
            const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
            if (article) {
                articlesStore.setSelectedArticle(article);
            } else {
                return;
            }
        }
    }
})
</script>
<template>
    <div class="relative data-research-analysis">
        <header-nav />
        <breadcrumbs v-if="state.authenticated && !isInPublicDashboard" />
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