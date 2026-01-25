import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAPlatformSettings, EPlatformSettingKey, ESettingCategory, ESettingType } from "../models/DRAPlatformSettings.js";
import { Repository } from "typeorm";

/**
 * Interface for platform setting data
 */
export interface IPlatformSettingData {
    setting_key: string;
    setting_value: string;
    setting_type?: ESettingType;
    description?: string | null;
    category?: string;
    is_editable?: boolean;
}

/**
 * PlatformSettingsProcessor - Manages platform-wide configuration settings
 * Provides CRUD operations and type-safe value retrieval for settings
 */
export class PlatformSettingsProcessor {
    private static instance: PlatformSettingsProcessor;
    
    private constructor() {}
    
    public static getInstance(): PlatformSettingsProcessor {
        if (!PlatformSettingsProcessor.instance) {
            PlatformSettingsProcessor.instance = new PlatformSettingsProcessor();
        }
        return PlatformSettingsProcessor.instance;
    }

    /**
     * Get repository for platform settings
     */
    private async getRepository(): Promise<Repository<DRAPlatformSettings>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }
        return concreteDriver.manager.getRepository(DRAPlatformSettings);
    }

    /**
     * Get a setting by key with type-safe value parsing
     */
    async getSetting<T = string>(key: string): Promise<T | null> {
        try {
            const repository = await this.getRepository();
            const setting = await repository.findOne({ where: { setting_key: key } });
            
            if (!setting) {
                return null;
            }

            return this.parseSettingValue<T>(setting.setting_value, setting.setting_type);
        } catch (error) {
            console.error(`Error retrieving setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get multiple settings by category
     */
    async getSettingsByCategory(category: string): Promise<DRAPlatformSettings[]> {
        try {
            const repository = await this.getRepository();
            return await repository.find({
                where: { category },
                order: { setting_key: 'ASC' }
            });
        } catch (error) {
            console.error(`Error retrieving settings for category ${category}:`, error);
            throw error;
        }
    }

    /**
     * Get all settings
     */
    async getAllSettings(): Promise<DRAPlatformSettings[]> {
        try {
            const repository = await this.getRepository();
            return await repository.find({
                order: { category: 'ASC', setting_key: 'ASC' }
            });
        } catch (error) {
            console.error('Error retrieving all settings:', error);
            throw error;
        }
    }

    /**
     * Set or update a setting
     */
    async setSetting(data: IPlatformSettingData): Promise<DRAPlatformSettings> {
        try {
            const repository = await this.getRepository();
            
            // Check if setting already exists
            let setting = await repository.findOne({ where: { setting_key: data.setting_key } });
            
            if (setting) {
                // Update existing setting
                setting.setting_value = data.setting_value;
                if (data.setting_type) setting.setting_type = data.setting_type;
                if (data.description !== undefined) setting.description = data.description;
                if (data.category) setting.category = data.category;
                if (data.is_editable !== undefined) setting.is_editable = data.is_editable;
            } else {
                // Create new setting
                setting = repository.create({
                    setting_key: data.setting_key,
                    setting_value: data.setting_value,
                    setting_type: data.setting_type || ESettingType.STRING,
                    description: data.description || null,
                    category: data.category || ESettingCategory.GENERAL,
                    is_editable: data.is_editable !== undefined ? data.is_editable : true
                });
            }
            
            return await repository.save(setting);
        } catch (error) {
            console.error(`Error setting ${data.setting_key}:`, error);
            throw error;
        }
    }

    /**
     * Delete a setting
     */
    async deleteSetting(key: string): Promise<boolean> {
        try {
            const repository = await this.getRepository();
            const result = await repository.delete({ setting_key: key });
            return (result.affected ?? 0) > 0;
        } catch (error) {
            console.error(`Error deleting setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get data retention period in days
     * Default: 30 days if not configured
     */
    async getDataRetentionDays(): Promise<number> {
        const value = await this.getSetting<number>(EPlatformSettingKey.DATA_RETENTION_DAYS);
        return value !== null ? value : 30; // Default 30 days
    }

    /**
     * Set data retention period in days
     */
    async setDataRetentionDays(days: number): Promise<void> {
        if (days < 1 || days > 365) {
            throw new Error('Data retention period must be between 1 and 365 days');
        }
        
        await this.setSetting({
            setting_key: EPlatformSettingKey.DATA_RETENTION_DAYS,
            setting_value: days.toString(),
            setting_type: ESettingType.NUMBER,
            description: 'Number of days to retain user data after account cancellation',
            category: ESettingCategory.RETENTION,
            is_editable: true
        });
    }

    /**
     * Check if auto-deletion is enabled
     */
    async isAutoDeleteEnabled(): Promise<boolean> {
        const value = await this.getSetting<boolean>(EPlatformSettingKey.AUTO_DELETE_ENABLED);
        return value !== null ? value : true; // Default enabled
    }

    /**
     * Parse setting value based on its type
     */
    private parseSettingValue<T>(value: string, type: string): T {
        switch (type) {
            case ESettingType.NUMBER:
                return Number(value) as T;
            case ESettingType.BOOLEAN:
                return (value === 'true' || value === '1') as T;
            case ESettingType.JSON:
                return JSON.parse(value) as T;
            case ESettingType.STRING:
            default:
                return value as T;
        }
    }

    /**
     * Initialize default platform settings (to be called during seeding)
     */
    async initializeDefaults(): Promise<void> {
        const defaults: IPlatformSettingData[] = [
            {
                setting_key: EPlatformSettingKey.DATA_RETENTION_DAYS,
                setting_value: '30',
                setting_type: ESettingType.NUMBER,
                description: 'Number of days to retain user data after account cancellation before permanent deletion',
                category: ESettingCategory.RETENTION,
                is_editable: true
            },
            {
                setting_key: EPlatformSettingKey.AUTO_DELETE_ENABLED,
                setting_value: 'true',
                setting_type: ESettingType.BOOLEAN,
                description: 'Whether to automatically delete user data after retention period expires',
                category: ESettingCategory.RETENTION,
                is_editable: true
            },
            {
                setting_key: EPlatformSettingKey.NOTIFICATION_7_DAYS_ENABLED,
                setting_value: 'true',
                setting_type: ESettingType.BOOLEAN,
                description: 'Send notification 7 days before data deletion',
                category: ESettingCategory.NOTIFICATIONS,
                is_editable: true
            },
            {
                setting_key: EPlatformSettingKey.NOTIFICATION_1_DAY_ENABLED,
                setting_value: 'true',
                setting_type: ESettingType.BOOLEAN,
                description: 'Send notification 1 day before data deletion',
                category: ESettingCategory.NOTIFICATIONS,
                is_editable: true
            },
            {
                setting_key: EPlatformSettingKey.ALLOW_ACCOUNT_REACTIVATION,
                setting_value: 'true',
                setting_type: ESettingType.BOOLEAN,
                description: 'Allow users to reactivate their account during retention period',
                category: ESettingCategory.SECURITY,
                is_editable: true
            }
        ];

        for (const defaultSetting of defaults) {
            // Only create if doesn't exist
            const existing = await this.getSetting(defaultSetting.setting_key);
            if (existing === null) {
                await this.setSetting(defaultSetting);
            }
        }
    }

    /**
     * Get setting record (full entity)
     */
    async getSettingRecord(key: string): Promise<DRAPlatformSettings | null> {
        const repository = await this.getRepository();
        return await repository.findOne({ where: { setting_key: key } });
    }
}
