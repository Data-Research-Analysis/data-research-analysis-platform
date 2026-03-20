export const useOrganizationManagement = () => {
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
     * Update organization details
     */
    const updateOrganization = async (
        organizationId: number,
        updates: { name?: string; domain?: string; logoUrl?: string }
    ): Promise<{ success: boolean; data?: any; error?: string }> => {
        try {
            const headers = authHeaders();
            headers['X-Organization-Id'] = organizationId.toString();
            
            const response = await $fetch<{ success: boolean; data: any; message?: string }>(
                `${config.public.apiBase}/organizations/${organizationId}`,
                {
                    method: 'PUT',
                    headers: headers,
                    body: updates
                }
            );
            return { success: response.success, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationManagement] updateOrganization error:', error);
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to update organization'
            };
        }
    };

    /**
     * Delete organization
     * Requires name confirmation
     */
    const deleteOrganization = async (
        organizationId: number,
        confirmName: string
    ): Promise<{ success: boolean; error?: string }> => {
        console.log('[useOrganizationManagement] deleteOrganization called');
        console.log('[useOrganizationManagement] organizationId:', organizationId);
        console.log('[useOrganizationManagement] confirmName:', confirmName);
        
        try {
            const url = `${config.public.apiBase}/organizations/${organizationId}`;
            console.log('[useOrganizationManagement] DELETE URL:', url);
            console.log('[useOrganizationManagement] Request body:', { confirmName });
            
            const headers = authHeaders();
            headers['X-Organization-Id'] = organizationId.toString();
            console.log('[useOrganizationManagement] Request headers:', headers);
            
            const response = await $fetch<{ success: boolean; message?: string }>(
                url,
                {
                    method: 'DELETE',
                    headers: headers,
                    body: { confirmName }
                }
            );
            
            console.log('[useOrganizationManagement] API response:', response);
            return { success: response.success };
        } catch (error: any) {
            console.error('[useOrganizationManagement] deleteOrganization error:', error);
            console.error('[useOrganizationManagement] error.data:', error?.data);
            console.error('[useOrganizationManagement] error.message:', error?.message);
            console.error('[useOrganizationManagement] error.statusCode:', error?.statusCode);
            
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to delete organization'
            };
        }
    };

    return {
        updateOrganization,
        deleteOrganization
    };
};
