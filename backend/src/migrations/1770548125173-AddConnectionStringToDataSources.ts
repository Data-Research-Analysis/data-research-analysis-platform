import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Migration to add connection_string column to dra_data_sources table
 * This column stores MongoDB connection strings (e.g., mongodb+srv://...)
 * and is used when connecting with connection string instead of individual fields
 */
export class AddConnectionStringToDataSources1770548125173 implements MigrationInterface {
    name = 'AddConnectionStringToDataSources1770548125173'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the column already exists
        const table = await queryRunner.getTable('dra_data_sources');
        const connectionStringColumn = table?.findColumnByName('connection_string');

        if (!connectionStringColumn) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'connection_string',
                type: 'text',
                isNullable: true,
                comment: 'MongoDB connection string (e.g., mongodb+srv://...). Used as alternative to individual connection fields.'
            }));
            
            console.log('✅ Successfully added connection_string column to dra_data_sources table');
        } else {
            console.log('✅ connection_string column already exists in dra_data_sources table');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check if the column exists before dropping
        const table = await queryRunner.getTable('dra_data_sources');
        const connectionStringColumn = table?.findColumnByName('connection_string');

        if (connectionStringColumn) {
            await queryRunner.dropColumn('dra_data_sources', 'connection_string');
            console.log('✅ Successfully removed connection_string column from dra_data_sources table');
        } else {
            console.log('⚠️  connection_string column does not exist in dra_data_sources table');
        }
    }
}
