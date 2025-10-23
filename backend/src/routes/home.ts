import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService.js';
import { TokenProcessor } from '../processors/TokenProcessor.js';
import { validateJWT } from '../middleware/authenticate.js';
import { DRAPrivateBetaUsers } from '../models/DRAPrivateBetaUsers.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
const router = express.Router();

router.get('/generate-token', async (req: Request, res: Response, next: any) => {
    const token = await TokenProcessor.getInstance().generateToken();
    res.status(200).send({token});
});

router.post('/private-beta-apply', async (req: Request, res: Response, next: any) => {
  next();
}, validateJWT, async (req: Request, res: Response) => {
    const { first_name, last_name, phone_number, business_email, company_name, agree_to_receive_updates, country } = req.body;
    let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
    const manager = (await driver.getConcreteDriver()).manager;
    const existingUser = await manager.findOne(DRAPrivateBetaUsers, {where: {business_email}});
    if (!existingUser) {
      const user = new DRAPrivateBetaUsers();
      user.first_name = first_name;
      user.last_name = last_name;
      user.phone_number = phone_number;
      user.business_email = business_email;
      user.company_name = company_name;
      user.agree_to_receive_updates = agree_to_receive_updates;
      user.country = country;
      await manager.save(user);
      res.status(200).send({message: 'Subscribed successfully', email: business_email});
    } else {
      res.status(400).send({message: 'The email provided is already subscribed. Please provide a new valid email.', email: business_email});
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