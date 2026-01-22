import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { PrivateBetaUserProcessor } from '../../processors/PrivateBetaUserProcessor.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const users = await PrivateBetaUserProcessor.getInstance().getUsers(req.body.tokenDetails);
    if (users) {
        res.status(200).send(users);
    } else {
        res.status(400).send(users);
    }
});

export default router;