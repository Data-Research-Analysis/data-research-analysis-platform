import {defineStore} from 'pinia'
import type { IProject } from '~/types/IProject';
export const useProjectsStore = defineStore('projectsDRA', () => {
    const projects = ref<IProject[]>([])
    const selectedProject = ref<IProject>()
    
    function setProjects(projectsList: IProject[]) {
        projects.value = projectsList
        if (import.meta.client) {
            localStorage.setItem('projects', JSON.stringify(projectsList));
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
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
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
