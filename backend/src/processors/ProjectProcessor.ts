import { UtilityService } from "../services/UtilityService";
import jwt, { JwtPayload } from "jsonwebtoken";

export class ProjectProcessor {
    private static instance: ProjectProcessor;
    private constructor() {}

    public static getInstance(): ProjectProcessor {
        if (!ProjectProcessor.instance) {
            ProjectProcessor.instance = new ProjectProcessor();
        }
        return ProjectProcessor.instance;
    }


}