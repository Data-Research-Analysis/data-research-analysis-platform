import jwt from "jsonwebtoken";
import { UtilityService } from "../services/UtilityService";
import { TokenProcessor } from "../processors/TokenProcessor";

export async function validateJWT (req: any, res: any, next: any) {    
    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
    if (req.headers.authorization) {
        const jwtToken = req.headers.authorization.replace('Bearer ', '');
        const typeAuthorization = req.headers.authorization_type;
        let result: boolean = await TokenProcessor.getInstance().validateToken(jwtToken);
        if (result) {
            let tokenDetails = await TokenProcessor.getInstance().getTokenDetails(jwtToken);
            if (typeAuthorization === 'auth' && tokenDetails && tokenDetails.user_id) {
                req.body.tokenDetails = tokenDetails;
                next();
            } else if (typeAuthorization === 'non-auth') {
                console.log('non-auth token found');
                next();
            } else {
                console.log('neither auth nor non-auth token found');
                res.status(400).send({message: 'valid authorization token not provided'});    
            }
        } else {
            console.log('token not valid');
            res.status(400).send({message: 'valid authorization token not provided'});
        }
    } else {
        console.log('authorization header not found');
        res.status(400).send({message: 'valid authorization token not provided'});
    }
}