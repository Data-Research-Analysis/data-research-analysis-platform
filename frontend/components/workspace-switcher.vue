<script setup lang="ts">
import { useOrganizationsStore } from '@/stores/organizations';
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import type { IWorkspace } from '@/types/IWorkspace';

const organizationsStore = useOrganizationsStore();
const loggedInUserStore = useLoggedInUserStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const route = useRoute();

// State
const isMounted = ref(false);
const isLoading = ref(false);

// Computed properties
const currentWorkspace = computed(() => {
    return organizationsStore.getSelectedWorkspace();
});

const workspaces = computed(() => {
    return organizationsStore.getWorkspaces();
});

const currentOrganization = computed(() => {
    return organizationsStore.getSelectedOrganization();
});

const currentUserId = computed(() => {
    return loggedInUserStore.getLoggedInUser()?.id;
});

const displayName = computed(() => {
    if (!currentWorkspace.value) return 'Select Workspace';
    const name = currentWorkspace.value.name;
    return name.length > 20 ? name.substring(0, 20) + '...' : name;
});

const isDefaultWorkspace = computed(() => {
    return (workspace: IWorkspace) => workspace.is_default;
});

// Lifecycle
onMounted(async () => {
    console.log('[WorkspaceSwitcher] onMounted - setting isMounted to true');
    isMounted.value = true;
    
    console.log('[WorkspaceSwitcher] Current organization:', currentOrganization.value);
    console.log('[WorkspaceSwitcher] Current workspaces:', workspaces.value);
    
    // Auto-load workspaces if not already loaded (should be loaded by middleware)
    if (workspaces.value.length === 0 && currentOrganization.value) {
        console.log('[WorkspaceSwitcher] No workspaces loaded, fetching...');
        isLoading.value = true;
        try {
            await organizationsStore.retrieveWorkspaces(currentOrganization.value.id);
            console.log('[WorkspaceSwitcher] Workspaces loaded:', organizationsStore.getWorkspaces());
        } catch (error) {
            console.error('[workspace-switcher] Failed to load workspaces:', error);
        } finally {
            isLoading.value = false;
        }
    } else {
        console.log('[WorkspaceSwitcher] Workspaces already loaded or no organization');
    }
});

// Methods
async function selectWorkspace(workspace: IWorkspace) {
    if (!workspace || workspace.id === currentWorkspace.value?.id) return;
    
    try {
        console.log('[workspace-switcher] Switching to workspace:', workspace.name);
        organizationsStore.setSelectedWorkspace(workspace);
        
        // Refresh all data for new workspace context
        console.log('[workspace-switcher] Refreshing data for new workspace...');
        
        // Clear existing data to show loading states
        projectsStore.clearProjects();
        dataSourceStore.clearDataSources();
        dashboardsStore.clearDashboards();
        
        // Refresh all data stores with new workspace context
        await Promise.all([
            projectsStore.retrieveProjects(),
            dataSourceStore.retrieveDataSources(),
            dashboardsStore.retrieveDashboards(),
        ]);
        
        console.log('[workspace-switcher] Data refresh complete');
    } catch (error) {
        console.error('[workspace-switcher] Failed to switch workspace:', error);
    }
}

function getWorkspaceRoleBadge(workspace: IWorkspace): string {
    if (!currentUserId.value) return 'Member';
    const member = workspace.members?.find(m => m.user_id === currentUserId.value);
    if (!member) return 'Member';
    
    switch (member.role) {
        case 'ADMIN':
            return 'Admin';
        case 'EDITOR':
            return 'Editor';
        case 'VIEWER':
            return 'Viewer';
        default:
            return 'Member';
    }
}

