import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, ValueTransformer } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataModel } from './DRADataModel.js';
import { DRAProject } from './DRAProject.js';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';
import { DRADataModelSource } from './DRADataModelSource.js';
import { DRATableMetadata } from './DRATableMetadata.js';
import { DRAMongoDBSyncHistory } from './DRAMongoDBSyncHistory.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { IDBConnectionDetails, IConnectionDetails } from '../types/IDBConnectionDetails.js';
import { EncryptionService } from '../services/EncryptionService.js';

/**
 * TypeORM transformer for automatic encryption/decryption of connection details
 * Provides transparent encryption when saving and decryption when loading
 * Handles both encrypted and legacy unencrypted data for backward compatibility
 */
const connectionDetailsTransformer: ValueTransformer = {
    /**
     * Transform data TO database (encrypt on save)
     * @param value - Connection details object to encrypt
     * @returns Encrypted string for database storage
     */
    to(value: IDBConnectionDetails | null | undefined): any {
        if (!value) {
            return null;
        }

        const encryptionService = EncryptionService.getInstance();
        
        // Only encrypt if encryption is enabled
        if (process.env.ENCRYPTION_ENABLED !== 'false') {
            try {
                return encryptionService.encrypt(value);
            } catch (error) {
                throw error;
            }
        }

        // If encryption disabled, store as plain JSON
        return value;
    },

    /**
     * Transform data FROM database (decrypt on load)
     * @param value - Encrypted string or plain object from database
     * @returns Decrypted connection details object
     */
    from(value: any): IDBConnectionDetails | null {
        if (!value) {
            return null;
        }

        const encryptionService = EncryptionService.getInstance();

        // Check if data is encrypted
        if (encryptionService.isEncrypted(value)) {
            try {
                return encryptionService.decrypt(value);
            } catch (error) {
                throw error;
            }
        }

        // Handle legacy unencrypted data (backward compatibility)
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value as any;
            }
        }

        // Already an object (unencrypted legacy data)
        return value;
    }
};
@Entity('dra_data_sources')
export class DRADataSource {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'enum', enum: [EDataSourceType.POSTGRESQL, EDataSourceType.MYSQL, EDataSourceType.MARIADB, EDataSourceType.MONGODB, EDataSourceType.CSV, EDataSourceType.EXCEL, EDataSourceType.PDF, EDataSourceType.GOOGLE_ANALYTICS, EDataSourceType.GOOGLE_AD_MANAGER, EDataSourceType.GOOGLE_ADS] })
    data_type!: EDataSourceType;
    @Column({ type: 'jsonb', transformer: connectionDetailsTransformer })
    connection_details!: IConnectionDetails
    
    /**
     * MongoDB connection string (e.g., mongodb+srv://...)
     * Used as alternative to individual connection fields in connection_details
     * Automatically encrypted via string-specific transformer
     */
    @Column({ type: 'text', nullable: true, transformer: {
        to(value: string | null | undefined): any {
            if (!value) return null;
            const encryptionService = EncryptionService.getInstance();
            if (process.env.ENCRYPTION_ENABLED !== 'false') {
                try {
                    return encryptionService.encryptString(value);
                } catch (error) {
                    throw error;
                }
            }
            return value;
        },
        from(value: any): string | null {
            if (!value) return null;
            const encryptionService = EncryptionService.getInstance();
            if (encryptionService.isEncrypted(value)) {
                try {
                    return encryptionService.decryptString(value);
                } catch (error) {
                    throw error;
                }
            }
            return value;
        }
    }})
    connection_string?: string | null;
    
    @Column({ type: 'timestamp', nullable: true })
    created_at!: Date
    
    // Sync schedule configuration
    @Column({ type: 'varchar', length: 20, default: 'manual' })
    sync_schedule!: string
    
    @Column({ type: 'time', nullable: true })
    sync_schedule_time!: string | null
    
    @Column({ type: 'boolean', default: true })
    sync_enabled!: boolean
    
    @Column({ type: 'timestamp', nullable: true })
    next_scheduled_sync!: Date | null

    // MongoDB sync tracking fields
    @Column({ type: 'varchar', length: 50, nullable: true })
    sync_status!: string | null; // 'pending' | 'in_progress' | 'completed' | 'failed'

    @Column({ type: 'timestamp', nullable: true })
    last_sync_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    sync_error_message!: string | null;

    @Column({ type: 'integer', default: 0 })
    total_records_synced!: number;

    @Column({ type: 'jsonb', nullable: true })
    sync_config!: Record<string, any> | null; // Sync configuration: schedule, batch size, incremental settings

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_sources)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @OneToMany(() => DRADataModel, (dataModel) => dataModel.data_source, { cascade: ["remove", "update"] })
    data_models!: Relation<DRADataModel>[]
    
    @OneToMany(() => DRADataModelSource, (source) => source.data_source)
    data_model_sources!: Relation<DRADataModelSource>[]
    
    @OneToMany(() => DRAAIDataModelConversation, (conversation) => conversation.data_source)
    ai_conversations!: Relation<DRAAIDataModelConversation>[];
    
    @ManyToOne(() => DRAProject, (project) => project.data_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject>
    
    @OneToMany(() => DRATableMetadata, (metadata) => metadata.data_source, { cascade: ["remove", "update"] })
    table_metadata!: Relation<DRATableMetadata>[];
    
    @OneToMany(() => DRAMongoDBSyncHistory, (history) => history.dataSource, { cascade: ["remove"] })
    sync_history!: Relation<DRAMongoDBSyncHistory>[];
    
}