<script setup lang="ts">
/**
 * Organization Switcher Component
 * 
 * Dropdown component for switching between user's organizations.
 * Displays current organization and allows selection from dropdown.
 * Auto-loads organizations on mount and syncs with store.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */

import { useOrganizationsStore } from '@/stores/organizations';
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDashboardsStore } from '@/stores/dashboards';
import type { IOrganization } from '~/types/IOrganization';

const organizationsStore = useOrganizationsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dashboardsStore = useDashboardsStore();
const isMounted = ref(false);
const isLoading = ref(false);
const showCreateModal = ref(false);
const showSettingsModal = ref(false);
const selectedOrgForSettings = ref<IOrganization | null>(null);

// Reactive references to store state
const currentOrganization = computed(() => organizationsStore.getSelectedOrganization());
const organizations = computed(() => organizationsStore.getOrganizations());

// Format organization name for display (truncate if too long)
const displayName = computed(() => {
    if (!currentOrganization.value) return 'Select Organization';
    const name = currentOrganization.value.name;
    return name.length > 25 ? name.substring(0, 22) + '...' : name;
});

// Load organizations from API on component mount
onMounted(async () => {
    isMounted.value = true;    
    // Only load if not already loaded
    if (organizations.value.length === 0) {
        isLoading.value = true;
        try {
            await organizationsStore.retrieveOrganizations();
        } catch (error) {
            console.error('[OrganizationSwitcher] Failed to load organizations:', error);
        } finally {
            isLoading.value = false;
        }
    }
});

/**
 * Switch to selected organization
 * Triggers data refresh for new organization context
 */
async function selectOrganization(organization: IOrganization) {
    if (currentOrganization.value?.id === organization.id) {
        // Already selected, no-op
        return;
    }
    
    organizationsStore.setSelectedOrganization(organization);
    
    // Refresh all data for new organization context
    try {
        // Clear existing data to show loading states
        projectsStore.clearProjects();
        dataSourceStore.clearDataSources();
        dashboardsStore.clearDashboards();
        
        // Refresh all data stores with new organization context
        await Promise.all([
            projectsStore.retrieveProjects(),
            dataSourceStore.retrieveDataSources(),
            dashboardsStore.retrieveDashboards(),
        ]);
        
    } catch (error) {
        console.error('[OrganizationSwitcher] Failed to refresh data:', error);
    }
}

// Show role badge for current user's role in the organization
function getRoleBadge(org: IOrganization): string {
    if (org.user_role === 'owner') return 'Owner';
    if (org.user_role === 'admin') return 'Admin';
    return 'Member';
}

function getRoleBadgeClass(org: IOrganization): string {
    if (org.user_role === 'owner') return 'bg-purple-100 text-purple-800';
    if (org.user_role === 'admin') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
}

function openCreateModal() {
    showCreateModal.value = true;
}

function closeCreateModal() {
    showCreateModal.value = false;
}

function openSettingsModal(org: IOrganization, event?: MouseEvent) {
    // Stop propagation to prevent triggering org selection
    if (event) {
        event.stopPropagation();
    }
    selectedOrgForSettings.value = org;
    showSettingsModal.value = true;
}

function closeSettingsModal() {
    showSettingsModal.value = false;
    selectedOrgForSettings.value = null;
}

</script>

