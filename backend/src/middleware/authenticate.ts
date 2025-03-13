import jwt from "jsonwebtoken";
import { UtilityService } from "../services/UtilityService";
import { TokenProcessor } from "../processors/TokenProcessor";

export async function validateJWT (req: any, res: any, next: any) {    
    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
    if (req.headers.authorization) {
        const jwtToken = req.headers.authorization.replace('Bearer ', '');
        let result: boolean = await TokenProcessor.getInstance().validateToken(jwtToken);
        if (result) {
            next();
        } else {
            res.status(400).send({message: 'valid authorization token not provided'});
        }
    } else {
        res.status(400).send({message: 'valid authorization token not provided'});
    }
}