import {defineStore} from 'pinia'
import type { IProject } from '~/types/IProject';

let initialized = false;

export const useProjectsStore = defineStore('projectsDRA', () => {
    const projects = ref<IProject[]>([])
    const selectedProject = ref<IProject>()
    
    function setProjects(projectsList: IProject[]) {
        // Validate and normalize project data to ensure RBAC consistency
        projects.value = projectsList.map(p => ({
            ...p,
            is_owner: p.is_owner === true, // Ensure boolean
            user_role: p.user_role || 'viewer', // Default to least privilege
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
        if (import.meta.client) {
            localStorage.setItem('selectedProject', JSON.stringify(project));
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
            selectedProject.value = JSON.parse(localStorage.getItem('selectedProject') || 'null')
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
        if (import.meta.client) {
            localStorage.removeItem('selectedProject');
        }
    }
    
    // Initialize projects from localStorage on client (run only once)
    if (import.meta.client && !initialized && localStorage.getItem('projects')) {
        projects.value = JSON.parse(localStorage.getItem('projects') || '[]');
        initialized = true;
    }
    
    return {
        projects,
        selectedProject,
        setProjects,
        setSelectedProject,
        getProjects,
        retrieveProjects,
        clearProjects,
        getSelectedProject,
        clearSelectedProject
    }
});
