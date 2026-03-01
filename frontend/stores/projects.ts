import {defineStore} from 'pinia'
import type { IProject } from '~/types/IProject';

let initialized = false;

export const useProjectsStore = defineStore('projectsDRA', () => {
    const projects = ref<IProject[]>([])
    const selectedProject = ref<IProject>()
    const myProjectRole = ref<'analyst' | 'manager' | 'cmo' | null>(null)
    
    function setProjects(projectsList: IProject[]) {
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
        if (import.meta.client) {
            localStorage.setItem('projects', JSON.stringify(projects.value));
            enableRefreshDataFlag('setProjects');
        }
    }
    function setSelectedProject(project: IProject) {
        selectedProject.value = project
        myProjectRole.value = project.my_role ?? null
        if (import.meta.client) {
            localStorage.setItem('selectedProject', JSON.stringify(project));
            localStorage.setItem('myProjectRole', project.my_role ?? 'cmo');
        }
    }
    function getProjects() {
        if (import.meta.client && localStorage.getItem('projects')) {
            projects.value = JSON.parse(localStorage.getItem('projects') || '[]')
        }
        return projects.value;
    }
    async function retrieveProjects() {
        const token = getAuthToken();
        if (!token) {
            projects.value = [];
            return;
        }
        const url = `${baseUrl()}/project/list`;
        const data = await $fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setProjects(data)
    }
    function getSelectedProject() {
        if (import.meta.client && localStorage.getItem('selectedProject')) {
            const stored = JSON.parse(localStorage.getItem('selectedProject') || 'null')
            selectedProject.value = stored
            myProjectRole.value = (stored?.my_role ?? localStorage.getItem('myProjectRole') ?? null) as 'analyst' | 'manager' | 'cmo' | null
        }
        return selectedProject.value
    }
    function clearProjects() {
        projects.value = []
        if (import.meta.client) {
            localStorage.removeItem('projects');
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
            console.log('[projects store] discarding stale localStorage cache (my_role missing on', cached.filter(p => !p.my_role).length, 'projects)');
            localStorage.removeItem('projects');
            localStorage.removeItem('projects_loadTime');
        } else {
            projects.value = cached;
        }
        initialized = true;
    }
    
    return {
        projects,
        selectedProject,
        myProjectRole,
        setProjects,
        setSelectedProject,
        getProjects,
        retrieveProjects,
        clearProjects,
        getSelectedProject,
        clearSelectedProject
    }
});
