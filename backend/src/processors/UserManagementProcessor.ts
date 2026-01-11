import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAPrivateBetaUsers } from "../models/DRAPrivateBetaUsers.js";
import { EUserType } from "../types/EUserType.js";
import bcrypt from 'bcryptjs';
import { UtilityService } from "../services/UtilityService.js";
import { DRAVerificationCode } from "../models/DRAVerificationCode.js";
import { EmailService } from "../services/EmailService.js";
import { IUserManagement } from "../types/IUserManagement.js";
import { IUserUpdate } from "../types/IUserUpdate.js";
import { IUserCreation } from "../types/IUserCreation.js";
import { IBetaUserForConversion } from "../types/IBetaUserForConversion.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { DRACategory } from "../models/DRACategory.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";

export class UserManagementProcessor {
    private static instance: UserManagementProcessor;
    private constructor() {}

    public static getInstance(): UserManagementProcessor {
        if (!UserManagementProcessor.instance) {
            UserManagementProcessor.instance = new UserManagementProcessor();
        }
        return UserManagementProcessor.instance;
    }

    async getUsers(tokenDetails: ITokenDetails): Promise<IUserManagement[]> {
        return new Promise<IUserManagement[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve([]);
            }

            const users = await manager.find(DRAUsersPlatform, {
                select: ['id', 'email', 'first_name', 'last_name', 'user_type', 'email_verified_at', 'unsubscribe_from_emails_at'],
                order: { id: 'ASC' }
            });
            
            const usersList: IUserManagement[] = users.map(user => ({
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                user_type: user.user_type,
                email_verified_at: user.email_verified_at,
                unsubscribe_from_emails_at: user.unsubscribe_from_emails_at
            }));

            return resolve(usersList);
        });
    }

    async getUserById(userId: number, tokenDetails: ITokenDetails): Promise<IUserManagement | null> {
        return new Promise<IUserManagement | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(null);
            }

            const user = await manager.findOne(DRAUsersPlatform, {
                where: { id: userId },
                select: ['id', 'email', 'first_name', 'last_name', 'user_type', 'email_verified_at', 'unsubscribe_from_emails_at'],
                relations: ['projects', 'data_sources', 'dashboards', 'articles']
            });

            if (!user) {
                return resolve(null);
            }

            const userInfo: IUserManagement = {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                user_type: user.user_type,
                email_verified_at: user.email_verified_at,
                unsubscribe_from_emails_at: user.unsubscribe_from_emails_at
            };

            return resolve(userInfo);
        });
    }

    async updateUser(userId: number, userData: IUserUpdate, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(false);
            }

            // Prevent admin from demoting themselves
            if (userId === user_id && userData.user_type === EUserType.NORMAL) {
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, {where: {id: userId}});
            if (!user) {
                return resolve(false);
            }

            try {
                if (userData.first_name) user.first_name = userData.first_name;
                if (userData.last_name) user.last_name = userData.last_name;
                if (userData.email) user.email = userData.email;
                if (userData.user_type) user.user_type = userData.user_type;

                await manager.save(user);
                return resolve(true);
            } catch (error) {
                console.error('Error updating user:', error);
                return resolve(false);
            }
        });
    }

    async changeUserType(userId: number, userType: EUserType, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(false);
            }

            // Prevent admin from demoting themselves
            if (userId === user_id && userType === EUserType.NORMAL) {
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, {where: {id: userId}});
            if (!user) {
                return resolve(false);
            }

            try {
                user.user_type = userType;
                await manager.save(user);
                return resolve(true);
            } catch (error) {
                console.error('Error changing user type:', error);
                return resolve(false);
            }
        });
    }

    async toggleEmailVerificationStatus(userId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, {where: {id: userId}});
            if (!user) {
                return resolve(false);
            }

            try {
                user.email_verified_at = user.email_verified_at ? null : new Date();
                await manager.save(user);
                return resolve(true);
            } catch (error) {
                console.error('Error toggling email verification:', error);
                return resolve(false);
            }
        });
    }

    async createUser(userData: IUserCreation, tokenDetails: ITokenDetails): Promise<IUserManagement | null> {
        return new Promise<IUserManagement | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(null);
            }

            try {
                // Check if email already exists
                const existingUser = await manager.findOne(DRAUsersPlatform, {where: {email: userData.email}});
                if (existingUser) {
                    return resolve(null);
                }

                // Hash password
                const salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
                const hashedPassword = await bcrypt.hash(userData.password, salt);

                // Create new user
                const newUser = new DRAUsersPlatform();
                newUser.first_name = userData.first_name;
                newUser.last_name = userData.last_name;
                newUser.email = userData.email;
                newUser.password = hashedPassword;
                newUser.user_type = userData.user_type || EUserType.NORMAL;
                newUser.email_verified_at = new Date(); // Auto-verify admin created users

                await manager.save(newUser);
                if (userData.is_conversion) {
                    const unsubscribeCode = encodeURIComponent(await bcrypt.hash(`${newUser.email}${userData.password}`, salt));
                    const expiredAt = new Date();
                    expiredAt.setDate(expiredAt.getDate() + 3);//expires in 3 days from now
                    let verificationCode = new DRAVerificationCode();
                    verificationCode.users_platform = newUser;
                    verificationCode.code = unsubscribeCode;
                    verificationCode.expired_at = expiredAt;
                    await manager.save(verificationCode);
                    await EmailService.getInstance().sendWelcomeBetaUserEmail(
                        newUser.email,
                        `${newUser.first_name} ${newUser.last_name}`,
                        userData.password,
                        unsubscribeCode
                    );
    
                }
                // Return user info without password
                const createdUser: IUserManagement = {
                    id: newUser.id,
                    email: newUser.email,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    user_type: newUser.user_type,
                    email_verified_at: newUser.email_verified_at,
                    unsubscribe_from_emails_at: newUser.unsubscribe_from_emails_at
                };
                return resolve(createdUser);
            } catch (error) {
                console.error('Error creating user:', error);
                return resolve(null);
            }
        });
    }

    async deleteUser(userId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser || adminUser.user_type !== EUserType.ADMIN) {
                return resolve(false);
            }

            // Prevent admin from deleting themselves
            if (userId === user_id) {
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, {where: {id: userId}});
            if (!user) {
                return resolve(false);
            }

            try {
                //delete all of the data that is associated with the user
                const articles = await manager.find(DRAArticle, {where: {users_platform: user}});
                const categories = await manager.find(DRACategory, {where: {users_platform: user}});
                const articleCategories = await manager.find(DRAArticleCategory, {where: {article: articles}});
                const projects = await manager.find(DRAProject, {where: {users_platform: user}});
                const dataSources = await manager.find(DRADataSource, {where: {users_platform: user}});
                const dataModels = await manager.find(DRADataModel, {where: {users_platform: user}});
                const exportedDashboards = await manager.find(DRADashboardExportMetaData, {where: {users_platform: user}});
                const dashboards = await manager.find(DRADashboard, {where: {users_platform: user}});
                const verificationCodes = await manager.find(DRAVerificationCode, {where: {users_platform: user}});
                await manager.remove(articleCategories);
                await manager.remove(articles);
                await manager.remove(categories);
                await manager.remove(exportedDashboards);
                await manager.remove(dashboards);
                await manager.remove(dataModels);
                await manager.remove(dataSources);
                await manager.remove(projects);
                await manager.remove(verificationCodes);
                await manager.remove(user);
                return resolve(true);
            } catch (error) {
                console.error('Error deleting user:', error);
                return resolve(false);
            }
        });
    }

    async getPrivateBetaUserForConversion(tokenDetails: ITokenDetails, betaUserId: number): Promise<IBetaUserForConversion | null> {
        return new Promise<IBetaUserForConversion | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }

            // Verify admin user exists
            const adminUser = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!adminUser) {
                return resolve(null);
            }

            try {
                // Get the private beta user
                const betaUser = await manager.findOne(DRAPrivateBetaUsers, {where: {id: betaUserId}});
                if (!betaUser) {
                    return resolve(null);
                }

                // Check if this beta user email already exists in the main users table
                const existingUser = await manager.findOne(DRAUsersPlatform, {where: {email: betaUser.business_email}});
                if (existingUser) {
                    // Return null if user already exists to prevent duplicate conversion
                    return resolve(null);
                }

                // Return beta user data formatted for conversion
                const conversionData: IBetaUserForConversion = {
                    id: betaUser.id,
                    first_name: betaUser.first_name,
                    last_name: betaUser.last_name,
                    email: betaUser.business_email,
                    company_name: betaUser.company_name,
                    phone_number: betaUser.phone_number,
                    country: betaUser.country
                };

                return resolve(conversionData);
            } catch (error) {
                console.error('Error getting beta user for conversion:', error);
                return resolve(null);
            }
        });
    }
}