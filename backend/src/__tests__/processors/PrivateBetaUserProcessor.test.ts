import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrivateBetaUserProcessor } from '../PrivateBetaUserProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { EUserType } from '../../types/EUserType.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';

// Mock DBDriver
jest.mock('../../drivers/DBDriver.js');

describe('PrivateBetaUserProcessor', () => {
    let processor: PrivateBetaUserProcessor;
    let mockManager: any;
    let validTokenDetails: ITokenDetails;

    beforeEach(() => {
        processor = PrivateBetaUserProcessor.getInstance();
        
        validTokenDetails = {
            user_id: 1,
            email: 'admin@test.com',
            user_type: EUserType.ADMIN,
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

            const result = await processor.getUsers(validTokenDetails);

            expect(result).toEqual([]);
        });

        it('should return empty array if manager is not available', async () => {
            const mockDriver = {
                getConcreteDriver: jest.fn<any>().mockResolvedValue({ manager: null }) as any
            };

            (DBDriver.getInstance as jest.Mock) = jest.fn<any>().mockReturnValue({
                getDriver: jest.fn<any>().mockResolvedValue(mockDriver) as any
            }) as any;

            const result = await processor.getUsers(validTokenDetails);

            expect(result).toEqual([]);
        });

        it('should return empty array if user is not found', async () => {
            mockManager.findOne.mockResolvedValue(null);

            const result = await processor.getUsers(validTokenDetails);

            expect(result).toEqual([]);
        });

        it('should return list of beta users with conversion status', async () => {
            const mockUser = {
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.ADMIN
            };

            const mockBetaUsers = [
                {
                    id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    business_email: 'john@example.com',
                    phone_number: '+1234567890',
                    country: 'USA',
                    agree_to_receive_updates: true,
                    company_name: 'Test Corp',
                    created_at: new Date()
                },
                {
                    id: 2,
                    first_name: 'Jane',
                    last_name: 'Smith',
                    business_email: 'jane@example.com',
                    phone_number: '+0987654321',
                    country: 'UK',
                    agree_to_receive_updates: false,
                    company_name: 'Sample Inc',
                    created_at: new Date()
                }
            ];

            const mockExistingUser = {
                id: 10,
                email: 'john@example.com'
            };

            mockManager.findOne
                .mockResolvedValueOnce(mockUser) // Admin user lookup
                .mockResolvedValueOnce(mockExistingUser) // First beta user already converted
                .mockResolvedValueOnce(null); // Second beta user not converted

            mockManager.find.mockResolvedValue(mockBetaUsers);

            const result = await processor.getUsers(validTokenDetails);

            expect(result).toHaveLength(2);
            expect(result[0].first_name).toBe('John');
            expect(result[0].is_converted).toBe(true);
            expect(result[0].converted_user_id).toBe(10);
            expect(result[1].first_name).toBe('Jane');
            expect(result[1].is_converted).toBe(false);
            expect(result[1].converted_user_id).toBeNull();
        });
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = PrivateBetaUserProcessor.getInstance();
            const instance2 = PrivateBetaUserProcessor.getInstance();

            expect(instance1).toBe(instance2);
        });
    });
});
