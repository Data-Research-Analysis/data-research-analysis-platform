import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAAccountCancellation, ECancellationStatus, ECancellationReasonCategory } from "../models/DRAAccountCancellation.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { Repository } from "typeorm";
import { PlatformSettingsProcessor } from "./PlatformSettingsProcessor.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { NotificationProcessor } from "./NotificationProcessor.js";
import { EmailService } from "../services/EmailService.js";
import { NotificationType } from "../types/NotificationTypes.js";

/**
 * Interface for cancellation request data
 */
export interface ICancellationRequest {
    userId: number;
    reason?: string | null;
    reasonCategory?: ECancellationReasonCategory | null;
    effectiveDate?: Date | null; // Optional: defaults to end of billing period
}

/**
 * Interface for cancellation statistics
 */
export interface ICancellationStats {
    totalCancellations: number;
    pendingCancellations: number;
    activeCancellations: number;
    deletedAccounts: number;
    reactivatedAccounts: number;
    byReasonCategory: Record<string, number>;
    averageRetentionDays: number;
}

/**
 * AccountCancellationProcessor - Manages account cancellation lifecycle
 * Handles cancellation requests, retention period tracking, and reactivation
 */
export class AccountCancellationProcessor {
    private static instance: AccountCancellationProcessor;
    private notificationHelper: NotificationHelperService;
    private notificationProcessor: NotificationProcessor;
    private emailService: EmailService;
    
    private constructor() {
        this.notificationHelper = NotificationHelperService.getInstance();
        this.notificationProcessor = NotificationProcessor.getInstance();
        this.emailService = EmailService.getInstance();
    }
    
    public static getInstance(): AccountCancellationProcessor {
        if (!AccountCancellationProcessor.instance) {
            AccountCancellationProcessor.instance = new AccountCancellationProcessor();
        }
        return AccountCancellationProcessor.instance;
    }

