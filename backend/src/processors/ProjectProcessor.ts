import { ITokenDetails } from "../types/ITokenDetails";
import { Projects } from "../models/Projects";
export class ProjectProcessor {
    private static instance: ProjectProcessor;
    private constructor() {}

    public static getInstance(): ProjectProcessor {
        if (!ProjectProcessor.instance) {
            ProjectProcessor.instance = new ProjectProcessor();
        }
        return ProjectProcessor.instance;
    }

    async addProject(project_name: string, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            await Projects.create({user_platform_id: user_id , name: project_name});
            return resolve(true);
        });
    }

    async getProjects(tokenDetails: ITokenDetails): Promise<Projects[]> {
        return new Promise<Projects[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const projects = await Projects.findAll({where: {user_platform_id: user_id}});
            return resolve(projects);
        });
    }

    async deleteProject(projectId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            await Projects.destroy({where: {id: projectId, user_platform_id: user_id}});
            return resolve(true);
        });
    }
}