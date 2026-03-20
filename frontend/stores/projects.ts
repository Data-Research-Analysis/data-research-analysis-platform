import {defineStore} from 'pinia'
import type { IProject } from '~/types/IProject';

let initialized = false;

interface IPendingInvitation {
    id: number;
    project_id: number;
    invited_email: string;
    marketing_role: string;
    status: string;
    expires_at: string;
    created_at: string;
}

export const useProjectsStore = defineStore('projectsDRA', () => {
    const projects = ref<IProject[]>([])
    const selectedProject = ref<IProject>()
    const myProjectRole = ref<'analyst' | 'manager' | 'cmo' | null>(null)
    const pendingInvitations = ref<Record<number, IPendingInvitation[]>>({})
    
    function setProjects(projectsList: IProject[]) {
        console.log('[ProjectsStore] setProjects called with', projectsList.length, 'projects');
        // Validate and normalize project data to ensure RBAC consistency
        projects.value = projectsList.map(p => ({
            ...p,
            is_owner: p.is_owner === true, // Ensure boolean
            user_role: p.user_role || 'viewer', // Default to least privilege
            my_role: p.my_role ?? null,
            members: p.members || [],
            data_sources_count: p.data_sources_count || 0,
            data_models_count: p.data_models_count || 0,
            dashboards_count: p.dashboards_count || 0,
        }))
        console.log('[ProjectsStore] projects.value now contains', projects.value.length, 'projects');
        if (import.meta.client) {
            try {
                localStorage.setItem('projects', JSON.stringify(projects.value));
                enableRefreshDataFlag('setProjects');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ProjectsStore] localStorage quota exceeded for projects. Data kept in memory only.');
                    enableRefreshDataFlag('setProjects');
                } else {
                    console.error('[ProjectsStore] Error saving projects to localStorage:', error);
                }
            }
        }
    }
    function setSelectedProject(project: IProject) {
        selectedProject.value = project
        myProjectRole.value = project.my_role ?? null
        if (import.meta.client) {
            try {
                localStorage.setItem('selectedProject', JSON.stringify(project));
                localStorage.setItem('myProjectRole', project.my_role ?? 'cmo');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ProjectsStore] localStorage quota exceeded for selectedProject.');
                } else {
                    console.error('[ProjectsStore] Error saving selectedProject to localStorage:', error);
                }
            }
        }
    }
    function getProjects() {
        console.log('[ProjectsStore] getProjects called, returning', projects.value.length, 'projects');
        // Return current value - store already initializes from localStorage on load
        // Don't overwrite with localStorage on every call as it may be stale
        return projects.value;
    }
    async function retrieveProjects() {
        console.log('[ProjectsStore] retrieveProjects called');
        const token = getAuthToken();
        if (!token) {
            console.log('[ProjectsStore] No token, clearing projects');
            projects.value = [];
            return;
        }
        const url = `${baseUrl()}/project/list`;
        console.log('[ProjectsStore] Fetching projects from API...');
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        const data = await $fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
                ...orgHeaders,
            },
        });
        console.log('[ProjectsStore] API returned', Array.isArray(data) ? data.length : 'non-array', 'projects');
        setProjects(data)
    }
    function getSelectedProject() {
        // Load from localStorage only if not already set
        if (import.meta.client && !selectedProject.value && localStorage.getItem('selectedProject')) {
            const stored = JSON.parse(localStorage.getItem('selectedProject') || 'null')
            selectedProject.value = stored
            myProjectRole.value = (stored?.my_role ?? localStorage.getItem('myProjectRole') ?? null) as 'analyst' | 'manager' | 'cmo' | null
        }
        return selectedProject.value
    }
    function setPendingInvitations(projectId: number, invitations: IPendingInvitation[]) {
        console.log('[ProjectsStore] setPendingInvitations for project', projectId, 'with', invitations.length, 'invitations');
        pendingInvitations.value[projectId] = invitations;
        
        if (import.meta.client) {
            try {
                localStorage.setItem('pendingInvitations', JSON.stringify(pendingInvitations.value));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[ProjectsStore] localStorage quota exceeded for pending invitations');
                } else {
                    console.error('[ProjectsStore] Error saving pending invitations:', error);
                }
            }
        }
    }
    
    async function retrievePendingInvitations(projectId: number) {
        console.log('[ProjectsStore] retrievePendingInvitations for project', projectId);
        const token = getAuthToken();
        if (!token) {
            console.log('[ProjectsStore] No token, cannot fetch invitations');
            return;
        }
        
        const url = `${baseUrl()}/project-invitations/project/${projectId}`;
        console.log('[ProjectsStore] Fetching pending invitations from API...');
        
        try {
            const data = await $fetch<{success: boolean, invitations: any[]}>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                }
            });
            
            if (data.success) {
                console.log('[ProjectsStore] API returned', data.invitations?.length || 0, 'invitations');
                setPendingInvitations(projectId, data.invitations || []);
            } else {
                setPendingInvitations(projectId, []);
            }
        } catch (error) {
            console.error('[ProjectsStore] Failed to fetch pending invitations:', error);
            throw error;
        }
    }
    
    function getPendingInvitations(projectId: number): IPendingInvitation[] {
        return pendingInvitations.value[projectId] || [];
    }
    
    function clearProjects() {
        projects.value = []
        pendingInvitations.value = {}
        if (import.meta.client) {
            localStorage.removeItem('projects');
            localStorage.removeItem('pendingInvitations');
            enableRefreshDataFlag('clearProjects');
        }
    }
    function clearSelectedProject() {
        selectedProject.value = undefined
        myProjectRole.value = null
        if (import.meta.client) {
            localStorage.removeItem('selectedProject');
            localStorage.removeItem('myProjectRole');
        }
    }
    
    // Initialize projects from localStorage on client (run only once).
    // If any cached project is missing my_role (pre-RBAC cache), discard the
    // cache entirely so the store starts empty and retrieveProjects() fetches
    // fresh data with correct my_role values — avoiding stale RBAC rendering.
    if (import.meta.client && !initialized && localStorage.getItem('projects')) {
        const cached: IProject[] = JSON.parse(localStorage.getItem('projects') || '[]');
        const stale = cached.some(p => !p.my_role);
        if (stale) {
            localStorage.removeItem('projects');
            localStorage.removeItem('projects_loadTime');
        } else {
            projects.value = cached;
        }
        
        // Restore pending invitations if available
        if (localStorage.getItem('pendingInvitations')) {
            pendingInvitations.value = JSON.parse(localStorage.getItem('pendingInvitations') || '{}');
        }
        
        initialized = true;
    }
    
    return {
        projects,
        selectedProject,
        myProjectRole,
        pendingInvitations,
        setProjects,
        setSelectedProject,
        setPendingInvitations,
        getProjects,
        retrieveProjects,
        retrievePendingInvitations,
        getPendingInvitations,
        clearProjects,
        getSelectedProject,
        clearSelectedProject
    }
});
