import { DataSource } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

/**
 * Application DataSource cached instance
 * Lazily initialized on first access via getAppDataSource()
 */
let cachedDataSource: DataSource | null = null;

/**
 * Get the application DataSource instance
 * Initializes on first call, returns cached instance on subsequent calls
 * 
 * Usage:
 * ```typescript
 * import { getAppDataSource } from '../datasources/PostgresDS.js';
 * const dataSource = await getAppDataSource();
 * const queryRunner = dataSource.createQueryRunner();
 * ```
 */
export async function getAppDataSource(): Promise<DataSource> {
    if (cachedDataSource && cachedDataSource.isInitialized) {
        return cachedDataSource;
    }
    
    const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
    if (!driver) {
        throw new Error('PostgreSQL driver not available');
    }
    const dataSource = await driver.getConcreteDriver();
    if (!dataSource || !dataSource.isInitialized) {
        throw new Error('DataSource not initialized');
    }
    
    cachedDataSource = dataSource;
    return dataSource;
}

/**
 * Synchronous accessor - throws if DataSource not yet initialized
 * Only use this if you're certain the DataSource is already initialized
 * 
 * @deprecated Prefer getAppDataSource() for safer async access
 */
export const AppDataSource = new Proxy({} as DataSource, {
    get(target, prop) {
        if (!cachedDataSource) {
            throw new Error('AppDataSource not initialized. Call getAppDataSource() first or use await pattern.');
        }
        return (cachedDataSource as any)[prop];
    }
});
