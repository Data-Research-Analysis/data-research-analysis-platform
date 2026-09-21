import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useOrganizationsStore } from '../../stores/organizations';
import type { IOrganization, IOrganizationMember } from '../../types/IOrganization';
import type { IWorkspace } from '../../types/IWorkspace';

/**
 * Regression tests for the logout/login state leak.
 *
 * The organizations store drives the X-Organization-Id / X-Workspace-Id
 * headers on nearly every authenticated request. clearOrganizations() used to
 * reset only the organizations list, leaving the previously selected
 * organization/workspace/members in memory, so the next user inherited the
 * previous user's tenant context until a hard refresh.
 */
describe('Organizations store clearOrganizations', () => {
    let storage: Record<string, string>;

    beforeEach(() => {
        setActivePinia(createPinia());
        storage = {};
        global.localStorage = {
            getItem: (key: string) => (key in storage ? storage[key] : null),
            setItem: (key: string, value: string) => {
                storage[key] = value;
            },
            removeItem: (key: string) => {
                delete storage[key];
            },
            clear: () => {
                storage = {};
            },
            key: (index: number) => Object.keys(storage)[index] ?? null,
            get length() {
                return Object.keys(storage).length;
            },
        } as any;
    });

    it('resets every organization-scoped ref and localStorage key', () => {
        const store = useOrganizationsStore();

        const organization: IOrganization = { id: 7, name: 'Previous Org' } as IOrganization;
        const workspace: IWorkspace = {
            id: 3,
            name: 'Previous Workspace',
            organization_id: 7,
        } as IWorkspace;
        const members: IOrganizationMember[] = [{ id: 1 } as IOrganizationMember];

        store.setOrganizations([organization]);
        store.setSelectedOrganization(organization);
        store.setWorkspaces([workspace]);
        store.setSelectedWorkspace(workspace);
        store.setOrganizationMembers(7, members);

        // Sanity check the stale state exists before clearing
        expect(store.getSelectedOrganization()).toEqual(organization);
        expect(store.getSelectedWorkspace()).toEqual(workspace);

        store.clearOrganizations();

        expect(store.organizations).toEqual([]);
        expect(store.selectedOrganization).toBeNull();
        expect(store.currentWorkspaces).toEqual([]);
        expect(store.selectedWorkspace).toBeNull();
        expect(store.organizationMembers).toEqual({});

        expect(store.getSelectedOrganization()).toBeNull();
        expect(store.getSelectedWorkspace()).toBeNull();

        expect(localStorage.getItem('organizations')).toBeNull();
        expect(localStorage.getItem('selectedOrganization')).toBeNull();
        expect(localStorage.getItem('currentWorkspaces')).toBeNull();
        expect(localStorage.getItem('selectedWorkspace')).toBeNull();
        expect(localStorage.getItem('organizationMembers')).toBeNull();
    });

    it('does not leak stale selection when get is called after clear', () => {
        const store = useOrganizationsStore();
        store.setSelectedOrganization({ id: 9, name: 'Old' } as IOrganization);

        store.clearOrganizations();

        // getSelectedOrganization must not rehydrate from localStorage
        expect(store.getSelectedOrganization()).toBeNull();
    });
});
