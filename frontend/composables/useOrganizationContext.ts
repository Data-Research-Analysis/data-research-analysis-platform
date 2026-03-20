/**
 * Organization Context Composable
 * 
 * Provides organization and workspace context headers for API requests.
 * Auto-imports selected organization/workspace from Pinia store.
 * 
 * Usage:
 * ```typescript
 * const { getOrgHeaders, getOrgId, getWorkspaceId } = useOrganizationContext();
 * 
 * // Add to API request
 * await $fetch('/api/projects', {
 *     headers: {
 *         ...authHeaders, // Your auth headers
 *         ...getOrgHeaders() // Organization context headers
 *     }
 * });
 * ```
 * 
 * Headers Generated:
 * - X-Organization-Id: Current organization ID
 * - X-Workspace-Id: Current workspace ID (if available)
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */

import { useOrganizationsStore } from '@/stores/organizations';

export const useOrganizationContext = () => {
    const organizationsStore = useOrganizationsStore();
    
    /**
     * Get current organization ID
     * @returns Organization ID or null if not selected
     */
    function getOrgId(): number | null {
        const org = organizationsStore.getSelectedOrganization();
        return org?.id || null;
    }
    
    /**
     * Get current workspace ID
     * @returns Workspace ID or null if not selected
     */
    function getWorkspaceId(): number | null {
        const workspace = organizationsStore.getSelectedWorkspace();
        return workspace?.id || null;
    }
    
    /**
     * Get organization context headers for API requests
     * @returns Headers object to spread into fetch config
     */
    function getOrgHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        
        const orgId = getOrgId();
        if (orgId) {
            headers['X-Organization-Id'] = orgId.toString();
        }
        
        const workspaceId = getWorkspaceId();
        if (workspaceId) {
            headers['X-Workspace-Id'] = workspaceId.toString();
        }
        
        return headers;
    }
    
    /**
     * Get complete headers including auth and organization context
     * @param token - Optional auth token (will use getAuthToken if not provided)
     * @returns Complete headers object for API requests
     */
    function getHeaders(token?: string): Record<string, string> {
        const authToken = token || getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
            headers['Authorization-Type'] = 'auth';
        }
        
        // Add organization context headers
        const orgHeaders = getOrgHeaders();
        Object.assign(headers, orgHeaders);
        
        return headers;
    }
    
    return {
        getOrgId,
        getWorkspaceId,
        getOrgHeaders,
        getHeaders,
    };
};
