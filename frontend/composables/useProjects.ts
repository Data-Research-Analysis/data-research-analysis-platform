import type { IProject } from '~/types/IProject';
import { useProjectsStore } from '@/stores/projects';

/**
 * Composable for fetching projects list with client-side SSR
 * 
 * This composable fetches the user's projects from the API and syncs them
 * with the Pinia store for backward compatibility.
 * 
 * Uses `server: false` since project pages are protected and don't need SEO.
 * 
 * @returns Object with projects data, pending state, error, and refresh function
 * 
 * @example
 * const { data: projects, pending, error } = await useProjects()
 */
export const useProjects = () => {
  const projectsStore = useProjectsStore();

  const { data: projects, pending, error, refresh } = useAuthenticatedFetch<IProject[]>(
    'projects-list',
    '/project/list',
    {
      method: 'GET',
      transform: (data) => Array.isArray(data) ? data : [],
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && projects.value) {
      projectsStore.setProjects(projects.value);
    }
  });

  return { data: projects, pending, error, refresh };
};

/**
 * Composable for fetching a single project by ID with client-side SSR
 * 
 * @param projectId - The ID of the project to fetch
 * @returns Object with project data, pending state, error, and refresh function
 * 
 * @example
 * const { data: project, pending, error } = await useProject(projectId)
 */
export const useProject = (projectId: string | number) => {
  const projectsStore = useProjectsStore();

  const { data: project, pending, error, refresh } = useAuthenticatedFetch<IProject>(
    `project-${projectId}`,
    `/project/${projectId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && project.value) {
      projectsStore.setSelectedProject(project.value);
    }
  });

  return { data: project, pending, error, refresh };
};
