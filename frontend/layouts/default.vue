<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { usePrivateBetaUserStore } from '@/stores/private_beta_users';
import { useUserManagementStore } from '@/stores/user_management';

const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const articlesStore = useArticlesStore();
const loggedInUserStore = useLoggedInUserStore();
const privateBetaUserStore = usePrivateBetaUserStore();
const userManagementStore = useUserManagementStore();
const route = useRoute();
const router = useRouter();
const state = reactive({
    authenticated: false,
})

// Helper function to load data - works in both SSR and client
async function loadData() {
    state.authenticated = isAuthenticated();
    
    try {
        if (state.authenticated) {
            await projectsStore.retrieveProjects();
            await dataSourceStore.retrieveDataSources();
            await dataModelsStore.retrieveDataModels();
            await dashboardsStore.retrieveDashboards();
            if (projectsStore?.getSelectedProject()?.id) {
                await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
            }
            if (route?.params?.projectid) {
                const projectId = parseInt(String(route.params.projectid));
                projectsStore.clearSelectedProject();
                const project = projectsStore.getProjects().find((project) => project.id === projectId);
                if (project) {
                    projectsStore.setSelectedProject(project);
                } else {
                    router.push(`/projects`);
                    return;
                }
                if (route?.params?.dashboardid) {
                    const dashboardId = parseInt(String(route.params.dashboardid));
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
                await privateBetaUserStore.retrievePrivateBetaUsers();
                await userManagementStore.retrieveUsers();
                if (route?.params?.articleid) {
                    const articleId = parseInt(String(route.params.articleid));
                    articlesStore.clearSelectedArticle();
                    const article = articlesStore.getArticles().find((article) => article.article.id === articleId);
                    if (article) {
                        articlesStore.setSelectedArticle(article);
                    } else {
                        router.push(`/admin/articles`);
                        return;
                    }
                }
                if (route?.params?.userid) {
                    const userId = parseInt(String(route.params.userId));
                    userManagementStore.clearSelectedUser();
                    const user = userManagementStore.getUsers().find((user) => user.id === userId);
                    if (user) {
                        userManagementStore.setSelectedUser(user);
                    } else {
                        router.push(`/admin/users`);
                        return;
                    }
                }
            }
        } else {
            await articlesStore.retrieveCategories();
            await articlesStore.retrievePublicArticles();
            if (route?.params?.articleslug) {
                const articleSlug = String(route.params.articleslug);
                articlesStore.clearSelectedArticle();
                const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
                if (article) {
                    console.log('public article found', article);
                    articlesStore.setSelectedArticle(article);
                } else {
                    router.push(`/articles`);
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        // During SSR, allow the page to render (will retry on client)
        // On client, the error will be visible in console
        if (import.meta.client) {
            // Optionally show a notification to the user
            console.warn('Data loading failed. Some features may not work correctly.');
        }
    }
}

// Note: onServerPrefetch removed to prevent backend fetch errors during SSR
// Data will be loaded on client-side via onMounted
// This ensures SSR works even when backend is not accessible

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
    await loadData();
  },
);
onMounted(async () => {
    await loadData();
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