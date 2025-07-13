import bcrypt  from 'bcryptjs';
import jwt, { JwtPayload } from "jsonwebtoken";
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { UtilityService } from '../services/UtilityService.js';
import { IUsersPlatform } from '../types/IUsersPlatform.js';
import { MailDriver } from '../drivers/MailDriver.js';
import { TemplateEngineService } from '../services/TemplateEngineService.js';
import { ITemplateRenderer } from '../interfaces/ITemplateRenderer.js';
import { DRAVerificationCode } from '../models/DRAVerificationCode.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { EUserType } from '../types/EUserType.js';

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

    public async login(email: string, password: string): Promise<IUsersPlatform> {
        return new Promise<IUsersPlatform>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                return reject(null);
            }
            const manager = concreteDriver.manager;
            const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {email: email}});
            if (user) {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
                    const token = jwt.sign({user_id: user.id}, secret);
                    const userPlatform:IUsersPlatform = {id: user.id, email: email, first_name: user.first_name, last_name: user.last_name, user_type: user.user_type, token: token};
                    return resolve(userPlatform);
                } else {
                    return reject(null);
                }
            } else {
                return reject(null);
            }
        });
    }

    public async register(firstName: string, lastName: string, email: string, password: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                return resolve(false);
            }
            const manager = concreteDriver.manager;
            const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {email: email}});
            const salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            if (!user) {
                console.log("User does not exist for the given email, so creating a new user");
                const encryptedPassword = await bcrypt.hash(password, salt);
                const emailVerificationCode = encodeURIComponent(await bcrypt.hash(`${email}${password}`, salt));
                const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${email}${password}`, salt));

                const newUser = new DRAUsersPlatform();
                newUser.email = email;
                newUser.first_name = firstName;
                newUser.last_name = lastName;
                newUser.password = encryptedPassword;
                newUser.user_type = EUserType.NORMAL;
                await manager.save(newUser);
                
                const expiredAt = new Date();
                expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                //We need separate codes for email verification and unsubscription because we need to track the expiration of each code separately
                let verificationCode = new DRAVerificationCode();
                verificationCode.users_platform = newUser;
                verificationCode.code = emailVerificationCode;
                verificationCode.expired_at = expiredAt;
                await manager.save(verificationCode);

                verificationCode = new DRAVerificationCode();
                verificationCode.users_platform = newUser;
                verificationCode.code = unsubscribeCode;
                verificationCode.expired_at = expiredAt;
                await manager.save(verificationCode);
                
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
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const verificationCode = await manager.findOne(DRAVerificationCode, {where: {code: encodeURIComponent(code)}, relations: {users_platform: true}});
            if (verificationCode && verificationCode.expired_at > new Date()) {
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {id: verificationCode.users_platform.id}});
                if (user) {
                    if (user.email_verified_at) {
                        return resolve(true);
                    } else {
                        user.email_verified_at = new Date();
                        await manager.save(user);
                        return resolve(true);
                    }
                }
            }
            return resolve(false);
        });
    }

    public async unsubscribe(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const verificationCode = await manager.findOne(DRAVerificationCode, {where: {code: encodeURIComponent(code)}, relations: {users_platform: true}});
            if (verificationCode) {
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {id: verificationCode.users_platform.id}});
                if (user) {
                    if (user.unsubscribe_from_emails_at) {
                        return resolve(true);
                    } else {
                        user.unsubscribe_from_emails_at = new Date();
                        await manager.save(user);
                        return resolve(true);
                    }
                }
            }
            return resolve(false);
        });
    }

    public async resendCode(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const verificationCode = await manager.findOne(DRAVerificationCode, {where: {code: encodeURIComponent(code)}, relations: {users_platform: true}});
            if (verificationCode) {
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {id: verificationCode.users_platform.id}});
                if (user) {
                    const emailVerificationCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}`, 10));
                    const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}`, 10));
                    const expiredAt = new Date();
                    expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                    let verificationCode = new DRAVerificationCode();
                    verificationCode.users_platform = user;
                    verificationCode.code = emailVerificationCode;
                    verificationCode.expired_at = expiredAt;
                    await manager.save(verificationCode);
    
                    verificationCode = new DRAVerificationCode();
                    verificationCode.users_platform = user;
                    verificationCode.code = unsubscribeCode;
                    verificationCode.expired_at = expiredAt;
                    await manager.save(verificationCode);
                    
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