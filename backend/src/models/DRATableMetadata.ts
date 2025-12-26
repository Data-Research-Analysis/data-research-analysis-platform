import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Relation } from 'typeorm';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Entity for mapping physical database table names to logical/display names
 * Solves PostgreSQL's 63-character identifier limit by using short hashed names
 * while preserving human-readable names for users
 */
@Entity('dra_table_metadata')
export class DRATableMetadata {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'data_source_id' })
    data_source_id!: number;

    @Column({ type: 'int', name: 'users_platform_id' })
    users_platform_id!: number;

    @Column({ type: 'varchar', length: 63, name: 'schema_name' })
    schema_name!: string;

    @Column({ type: 'varchar', length: 63, name: 'physical_table_name' })
    physical_table_name!: string;

    @Column({ type: 'text', name: 'logical_table_name' })
    logical_table_name!: string;

    @Column({ type: 'text', nullable: true, name: 'original_sheet_name' })
    original_sheet_name?: string;

    @Column({ type: 'text', nullable: true, name: 'file_id' })
    file_id?: string;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'table_type' })
    table_type?: string; // 'excel', 'pdf', 'google_analytics', 'google_ads', etc.

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    @ManyToOne(() => DRADataSource, dataSource => dataSource.table_metadata, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    data_source!: Relation<DRADataSource>;

    @ManyToOne(() => DRAUsersPlatform, usersPlatform => usersPlatform.table_metadata, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    users_platform!: Relation<DRAUsersPlatform>;
}
