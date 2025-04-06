import {defineStore} from 'pinia'
import type { IProject } from '~/types/IProject';
export const useProjectsStore = defineStore('projectsDRA', () => {
    const projects = ref<IProject[]>([])
    const selectedProject = ref<IProject>()

    if (localStorage.getItem('projects')) {
        projects.value = JSON.parse(localStorage.getItem('projects') || '[]')
    }
    if (localStorage.getItem('selectedProject')) {
        selectedProject.value = JSON.parse(localStorage.getItem('selectedProject') || 'null')
    }
    function setProjects(projectsList: IProject[]) {
        projects.value = projectsList
        localStorage.setItem('projects', JSON.stringify(projectsList))
    }
    function setSelectedProject(project: IProject) {
        selectedProject.value = project
        localStorage.setItem('selectedProject', JSON.stringify(project))
    }
    function getProjects() {
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
                "Authorization_Type": "auth",
            },
        });
        const data = await response.json();
        setProjects(data)
    }
    function getSelectedProject() {
        return selectedProject.value
    }
    function clearProjects() {
        projects.value = []
        localStorage.removeItem('projects')
    }
    function clearSelectedProject() {
        selectedProject.value = undefined
        localStorage.removeItem('selectedProject')
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
