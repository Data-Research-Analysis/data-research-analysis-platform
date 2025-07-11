import { UtilityService } from "../services/UtilityService.js";
import jwt, { JwtPayload } from "jsonwebtoken";

export class TokenProcessor {
    private static instance: TokenProcessor;
    private constructor() {}

    public static getInstance(): TokenProcessor {
        if (!TokenProcessor.instance) {
            TokenProcessor.instance = new TokenProcessor();
        }
        return TokenProcessor.instance;
    }

    public async generateToken(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
            let token = jwt.sign({}, secret);//empty data because we don't need any data in token
            resolve(token);
        });
    }

    public async validateToken(token: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
            try {
                const decoded = jwt.verify(token, secret) as JwtPayload;
                if (decoded) {
                    return resolve(true);
                } else {
                    return resolve(false);
                }
            } catch (error) {
                return resolve(false);
            }
        });
    }

    public async getTokenDetails(token: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
            try {
                const decoded = jwt.verify(token, secret) as JwtPayload;
                if (decoded) {
                    return resolve(decoded);
                } else {
                    return resolve(null);
                }
            } catch (error) {
                return resolve(null);
            }
        });
    }
}