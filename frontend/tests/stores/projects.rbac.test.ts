import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectsStore } from '../../stores/projects';
import type { IProject } from '../../types/IProject';

/**
 * Frontend RBAC Tests for Projects Store
 * Tests that store properly validates and normalizes RBAC data
 */
describe('Projects Store RBAC', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        };
        global.localStorage = localStorageMock as any;
    });

    describe('setProjects RBAC Validation', () => {
        it('should normalize is_owner to boolean', () => {
            const store = useProjectsStore();
            
            const projects: IProject[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: true,
                    user_role: 'owner',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].is_owner).toBe(true);
            expect(typeof result[0].is_owner).toBe('boolean');
        });

        it('should convert undefined is_owner to false', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: undefined,
                    user_role: 'viewer',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].is_owner).toBe(false);
        });

        it('should default user_role to viewer when missing', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: false,
                    user_role: undefined,
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].user_role).toBe('viewer');
        });

        it('should preserve valid user_role values', () => {
            const store = useProjectsStore();
            
            const roles: Array<'owner' | 'admin' | 'editor' | 'viewer'> = ['owner', 'admin', 'editor', 'viewer'];
            
            roles.forEach((role, index) => {
                const projects: IProject[] = [
                    {
                        id: index + 1,
                        user_platform_id: 1,
                        name: `Test Project ${index}`,
                        is_owner: role === 'owner',
                        user_role: role,
                        DataSources: []
                    }
                ];

                store.setProjects(projects);
                const result = store.getProjects();

                expect(result[0].user_role).toBe(role);
            });
        });

        it('should initialize empty members array when missing', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: true,
                    user_role: 'owner',
                    DataSources: [],
                    members: undefined
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].members).toEqual([]);
            expect(Array.isArray(result[0].members)).toBe(true);
        });

        it('should preserve existing members array', () => {
            const store = useProjectsStore();
            
            const members = [
                {
                    id: 1,
                    role: 'owner' as const,
                    user: {
                        id: 1,
                        first_name: 'Test',
                        last_name: 'User',
                        email: 'test@test.com'
                    },
                    added_at: '2026-01-01',
                    invited_by: null
                }
            ];

            const projects: IProject[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: true,
                    user_role: 'owner',
                    DataSources: [],
                    members
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].members).toEqual(members);
        });

        it('should initialize counts to 0 when missing', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: true,
                    user_role: 'owner',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].data_sources_count).toBe(0);
            expect(result[0].data_models_count).toBe(0);
            expect(result[0].dashboards_count).toBe(0);
        });
    });

    describe('Multiple Projects RBAC', () => {
        it('should handle mixed ownership correctly', () => {
            const store = useProjectsStore();
            
            const projects: IProject[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Owned Project',
                    is_owner: true,
                    user_role: 'owner',
                    DataSources: []
                },
                {
                    id: 2,
                    user_platform_id: 2,
                    name: 'Admin Project',
                    is_owner: false,
                    user_role: 'admin',
                    DataSources: []
                },
                {
                    id: 3,
                    user_platform_id: 3,
                    name: 'Editor Project',
                    is_owner: false,
                    user_role: 'editor',
                    DataSources: []
                },
                {
                    id: 4,
                    user_platform_id: 4,
                    name: 'Viewer Project',
                    is_owner: false,
                    user_role: 'viewer',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result).toHaveLength(4);
            expect(result[0].is_owner).toBe(true);
            expect(result[0].user_role).toBe('owner');
            expect(result[1].is_owner).toBe(false);
            expect(result[1].user_role).toBe('admin');
            expect(result[2].is_owner).toBe(false);
            expect(result[2].user_role).toBe('editor');
            expect(result[3].is_owner).toBe(false);
            expect(result[3].user_role).toBe('viewer');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty projects array', () => {
            const store = useProjectsStore();
            
            store.setProjects([]);
            const result = store.getProjects();

            expect(result).toEqual([]);
        });

        it('should handle null/undefined is_owner values', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project 1',
                    is_owner: null,
                    user_role: 'viewer',
                    DataSources: []
                },
                {
                    id: 2,
                    user_platform_id: 1,
                    name: 'Test Project 2',
                    is_owner: undefined,
                    user_role: 'viewer',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            expect(result[0].is_owner).toBe(false);
            expect(result[1].is_owner).toBe(false);
        });

        it('should handle falsy is_owner values correctly', () => {
            const store = useProjectsStore();
            
            const projects: any[] = [
                {
                    id: 1,
                    user_platform_id: 1,
                    name: 'Test Project',
                    is_owner: false,
                    user_role: 'viewer',
                    DataSources: []
                }
            ];

            store.setProjects(projects);
            const result = store.getProjects();

            // false should remain false, not be coerced to true
            expect(result[0].is_owner).toBe(false);
            expect(result[0].is_owner).not.toBe(true);
        });
    });
});
