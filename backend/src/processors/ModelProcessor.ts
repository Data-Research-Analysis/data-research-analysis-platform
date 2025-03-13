import { UtilityService } from "../services/UtilityService";
import jwt, { JwtPayload } from "jsonwebtoken";

export class ModelProcessor {
    private static instance: ModelProcessor;
    private constructor() {}

    public static getInstance(): ModelProcessor {
        if (!ModelProcessor.instance) {
            ModelProcessor.instance = new ModelProcessor();
        }
        return ModelProcessor.instance;
    }



}