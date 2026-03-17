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
import { useDataSourcesStore } from '@/stores/data_sources';
import { useDashboardsStore } from '@/stores/dashboards';
import type { IOrganization } from '~/types/IOrganization';

const organizationsStore = useOrganizationsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourcesStore();
const dashboardsStore = useDashboardsStore();
const isMounted = ref(false);
const isLoading = ref(false);

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
    
    console.log('[OrganizationSwitcher] Switching to organization:', organization.name);
    organizationsStore.setSelectedOrganization(organization);
    
    // Refresh all data for new organization context
    console.log('[OrganizationSwitcher] Refreshing data for new organization...');
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
        
        console.log('[OrganizationSwitcher] Data refresh complete');
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
</script>

<template>
    <ClientOnly>
        <div v-if="isMounted" class="flex items-center">
            <menu-dropdown direction="left" offset-y="10">
                <template #menuItem="{ onClick }">
                    <div 
                        @click="onClick" 
                        class="flex items-center gap-2 px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg cursor-pointer transition-all duration-200 border border-white border-opacity-30"
                    >
                        <!-- Organization Icon -->
                        <font-awesome-icon 
                            :icon="['fas', 'building']" 
                            class="text-white text-sm"
                        />
                        
                        <!-- Organization Name -->
                        <span class="text-white text-sm font-medium">
                            {{ displayName }}
                        </span>
                        
                        <!-- Dropdown Arrow -->
                        <font-awesome-icon 
                            :icon="['fas', 'chevron-down']" 
                            class="text-white text-xs ml-1"
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
                                            <p class="text-xs text-gray-500 truncate mt-0.5">
                                                {{ org.slug }}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <!-- Role Badge & Active Indicator -->
                                    <div class="flex items-center gap-2 ml-2">
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
                        
                        <!-- Footer - Create New Organization (future) -->
                        <div class="px-4 py-2 bg-gray-50 border-t border-gray-200">
                            <button 
                                disabled
                                class="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" />
                                <span>Create Organization (Coming Soon)</span>
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
</template>
