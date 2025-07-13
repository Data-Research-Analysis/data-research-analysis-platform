import { UtilityService } from "../services/UtilityService.js";
import jwt, { JwtPayload } from "jsonwebtoken";

export class UserProcessor {
    private static instance: UserProcessor;
    private constructor() {}

    public static getInstance(): UserProcessor {
        if (!UserProcessor.instance) {
            UserProcessor.instance = new UserProcessor();
        }
        return UserProcessor.instance;
    }


}