import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Meta (Facebook) Ads as a data source type
 * Adds 'meta_ads' to the data_type enum in dra_data_sources table
 * and creates the dra_meta_ads schema
 */
export class AddMetaAdsDataSource1767388101955 implements MigrationInterface {
    name = 'AddMetaAdsDataSource1767388101955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the enum type exists first
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_type 
                WHERE typname = 'dra_data_sources_data_type_enum'
            );
        `);
        
        if (!enumExists[0].exists) {
            console.log('⚠️  Enum type does not exist yet, skipping enum alteration');
            console.log('   This migration will be applied after CreateTables migration runs');
        } else {
            // Check if the value already exists
            const valueExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_enum 
                    WHERE enumlabel = 'meta_ads' 
                    AND enumtypid = (
                        SELECT oid 
                        FROM pg_type 
                        WHERE typname = 'dra_data_sources_data_type_enum'
                    )
                );
            `);
            
            if (!valueExists[0].exists) {
                // Add meta_ads to the enum type
                await queryRunner.query(`
                    ALTER TYPE "dra_data_sources_data_type_enum" 
                    ADD VALUE 'meta_ads'
                `);
                
                console.log('✅ Successfully added meta_ads to data source types');
            } else {
                console.log('✅ meta_ads already exists in data source types');
            }
        }

        // Create the dra_meta_ads schema (tables are created dynamically by MetaAdsDriver)
        const schemaExists = await queryRunner.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = 'dra_meta_ads'
        `);

        if (schemaExists.length === 0) {
            await queryRunner.query(`CREATE SCHEMA "dra_meta_ads"`);
            console.log('✅ Successfully created dra_meta_ads schema');
        } else {
            console.log('✅ dra_meta_ads schema already exists');
        }

        console.log(`
        ================================================
        Meta Ads Data Source Migration Complete
        ================================================
        
        Next Steps:
        1. Configure environment variables:
           - META_APP_ID
           - META_APP_SECRET
           - META_REDIRECT_URI
        
        2. Set up Meta App at https://developers.facebook.com/apps
           - Add Marketing API product
           - Configure OAuth redirect URIs
           - Copy App ID and App Secret
        
        3. Required Permissions:
           - ads_read (Read ads and campaigns)
           - business_management (Access ad accounts)
        
        Tables will be created dynamically when data sources are added.
        Schema structure per data source:
           - campaigns_[dataSourceId]
           - adsets_[dataSourceId]
           - ads_[dataSourceId]
           - insights_[dataSourceId]
        ================================================
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the schema (this will cascade and drop all tables)
        await queryRunner.query(`DROP SCHEMA IF EXISTS "dra_meta_ads" CASCADE`);
        console.log('✅ Dropped dra_meta_ads schema');

        // Note: Cannot remove enum value in PostgreSQL without recreating the enum
        // Manual intervention required if you need to remove the 'meta_ads' value
        console.log('⚠️  Note: meta_ads enum value remains (PostgreSQL limitation)');
        console.log('   Manual cleanup required if complete rollback is needed');
    }
}
