export const useWorkspaceManagement = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json'
        };
    };

    /**
     * Update workspace details
     */
    const updateWorkspace = async (
        workspaceId: number,
        updates: { name?: string; slug?: string; description?: string }
    ): Promise<{ success: boolean; data?: any; error?: string }> => {
        try {
            const headers = authHeaders();
            headers['X-Workspace-Id'] = workspaceId.toString();
            
            const response = await $fetch<{ success: boolean; data: any; message?: string }>(
                `${config.public.apiBase}/workspaces/${workspaceId}`,
                {
                    method: 'PUT',
                    headers: headers,
                    body: updates
                }
            );
            return { success: response.success, data: response.data };
        } catch (error: any) {
            console.error('[useWorkspaceManagement] updateWorkspace error:', error);
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to update workspace'
            };
        }
    };

    /**
     * Delete workspace
     * Requires name confirmation
     */
    const deleteWorkspace = async (
        workspaceId: number,
        confirmName: string
    ): Promise<{ success: boolean; error?: string }> => {
        console.log('[useWorkspaceManagement] deleteWorkspace called');
        console.log('[useWorkspaceManagement] workspaceId:', workspaceId);
        console.log('[useWorkspaceManagement] confirmName:', confirmName);
        
        try {
            const url = `${config.public.apiBase}/workspaces/${workspaceId}`;
            console.log('[useWorkspaceManagement] DELETE URL:', url);
            console.log('[useWorkspaceManagement] Request body:', { confirmName });
            
            const headers = authHeaders();
            headers['X-Workspace-Id'] = workspaceId.toString();
            console.log('[useWorkspaceManagement] Request headers:', headers);
            
            const response = await $fetch<{ success: boolean; message?: string }>(
                url,
                {
                    method: 'DELETE',
                    headers: headers,
                    body: { confirmName }
                }
            );
            
            console.log('[useWorkspaceManagement] API response:', response);
            return { success: response.success };
        } catch (error: any) {
            console.error('[useWorkspaceManagement] deleteWorkspace error:', error);
            console.error('[useWorkspaceManagement] error.data:', error?.data);
            console.error('[useWorkspaceManagement] error.message:', error?.message);
            console.error('[useWorkspaceManagement] error.statusCode:', error?.statusCode);
            
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to delete workspace'
            };
        }
    };

    return {
        updateWorkspace,
        deleteWorkspace
    };
};
