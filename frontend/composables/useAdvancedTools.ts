import { computed } from 'vue';
import { useOrganizationsStore } from '~/stores/organizations';
import { useSubscriptionStore } from '~/stores/subscription';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

/**
 * Advanced-tools visibility for the project sidebar and settings.
 *
 * Two switches decide whether the BI layer is visible:
 *   1. Plan entitlement (`advancedToolsAllowed`): data models, custom
 *      dashboards, reports, AI insights and engineering connectors are part of
 *      the Professional plan and above. Free and Starter get a locked upsell.
 *   2. The organization setting `show_advanced_tools`, on by default (a
 *      missing key means enabled), lets a Professional+ org hide the layer
 *      from non-technical teams.
 *
 * Platform admins (user_type 'admin') always see advanced tools. The org
 * setting itself is manageable by platform admins or org owners/admins.
 */
export const useAdvancedTools = () => {
    const orgStore = useOrganizationsStore();
    const subscriptionStore = useSubscriptionStore();
    const loggedInUserStore = useLoggedInUserStore();

    const isSystemAdmin = computed(() => {
        const user = loggedInUserStore.getLoggedInUser();
        return user?.user_type === 'admin';
    });

    /** The org-wide flag (on by default when the key is absent). */
    const orgAdvancedEnabled = computed(() => {
        const settings = orgStore.currentOrganization?.settings;
        if (!settings) return false;
        return settings.show_advanced_tools !== false;
    });

    /**
     * Whether the current plan includes the BI layer. Fails closed: while usage
     * stats are unknown (or the usage endpoint errors) advanced tools stay
     * hidden. The project layout fetches stats on mount, so a paid org sees the
     * section appear as soon as the entitlement is confirmed.
     */
    const tierAllowsAdvanced = computed(() => subscriptionStore.advancedToolsAllowed === true);

    /** Whether the current user should see advanced tools at all. */
    const canSeeAdvanced = computed(() => {
        if (isSystemAdmin.value) return true;
        return tierAllowsAdvanced.value && orgAdvancedEnabled.value;
    });

    /** Whether the current user may change the org-wide advanced setting. */
    const canManageAdvanced = computed(() => {
        if (isSystemAdmin.value) return true;
        const org = orgStore.currentOrganization;
        return org?.user_role === 'owner' || org?.user_role === 'admin' || org?.is_owner === true;
    });

    return {
        canSeeAdvanced,
        canManageAdvanced,
        orgAdvancedEnabled,
        tierAllowsAdvanced,
    };
};
