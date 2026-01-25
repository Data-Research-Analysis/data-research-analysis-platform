import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRADataModel } from "../models/DRADataModel.js";
import ExcelJS from 'exceljs';
import { Parser } from '@json2csv/plainjs';

/**
 * Interface for export options
 */
export interface IDataModelExportOptions {
    format: 'csv' | 'excel' | 'json';
    includeMetadata?: boolean;
    maxRows?: number;
}

/**
 * Interface for export result
 */
export interface IDataModelExportResult {
    success: boolean;
    buffer?: Buffer;
    filename: string;
    rowCount: number;
    columnCount: number;
    format: string;
    error?: string;
}

/**
 * DataModelExportService - Exports data model results to various formats
 * Supports CSV, Excel (XLSX), and JSON exports with proper formatting
 */
export class DataModelExportService {
    private static instance: DataModelExportService;
    
    private constructor() {}
    
    public static getInstance(): DataModelExportService {
        if (!DataModelExportService.instance) {
            DataModelExportService.instance = new DataModelExportService();
        }
        return DataModelExportService.instance;
    }

    /**
     * Execute data model query and return results
     */
    private async executeDataModelQuery(dataModelId: number, maxRows?: number): Promise<any[]> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver?.manager) {
                throw new Error('Database manager not available');
            }

            const dataModel = await concreteDriver.manager.getRepository(DRADataModel).findOne({
                where: { id: dataModelId }
            });

            if (!dataModel) {
                throw new Error('Data model not found');
            }

            // Execute the SQL query stored in the data model
            let query = dataModel.sql_query;
            
            // Apply row limit if specified
            if (maxRows) {
                // Check if query already has LIMIT clause
                if (!query.toLowerCase().includes('limit')) {
                    query += ` LIMIT ${maxRows}`;
                }
            }

            const results = await concreteDriver.manager.query(query);
            return results;
        } catch (error) {
            console.error('Error executing data model query:', error);
            throw error;
        }
    }

    /**
     * Export data model to CSV
     */
    async exportToCSV(dataModelId: number, options: IDataModelExportOptions): Promise<IDataModelExportResult> {
        try {
            const results = await this.executeDataModelQuery(dataModelId, options.maxRows);

            if (results.length === 0) {
                return {
                    success: false,
                    filename: '',
                    rowCount: 0,
                    columnCount: 0,
                    format: 'csv',
                    error: 'No data to export'
                };
            }

            // Get column names from first row
            const columns = Object.keys(results[0]);

            // Use json2csv to convert to CSV
            const parser = new Parser({
                fields: columns
            });

            const csv = parser.parse(results);
            const buffer = Buffer.from(csv, 'utf-8');

            const filename = `data_model_${dataModelId}_${Date.now()}.csv`;

            return {
                success: true,
                buffer,
                filename,
                rowCount: results.length,
                columnCount: columns.length,
                format: 'csv'
            };
        } catch (error: any) {
            console.error('Error exporting to CSV:', error);
            return {
                success: false,
                filename: '',
                rowCount: 0,
                columnCount: 0,
                format: 'csv',
                error: error.message
            };
        }
    }

    /**
     * Export data model to Excel (XLSX)
     */
    async exportToExcel(dataModelId: number, options: IDataModelExportOptions): Promise<IDataModelExportResult> {
        try {
            const results = await this.executeDataModelQuery(dataModelId, options.maxRows);

            if (results.length === 0) {
                return {
                    success: false,
                    filename: '',
                    rowCount: 0,
                    columnCount: 0,
                    format: 'excel',
                    error: 'No data to export'
                };
            }

            // Create new Excel workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data');

            // Get column names from first row
            const columns = Object.keys(results[0]);

            // Add header row with styling
            worksheet.columns = columns.map(col => ({
                header: col,
                key: col,
                width: Math.max(col.length + 5, 15) // Auto-size columns
            }));

            // Style header row
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add data rows
            results.forEach(row => {
                worksheet.addRow(row);
            });

            // Add borders to all cells
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Add metadata sheet if requested
            if (options.includeMetadata) {
                const metadataSheet = workbook.addWorksheet('Metadata');
                metadataSheet.columns = [
                    { header: 'Property', key: 'property', width: 20 },
                    { header: 'Value', key: 'value', width: 40 }
                ];

                metadataSheet.addRow({ property: 'Data Model ID', value: dataModelId });
                metadataSheet.addRow({ property: 'Exported At', value: new Date().toISOString() });
                metadataSheet.addRow({ property: 'Total Rows', value: results.length });
                metadataSheet.addRow({ property: 'Total Columns', value: columns.length });

                // Style metadata header
                metadataSheet.getRow(1).font = { bold: true };
            }

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;

            const filename = `data_model_${dataModelId}_${Date.now()}.xlsx`;

            return {
                success: true,
                buffer,
                filename,
                rowCount: results.length,
                columnCount: columns.length,
                format: 'excel'
            };
        } catch (error: any) {
            console.error('Error exporting to Excel:', error);
            return {
                success: false,
                filename: '',
                rowCount: 0,
                columnCount: 0,
                format: 'excel',
                error: error.message
            };
        }
    }

    /**
     * Export data model to JSON
     */
    async exportToJSON(dataModelId: number, options: IDataModelExportOptions): Promise<IDataModelExportResult> {
        try {
            const results = await this.executeDataModelQuery(dataModelId, options.maxRows);

            if (results.length === 0) {
                return {
                    success: false,
                    filename: '',
                    rowCount: 0,
                    columnCount: 0,
                    format: 'json',
                    error: 'No data to export'
                };
            }

            const columns = Object.keys(results[0]);

            const exportData: any = {
                data: results
            };

            if (options.includeMetadata) {
                exportData.metadata = {
                    dataModelId,
                    exportedAt: new Date().toISOString(),
                    totalRows: results.length,
                    totalColumns: columns.length,
                    columns: columns
                };
            }

            const json = JSON.stringify(exportData, null, 2);
            const buffer = Buffer.from(json, 'utf-8');

            const filename = `data_model_${dataModelId}_${Date.now()}.json`;

            return {
                success: true,
                buffer,
                filename,
                rowCount: results.length,
                columnCount: columns.length,
                format: 'json'
            };
        } catch (error: any) {
            console.error('Error exporting to JSON:', error);
            return {
                success: false,
                filename: '',
                rowCount: 0,
                columnCount: 0,
                format: 'json',
                error: error.message
            };
        }
    }

    /**
     * Main export method - routes to appropriate format
     */
    async exportDataModel(
        dataModelId: number, 
        options: IDataModelExportOptions
    ): Promise<IDataModelExportResult> {
        switch (options.format.toLowerCase()) {
            case 'csv':
                return this.exportToCSV(dataModelId, options);
            case 'excel':
                return this.exportToExcel(dataModelId, options);
            case 'json':
                return this.exportToJSON(dataModelId, options);
            default:
                return {
                    success: false,
                    filename: '',
                    rowCount: 0,
                    columnCount: 0,
                    format: options.format,
                    error: `Unsupported export format: ${options.format}`
                };
        }
    }

    /**
     * Export multiple data models to a single Excel workbook (multi-sheet)
     */
    async exportMultipleToExcel(
        dataModelIds: number[], 
        options: IDataModelExportOptions
    ): Promise<IDataModelExportResult> {
        try {
            const workbook = new ExcelJS.Workbook();
            let totalRows = 0;
            let totalColumns = 0;

            for (const dataModelId of dataModelIds) {
                const results = await this.executeDataModelQuery(dataModelId, options.maxRows);
                
                if (results.length === 0) continue;

                const columns = Object.keys(results[0]);
                const worksheet = workbook.addWorksheet(`Model ${dataModelId}`);

                // Add header row with styling
                worksheet.columns = columns.map(col => ({
                    header: col,
                    key: col,
                    width: Math.max(col.length + 5, 15)
                }));

                worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                worksheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };

                // Add data rows
                results.forEach(row => {
                    worksheet.addRow(row);
                });

                // Add borders
                worksheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                });

                totalRows += results.length;
                totalColumns = Math.max(totalColumns, columns.length);
            }

            const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
            const filename = `data_models_export_${Date.now()}.xlsx`;

            return {
                success: true,
                buffer,
                filename,
                rowCount: totalRows,
                columnCount: totalColumns,
                format: 'excel'
            };
        } catch (error: any) {
            console.error('Error exporting multiple models to Excel:', error);
            return {
                success: false,
                filename: '',
                rowCount: 0,
                columnCount: 0,
                format: 'excel',
                error: error.message
            };
        }
    }
}
