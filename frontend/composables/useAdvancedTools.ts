import { computed } from 'vue';
import { useOrganizationsStore } from '~/stores/organizations';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

/**
 * Advanced-tools visibility for the project sidebar and settings.
 *
 * The organization setting `show_advanced_tools` is the master switch and is
 * off by default for every organization:
 *   - Platform admins (user_type 'admin') always see advanced tools.
 *   - Everyone else (normal users, CMO/manager/analyst roles) sees them only
 *     when the organization has enabled the toggle.
 *
 * The toggle itself is manageable by platform admins or organization
 * owners/admins.
 */
export const useAdvancedTools = () => {
    const orgStore = useOrganizationsStore();
    const loggedInUserStore = useLoggedInUserStore();

    const isSystemAdmin = computed(() => {
        const user = loggedInUserStore.getLoggedInUser();
        return user?.user_type === 'admin';
    });

    /** The org-wide opt-in flag (default off). */
    const orgAdvancedEnabled = computed(() =>
        orgStore.currentOrganization?.settings?.show_advanced_tools === true,
    );

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
