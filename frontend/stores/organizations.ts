/**
 * Organizations Pinia Store
 * 
 * Manages organizations the user belongs to and the currently selected organization.
 * Automatically syncs to localStorage on client for persistence across page reloads.
 * 
 * Store Pattern:
 * - State in refs (organizations, selectedOrganization)
 * - Actions as functions (setOrganizations, retrieveOrganizations, etc.)
 * - Auto-sync to localStorage on client
 * - Lazy initialization from localStorage on first access
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */

import { defineStore } from 'pinia';
import type { IOrganization, IOrganizationMember, IOrganizationUsage } from '~/types/IOrganization';
import type { IWorkspace } from '~/types/IWorkspace';

let initialized = false;

export const useOrganizationsStore = defineStore('organizationsDRA', () => {
    const organizations = ref<IOrganization[]>([]);
    const selectedOrganization = ref<IOrganization | null>(null);
    const currentWorkspaces = ref<IWorkspace[]>([]);
    const selectedWorkspace = ref<IWorkspace | null>(null);
    const organizationMembers = ref<Record<number, IOrganizationMember[]>>({});
    
    /**
     * Set organizations list from API response
     * Validates and normalizes data, syncs to localStorage
     */
    function setOrganizations(organizationsList: IOrganization[]) {
        console.log('[OrganizationsStore] setOrganizations called with', organizationsList.length, 'organizations');
        // Validate and normalize organization data
        organizations.value = organizationsList.map(org => ({
            ...org,
            is_owner: org.user_role === 'owner',
            user_role: org.user_role || 'member', // Default to least privilege
        }));
        console.log('[OrganizationsStore] organizations.value now contains', organizations.value.length, 'organizations');
        
        if (import.meta.client) {
            try {
                localStorage.setItem('organizations', JSON.stringify(organizations.value));
                enableRefreshDataFlag('setOrganizations');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[OrganizationsStore] localStorage quota exceeded for organizations');
                    enableRefreshDataFlag('setOrganizations');
                } else {
                    console.error('[OrganizationsStore] Error saving organizations to localStorage:', error);
                }
            }
        }
    }
    
    /**
     * Set currently selected organization
     * Also loads workspaces for the organization
     */
    function setSelectedOrganization(organization: IOrganization | null) {
        console.log('[OrganizationsStore] setSelectedOrganization:', organization?.name);
        selectedOrganization.value = organization;
        
        if (import.meta.client) {
            try {
                if (organization) {
                    localStorage.setItem('selectedOrganization', JSON.stringify(organization));
                } else {
                    localStorage.removeItem('selectedOrganization');
                }
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[OrganizationsStore] localStorage quota exceeded for selectedOrganization');
                } else {
                    console.error('[OrganizationsStore] Error saving selectedOrganization:', error);
                }
            }
        }
        
        // Auto-load workspaces for selected organization
        if (organization) {
            retrieveWorkspaces(organization.id).catch(console.error);
        } else {
            currentWorkspaces.value = [];
        }
    }
    
    /**
     * Set workspaces for current organization
     */
    function setWorkspaces(workspacesList: IWorkspace[]) {
        console.log('[OrganizationsStore] setWorkspaces called with', workspacesList.length, 'workspaces');
        currentWorkspaces.value = workspacesList;
        
        if (import.meta.client) {
            try {
                localStorage.setItem('currentWorkspaces', JSON.stringify(workspacesList));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[OrganizationsStore] localStorage quota exceeded for workspaces');
                } else {
                    console.error('[OrganizationsStore] Error saving workspaces:', error);
                }
            }
        }
    }
    
    /**
     * Set organization members for a specific organization
     */
    function setOrganizationMembers(organizationId: number, members: IOrganizationMember[]) {
        console.log('[OrganizationsStore] setOrganizationMembers for org', organizationId, 'with', members.length, 'members');
        organizationMembers.value[organizationId] = members;
        
        if (import.meta.client) {
            try {
                localStorage.setItem('organizationMembers', JSON.stringify(organizationMembers.value));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[OrganizationsStore] localStorage quota exceeded for organization members');
                } else {
                    console.error('[OrganizationsStore] Error saving organization members:', error);
                }
            }
        }
    }
    
    /**
     * Set currently selected workspace
     */
    function setSelectedWorkspace(workspace: IWorkspace | null) {
        console.log('[OrganizationsStore] setSelectedWorkspace:', workspace?.name);
        selectedWorkspace.value = workspace;
        
        if (import.meta.client) {
            try {
                if (workspace) {
                    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
                } else {
                    localStorage.removeItem('selectedWorkspace');
                }
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[OrganizationsStore] localStorage quota exceeded for selectedWorkspace');
                } else {
                    console.error('[OrganizationsStore] Error saving selectedWorkspace:', error);
                }
            }
        }
    }
    
    /**
     * Fetch organizations from API
     */
    async function retrieveOrganizations() {
        console.log('[OrganizationsStore] retrieveOrganizations called');
        const token = getAuthToken();
        if (!token) {
            console.log('[OrganizationsStore] No token, clearing organizations');
            organizations.value = [];
            return;
        }
        
        const config = useRuntimeConfig();
        const url = `${config.public.apiBase}/organizations`;
        console.log('[OrganizationsStore] Fetching organizations from API...');
        
        try {
            const response = await $fetch<{ success: boolean; data: IOrganization[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
            const data = response.data || [];
            console.log('[OrganizationsStore] API returned', data.length, 'organizations');
            setOrganizations(data);
            
            // Auto-select first organization if none selected and organizations exist
            if (data.length > 0 && !selectedOrganization.value) {
                setSelectedOrganization(data[0]);
            }
        } catch (error) {
            console.error('[OrganizationsStore] Failed to fetch organizations:', error);
            throw error;
        }
    }
    
    /**
     * Fetch workspaces for a specific organization
     */
    async function retrieveWorkspaces(organizationId: number) {
        console.log('[OrganizationsStore] retrieveWorkspaces for org', organizationId);
        const token = getAuthToken();
        if (!token) {
            console.log('[OrganizationsStore] No token, clearing workspaces');
            currentWorkspaces.value = [];
            return;
        }
        
        const config = useRuntimeConfig();
        const url = `${config.public.apiBase}/organizations/${organizationId}/workspaces`;
        console.log('[OrganizationsStore] Fetching workspaces from API...');
        
        try {
            const response = await $fetch<{ success: boolean; data: IWorkspace[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': organizationId.toString(),
                },
            });
            const data = response.data || [];
            console.log('[OrganizationsStore] API returned', data.length, 'workspaces');
            setWorkspaces(data);
            
            // Auto-select default workspace if none selected
            if (data.length > 0 && !selectedWorkspace.value) {
                const defaultWorkspace = data.find(w => w.is_default) || data[0];
                setSelectedWorkspace(defaultWorkspace);
            }
        } catch (error) {
            console.error('[OrganizationsStore] Failed to fetch workspaces:', error);
            throw error;
        }
    }
    
    /**
     * Fetch members for a specific organization
     */
    async function retrieveOrganizationMembers(organizationId: number) {
        console.log('[OrganizationsStore] retrieveOrganizationMembers for org', organizationId);
        const token = getAuthToken();
        if (!token) {
            console.log('[OrganizationsStore] No token, cannot fetch members');
            return;
        }
        
        const config = useRuntimeConfig();
        const url = `${config.public.apiBase}/organizations/${organizationId}/members`;
        console.log('[OrganizationsStore] Fetching organization members from API...');
        
        try {
            const response = await $fetch<{ success: boolean; members: any[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': organizationId.toString(),
                },
            });
            
            if (response.success && response.members) {
                const members: IOrganizationMember[] = response.members.map((m: any) => ({
                    id: m.id,
                    organization_id: organizationId,
                    user_id: m.users_platform_id,
                    role: m.role || 'member',
                    joined_at: new Date(m.joined_at || m.created_at),
                    invited_by: m.invited_by || null,
                    is_active: m.is_active !== false,
                    user: {
                        id: m.users_platform_id,
                        email: m.user_email,
                        first_name: m.user_first_name || m.user_name?.split(' ')[0] || '',
                        last_name: m.user_last_name || m.user_name?.split(' ').slice(1).join(' ') || '',
                    }
                }));
                
                console.log('[OrganizationsStore] API returned', members.length, 'members');
                setOrganizationMembers(organizationId, members);
            } else {
                setOrganizationMembers(organizationId, []);
            }
        } catch (error) {
            console.error('[OrganizationsStore] Failed to fetch organization members:', error);
            throw error;
        }
    }
    
    /**
     * Get organizations (returns current value, use retrieveOrganizations to refresh from API)
     */
    function getOrganizations() {
        console.log('[OrganizationsStore] getOrganizations called, returning', organizations.value.length, 'organizations');
        return organizations.value;
    }
    
    /**
     * Get currently selected organization
     */
    function getSelectedOrganization() {
        // Load from localStorage only if not already set
        if (import.meta.client && !selectedOrganization.value && localStorage.getItem('selectedOrganization')) {
            const stored = JSON.parse(localStorage.getItem('selectedOrganization') || 'null');
            selectedOrganization.value = stored;
        }
        return selectedOrganization.value;
    }
    
    /**
     * Get workspaces for current organization
     */
    function getWorkspaces() {
        return currentWorkspaces.value;
    }
    
    /**
     * Get currently selected workspace
     */
    function getSelectedWorkspace() {
        // Load from localStorage only if not already set
        if (import.meta.client && !selectedWorkspace.value && localStorage.getItem('selectedWorkspace')) {
            const stored = JSON.parse(localStorage.getItem('selectedWorkspace') || 'null');
            selectedWorkspace.value = stored;
        }
        return selectedWorkspace.value;
    }
    
    /**
     * Get members for a specific organization
     */
    function getOrganizationMembers(organizationId: number): IOrganizationMember[] {
        return organizationMembers.value[organizationId] || [];
    }
    
    /**
     * Clear all organization data (on logout)
     */
    function clearOrganizations() {
        organizations.value = [];
        selectedOrganization.value = null;
        currentWorkspaces.value = [];
        selectedWorkspace.value = null;
        organizationMembers.value = {};
        
        if (import.meta.client) {
            localStorage.removeItem('organizations');
            localStorage.removeItem('selectedOrganization');
            localStorage.removeItem('currentWorkspaces');
            localStorage.removeItem('selectedWorkspace');
            localStorage.removeItem('organizationMembers');
            enableRefreshDataFlag('clearOrganizations');
        }
    }
    
    /**
     * Initialize from localStorage on client (run only once)
     */
    if (import.meta.client && !initialized && localStorage.getItem('organizations')) {
        const cached: IOrganization[] = JSON.parse(localStorage.getItem('organizations') || '[]');
        organizations.value = cached;
        
        // Restore selected organization and workspace if available
        if (localStorage.getItem('selectedOrganization')) {
            selectedOrganization.value = JSON.parse(localStorage.getItem('selectedOrganization') || 'null');
        }
        if (localStorage.getItem('currentWorkspaces')) {
            currentWorkspaces.value = JSON.parse(localStorage.getItem('currentWorkspaces') || '[]');
        }
        if (localStorage.getItem('selectedWorkspace')) {
            selectedWorkspace.value = JSON.parse(localStorage.getItem('selectedWorkspace') || 'null');
        }
        if (localStorage.getItem('organizationMembers')) {
            organizationMembers.value = JSON.parse(localStorage.getItem('organizationMembers') || '{}');
        }
        
        initialized = true;
    }
    
    // Computed - alias for backward compatibility
    const currentOrganization = computed(() => selectedOrganization.value);
    
    return {
        // State
        organizations,
        selectedOrganization,
        currentOrganization,  // Computed alias for selectedOrganization
        currentWorkspaces,
        selectedWorkspace,
        organizationMembers,
        
        // Actions
        setOrganizations,
        setSelectedOrganization,
        setWorkspaces,
        setSelectedWorkspace,
        setOrganizationMembers,
        retrieveOrganizations,
        retrieveWorkspaces,
        retrieveOrganizationMembers,
        getOrganizations,
        getSelectedOrganization,
        getWorkspaces,
        getSelectedWorkspace,
        getOrganizationMembers,
        clearOrganizations,
    };
});
