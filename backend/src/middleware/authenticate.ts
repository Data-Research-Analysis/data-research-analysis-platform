import { UtilityService } from "../services/UtilityService.js";
import { TokenProcessor } from "../processors/TokenProcessor.js";

export async function validateJWT (req: any, res: any, next: any) {    
    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
    if (req.headers.authorization) {
        const jwtToken = req.headers.authorization.replace('Bearer ', '');
        const typeAuthorization = req.headers['authorization-type'];
        let result: boolean = await TokenProcessor.getInstance().validateToken(jwtToken);
        if (result) {
            let tokenDetails = await TokenProcessor.getInstance().getTokenDetails(jwtToken);
            if (typeAuthorization === 'auth' && tokenDetails && tokenDetails.user_id) {
                req.body.tokenDetails = tokenDetails;
                next();
            } else if (typeAuthorization === 'non-auth') {
                next();
            } else {
                res.status(400).send({message: 'valid authorization token not provided'});    
            }
        } else {
            res.status(400).send({message: 'valid authorization token not provided'});
        }
    } else {
        res.status(400).send({message: 'valid authorization token not provided'});
    }
}