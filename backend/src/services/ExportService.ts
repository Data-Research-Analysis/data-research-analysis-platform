import { DataSource } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import { emailService } from './EmailService.js';

/**
 * Export formats supported
 */
export enum ExportFormat {
    CSV = 'csv',
    JSON = 'json',
    XLSX = 'xlsx'
}

/**
 * Export options
 */
export interface ExportOptions {
    format: ExportFormat;
    reportType: string;
    networkCode: string;
    startDate?: string;
    endDate?: string;
    columns?: string[];
    limit?: number;
    includeHeaders?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    recordCount?: number;
    format?: ExportFormat;
    error?: string;
    downloadUrl?: string;
}

/**
 * Export history entry
 */
export interface ExportHistoryEntry {
    id: number;
    dataSourceId: number;
    userId: number;
    reportType: string;
    format: ExportFormat;
    fileName: string;
    filePath: string;
    fileSize: number;
    recordCount: number;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    createdAt: Date;
    completedAt?: Date;
    expiresAt?: Date;
}

/**
 * Service for exporting GAM data to various formats
 */
export class ExportService {
    private static instance: ExportService;
    private exportDir: string;
    
    private constructor() {
        // Set export directory to backend/exports
        this.exportDir = path.join(process.cwd(), 'exports');
        this.ensureExportDirectory();
    }
    
    public static getInstance(): ExportService {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }
    
