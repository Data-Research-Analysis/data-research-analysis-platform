import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService';
import { TokenProcessor } from '../processors/TokenProcessor';
import { validateJWT } from '../middleware/authenticate';
import { User } from '../models/User';
const router = express.Router();

router.get('/generate-token', async (req: Request, res: Response, next: any) => {
    const token = await TokenProcessor.getInstance().generateToken();
    res.status(200).send({token});
});

router.post('/subscribe', async (req: Request, res: Response, next: any) => {
  next();
}, validateJWT, async (req: Request, res: Response) => {
    const { email } = req.body;
    console.log("subscribe post request");
    const existingUser = await User.findOne({where: {email}});
    if (!existingUser) {
      const user = User.build({email, createdAt: new Date()});
      await user.save();
      res.status(200).send({message: 'Subscribed successfully', email});
    } else {
      res.status(400).send({message: 'The email provided is already subscribed. Please provide a new valid email.', email});
    }
});

router.post('/verify-recaptcha', async (req: Request, res: Response, next: any) => {
  next();
}, validateJWT, async (req: Request, res: Response) => {
    const { recaptcha_token } = req.body;
    const recaptchaSecret = UtilityService.getInstance().getConstants('RECAPTCHA_SECRET');
    console.log('Verifying recaptcha token', recaptcha_token);
    console.log('Recaptcha secret', recaptchaSecret);
    let response = {success: false};
    try {
      const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
      };
      const url = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptcha_token}`;
      const responseData = await fetch(
        url,
        requestOptions,
      );
      response = await responseData.json();
      res.status(200).send(response);
      
    } catch (error) {
      console.error("Error while verifying recaptcha", error);
      res.status(400).send({message: 'Error while verifying recaptcha', error});
    }
});

export default router;