import { getAuthToken } from '~/composables/AuthToken';
import { useAdvancedTools } from '~/composables/useAdvancedTools';

/**
 * Keep organizations that hid the BI layer (org-wide `show_advanced_tools`
 * setting) out of the advanced-tools routes. The server also rejects
 * advanced API writes.
 *
 * Runs client-side like the rest of the data middleware.
 */
export default defineNuxtRouteMiddleware(async (to) => {
    if (typeof window === 'undefined') return;
    if (!getAuthToken()) return;

    const match = to.path.match(
        /^\/projects\/(\d+)\/(?:data-models|dashboards|reports|ai-insights|channels\/\d+\/data-models)(?:\/|$)/
    );
    if (!match) return;

    const { canSeeAdvanced } = useAdvancedTools();
    if (canSeeAdvanced.value) return;

    return navigateTo(`/projects/${match[1]}/channels`);
});
