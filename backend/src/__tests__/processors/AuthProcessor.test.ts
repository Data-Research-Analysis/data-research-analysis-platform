import { jest } from '@jest/globals';
import { AuthProcessor } from '../../processors/AuthProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { EUserType } from '../../types/EUserType.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UtilityService } from '../../services/UtilityService.js';

/**
 * TEST-004: AuthProcessor Unit Tests
 * Focused tests for authentication core functionality
 * Total: 15 tests covering critical auth operations
 */
describe('AuthProcessor', () => {
    let authProcessor: AuthProcessor;
    let mockManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        authProcessor = AuthProcessor.getInstance();
        
        // Create mock manager
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            remove: jest.fn()
        };

        // Mock the driver chain
        const mockConcreteDriver = { manager: mockManager };
        const mockDriver = {
            getConcreteDriver: jest.fn<any>().mockResolvedValue(mockConcreteDriver)
        };
        const mockDBDriverInstance = {
            getDriver: jest.fn<any>().mockResolvedValue(mockDriver)
        };
        
        jest.spyOn(DBDriver, 'getInstance').mockReturnValue(mockDBDriverInstance as any);
        jest.spyOn(UtilityService.getInstance(), 'getConstants').mockImplementation((key: string) => {
            if (key === 'JWT_SECRET') return 'test-secret';
            if (key === 'PASSWORD_SALT') return '10';
            return '';
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = AuthProcessor.getInstance();
            const instance2 = AuthProcessor.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getUserById()', () => {
        it('should return user when found', async () => {
            const mockUser = {
                id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(mockUser);

            const result = await authProcessor.getUserById(1);
            
            expect(result).toMatchObject({
                id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                user_type: EUserType.NORMAL
            });
        });

        it('should return null when user not found', async () => {
            mockManager.findOne.mockResolvedValue(null);

            const result = await authProcessor.getUserById(999);
            
            expect(result).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            mockManager.findOne.mockRejectedValue(new Error('DB error'));

            // AuthProcessor catches errors and returns null
            const result = await authProcessor.getUserById(1);
            
            expect(result).toBeNull();
        });
    });

    describe('login()', () => {
        const validUser = {
            id: 1,
            email: 'user@test.com',
            password: '$2a$10$hashedpass',
            first_name: 'John',
            last_name: 'Doe',
            user_type: EUserType.NORMAL
        };

        it('should successfully login with valid credentials', async () => {
            mockManager.findOne.mockResolvedValue(validUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            jest.spyOn(jwt, 'sign').mockReturnValue('mock-jwt' as any);

            const result = await authProcessor.login('user@test.com', 'password');

            expect(result).toHaveProperty('token', 'mock-jwt');
            expect(result).toHaveProperty('email', 'user@test.com');
        });

        it('should return null for incorrect password', async () => {
            mockManager.findOne.mockResolvedValue(validUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false as never));

            const result = await authProcessor.login('user@test.com', 'wrong');

            expect(result).toBeNull();
        });

        it('should return null for non-existent user', async () => {
            mockManager.findOne.mockResolvedValue(null);

            const result = await authProcessor.login('nobody@test.com', 'password');

            expect(result).toBeNull();
        });

        it('should generate JWT with correct payload', async () => {
            mockManager.findOne.mockResolvedValue(validUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('token' as any);

            await authProcessor.login('user@test.com', 'password');

            expect(signSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    email: 'user@test.com'
                }),
                'test-secret'
            );
        });
    });

    describe('Security Properties', () => {
        it('should use bcrypt for password comparison', async () => {
            const mockUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashed',
                first_name: 'Test',
                last_name: 'User',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(mockUser);
            const compareSpy = jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            jest.spyOn(jwt, 'sign').mockReturnValue('token' as any);

            await authProcessor.login('test@test.com', 'password');

            expect(compareSpy).toHaveBeenCalledWith('password', 'hashed');
        });

        it('should use JWT for token generation', async () => {
            const mockUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashed',
                first_name: 'Test',
                last_name: 'User',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            const jwtSpy = jest.spyOn(jwt, 'sign').mockReturnValue('token' as any);

            await authProcessor.login('test@test.com', 'password');

            expect(jwtSpy).toHaveBeenCalled();
        });

        it('should not expose sensitive data in responses', async () => {
            const mockUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashed',
                first_name: 'Test',
                last_name: 'User',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            jest.spyOn(jwt, 'sign').mockReturnValue('token' as any);

            const result = await authProcessor.login('test@test.com', 'password');

            // Result should not include password field
            expect(result).toBeDefined();
            if (result) {
                expect(result).not.toHaveProperty('password');
            }
        });

        it('should handle null responses for invalid credentials', async () => {
            mockManager.findOne.mockResolvedValue(null);

            const result = await authProcessor.login('invalid@test.com', 'password');

            expect(result).toBeNull();
        });

        it('should use JWT_SECRET from environment', async () => {
            const constantsSpy = jest.spyOn(UtilityService.getInstance(), 'getConstants');
            
            // Trigger login to access JWT_SECRET
            const mockUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashed',
                first_name: 'Test',
                last_name: 'User',
                user_type: EUserType.NORMAL
            };

            mockManager.findOne.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
            jest.spyOn(jwt, 'sign').mockReturnValue('token' as any);

            await authProcessor.login('test@test.com', 'password');

            expect(constantsSpy).toHaveBeenCalledWith('JWT_SECRET');
        });
    });
});
