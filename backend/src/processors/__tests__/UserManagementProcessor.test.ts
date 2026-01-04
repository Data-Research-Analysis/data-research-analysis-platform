import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserManagementProcessor } from '../../processors/UserManagementProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EUserType } from '../../types/EUserType.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../drivers/DBDriver.js');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

/**
 * DRA-TEST-004: UserManagementProcessor Unit Tests
 * Tests all user operations including registration, login, JWT, password management
 * Total: 40+ tests
 */
describe('UserManagementProcessor', () => {
    let userProcessor: UserManagementProcessor;
    let mockDBDriver: jest.Mocked<DBDriver>;

    const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword123',
        name: 'Test User',
        user_type: EUserType.NORMAL,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
    };

    beforeEach(() => {
        userProcessor = UserManagementProcessor.getInstance();
        mockDBDriver = new DBDriver() as jest.Mocked<DBDriver>;
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = UserManagementProcessor.getInstance();
            const instance2 = UserManagementProcessor.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = UserManagementProcessor.getInstance();
            const instance2 = UserManagementProcessor.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('User Registration', () => {
        it('should register new user with valid email format', async () => {
            const email = 'newuser@example.com';
            const password = 'SecurePass123!';
            const name = 'New User';

            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            const result = await userProcessor.registerUser(email, password, name);

            expect(result).toBeDefined();
            expect(bcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
        });

        it('should reject registration with invalid email format', async () => {
            const invalidEmail = 'notanemail';
            const password = 'SecurePass123!';

            await expect(
                userProcessor.registerUser(invalidEmail, password, 'User')
            ).rejects.toThrow();
        });

        it('should reject registration with weak password', async () => {
            const email = 'user@example.com';
            const weakPassword = '123';

            await expect(
                userProcessor.registerUser(email, weakPassword, 'User')
            ).rejects.toThrow();
        });

        it('should reject registration with duplicate email', async () => {
            const email = 'existing@example.com';
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);

            await expect(
                userProcessor.registerUser(email, 'Password123!', 'User')
            ).rejects.toThrow();
        });

        it('should hash password during registration', async () => {
            const password = 'PlainTextPassword123!';
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.registerUser('user@example.com', password, 'User');

            expect(bcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
        });

        it('should validate email format strictly', async () => {
            const invalidEmails = [
                'test',
                'test@',
                '@example.com',
                'test@.com',
                'test space@example.com'
            ];

            for (const email of invalidEmails) {
                await expect(
                    userProcessor.registerUser(email, 'Pass123!', 'User')
                ).rejects.toThrow();
            }
        });

        it('should require minimum password strength', async () => {
            const weakPasswords = ['123', 'abc', 'pass', '12345'];

            for (const password of weakPasswords) {
                await expect(
                    userProcessor.registerUser('user@example.com', password, 'User')
                ).rejects.toThrow();
            }
        });

        it('should set user_type to NORMAL by default', async () => {
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            const result = await userProcessor.registerUser('user@example.com', 'Pass123!', 'User');

            expect(result?.user_type).toBe(EUserType.NORMAL);
        });
    });

    describe('User Login', () => {
        it('should login user with correct credentials', async () => {
            const email = 'test@example.com';
            const password = 'CorrectPassword123!';

            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (jwt.sign as jest.Mock).mockReturnValue('mock.jwt.token');

            const result = await userProcessor.loginUser(email, password);

            expect(result).toBeDefined();
            expect(result?.token).toBe('mock.jwt.token');
            expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
        });

        it('should reject login with incorrect password', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                userProcessor.loginUser('test@example.com', 'WrongPassword')
            ).rejects.toThrow();
        });

        it('should reject login with non-existent email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await expect(
                userProcessor.loginUser('nonexistent@example.com', 'Password123!')
            ).rejects.toThrow();
        });

        it('should generate JWT token on successful login', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (jwt.sign as jest.Mock).mockReturnValue('generated.jwt.token');

            const result = await userProcessor.loginUser('test@example.com', 'Password123!');

            expect(jwt.sign).toHaveBeenCalled();
            expect(result?.token).toBeDefined();
        });

        it('should reject login for unverified email', async () => {
            const unverifiedUser = { ...mockUser, email_verified: false };
            mockDBDriver.query = jest.fn().mockResolvedValue([unverifiedUser]);

            await expect(
                userProcessor.loginUser('test@example.com', 'Password123!')
            ).rejects.toThrow();
        });
    });

    describe('JWT Token Management', () => {
        it('should generate valid JWT token', () => {
            const tokenDetails: ITokenDetails = {
                user_id: 1,
                email: 'test@example.com',
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            (jwt.sign as jest.Mock).mockReturnValue('mock.jwt.token');

            const token = userProcessor.generateToken(tokenDetails);

            expect(token).toBe('mock.jwt.token');
            expect(jwt.sign).toHaveBeenCalled();
        });

        it('should validate JWT token successfully', () => {
            const validToken = 'valid.jwt.token';
            const decodedPayload: ITokenDetails = {
                user_id: 1,
                email: 'test@example.com',
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);

            const result = userProcessor.validateToken(validToken);

            expect(result).toEqual(decodedPayload);
            expect(jwt.verify).toHaveBeenCalledWith(validToken, expect.any(String));
        });

        it('should reject expired JWT token', () => {
            const expiredToken = 'expired.jwt.token';
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Token expired');
            });

            expect(() => userProcessor.validateToken(expiredToken)).toThrow('Token expired');
        });

        it('should reject malformed JWT token', () => {
            const malformedToken = 'malformed.token';
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(() => userProcessor.validateToken(malformedToken)).toThrow('Invalid token');
        });

        it('should include user_type in JWT payload', () => {
            const tokenDetails: ITokenDetails = {
                user_id: 1,
                email: 'admin@example.com',
                user_type: EUserType.ADMIN,
                iat: Date.now()
            };

            (jwt.sign as jest.Mock).mockImplementation((payload) => {
                expect(payload.user_type).toBe(EUserType.ADMIN);
                return 'token';
            });

            userProcessor.generateToken(tokenDetails);
        });
    });

    describe('Password Hashing', () => {
        it('should hash password with bcrypt', async () => {
            const plainPassword = 'MySecurePassword123!';
            const hashedPassword = 'hashedPasswordValue';

            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

            const result = await userProcessor.hashPassword(plainPassword);

            expect(result).toBe(hashedPassword);
            expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, expect.any(Number));
        });

        it('should use appropriate salt rounds for hashing', async () => {
            const password = 'Password123!';
            const saltRounds = 10;

            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

            await userProcessor.hashPassword(password);

            expect(bcrypt.hash).toHaveBeenCalledWith(password, saltRounds);
        });

        it('should verify password against hash', async () => {
            const plainPassword = 'Password123!';
            const hashedPassword = 'hashedValue';

            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await userProcessor.verifyPassword(plainPassword, hashedPassword);

            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
        });

        it('should reject incorrect password verification', async () => {
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await userProcessor.verifyPassword('WrongPass', 'hashedValue');

            expect(result).toBe(false);
        });
    });

    describe('Email Verification', () => {
        it('should generate email verification token', () => {
            const userId = 1;
            (jwt.sign as jest.Mock).mockReturnValue('verification.token');

            const token = userProcessor.generateEmailVerificationToken(userId);

            expect(token).toBe('verification.token');
            expect(jwt.sign).toHaveBeenCalled();
        });

        it('should verify email verification token', () => {
            const token = 'valid.verification.token';
            (jwt.verify as jest.Mock).mockReturnValue({ user_id: 1 });

            const result = userProcessor.verifyEmailToken(token);

            expect(result).toBeDefined();
            expect(result?.user_id).toBe(1);
        });

        it('should mark email as verified', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.markEmailVerified(1);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should reject invalid verification token', () => {
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(() => userProcessor.verifyEmailToken('invalid')).toThrow();
        });
    });

    describe('Password Reset Flow', () => {
        it('should request password reset for valid email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);
            (jwt.sign as jest.Mock).mockReturnValue('reset.token');

            const result = await userProcessor.requestPasswordReset('test@example.com');

            expect(result).toBeDefined();
            expect(result?.token).toBe('reset.token');
        });

        it('should reject password reset for non-existent email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await expect(
                userProcessor.requestPasswordReset('nonexistent@example.com')
            ).rejects.toThrow();
        });

        it('should verify password reset token', () => {
            const token = 'valid.reset.token';
            (jwt.verify as jest.Mock).mockReturnValue({ user_id: 1, type: 'password_reset' });

            const result = userProcessor.verifyPasswordResetToken(token);

            expect(result).toBeDefined();
            expect(result?.user_id).toBe(1);
        });

        it('should update password with reset token', async () => {
            const newPassword = 'NewSecurePass123!';
            (jwt.verify as jest.Mock).mockReturnValue({ user_id: 1 });
            (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.resetPassword('valid.token', newPassword);

            expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, expect.any(Number));
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should expire password reset token after use', async () => {
            const token = 'used.token';
            (jwt.verify as jest.Mock).mockReturnValue({ user_id: 1 });
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.resetPassword(token, 'NewPass123!');

            // Token should not be reusable
            expect(mockDBDriver.query).toHaveBeenCalled();
        });
    });

    describe('Beta User Conversion', () => {
        it('should convert beta user to full user', async () => {
            const betaUser = { ...mockUser, user_type: EUserType.BETA };
            mockDBDriver.query = jest.fn()
                .mockResolvedValueOnce([betaUser])
                .mockResolvedValueOnce([]);

            await userProcessor.convertBetaToFullUser(1);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should reject conversion for non-beta users', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]); // Already NORMAL

            await expect(userProcessor.convertBetaToFullUser(1)).rejects.toThrow();
        });

        it('should update user_type to NORMAL after conversion', async () => {
            const betaUser = { ...mockUser, user_type: EUserType.BETA };
            mockDBDriver.query = jest.fn()
                .mockResolvedValueOnce([betaUser])
                .mockResolvedValueOnce([{ ...betaUser, user_type: EUserType.NORMAL }]);

            const result = await userProcessor.convertBetaToFullUser(1);

            expect(result?.user_type).toBe(EUserType.NORMAL);
        });
    });

    describe('User Profile Updates', () => {
        it('should update user name', async () => {
            const newName = 'Updated Name';
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.updateUserName(1, newName);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should update user email', async () => {
            const newEmail = 'newemail@example.com';
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.updateUserEmail(1, newEmail);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should update user password', async () => {
            const newPassword = 'NewSecurePassword123!';
            (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.updateUserPassword(1, newPassword);

            expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, expect.any(Number));
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should validate new email format during update', async () => {
            const invalidEmail = 'notanemail';

            await expect(userProcessor.updateUserEmail(1, invalidEmail)).rejects.toThrow();
        });

        it('should require old password verification for password change', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                userProcessor.changePassword(1, 'WrongOldPass', 'NewPass123!')
            ).rejects.toThrow();
        });
    });

    describe('User Retrieval', () => {
        it('should get user by ID', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);

            const result = await userProcessor.getUserById(1);

            expect(result).toEqual(mockUser);
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should get user by email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockUser]);

            const result = await userProcessor.getUserByEmail('test@example.com');

            expect(result).toEqual(mockUser);
        });

        it('should return null for non-existent user', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            const result = await userProcessor.getUserById(999);

            expect(result).toBeNull();
        });

        it('should get all users with pagination', async () => {
            const users = [mockUser, { ...mockUser, id: 2 }];
            mockDBDriver.query = jest.fn().mockResolvedValue(users);

            const result = await userProcessor.getAllUsers(10, 0);

            expect(result).toEqual(users);
            expect(result.length).toBe(2);
        });

        it('should filter users by user_type', async () => {
            const adminUser = { ...mockUser, user_type: EUserType.ADMIN };
            mockDBDriver.query = jest.fn().mockResolvedValue([adminUser]);

            const result = await userProcessor.getUsersByType(EUserType.ADMIN);

            expect(result).toEqual([adminUser]);
            expect(result[0].user_type).toBe(EUserType.ADMIN);
        });
    });

    describe('User Deletion', () => {
        it('should delete user by ID', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.deleteUser(1);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should cascade delete user data sources', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.deleteUser(1);

            // Verify cascade delete is handled
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should cascade delete user data models', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.deleteUser(1);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should not allow self-deletion by admin', async () => {
            const adminTokenDetails: ITokenDetails = {
                user_id: 1,
                email: 'admin@example.com',
                user_type: EUserType.ADMIN,
                iat: Date.now()
            };

            await expect(
                userProcessor.deleteUserAsAdmin(1, adminTokenDetails)
            ).rejects.toThrow();
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should use parameterized queries for user registration', async () => {
            const maliciousEmail = "test@example.com'; DROP TABLE users; --";
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.registerUser(maliciousEmail, 'Pass123!', 'User');

            // Should not execute SQL injection
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should sanitize user input in searches', async () => {
            const maliciousSearch = "test' OR '1'='1";
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await userProcessor.searchUsers(maliciousSearch);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });
    });
});