<template>
    <ClientOnly>
        <div v-if="isMounted" class="flex items-center">
            <menu-dropdown direction="left" offset-y="10">
                <template #menuItem="{ onClick }">
                    <div 
                        @click="onClick" 
                        class="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 rounded-lg cursor-pointer transition-all duration-200 shadow-sm border border-gray-200 text-primary-blue-200"
                    >
                        <!-- Organization Icon -->
                        <font-awesome-icon 
                            :icon="['fas', 'building']" 
                            class="text-primary-blue-200 text-sm"
                        />
                        
                        <!-- Organization Name -->
                        <span class="text-primary-blue-200 text-sm font-medium">
                            {{ displayName }}
                        </span>
                        
                        <!-- Dropdown Arrow -->
                        <font-awesome-icon 
                            :icon="['fas', 'chevron-down']" 
                            class="text-primary-blue-200 text-xs ml-1"
                        />
                    </div>
                </template>
                
                <template #dropdownMenu="{ onClick }">
                    <div class="flex flex-col min-w-[280px] max-h-[400px] overflow-y-auto">
                        <!-- Header -->
                        <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
                            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Switch Organization
                            </p>
                        </div>
                        
                        <!-- Loading State -->
                        <div v-if="isLoading" class="px-4 py-8 text-center">
                            <font-awesome-icon 
                                :icon="['fas', 'spinner']" 
                                class="text-gray-400 text-2xl animate-spin"
                            />
                            <p class="text-sm text-gray-500 mt-2">Loading organizations...</p>
                        </div>
                        
                        <!-- Organizations List -->
                        <div v-else-if="organizations.length > 0" class="py-1">
                            <div
                                v-for="org in organizations"
                                :key="org.id"
                                @click="() => { selectOrganization(org); onClick(); }"
                                class="px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                :class="{
                                    'bg-blue-50': currentOrganization?.id === org.id
                                }"
                            >
                                <div class="flex items-start justify-between">
                                    <div class="flex items-start gap-3 flex-1">
                                        <!-- Organization Icon -->
                                        <div class="flex-shrink-0 mt-0.5">
                                            <font-awesome-icon 
                                                :icon="['fas', 'building']" 
                                                class="text-gray-400 text-lg"
                                            />
                                        </div>
                                        
                                        <!-- Organization Details -->
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm font-medium text-gray-900 truncate">
                                                {{ org.name }}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <!-- Role Badge & Active Indicator -->
                                    <div class="flex items-center gap-2 ml-2">
                                        <!-- Settings Button -->
                                        <button
                                            v-if="org.user_role === 'owner' || org.user_role === 'admin'"
                                            @click.stop="openSettingsModal(org, $event)"
                                            class="p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                                            title="Organization Settings"
                                        >
                                            <font-awesome-icon 
                                                :icon="['fas', 'gear']" 
                                                class="text-gray-500 hover:text-gray-700 text-sm"
                                            />
                                        </button>
                                        
                                        <span 
                                            :class="getRoleBadgeClass(org)"
                                            class="px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap"
                                        >
                                            {{ getRoleBadge(org) }}
                                        </span>
                                        
                                        <!-- Active Check -->
                                        <font-awesome-icon 
                                            v-if="currentOrganization?.id === org.id"
                                            :icon="['fas', 'check']" 
                                            class="text-blue-600 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Empty State -->
                        <div v-else class="px-4 py-8 text-center">
                            <font-awesome-icon 
                                :icon="['fas', 'building']" 
                                class="text-gray-300 text-3xl mb-2"
                            />
                            <p class="text-sm text-gray-500">No organizations available</p>
                        </div>
                        
                        <!-- Footer - Create New Organization -->
                        <div class="px-4 py-2 bg-gray-50 border-t border-gray-200">
                            <button 
                                type="button"
                                @click="openCreateModal"
                                class="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-2 font-medium"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" />
                                <span>Create Organization</span>
                            </button>
                        </div>
                    </div>
                </template>
            </menu-dropdown>
        </div>
        
        <!-- SSR Fallback -->
        <template #fallback>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white bg-opacity-20 rounded-lg">
                <div class="animate-pulse h-4 w-4 bg-white bg-opacity-30 rounded"></div>
                <div class="animate-pulse h-4 w-24 bg-white bg-opacity-30 rounded"></div>
            </div>
        </template>
    </ClientOnly>
    
    <!-- Create Organization Modal -->
    <CreateOrganizationModal 
        v-if="showCreateModal" 
        @close="closeCreateModal"
    />
    
    <!-- Organization Settings Modal -->
    <OrganizationSettingsModal
        v-if="showSettingsModal && selectedOrgForSettings"
        :organization="selectedOrgForSettings"
        @close="closeSettingsModal"
        @updated="closeSettingsModal"
        @deleted="closeSettingsModal"
    />
</template>
