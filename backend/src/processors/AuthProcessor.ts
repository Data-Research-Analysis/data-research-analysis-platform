import bcrypt  from 'bcryptjs';
import jwt, { JwtPayload } from "jsonwebtoken";
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { UtilityService } from '../services/UtilityService.js';
import { IUsersPlatform } from '../types/IUsersPlatform.js';
import { EmailService } from '../services/EmailService.js';
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

    public async getUserById(userId: number): Promise<IUsersPlatform | null> {
        return new Promise<IUsersPlatform | null>(async (resolve, reject) => {
            try {
                let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    return resolve(null);
                }
                const manager = concreteDriver.manager;
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {id: userId}});
                if (user) {
                    const userPlatform:IUsersPlatform = {
                        id: user.id, 
                        email: user.email, 
                        first_name: user.first_name, 
                        last_name: user.last_name, 
                        user_type: user.user_type,
                        token: '' // Token not needed for /auth/me endpoint
                    };
                    return resolve(userPlatform);
                } else {
                    return resolve(null);
                }
            } catch (error) {
                console.error('Error fetching user by ID:', error);
                return resolve(null);
            }
        });
    }

    public async login(email: string, password: string): Promise<IUsersPlatform> {
        return new Promise<IUsersPlatform>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                return resolve(null);
            }
            const manager = concreteDriver.manager;
            const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {email: email}});
            if (user) {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
                    const token = jwt.sign({user_id: user.id, user_type: user.user_type, email: user.email}, secret);
                    const userPlatform:IUsersPlatform = {id: user.id, email: email, first_name: user.first_name, last_name: user.last_name, user_type: user.user_type, token: token};
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
                
                await EmailService.getInstance().sendEmailVerificationWithUnsubscribe(
                    email,
                    `${firstName} ${lastName}`,
                    emailVerificationCode,
                    unsubscribeCode
                );
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
                    
                    await EmailService.getInstance().sendEmailVerificationWithUnsubscribe(
                        user.email,
                        `${user.first_name} ${user.last_name}`,
                        emailVerificationCode,
                        unsubscribeCode
                    );
                    return resolve(true);
                }
                return resolve(false);
            }
            return resolve(false);
        });
    }

    public async changePasswordRequest(email: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                // Even on database connection failure, return true to prevent information leakage
                // Add consistent delay to prevent timing attacks
                await new Promise(resolve => setTimeout(resolve, 2000));
                return resolve(true);
            }
            const manager = concreteDriver.manager;
            const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {where: {email: email}});
            
            // Add consistent delay regardless of whether user exists to prevent timing attacks
            const startTime = Date.now();
            
            if (user) {
                // Check if there's already a recent password change request (within last 5 minutes)
                const fiveMinutesAgo = new Date();
                fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
                
                const existingRequest = await manager.findOne(DRAVerificationCode, {
                    where: {
                        users_platform: { id: user.id },
                        expired_at: new Date() // Greater than current date (not expired)
                    },
                    relations: { users_platform: true }
                });
                
                // If there's no recent request, proceed with sending email
                if (!existingRequest || existingRequest.expired_at <= fiveMinutesAgo) {
                    // Remove any existing password change tokens for this user
                    const existingTokens = await manager.find(DRAVerificationCode, {
                        where: { users_platform: { id: user.id } },
                        relations: { users_platform: true }
                    });
                    
                    for (const token of existingTokens) {
                        await manager.remove(token);
                    }

                    const passwordChangeRequestCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}${Date.now()}`, 10));
                    const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${user.email}${user.password}${Date.now()}`, 10));                    
                    const expiredAt = new Date();
                    expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                    //We need separate codes for email verification and unsubscription because we need to track the expiration of each code separately
                    let verificationCode = new DRAVerificationCode();
                    verificationCode.users_platform = user;
                    verificationCode.code = passwordChangeRequestCode;
                    verificationCode.expired_at = expiredAt;
                    await manager.save(verificationCode);

                    verificationCode = new DRAVerificationCode();
                    verificationCode.users_platform = user;
                    verificationCode.code = unsubscribeCode;
                    verificationCode.expired_at = expiredAt;
                    await manager.save(verificationCode);

                    await EmailService.getInstance().sendPasswordChangeRequestWithUnsubscribe(
                        user.email,
                        `${user.first_name} ${user.last_name}`,
                        passwordChangeRequestCode,
                        unsubscribeCode
                    );
                }
                // Note: Even if rate limited, we don't reveal this to the user
            }
            // If user doesn't exist, we don't send an email but still return success
            
            // Ensure consistent response time (minimum 2 seconds) to prevent timing attacks
            const elapsedTime = Date.now() - startTime;
            const minimumDelay = 2000; // 2 seconds
            if (elapsedTime < minimumDelay) {
                await new Promise(resolve => setTimeout(resolve, minimumDelay - elapsedTime));
            }
            
            // Always return true to prevent email enumeration
            return resolve(true);
        });
    }

    public async verifyChangePasswordToken(code: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            
            // Add a small delay to prevent rapid brute force attempts
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('verifying change password token', code);
            const verificationCode = await manager.findOne(DRAVerificationCode, {
                where: {code: encodeURIComponent(code)}, 
                relations: {users_platform: true}
            });
            
            if (verificationCode && verificationCode.expired_at > new Date()) {
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {
                    where: {id: verificationCode.users_platform.id}
                });
                if (user) {
                    // Token is valid and not expired
                    return resolve(true);
                }
            }
            return resolve(false);
        });
    }

    public async updatePassword(code: string, newPassword: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            
            // Add a small delay to prevent rapid brute force attempts
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const verificationCode = await manager.findOne(DRAVerificationCode, {
                where: {code: encodeURIComponent(code)}, 
                relations: {users_platform: true}
            });
            
            if (verificationCode && verificationCode.expired_at > new Date()) {
                const user: DRAUsersPlatform|null = await manager.findOne(DRAUsersPlatform, {
                    where: {id: verificationCode.users_platform.id}
                });
                
                if (user) {
                    // Check if new password is different from current password
                    const isSamePassword = await bcrypt.compare(newPassword, user.password);
                    if (isSamePassword) {
                        return resolve(false); // Don't allow setting the same password
                    }
                    
                    const salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
                    const encryptedPassword = await bcrypt.hash(newPassword, salt);
                    
                    // Update user password
                    user.password = encryptedPassword;
                    await manager.save(user);
                    
                    // Remove ALL verification codes for this user for security
                    const userTokens = await manager.find(DRAVerificationCode, {
                        where: { users_platform: { id: user.id } },
                        relations: { users_platform: true }
                    });
                    
                    for (const token of userTokens) {
                        await manager.remove(token);
                    }
                    
                    return resolve(true);
                }
            }
            return resolve(false);
        });
    }
}