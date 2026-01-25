import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRAPlatformSettings, EPlatformSettingKey, ESettingCategory, ESettingType } from "../models/DRAPlatformSettings.js";

/**
 * PlatformSettingsSeeder - Initialize default platform settings
 * 
 * Initializes default settings for:
 * - Data retention period (30 days default)
 * - Auto-deletion enabled
 * - Notification preferences
 * - Account reactivation permissions
 * 
 * Run after database migration: 1737849600000-CreateAccountCancellationSystem.ts
 */
export class PlatformSettingsSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running PlatformSettingsSeeder');

        try {
            const settingsRepository = dataSource.getRepository(DRAPlatformSettings);
            
            console.log('  Initializing default platform settings...');
            
            // Define default settings
            const defaultSettings = [
                {
                    setting_key: EPlatformSettingKey.DATA_RETENTION_DAYS,
                    setting_value: '30',
                    setting_type: ESettingType.NUMBER,
                    category: ESettingCategory.RETENTION,
                    description: 'Number of days to retain user data after account cancellation (1-365)',
                    is_editable: true
                },
                {
                    setting_key: EPlatformSettingKey.AUTO_DELETE_ENABLED,
                    setting_value: 'true',
                    setting_type: ESettingType.BOOLEAN,
                    category: ESettingCategory.RETENTION,
                    description: 'Automatically delete user data after retention period',
                    is_editable: true
                },
                {
                    setting_key: EPlatformSettingKey.SEND_CANCELLATION_EMAIL,
                    setting_value: 'true',
                    setting_type: ESettingType.BOOLEAN,
                    category: ESettingCategory.NOTIFICATIONS,
                    description: 'Send email notification when account cancellation is requested',
                    is_editable: true
                },
                {
                    setting_key: EPlatformSettingKey.SEND_REMINDER_EMAILS,
                    setting_value: 'true',
                    setting_type: ESettingType.BOOLEAN,
                    category: ESettingCategory.NOTIFICATIONS,
                    description: 'Send reminder emails before account deletion',
                    is_editable: true
                },
                {
                    setting_key: EPlatformSettingKey.ALLOW_REACTIVATION,
                    setting_value: 'true',
                    setting_type: ESettingType.BOOLEAN,
                    category: ESettingCategory.SECURITY,
                    description: 'Allow users to reactivate cancelled accounts before deletion',
                    is_editable: true
                }
            ];
            
            // Insert or update settings
            for (const setting of defaultSettings) {
                const exists = await settingsRepository.findOne({
                    where: { setting_key: setting.setting_key }
                });
                
                if (!exists) {
                    const newSetting = settingsRepository.create(setting);
                    await settingsRepository.save(newSetting);
                    console.log(`  ✅ Created setting: ${setting.setting_key} = ${setting.setting_value}`);
                } else {
                    console.log(`  ⏭️  Setting already exists: ${setting.setting_key}`);
                }
            }
            
            console.log(`  ✅ All platform settings initialized successfully`);
            
        } catch (error) {
            console.error('  ❌ Error initializing platform settings:', error);
            throw error;
        }
    }
}