function getWorkspaceRoleBadgeClass(workspace: IWorkspace): string {
    if (!currentUserId.value) return 'bg-gray-100 text-gray-700';
    const member = workspace.members?.find(m => m.user_id === currentUserId.value);
    if (!member) return 'bg-gray-100 text-gray-700';
    
    switch (member.role) {
        case 'ADMIN':
            return 'bg-purple-100 text-purple-700';
        case 'EDITOR':
            return 'bg-blue-100 text-blue-700';
        case 'VIEWER':
            return 'bg-gray-100 text-gray-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
}
</script>

<template>
    <ClientOnly>
        <div v-if="isMounted" class="workspace-switcher">
            <menu-dropdown direction="left" offset-y="10">
                <template #menuItem="{ onClick }">
                    <button
                        type="button"
                        @click="onClick"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition-all text-white text-sm font-medium whitespace-nowrap cursor-pointer"
                        :disabled="!currentOrganization"
                    >
                        <font-awesome-icon :icon="['fas', 'folder-tree']" class="w-4 h-4" />
                        <span>{{ displayName }}</span>
                        <font-awesome-icon :icon="['fas', 'chevron-down']" class="w-3 h-3 ml-1" />
                    </button>
                </template>
                <template #dropdownMenu="{ onClick }">
                    <div class="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden min-w-[280px] max-h-[400px] overflow-y-auto">
                        <!-- Header -->
                        <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <p class="text-sm font-semibold text-gray-900">Switch Workspace</p>
                            <p v-if="currentOrganization" class="text-xs text-gray-500 mt-1">
                                {{ currentOrganization.name }}
                            </p>
                        </div>
                        
                        <!-- Loading State -->
                        <div v-if="isLoading" class="px-4 py-6 text-center">
                            <font-awesome-icon :icon="['fas', 'spinner']" class="w-5 h-5 text-gray-400 animate-spin mb-2" />
                            <p class="text-sm text-gray-600">Loading workspaces...</p>
                        </div>
                        
                        <!-- Workspaces List -->
                        <div v-else-if="workspaces.length > 0" class="py-2">
                            <button
                                v-for="workspace in workspaces"
                                :key="workspace.id"
                                @click="() => { selectWorkspace(workspace); onClick(); }"
                                type="button"
                                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors text-left cursor-pointer"
                                :class="{ 'bg-blue-50': workspace.id === currentWorkspace?.id }"
                            >
                                <!-- Workspace Icon -->
                                <div class="shrink-0">
                                    <font-awesome-icon 
                                        :icon="['fas', isDefaultWorkspace(workspace) ? 'star' : 'folder-tree']" 
                                        class="w-4 h-4"
                                        :class="isDefaultWorkspace(workspace) ? 'text-yellow-500' : 'text-gray-400'"
                                    />
                                </div>
                                
                                <!-- Workspace Info -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <p class="text-sm font-medium text-gray-900 truncate">
                                            {{ workspace.name }}
                                        </p>
                                        <!-- Default Badge -->
                                        <span
                                            v-if="isDefaultWorkspace(workspace)"
                                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                                        >
                                            Default
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <p class="text-xs text-gray-500 truncate">{{ workspace.slug }}</p>
                                        <!-- Role Badge -->
                                        <span
                                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                            :class="getWorkspaceRoleBadgeClass(workspace)"
                                        >
                                            {{ getWorkspaceRoleBadge(workspace) }}
                                        </span>
                                    </div>
                                </div>
                                
                                <!-- Active Checkmark -->
                                <div class="shrink-0">
                                    <font-awesome-icon
                                        v-if="workspace.id === currentWorkspace?.id"
                                        :icon="['fas', 'check']"
                                        class="w-4 h-4 text-blue-600"
                                    />
                                </div>
                            </button>
                        </div>
                        
                        <!-- Empty State -->
                        <div v-else class="px-4 py-6 text-center">
                            <font-awesome-icon :icon="['fas', 'folder-tree']" class="w-8 h-8 text-gray-300 mb-2" />
                            <p class="text-sm text-gray-600">No workspaces available</p>
                            <p class="text-xs text-gray-500 mt-1">Contact your organization admin</p>
                        </div>
                        
                        <!-- Footer: Create Workspace (Coming Soon) -->
                        <div class="border-t border-gray-200 px-4 py-2 bg-gray-50">
                            <button
                                type="button"
                                disabled
                                class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded cursor-not-allowed"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" class="w-3 h-3" />
                                Create Workspace (Coming Soon)
                            </button>
                        </div>
                    </div>
                </template>
            </menu-dropdown>
        </div>
        
        <!-- SSR Fallback -->
        <template #fallback>
            <div class="workspace-switcher-skeleton">
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white bg-opacity-20">
                    <div class="w-4 h-4 bg-white bg-opacity-30 rounded animate-pulse"></div>
                    <div class="w-24 h-4 bg-white bg-opacity-30 rounded animate-pulse"></div>
                    <div class="w-3 h-3 bg-white bg-opacity-30 rounded animate-pulse ml-1"></div>
                </div>
            </div>
        </template>
    </ClientOnly>
</template>

<style scoped>
/* Component-specific styles if needed */
</style>
