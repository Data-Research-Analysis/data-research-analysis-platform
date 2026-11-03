import { computed } from 'vue';
import { useOrganizationsStore } from '~/stores/organizations';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

/**
 * Advanced-tools visibility for the project sidebar and settings.
 *
 * Every plan includes the BI layer (data models, dashboards, reports, AI
 * insights, engineering connectors). The only remaining switch is the
 * organization setting `show_advanced_tools`, on by default (a missing key
 * means enabled), which lets an org hide the layer from non-technical teams.
 *
 * Platform admins (user_type 'admin') always see advanced tools. The org
 * setting itself is manageable by platform admins or org owners/admins.
 */
export const useAdvancedTools = () => {
    const orgStore = useOrganizationsStore();
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

    /** Whether the current user should see advanced tools at all. */
    const canSeeAdvanced = computed(() => {
        if (isSystemAdmin.value) return true;
        return orgAdvancedEnabled.value;
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
    };
};
