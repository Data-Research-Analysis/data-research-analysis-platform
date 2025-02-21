import { Utility } from "../utility/Utility";
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
        return new Promise((resolve, reject) => {
            const secret = Utility.getInstance().getConstants('JWT_SECRET');
            let token = jwt.sign({}, secret);//empty data because we don't need any data in token
            resolve(token);
        });
    }

    public async validateToken(token: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const secret = Utility.getInstance().getConstants('JWT_SECRET');
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

}