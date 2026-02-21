import { PostgresDataSource } from './src/datasources/PostgresDataSource.js';
import { DRADataSource }  from './src/models/DRADataSource.js';

async function updateConnectionString() {
  try {
    await PostgresDataSource.initialize();
    console.log('✅ Database connected');
    
    const repo = PostgresDataSource.getRepository(DRADataSource);
    const dataSource = await repo.findOne({ where: { id: 69 } });
    
    if (!dataSource) {
      console.error('❌ Data source 69 not found');
      process.exit(1);
    }
    
    console.log('Current connection_string:', dataSource.connection_string ? `${dataSource.connection_string.substring(0, 50)}...` : 'NULL');
    
    // Update with correct connection string
    dataSource.connection_string = 'mongodb+srv://mustafaneguib:Jo74X6EYdtWXHDml@cluster0.dpzqbfe.mongodb.net/cubic';
    
    await repo.save(dataSource);
    console.log('✅ Connection string updated successfully!');
    
    await PostgresDataSource.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateConnectionString();