    /**
     * Ensure export directory exists
     */
    private ensureExportDirectory(): void {
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
            console.log(`✅ Created export directory: ${this.exportDir}`);
        }
    }
    
    /**
     * Export GAM data to specified format
     */
    public async exportData(
        dataSourceId: number,
        options: ExportOptions,
        userId: number,
        userEmail?: string
    ): Promise<ExportResult> {
        try {
            console.log(`📤 Starting export for data source ${dataSourceId}, format: ${options.format}`);
            
            // Get data from database
            const data = await this.fetchDataFromDatabase(options);
            
            if (!data || data.length === 0) {
                return {
                    success: false,
                    error: 'No data found for export'
                };
            }
            
            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const fileName = `gam_${options.reportType}_${options.networkCode}_${timestamp}.${options.format}`;
            const filePath = path.join(this.exportDir, fileName);
            
            // Export based on format
            let fileSize: number;
            switch (options.format) {
                case ExportFormat.CSV:
                    fileSize = await this.exportToCSV(data, filePath, options);
                    break;
                case ExportFormat.JSON:
                    fileSize = await this.exportToJSON(data, filePath);
                    break;
                case ExportFormat.XLSX:
                    fileSize = await this.exportToXLSX(data, filePath, options);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${options.format}`);
            }
            
            // Save export history
            await this.saveExportHistory({
                dataSourceId,
                userId,
                reportType: options.reportType,
                format: options.format,
                fileName,
                filePath,
                fileSize,
                recordCount: data.length,
                status: 'completed'
            });
            
            console.log(`✅ Export completed: ${fileName} (${fileSize} bytes, ${data.length} records)`);
            
            // Send email notification if user email provided
            if (userEmail && emailService.isConfigured()) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
                
                await emailService.sendExportCompleteEmail(userEmail, {
                    reportType: options.reportType,
                    format: options.format,
                    fileName,
                    fileSize,
                    recordCount: data.length,
                    downloadUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/exports/download/${fileName}`,
                    expiresAt: expiresAt.toISOString(),
                });
            }
            
            return {
                success: true,
                filePath,
                fileName,
                fileSize,
                recordCount: data.length,
                format: options.format,
                downloadUrl: `/api/exports/download/${fileName}`
            };
        } catch (error: any) {
            console.error('❌ Export failed:', error);
            
            // Save failed export to history
            await this.saveExportHistory({
                dataSourceId,
                userId,
                reportType: options.reportType,
                format: options.format,
                fileName: 'failed',
                filePath: '',
                fileSize: 0,
                recordCount: 0,
                status: 'failed',
                error: error.message
            });
            
            return {
                success: false,
                error: error.message || 'Export failed'
            };
        }
    }
    
    /**
     * Fetch data from database based on options
     */
    private async fetchDataFromDatabase(options: ExportOptions): Promise<any[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        
        const dbConnector = await driver.getConcreteDriver();
        const schemaName = 'dra_google_ad_manager';
        const tableName = `${options.reportType}_${options.networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Build query
        let query = `SELECT * FROM ${fullTableName}`;
        const params: any[] = [];
        const conditions: string[] = [];
        
        // Add date filters if provided
        if (options.startDate) {
            conditions.push(`date >= $${params.length + 1}`);
            params.push(options.startDate);
        }
        
        if (options.endDate) {
            conditions.push(`date <= $${params.length + 1}`);
            params.push(options.endDate);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY date DESC`;
        
        // Add limit if specified
        if (options.limit) {
            query += ` LIMIT $${params.length + 1}`;
            params.push(options.limit);
        }
        
        const result = await dbConnector.query(query, params);
        
        // Filter columns if specified
        if (options.columns && options.columns.length > 0) {
            return result.map((row: any) => {
                const filteredRow: any = {};
                for (const col of options.columns!) {
                    if (row.hasOwnProperty(col)) {
                        filteredRow[col] = row[col];
                    }
                }
                return filteredRow;
            });
        }
        
        return result;
    }
    
    /**
     * Export data to CSV format
     */
    private async exportToCSV(data: any[], filePath: string, options: ExportOptions): Promise<number> {
        const fields = options.columns || Object.keys(data[0]);
        
        const parser = new Parser({
            fields,
            header: options.includeHeaders !== false
        });
        
        const csv = parser.parse(data);
        
        fs.writeFileSync(filePath, csv, 'utf-8');
        
        const stats = fs.statSync(filePath);
        return stats.size;
    }
    
    /**
     * Export data to JSON format
     */
    private async exportToJSON(data: any[], filePath: string): Promise<number> {
        const json = JSON.stringify(data, null, 2);
        
        fs.writeFileSync(filePath, json, 'utf-8');
        
        const stats = fs.statSync(filePath);
        return stats.size;
    }
    
    /**
     * Export data to XLSX format
     */
    private async exportToXLSX(data: any[], filePath: string, options: ExportOptions): Promise<number> {
        // For now, we'll use a simple approach with CSV-like format
        // In production, you'd use a library like 'exceljs' or 'xlsx'
        // This is a placeholder that creates a tab-delimited file
        
        const fields = options.columns || Object.keys(data[0]);
        
        let content = '';
        
        // Add headers
        if (options.includeHeaders !== false) {
            content += fields.join('\t') + '\n';
        }
        
        // Add data rows
        for (const row of data) {
            const values = fields.map(field => {
                const value = row[field];
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
            });
            content += values.join('\t') + '\n';
        }
        
        fs.writeFileSync(filePath, content, 'utf-8');
        
        const stats = fs.statSync(filePath);
        return stats.size;
    }
    
    /**
     * Save export to history
     */
    private async saveExportHistory(entry: Omit<ExportHistoryEntry, 'id' | 'createdAt' | 'completedAt' | 'expiresAt'>): Promise<void> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.warn('⚠️  Cannot save export history: database driver not available');
                return;
            }
            
            const dbConnector = await driver.getConcreteDriver();
            
            // Create export history table if not exists
            await dbConnector.query(`
                CREATE TABLE IF NOT EXISTS dra_export_history (
                    id SERIAL PRIMARY KEY,
                    data_source_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    report_type VARCHAR(50) NOT NULL,
                    format VARCHAR(10) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size BIGINT NOT NULL,
                    record_count INTEGER NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    expires_at TIMESTAMP
                )
            `);
            
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
            
            await dbConnector.query(`
                INSERT INTO dra_export_history (
                    data_source_id, user_id, report_type, format, file_name, file_path,
                    file_size, record_count, status, error, completed_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                entry.dataSourceId,
                entry.userId,
                entry.reportType,
                entry.format,
                entry.fileName,
                entry.filePath,
                entry.fileSize,
                entry.recordCount,
                entry.status,
                entry.error || null,
                entry.status === 'completed' ? now : null,
                expiresAt
            ]);
        } catch (error) {
            console.error('❌ Failed to save export history:', error);
        }
    }
    
    /**
     * Get export history for a data source
     */
    public async getExportHistory(dataSourceId: number, limit: number = 20): Promise<ExportHistoryEntry[]> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return [];
            }
            
            const dbConnector = await driver.getConcreteDriver();
            
            const result = await dbConnector.query(`
                SELECT * FROM dra_export_history
                WHERE data_source_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `, [dataSourceId, limit]);
            
            return result.map((row: any) => ({
                id: row.id,
                dataSourceId: row.data_source_id,
                userId: row.user_id,
                reportType: row.report_type,
                format: row.format,
                fileName: row.file_name,
                filePath: row.file_path,
                fileSize: row.file_size,
                recordCount: row.record_count,
                status: row.status,
                error: row.error,
                createdAt: row.created_at,
                completedAt: row.completed_at,
                expiresAt: row.expires_at
            }));
        } catch (error) {
            console.error('❌ Failed to get export history:', error);
            return [];
        }
    }
    
    /**
     * Get export file path
     */
    public getExportFilePath(fileName: string): string {
        return path.join(this.exportDir, fileName);
    }
    
    /**
     * Check if export file exists
     */
    public exportFileExists(fileName: string): boolean {
        const filePath = this.getExportFilePath(fileName);
        return fs.existsSync(filePath);
    }
    
    /**
     * Delete export file
     */
    public deleteExportFile(fileName: string): boolean {
        try {
            const filePath = this.getExportFilePath(fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✅ Deleted export file: ${fileName}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to delete export file ${fileName}:`, error);
            return false;
        }
    }
    
    /**
     * Clean up expired exports
     */
    public async cleanupExpiredExports(): Promise<number> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return 0;
            }
            
            const dbConnector = await driver.getConcreteDriver();
            
            // Find expired exports
            const result = await dbConnector.query(`
                SELECT file_name, file_path FROM dra_export_history
                WHERE expires_at < NOW() AND status = 'completed'
            `);
            
            let deletedCount = 0;
            
            for (const row of result) {
                if (this.deleteExportFile(row.file_name)) {
                    deletedCount++;
                }
            }
            
            // Delete history entries
            await dbConnector.query(`
                DELETE FROM dra_export_history
                WHERE expires_at < NOW()
            `);
            
            console.log(`✅ Cleaned up ${deletedCount} expired exports`);
            return deletedCount;
        } catch (error) {
            console.error('❌ Failed to cleanup expired exports:', error);
            return 0;
        }
    }
    
    /**
     * Get available columns for a report type
     */
    public async getAvailableColumns(reportType: string, networkCode: string): Promise<string[]> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return [];
            }
            
            const dbConnector = await driver.getConcreteDriver();
            const schemaName = 'dra_google_ad_manager';
            const tableName = `${reportType}_${networkCode}`;
            
            const result = await dbConnector.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            `, [schemaName, tableName]);
            
            return result.map((row: any) => row.column_name);
        } catch (error) {
            console.error('❌ Failed to get available columns:', error);
            return [];
        }
    }
}
