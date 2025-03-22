import bcrypt  from 'bcryptjs';
import jwt, { JwtPayload } from "jsonwebtoken";
import { UsersPlatform } from '../models/UsersPlatform';
import { UtilityService } from '../services/UtilityService';
import { IUsersPlatform } from '../types/IUsersPlatform';
import { MailDriver } from '../drivers/MailDriver';
import { TemplateEngineService } from '../services/TemplateEngineService';
import { ITemplateRenderer } from '../interfaces/ITemplateRenderer';
import { VerificationCodes } from '../models/VerificationCodes';

export class AuthProcessor {
    private static instance: AuthProcessor;
    private constructor() {
    }

    public static getInstance(): AuthProcessor {
        if (!AuthProcessor.instance) {
            AuthProcessor.instance = new AuthProcessor();
        }
        return AuthProcessor.instance;
    }

    // public async validateJWT(token: string): Promise<Authentication|null> {
    //     return new Promise<Authentication|null>(async (resolve, reject) => {
    //         const secret = Utility.getInstance().getConstants('JWT_SECRET');
    //         let result: Authentication = {user_id: new mongoose.Types.ObjectId("000000000000")};
    //         try {
    //             const decoded = jwt.verify(token, secret) as JwtPayload;
    //             if (decoded) {
    //                 const userId = decoded.user_id;
    //                 const email = decoded.email;
    //                 const user = await User.findOne({ _id: userId, email: email }).exec();
    //                 if (user) {
    //                     result.user_id = user._id;
    //                     return resolve(result);  
    //                 } else {
    //                     return resolve(null);
    //                 }
    //             }
    //         } catch (error) {
    //             return resolve(null);
    //         }
    //     });
    // }

    public async login(email: string, password: string): Promise<IUsersPlatform> {
        return new Promise<IUsersPlatform>(async (resolve, reject) => {
            const user:UsersPlatform = await UsersPlatform.findOne({where: {email: email}});
            if (user) {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
                    const token = jwt.sign({user_id: user.id, email: email}, secret);
                    const userPlatform:IUsersPlatform = {id: user.id, email: email, first_name: user.first_name, last_name: user.last_name, token: token};
                    return resolve(userPlatform);
                } else {
                    return resolve(null);
                }
            } else {
                return resolve(null);
            }
        });
    }

    public async register(firstName: string, lastName: string, email: string, password: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const user:UsersPlatform = await UsersPlatform.findOne({where: {email: email}});
            if (!user) {
                console.log("User does not exist for the given email, so creating a new user");
                const encryptedPassword = await bcrypt.hash(password, 10);
                const emailVerificationCode = encodeURIComponent(await bcrypt.hash(`${email}${password}`, 10));
                const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${email}${password}`, 10));
                const newUser:UsersPlatform = await UsersPlatform.create({
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    password: encryptedPassword,
                });
                const expiredAt = new Date();
                expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                //We need separate codes for email verification and unsubscription because we need to track the expiration of each code separately
                await VerificationCodes.create({user_platform_id: newUser.id, code: emailVerificationCode, expired_at: expiredAt});
                await VerificationCodes.create({user_platform_id: newUser.id, code: unsubscribeCode, expired_at: expiredAt});
                const options: Array<ITemplateRenderer> = [
                    {key: 'name', value: `${firstName} ${lastName}`},
                    {key: 'email_verification_code', value: emailVerificationCode},
                    {key: 'unsubscribe_code', value: unsubscribeCode}
                ];
                const content = await TemplateEngineService.getInstance().render('verify-email.html', options);
                await MailDriver.getInstance().getDriver().initialize();
                await MailDriver.getInstance().getDriver().sendEmail(email, `${firstName} ${lastName}`, 'Welcome to Data Research Analysis', 'Hello from Data Research Analysis', content);
                return resolve(true);                    
            } else {
                return resolve(false);
            }
        });
    }

    public async verifyEmail(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const verificationCode = await VerificationCodes.findOne({where: {code: encodeURIComponent(code)}});
            if (verificationCode && verificationCode.expired_at > new Date()) {
                const user: UsersPlatform = await UsersPlatform.findOne({where: {id: verificationCode.user_platform_id}});
                if (user) {
                    if (user.email_verified_at) {
                        return resolve(true);
                    } else {
                        await UsersPlatform.update({email_verified_at: new Date()}, {where: {id: verificationCode.user_platform_id}});
                        return resolve(true);
                    }
                }
            }
            return resolve(false);
        });
    }

    public async unsubscribe(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const verificationCode = await VerificationCodes.findOne({where: {code: encodeURIComponent(code)}});
            if (verificationCode) {
                const user: UsersPlatform = await UsersPlatform.findOne({where: {id: verificationCode.user_platform_id}});
                if (user) {
                    if (user.unsubscribe_from_emails_at) {
                        return resolve(true);
                    } else {
                        await UsersPlatform.update({unsubscribe_from_emails_at: new Date()}, {where: {id: verificationCode.user_platform_id}});
                        return resolve(true);
                    }
                }
            }
            return resolve(false);
        });
    }

    public async resendCode(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const verificationCode = await VerificationCodes.findOne({where: {code: encodeURIComponent(code)}});
            if (verificationCode) {
                const user: UsersPlatform = await UsersPlatform.findOne({where: {id: verificationCode.user_platform_id}});
                if (user) {
                    const emailVerificationCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}`, 10));
                    const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}`, 10));
                    const expiredAt = new Date();
                    expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                    await VerificationCodes.create({user_platform_id: user.id, code: emailVerificationCode, expired_at: expiredAt});
                    await VerificationCodes.create({user_platform_id: user.id, code: unsubscribeCode, expired_at: expiredAt});
                    const options: Array<ITemplateRenderer> = [
                        {key: 'name', value: `${user.first_name} ${user.last_name}`},
                        {key: 'email_verification_code', value: emailVerificationCode},
                        {key: 'unsubscribe_code', value: unsubscribeCode}
                    ];
                    const content = await TemplateEngineService.getInstance().render('verify-email.html', options);
                    await MailDriver.getInstance().getDriver().initialize();
                    await MailDriver.getInstance().getDriver().sendEmail(user.email, `${user.first_name} ${user.last_name}`, 'Welcome to Data Research Analysis', 'Hello from Data Research Analysis', content);
                    return resolve(true);
                }
                return resolve(false);
            }
            return resolve(false);
        });
    }
}