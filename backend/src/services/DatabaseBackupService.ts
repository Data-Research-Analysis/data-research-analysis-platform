import { UtilityService } from "./UtilityService.js";
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

export interface IBackupMetadata {
    id: string;
    filename: string;
    filepath: string;
    size: number;
    created_at: Date;
    created_by: number;
    database_name: string;
}

export class DatabaseBackupService {
    private static instance: DatabaseBackupService;
    private backupStoragePath: string;

    private constructor() {
        this.backupStoragePath = process.env.BACKUP_STORAGE_PATH || './backend/private/backups';
        this.ensureBackupDirectoryExists();
    }

    public static getInstance(): DatabaseBackupService {
        if (!DatabaseBackupService.instance) {
            DatabaseBackupService.instance = new DatabaseBackupService();
        }
        return DatabaseBackupService.instance;
    }

    private ensureBackupDirectoryExists(): void {
        const dirs = [
            this.backupStoragePath,
            path.join(this.backupStoragePath, 'temp'),
            path.join(this.backupStoragePath, 'sql')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Create a database backup
     * @param userId - ID of the user creating the backup
     * @returns Promise with backup metadata
     */
    public async createBackup(userId: number): Promise<IBackupMetadata> {
        return new Promise<IBackupMetadata>(async (resolve, reject) => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);
                const backupId = `backup_${timestamp}_${userId}`;
                const sqlFileName = `${backupId}.sql`;
                const zipFileName = `${backupId}.zip`;
                const sqlFilePath = path.join(this.backupStoragePath, 'sql', sqlFileName);
                const zipFilePath = path.join(this.backupStoragePath, zipFileName);

                // Get database configuration
                const dbHost = process.env.POSTGRESDB_HOST || 'localhost';
                const dbPort = process.env.POSTGRESDB_LOCAL_PORT || '5432';
                const dbUser = process.env.POSTGRESDB_USER || 'postgres';
                const dbPassword = process.env.POSTGRESDB_ROOT_PASSWORD || 'postgres';
                const dbName = process.env.POSTGRESDB_DATABASE || 'data_research_analysis';

                console.log(`Creating backup for database: ${dbName}`);

                // Execute pg_dump to create SQL backup
                const pgDumpCommand = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p -f "${sqlFilePath}"`;
                
                await execAsync(pgDumpCommand);
                console.log('SQL dump created successfully');

                // Compress SQL file into ZIP
                await this.createZipFile(sqlFilePath, zipFilePath, sqlFileName);
                console.log('ZIP file created successfully');

                // Get file size
                const stats = fs.statSync(zipFilePath);
                const fileSize = stats.size;

                // Delete temporary SQL file
                fs.unlinkSync(sqlFilePath);

                // Create metadata
                const metadata: IBackupMetadata = {
                    id: backupId,
                    filename: zipFileName,
                    filepath: zipFilePath,
                    size: fileSize,
                    created_at: new Date(),
                    created_by: userId,
                    database_name: dbName
                };

                // Save metadata to JSON file
                await this.saveBackupMetadata(metadata);

                console.log('Backup created successfully:', metadata);
                resolve(metadata);
            } catch (error) {
                console.error('Error creating backup:', error);
                reject(error);
            }
        });
    }

    /**
     * Restore database from backup ZIP file
     * @param zipFilePath - Path to the backup ZIP file
     * @param userId - ID of the user restoring the backup
     * @param progressCallback - Optional callback for progress updates
     * @returns Promise<boolean>
     */
    public async restoreFromBackup(
        zipFilePath: string, 
        userId: number, 
        progressCallback?: (progress: number, status: string) => void
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            let extractedSqlPath: string | null = null;

            try {
                // Validate ZIP file
                if (!fs.existsSync(zipFilePath)) {
                    throw new Error('Backup file not found');
                }

                progressCallback?.(5, 'Validating backup file...');

                // Extract SQL from ZIP
                const tempDir = path.join(this.backupStoragePath, 'temp', `restore_${Date.now()}`);
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                progressCallback?.(10, 'Extracting backup file...');
                
                const zip = new AdmZip(zipFilePath);
                zip.extractAllTo(tempDir, true);

                // Find the SQL file
                const files = fs.readdirSync(tempDir);
                const sqlFile = files.find(f => f.endsWith('.sql'));

                if (!sqlFile) {
                    throw new Error('No SQL file found in backup');
                }

                extractedSqlPath = path.join(tempDir, sqlFile);

                progressCallback?.(20, 'Backup extracted successfully');

                // Get database configuration
                const dbHost = process.env.POSTGRESDB_HOST || 'localhost';
                const dbPort = process.env.POSTGRESDB_LOCAL_PORT || '5432';
                const dbUser = process.env.POSTGRESDB_USER || 'postgres';
                const dbPassword = process.env.POSTGRESDB_ROOT_PASSWORD || 'postgres';
                const dbName = process.env.POSTGRESDB_DATABASE || 'data_research_analysis';

                progressCallback?.(30, 'Terminating active connections...');

                // Terminate all connections to the database
                const terminateCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`;
                await execAsync(terminateCommand);

                progressCallback?.(35, 'Dropping existing database...');

                // Drop existing database
                const dropCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`;
                await execAsync(dropCommand);

                progressCallback?.(45, 'Creating new database...');

                // Create new database
                const createCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "CREATE DATABASE ${dbName};"`;
                await execAsync(createCommand);

                progressCallback?.(55, 'Restoring data...');

                // Restore data from SQL file
                const restoreCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${extractedSqlPath}"`;
                await execAsync(restoreCommand);

                progressCallback?.(90, 'Verifying restoration...');

                // Verify restoration
                const verifyCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;
                await execAsync(verifyCommand);

                progressCallback?.(95, 'Cleaning up temporary files...');

                // Cleanup temporary files
                if (extractedSqlPath && fs.existsSync(extractedSqlPath)) {
                    fs.unlinkSync(extractedSqlPath);
                }
                if (fs.existsSync(tempDir)) {
                    fs.rmdirSync(tempDir, { recursive: true });
                }

                progressCallback?.(100, 'Restore completed successfully');

                console.log('Database restored successfully');
                resolve(true);
            } catch (error) {
                console.error('Error restoring database:', error);
                
                // Cleanup on error
                if (extractedSqlPath && fs.existsSync(extractedSqlPath)) {
                    try {
                        fs.unlinkSync(extractedSqlPath);
                    } catch (cleanupError) {
                        console.error('Error cleaning up after restore failure:', cleanupError);
                    }
                }
                
                reject(error);
            }
        });
    }

    /**
     * List all available backups
     * @returns Promise<IBackupMetadata[]>
     */
    public async listBackups(): Promise<IBackupMetadata[]> {
        return new Promise<IBackupMetadata[]>(async (resolve, reject) => {
            try {
                const metadataDir = path.join(this.backupStoragePath, 'metadata');
                
                if (!fs.existsSync(metadataDir)) {
                    fs.mkdirSync(metadataDir, { recursive: true });
                    resolve([]);
                    return;
                }

                const files = fs.readdirSync(metadataDir);
                const metadataFiles = files.filter(f => f.endsWith('.json'));

                const backups: IBackupMetadata[] = [];

                for (const file of metadataFiles) {
                    const filePath = path.join(metadataDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const metadata: IBackupMetadata = JSON.parse(content);
                    
                    // Check if backup file still exists
                    if (fs.existsSync(metadata.filepath)) {
                        backups.push(metadata);
                    }
                }

                // Sort by date (newest first)
                backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                resolve(backups);
            } catch (error) {
                console.error('Error listing backups:', error);
                reject(error);
            }
        });
    }

    /**
     * Get a specific backup by ID
     * @param backupId - ID of the backup
     * @returns Promise<IBackupMetadata | null>
     */
    public async getBackup(backupId: string): Promise<IBackupMetadata | null> {
        return new Promise<IBackupMetadata | null>(async (resolve, reject) => {
            try {
                const metadataPath = path.join(this.backupStoragePath, 'metadata', `${backupId}.json`);
                
                if (!fs.existsSync(metadataPath)) {
                    resolve(null);
                    return;
                }

                const content = fs.readFileSync(metadataPath, 'utf-8');
                const metadata: IBackupMetadata = JSON.parse(content);

                // Check if backup file still exists
                if (!fs.existsSync(metadata.filepath)) {
                    resolve(null);
                    return;
                }

                resolve(metadata);
            } catch (error) {
                console.error('Error getting backup:', error);
                reject(error);
            }
        });
    }

    /**
     * Delete a backup
     * @param backupId - ID of the backup to delete
     * @returns Promise<boolean>
     */
    public async deleteBackup(backupId: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const metadata = await this.getBackup(backupId);

                if (!metadata) {
                    resolve(false);
                    return;
                }

                // Delete backup file
                if (fs.existsSync(metadata.filepath)) {
                    fs.unlinkSync(metadata.filepath);
                }

                // Delete metadata file
                const metadataPath = path.join(this.backupStoragePath, 'metadata', `${backupId}.json`);
                if (fs.existsSync(metadataPath)) {
                    fs.unlinkSync(metadataPath);
                }

                console.log('Backup deleted successfully:', backupId);
                resolve(true);
            } catch (error) {
                console.error('Error deleting backup:', error);
                reject(error);
            }
        });
    }

    /**
     * Validate a backup file
     * @param zipFilePath - Path to the ZIP file
     * @returns Promise<boolean>
     */
    public async validateBackupFile(zipFilePath: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                if (!fs.existsSync(zipFilePath)) {
                    resolve(false);
                    return;
                }

                // Check file size
                const stats = fs.statSync(zipFilePath);
                const maxSize = (parseInt(process.env.BACKUP_MAX_SIZE_MB || '500')) * 1024 * 1024;

                if (stats.size > maxSize) {
                    console.error('Backup file exceeds maximum size');
                    resolve(false);
                    return;
                }

                // Validate ZIP structure
                try {
                    const zip = new AdmZip(zipFilePath);
                    const entries = zip.getEntries();

                    // Check if ZIP contains at least one SQL file
                    const hasSqlFile = entries.some(entry => entry.entryName.endsWith('.sql'));

                    if (!hasSqlFile) {
                        console.error('Backup does not contain a SQL file');
                        resolve(false);
                        return;
                    }

                    resolve(true);
                } catch (zipError) {
                    console.error('Invalid ZIP file:', zipError);
                    resolve(false);
                }
            } catch (error) {
                console.error('Error validating backup file:', error);
                reject(error);
            }
        });
    }

    /**
     * Create a ZIP file from a SQL file
     * @param sqlFilePath - Path to the SQL file
     * @param zipFilePath - Path for the output ZIP file
     * @param sqlFileName - Name of the SQL file in the archive
     * @returns Promise<void>
     */
    private async createZipFile(sqlFilePath: string, zipFilePath: string, sqlFileName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', {
                zlib: { level: 6 } // Balanced compression
            });

            output.on('close', () => {
                console.log(`ZIP file created: ${archive.pointer()} bytes`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);
            archive.file(sqlFilePath, { name: sqlFileName });
            archive.finalize();
        });
    }

    /**
     * Save backup metadata to JSON file
     * @param metadata - Backup metadata
     * @returns Promise<void>
     */
    private async saveBackupMetadata(metadata: IBackupMetadata): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                const metadataDir = path.join(this.backupStoragePath, 'metadata');
                
                if (!fs.existsSync(metadataDir)) {
                    fs.mkdirSync(metadataDir, { recursive: true });
                }

                const metadataPath = path.join(metadataDir, `${metadata.id}.json`);
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clean up old backups based on retention policy
     * @returns Promise<number> - Number of backups deleted
     */
    public async cleanupOldBackups(): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
                const autoCleanup = process.env.BACKUP_AUTO_CLEANUP === 'true';

                if (!autoCleanup) {
                    resolve(0);
                    return;
                }

                const backups = await this.listBackups();
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

                let deletedCount = 0;

                for (const backup of backups) {
                    if (new Date(backup.created_at) < cutoffDate) {
                        await this.deleteBackup(backup.id);
                        deletedCount++;
                    }
                }

                console.log(`Cleaned up ${deletedCount} old backups`);
                resolve(deletedCount);
            } catch (error) {
                console.error('Error cleaning up old backups:', error);
                reject(error);
            }
        });
    }
}