    /**
     * Get repository for account cancellations
     */
    private async getRepository(): Promise<Repository<DRAAccountCancellation>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }
        return concreteDriver.manager.getRepository(DRAAccountCancellation);
    }

    /**
     * Get user repository
     */
    private async getUserRepository(): Promise<Repository<DRAUsersPlatform>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }
        return concreteDriver.manager.getRepository(DRAUsersPlatform);
    }

    /**
     * Request account cancellation
     */
    async requestCancellation(data: ICancellationRequest): Promise<DRAAccountCancellation> {
        try {
            const repository = await this.getRepository();
            const userRepository = await this.getUserRepository();
            
            // Check if user exists
            const user = await userRepository.findOne({ where: { id: data.userId } });
            if (!user) {
                throw new Error('User not found');
            }

            // Check if there's already an active cancellation for this user
            const existingCancellation = await repository.findOne({
                where: { 
                    users_platform: { id: data.userId },
                    status: ECancellationStatus.PENDING
                }
            });

            if (existingCancellation) {
                throw new Error('A cancellation request already exists for this account');
            }

            // Get retention period from settings
            const settingsProcessor = PlatformSettingsProcessor.getInstance();
            const retentionDays = await settingsProcessor.getDataRetentionDays();

            // Calculate effective date and deletion schedule
            const effectiveDate = data.effectiveDate || new Date(); // Default to immediate
            const deletionScheduledAt = new Date(effectiveDate);
            deletionScheduledAt.setDate(deletionScheduledAt.getDate() + retentionDays);

            // Create cancellation record
            const cancellation = repository.create({
                users_platform: user,
                cancellation_reason: data.reason || null,
                cancellation_reason_category: data.reasonCategory || null,
                requested_at: new Date(),
                effective_at: effectiveDate,
                deletion_scheduled_at: deletionScheduledAt,
                status: ECancellationStatus.PENDING,
                data_exported: false
            });

            const savedCancellation = await repository.save(cancellation);

            // Send cancellation confirmation notification
            await this.notificationProcessor.createNotification({
                userId: data.userId,
                type: NotificationType.ACCOUNT_CANCELLATION_REQUESTED,
                title: 'Account Cancellation Requested',
                message: `Your account cancellation has been scheduled for ${effectiveDate.toLocaleDateString()}. Your data will be retained until ${deletionScheduledAt.toLocaleDateString()}.`,
                metadata: {
                    cancellationId: savedCancellation.id,
                    effectiveDate: effectiveDate.toISOString(),
                    deletionScheduledAt: deletionScheduledAt.toISOString(),
                    retentionDays: retentionDays
                }
            });

            // Send cancellation confirmation email
            try {
                await this.emailService.sendAccountCancellationRequested(
                    user.email,
                    `${user.first_name} ${user.last_name}`,
                    effectiveDate,
                    deletionScheduledAt,
                    retentionDays
                );
                console.log(`[AccountCancellation] Confirmation email sent to ${user.email}`);
            } catch (emailError) {
                console.error('[AccountCancellation] Failed to send confirmation email:', emailError);
                // Don't throw - email failure shouldn't prevent cancellation
            }

            return savedCancellation;
        } catch (error) {
            console.error('Error requesting account cancellation:', error);
            throw error;
        }
    }

    /**
     * Get cancellation details for a user
     */
    async getUserCancellation(userId: number): Promise<DRAAccountCancellation | null> {
        try {
            const repository = await this.getRepository();
            return await repository.findOne({
                where: { 
                    users_platform: { id: userId },
                    status: ECancellationStatus.PENDING
                },
                relations: ['users_platform']
            });
        } catch (error) {
            console.error('Error retrieving user cancellation:', error);
            throw error;
        }
    }

    /**
     * Reactivate a cancelled account (within retention period)
     */
    async reactivateAccount(userId: number): Promise<DRAAccountCancellation> {
        try {
            const repository = await this.getRepository();
            const userRepository = await this.getUserRepository();
            
            // Find active cancellation with user data
            const cancellation = await repository.findOne({
                where: { 
                    users_platform: { id: userId },
                    status: ECancellationStatus.ACTIVE
                },
                relations: ['users_platform']
            });

            if (!cancellation) {
                throw new Error('No active cancellation found for this user');
            }

            // Check if data has already been deleted
            if (cancellation.data_deleted_at) {
                throw new Error('Account data has already been deleted and cannot be reactivated');
            }

            const user = cancellation.users_platform;

            // Update cancellation status
            cancellation.status = ECancellationStatus.REACTIVATED;
            cancellation.reactivated_at = new Date();
            await repository.save(cancellation);

            // Send reactivation notification
            await this.notificationProcessor.createNotification({
                userId: userId,
                type: NotificationType.ACCOUNT_REACTIVATED,
                title: 'Account Reactivated',
                message: 'Your account has been successfully reactivated. All your data has been preserved.',
                metadata: {
                    cancellationId: cancellation.id,
                    reactivatedAt: cancellation.reactivated_at.toISOString()
                }
            });

            // Send reactivation confirmation email
            try {
                await this.emailService.sendAccountReactivated(
                    user.email,
                    `${user.first_name} ${user.last_name}`
                );
                console.log(`[AccountCancellation] Reactivation email sent to ${user.email}`);
            } catch (emailError) {
                console.error('[AccountCancellation] Failed to send reactivation email:', emailError);
                // Don't throw - email failure shouldn't prevent reactivation
            }

            return cancellation;
        } catch (error) {
            console.error('Error reactivating account:', error);
            throw error;
        }
    }

    /**
     * Mark data as exported
     */
    async markDataExported(userId: number): Promise<void> {
        try {
            const repository = await this.getRepository();
            const cancellation = await repository.findOne({
                where: { 
                    users_platform: { id: userId }
                }
            });

            if (cancellation) {
                cancellation.data_exported = true;
                cancellation.data_export_timestamp = new Date();
                await repository.save(cancellation);
            }
        } catch (error) {
            console.error('Error marking data as exported:', error);
            throw error;
        }
    }

    /**
     * Get all cancellations pending deletion (for scheduled job)
     */
    async getCancellationsPendingDeletion(): Promise<DRAAccountCancellation[]> {
        try {
            const repository = await this.getRepository();
            const now = new Date();
            
            return await repository
                .createQueryBuilder('cancellation')
                .leftJoinAndSelect('cancellation.users_platform', 'user')
                .where('cancellation.status = :status', { status: ECancellationStatus.ACTIVE })
                .andWhere('cancellation.deletion_scheduled_at <= :now', { now })
                .andWhere('cancellation.data_deleted_at IS NULL')
                .getMany();
        } catch (error) {
            console.error('Error retrieving cancellations pending deletion:', error);
            throw error;
        }
    }

    /**
     * Get cancellations requiring notification
     */
    async getCancellationsRequiringNotification(daysBeforeDeletion: number): Promise<DRAAccountCancellation[]> {
        try {
            const repository = await this.getRepository();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + daysBeforeDeletion);
            
            const notificationField = daysBeforeDeletion === 7 
                ? 'notification_7_days_sent' 
                : 'notification_1_day_sent';
            
            return await repository
                .createQueryBuilder('cancellation')
                .leftJoinAndSelect('cancellation.users_platform', 'user')
                .where('cancellation.status = :status', { status: ECancellationStatus.ACTIVE })
                .andWhere(`cancellation.${notificationField} = :sent`, { sent: false })
                .andWhere('cancellation.deletion_scheduled_at <= :targetDate', { targetDate })
                .andWhere('cancellation.data_deleted_at IS NULL')
                .getMany();
        } catch (error) {
            console.error('Error retrieving cancellations requiring notification:', error);
            throw error;
        }
    }

    /**
     * Mark notification as sent
     */
    async markNotificationSent(cancellationId: number, daysBeforeDeletion: number): Promise<void> {
        try {
            const repository = await this.getRepository();
            const cancellation = await repository.findOne({ where: { id: cancellationId } });
            
            if (cancellation) {
                if (daysBeforeDeletion === 7) {
                    cancellation.notification_7_days_sent = true;
                } else if (daysBeforeDeletion === 1) {
                    cancellation.notification_1_day_sent = true;
                }
                await repository.save(cancellation);
            }
        } catch (error) {
            console.error('Error marking notification as sent:', error);
            throw error;
        }
    }

    /**
     * Mark data as deleted (called after DataDeletionService completes)
     */
    async markDataDeleted(cancellationId: number, adminId?: number): Promise<void> {
        try {
            const repository = await this.getRepository();
            const userRepository = await this.getUserRepository();
            
            const cancellation = await repository.findOne({ 
                where: { id: cancellationId },
                relations: ['users_platform']
            });
            
            if (!cancellation) {
                throw new Error('Cancellation record not found');
            }

            cancellation.status = ECancellationStatus.DATA_DELETED;
            cancellation.data_deleted_at = new Date();
            cancellation.notification_deletion_sent = true;
            
            if (adminId) {
                const admin = await userRepository.findOne({ where: { id: adminId } });
                if (admin) {
                    cancellation.deleted_by_admin = admin;
                }
            }

            await repository.save(cancellation);

            // Send deletion confirmation notification
            await this.notificationProcessor.createNotification({
                userId: cancellation.users_platform.id,
                type: NotificationType.ACCOUNT_DATA_DELETED,
                title: 'Account Data Deleted',
                message: 'All data associated with your account has been permanently deleted as requested.',
                metadata: {
                    cancellationId: cancellation.id,
                    deletedAt: cancellation.data_deleted_at.toISOString()
                }
            });
        } catch (error) {
            console.error('Error marking data as deleted:', error);
            throw error;
        }
    }

    /**
     * Get cancellation statistics (for admin dashboard)
     */
    async getCancellationStatistics(): Promise<ICancellationStats> {
        try {
            const repository = await this.getRepository();
            
            const [all, pending, active, deleted, reactivated] = await Promise.all([
                repository.count(),
                repository.count({ where: { status: ECancellationStatus.PENDING } }),
                repository.count({ where: { status: ECancellationStatus.ACTIVE } }),
                repository.count({ where: { status: ECancellationStatus.DATA_DELETED } }),
                repository.count({ where: { status: ECancellationStatus.REACTIVATED } })
            ]);

            // Get breakdown by reason category
            const reasonBreakdown = await repository
                .createQueryBuilder('cancellation')
                .select('cancellation.cancellation_reason_category', 'category')
                .addSelect('COUNT(*)', 'count')
                .where('cancellation.cancellation_reason_category IS NOT NULL')
                .groupBy('cancellation.cancellation_reason_category')
                .getRawMany();

            const byReasonCategory: Record<string, number> = {};
            reasonBreakdown.forEach((item: any) => {
                byReasonCategory[item.category] = parseInt(item.count);
            });

            // Calculate average retention days for completed cancellations
            const completedWithDates = await repository
                .createQueryBuilder('cancellation')
                .select('AVG(EXTRACT(DAY FROM (cancellation.data_deleted_at - cancellation.effective_at)))', 'avgDays')
                .where('cancellation.data_deleted_at IS NOT NULL')
                .andWhere('cancellation.effective_at IS NOT NULL')
                .getRawOne();

            const averageRetentionDays = completedWithDates?.avgDays 
                ? Math.round(parseFloat(completedWithDates.avgDays)) 
                : 0;

            return {
                totalCancellations: all,
                pendingCancellations: pending,
                activeCancellations: active,
                deletedAccounts: deleted,
                reactivatedAccounts: reactivated,
                byReasonCategory,
                averageRetentionDays
            };
        } catch (error) {
            console.error('Error retrieving cancellation statistics:', error);
            throw error;
        }
    }

    /**
     * Get all cancellations (for admin panel with pagination)
     */
    async getAllCancellations(
        page: number = 1, 
        limit: number = 50,
        status?: ECancellationStatus
    ): Promise<{ data: DRAAccountCancellation[], total: number }> {
        try {
            const repository = await this.getRepository();
            const skip = (page - 1) * limit;
            
            const queryBuilder = repository
                .createQueryBuilder('cancellation')
                .leftJoinAndSelect('cancellation.users_platform', 'user')
                .leftJoinAndSelect('cancellation.deleted_by_admin', 'admin')
                .orderBy('cancellation.requested_at', 'DESC')
                .skip(skip)
                .take(limit);

            if (status) {
                queryBuilder.where('cancellation.status = :status', { status });
            }

            const [data, total] = await queryBuilder.getManyAndCount();

            return { data, total };
        } catch (error) {
            console.error('Error retrieving all cancellations:', error);
            throw error;
        }
    }

    /**
     * Update effective date (admin only)
     */
    async updateEffectiveDate(cancellationId: number, newEffectiveDate: Date): Promise<void> {
        try {
            const repository = await this.getRepository();
            const settingsProcessor = PlatformSettingsProcessor.getInstance();
            const retentionDays = await settingsProcessor.getDataRetentionDays();
            
            const cancellation = await repository.findOne({ where: { id: cancellationId } });
            if (!cancellation) {
                throw new Error('Cancellation not found');
            }

            cancellation.effective_at = newEffectiveDate;
            
            // Recalculate deletion date
            const deletionScheduledAt = new Date(newEffectiveDate);
            deletionScheduledAt.setDate(deletionScheduledAt.getDate() + retentionDays);
            cancellation.deletion_scheduled_at = deletionScheduledAt;
            
            await repository.save(cancellation);
        } catch (error) {
            console.error('Error updating effective date:', error);
            throw error;
        }
    }

    /**
     * Add admin notes to cancellation
     */
    async addNotes(cancellationId: number, notes: string): Promise<void> {
        try {
            const repository = await this.getRepository();
            const cancellation = await repository.findOne({ where: { id: cancellationId } });
            
            if (cancellation) {
                cancellation.notes = notes;
                await repository.save(cancellation);
            }
        } catch (error) {
            console.error('Error adding notes to cancellation:', error);
            throw error;
        }
    }

    /**
     * Get active cancellation for a user
     */
    async getActiveCancellation(userId: number): Promise<DRAAccountCancellation | null> {
        try {
            const repository = await this.getRepository();
            return await repository.findOne({
                where: {
                    users_platform: { id: userId },
                    status: ECancellationStatus.ACTIVE
                },
                relations: ['users_platform']
            });
        } catch (error) {
            console.error('Error getting active cancellation:', error);
            throw error;
        }
    }

    /**
     * Get cancellation by ID
     */
    async getCancellationById(cancellationId: number): Promise<DRAAccountCancellation | null> {
        try {
            const repository = await this.getRepository();
            return await repository.findOne({
                where: { id: cancellationId },
                relations: ['users_platform']
            });
        } catch (error) {
            console.error('Error getting cancellation by ID:', error);
            throw error;
        }
    }

    /**
     * Estimate data size for a user before deletion.
     */
    public async estimateUserDataSize(userId: number): Promise<any> {
        const { DataDeletionService } = await import('../services/DataDeletionService.js');
        return DataDeletionService.getInstance().estimateUserDataSize(userId);
    }

    /**
     * Delete all data for a user.
     */
    public async deleteUserData(userId: number): Promise<void> {
        const { DataDeletionService } = await import('../services/DataDeletionService.js');
        return DataDeletionService.getInstance().deleteUserData(userId);
    }

    /**
     * Export a single data model to a file buffer.
     */
    public async exportDataModel(dataModelId: number, options: { format: 'csv' | 'excel' | 'json'; includeMetadata: boolean; maxRows?: number }): Promise<any> {
        const { DataModelExportService } = await import('../services/DataModelExportService.js');
        return DataModelExportService.getInstance().exportDataModel(dataModelId, options);
    }

    /**
     * Export multiple data models to a single Excel workbook.
     */
    public async exportMultipleDataModels(dataModelIds: number[], options: { includeMetadata: boolean; maxRows?: number }): Promise<any> {
        const { DataModelExportService } = await import('../services/DataModelExportService.js');
        return DataModelExportService.getInstance().exportMultipleToExcel(dataModelIds, { format: 'excel', ...options });
    }
}
