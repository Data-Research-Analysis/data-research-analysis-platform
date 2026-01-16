import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserManagementProcessor } from '../UserManagementProcessor.js';
import { DBDriver } from '../../../drivers/DBDriver.js';
import { EDataSourceType } from '../../../types/EDataSourceType.js';
import { EUserType } from '../../../types/EUserType.js';
import { ITokenDetails } from '../../../types/ITokenDetails.js';

// Mock DBDriver
jest.mock('../../drivers/DBDriver.js');
jest.mock('bcryptjs');
jest.mock('../../services/UtilityService.js');
jest.mock('../../drivers/MailDriver.js');

describe('UserManagementProcessor', () => {
    let processor: UserManagementProcessor;
    let mockManager: any;
    let adminTokenDetails: ITokenDetails;
    let normalTokenDetails: ITokenDetails;

    beforeEach(() => {
        processor = UserManagementProcessor.getInstance();
        
        adminTokenDetails = {
            user_id: 1,
            email: 'admin@test.com',
            user_type: EUserType.ADMIN,
            iat: Math.floor(Date.now() / 1000)
        };

        normalTokenDetails = {
            user_id: 2,
            email: 'user@test.com',
            user_type: EUserType.NORMAL,
            iat: Math.floor(Date.now() / 1000)
        };

        // Setup mock manager
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            remove: jest.fn()
        };

        // Mock DBDriver
        const mockDriver = {
            getConcreteDriver: jest.fn<any>().mockResolvedValue({ manager: mockManager }) as any
        };

        (DBDriver.getInstance as jest.Mock) = jest.fn<any>().mockReturnValue({
            getDriver: jest.fn<any>().mockResolvedValue(mockDriver) as any
        }) as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUsers', () => {
        it('should return empty array if driver is not available', async () => {
            (DBDriver.getInstance as jest.Mock) = jest.fn<any>().mockReturnValue({
                getDriver: jest.fn<any>().mockResolvedValue(null) as any
            }) as any;

            const result = await processor.getUsers(adminTokenDetails);

            expect(result).toEqual([]);
        });

        it('should return empty array if user is not admin', async () => {
            const normalUser = {
                id: 2,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(normalUser);

            const result = await processor.getUsers(normalTokenDetails);

            expect(result).toEqual([]);
        });

        it('should return list of users for admin', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const mockUsers = [
                {
                    id: 1,
                    email: 'admin@test.com',
                    first_name: 'Admin',
                    last_name: 'User',
                    user_type: EUserType.ADMIN,
                    email_verified_at: new Date(),
                    unsubscribe_from_emails_at: null
                },
                {
                    id: 2,
                    email: 'user@test.com',
                    first_name: 'Normal',
                    last_name: 'User',
                    user_type: EUserType.NORMAL,
                    email_verified_at: new Date(),
                    unsubscribe_from_emails_at: null
                }
            ];

            mockManager.findOne.mockResolvedValue(adminUser);
            mockManager.find.mockResolvedValue(mockUsers);

            const result = await processor.getUsers(adminTokenDetails);

            expect(result).toHaveLength(2);
            expect(result[0].email).toBe('admin@test.com');
            expect(result[1].email).toBe('user@test.com');
        });
    });

    describe('getUserById', () => {
        it('should return null for non-admin users', async () => {
            const normalUser = {
                id: 2,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(normalUser);

            const result = await processor.getUserById(1, normalTokenDetails);

            expect(result).toBeNull();
        });

        it('should return user details for admin', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const targetUser = {
                id: 2,
                email: 'user@test.com',
                first_name: 'Test',
                last_name: 'User',
                user_type: EUserType.NORMAL,
                email_verified_at: new Date(),
                unsubscribe_from_emails_at: null,
                projects: [],
                data_sources: [],
                dashboards: [],
                articles: []
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(targetUser);

            const result = await processor.getUserById(2, adminTokenDetails);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(2);
            expect(result?.email).toBe('user@test.com');
        });

        it('should return null if user not found', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(null);

            const result = await processor.getUserById(999, adminTokenDetails);

            expect(result).toBeNull();
        });
    });

    describe('updateUser', () => {
        it('should return false for non-admin users', async () => {
            const normalUser = {
                id: 2,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(normalUser);

            const result = await processor.updateUser(
                1,
                { first_name: 'Updated' },
                normalTokenDetails
            );

            expect(result).toBe(false);
        });

        it('should prevent admin from demoting themselves', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            mockManager.findOne.mockResolvedValue(adminUser);

            const result = await processor.updateUser(
                1,
                { user_type: EUserType.NORMAL },
                adminTokenDetails
            );

            expect(result).toBe(false);
        });

        it('should update user successfully', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const targetUser = {
                id: 2,
                email: 'user@test.com',
                first_name: 'Old',
                last_name: 'Name',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(targetUser);
            mockManager.save.mockResolvedValue(targetUser);

            const result = await processor.updateUser(
                2,
                { first_name: 'Updated', last_name: 'User' },
                adminTokenDetails
            );

            expect(result).toBe(true);
            expect(mockManager.save).toHaveBeenCalled();
        });
    });

    describe('changeUserType', () => {
        it('should prevent admin from demoting themselves', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            mockManager.findOne.mockResolvedValue(adminUser);

            const result = await processor.changeUserType(
                1,
                EUserType.NORMAL,
                adminTokenDetails
            );

            expect(result).toBe(false);
        });

        it('should change user type successfully', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const targetUser = {
                id: 2,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(targetUser);
            mockManager.save.mockResolvedValue(targetUser);

            const result = await processor.changeUserType(
                2,
                EUserType.ADMIN,
                adminTokenDetails
            );

            expect(result).toBe(true);
            expect(targetUser.user_type).toBe(EUserType.ADMIN);
        });
    });

    describe('toggleEmailVerificationStatus', () => {
        it('should toggle verification status', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const targetUser = {
                id: 2,
                email: 'user@test.com',
                email_verified_at: null
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(targetUser);
            mockManager.save.mockResolvedValue(targetUser);

            const result = await processor.toggleEmailVerificationStatus(
                2,
                adminTokenDetails
            );

            expect(result).toBe(true);
            expect(targetUser.email_verified_at).not.toBeNull();
        });
    });

    describe('deleteUser', () => {
        it('should prevent admin from deleting themselves', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            mockManager.findOne.mockResolvedValue(adminUser);

            const result = await processor.deleteUser(1, adminTokenDetails);

            expect(result).toBe(false);
        });

        it('should delete user and all associated data', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const targetUser = {
                id: 2,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(targetUser);
            mockManager.find.mockResolvedValue([]);
            mockManager.remove.mockResolvedValue(undefined);

            const result = await processor.deleteUser(2, adminTokenDetails);

            expect(result).toBe(true);
            expect(mockManager.remove).toHaveBeenCalled();
        });
    });

    describe('getPrivateBetaUserForConversion', () => {
        it('should return null if beta user already converted', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const betaUser = {
                id: 1,
                first_name: 'Beta',
                last_name: 'User',
                business_email: 'beta@test.com',
                company_name: 'Test Corp',
                phone_number: '+1234567890',
                country: 'USA'
            };

            const existingUser = {
                id: 10,
                email: 'beta@test.com'
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(betaUser)
                .mockResolvedValueOnce(existingUser);

            const result = await processor.getPrivateBetaUserForConversion(
                adminTokenDetails,
                1
            );

            expect(result).toBeNull();
        });

        it('should return beta user data for conversion', async () => {
            const adminUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const betaUser = {
                id: 1,
                first_name: 'Beta',
                last_name: 'User',
                business_email: 'beta@test.com',
                company_name: 'Test Corp',
                phone_number: '+1234567890',
                country: 'USA'
            };

            mockManager.findOne
                .mockResolvedValueOnce(adminUser)
                .mockResolvedValueOnce(betaUser)
                .mockResolvedValueOnce(null); // No existing user

            const result = await processor.getPrivateBetaUserForConversion(
                adminTokenDetails,
                1
            );

            expect(result).not.toBeNull();
            expect(result?.email).toBe('beta@test.com');
            expect(result?.first_name).toBe('Beta');
            expect(result?.company_name).toBe('Test Corp');
        });
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = UserManagementProcessor.getInstance();
            const instance2 = UserManagementProcessor.getInstance();

            expect(instance1).toBe(instance2);
        });
    });
});
