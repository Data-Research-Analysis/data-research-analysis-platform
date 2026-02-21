import { DataSourceProcessor } from './src/processors/DataSourceProcessor.js';
import { DBDriver } from './src/drivers/DBDriver.js';
import { EDataSourceType } from './src/types/EDataSourceType.js';
import { MongoDBImportService } from './src/services/MongoDBImportService.js';

async function testImport() {
  try {
    console.log('🔧 Testing MongoDB import directly...');
    
    // Get data source
    const processor = DataSourceProcessor.getInstance();
    const dataSource =await processor.getDataSourceById(69);
    
    if (!dataSource) {
      throw new Error('Data source 69 not found');
    }
    
    console.log('✅ Data source loaded:', dataSource.id, dataSource.connection_string ? 'has connection string' : 'NO connection string');
    
    // Get PostgreSQL driver
    const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
    if (!driver) {
      throw new Error('PostgreSQL driver not available');
    }
    
    const pgDataSource = await driver.getConcreteDriver();
    console.log('✅ PostgreSQL driver ready');
    
    // Run import
    const importService = MongoDBImportService.getInstance(pgDataSource);
    console.log('🚀 Starting import...');
    
    await importService.importDataSource(dataSource, {
      batchSize: 1000,
      incremental: false
    });
    
    console.log('✅ Import completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImport();
