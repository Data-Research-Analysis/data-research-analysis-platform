import crypto from 'crypto';
import { EntityManager } from 'typeorm';
import { DRATableMetadata } from '../models/DRATableMetadata.js';

/**
 * Service for managing table metadata mappings
 * Provides short, hash-based physical table names while preserving logical names
 */
export class TableMetadataService {
    private static instance: TableMetadataService;

    private constructor() {}

    public static getInstance(): TableMetadataService {
        if (!TableMetadataService.instance) {
            TableMetadataService.instance = new TableMetadataService();
        }
        return TableMetadataService.instance;
    }

    /**
     * Generate a short, deterministic physical table name using hash
     * Format: {prefix}{dataSourceId}_{hash8}
     * Example: ds23_a7b3c9d1 (13 characters, well under 63-char limit)
     * 
     * @param dataSourceId - ID of the data source
     * @param logicalName - Human-readable table name
     * @param fileId - Optional file ID for uniqueness
     * @returns Short physical table name (max 20 chars)
     */
    public generatePhysicalTableName(
        dataSourceId: number,
        logicalName: string,
        fileId?: string
    ): string {
        // Create hash input from logical name and optional file ID
        const hashInput = fileId 
            ? `${dataSourceId}_${fileId}_${logicalName}`
            : `${dataSourceId}_${logicalName}`;

        // Generate 8-character hash (MD5 truncated)
        const hash = crypto
            .createHash('md5')
            .update(hashInput)
            .digest('hex')
            .substring(0, 8);

        // Format: ds{id}_{hash}
        // Example: ds23_a7b3c9d1 (13 chars max for dataSourceId < 10000)
        return `ds${dataSourceId}_${hash}`;
    }

    /**
     * Store table metadata mapping
     * 
     * @param manager - TypeORM EntityManager
     * @param params - Metadata parameters
     * @returns Created metadata record
     */
    public async storeTableMetadata(
        manager: EntityManager,
        params: {
            dataSourceId: number;
            usersPlatformId: number;
            schemaName: string;
            physicalTableName: string;
            logicalTableName: string;
            originalSheetName?: string;
            fileId?: string;
            tableType?: string;
        }
    ): Promise<DRATableMetadata> {
        // Check if metadata already exists
        let metadata = await manager.findOne(DRATableMetadata, {
            where: {
                schema_name: params.schemaName,
                physical_table_name: params.physicalTableName
            }
        });

        if (metadata) {
            // Update existing record
            metadata.data_source_id = params.dataSourceId;
            metadata.users_platform_id = params.usersPlatformId;
            metadata.logical_table_name = params.logicalTableName;
            metadata.original_sheet_name = params.originalSheetName;
            metadata.file_id = params.fileId;
            metadata.table_type = params.tableType;
        } else {
            // Create new record
            metadata = new DRATableMetadata();
            metadata.data_source_id = params.dataSourceId;
            metadata.users_platform_id = params.usersPlatformId;
            metadata.schema_name = params.schemaName;
            metadata.physical_table_name = params.physicalTableName;
            metadata.logical_table_name = params.logicalTableName;
            metadata.original_sheet_name = params.originalSheetName;
            metadata.file_id = params.fileId;
            metadata.table_type = params.tableType;
        }

        return await manager.save(metadata);
    }

    /**
     * Get table metadata by physical name
     * 
     * @param manager - TypeORM EntityManager
     * @param schemaName - Database schema name
     * @param physicalTableName - Physical table name in database
     * @returns Metadata record or null
     */
    public async getTableMetadata(
        manager: EntityManager,
        schemaName: string,
        physicalTableName: string
    ): Promise<DRATableMetadata | null> {
        return await manager.findOne(DRATableMetadata, {
            where: {
                schema_name: schemaName,
                physical_table_name: physicalTableName
            }
        });
    }

    /**
     * Get all table metadata for a data source
     * 
     * @param manager - TypeORM EntityManager
     * @param dataSourceId - Data source ID
     * @returns Array of metadata records
     */
    public async getDataSourceTableMetadata(
        manager: EntityManager,
        dataSourceId: number
    ): Promise<DRATableMetadata[]> {
        return await manager.find(DRATableMetadata, {
            where: {
                data_source_id: dataSourceId
            },
            order: {
                logical_table_name: 'ASC'
            }
        });
    }

    /**
     * Get physical table name from logical name
     * 
     * @param manager - TypeORM EntityManager
     * @param dataSourceId - Data source ID
     * @param logicalName - Logical table name
     * @returns Physical table name or null
     */
    public async getPhysicalTableName(
        manager: EntityManager,
        dataSourceId: number,
        logicalName: string
    ): Promise<string | null> {
        const metadata = await manager.findOne(DRATableMetadata, {
            where: {
                data_source_id: dataSourceId,
                logical_table_name: logicalName
            }
        });

        return metadata?.physical_table_name || null;
    }

    /**
     * Get logical table name from physical name
     * 
     * @param manager - TypeORM EntityManager
     * @param schemaName - Schema name
     * @param physicalName - Physical table name
     * @returns Logical table name or null
     */
    public async getLogicalTableName(
        manager: EntityManager,
        schemaName: string,
        physicalName: string
    ): Promise<string | null> {
        const metadata = await this.getTableMetadata(manager, schemaName, physicalName);
        return metadata?.logical_table_name || null;
    }

    /**
     * Delete table metadata
     * 
     * @param manager - TypeORM EntityManager
     * @param schemaName - Schema name
     * @param physicalTableName - Physical table name
     */
    public async deleteTableMetadata(
        manager: EntityManager,
        schemaName: string,
        physicalTableName: string
    ): Promise<void> {
        await manager.delete(DRATableMetadata, {
            schema_name: schemaName,
            physical_table_name: physicalTableName
        });
    }
}
