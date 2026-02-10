import { DataSourceProcessor } from './src/processors/DataSourceProcessor.js';

async function checkDataSource() {
  try {
    const processor = DataSourceProcessor.getInstance();
    const dataSource = await processor.getDataSourceById(69);
    
    if (!dataSource) {
      console.error('❌ Data source 69 not found');
      process.exit(1);
    }
    
    console.log('✅ Data source loaded');
    console.log('ID:', dataSource.id);
    console.log('Data type:', dataSource.data_type);
    console.log('Connection string:', dataSource.connection_string ? `${dataSource.connection_string.substring(0, 50)}...` : 'NULL');
    console.log('Connection string length:', dataSource.connection_string ? dataSource.connection_string.length : 0);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDataSource();
