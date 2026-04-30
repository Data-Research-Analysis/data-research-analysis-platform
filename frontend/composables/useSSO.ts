export interface ISSOConfigurationPayload {
    idp_name: string;
    idp_entity_id: string;
    idp_sso_url: string;
    idp_certificate: string;
    sp_entity_id: string;
    attribute_mapping?: Record<string, string> | null;
    is_enabled?: boolean;
    allow_jit_provisioning?: boolean;
    enforce_sso?: boolean;
}

export const useSSO = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required.');
        }

        return {
            Authorization: `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json'
        };
    };

    const getConfiguration = async (organizationId: number) => {
        const response = await $fetch<{ success: boolean; data: any }>(
            `${config.public.apiBase}/sso/config/${organizationId}`,
            { headers: authHeaders() }
        );
        return response?.success ? response.data : null;
    };

    const saveConfiguration = async (organizationId: number, payload: ISSOConfigurationPayload) => {
        const response = await $fetch<{ success: boolean; data: any }>(
            `${config.public.apiBase}/sso/config/${organizationId}`,
            {
                method: 'POST',
                headers: authHeaders(),
                body: payload
            }
        );
        return response?.success ? response.data : null;
    };

    const removeConfiguration = async (organizationId: number): Promise<boolean> => {
        const response = await $fetch<{ success: boolean }>(
            `${config.public.apiBase}/sso/config/${organizationId}`,
            {
                method: 'DELETE',
                headers: authHeaders()
            }
        );
        return !!response?.success;
    };

    const getSPMetadataUrl = (organizationId: number): string => {
        return `${config.public.apiBase}/sso/metadata/${organizationId}`;
    };

    const initiateDomainVerification = async (organizationId: number, domain: string) => {
        const response = await $fetch<{ success: boolean; data: { token: string } }>(
            `${config.public.apiBase}/sso/domain-verify/${organizationId}`,
            {
                method: 'POST',
                headers: authHeaders(),
                body: { domain }
            }
        );
        return response?.success ? response.data : null;
    };

    const checkDomainVerification = async (organizationId: number, domain: string): Promise<boolean> => {
        const response = await $fetch<{ success: boolean; verified: boolean }>(
            `${config.public.apiBase}/sso/domain-verify/${organizationId}/check?domain=${encodeURIComponent(domain)}`,
            { headers: authHeaders() }
        );
        return !!response?.verified;
    };

    const initiateLogin = async (email: string): Promise<boolean> => {
        const response = await $fetch<{ success: boolean; redirectUrl: string }>(
            `${config.public.apiBase}/auth/saml/login?email=${encodeURIComponent(email)}`
        );

        if (response?.success && response.redirectUrl && import.meta.client) {
            window.location.href = response.redirectUrl;
            return true;
        }

        return false;
    };

    /**
     * Initiate Single Logout for the given organization.
     * If the IdP returns a logoutUrl, the browser is redirected there.
     */
    const initiateLogout = async (organizationId: number): Promise<void> => {
        try {
            const response = await $fetch<{ success: boolean; logoutUrl?: string }>(
                `${config.public.apiBase}/auth/saml/logout?organizationId=${organizationId}`,
                { headers: authHeaders() }
            );

            if (response?.success && response.logoutUrl && import.meta.client) {
                window.location.href = response.logoutUrl;
            }
        } catch {
            // Silently ignore SLO errors — local logout already handled by caller
        }
    };

    return {
        getConfiguration,
        saveConfiguration,
        removeConfiguration,
        getSPMetadataUrl,
        initiateDomainVerification,
        checkDomainVerification,
        initiateLogin,
        initiateLogout
    };
};