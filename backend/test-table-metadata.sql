-- Test script to verify dra_table_metadata structure and data
-- This helps diagnose cross-source data model issues

-- 1. Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'dra_table_metadata'
) AS table_exists;

-- 2. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'dra_table_metadata'
ORDER BY ordinal_position;

-- 3. Check if data exists for data_source_id 22
SELECT COUNT(*) as record_count
FROM dra_table_metadata
WHERE data_source_id = 22;

-- 4. Show sample records for data_source_id 22
SELECT 
    id,
    data_source_id,
    schema_name,
    physical_table_name,
    logical_table_name,
    original_sheet_name,
    table_type
FROM dra_table_metadata
WHERE data_source_id = 22
LIMIT 10;

-- 5. Check for tables that might match 'orders', 'products', 'order_items'
SELECT 
    data_source_id,
    schema_name,
    physical_table_name,
    logical_table_name
FROM dra_table_metadata
WHERE data_source_id = 22
AND (
    logical_table_name IN ('orders', 'products', 'order_items')
    OR physical_table_name LIKE '%orders%'
    OR physical_table_name LIKE '%products%'
    OR physical_table_name LIKE '%order_items%'
);

-- 6. Check data sources to see schema patterns
SELECT 
    ds.id,
    ds.data_type,
    ds.connection_details->'schema' as schema,
    COUNT(tm.id) as synced_tables_count
FROM dra_data_source ds
LEFT JOIN dra_table_metadata tm ON tm.data_source_id = ds.id
WHERE ds.data_type IN ('mysql', 'mariadb', 'postgresql')
GROUP BY ds.id, ds.data_type, ds.connection_details->'schema'
ORDER BY ds.id;
