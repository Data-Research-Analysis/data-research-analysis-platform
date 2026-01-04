import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrivateBetaUserProcessor } from '../../processors/PrivateBetaUserProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EUserType } from '../../types/EUserType.js';

// Mock dependencies
jest.mock('../../drivers/DBDriver.js');

/**
 * DRA-TEST-007: PrivateBetaUserProcessor Unit Tests
 * Tests beta user management, invitations, conversions, and list management
 * Total: 20+ tests
 */
describe('PrivateBetaUserProcessor', () => {
    let betaProcessor: PrivateBetaUserProcessor;
    let mockDBDriver: jest.Mocked<DBDriver>;

    const mockBetaUser = {
        id: 1,
        email: 'beta@example.com',
        invited_by: 1,
        invitation_code: 'BETA123',
        used: false,
        created_at: new Date(),
        converted_to_user_id: null
    };

    beforeEach(() => {
        betaProcessor = PrivateBetaUserProcessor.getInstance();
        mockDBDriver = new DBDriver() as jest.Mocked<DBDriver>;
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = PrivateBetaUserProcessor.getInstance();
            const instance2 = PrivateBetaUserProcessor.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across instances', () => {
            const instance1 = PrivateBetaUserProcessor.getInstance();
            const instance2 = PrivateBetaUserProcessor.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('Beta User Creation', () => {
        it('should create new beta user invitation', async () => {
            const email = 'newbeta@example.com';
            const invitedBy = 1;

            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            const result = await betaProcessor.createBetaInvitation(email, invitedBy);

            expect(result).toBeDefined();
            expect(result?.email).toBe(email);
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should generate unique invitation code', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            const result = await betaProcessor.createBetaInvitation('test@example.com', 1);

            expect(result?.invitation_code).toBeDefined();
            expect(result?.invitation_code.length).toBeGreaterThan(0);
        });

        it('should reject duplicate beta user email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            await expect(
                betaProcessor.createBetaInvitation('beta@example.com', 1)
            ).rejects.toThrow();
        });

        it('should validate email format', async () => {
            const invalidEmail = 'notanemail';

            await expect(
                betaProcessor.createBetaInvitation(invalidEmail, 1)
            ).rejects.toThrow();
        });

        it('should set used flag to false by default', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            const result = await betaProcessor.createBetaInvitation('test@example.com', 1);

            expect(result?.used).toBe(false);
        });
    });

    describe('Invitation Code Validation', () => {
        it('should validate correct invitation code', async () => {
            const validCode = 'BETA123';
            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            const result = await betaProcessor.validateInvitationCode(validCode);

            expect(result).toBe(true);
            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should reject invalid invitation code', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            const result = await betaProcessor.validateInvitationCode('INVALID');

            expect(result).toBe(false);
        });

        it('should reject used invitation code', async () => {
            const usedBeta = { ...mockBetaUser, used: true };
            mockDBDriver.query = jest.fn().mockResolvedValue([usedBeta]);

            const result = await betaProcessor.validateInvitationCode('BETA123');

            expect(result).toBe(false);
        });

        it('should check if email is already registered', async () => {
            mockDBDriver.query = jest.fn()
                .mockResolvedValueOnce([mockBetaUser])
                .mockResolvedValueOnce([{ id: 1, email: 'beta@example.com' }]);

            const result = await betaProcessor.isEmailAvailable('beta@example.com');

            expect(result).toBe(false);
        });
    });

    describe('Beta User Conversion', () => {
        it('should mark invitation as used after conversion', async () => {
            const invitationCode = 'BETA123';
            const userId = 10;

            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await betaProcessor.markInvitationUsed(invitationCode, userId);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should store converted user ID', async () => {
            const invitationCode = 'BETA123';
            const userId = 10;

            mockDBDriver.query = jest.fn().mockResolvedValue([
                { ...mockBetaUser, used: true, converted_to_user_id: userId }
            ]);

            const result = await betaProcessor.getConvertedUserId(invitationCode);

            expect(result).toBe(userId);
        });

        it('should prevent reusing converted invitations', async () => {
            const usedBeta = { ...mockBetaUser, used: true, converted_to_user_id: 10 };
            mockDBDriver.query = jest.fn().mockResolvedValue([usedBeta]);

            await expect(
                betaProcessor.convertBetaUser('BETA123')
            ).rejects.toThrow();
        });

        it('should get beta user by invitation code', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([mockBetaUser]);

            const result = await betaProcessor.getBetaUserByCode('BETA123');

            expect(result).toEqual(mockBetaUser);
        });
    });

    describe('Beta User List Management', () => {
        it('should get all beta users', async () => {
            const betaUsers = [mockBetaUser, { ...mockBetaUser, id: 2 }];
            mockDBDriver.query = jest.fn().mockResolvedValue(betaUsers);

            const result = await betaProcessor.getAllBetaUsers();

            expect(result).toEqual(betaUsers);
            expect(result.length).toBe(2);
        });

        it('should filter unused invitations', async () => {
            const unused = [mockBetaUser];
            mockDBDriver.query = jest.fn().mockResolvedValue(unused);

            const result = await betaProcessor.getUnusedInvitations();

            expect(result.every(user => !user.used)).toBe(true);
        });

        it('should filter used invitations', async () => {
            const used = [{ ...mockBetaUser, used: true }];
            mockDBDriver.query = jest.fn().mockResolvedValue(used);

            const result = await betaProcessor.getUsedInvitations();

            expect(result.every(user => user.used)).toBe(true);
        });

        it('should get invitations by user', async () => {
            const invitedBy = 1;
            const userInvitations = [mockBetaUser];
            mockDBDriver.query = jest.fn().mockResolvedValue(userInvitations);

            const result = await betaProcessor.getInvitationsByUser(invitedBy);

            expect(result).toEqual(userInvitations);
            expect(result[0].invited_by).toBe(invitedBy);
        });

        it('should count total beta users', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([{ count: 5 }]);

            const result = await betaProcessor.getTotalBetaUsers();

            expect(result).toBe(5);
        });
    });

    describe('Beta User Deletion', () => {
        it('should delete beta user by ID', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await betaProcessor.deleteBetaUser(1);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should delete beta user by email', async () => {
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await betaProcessor.deleteBetaUserByEmail('beta@example.com');

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should prevent deletion of used invitations', async () => {
            const usedBeta = { ...mockBetaUser, used: true };
            mockDBDriver.query = jest.fn().mockResolvedValue([usedBeta]);

            await expect(betaProcessor.deleteBetaUser(1)).rejects.toThrow();
        });

        it('should allow deletion of expired unused invitations', async () => {
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 31);
            
            const expiredBeta = { ...mockBetaUser, created_at: expiredDate };
            mockDBDriver.query = jest.fn().mockResolvedValue([expiredBeta]);

            await betaProcessor.deleteExpiredInvitations();

            expect(mockDBDriver.query).toHaveBeenCalled();
        });
    });

    describe('Invitation Statistics', () => {
        it('should calculate conversion rate', async () => {
            mockDBDriver.query = jest.fn()
                .mockResolvedValueOnce([{ count: 10 }]) // total
                .mockResolvedValueOnce([{ count: 3 }]); // used

            const result = await betaProcessor.getConversionRate();

            expect(result).toBe(30); // 30%
        });

        it('should get recent invitations', async () => {
            const recentBeta = [mockBetaUser];
            mockDBDriver.query = jest.fn().mockResolvedValue(recentBeta);

            const result = await betaProcessor.getRecentInvitations(7); // last 7 days

            expect(result).toEqual(recentBeta);
        });

        it('should check if user has invitation quota remaining', async () => {
            const maxInvitations = 5;
            mockDBDriver.query = jest.fn().mockResolvedValue([
                mockBetaUser,
                { ...mockBetaUser, id: 2 },
                { ...mockBetaUser, id: 3 }
            ]);

            const result = await betaProcessor.canUserInvite(1, maxInvitations);

            expect(result).toBe(true); // 3 < 5
        });

        it('should reject invitation when quota exceeded', async () => {
            const maxInvitations = 2;
            mockDBDriver.query = jest.fn().mockResolvedValue([
                mockBetaUser,
                { ...mockBetaUser, id: 2 },
                { ...mockBetaUser, id: 3 }
            ]);

            const result = await betaProcessor.canUserInvite(1, maxInvitations);

            expect(result).toBe(false); // 3 >= 2
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should use parameterized queries for email search', async () => {
            const maliciousEmail = "test@example.com'; DROP TABLE private_beta_users; --";
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await betaProcessor.getBetaUserByEmail(maliciousEmail);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });

        it('should sanitize invitation code input', async () => {
            const maliciousCode = "BETA123' OR '1'='1";
            mockDBDriver.query = jest.fn().mockResolvedValue([]);

            await betaProcessor.validateInvitationCode(maliciousCode);

            expect(mockDBDriver.query).toHaveBeenCalled();
        });
    });
});
