import { getAuthToken } from '~/composables/AuthToken';
import { useSubscriptionStore } from '~/stores/subscription';
import { useAdvancedTools } from '~/composables/useAdvancedTools';

/**
 * Keep Free/Starter organizations (and Professional+ orgs that hid the BI
 * layer) out of the advanced-tools routes. The plan entitlement and the
 * org-wide `show_advanced_tools` setting are both resolved by
 * `useAdvancedTools`; the server also rejects advanced API writes.
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

    const subscriptionStore = useSubscriptionStore();
    if (!subscriptionStore.usageStats) {
        await subscriptionStore.fetchUsageStats().catch(() => null);
    }

    const { canSeeAdvanced } = useAdvancedTools();
    if (canSeeAdvanced.value) return;

    return navigateTo(`/projects/${match[1]}/channels`);
});
