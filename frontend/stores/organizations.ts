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
import type { IOrganization, IOrganizationUsage } from '~/types/IOrganization';
import type { IWorkspace } from '~/types/IWorkspace';

let initialized = false;

export const useOrganizationsStore = defineStore('organizationsDRA', () => {
    const organizations = ref<IOrganization[]>([]);
    const selectedOrganization = ref<IOrganization | null>(null);
    const currentWorkspaces = ref<IWorkspace[]>([]);
    const selectedWorkspace = ref<IWorkspace | null>(null);
    
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
            const data = await $fetch<IOrganization[]>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
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
            const data = await $fetch<IWorkspace[]>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': organizationId.toString(),
                },
            });
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
     * Clear all organization data (on logout)
     */
    function clearOrganizations() {
        organizations.value = [];
        selectedOrganization.value = null;
        currentWorkspaces.value = [];
        selectedWorkspace.value = null;
        
        if (import.meta.client) {
            localStorage.removeItem('organizations');
            localStorage.removeItem('selectedOrganization');
            localStorage.removeItem('currentWorkspaces');
            localStorage.removeItem('selectedWorkspace');
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
        
        initialized = true;
    }
    
    return {
        // State
        organizations,
        selectedOrganization,
        currentWorkspaces,
        selectedWorkspace,
        
        // Actions
        setOrganizations,
        setSelectedOrganization,
        setWorkspaces,
        setSelectedWorkspace,
        retrieveOrganizations,
        retrieveWorkspaces,
        getOrganizations,
        getSelectedOrganization,
        getWorkspaces,
        getSelectedWorkspace,
        clearOrganizations,
    };
});
