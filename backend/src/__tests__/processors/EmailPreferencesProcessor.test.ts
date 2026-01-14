import { EmailPreferencesProcessor } from '../../processors/EmailPreferencesProcessor';
import { DBDriver } from '../../drivers/DBDriver';
import { DRAEmailPreferences } from '../../models/DRAEmailPreferences';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform';

// Mock DBDriver
jest.mock('../../drivers/DBDriver');

describe('EmailPreferencesProcessor', () => {
    let processor: EmailPreferencesProcessor;
    let mockManager: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock database manager
        mockManager = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        // Mock DBDriver getInstance chain
        const mockDriver = {
            getConcreteDriver: jest.fn().mockResolvedValue({
                manager: mockManager,
            }),
        };

        (DBDriver.getInstance as jest.Mock).mockReturnValue({
            getDriver: jest.fn().mockResolvedValue(mockDriver),
        });

        processor = EmailPreferencesProcessor.getInstance();
    });

    describe('getUserPreferences', () => {
        it('should return existing preferences if found', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockManager.findOne
                .mockResolvedValueOnce(mockUser) // User lookup
                .mockResolvedValueOnce(mockPreferences); // Preferences lookup

            const result = await processor.getUserPreferences(1);

            expect(result).toEqual(expect.objectContaining({
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
            }));
        });

        it('should create default preferences if not found', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockNewPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockManager.findOne
                .mockResolvedValueOnce(mockUser) // User lookup
                .mockResolvedValueOnce(null); // Preferences not found

            mockManager.create.mockReturnValue(mockNewPreferences);
            mockManager.save.mockResolvedValue(mockNewPreferences);

            const result = await processor.getUserPreferences(1);

            expect(mockManager.create).toHaveBeenCalledWith(
                DRAEmailPreferences,
                expect.objectContaining({
                    user_id: 1,
                    subscription_updates: true,
                    expiration_warnings: true,
                    renewal_reminders: true,
                    promotional_emails: false,
                })
            );
            expect(result.subscription_updates).toBe(true);
        });

        it('should throw error if user not found', async () => {
            mockManager.findOne.mockResolvedValueOnce(null); // User not found

            await expect(processor.getUserPreferences(999)).rejects.toThrow(
                'User with id 999 not found'
            );
        });
    });

    describe('updateUserPreferences', () => {
        it('should update existing preferences', async () => {
            const mockExistingPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            const mockUpdatedPreferences = {
                ...mockExistingPreferences,
                promotional_emails: true,
                updated_at: new Date(),
            };

            mockManager.findOne.mockResolvedValue(mockExistingPreferences);
            mockManager.save.mockResolvedValue(mockUpdatedPreferences);

            const result = await processor.updateUserPreferences(1, {
                promotional_emails: true,
            });

            expect(result.promotional_emails).toBe(true);
            expect(mockManager.save).toHaveBeenCalled();
        });

        it('should create new preferences if none exist', async () => {
            const mockNewPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: false,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockManager.findOne.mockResolvedValue(null);
            mockManager.create.mockReturnValue(mockNewPreferences);
            mockManager.save.mockResolvedValue(mockNewPreferences);

            const result = await processor.updateUserPreferences(1, {
                subscription_updates: false,
            });

            expect(mockManager.create).toHaveBeenCalled();
            expect(result.subscription_updates).toBe(false);
        });
    });

    describe('canSendEmail', () => {
        it('should return true if user has opted in', async () => {
            const mockPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockManager.findOne
                .mockResolvedValueOnce({ id: 1 }) // User lookup
                .mockResolvedValueOnce(mockPreferences); // Preferences lookup

            const result = await processor.canSendEmail(1, 'subscription_updates');

            expect(result).toBe(true);
        });

        it('should return false if user has opted out', async () => {
            const mockPreferences = {
                id: 1,
                user_id: 1,
                subscription_updates: true,
                expiration_warnings: false,
                renewal_reminders: true,
                promotional_emails: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockManager.findOne
                .mockResolvedValueOnce({ id: 1 }) // User lookup
                .mockResolvedValueOnce(mockPreferences); // Preferences lookup

            const result = await processor.canSendEmail(1, 'expiration_warnings');

            expect(result).toBe(false);
        });

        it('should default to true for critical emails on error', async () => {
            mockManager.findOne.mockRejectedValue(new Error('Database error'));

            const result = await processor.canSendEmail(1, 'subscription_updates');

            expect(result).toBe(true); // Defaults to true for non-promotional
        });

        it('should default to false for promotional emails on error', async () => {
            mockManager.findOne.mockRejectedValue(new Error('Database error'));

            const result = await processor.canSendEmail(1, 'promotional_emails');

            expect(result).toBe(false); // Defaults to false for promotional
        });
    });
});
