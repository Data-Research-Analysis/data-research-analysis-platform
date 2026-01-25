import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DRANotification } from "../models/DRANotification.js";
import { DRAUserSubscription } from "../models/DRAUserSubscription.js";
import { FilesService } from "./FilesService.js";
import { getRedisClient } from "../config/redis.config.js";
import { GoogleOAuthService } from "./GoogleOAuthService.js";
import { EmailService } from "./EmailService.js";
import { Repository, DataSource as TypeORMDataSource, EntityManager } from "typeorm";
import fs from 'fs/promises';
import path from 'path';

/**
 * DataDeletionService - Orchestrates complete deletion of user data
 * Handles cascade deletion, OAuth revocation, file cleanup, and user anonymization
 */
export class DataDeletionService {
    private static instance: DataDeletionService;
    
    private constructor() {}
    
    public static getInstance(): DataDeletionService {
        if (!DataDeletionService.instance) {
            DataDeletionService.instance = new DataDeletionService();
        }
        return DataDeletionService.instance;
    }

    /**
     * Get TypeORM DataSource
     */
    private async getDataSource(): Promise<TypeORMDataSource> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }
        return concreteDriver.manager.connection;
    }

    /**
     * Delete all data for a user (main entry point)
     * Uses database transaction for atomicity
     */
    async deleteUserData(userId: number): Promise<void> {
        const dataSource = await this.getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let userEmail = '';
        let userName = '';

        try {
            console.log(`[DataDeletion] Starting deletion for user ${userId}`);

            // Get user info before deletion for email
            const user = await queryRunner.manager.findOne(DRAUsersPlatform, { where: { id: userId } });
            if (user) {
                userEmail = user.email;
                userName = `${user.first_name} ${user.last_name}`;
            }

            // 1. Revoke OAuth tokens BEFORE deleting data sources (need credentials)
            await this.revokeOAuthTokens(userId, queryRunner.manager);

            // 2. Delete uploaded files from filesystem
            await this.deleteUploadedFiles(userId, queryRunner.manager);

            // 3. Delete dashboard exports
            await this.deleteDashboardExports(userId, queryRunner.manager);

            // 4. Delete projects (CASCADE will handle data sources, data models, dashboards via FK)
            await this.deleteProjects(userId, queryRunner.manager);

            // 5. Delete notifications
            await this.deleteNotifications(userId, queryRunner.manager);

            // 6. Delete user subscriptions
            await this.deleteUserSubscriptions(userId, queryRunner.manager);

            // 7. Delete OAuth sessions from Redis
            await this.deleteOAuthSessions(userId);

            // 8. Anonymize user record (keep for billing history)
            await this.anonymizeUserRecord(userId, queryRunner.manager);

            await queryRunner.commitTransaction();
            console.log(`[DataDeletion] Successfully deleted all data for user ${userId}`);

            // 9. Send deletion confirmation email AFTER successful commit
            if (userEmail && userName) {
                try {
                    const emailService = EmailService.getInstance();
                    await emailService.sendAccountDataDeleted(
                        userEmail,
                        userName,
                        new Date()
                    );
                    console.log(`[DataDeletion] Deletion confirmation email sent to ${userEmail}`);
                } catch (emailError) {
                    console.error('[DataDeletion] Failed to send deletion confirmation email:', emailError);
                    // Don't throw - email failure after successful deletion shouldn't cause error
                }
            }

        } catch (error) {
            await queryRunner.rollbackTransaction();
            console.error(`[DataDeletion] Error deleting data for user ${userId}:`, error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Delete all expired accounts (called by scheduled job)
     */
    async deleteAllExpiredAccounts(): Promise<number> {
        const dataSource = await this.getDataSource();
        const now = new Date();
        
        // Get all cancellations ready for deletion
        const cancellationsToDelete = await dataSource
            .getRepository('DRAAccountCancellation')
            .createQueryBuilder('cancellation')
            .leftJoinAndSelect('cancellation.users_platform', 'user')
            .where('cancellation.status = :status', { status: 'active' })
            .andWhere('cancellation.deletion_scheduled_at <= :now', { now })
            .andWhere('cancellation.data_deleted_at IS NULL')
            .getMany();

        console.log(`[DataDeletion] Found ${cancellationsToDelete.length} accounts to delete`);

        let deletedCount = 0;

        for (const cancellation of cancellationsToDelete) {
            try {
                await this.deleteUserData(cancellation.users_platform.id);
                deletedCount++;
            } catch (error) {
                console.error(`[DataDeletion] Failed to delete user ${cancellation.users_platform.id}:`, error);
                // Continue with other deletions even if one fails
            }
        }

        return deletedCount;
    }

    /**
     * Revoke OAuth tokens for third-party services
     */
    private async revokeOAuthTokens(userId: number, manager: any): Promise<void> {
        try {
            const dataSourceRepo = manager.getRepository(DRADataSource);
            const dataSources = await dataSourceRepo.find({
                where: { users_platform: { id: userId } }
            });

            const googleOAuthService = GoogleOAuthService.getInstance();

            for (const dataSource of dataSources) {
                try {
                    // Check if data source uses OAuth (Google Analytics, Google Ads, Google Ad Manager)
                    if (dataSource.connection_details?.refreshToken) {
                        // Revoke the refresh token with Google
                        await googleOAuthService.revokeToken(dataSource.connection_details.refreshToken);
                        console.log(`[DataDeletion] Revoked OAuth token for data source ${dataSource.id}`);
                    }
                } catch (error) {
                    console.error(`[DataDeletion] Error revoking OAuth for data source ${dataSource.id}:`, error);
                    // Continue with other data sources
                }
            }
        } catch (error) {
            console.error('[DataDeletion] Error in revokeOAuthTokens:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Delete uploaded files (PDFs, Excel, CSV) from filesystem
     */
    private async deleteUploadedFiles(userId: number, manager: any): Promise<void> {
        try {
            const filesService = FilesService.getInstance();
            const dataSourceRepo = manager.getRepository(DRADataSource);
            
            const dataSources = await dataSourceRepo.find({
                where: { users_platform: { id: userId } }
            });

            for (const dataSource of dataSources) {
                try {
                    // Check if data source has uploaded files
                    if (dataSource.file_id) {
                        const filePath = path.join(process.cwd(), 'private', 'uploads', dataSource.file_id);
                        
                        try {
                            await fs.access(filePath);
                            await fs.unlink(filePath);
                            console.log(`[DataDeletion] Deleted file: ${dataSource.file_id}`);
                        } catch (fileError) {
                            // File doesn't exist or already deleted
                            console.log(`[DataDeletion] File not found or already deleted: ${dataSource.file_id}`);
                        }
                    }
                } catch (error) {
                    console.error(`[DataDeletion] Error deleting file for data source ${dataSource.id}:`, error);
                    // Continue with other files
                }
            }
        } catch (error) {
            console.error('[DataDeletion] Error in deleteUploadedFiles:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Delete dashboard exports from filesystem
     */
    private async deleteDashboardExports(userId: number, manager: any): Promise<void> {
        try {
            const dashboardRepo = manager.getRepository(DRADashboard);
            const dashboards = await dashboardRepo.find({
                where: { users_platform: { id: userId } },
                relations: ['export_meta_data']
            });

            for (const dashboard of dashboards) {
                if (dashboard.export_meta_data && dashboard.export_meta_data.length > 0) {
                    for (const exportMeta of dashboard.export_meta_data) {
                        try {
                            const exportPath = path.join(process.cwd(), 'exports', exportMeta.file_name);
                            
                            try {
                                await fs.access(exportPath);
                                await fs.unlink(exportPath);
                                console.log(`[DataDeletion] Deleted export file: ${exportMeta.file_name}`);
                            } catch (fileError) {
                                console.log(`[DataDeletion] Export file not found: ${exportMeta.file_name}`);
                            }
                        } catch (error) {
                            console.error(`[DataDeletion] Error deleting export file ${exportMeta.file_name}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[DataDeletion] Error in deleteDashboardExports:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Delete all projects for user
     * CASCADE will automatically delete:
     * - Data sources (via FK: project_id)
     * - Data models (via FK: data_source_id)
     * - Dashboards (via FK: project_id)
     * - Project members (via FK: project_id)
     */
    private async deleteProjects(userId: number, manager: any): Promise<void> {
        try {
            const projectRepo = manager.getRepository(DRAProject);
            
            // Get all projects owned by user
            const projects = await projectRepo.find({
                where: { users_platform: { id: userId } }
            });

            console.log(`[DataDeletion] Deleting ${projects.length} projects for user ${userId}`);

            // Delete all projects (CASCADE will handle related entities)
            for (const project of projects) {
                await projectRepo.remove(project);
            }

            console.log(`[DataDeletion] Successfully deleted all projects for user ${userId}`);
        } catch (error) {
            console.error('[DataDeletion] Error in deleteProjects:', error);
            throw error; // Critical error, should fail transaction
        }
    }

    /**
     * Delete all notifications for user
     */
    private async deleteNotifications(userId: number, manager: any): Promise<void> {
        try {
            const notificationRepo = manager.getRepository(DRANotification);
            await notificationRepo.delete({ users_platform: { id: userId } });
            console.log(`[DataDeletion] Deleted notifications for user ${userId}`);
        } catch (error) {
            console.error('[DataDeletion] Error in deleteNotifications:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Delete user subscription records
     */
    private async deleteUserSubscriptions(userId: number, manager: any): Promise<void> {
        try {
            const subscriptionRepo = manager.getRepository(DRAUserSubscription);
            await subscriptionRepo.delete({ users_platform: { id: userId } });
            console.log(`[DataDeletion] Deleted subscriptions for user ${userId}`);
        } catch (error) {
            console.error('[DataDeletion] Error in deleteUserSubscriptions:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Delete OAuth sessions from Redis
     */
    private async deleteOAuthSessions(userId: number): Promise<void> {
        try {
            const redis = getRedisClient();
            
            // Find and delete all OAuth session keys for this user
            const pattern = `oauth_session:*:user:${userId}:*`;
            const keys = await redis.keys(pattern);
            
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`[DataDeletion] Deleted ${keys.length} OAuth sessions from Redis for user ${userId}`);
            }
        } catch (error) {
            console.error('[DataDeletion] Error in deleteOAuthSessions:', error);
            // Non-critical error, continue deletion
        }
    }

    /**
     * Anonymize user record
     * Keep the record for billing history but remove PII
     */
    private async anonymizeUserRecord(userId: number, manager: any): Promise<void> {
        try {
            const userRepo = manager.getRepository(DRAUsersPlatform);
            const user = await userRepo.findOne({ where: { id: userId } });
            
            if (user) {
                // Anonymize personal information
                user.first_name = 'DELETED';
                user.last_name = 'USER';
                user.email = `deleted_user_${userId}@dataresearchanalysis.local`;
                user.password = 'DELETED_ACCOUNT'; // Make password invalid
                user.phone_number = null;
                
                // Keep user_type and created_at for billing/legal records
                // Mark as deleted by setting a flag (if you add an is_deleted column in future)
                
                await userRepo.save(user);
                console.log(`[DataDeletion] Anonymized user record ${userId}`);
            }
        } catch (error) {
            console.error('[DataDeletion] Error in anonymizeUserRecord:', error);
            throw error; // Critical error, should fail transaction
        }
    }

    /**
     * Estimate storage size to be deleted (for reporting)
     */
    async estimateUserDataSize(userId: number): Promise<{ 
        projects: number, 
        dataSources: number, 
        dataModels: number, 
        dashboards: number,
        estimatedSizeMB: number 
    }> {
        try {
            const dataSource = await this.getDataSource();
            
            const [projects, dataSources, dataModels, dashboards] = await Promise.all([
                dataSource.getRepository(DRAProject).count({ where: { users_platform: { id: userId } } }),
                dataSource.getRepository(DRADataSource).count({ where: { users_platform: { id: userId } } }),
                dataSource.getRepository(DRADataModel).count({ where: { users_platform: { id: userId } } }),
                dataSource.getRepository(DRADashboard).count({ where: { users_platform: { id: userId } } })
            ]);

            // Rough estimate: 1MB per project, 5MB per data source, 2MB per data model, 1MB per dashboard
            const estimatedSizeMB = (projects * 1) + (dataSources * 5) + (dataModels * 2) + (dashboards * 1);

            return {
                projects,
                dataSources,
                dataModels,
                dashboards,
                estimatedSizeMB
            };
        } catch (error) {
            console.error('[DataDeletion] Error estimating user data size:', error);
            throw error;
        }
    }
}
