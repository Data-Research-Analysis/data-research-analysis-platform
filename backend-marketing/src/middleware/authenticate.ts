import jwt from "jsonwebtoken";
import { Utility } from "../utility/Utility";
import { TokenProcessor } from "../processor/TokenProcessor";

export async function validateJWT (req: any, res: any, next: any) {    
    const secret = Utility.getInstance().getConstants('JWT_SECRET');
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