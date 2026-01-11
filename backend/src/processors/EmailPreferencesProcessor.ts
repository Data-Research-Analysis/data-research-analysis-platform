import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAEmailPreferences } from "../models/DRAEmailPreferences.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";

export interface IEmailPreferencesData {
    id?: number;
    user_id: number;
    subscription_updates: boolean;
    expiration_warnings: boolean;
    renewal_reminders: boolean;
    promotional_emails: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export class EmailPreferencesProcessor {
    private static instance: EmailPreferencesProcessor;
    
    private constructor() {}
    
    public static getInstance(): EmailPreferencesProcessor {
        if (!EmailPreferencesProcessor.instance) {
            EmailPreferencesProcessor.instance = new EmailPreferencesProcessor();
        }
        return EmailPreferencesProcessor.instance;
    }
    
    /**
     * Get user's email preferences (creates default if not exists)
     */
    async getUserPreferences(userId: number): Promise<IEmailPreferencesData> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        // Check if user exists
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }
        
        // Try to find existing preferences
        let preferences = await manager.findOne(DRAEmailPreferences, {
            where: { user_id: userId }
        });
        
        // If not found, create default preferences
        if (!preferences) {
            preferences = manager.create(DRAEmailPreferences, {
                user_id: userId,
                subscription_updates: true,
                expiration_warnings: true,
                renewal_reminders: true,
                promotional_emails: false
            });
            preferences = await manager.save(preferences);
        }
        
        return {
            id: preferences.id,
            user_id: preferences.user_id,
            subscription_updates: preferences.subscription_updates,
            expiration_warnings: preferences.expiration_warnings,
            renewal_reminders: preferences.renewal_reminders,
            promotional_emails: preferences.promotional_emails,
            created_at: preferences.created_at,
            updated_at: preferences.updated_at
        };
    }
    
    /**
     * Update user's email preferences
     */
    async updateUserPreferences(
        userId: number,
        updates: Partial<Omit<IEmailPreferencesData, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ): Promise<IEmailPreferencesData> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        // Get or create preferences
        let preferences = await manager.findOne(DRAEmailPreferences, {
            where: { user_id: userId }
        });
        
        if (!preferences) {
            // Create new preferences with updates
            preferences = manager.create(DRAEmailPreferences, {
                user_id: userId,
                subscription_updates: updates.subscription_updates ?? true,
                expiration_warnings: updates.expiration_warnings ?? true,
                renewal_reminders: updates.renewal_reminders ?? true,
                promotional_emails: updates.promotional_emails ?? false
            });
        } else {
            // Update existing preferences
            if (updates.subscription_updates !== undefined) {
                preferences.subscription_updates = updates.subscription_updates;
            }
            if (updates.expiration_warnings !== undefined) {
                preferences.expiration_warnings = updates.expiration_warnings;
            }
            if (updates.renewal_reminders !== undefined) {
                preferences.renewal_reminders = updates.renewal_reminders;
            }
            if (updates.promotional_emails !== undefined) {
                preferences.promotional_emails = updates.promotional_emails;
            }
            preferences.updated_at = new Date();
        }
        
        const savedPreferences = await manager.save(preferences);
        
        return {
            id: savedPreferences.id,
            user_id: savedPreferences.user_id,
            subscription_updates: savedPreferences.subscription_updates,
            expiration_warnings: savedPreferences.expiration_warnings,
            renewal_reminders: savedPreferences.renewal_reminders,
            promotional_emails: savedPreferences.promotional_emails,
            created_at: savedPreferences.created_at,
            updated_at: savedPreferences.updated_at
        };
    }
    
    /**
     * Check if user has opted in for a specific email type
     */
    async canSendEmail(userId: number, emailType: 'subscription_updates' | 'expiration_warnings' | 'renewal_reminders' | 'promotional_emails'): Promise<boolean> {
        try {
            const preferences = await this.getUserPreferences(userId);
            return preferences[emailType];
        } catch (error) {
            // Default to true if preferences not found (don't block critical emails)
            console.error('[EmailPreferencesProcessor] Error checking email preferences:', error);
            return emailType !== 'promotional_emails'; // Only block promotional emails by default
        }
    }
}
