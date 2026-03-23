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
    
    /**
     * Validate that a workspace is selected and return its ID.
     * 
     * CRITICAL: After Phase 1, all project/campaign CRUD operations require a workspace.
     * Call this before ANY create/update operation to ensure workspace context exists.
     * 
     * @returns Validation result with workspace ID and error message if invalid
     * @example
     * ```typescript
     * const validation = requireWorkspace();
     * if (!validation.valid) {
     *   alert(validation.error);
     *   return;
     * }
     * // Proceed with API call using validation.workspaceId
     * ```
     */
    function requireWorkspace(): {
        valid: boolean;
        workspaceId: number | null;
        organizationId: number | null;
        error: string | null;
    } {
        const orgId = getOrgId();
        const workspaceId = getWorkspaceId();

        // Check organization first
        if (orgId === null) {
            return {
                valid: false,
                workspaceId: null,
                organizationId: null,
                error: 'No organization selected. Please select an organization first.',
            };
        }

        // Check workspace
        if (workspaceId === null) {
            return {
                valid: false,
                workspaceId: null,
                organizationId: orgId,
                error: 'No workspace selected. Please select a workspace from the sidebar before creating a project.',
            };
        }

        return {
            valid: true,
            workspaceId,
            organizationId: orgId,
            error: null,
        };
    }
    
    /**
     * Get the current workspace name for display purposes.
     * @returns Workspace name or empty string if not selected
     */
    function getWorkspaceName(): string {
        const workspace = organizationsStore.getSelectedWorkspace();
        return workspace?.name ?? '';
    }

    /**
     * Get the current organization name for display purposes.
     * @returns Organization name or empty string if not selected
     */
    function getOrganizationName(): string {
        const org = organizationsStore.getSelectedOrganization();
        return org?.name ?? '';
    }
    
    return {
        getOrgId,
        getWorkspaceId,
        getOrgHeaders,
        getHeaders,
        requireWorkspace,
        getWorkspaceName,
        getOrganizationName,
    };
};
